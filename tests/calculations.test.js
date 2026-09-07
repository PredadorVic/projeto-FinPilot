import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  liquidBalance,
  reservedBalance,
  cardDebt,
  monthExpenses,
  incomeSummary,
  financialTotals,
  netWorthNow,
  lastMonthsIncomeExpense
} from '../js/calculations.js';

describe('saldos de contas', () => {
  const accounts = [
    { id: 'a1', currency: 'BRL', balance: 1000, reserved: false },
    { id: 'a2', currency: 'BRL', balance: 2000, reserved: true },
    { id: 'a3', currency: 'USD', balance: 100, exchangeRate: 5, reserved: false }
  ];

  test('liquidBalance ignora contas reservadas e converte moeda estrangeira', () => {
    // 1000 (BRL livre) + 100 USD * 5 = 500 BRL => 1500
    assert.equal(liquidBalance(accounts), 1500);
  });

  test('reservedBalance soma só as contas marcadas como reservadas', () => {
    assert.equal(reservedBalance(accounts), 2000);
  });
});

test('cardDebt soma as faturas de todos os cartões', () => {
  assert.equal(cardDebt([{ invoice: 300 }, { invoice: 150.5 }]), 450.5);
});

test('monthExpenses filtra despesas pelo mês da data', () => {
  const expenses = [
    { date: '2024-01-05', value: 100 },
    { date: '2024-01-20', value: 50 },
    { date: '2024-02-01', value: 999 }
  ];
  assert.equal(monthExpenses(expenses, '2024-01'), 150);
});

describe('incomeSummary — separação garantido x possível', () => {
  const baseIncomeState = {
    accounts: [{ id: 'a1', currency: 'BRL', balance: 1000, reserved: false }],
    incomeReceipts: {},
    skippedIncomeOccurrences: {},
    holidays: [],
    incomeDefinitions: [
      { id: 'g1', reliability: 'GUARANTEED', estimatedAmount: 500, recurring: false, expectedDate: '2024-01-10', status: 'PENDING' },
      { id: 'e1', reliability: 'EXPECTED', estimatedAmount: 300, recurring: false, expectedDate: '2024-01-11', status: 'PENDING' },
      { id: 'v1', reliability: 'VARIABLE', estimatedAmount: 200, recurring: false, expectedDate: '2024-01-12', status: 'PENDING' },
      { id: 'x1', reliability: 'EVENTUAL', estimatedAmount: 100, recurring: false, expectedDate: '2024-01-13', status: 'PENDING' }
    ]
  };

  test('cada nível fica isolado nos totais pendentes', () => {
    const summary = incomeSummary('2024-01', baseIncomeState);
    assert.equal(summary.guaranteed, 500);
    assert.equal(summary.expected, 300);
    assert.equal(summary.variable, 200);
    assert.equal(summary.eventual, 100);
  });

  test('saldo seguro = líquido + garantido; nunca inclui previsto/variável/eventual', () => {
    const summary = incomeSummary('2024-01', baseIncomeState);
    assert.equal(summary.liquid, 1000);
    assert.equal(summary.safeFuture, 1500); // 1000 + 500 garantido
  });

  test('projetado soma previsto+variável; potencial máximo soma também o eventual', () => {
    const summary = incomeSummary('2024-01', baseIncomeState);
    assert.equal(summary.projected, 1500 + 300 + 200); // 2000
    assert.equal(summary.potentialMax, 2000 + 100); // 2100
  });

  test('receita recebida não conta mais como pendente', () => {
    const state = JSON.parse(JSON.stringify(baseIncomeState));
    state.incomeDefinitions[0].status = 'RECEIVED';
    state.incomeDefinitions[0].actualAmount = 520;
    state.incomeDefinitions[0].receivedDate = '2024-01-10';
    const summary = incomeSummary('2024-01', state);
    assert.equal(summary.guaranteed, 0, 'já recebido não deve mais aparecer como garantido pendente');
    assert.equal(summary.receivedTotal, 520);
  });
});

test('financialTotals combina renda, despesas, reserva e dívida de cartão', () => {
  const state = {
    settings: { holidays: [] },
    accounts: [
      { id: 'a1', currency: 'BRL', balance: 1000, reserved: false },
      { id: 'a2', currency: 'BRL', balance: 500, reserved: true }
    ],
    cards: [{ invoice: 200 }],
    installments: [{ installment: 50 }, { installment: 30 }],
    expenses: [{ date: '2024-01-05', value: 400 }],
    incomeDefinitions: [
      { id: 'g1', reliability: 'GUARANTEED', estimatedAmount: 2000, recurring: false, expectedDate: '2024-01-01', status: 'RECEIVED', actualAmount: 2000, receivedDate: '2024-01-01' }
    ],
    incomeReceipts: {},
    skippedIncomeOccurrences: {}
  };

  const totals = financialTotals(state, '2024-01');
  assert.equal(totals.receivedTotal, 2000);
  assert.equal(totals.spend, 400);
  assert.equal(totals.saving, 1600); // 2000 recebido - 400 gasto
  assert.equal(totals.reservedBRL, 500);
  assert.equal(totals.debt, 200);
  assert.equal(totals.installmentsMonthly, 80);
  assert.equal(totals.net, 1000 + 500 - 200); // líquido + reservado - dívida
});

test('lastMonthsIncomeExpense devolve os meses em ordem cronológica, terminando no mês pedido', () => {
  const state = {
    settings: { holidays: [] },
    accounts: [],
    cards: [],
    installments: [],
    incomeReceipts: {},
    skippedIncomeOccurrences: {},
    expenses: [
      { date: '2024-01-10', value: 100 },
      { date: '2024-03-05', value: 50 }
    ],
    incomeDefinitions: []
  };
  const months = lastMonthsIncomeExpense(state, '2024-03', 3);
  assert.deepEqual(
    months.map(m => m.label),
    ['jan/24', 'fev/24', 'mar/24']
  );
  assert.equal(months[0].expense, 100);
  assert.equal(months[1].expense, 0);
  assert.equal(months[2].expense, 50);
});

test('netWorthNow reflete contas e dívidas atuais, sem depender de um mês', () => {
  const state = {
    accounts: [
      { id: 'a1', currency: 'BRL', balance: 1000, reserved: false },
      { id: 'a2', currency: 'BRL', balance: 500, reserved: true }
    ],
    cards: [{ invoice: 300 }]
  };
  assert.equal(netWorthNow(state), 1000 + 500 - 300);
});
