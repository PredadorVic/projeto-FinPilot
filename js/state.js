// Estado da aplicação: formato dos dados, carregamento/gravação no
// localStorage, migração da v4 -> v5 (SEM apagar dados já digitados pelo
// usuário) e backup em JSON (exportar/importar).
'use strict';

import { toISODate } from './utils.js';
import { netWorthNow, liquidBalance } from './calculations.js';

export const STORAGE_KEY = 'finpilot-v5-user-owned-data';
const LEGACY_STORAGE_KEYS = ['finpilot-v4-user-owned-data', 'finpilot-v3-user-owned-data'];
const MAX_HISTORY_POINTS = 730; // ~2 anos de snapshots diários, o suficiente para o gráfico

export function createInitialState() {
  return {
    version: 5,
    user: { name: '', safetyMargin: 0 },
    settings: { holidays: [], theme: 'light', aiEndpoint: '', aiAccessKey: '' },
    accounts: [],
    expenses: [],
    incomeDefinitions: [],
    incomeReceipts: {},
    skippedIncomeOccurrences: {},
    goals: [],
    cards: [],
    installments: [],
    history: [],
    // Preferências que a pessoa conta pra IA usar como contexto (não afeta nenhum cálculo numérico).
    profile: { spendingJoys: '', savingStyle: '', priorities: '', dependents: '', notes: '', updatedAt: null },
    // Últimas trocas com a IA, só pra dar continuidade à conversa (não é obrigatório manter).
    aiHistory: [],
    // Análise proativa (gerada sozinha, sem o usuário perguntar — ver actions/insights.js).
    aiInsight: { text: '', generatedAt: null, forFingerprint: '', error: '' },
    // Lembra o último preenchimento de cada simulador, por conveniência.
    simulatorInputs: {}
  };
}

// Preenche qualquer campo que falte (dado antigo) com o padrão da v5,
// sem nunca descartar o que já existia.
function migrate(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    version: 5,
    user: { ...base.user, ...(raw.user || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    incomeDefinitions: Array.isArray(raw.incomeDefinitions) ? raw.incomeDefinitions : [],
    incomeReceipts: raw.incomeReceipts || {},
    skippedIncomeOccurrences: raw.skippedIncomeOccurrences || {},
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    cards: Array.isArray(raw.cards) ? raw.cards : [],
    installments: Array.isArray(raw.installments) ? raw.installments : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    simulatorInputs: raw.simulatorInputs || {},
    profile: { ...base.profile, ...(raw.profile || {}) },
    aiHistory: Array.isArray(raw.aiHistory) ? raw.aiHistory : [],
    aiInsight: { ...base.aiInsight, ...(raw.aiInsight || {}) }
  };
}

export function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return migrate(JSON.parse(current));
  } catch (err) {
    console.warn('FinPilot: não foi possível ler os dados salvos, começando do zero.', err);
  }

  // Migração: se ainda não existe dado na chave v5, tenta recuperar de uma
  // versão anterior em vez de simplesmente zerar o que o usuário já digitou.
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    try {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) return migrate(JSON.parse(legacy));
    } catch (err) {
      // ignora e tenta a próxima chave / cai no estado zerado
    }
  }

  return createInitialState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('FinPilot: falha ao salvar os dados no navegador.', err);
    return false;
  }
}

// Registra (no máximo uma vez por dia) o patrimônio líquido atual, para
// alimentar o gráfico de evolução patrimonial da aba Análise.
export function recordHistorySnapshot(state) {
  const todayISO = toISODate(new Date());
  const point = { date: todayISO, netWorth: netWorthNow(state), liquid: liquidBalance(state.accounts) };
  const existingIndex = state.history.findIndex(item => item.date === todayISO);
  if (existingIndex >= 0) state.history[existingIndex] = point;
  else state.history.push(point);
  state.history.sort((a, b) => a.date.localeCompare(b.date));
  if (state.history.length > MAX_HISTORY_POINTS) {
    state.history.splice(0, state.history.length - MAX_HISTORY_POINTS);
  }
  return state;
}

export function exportStateAsJSON(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), exportedFrom: 'FinPilot v5' }, null, 2);
}

// Lança um erro descritivo se o arquivo não parecer um backup válido do
// FinPilot — melhor falhar alto e claro do que importar lixo silenciosamente.
export function parseImportedState(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('Esse arquivo não é um JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Esse arquivo não parece ser um backup do FinPilot.');
  }
  const looksLikeFinPilotBackup = [
    'accounts',
    'incomeDefinitions',
    'expenses',
    'goals',
    'cards'
  ].some(key => key in parsed);
  if (!looksLikeFinPilotBackup) {
    throw new Error('Esse arquivo não parece ser um backup do FinPilot.');
  }
  return migrate(parsed);
}
