'use strict';

import { brl, escapeHTML, formatDate } from '../utils.js';
import { financialTotals } from '../calculations.js';
import { metric, emptyState, monthSwitcher, reliabilityChip } from '../ui.js';
import { renderIncomeGroup } from './home.js';

function recurrenceLabel(definition) {
  if (!definition.recurring || !definition.recurrence) return 'Não recorrente';
  const rule = definition.recurrence;
  if (rule.type === 'FIFTH_BUSINESS_DAY') return '5º dia útil de cada mês';
  if (rule.type === 'FIRST_BUSINESS_DAY') return '1º dia útil de cada mês';
  if (rule.type === 'LAST_BUSINESS_DAY') return 'Último dia útil de cada mês';
  if (rule.type === 'MONTHLY_DAY') return `Todo dia ${rule.day}`;
  if (rule.type === 'WEEKLY') return 'Semanal';
  if (rule.type === 'BIWEEKLY') return 'Quinzenal';
  if (rule.type === 'YEARLY') return 'Anual';
  return 'Recorrente';
}

function definitionCard(definition) {
  const kindLabel = definition.kind === 'SALARY' ? 'Salário' : definition.category || 'Outra renda';
  return `<div class="definition-card">
    <div>
      <div class="income-name"><strong>${escapeHTML(definition.name)}</strong>${reliabilityChip(definition.reliability)}</div>
      <div class="income-meta">
        <span>${escapeHTML(kindLabel)}</span>
        <span>• ${escapeHTML(recurrenceLabel(definition))}</span>
        ${definition.startDate ? `<span>• Início ${formatDate(definition.startDate)}</span>` : ''}
        ${definition.expectedDate ? `<span>• ${formatDate(definition.expectedDate)}</span>` : ''}
      </div>
    </div>
    <div class="definition-value">
      <b>${brl(definition.estimatedAmount)}</b>
      <div class="item-actions">
        <button class="tiny-btn" data-action="editIncomeDefinition" data-id="${definition.id}" type="button">Editar</button>
        <button class="tiny-btn" data-action="deleteIncomeDefinition" data-id="${definition.id}" type="button">Excluir</button>
      </div>
    </div>
  </div>`;
}

export function renderIncome(state, selectedMonth, occurrenceStatus, monthLabelFn) {
  const totals = financialTotals(state, selectedMonth);
  const salaries = state.incomeDefinitions.filter(item => item.kind === 'SALARY');
  const others = state.incomeDefinitions.filter(item => item.kind !== 'SALARY');
  const salaryMonth = totals.occurrences
    .filter(item => item.kind === 'SALARY' && occurrenceStatus(item) !== 'CANCELLED')
    .reduce((sum, item) => sum + (occurrenceStatus(item) === 'RECEIVED' ? Number(item.receipt.actualAmount || 0) : item.estimatedAmount), 0);
  const otherGuaranteed =
    totals.guaranteed - totals.pending.filter(x => x.kind === 'SALARY' && x.reliability === 'GUARANTEED').reduce((s, x) => s + x.estimatedAmount, 0);

  return `
    <div class="toolbar spread">
      <div class="toolbar-group">
        <button class="primary" data-action="addSalary" type="button">+ Salário mensal</button>
        <button class="secondary" data-action="addIncome" type="button">+ Outra entrada</button>
      </div>
      ${monthSwitcher(selectedMonth, monthLabelFn)}
    </div>
    <div class="grid cards">
      ${metric('Salário no mês', brl(salaryMonth), 'Somente salários que você cadastrou', 'positive', true)}
      ${metric('Outras garantidas', brl(otherGuaranteed), 'Rendas fixas fora de salário', 'positive')}
      ${metric('Previstas + variáveis', brl(totals.expected + totals.variable), 'Não entram no saldo seguro', 'warning')}
      ${metric('Eventuais', brl(totals.eventual), 'Não fazem parte da renda normal', 'neutral')}
    </div>
    <div class="grid section-grid">
      <div class="card">
        <div class="section-title"><h3>Salário mensal</h3><span class="subtle">Você define valor e regra de pagamento.</span></div>
        ${salaries.length ? salaries.map(definitionCard).join('') : emptyState('Nenhum salário cadastrado.', 'addSalary', 'Cadastrar salário')}
      </div>
      <div class="card">
        <div class="section-title"><h3>Outras fontes de renda</h3></div>
        ${others.length ? others.map(definitionCard).join('') : emptyState('Nenhuma outra fonte de renda cadastrada.', 'addIncome', 'Adicionar entrada')}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="section-title"><h3>Ocorrências de ${monthLabelFn(selectedMonth)}</h3><span class="subtle">Receba, cancele ou acompanhe cada entrada.</span></div>
      ${
        totals.occurrences.length
          ? `${renderIncomeGroup('Garantidas', 'GUARANTEED', totals.occurrences, occurrenceStatus)}${renderIncomeGroup('Previstas', 'EXPECTED', totals.occurrences, occurrenceStatus)}${renderIncomeGroup('Variáveis', 'VARIABLE', totals.occurrences, occurrenceStatus)}${renderIncomeGroup('Eventuais', 'EVENTUAL', totals.occurrences, occurrenceStatus)}`
          : '<div class="empty-state">Nenhuma ocorrência neste mês.</div>'
      }
    </div>`;
}
