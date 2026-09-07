import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, parseImportedState, recordHistorySnapshot, exportStateAsJSON } from '../js/state.js';

test('createInitialState começa zerado (sem valores de fábrica)', () => {
  const state = createInitialState();
  assert.equal(state.accounts.length, 0);
  assert.equal(state.incomeDefinitions.length, 0);
  assert.equal(state.user.name, '');
  assert.equal(state.user.safetyMargin, 0);
});

describe('parseImportedState', () => {
  test('rejeita texto que não é JSON', () => {
    assert.throws(() => parseImportedState('isso não é json'), /não é um JSON válido/);
  });

  test('rejeita JSON que não parece um backup do FinPilot', () => {
    assert.throws(() => parseImportedState(JSON.stringify({ foo: 'bar' })), /não parece ser um backup/);
  });

  test('aceita um backup válido e preenche campos novos que faltarem (migração v4 -> v5)', () => {
    const v4Shape = {
      version: 4,
      user: { name: 'Ana', safetyMargin: 500 },
      accounts: [{ id: 'a1', name: 'Conta', balance: 1000, currency: 'BRL' }],
      incomeDefinitions: [],
      expenses: [],
      goals: [],
      cards: []
      // sem "history" nem "simulatorInputs": campos novos da v5
    };
    const migrated = parseImportedState(JSON.stringify(v4Shape));
    assert.equal(migrated.version, 5);
    assert.equal(migrated.user.name, 'Ana');
    assert.equal(migrated.accounts.length, 1, 'dados antigos do usuário devem ser preservados');
    assert.deepEqual(migrated.history, []);
    assert.deepEqual(migrated.simulatorInputs, {});
  });
});

test('recordHistorySnapshot registra no máximo um ponto por dia (upsert)', () => {
  const state = createInitialState();
  state.accounts.push({ id: 'a1', currency: 'BRL', balance: 1000, reserved: false });
  recordHistorySnapshot(state);
  assert.equal(state.history.length, 1);
  const firstNetWorth = state.history[0].netWorth;
  assert.equal(firstNetWorth, 1000);

  state.accounts[0].balance = 1500;
  recordHistorySnapshot(state); // mesmo dia: deve substituir, não duplicar
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].netWorth, 1500);
});

test('exportStateAsJSON produz um JSON com os dados e um carimbo de data', () => {
  const json = exportStateAsJSON(createInitialState());
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, 5);
  assert.ok(parsed.exportedAt);
});
