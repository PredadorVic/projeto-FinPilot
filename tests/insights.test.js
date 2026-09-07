import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insightFingerprint } from '../js/actions/insights.js';
import { createInitialState } from '../js/state.js';

test('fingerprint muda quando o saldo muda', () => {
  const state = createInitialState();
  state.accounts.push({ id: 'a1', currency: 'BRL', balance: 1000, reserved: false });
  const before = insightFingerprint(state, '2026-09');
  state.accounts[0].balance = 2000;
  const after = insightFingerprint(state, '2026-09');
  assert.notEqual(before, after);
});

test('fingerprint é igual quando nada relevante muda', () => {
  const state = createInitialState();
  state.accounts.push({ id: 'a1', currency: 'BRL', balance: 1000, reserved: false });
  const a = insightFingerprint(state, '2026-09');
  const b = insightFingerprint(state, '2026-09');
  assert.equal(a, b);
});

test('fingerprint muda quando o perfil de preferências muda', () => {
  const state = createInitialState();
  const before = insightFingerprint(state, '2026-09');
  state.profile.priorities = 'Quitar o cartão';
  const after = insightFingerprint(state, '2026-09');
  assert.notEqual(before, after);
});
