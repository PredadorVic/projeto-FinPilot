import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  futureValueOfSeries,
  presentValueOfSeries,
  futureValueLumpSum,
  impliedMonthlyRate,
  compoundInterestProjection,
  purchaseDecision,
  debtVsInvest,
  retirementPlan,
  incomeTaxRateForDays,
  fixedIncomeNetReturn
} from '../js/simulators.js';

describe('matemática financeira de base', () => {
  test('com taxa zero, valor futuro da série é só a soma dos aportes', () => {
    assert.equal(futureValueOfSeries(100, 0, 12), 1200);
  });

  test('identidade PV->FV: PV de uma série, capitalizada, é igual ao FV da mesma série', () => {
    const rate = 0.01;
    const pv = presentValueOfSeries(150, rate, 24);
    const fvFromPv = futureValueLumpSum(pv, rate, 24);
    const fv = futureValueOfSeries(150, rate, 24);
    assert.ok(Math.abs(fvFromPv - fv) < 1e-6, `esperado ${fv}, obtido ${fvFromPv}`);
  });

  test('impliedMonthlyRate recupera a taxa usada para gerar o PV (ida e volta)', () => {
    const trueRate = 0.025; // 2,5% a.m.
    const pmt = 200;
    const n = 10;
    const pv = presentValueOfSeries(pmt, trueRate, n);
    const found = impliedMonthlyRate(pv, pmt, n);
    assert.ok(Math.abs(found - trueRate) < 1e-4, `esperado ~${trueRate}, obtido ${found}`);
  });

  test('impliedMonthlyRate é 0 quando o parcelado não custa mais que a soma à vista', () => {
    assert.equal(impliedMonthlyRate(1200, 100, 12), 0);
  });
});

describe('compoundInterestProjection', () => {
  test('taxa e inflação zero: final nominal e real batem com o total investido', () => {
    const result = compoundInterestProjection({
      initial: 1000,
      monthlyContribution: 100,
      annualRatePercent: 0,
      months: 12,
      annualInflationPercent: 0
    });
    assert.equal(result.expected.totalInvested, 1000 + 100 * 12);
    assert.ok(Math.abs(result.expected.nominalFinal - result.expected.totalInvested) < 1e-9);
    assert.ok(Math.abs(result.expected.realFinal - result.expected.nominalFinal) < 1e-9);
  });

  test('cenário otimista rende mais que o provável, que rende mais que o conservador', () => {
    const result = compoundInterestProjection({
      initial: 1000,
      monthlyContribution: 200,
      annualRatePercent: 10,
      months: 60,
      annualInflationPercent: 4
    });
    assert.ok(result.optimistic.nominalFinal > result.expected.nominalFinal);
    assert.ok(result.expected.nominalFinal > result.conservative.nominalFinal);
  });

  test('inflação positiva faz o valor real ficar abaixo do nominal', () => {
    const result = compoundInterestProjection({
      initial: 0,
      monthlyContribution: 500,
      annualRatePercent: 8,
      months: 120,
      annualInflationPercent: 4
    });
    assert.ok(result.expected.realFinal < result.expected.nominalFinal);
  });
});

describe('purchaseDecision — 4 níveis', () => {
  test('compra pequena perto da margem de segurança fica verde', () => {
    const result = purchaseDecision({
      totalValue: 100,
      installmentsCount: 1,
      liquidBalance: 5000,
      safetyMargin: 2000
    });
    assert.equal(result.tier, 'GREEN');
  });

  test('compra que consome bastante do espaço livre acima da margem fica amarela', () => {
    const result = purchaseDecision({
      totalValue: 2500,
      installmentsCount: 1,
      liquidBalance: 5000,
      safetyMargin: 2000
    });
    // safeSpendNow = 3000; 2500 > 50% (1500) e <= 3000 => YELLOW
    assert.equal(result.tier, 'YELLOW');
  });

  test('compra que ultrapassa a margem mas ainda cabe no saldo total fica laranja', () => {
    const result = purchaseDecision({
      totalValue: 4000,
      installmentsCount: 1,
      liquidBalance: 5000,
      safetyMargin: 2000
    });
    // safeSpendNow = 3000; 4000 > 3000 mas <= liquidBalance (5000) => ORANGE
    assert.equal(result.tier, 'ORANGE');
  });

  test('compra maior que o saldo total disponível fica vermelha', () => {
    const result = purchaseDecision({
      totalValue: 9000,
      installmentsCount: 1,
      liquidBalance: 5000,
      safetyMargin: 2000
    });
    assert.equal(result.tier, 'RED');
  });

  test('parcelamento com desconto pequeno à vista e juros de investimento baixos: à vista vence', () => {
    const result = purchaseDecision({
      totalValue: 1200,
      installmentsCount: 12,
      cashPrice: 500,
      investmentAnnualRatePercent: 12,
      liquidBalance: 10000,
      safetyMargin: 0
    });
    assert.equal(result.mathVerdict, 'CASH');
  });

  test('parcelamento sem desconto à vista e juros de investimento altos: parcelar vence', () => {
    const result = purchaseDecision({
      totalValue: 1200,
      installmentsCount: 12,
      cashPrice: 1150,
      investmentAnnualRatePercent: 40,
      liquidBalance: 10000,
      safetyMargin: 0
    });
    assert.equal(result.mathVerdict, 'INSTALLMENTS');
  });
});

describe('debtVsInvest', () => {
  test('dívida cara (cartão) vence investimento modesto: priorizar quitar', () => {
    const result = debtVsInvest({
      availableAmount: 1000,
      debtAnnualRatePercent: 200, // ~ juros de cartão/cheque especial
      investAnnualRatePercent: 12,
      months: 12
    });
    assert.equal(result.recommendation, 'PAY_DEBT');
    assert.ok(result.advantage > 0);
  });

  test('investimento com retorno bem maior que a dívida: priorizar investir', () => {
    const result = debtVsInvest({
      availableAmount: 1000,
      debtAnnualRatePercent: 5,
      investAnnualRatePercent: 30,
      months: 12
    });
    assert.equal(result.recommendation, 'INVEST');
  });

  test('taxas praticamente iguais: equivalente', () => {
    const result = debtVsInvest({
      availableAmount: 1000,
      debtAnnualRatePercent: 10,
      investAnnualRatePercent: 10,
      months: 12
    });
    assert.equal(result.recommendation, 'EQUIVALENT');
  });
});

describe('retirementPlan', () => {
  test('aporte necessário cresce quando a renda mensal desejada aumenta', () => {
    const base = {
      currentAge: 30,
      targetAge: 60,
      safeWithdrawalAnnualPercent: 4,
      currentInvested: 0,
      expectedAnnualReturnPercent: 8,
      annualInflationPercent: 4
    };
    const low = retirementPlan({ ...base, desiredMonthlyIncomeToday: 3000 });
    const high = retirementPlan({ ...base, desiredMonthlyIncomeToday: 6000 });
    assert.ok(high.requiredCapitalToday > low.requiredCapitalToday);
    assert.ok(high.requiredMonthlyContribution > low.requiredMonthlyContribution);
  });

  test('projeção com aporte informado indica se está no caminho certo', () => {
    const plan = retirementPlan({
      currentAge: 30,
      targetAge: 60,
      desiredMonthlyIncomeToday: 3000,
      safeWithdrawalAnnualPercent: 4,
      currentInvested: 0,
      monthlyContribution: 5000, // aporte propositalmente alto
      expectedAnnualReturnPercent: 8,
      annualInflationPercent: 4
    });
    assert.equal(plan.onTrack, true);
    assert.ok(plan.projectedCapital > plan.requiredCapitalFuture);
  });

  test('já atingiu a meta só com o que tem investido: aporte necessário é zero', () => {
    const plan = retirementPlan({
      currentAge: 59,
      targetAge: 60,
      desiredMonthlyIncomeToday: 100,
      safeWithdrawalAnnualPercent: 4,
      currentInvested: 10_000_000,
      expectedAnnualReturnPercent: 8,
      annualInflationPercent: 4
    });
    assert.equal(plan.requiredMonthlyContribution, 0);
  });
});

describe('IR regressivo e retorno líquido de renda fixa', () => {
  test('faixas do IR regressivo', () => {
    assert.equal(incomeTaxRateForDays(180), 22.5);
    assert.equal(incomeTaxRateForDays(181), 20);
    assert.equal(incomeTaxRateForDays(360), 20);
    assert.equal(incomeTaxRateForDays(361), 17.5);
    assert.equal(incomeTaxRateForDays(720), 17.5);
    assert.equal(incomeTaxRateForDays(721), 15);
  });

  test('produto isento (LCI/LCA) não sofre desconto de IR', () => {
    const result = fixedIncomeNetReturn({ grossAnnualRatePercent: 10, days: 365, isExempt: true });
    assert.equal(result.irRatePercent, 0);
    assert.ok(Math.abs(result.netGrowthPercent - result.grossGrowthPercent) < 1e-9);
  });

  test('produto tributável tem retorno líquido menor que o bruto', () => {
    const result = fixedIncomeNetReturn({ grossAnnualRatePercent: 10, days: 365, isExempt: false });
    assert.ok(result.netGrowthPercent < result.grossGrowthPercent);
  });
});
