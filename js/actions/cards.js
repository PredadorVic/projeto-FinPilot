'use strict';

import { uid } from '../utils.js';
import { openModal, confirmAction, closeModal } from '../ui.js';
import { getState, persistAndRender } from '../store.js';

export const cardActions = {
  addCard() {
    openModal(
      'Cadastrar cartão',
      `<form id="cardForm"><div class="form-grid">
        <div class="field"><label for="cardName">Nome do cartão</label><input id="cardName" name="name" required placeholder="Digite o nome"></div>
        <div class="field"><label for="cardBank">Banco / emissor</label><input id="cardBank" name="bank" placeholder="Opcional"></div>
        <div class="field"><label for="cardLimit">Limite total</label><input id="cardLimit" name="limit" type="number" min="0" step="0.01" required placeholder="0,00"></div>
        <div class="field"><label for="cardUsed">Valor usado</label><input id="cardUsed" name="used" type="number" min="0" step="0.01" placeholder="0,00"></div>
        <div class="field"><label for="cardInvoice">Fatura atual</label><input id="cardInvoice" name="invoice" type="number" min="0" step="0.01" placeholder="0,00"></div>
        <div class="field"><label for="cardDue">Vencimento (dia)</label><input id="cardDue" name="due" type="number" min="1" max="31" placeholder="Opcional"></div>
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
    );
    document.querySelector('#cardForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      getState().cards.push({
        id: uid('card'),
        name: String(form.get('name')).trim(),
        bank: String(form.get('bank') || '').trim(),
        limit: Number(form.get('limit')),
        used: Number(form.get('used') || 0),
        invoice: Number(form.get('invoice') || 0),
        due: Number(form.get('due') || 0)
      });
      closeModal();
      persistAndRender();
    };
  },

  deleteCard(button) {
    const state = getState();
    const card = state.cards.find(item => item.id === button.dataset.id);
    if (!card) return;
    confirmAction({
      title: 'Excluir cartão',
      message: `Tem certeza que deseja excluir "${card.name}"?`,
      onConfirm: () => {
        state.cards = state.cards.filter(item => item.id !== button.dataset.id);
        persistAndRender();
      }
    });
  },

  addInstallment() {
    openModal(
      'Adicionar parcelamento',
      `<form id="installmentForm"><div class="form-grid">
        <div class="field full"><label for="instName">Nome</label><input id="instName" name="name" required placeholder="Digite o parcelamento"></div>
        <div class="field"><label for="instTotal">Valor total</label><input id="instTotal" name="total" type="number" min="0" step="0.01" required placeholder="0,00"></div>
        <div class="field"><label for="instMonths">Número de parcelas</label><input id="instMonths" name="months" type="number" min="1" required></div>
        <div class="field"><label for="instValue">Valor da parcela</label><input id="instValue" name="installment" type="number" min="0" step="0.01" required placeholder="0,00"></div>
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
    );
    document.querySelector('#installmentForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      getState().installments.push({
        id: uid('installment'),
        name: String(form.get('name')).trim(),
        total: Number(form.get('total')),
        months: Number(form.get('months')),
        installment: Number(form.get('installment'))
      });
      closeModal();
      persistAndRender();
    };
  },

  deleteInstallment(button) {
    const state = getState();
    const item = state.installments.find(entry => entry.id === button.dataset.id);
    if (!item) return;
    confirmAction({
      title: 'Excluir parcelamento',
      message: `Tem certeza que deseja excluir "${item.name}"?`,
      onConfirm: () => {
        state.installments = state.installments.filter(entry => entry.id !== button.dataset.id);
        persistAndRender();
      }
    });
  }
};
