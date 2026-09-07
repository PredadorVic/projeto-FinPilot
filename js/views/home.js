'use strict';

import { brl, escapeHTML, formatDate, monthKeyFromDate, today } from '../utils.js';
import { financialTotals } from '../calculations.js';
import { metric, heroMetric, emptyState, reliabilityChip, statusChip } from '../ui.js';
import { insightCardHTML } from '../actions/insights.js';

function renderIncomeItem(item, occurrenceStatus) {
  const status = occurrenceStatus(item);
  const value = status === 'RECEIVED' ? Number(item.receipt.actualAmount || 0) : item.estimatedAmount;
  const date = status === 'RECEIVED' ? item.receipt.receivedDate : item.expectedDate;
  const confidence = item.confidence !== null && item.reliability !== 'GUARANTEED' ? `Certeza ${item.confidence}%` : '';
  const actionButtons =
    status === 'PENDING'
      ? `<div class="income-actions">
          <button class="tiny-btn confirm" data-action="receiveIncome" data-occurrence-id="${escapeHTML(item.occurrenceId)}" type="button">✓ Recebi</button>
          <button class="tiny-btn" data-action="cancelIncome" data-occurrence-id="${escapeHTML(item.occurrenceId)}" type="button">Cancelar</button>
        </div>`
      : '';
  return `<div class="income-item">
    <div class="income-main">
      <div class="income-name"><strong>${escapeHTML(item.name)}</strong>${reliabilityChip(item.reliability)}${statusChip(status)}</div>
      <div class="income-meta">
        <span>${status === 'RECEIVED' ? 'Recebido em' : 'Previsto para'} ${formatDate(date)}</span>
        ${confidence ? `<span>• ${confidence}</span>` : ''}
        ${item.recurring ? '<span>• Recorrente</span>' : ''}
      </div>
    </div>
    <div class="income-value"><b>${brl(value)}</b>${actionButtons}</div>
  </div>`;
}

export function renderIncomeGroup(title, reliability, occurrences, occurrenceStatus) {
  const items = occurrences.filter(item => item.reliability === reliability && occurrenceStatus(item) !== 'CANCELLED');
  if (!items.length) return '';
  const total = items.reduce(
    (sum, item) => sum + (occurrenceStatus(item) === 'RECEIVED' ? Number(item.receipt.actualAmount || 0) : item.estimatedAmount),
    0
  );
  return `<section class="income-group">
    <div class="income-group-head"><h3>${title}</h3><span class="income-group-total">${brl(total)}</span></div>
    ${items.map(item => renderIncomeItem(item, occurrenceStatus)).join('')}
  </section>`;
}

function setupProgress(state) {
  const checks = [
    state.accounts.length > 0,
    state.incomeDefinitions.length > 0,
    Number(state.user.safetyMargin || 0) > 0,
    state.goals.length > 0
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function renderHome(state, occurrenceStatus) {
  const totals = financialTotals(state, monthKeyFromDate(today()));
  const hasData = state.accounts.length || state.incomeDefinitions.length || state.expenses.length;

  return `
    <div class="hero">
      <h2>${hasData ? 'Seu dinheiro, calculado apenas com os dados que você cadastrou.' : 'Comece cadastrando seus próprios valores.'}</h2>
      <p>Nenhum saldo, salário, cartão ou meta é preenchido pelo FinPilot. Você informa os valores e o sistema apenas organiza, calcula e separa o que é garantido do que é possível.</p>
      <div class="hero-actions">
        <button class="secondary" data-action="addAccount" type="button">Cadastrar conta</button>
        <button class="secondary" data-action="addSalary" type="button">Cadastrar salário</button>
      </div>
    </div>
    <div class="grid cards">
      ${heroMetric('Tenho agora', brl(totals.liquid), 'Saldo das contas disponíveis cadastradas por você', 'info')}
      ${metric('Vou receber', brl(totals.guaranteed), 'Entradas garantidas ainda pendentes', 'positive')}
      ${metric('Posso receber', brl(totals.expected + totals.variable), 'Previstas + variáveis', 'warning')}
      ${metric('Talvez receba', brl(totals.eventual), 'Entradas eventuais', 'neutral')}
      ${metric('Saldo seguro futuro', brl(totals.safeFuture), 'Saldo atual + garantido', 'positive')}
      ${metric('Saldo projetado', brl(totals.projected), 'Seguro + previsto + variável', 'warning')}
      ${metric('Potencial máximo', brl(totals.potentialMax), 'Inclui entradas eventuais', 'neutral')}
      ${metric('Reservado', brl(totals.reservedBRL), 'Contas/caixinhas marcadas como reservadas', 'info')}
    </div>
    <div class="grid section-grid">
      <div class="card">
        <div class="section-title"><h3>Entradas deste mês</h3><button class="ghost" data-nav="income" type="button">Gerenciar renda</button></div>
        ${
          totals.occurrences.length
            ? `${renderIncomeGroup('Garantidas', 'GUARANTEED', totals.occurrences, occurrenceStatus)}${renderIncomeGroup('Previstas', 'EXPECTED', totals.occurrences, occurrenceStatus)}${renderIncomeGroup('Variáveis', 'VARIABLE', totals.occurrences, occurrenceStatus)}${renderIncomeGroup('Eventuais', 'EVENTUAL', totals.occurrences, occurrenceStatus)}`
            : emptyState('Nenhuma renda cadastrada para este mês.', 'addSalary', 'Cadastrar salário')
        }
      </div>
      <div class="card">
        <div class="section-title"><h3>Configuração</h3><span class="pill">${setupProgress(state)}%</span></div>
        <div class="summary-list">
          <div class="summary-row"><span>Contas cadastradas</span><strong>${state.accounts.length}</strong></div>
          <div class="summary-row"><span>Fontes de renda</span><strong>${state.incomeDefinitions.length}</strong></div>
          <div class="summary-row"><span>Metas</span><strong>${state.goals.length}</strong></div>
          <div class="summary-row"><span>Margem de segurança</span><strong>${brl(state.user.safetyMargin)}</strong></div>
        </div>
        <div class="item-actions"><button class="secondary" data-action="openSettings" type="button">Configurar perfil financeiro</button></div>
      </div>
    </div>
    ${insightCardHTML(state)}`;
}
