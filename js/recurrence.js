// Motor de dias úteis e de ocorrências de renda recorrente.
//
// Este módulo é PURO: recebe feriados/definições como parâmetros em vez de
// ler um `state` global. Isso permite testá-lo isoladamente (ver
// tests/recurrence.test.js) sem precisar simular o navegador.
'use strict';

import { toISODate, parseDate, monthParts, daysInMonth } from './utils.js';

export function isBusinessDay(date, holidays = []) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidays.includes(toISODate(date));
}

export function nthBusinessDay(year, monthIndex, nth, holidays = []) {
  let count = 0;
  const date = new Date(year, monthIndex, 1, 12);
  while (date.getMonth() === monthIndex) {
    if (isBusinessDay(date, holidays)) count += 1;
    if (count === nth) return new Date(date);
    date.setDate(date.getDate() + 1);
  }
  // Não há dias úteis suficientes no mês (feriados demais): cai no último dia do mês.
  return new Date(year, monthIndex + 1, 0, 12);
}

export function lastBusinessDay(year, monthIndex, holidays = []) {
  const date = new Date(year, monthIndex + 1, 0, 12);
  while (!isBusinessDay(date, holidays)) date.setDate(date.getDate() - 1);
  return date;
}

export function isDefinitionActiveInMonth(definition, monthKey) {
  const { year, monthIndex } = monthParts(monthKey);
  const monthStart = new Date(year, monthIndex, 1, 12);
  const monthEnd = new Date(year, monthIndex + 1, 0, 12);
  const start = definition.startDate ? parseDate(definition.startDate) : monthStart;
  const end = definition.endDate ? parseDate(definition.endDate) : null;
  return start <= monthEnd && (!end || end >= monthStart);
}

export function occurrenceDatesForMonth(definition, monthKey, holidays = []) {
  if (!definition.recurring || !definition.recurrence || !isDefinitionActiveInMonth(definition, monthKey)) return [];

  const { year, monthIndex } = monthParts(monthKey);
  const rule = definition.recurrence;

  if (rule.type === 'FIFTH_BUSINESS_DAY') return [toISODate(nthBusinessDay(year, monthIndex, 5, holidays))];
  if (rule.type === 'FIRST_BUSINESS_DAY') return [toISODate(nthBusinessDay(year, monthIndex, 1, holidays))];
  if (rule.type === 'LAST_BUSINESS_DAY') return [toISODate(lastBusinessDay(year, monthIndex, holidays))];

  if (rule.type === 'MONTHLY_DAY') {
    const day = Math.min(Math.max(1, Number(rule.day || 1)), daysInMonth(year, monthIndex));
    return [toISODate(new Date(year, monthIndex, day, 12))];
  }

  if (rule.type === 'WEEKLY') {
    const wantedDay = Number(rule.dayOfWeek ?? 1);
    const result = [];
    const date = new Date(year, monthIndex, 1, 12);
    while (date.getMonth() === monthIndex) {
      if (date.getDay() === wantedDay && (!definition.startDate || date >= parseDate(definition.startDate))) {
        result.push(toISODate(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return result;
  }

  if (rule.type === 'BIWEEKLY') {
    const result = [];
    let date = parseDate(definition.startDate || `${monthKey}-01`);
    const monthStart = new Date(year, monthIndex, 1, 12);
    const monthEnd = new Date(year, monthIndex + 1, 0, 12);
    while (date < monthStart) date.setDate(date.getDate() + 14);
    while (date <= monthEnd) {
      if (date.getMonth() === monthIndex) result.push(toISODate(date));
      date.setDate(date.getDate() + 14);
    }
    return result;
  }

  if (rule.type === 'YEARLY') {
    const base = parseDate(definition.startDate || `${year}-01-01`);
    if (base.getMonth() !== monthIndex) return [];
    const day = Math.min(base.getDate(), daysInMonth(year, monthIndex));
    return [toISODate(new Date(year, monthIndex, day, 12))];
  }

  return [];
}

export function occurrenceStatus(occurrence) {
  if (occurrence.receipt) return 'RECEIVED';
  if (occurrence.cancelled) return 'CANCELLED';
  return 'PENDING';
}

// incomeState = { incomeDefinitions, incomeReceipts, skippedIncomeOccurrences, holidays }
export function monthlyIncomeOccurrences(monthKey, incomeState) {
  const { incomeDefinitions = [], incomeReceipts = {}, skippedIncomeOccurrences = {}, holidays = [] } = incomeState;
  const occurrences = [];

  incomeDefinitions.forEach(definition => {
    if (definition.recurring) {
      occurrenceDatesForMonth(definition, monthKey, holidays).forEach(date => {
        const occurrenceId = `${definition.id}-${date}`;
        occurrences.push({
          occurrenceId,
          definitionId: definition.id,
          name: definition.name,
          kind: definition.kind || 'OTHER',
          reliability: definition.reliability,
          estimatedAmount: Number(definition.estimatedAmount || 0),
          expectedDate: date,
          recurring: true,
          recurrence: definition.recurrence,
          category: definition.category || '',
          confidence: definition.confidence ?? null,
          receipt: incomeReceipts[occurrenceId] || null,
          cancelled: Boolean(skippedIncomeOccurrences[occurrenceId])
        });
      });
      return;
    }

    const dateForMonth =
      definition.status === 'RECEIVED' && definition.receivedDate ? definition.receivedDate : definition.expectedDate;
    if (monthKeyFromISOSafe(dateForMonth) !== monthKey) return;
    occurrences.push({
      occurrenceId: definition.id,
      definitionId: definition.id,
      name: definition.name,
      kind: definition.kind || 'OTHER',
      reliability: definition.reliability,
      estimatedAmount: Number(definition.estimatedAmount || 0),
      expectedDate: definition.expectedDate,
      recurring: false,
      category: definition.category || '',
      confidence: definition.confidence ?? null,
      receipt:
        definition.status === 'RECEIVED'
          ? {
              actualAmount: Number(definition.actualAmount ?? definition.estimatedAmount),
              receivedDate: definition.receivedDate,
              accountId: definition.receivedAccountId || null
            }
          : null,
      cancelled: definition.status === 'CANCELLED'
    });
  });

  return occurrences.sort((a, b) =>
    String(a.expectedDate || a.receipt?.receivedDate || '').localeCompare(
      String(b.expectedDate || b.receipt?.receivedDate || '')
    )
  );
}

function monthKeyFromISOSafe(value) {
  return value ? String(value).slice(0, 7) : '';
}
