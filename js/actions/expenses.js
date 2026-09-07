'use strict';

import { uid, today, toISODate, monthKeyFromISO } from '../utils.js';
import { openModal, confirmAction, closeModal } from '../ui.js';
import { getState, setCurrent, setSelectedMonth, persistAndRender } from '../store.js';
import { accountOptions } from './accounts.js';

export const expenseActions = {
  addExpense() {
    const state = getState();
    const hasBrlAccounts = state.accounts.some(a => a.currency === 'BRL' && !a.reserved);
    const accountSelect = hasBrlAccounts
      ? `<div class="field full"><label for="expenseAccount">Descontar de uma conta?</label><select id="expenseAccount" name="accountId"><option value="">Não alterar saldo da conta</option>${accountOptions()}</select><small>Se selecionar uma conta, o valor será descontado do saldo atual dela.</small></div>`
      : '';
    openModal(
      'Adicionar despesa',
      `<form id="expenseForm"><div class="form-grid">
        <div class="field"><label for="expenseCat">Categoria / nome</label><input id="expenseCat" name="cat" required placeholder="Digite a despesa"></div>
        <div class="field"><label for="expenseValue">Valor</label><input id="expenseValue" name="value" type="number" min="0" step="0.01" required placeholder="0,00"></div>
        <div class="field full"><label for="expenseDate">Data</label><input id="expenseDate" name="date" type="date" required value="${toISODate(today())}"></div>
        ${accountSelect}
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
    );
    document.querySelector('#expenseForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const value = Number(form.get('value'));
      const accountId = String(form.get('accountId') || '');
      state.expenses.push({ id: uid('exp'), cat: String(form.get('cat')).trim(), value, date: String(form.get('date')), accountId: accountId || null });
      if (accountId) {
        const account = state.accounts.find(item => item.id === accountId);
        if (account) account.balance = Number(account.balance || 0) - value;
      }
      setSelectedMonth(monthKeyFromISO(String(form.get('date'))));
      setCurrent('finances');
      closeModal();
      persistAndRender();
    };
  },

  deleteExpense(button) {
    const state = getState();
    const expense = state.expenses.find(item => item.id === button.dataset.id);
    if (!expense) return;
    confirmAction({
      title: 'Excluir despesa',
      message: `Tem certeza que deseja excluir "${expense.cat}"? ${expense.accountId ? 'O valor será devolvido ao saldo da conta vinculada.' : ''}`,
      onConfirm: () => {
        if (expense.accountId) {
          const account = state.accounts.find(item => item.id === expense.accountId);
          if (account) account.balance = Number(account.balance || 0) + Number(expense.value || 0);
        }
        state.expenses = state.expenses.filter(item => item.id !== button.dataset.id);
        persistAndRender();
      }
    });
  }
};
