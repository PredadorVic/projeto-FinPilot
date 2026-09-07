'use strict';

import { brl, escapeHTML } from '../utils.js';
import { emptyState } from '../ui.js';

function cardRecord(card) {
  const pct = Number(card.limit || 0) ? (Number(card.used || 0) / Number(card.limit || 1)) * 100 : 0;
  return `<div class="card-record">
    <div class="section-title">
      <h3>${escapeHTML(card.name)}${card.bank ? ` <span class="subtle">— ${escapeHTML(card.bank)}</span>` : ''}</h3>
      <span class="priority ${pct > 70 ? 'p-high' : 'p-medium'}">${pct.toFixed(0)}% usado</span>
    </div>
    <div class="kpi-strip">
      <div class="kpi-mini"><span class="subtle">Limite</span><b>${brl(card.limit)}</b></div>
      <div class="kpi-mini"><span class="subtle">Usado</span><b>${brl(card.used)}</b></div>
      <div class="kpi-mini"><span class="subtle">Disponível</span><b>${brl(Math.max(0, card.limit - card.used))}</b></div>
      <div class="kpi-mini"><span class="subtle">Fatura${card.due ? ` (dia ${card.due})` : ''}</span><b>${brl(card.invoice)}</b></div>
    </div>
    <div class="item-actions">
      <button class="tiny-btn" data-action="deleteCard" data-id="${card.id}" type="button">Excluir</button>
    </div>
  </div>`;
}

export function renderCards(state) {
  return `<div class="toolbar">
      <button class="primary" data-action="addCard" type="button">+ Cartão</button>
      <button class="secondary" data-action="addInstallment" type="button">+ Parcelamento</button>
      <button class="secondary" data-action="openPurchaseDecision" type="button">Posso comprar?</button>
    </div>
    <div class="grid section-grid">
      <div class="card">
        <div class="section-title"><h3>Cartões</h3></div>
        ${state.cards.length ? state.cards.map(cardRecord).join('') : emptyState('Nenhum cartão cadastrado.', 'addCard', 'Cadastrar cartão')}
      </div>
      <div class="card">
        <div class="section-title"><h3>Parcelamentos</h3></div>
        ${
          state.installments.length
            ? state.installments
                .map(
                  item => `<div class="row">
            <div><b>${escapeHTML(item.name)}</b><div class="meta">${item.months}x de ${brl(item.installment)}</div></div>
            <div>
              <div class="amount">${brl(item.total)}</div>
              <div class="item-actions"><button class="tiny-btn" data-action="deleteInstallment" data-id="${item.id}" type="button">Excluir</button></div>
            </div>
          </div>`
                )
                .join('')
            : emptyState('Nenhum parcelamento cadastrado.', 'addInstallment', 'Adicionar parcelamento')
        }
      </div>
    </div>`;
}
