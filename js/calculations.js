// Cálculos financeiros agregados a partir do estado do usuário.
// Módulo puro: recebe dados, devolve números. Nenhuma função aqui
// lê localStorage nem toca o DOM.
'use strict';

import { monthKeyFromISO, shiftMonth, shortMonthLabel } from './utils.js';
import { monthlyIncomeOccurrences, occurrenceStatus } from './recurrence.js';

export function accountValueBRL(account) {
  if (account.currency === 'BRL') return Number(account.balance || 0);
  return Number(account.balance || 0) * Number(account.exchangeRate || 0);
}

export function liquidBalance(accounts = []) {
  return accounts.filter(account => !account.reserved).reduce((sum, account) => sum + accountValueBRL(account), 0);
}

export function reservedBalance(accounts = []) {
  return accounts.filter(account => account.reserved).reduce((sum, account) => sum + accountValueBRL(account), 0);
}

export function cardDebt(cards = []) {
  return cards.reduce((sum, card) => sum + Number(card.invoice || 0), 0);
}

export function monthExpenses(expenses = [], monthKey) {
  return expenses
    .filter(expense => monthKeyFromISO(expense.date) === monthKey)
    .reduce((sum, expense) => sum + Number(expense.value || 0), 0);
}

// incomeState = { incomeDefinitions, incomeReceipts, skippedIncomeOccurrences, holidays }
export function incomeSummary(monthKey, incomeState) {
  const occurrences = monthlyIncomeOccurrences(monthKey, incomeState);
  const pending = occurrences.filter(item => occurrenceStatus(item) === 'PENDING');
  const received = occurrences.filter(item => occurrenceStatus(item) === 'RECEIVED');
  const pendingBy = reliability =>
    pending.filter(item => item.reliability === reliability).reduce((sum, item) => sum + item.estimatedAmount, 0);
  const receivedTotal = received.reduce((sum, item) => sum + Number(item.receipt.actualAmount || 0), 0);
  const guaranteed = pendingBy('GUARANTEED');
  const expected = pendingBy('EXPECTED');
  const variable = pendingBy('VARIABLE');
  const eventual = pendingBy('EVENTUAL');
  const liquid = liquidBalance(incomeState.accounts || []);
  const safeFuture = liquid + guaranteed;
  const projected = safeFuture + expected + variable;
  const potentialMax = projected + eventual;
  return {
    occurrences,
    pending,
    received,
    receivedTotal,
    guaranteed,
    expected,
    variable,
    eventual,
    liquid,
    safeFuture,
    projected,
    potentialMax
  };
}

// state = objeto completo (ver state.js: createInitialState)
export function financialTotals(state, monthKey) {
  const income = incomeSummary(monthKey, {
    incomeDefinitions: state.incomeDefinitions,
    incomeReceipts: state.incomeReceipts,
    skippedIncomeOccurrences: state.skippedIncomeOccurrences,
    holidays: state.settings.holidays,
    accounts: state.accounts
  });
  const spend = monthExpenses(state.expenses, monthKey);
  const reservedBRL = reservedBalance(state.accounts);
  const debt = cardDebt(state.cards);
  const saving = income.receivedTotal - spend;
  const saveRate = income.receivedTotal ? (saving / income.receivedTotal) * 100 : 0;
  const installmentsMonthly = (state.installments || []).reduce((sum, item) => sum + Number(item.installment || 0), 0);
  return {
    ...income,
    spend,
    reservedBRL,
    debt,
    saving,
    saveRate,
    installmentsMonthly,
    net: income.liquid + reservedBRL - debt
  };
}

// Recebido x despesas dos últimos `count` meses (incluindo `endMonthKey`),
// em ordem cronológica — alimenta o gráfico de barras da aba Análise.
export function lastMonthsIncomeExpense(state, endMonthKey, count = 6) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) months.push(shiftMonth(endMonthKey, -i));
  return months.map(monthKey => {
    const totals = financialTotals(state, monthKey);
    return { label: shortMonthLabel(monthKey), income: totals.receivedTotal, expense: totals.spend };
  });
}

// Patrimônio líquido "instantâneo": contas + reservas - faturas de cartão.
// Usado para o histórico de evolução patrimonial (não depende de um mês específico).
export function netWorthNow(state) {
  return liquidBalance(state.accounts) + reservedBalance(state.accounts) - cardDebt(state.cards);
}
