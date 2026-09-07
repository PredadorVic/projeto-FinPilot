import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildFinancialSummary, isAIConfigured } from '../js/ai.js';
import { createInitialState } from '../js/state.js';

describe('buildFinancialSummary', () => {
  test('resume os números certos e nunca mistura garantido com possível', () => {
    const state = createInitialState();
    state.accounts.push({ id: 'a1', currency: 'BRL', balance: 1000, reserved: false });
    state.user.safetyMargin = 300;
    state.goals.push({ id: 'g1', name: 'Viagem', target: 5000, current: 1000, deadline: '2027-01-01', priority: 'Alta' });
    state.incomeDefinitions.push({
      id: 'g1inc',
      reliability: 'GUARANTEED',
      estimatedAmount: 2000,
      recurring: false,
      expectedDate: '2026-09-10',
      status: 'PENDING'
    });
    state.incomeDefinitions.push({
      id: 'v1inc',
      reliability: 'VARIABLE',
      estimatedAmount: 500,
      recurring: false,
      expectedDate: '2026-09-15',
      status: 'PENDING'
    });

    const summary = buildFinancialSummary(state, '2026-09');
    assert.equal(summary.saldoDisponivel, 1000);
    assert.equal(summary.garantidoAReceber, 2000);
    assert.equal(summary.previstoMaisVariavel, 500);
    assert.equal(summary.saldoSeguroFuturo, 3000, 'seguro deve ser líquido + garantido, nunca + variável');
    assert.equal(summary.margemDeSeguranca, 300);
    assert.equal(summary.metas.length, 1);
    assert.equal(summary.metas[0].nome, 'Viagem');
  });

  test('arredonda valores pra 2 casas decimais (evita mandar dízimas pra IA)', () => {
    const state = createInitialState();
    state.accounts.push({ id: 'a1', currency: 'BRL', balance: 10 / 3, reserved: false });
    const summary = buildFinancialSummary(state, '2026-09');
    assert.equal(summary.saldoDisponivel, 3.33);
  });
});

describe('isAIConfigured', () => {
  test('falso quando não há endpoint configurado', () => {
    const state = createInitialState();
    assert.equal(isAIConfigured(state), false);
  });

  test('verdadeiro quando há um endpoint configurado', () => {
    const state = createInitialState();
    state.settings.aiEndpoint = 'https://exemplo.workers.dev';
    assert.equal(isAIConfigured(state), true);
  });
});
