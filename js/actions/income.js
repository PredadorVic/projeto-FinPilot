'use strict';

import { escapeHTML, uid, today, toISODate, parseDate, monthKeyFromISO, monthKeyFromDate } from '../utils.js';
import { monthlyIncomeOccurrences } from '../recurrence.js';
import { openModal, confirmAction, closeModal, RELIABILITY } from '../ui.js';
import { getState, setCurrent, setSelectedMonth, getSelectedMonth, persistAndRender } from '../store.js';
import { accountOptions } from './accounts.js';

function buildRecurrence(date, recurrenceType) {
  if (!recurrenceType) return null;
  const baseDate = parseDate(date);
  const recurrence = { type: recurrenceType };
  if (recurrenceType === 'MONTHLY_DAY') recurrence.day = baseDate.getDate();
  if (recurrenceType === 'WEEKLY') recurrence.dayOfWeek = baseDate.getDay();
  return recurrence;
}

function recurrenceFieldsScript() {
  const recurring = document.querySelector('#incomeRecurring');
  const wrap = document.querySelector('#recurrenceWrap');
  if (!recurring || !wrap) return;
  const sync = () => {
    wrap.style.display = recurring.checked ? 'grid' : 'none';
  };
  recurring.addEventListener('change', sync);
  sync();
}

function incomeFormMarkup(definition = null, forceSalary = false) {
  const isSalary = forceSalary || definition?.kind === 'SALARY';
  const reliability = isSalary ? 'GUARANTEED' : definition?.reliability || '';
  const recurring = isSalary ? true : Boolean(definition?.recurring);
  const baseDate = definition?.startDate || definition?.expectedDate || toISODate(today());
  const recurrenceType = definition?.recurrence?.type || '';

  return `<form id="incomeForm"><div class="form-grid">
    <div class="field"><label for="incomeName">Nome</label><input id="incomeName" name="name" required value="${escapeHTML(definition?.name || '')}" placeholder="Ex.: salário principal, comissão..."></div>
    <div class="field"><label for="incomeAmount">Valor</label><input id="incomeAmount" name="amount" required type="number" min="0" step="0.01" value="${definition ? Number(definition.estimatedAmount || 0) : ''}" placeholder="0,00"></div>
    ${
      isSalary
        ? `<input type="hidden" name="reliability" value="GUARANTEED"><div class="field"><label>Classificação</label><input value="Fixa/Garantida" disabled></div>`
        : `<div class="field"><label for="incomeReliability">Classificação</label><select id="incomeReliability" name="reliability" required><option value="">Selecione...</option>${Object.entries(
            RELIABILITY
          )
            .map(([key, meta]) => `<option value="${key}" ${reliability === key ? 'selected' : ''}>${meta.label}</option>`)
            .join('')}</select></div>`
    }
    ${
      isSalary
        ? ''
        : `<div class="field"><label for="incomeConfidence">Nível de certeza (%)</label><input id="incomeConfidence" name="confidence" type="number" min="0" max="100" value="${definition?.confidence ?? ''}" placeholder="Opcional"><small>Apenas informativo.</small></div>`
    }
    <div class="field"><label for="incomeDate">${recurring || isSalary ? 'Data de início / dia-base' : 'Data prevista'}</label><input id="incomeDate" name="date" type="date" required value="${baseDate}"></div>
    <div class="field"><label for="incomeCategory">Categoria</label><input id="incomeCategory" name="category" value="${escapeHTML(definition?.category || '')}" placeholder="Opcional"></div>
    ${
      isSalary
        ? `<input id="incomeRecurring" name="recurring" type="checkbox" checked hidden><div class="field full"><label for="incomeRecurrence">Regra de pagamento</label><select id="incomeRecurrence" name="recurrence" required><option value="">Selecione...</option><option value="MONTHLY_DAY" ${
            recurrenceType === 'MONTHLY_DAY' ? 'selected' : ''
          }>Dia específico do mês</option><option value="FIRST_BUSINESS_DAY" ${
            recurrenceType === 'FIRST_BUSINESS_DAY' ? 'selected' : ''
          }>Primeiro dia útil</option><option value="FIFTH_BUSINESS_DAY" ${
            recurrenceType === 'FIFTH_BUSINESS_DAY' ? 'selected' : ''
          }>Quinto dia útil</option><option value="LAST_BUSINESS_DAY" ${
            recurrenceType === 'LAST_BUSINESS_DAY' ? 'selected' : ''
          }>Último dia útil</option><option value="WEEKLY" ${recurrenceType === 'WEEKLY' ? 'selected' : ''}>Semanal</option><option value="BIWEEKLY" ${
            recurrenceType === 'BIWEEKLY' ? 'selected' : ''
          }>Quinzenal</option></select></div>`
        : `<div class="field full"><label class="checkbox-field"><input id="incomeRecurring" name="recurring" type="checkbox" ${
            recurring ? 'checked' : ''
          }> Esta entrada é recorrente</label></div><div id="recurrenceWrap" class="field full" style="display:none"><label for="incomeRecurrence">Regra de recorrência</label><select id="incomeRecurrence" name="recurrence"><option value="">Selecione...</option><option value="MONTHLY_DAY" ${
            recurrenceType === 'MONTHLY_DAY' ? 'selected' : ''
          }>Mensal / dia específico</option><option value="WEEKLY" ${
            recurrenceType === 'WEEKLY' ? 'selected' : ''
          }>Semanal</option><option value="BIWEEKLY" ${recurrenceType === 'BIWEEKLY' ? 'selected' : ''}>Quinzenal</option><option value="YEARLY" ${
            recurrenceType === 'YEARLY' ? 'selected' : ''
          }>Anual</option><option value="FIRST_BUSINESS_DAY" ${
            recurrenceType === 'FIRST_BUSINESS_DAY' ? 'selected' : ''
          }>Primeiro dia útil</option><option value="FIFTH_BUSINESS_DAY" ${
            recurrenceType === 'FIFTH_BUSINESS_DAY' ? 'selected' : ''
          }>Quinto dia útil</option><option value="LAST_BUSINESS_DAY" ${
            recurrenceType === 'LAST_BUSINESS_DAY' ? 'selected' : ''
          }>Último dia útil</option></select></div>`
    }
    <div class="field full"><label for="incomeNotes">Observações</label><textarea id="incomeNotes" name="notes" rows="2" placeholder="Opcional">${escapeHTML(definition?.notes || '')}</textarea></div>
  </div><div class="modal-note"><b>Importante:</b> o valor só é tratado como dinheiro disponível quando estiver na conta. Entradas garantidas futuras entram apenas no saldo seguro futuro.</div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`;
}

function wireIncomeForm(definition = null, forceSalary = false) {
  if (!forceSalary) recurrenceFieldsScript();
  document.querySelector('#incomeForm').onsubmit = event => {
    event.preventDefault();
    const state = getState();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date'));
    const recurring = forceSalary || document.querySelector('#incomeRecurring')?.checked;
    const recurrenceType = String(form.get('recurrence') || '');
    if (recurring && !recurrenceType) return;
    const reliability = forceSalary ? 'GUARANTEED' : String(form.get('reliability'));
    const payload = {
      id: definition?.id || uid('inc'),
      kind: forceSalary || definition?.kind === 'SALARY' ? 'SALARY' : 'OTHER',
      name: String(form.get('name')).trim(),
      reliability,
      estimatedAmount: Number(form.get('amount')),
      confidence: reliability === 'GUARANTEED' ? 100 : form.get('confidence') === '' ? null : Number(form.get('confidence')),
      recurring,
      recurrence: recurring ? buildRecurrence(date, recurrenceType) : null,
      startDate: recurring ? date : undefined,
      expectedDate: recurring ? undefined : date,
      status: recurring ? undefined : definition?.status || 'PENDING',
      category: String(form.get('category') || '').trim(),
      notes: String(form.get('notes') || '').trim()
    };
    if (definition) {
      const index = state.incomeDefinitions.findIndex(item => item.id === definition.id);
      state.incomeDefinitions[index] = { ...definition, ...payload };
    } else {
      state.incomeDefinitions.push(payload);
    }
    setSelectedMonth(monthKeyFromISO(date));
    setCurrent('income');
    closeModal();
    persistAndRender();
  };
}

function findOccurrence(state, occurrenceId) {
  const holidays = state.settings.holidays;
  const incomeState = {
    incomeDefinitions: state.incomeDefinitions,
    incomeReceipts: state.incomeReceipts,
    skippedIncomeOccurrences: state.skippedIncomeOccurrences,
    holidays
  };
  return (
    monthlyIncomeOccurrences(getSelectedMonth(), incomeState).find(item => item.occurrenceId === occurrenceId) ||
    monthlyIncomeOccurrences(monthKeyFromDate(today()), incomeState).find(item => item.occurrenceId === occurrenceId)
  );
}

export const incomeActions = {
  addSalary() {
    openModal('Cadastrar salário', incomeFormMarkup(null, true));
    wireIncomeForm(null, true);
  },

  addIncome() {
    openModal('Adicionar entrada', incomeFormMarkup());
    wireIncomeForm();
  },

  editIncomeDefinition(button) {
    const definition = getState().incomeDefinitions.find(item => item.id === button.dataset.id);
    if (!definition) return;
    const salary = definition.kind === 'SALARY';
    openModal(salary ? 'Editar salário' : 'Editar entrada', incomeFormMarkup(definition, salary));
    wireIncomeForm(definition, salary);
  },

  deleteIncomeDefinition(button) {
    const state = getState();
    const id = button.dataset.id;
    const definition = state.incomeDefinitions.find(item => item.id === id);
    if (!definition) return;
    confirmAction({
      title: 'Excluir fonte de renda',
      message: `Tem certeza que deseja excluir "${definition.name}"? O histórico de recebimentos dela também será apagado.`,
      onConfirm: () => {
        state.incomeDefinitions = state.incomeDefinitions.filter(item => item.id !== id);
        Object.keys(state.incomeReceipts)
          .filter(key => key.startsWith(`${id}-`))
          .forEach(key => delete state.incomeReceipts[key]);
        Object.keys(state.skippedIncomeOccurrences)
          .filter(key => key.startsWith(`${id}-`))
          .forEach(key => delete state.skippedIncomeOccurrences[key]);
        persistAndRender();
      }
    });
  },

  receiveIncome(button) {
    const state = getState();
    const occurrence = findOccurrence(state, button.dataset.occurrenceId);
    if (!occurrence) return;

    if (!state.accounts.some(account => account.currency === 'BRL' && !account.reserved)) {
      openModal(
        'Cadastre uma conta primeiro',
        `<div class="modal-note">Para confirmar um recebimento, escolha em qual conta o dinheiro entrou. Assim o saldo atual é atualizado corretamente.</div><div class="actions"><button class="ghost" data-action="closeModal" type="button">Fechar</button><button class="primary" data-action="addAccount" type="button">Cadastrar conta</button></div>`
      );
      return;
    }

    openModal(
      'Confirmar recebimento',
      `<form id="receiveForm"><div class="modal-note">A classificação original (${RELIABILITY[occurrence.reliability].label}) será preservada no histórico.</div><div class="form-grid">
        <div class="field"><label>Valor estimado</label><input value="${occurrence.estimatedAmount.toFixed(2)}" disabled></div>
        <div class="field"><label for="receiveAmount">Valor realmente recebido</label><input id="receiveAmount" name="actualAmount" type="number" min="0" step="0.01" required value="${occurrence.estimatedAmount.toFixed(2)}"></div>
        <div class="field"><label for="receiveDate">Data efetiva</label><input id="receiveDate" name="receivedDate" type="date" required value="${toISODate(today())}"></div>
        <div class="field"><label for="receiveAccount">Conta de destino</label><select id="receiveAccount" name="accountId" required><option value="">Selecione...</option>${accountOptions()}</select></div>
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Confirmar recebimento</button></div></form>`
    );

    document.querySelector('#receiveForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const actualAmount = Number(form.get('actualAmount'));
      const receivedDate = String(form.get('receivedDate'));
      const accountId = String(form.get('accountId'));
      if (occurrence.recurring) {
        state.incomeReceipts[occurrence.occurrenceId] = { actualAmount, receivedDate, accountId };
      } else {
        const definition = state.incomeDefinitions.find(item => item.id === occurrence.definitionId);
        definition.status = 'RECEIVED';
        definition.actualAmount = actualAmount;
        definition.receivedDate = receivedDate;
        definition.receivedAccountId = accountId;
      }
      const destination = state.accounts.find(account => account.id === accountId);
      if (destination) destination.balance = Number(destination.balance || 0) + actualAmount;
      closeModal();
      persistAndRender();
    };
  },

  cancelIncome(button) {
    const state = getState();
    const occurrence = findOccurrence(state, button.dataset.occurrenceId);
    if (!occurrence) return;
    if (occurrence.recurring) {
      state.skippedIncomeOccurrences[occurrence.occurrenceId] = true;
    } else {
      const definition = state.incomeDefinitions.find(item => item.id === occurrence.definitionId);
      if (definition) definition.status = 'CANCELLED';
    }
    persistAndRender();
  }
};
