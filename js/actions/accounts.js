'use strict';

import { brl, escapeHTML, uid } from '../utils.js';
import { openModal, confirmAction, closeModal } from '../ui.js';
import { getState, setCurrent, persistAndRender } from '../store.js';

const ACCOUNT_TYPES = ['Conta corrente', 'Conta digital', 'Poupança', 'Dinheiro', 'Caixinha', 'Investimento', 'Outro'];

export function accountOptions(selected = '') {
  const state = getState();
  return state.accounts
    .filter(account => account.currency === 'BRL' && !account.reserved)
    .map(account => `<option value="${account.id}" ${account.id === selected ? 'selected' : ''}>${escapeHTML(account.name)} — ${brl(account.balance)}</option>`)
    .join('');
}

export function openAccountForm(account = null) {
  openModal(
    account ? 'Editar conta' : 'Cadastrar conta / caixinha',
    `<form id="accountForm"><div class="form-grid">
      <div class="field"><label for="accName">Nome</label><input id="accName" name="name" required value="${escapeHTML(account?.name || '')}" placeholder="Digite o nome da conta"></div>
      <div class="field"><label for="accType">Tipo</label><select id="accType" name="type" required><option value="">Selecione...</option>${ACCOUNT_TYPES.map(
        type => `<option ${account?.type === type ? 'selected' : ''}>${type}</option>`
      ).join('')}</select></div>
      <div class="field"><label for="accountCurrency">Moeda</label><select name="currency" id="accountCurrency" required>
        <option value="BRL" ${!account || account.currency === 'BRL' ? 'selected' : ''}>BRL</option>
        <option value="USD" ${account?.currency === 'USD' ? 'selected' : ''}>USD</option>
        <option value="EUR" ${account?.currency === 'EUR' ? 'selected' : ''}>EUR</option>
      </select></div>
      <div class="field"><label for="accBalance">Saldo atual</label><input id="accBalance" name="balance" type="number" step="0.01" required value="${account ? Number(account.balance || 0) : ''}" placeholder="0,00"></div>
      <div class="field" id="exchangeRateField"><label for="accExchange">Cotação para BRL</label><input id="accExchange" name="exchangeRate" type="number" min="0" step="0.0001" value="${account?.exchangeRate || ''}" placeholder="Informe se não for BRL"><small>Ex.: quantos reais valem 1 unidade da moeda.</small></div>
      <div class="field full"><label class="checkbox-field"><input name="reserved" type="checkbox" ${account?.reserved ? 'checked' : ''}> Este valor é reservado e não está livre para gastar</label></div>
    </div><div class="actions"><button class="ghost" data-action="closeModal" type="button">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
  );

  const currency = document.querySelector('#accountCurrency');
  const exchangeField = document.querySelector('#exchangeRateField');
  const sync = () => {
    exchangeField.style.display = currency.value === 'BRL' ? 'none' : 'grid';
  };
  currency.addEventListener('change', sync);
  sync();

  document.querySelector('#accountForm').onsubmit = event => {
    event.preventDefault();
    const state = getState();
    const form = new FormData(event.currentTarget);
    const payload = {
      id: account?.id || uid('acc'),
      name: String(form.get('name')).trim(),
      type: String(form.get('type')),
      currency: String(form.get('currency')),
      balance: Number(form.get('balance')),
      exchangeRate: String(form.get('currency')) === 'BRL' ? 1 : Number(form.get('exchangeRate') || 0),
      reserved: form.get('reserved') === 'on'
    };
    if (account) state.accounts[state.accounts.findIndex(item => item.id === account.id)] = payload;
    else state.accounts.push(payload);
    setCurrent('finances');
    closeModal();
    persistAndRender();
  };
}

export const accountActions = {
  addAccount() {
    openAccountForm();
  },

  editAccount(button) {
    const account = getState().accounts.find(item => item.id === button.dataset.id);
    if (account) openAccountForm(account);
  },

  deleteAccount(button) {
    const state = getState();
    const account = state.accounts.find(item => item.id === button.dataset.id);
    if (!account) return;
    confirmAction({
      title: 'Excluir conta',
      message: `Tem certeza que deseja excluir "${account.name}"? Despesas já lançadas não são apagadas, mas deixam de referenciar essa conta.`,
      onConfirm: () => {
        state.accounts = state.accounts.filter(item => item.id !== button.dataset.id);
        persistAndRender();
      }
    });
  }
};
