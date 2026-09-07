import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBusinessDay,
  nthBusinessDay,
  lastBusinessDay,
  occurrenceDatesForMonth,
  isDefinitionActiveInMonth,
  monthlyIncomeOccurrences,
  occurrenceStatus
} from '../js/recurrence.js';

// Janeiro/2024: dia 1 é uma segunda-feira (verificado). Serve de base fixa
// para todos os testes de calendário abaixo, evitando datas "hoje" que mudam.
const JAN_2024 = { year: 2024, monthIndex: 0 };

describe('isBusinessDay', () => {
  test('fim de semana nunca é dia útil', () => {
    assert.equal(isBusinessDay(new Date(2024, 0, 6, 12)), false); // sábado
    assert.equal(isBusinessDay(new Date(2024, 0, 7, 12)), false); // domingo
  });

  test('dia de semana sem feriado é dia útil', () => {
    assert.equal(isBusinessDay(new Date(2024, 0, 3, 12)), true); // quarta
  });

  test('feriado cadastrado pelo usuário deixa de ser dia útil', () => {
    assert.equal(isBusinessDay(new Date(2024, 0, 3, 12), ['2024-01-03']), false);
  });
});

describe('nthBusinessDay', () => {
  test('1º dia útil sem feriados é o próprio dia 1 (segunda)', () => {
    const date = nthBusinessDay(JAN_2024.year, JAN_2024.monthIndex, 1, []);
    assert.equal(date.getDate(), 1);
  });

  test('5º dia útil sem feriados cai em 5/jan (seg a sex corridos)', () => {
    const date = nthBusinessDay(JAN_2024.year, JAN_2024.monthIndex, 5, []);
    assert.equal(date.getDate(), 5);
  });

  test('feriado no dia 1 empurra o 1º e o 5º dia útil', () => {
    const holidays = ['2024-01-01'];
    const first = nthBusinessDay(JAN_2024.year, JAN_2024.monthIndex, 1, holidays);
    const fifth = nthBusinessDay(JAN_2024.year, JAN_2024.monthIndex, 5, holidays);
    assert.equal(first.getDate(), 2, '1º dia útil deveria pular para dia 2');
    assert.equal(fifth.getDate(), 8, '5º dia útil deveria pular para dia 8 (segunda seguinte)');
  });
});

describe('lastBusinessDay', () => {
  test('último dia do mês já é útil (31/jan/2024 é quarta)', () => {
    const date = lastBusinessDay(JAN_2024.year, JAN_2024.monthIndex, []);
    assert.equal(date.getDate(), 31);
  });

  test('feriado no último dia útil recua para o dia anterior', () => {
    const date = lastBusinessDay(JAN_2024.year, JAN_2024.monthIndex, ['2024-01-31']);
    assert.equal(date.getDate(), 30);
  });
});

describe('occurrenceDatesForMonth', () => {
  test('MONTHLY_DAY respeita o dia informado', () => {
    const definition = { recurring: true, recurrence: { type: 'MONTHLY_DAY', day: 15 } };
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-01', []), ['2024-01-15']);
  });

  test('MONTHLY_DAY é limitado ao tamanho do mês (dia 31 em fevereiro)', () => {
    const definition = { recurring: true, recurrence: { type: 'MONTHLY_DAY', day: 31 } };
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-02', []), ['2024-02-29']); // 2024 é bissexto
  });

  test('WEEKLY lista todas as sextas do mês', () => {
    const definition = { recurring: true, recurrence: { type: 'WEEKLY', dayOfWeek: 5 } };
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-01', []), [
      '2024-01-05',
      '2024-01-12',
      '2024-01-19',
      '2024-01-26'
    ]);
  });

  test('BIWEEKLY conta a partir da data de início', () => {
    const definition = { recurring: true, recurrence: { type: 'BIWEEKLY' }, startDate: '2024-01-05' };
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-01', []), ['2024-01-05', '2024-01-19']);
  });

  test('YEARLY só ocorre no mês de aniversário', () => {
    const definition = { recurring: true, recurrence: { type: 'YEARLY' }, startDate: '2023-03-10' };
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-01', []), []);
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-03', []), ['2024-03-10']);
  });

  test('FIFTH_BUSINESS_DAY com feriado no dia 1', () => {
    const definition = { recurring: true, recurrence: { type: 'FIFTH_BUSINESS_DAY' } };
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-01', ['2024-01-01']), ['2024-01-08']);
  });

  test('definição fora do intervalo de vigência não gera ocorrência', () => {
    const definition = {
      recurring: true,
      recurrence: { type: 'MONTHLY_DAY', day: 10 },
      startDate: '2024-03-01'
    };
    assert.equal(isDefinitionActiveInMonth(definition, '2024-01'), false);
    assert.deepEqual(occurrenceDatesForMonth(definition, '2024-01', []), []);
  });
});

describe('monthlyIncomeOccurrences', () => {
  test('combina renda recorrente e avulsa, respeitando recebimentos e cancelamentos', () => {
    const incomeState = {
      incomeDefinitions: [
        {
          id: 'sal1',
          kind: 'SALARY',
          name: 'Salário',
          reliability: 'GUARANTEED',
          estimatedAmount: 5000,
          recurring: true,
          recurrence: { type: 'MONTHLY_DAY', day: 5 },
          startDate: '2024-01-01'
        },
        {
          id: 'bico1',
          name: 'Freela',
          reliability: 'VARIABLE',
          estimatedAmount: 800,
          recurring: false,
          expectedDate: '2024-01-20',
          status: 'PENDING'
        },
        {
          id: 'bonus1',
          name: 'Bônus recebido',
          reliability: 'EVENTUAL',
          estimatedAmount: 300,
          recurring: false,
          expectedDate: '2024-01-10',
          status: 'RECEIVED',
          actualAmount: 350,
          receivedDate: '2024-01-11'
        }
      ],
      incomeReceipts: { 'sal1-2024-01-05': { actualAmount: 5100, receivedDate: '2024-01-05', accountId: 'acc1' } },
      skippedIncomeOccurrences: {},
      holidays: []
    };

    const occurrences = monthlyIncomeOccurrences('2024-01', incomeState);
    assert.equal(occurrences.length, 3);

    const salary = occurrences.find(item => item.definitionId === 'sal1');
    assert.equal(occurrenceStatus(salary), 'RECEIVED');
    assert.equal(salary.receipt.actualAmount, 5100);

    const freela = occurrences.find(item => item.definitionId === 'bico1');
    assert.equal(occurrenceStatus(freela), 'PENDING');

    const bonus = occurrences.find(item => item.definitionId === 'bonus1');
    assert.equal(occurrenceStatus(bonus), 'RECEIVED');

    // Ordenado por data
    assert.deepEqual(
      occurrences.map(item => item.occurrenceId),
      ['sal1-2024-01-05', 'bonus1', 'bico1']
    );
  });

  test('ocorrência recorrente cancelada aparece como CANCELLED', () => {
    const incomeState = {
      incomeDefinitions: [
        {
          id: 'sal1',
          kind: 'SALARY',
          reliability: 'GUARANTEED',
          estimatedAmount: 5000,
          recurring: true,
          recurrence: { type: 'MONTHLY_DAY', day: 5 },
          startDate: '2024-01-01'
        }
      ],
      incomeReceipts: {},
      skippedIncomeOccurrences: { 'sal1-2024-01-05': true },
      holidays: []
    };
    const [occurrence] = monthlyIncomeOccurrences('2024-01', incomeState);
    assert.equal(occurrenceStatus(occurrence), 'CANCELLED');
  });
});
