'use strict';

import { brl, escapeHTML, formatDate, monthKeyFromISO, money } from '../utils.js';
import { financialTotals, accountValueBRL } from '../calculations.js';
import { metric, emptyState, monthSwitcher } from '../ui.js';

export function renderFinances(state, selectedMonth, monthLabelFn) {
  const totals = financialTotals(state, selectedMonth);
  const monthExpenses = state.expenses.filter(exp => monthKeyFromISO(exp.date) === selectedMonth);

  return `
    <div class="toolbar spread">
      <div class="toolbar-group">
        <button class="primary" data-action="addExpense" type="button">+ Despesa</button>
        <button class="secondary" data-action="addAccount" type="button">+ Conta / caixinha</button>
      </div>
      ${monthSwitcher(selectedMonth, monthLabelFn)}
    </div>
    <div class="safety-banner">
      <div class="icon">🛡️</div>
      <div><strong>Saldo seguro: ${brl(totals.safeFuture)}</strong><span class="subtle">Calculado somente a partir dos saldos e rendas que você cadastrou.</span></div>
    </div>
    <div class="grid cards">
      ${metric('Saldo atual', brl(totals.liquid), 'Contas disponíveis', 'info', true)}
      ${metric('Total recebido', brl(totals.receivedTotal), monthLabelFn(selectedMonth), 'positive')}
      ${metric('Despesas do mês', brl(totals.spend), 'Lançadas por você', 'danger')}
      ${metric('Resultado do mês', brl(totals.saving), 'Recebido menos despesas lançadas', totals.saving >= 0 ? 'positive' : 'danger')}
    </div>
    <div class="grid section-grid">
      <div class="card">
        <div class="section-title"><h3>Contas e caixinhas</h3><button class="ghost" data-action="addAccount" type="button">Adicionar</button></div>
        ${
          state.accounts.length
            ? state.accounts
                .map(
                  account => `<div class="row">
            <div>
              <b>${escapeHTML(account.name)}</b>
              <div class="meta">${escapeHTML(account.type)} • ${account.reserved ? 'reservado' : 'disponível'}${
                    account.currency !== 'BRL' ? ` • câmbio ${Number(account.exchangeRate || 0).toLocaleString('pt-BR')}` : ''
                  }</div>
            </div>
            <div>
              <div class="amount">${money(account.balance, account.currency)}${account.currency !== 'BRL' ? ` ≈ ${brl(accountValueBRL(account))}` : ''}</div>
              <div class="item-actions">
                <button class="tiny-btn" data-action="editAccount" data-id="${account.id}" type="button">Editar</button>
                <button class="tiny-btn" data-action="deleteAccount" data-id="${account.id}" type="button">Excluir</button>
              </div>
            </div>
          </div>`
                )
                .join('')
            : emptyState('Nenhuma conta cadastrada.', 'addAccount', 'Cadastrar conta')
        }
      </div>
      <div class="card">
        <div class="section-title"><h3>Despesas de ${monthLabelFn(selectedMonth)}</h3></div>
        ${
          monthExpenses.length
            ? monthExpenses
                .map(
                  exp => `<div class="row">
            <div><b>${escapeHTML(exp.cat)}</b><div class="meta">${formatDate(exp.date)}</div></div>
            <div>
              <div class="amount danger">-${brl(exp.value)}</div>
              <div class="item-actions"><button class="tiny-btn" data-action="deleteExpense" data-id="${exp.id}" type="button">Excluir</button></div>
            </div>
          </div>`
                )
                .join('')
            : emptyState('Nenhuma despesa neste mês.', 'addExpense', 'Adicionar despesa')
        }
      </div>
    </div>`;
}
