'use strict';

import { brl, escapeHTML, initials, monthKeyFromDate, monthLabel as formatMonthLabel, today } from './utils.js';
import { financialTotals } from './calculations.js';
import { occurrenceStatus } from './recurrence.js';
import { getState, getSelectedMonth, getCurrent, setCurrent, onRender, requestRender } from './store.js';
import { saveState } from './state.js';
import { openModal, closeModal, registerActionDispatcher } from './ui.js';
import { actions } from './actions/index.js';
import { maybeAutoRefreshInsight } from './actions/insights.js';

import { renderHome } from './views/home.js';
import { renderIncome } from './views/income.js';
import { renderFinances } from './views/finances.js';
import { renderGoals } from './views/goals.js';
import { renderCards } from './views/cards.js';
import { renderSimuladores } from './views/simuladores.js';
import { renderAnalysis } from './views/analysis.js';
import { renderAssistant } from './views/assistant.js';

const NAV = [
  ['home', '🏠', 'Início'],
  ['income', '💵', 'Renda'],
  ['finances', '💰', 'Finanças'],
  ['goals', '🎯', 'Metas'],
  ['cards', '💳', 'Cartões'],
  ['simuladores', '🧮', 'Simulações'],
  ['analysis', '📊', 'Análise'],
  ['assistant', '✨', 'Assistente']
];

const VIEWS = {
  home: state => renderHome(state, occurrenceStatus),
  income: state => renderIncome(state, getSelectedMonth(), occurrenceStatus, formatMonthLabel),
  finances: state => renderFinances(state, getSelectedMonth(), formatMonthLabel),
  goals: state => renderGoals(state),
  cards: state => renderCards(state),
  simuladores: () => renderSimuladores(),
  analysis: state => renderAnalysis(state),
  assistant: state => renderAssistant(state)
};

registerActionDispatcher((name, button) => {
  if (actions[name]) actions[name](button);
});

function setNav() {
  const current = getCurrent();
  const make = () =>
    NAV.map(
      ([id, icon, label]) =>
        `<button class="nav-btn ${current === id ? 'active' : ''}" data-nav="${id}" type="button"><span>${icon}</span><span>${label}</span></button>`
    ).join('');
  document.querySelector('#desktopNav').innerHTML = make();
  document.querySelector('#mobileNav').innerHTML = make();
}

function computeAlerts(state) {
  const totals = financialTotals(state, monthKeyFromDate(today()));
  const alerts = [];
  state.cards.forEach(card => {
    const ratio = Number(card.limit || 0) ? Number(card.used || 0) / Number(card.limit) : 0;
    if (ratio > 0.7) alerts.push(`${card.name}: ${(ratio * 100).toFixed(0)}% do limite utilizado.`);
  });
  if (totals.expected + totals.variable + totals.eventual > 0) {
    alerts.push(`${brl(totals.expected + totals.variable + totals.eventual)} em entradas ainda não garantidas.`);
  }
  return alerts;
}

function updateAlertBadge(state) {
  document.querySelector('#alertBadge').textContent = String(computeAlerts(state).length);
}

function bindPage() {
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.onclick = () => {
      setCurrent(button.dataset.nav);
      requestRender();
    };
  });
  document.querySelectorAll('[data-action]').forEach(button => {
    const action = button.dataset.action;
    if (actions[action]) button.onclick = () => actions[action](button);
  });
  document.querySelectorAll('[data-prompt]').forEach(button => {
    button.onclick = () => askFromPrompt(button.dataset.prompt);
  });
  const input = document.querySelector('#assistantInput');
  if (input) {
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') actions.ask();
    });
  }
}

function askFromPrompt(promptText) {
  const input = document.querySelector('#assistantInput');
  if (input) input.value = promptText;
  actions.ask();
}

function render() {
  const state = getState();
  setNav();
  const navItem = NAV.find(item => item[0] === getCurrent());
  document.querySelector('#pageTitle').textContent = navItem ? navItem[2] : 'FinPilot';
  document.querySelector('#content').innerHTML = (VIEWS[getCurrent()] || VIEWS.home)(state);
  document.querySelector('#headerDate').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(today());
  const avatar = document.querySelector('#profileBtn');
  if (avatar) avatar.textContent = initials(state.user.name);
  updateAlertBadge(state);
  bindPage();
  if (getCurrent() === 'home') maybeAutoRefreshInsight();
}

onRender(render);

function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function initTheme() {
  const state = getState();
  applyTheme(state.settings.theme || 'light');
  document.querySelector('#themeToggle').onclick = () => {
    const next = state.settings.theme === 'dark' ? 'light' : 'dark';
    state.settings.theme = next;
    applyTheme(next);
    saveState(state);
  };
}

function initChrome() {
  document.querySelector('#quickAdd').onclick = () => actions.quickAdd();
  document.querySelector('#alertsBtn').onclick = () => {
    const state = getState();
    const alerts = computeAlerts(state);
    updateAlertBadge(state);
    openModal(
      'Alertas inteligentes',
      `${alerts.map(message => `<div class="alert">⚠️ ${escapeHTML(message)}</div>`).join('') || '<div class="alert">✅ Nenhum alerta crítico agora.</div>'}<div class="actions"><button class="primary" data-action="closeModal" type="button">Entendi</button></div>`
    );
  };
  document.querySelector('#profileBtn').onclick = () => actions.openSettings();
  document.querySelector('#modalBackdrop').onclick = event => {
    if (event.target.id === 'modalBackdrop') closeModal();
  };
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        // Sem service worker, o app continua funcionando normalmente — só perde o cache offline.
      });
    });
  }
}

initTheme();
initChrome();
registerServiceWorker();
render();
