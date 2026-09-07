// Store mínimo: mantém o estado vivo em memória + os "cursores" de UI
// (aba atual, mês selecionado) e um callback de render. Isso evita ter
// que reatribuir `let state = ...` através de vários módulos ES (bindings
// importados são somente leitura) — cada action só chama funções daqui.
'use strict';

import { loadState, saveState, recordHistorySnapshot } from './state.js';
import { monthKeyFromDate, today } from './utils.js';

let state = loadState();
let selectedMonth = monthKeyFromDate(today());
let current = 'home';
let renderCallback = () => {};

export function getState() {
  return state;
}

export function replaceState(newState) {
  state = newState;
}

export function getSelectedMonth() {
  return selectedMonth;
}

export function setSelectedMonth(monthKey) {
  selectedMonth = monthKey;
}

export function getCurrent() {
  return current;
}

export function setCurrent(tab) {
  current = tab;
}

export function onRender(fn) {
  renderCallback = fn;
}

export function requestRender() {
  renderCallback();
}

// Chamado por praticamente toda ação que muda dado: grava no localStorage,
// atualiza o snapshot de patrimônio do dia e manda re-renderizar a tela.
export function persistAndRender() {
  recordHistorySnapshot(state);
  saveState(state);
  requestRender();
}

// Versão "leve": salva sem re-renderizar. Usada em fluxos que já atualizam
// o DOM na mão (ex.: chat da IA), onde um re-render completo apagaria o
// que acabou de aparecer na tela.
export function persistOnly() {
  recordHistorySnapshot(state);
  saveState(state);
}
