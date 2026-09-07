// Camada de UI que toca o DOM: modal (com foco acessível), diálogo de
// confirmação e pequenos componentes de render reaproveitados pelas views.
'use strict';

import { escapeHTML } from './utils.js';

let lastFocusedElement = null;
let modalKeydownHandler = null;
let dispatchAction = null;

// main.js chama isto uma vez, na inicialização, passando o dispatcher que
// conhece o mapa completo de `actions`. Evita um import circular entre
// ui.js (aberto por toda view) e actions/index.js (que importa ui.js).
export function registerActionDispatcher(fn) {
  dispatchAction = fn;
}

function bindActionsWithin(container) {
  if (!dispatchAction) return;
  container.querySelectorAll('[data-action]').forEach(button => {
    button.onclick = () => dispatchAction(button.dataset.action, button);
  });
}

function focusableElements(container) {
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
  );
}

export function openModal(title, bodyHTML) {
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  lastFocusedElement = document.activeElement;

  modal.innerHTML = `<h2>${escapeHTML(title)}</h2>${bodyHTML}`;
  backdrop.classList.remove('hidden');
  bindActionsWithin(modal);

  const focusables = focusableElements(modal);
  (focusables[0] || modal).focus({ preventScroll: true });

  modalKeydownHandler = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key === 'Tab' && focusables.length > 0) {
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', modalKeydownHandler);
}

export function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  backdrop.classList.add('hidden');
  modal.innerHTML = '';
  if (modalKeydownHandler) {
    document.removeEventListener('keydown', modalKeydownHandler);
    modalKeydownHandler = null;
  }
  if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus({ preventScroll: true });
  lastFocusedElement = null;
}

// Diálogo de confirmação reutilizando o mesmo modal — usado antes de
// qualquer ação destrutiva (excluir conta, meta, cartão, receita, etc.).
export function confirmAction({ title = 'Confirmar', message, confirmLabel = 'Excluir', danger = true, onConfirm }) {
  openModal(
    title,
    `<p class="confirm-message">${escapeHTML(message)}</p>
     <div class="actions">
       <button type="button" class="ghost" data-role="cancel">Cancelar</button>
       <button type="button" class="${danger ? 'danger-btn' : 'primary'}" data-role="confirm">${escapeHTML(confirmLabel)}</button>
     </div>`
  );
  const modal = document.getElementById('modal');
  modal.querySelector('[data-role="cancel"]').onclick = () => closeModal();
  modal.querySelector('[data-role="confirm"]').onclick = () => {
    closeModal();
    onConfirm();
  };
}

export const RELIABILITY = {
  GUARANTEED: { label: 'Fixa/Garantida', short: 'Garantido', icon: '🛡️', className: 'r-guaranteed' },
  EXPECTED: { label: 'Prevista', short: 'Previsto', icon: '◷', className: 'r-expected' },
  VARIABLE: { label: 'Variável', short: 'Variável', icon: '↕', className: 'r-variable' },
  EVENTUAL: { label: 'Eventual', short: 'Eventual', icon: '○', className: 'r-eventual' }
};

export function reliabilityChip(reliability) {
  const meta = RELIABILITY[reliability] || RELIABILITY.EVENTUAL;
  return `<span class="reliability-chip ${meta.className}">${meta.icon} ${meta.short}</span>`;
}

export function statusChip(status) {
  if (status === 'RECEIVED') return '<span class="status-chip s-received">✓ Recebido</span>';
  if (status === 'CANCELLED') return '<span class="status-chip s-cancelled">× Cancelado</span>';
  return '<span class="status-chip s-pending">• Pendente</span>';
}

export function priorityChip(priority) {
  const map = { Alta: 'p-high', Média: 'p-medium' };
  return `<span class="priority ${map[priority] || 'p-low'}">${escapeHTML(priority)}</span>`;
}

export function emptyState(message, action, label) {
  return `<div class="empty-state">
    <p>${escapeHTML(message)}</p>
    ${action ? `<button class="secondary" type="button" data-action="${action}">${escapeHTML(label)}</button>` : ''}
  </div>`;
}

export function metric(label, value, delta, className = '', emphasis = false) {
  return `<div class="card metric ${emphasis ? 'emphasis' : ''}">
    <div class="label">${escapeHTML(label)}</div>
    <div class="value">${value}</div>
    <div class="delta ${className}">${escapeHTML(delta)}</div>
  </div>`;
}

export function heroMetric(label, value, delta, className = '') {
  return `<div class="card metric emphasis hero-metric">
    <div class="label">${escapeHTML(label)}</div>
    <div class="value hero-number">${value}</div>
    <div class="delta ${className}">${escapeHTML(delta)}</div>
  </div>`;
}

export function monthSwitcher(selectedMonth, monthLabelFn) {
  return `<div class="month-switcher">
    <button data-action="prevMonth" type="button" aria-label="Mês anterior">‹</button>
    <span class="month-label">${monthLabelFn(selectedMonth)}</span>
    <button data-action="nextMonth" type="button" aria-label="Próximo mês">›</button>
  </div>`;
}

export function toolCard(action, title, description, icon = '🧮') {
  return `<button type="button" class="quick-add-card tool-card" data-action="${action}">
    <span class="tool-card-icon" aria-hidden="true">${icon}</span>
    <b>${escapeHTML(title)}</b>
    <span>${escapeHTML(description)}</span>
  </button>`;
}
