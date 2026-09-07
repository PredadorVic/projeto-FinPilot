'use strict';

import { brl, percent } from '../utils.js';
import { liquidBalance } from '../calculations.js';
import {
  compoundInterestProjection,
  purchaseDecision,
  debtVsInvest,
  retirementPlan,
  compareFixedIncomeOptions
} from '../simulators.js';
import { openModal } from '../ui.js';
import { getState, persistAndRender } from '../store.js';

const DISCLAIMER =
  '<div class="modal-note">As taxas são as que você informar — nada aqui é uma promessa de rentabilidade nem uma recomendação de investimento. Retornos passados não garantem retornos futuros.</div>';

function savedInputs(key) {
  return getState().simulatorInputs[key] || {};
}

function saveInputs(key, values) {
  getState().simulatorInputs[key] = values;
  persistAndRender();
}

function numberField(id, label, { value = '', step = '0.01', min = '0', placeholder = '0,00', required = true } = {}) {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="number" step="${step}" ${
    min !== null ? `min="${min}"` : ''
  } ${required ? 'required' : ''} value="${value}" placeholder="${placeholder}"></div>`;
}

function resultBox(html) {
  const box = document.querySelector('#simResult');
  if (box) box.innerHTML = `<div class="insight sim-result">${html}</div>`;
}

// ---------------------------------------------------------------------------
// 1) Juros compostos
// ---------------------------------------------------------------------------

function renderCompoundResult(result) {
  const row = (label, scenario) =>
    `<tr><td>${label}</td><td>${brl(scenario.nominalFinal)}</td><td>${brl(scenario.realFinal)}</td><td>${brl(scenario.nominalInterest)}</td></tr>`;
  return `<strong>Total investido: ${brl(result.expected.totalInvested)}</strong>
    <table class="sim-table">
      <thead><tr><th>Cenário</th><th>Final nominal</th><th>Final em valor real</th><th>Juros nominais</th></tr></thead>
      <tbody>
        ${row('Conservador (-30%)', result.conservative)}
        ${row('Provável', result.expected)}
        ${row('Otimista (+30%)', result.optimistic)}
      </tbody>
    </table>
    <p class="subtle">"Valor real" já desconta a inflação informada — é o que esse dinheiro compraria no poder de compra de hoje.</p>`;
}

export function openCompoundInterest() {
  const saved = savedInputs('compound');
  openModal(
    'Simulador de juros compostos',
    `<form id="compoundForm"><div class="form-grid">
      ${numberField('ciInitial', 'Valor inicial', { value: saved.initial ?? '', required: false })}
      ${numberField('ciMonthly', 'Aporte mensal', { value: saved.monthlyContribution ?? '' })}
      ${numberField('ciRate', 'Taxa (% ao ano)', { value: saved.annualRatePercent ?? '', step: '0.01' })}
      ${numberField('ciMonths', 'Prazo (meses)', { value: saved.months ?? '', step: '1', placeholder: 'Ex.: 60' })}
      ${numberField('ciInflation', 'Inflação esperada (% ao ano)', { value: saved.annualInflationPercent ?? '4', required: false })}
    </div>${DISCLAIMER}<div id="simResult"></div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Fechar</button><button class="primary" type="submit">Calcular</button></div></form>`
  );
  document.querySelector('#compoundForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      initial: Number(form.get('ciInitial') || 0),
      monthlyContribution: Number(form.get('ciMonthly') || 0),
      annualRatePercent: Number(form.get('ciRate') || 0),
      months: Number(form.get('ciMonths') || 0),
      annualInflationPercent: Number(form.get('ciInflation') || 0)
    };
    saveInputs('compound', values);
    resultBox(renderCompoundResult(compoundInterestProjection(values)));
  };
}

// ---------------------------------------------------------------------------
// 2) Posso comprar? / Parcelado x à vista
// ---------------------------------------------------------------------------

const MATH_VERDICT_TEXT = {
  CASH: 'Matematicamente, pagar à vista sai mais barato do que parcelar e investir a diferença.',
  INSTALLMENTS: 'Matematicamente, parcelar e investir o restante rende mais do que pagar à vista.',
  EQUIVALENT: 'Matematicamente, à vista e parcelado ficam praticamente empatados.'
};

function renderPurchaseResult(result) {
  return `<strong class="${result.tier === 'GREEN' ? 'positive' : result.tier === 'YELLOW' ? 'warning' : 'danger'}">${result.tierInfo.icon} ${result.tierInfo.label}</strong>
    <p class="subtle">Impacto imediato no caixa: ${brl(result.immediateHit)} — seu espaço livre acima da margem de segurança é ${brl(result.safeSpendNow)}.</p>
    ${
      result.months > 1
        ? `<p class="subtle">Parcela: ${brl(result.installmentValue)}. Juro embutido no parcelamento: aproximadamente ${percent(
            result.impliedMonthlyRatePercent
          )} ao mês. ${MATH_VERDICT_TEXT[result.mathVerdict]}</p>`
        : ''
    }`;
}

export function openPurchaseDecision() {
  const state = getState();
  const saved = savedInputs('purchase');
  openModal(
    'Posso comprar? / Parcelado x à vista',
    `<form id="purchaseForm"><div class="form-grid">
      ${numberField('pdTotal', 'Valor total (à vista ou soma das parcelas)', { value: saved.totalValue ?? '' })}
      ${numberField('pdInstallments', 'Número de parcelas', { value: saved.installmentsCount ?? '1', step: '1' })}
      ${numberField('pdCash', 'Preço à vista, se for diferente (opcional)', { value: saved.cashPrice ?? '', required: false })}
      ${numberField('pdInvestRate', 'Se não gastasse, quanto renderia investido (% ao ano)', { value: saved.investmentAnnualRatePercent ?? '', required: false })}
    </div><div class="modal-note">Usa sua margem de segurança (${brl(state.user.safetyMargin)}) e seu saldo atual disponível (${brl(
      liquidBalance(state.accounts)
    )}). Entradas incertas nunca contam como dinheiro disponível aqui.</div><div id="simResult"></div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Fechar</button><button class="primary" type="submit">Analisar</button></div></form>`
  );
  document.querySelector('#purchaseForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      totalValue: Number(form.get('pdTotal') || 0),
      installmentsCount: Number(form.get('pdInstallments') || 1),
      cashPrice: form.get('pdCash') === '' ? null : Number(form.get('pdCash')),
      investmentAnnualRatePercent: Number(form.get('pdInvestRate') || 0)
    };
    saveInputs('purchase', values);
    const result = purchaseDecision({
      ...values,
      liquidBalance: liquidBalance(state.accounts),
      safetyMargin: Number(state.user.safetyMargin || 0)
    });
    resultBox(renderPurchaseResult(result));
  };
}

// ---------------------------------------------------------------------------
// 3) Dívida: quitar x investir
// ---------------------------------------------------------------------------

function renderDebtResult(result) {
  const verdictText = {
    PAY_DEBT: '🔽 Priorize quitar/abater a dívida — ela custa mais do que o investimento renderia.',
    INVEST: '📈 Priorize investir — o retorno esperado supera o custo da dívida.',
    EQUIVALENT: '⚖️ As duas opções ficam praticamente equivalentes nesse horizonte.'
  }[result.recommendation];
  return `<strong>${verdictText}</strong>
    <p class="subtle">Juros que você deixaria de pagar quitando: ${brl(result.interestAvoidedByPayingDebt)}. Retorno estimado se investir: ${brl(
    result.returnIfInvested
  )}.</p>`;
}

export function openDebtVsInvest() {
  const saved = savedInputs('debtVsInvest');
  openModal(
    'Quitar dívida x investir',
    `<form id="debtForm"><div class="form-grid">
      ${numberField('dviAmount', 'Valor disponível', { value: saved.availableAmount ?? '' })}
      ${numberField('dviDebtRate', 'Juros da dívida (% ao ano)', { value: saved.debtAnnualRatePercent ?? '' })}
      ${numberField('dviInvestRate', 'Retorno do investimento (% ao ano)', { value: saved.investAnnualRatePercent ?? '' })}
      ${numberField('dviMonths', 'Horizonte de comparação (meses)', { value: saved.months ?? '12', step: '1' })}
    </div>${DISCLAIMER}<div id="simResult"></div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Fechar</button><button class="primary" type="submit">Comparar</button></div></form>`
  );
  document.querySelector('#debtForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      availableAmount: Number(form.get('dviAmount') || 0),
      debtAnnualRatePercent: Number(form.get('dviDebtRate') || 0),
      investAnnualRatePercent: Number(form.get('dviInvestRate') || 0),
      months: Number(form.get('dviMonths') || 12)
    };
    saveInputs('debtVsInvest', values);
    resultBox(renderDebtResult(debtVsInvest(values)));
  };
}

// ---------------------------------------------------------------------------
// 4) Aposentadoria / independência financeira
// ---------------------------------------------------------------------------

function renderRetirementResult(plan) {
  const years = (plan.monthsToTarget / 12).toFixed(1);
  let extra = '';
  if ('requiredMonthlyContribution' in plan) {
    extra = `<p><strong>Aporte mensal necessário: ${brl(plan.requiredMonthlyContribution)}</strong></p>`;
  } else {
    extra = `<p><strong>${plan.onTrack ? '✅ No caminho certo' : '⚠️ Abaixo da meta'}</strong> — patrimônio projetado: ${brl(
      plan.projectedCapital
    )} (${plan.surplusOrShortfall >= 0 ? 'sobra' : 'falta'} ${brl(Math.abs(plan.surplusOrShortfall))}).</p>`;
  }
  return `<p class="subtle">Faltam ${years} ano(s). Capital necessário em valores de hoje: ${brl(
    plan.requiredCapitalToday
  )}. Corrigido pela inflação até lá: ${brl(plan.requiredCapitalFuture)}.</p>${extra}`;
}

export function openRetirementPlan() {
  const saved = savedInputs('retirement');
  openModal(
    'Aposentadoria / independência financeira',
    `<form id="retirementForm"><div class="form-grid">
      ${numberField('rpCurrentAge', 'Sua idade atual', { value: saved.currentAge ?? '', step: '1' })}
      ${numberField('rpTargetAge', 'Idade alvo', { value: saved.targetAge ?? '', step: '1' })}
      ${numberField('rpIncome', 'Renda mensal desejada (em valores de hoje)', { value: saved.desiredMonthlyIncomeToday ?? '' })}
      ${numberField('rpWithdrawal', 'Taxa segura de retirada (% ao ano)', { value: saved.safeWithdrawalAnnualPercent ?? '4' })}
      ${numberField('rpInvested', 'Já investido hoje', { value: saved.currentInvested ?? '0', required: false })}
      ${numberField('rpContribution', 'Aporte mensal (deixe em branco para eu calcular)', { value: saved.monthlyContribution ?? '', required: false })}
      ${numberField('rpReturn', 'Retorno esperado (% ao ano)', { value: saved.expectedAnnualReturnPercent ?? '' })}
      ${numberField('rpInflation', 'Inflação esperada (% ao ano)', { value: saved.annualInflationPercent ?? '4' })}
    </div>${DISCLAIMER}<div id="simResult"></div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Fechar</button><button class="primary" type="submit">Calcular</button></div></form>`
  );
  document.querySelector('#retirementForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contributionRaw = form.get('rpContribution');
    const values = {
      currentAge: Number(form.get('rpCurrentAge') || 0),
      targetAge: Number(form.get('rpTargetAge') || 0),
      desiredMonthlyIncomeToday: Number(form.get('rpIncome') || 0),
      safeWithdrawalAnnualPercent: Number(form.get('rpWithdrawal') || 4),
      currentInvested: Number(form.get('rpInvested') || 0),
      monthlyContribution: contributionRaw === '' ? '' : Number(contributionRaw),
      expectedAnnualReturnPercent: Number(form.get('rpReturn') || 0),
      annualInflationPercent: Number(form.get('rpInflation') || 0)
    };
    saveInputs('retirement', values);
    resultBox(renderRetirementResult(retirementPlan(values)));
  };
}

// ---------------------------------------------------------------------------
// 5) Comparador de renda fixa
// ---------------------------------------------------------------------------

const FIXED_INCOME_DEFAULTS = [
  { name: 'Tesouro Selic', grossAnnualRatePercent: 10.5, days: 365, isExempt: false },
  { name: 'CDB 100% CDI', grossAnnualRatePercent: 10.5, days: 365, isExempt: false },
  { name: 'LCI/LCA 90% CDI', grossAnnualRatePercent: 9.5, days: 365, isExempt: true }
];

function fixedIncomeRow(option, index) {
  return `<tr>
    <td><input name="fiName${index}" value="${option.name}" placeholder="Nome"></td>
    <td><input name="fiRate${index}" type="number" step="0.01" min="0" value="${option.grossAnnualRatePercent}"></td>
    <td><input name="fiDays${index}" type="number" step="1" min="1" value="${option.days}"></td>
    <td style="text-align:center"><input type="checkbox" name="fiExempt${index}" ${option.isExempt ? 'checked' : ''}></td>
  </tr>`;
}

function renderFixedIncomeResult(compared) {
  const rows = compared
    .map(
      option => `<tr>
        <td>${option.name || 'Opção'}</td>
        <td>${percent(option.result.netAnnualEquivalentPercent, 2)}</td>
        <td>${percent(option.result.realAnnualEquivalentPercent, 2)}</td>
        <td>${option.isExempt ? 'Isento' : percent(option.result.irRatePercent, 1)}</td>
      </tr>`
    )
    .join('');
  return `<table class="sim-table">
    <thead><tr><th>Opção</th><th>Líquido anualizado</th><th>Real anualizado</th><th>IR</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="subtle">"Real anualizado" já desconta a inflação informada. Renda fixa tradicional segue a tabela regressiva de IR (22,5% a 15%); LCI/LCA costuma ser isenta para pessoa física — confirme a regra vigente antes de decidir.</p>`;
}

export function openFixedIncomeCompare() {
  const saved = getState().simulatorInputs.fixedIncome || { options: FIXED_INCOME_DEFAULTS, annualInflationPercent: 4 };
  openModal(
    'Comparador de renda fixa',
    `<form id="fixedIncomeForm">
      <table class="sim-table sim-table-input">
        <thead><tr><th>Opção</th><th>Taxa bruta (% a.a.)</th><th>Prazo (dias)</th><th>Isento de IR?</th></tr></thead>
        <tbody>${saved.options.map(fixedIncomeRow).join('')}</tbody>
      </table>
      <div class="form-grid" style="margin-top:12px">${numberField('fiInflation', 'Inflação esperada (% ao ano)', {
        value: saved.annualInflationPercent ?? 4,
        required: false
      })}</div>
      ${DISCLAIMER}<div id="simResult"></div>
      <div class="actions"><button type="button" class="ghost" data-action="closeModal">Fechar</button><button class="primary" type="submit">Comparar</button></div>
    </form>`
  );
  document.querySelector('#fixedIncomeForm').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const options = saved.options.map((_, index) => ({
      name: String(form.get(`fiName${index}`) || `Opção ${index + 1}`).trim(),
      grossAnnualRatePercent: Number(form.get(`fiRate${index}`) || 0),
      days: Number(form.get(`fiDays${index}`) || 1),
      isExempt: form.get(`fiExempt${index}`) === 'on'
    }));
    const annualInflationPercent = Number(form.get('fiInflation') || 0);
    saveInputs('fixedIncome', { options, annualInflationPercent });
    resultBox(renderFixedIncomeResult(compareFixedIncomeOptions(options, { annualInflationPercent })));
  };
}
