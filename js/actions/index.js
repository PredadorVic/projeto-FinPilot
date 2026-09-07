'use strict';

import { closeModal, openModal } from '../ui.js';
import { getState, getSelectedMonth, setSelectedMonth, requestRender } from '../store.js';
import { shiftMonth } from '../utils.js';
import { accountActions } from './accounts.js';
import { incomeActions } from './income.js';
import { expenseActions } from './expenses.js';
import { goalActions } from './goals.js';
import { cardActions } from './cards.js';
import { settingsActions } from './settings.js';
import { dataActions } from './data.js';
import { assistantActions } from './assistant.js';
import { openCompoundInterest, openPurchaseDecision, openDebtVsInvest, openRetirementPlan, openFixedIncomeCompare } from './simuladores.js';

export const actions = {
  ...accountActions,
  ...incomeActions,
  ...expenseActions,
  ...goalActions,
  ...cardActions,
  ...settingsActions,
  ...dataActions,
  ...assistantActions,

  openCompoundInterest,
  openPurchaseDecision,
  openDebtVsInvest,
  openRetirementPlan,
  openFixedIncomeCompare,

  quickAdd() {
    openModal(
      'Adicionar',
      `<div class="quick-add-grid">
        <button class="quick-add-card" data-action="addSalary" type="button"><b>💵 Salário</b><span>Renda fixa recorrente</span></button>
        <button class="quick-add-card" data-action="addIncome" type="button"><b>＋ Entrada</b><span>Prevista, variável ou eventual</span></button>
        <button class="quick-add-card" data-action="addExpense" type="button"><b>− Despesa</b><span>Registrar um gasto</span></button>
        <button class="quick-add-card" data-action="addAccount" type="button"><b>🏦 Conta</b><span>Informar seu saldo atual</span></button>
      </div>`
    );
  },

  prevMonth() {
    setSelectedMonth(shiftMonth(getSelectedMonth(), -1));
    requestRender();
  },

  nextMonth() {
    setSelectedMonth(shiftMonth(getSelectedMonth(), 1));
    requestRender();
  },

  closeModal
};
