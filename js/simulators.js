// Simuladores financeiros — todos puros (entram números, saem números).
// Nenhuma dessas funções promete rentabilidade garantida: elas só fazem a
// conta com as taxas que o usuário informa. O app deixa isso explícito
// na interface (ver views/simuladores.js).
'use strict';

import { annualToMonthlyRate } from './utils.js';

const SCENARIO_SWING = 0.3; // ±30% sobre a taxa "provável", para os cenários conservador/otimista

// ---------------------------------------------------------------------------
// Matemática financeira de base (juros compostos / séries uniformes)
// ---------------------------------------------------------------------------

export function futureValueLumpSum(presentValue, monthlyRate, months) {
  return Number(presentValue || 0) * Math.pow(1 + monthlyRate, months);
}

// Valor futuro de uma série de aportes iguais, feitos ao final de cada mês.
export function futureValueOfSeries(monthlyContribution, monthlyRate, months) {
  const pmt = Number(monthlyContribution || 0);
  if (months <= 0) return 0;
  if (monthlyRate === 0) return pmt * months;
  return pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

export function presentValueOfSeries(monthlyPayment, monthlyRate, months) {
  const pmt = Number(monthlyPayment || 0);
  if (months <= 0) return 0;
  if (monthlyRate === 0) return pmt * months;
  return pmt * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
}

// Dado um valor futuro alvo, quanto preciso aportar por mês para chegar lá
// (partindo de um valor presente que já cresce sozinho a monthlyRate)?
export function requiredPaymentForFutureValue(targetFutureValue, presentValue, monthlyRate, months) {
  if (months <= 0) return null;
  const growthOfPresent = futureValueLumpSum(presentValue, monthlyRate, months);
  const remaining = targetFutureValue - growthOfPresent;
  if (remaining <= 0) return 0; // já bate a meta só com o que já tem investido
  if (monthlyRate === 0) return remaining / months;
  const annuityFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  return remaining / annuityFactor;
}

// Dado um aporte mensal fixo, quantos meses faltam para atingir o valor futuro alvo?
export function monthsToReachFutureValue(targetFutureValue, presentValue, monthlyContribution, monthlyRate) {
  const pv = Number(presentValue || 0);
  const pmt = Number(monthlyContribution || 0);
  if (targetFutureValue <= pv) return 0;
  if (monthlyRate === 0) {
    if (pmt <= 0) return Infinity;
    return (targetFutureValue - pv) / pmt;
  }
  const k = pv + pmt / monthlyRate;
  const numerator = targetFutureValue + pmt / monthlyRate;
  if (k <= 0 || numerator <= 0) return Infinity;
  const ratio = numerator / k;
  if (ratio <= 0) return Infinity;
  return Math.log(ratio) / Math.log(1 + monthlyRate);
}

// Taxa mensal implícita numa série de parcelas (juros embutidos no parcelamento),
// por bisseção — não existe fórmula fechada para isolar a taxa de uma anuidade.
export function impliedMonthlyRate(presentValue, monthlyPayment, months) {
  const pv = Number(presentValue || 0);
  const pmt = Number(monthlyPayment || 0);
  if (pv <= 0 || pmt <= 0 || months <= 0) return 0;
  if (pv >= pmt * months) return 0; // parcelado não custa mais que à vista: sem juros a apurar

  let lo = 0;
  let hi = 1; // 100% ao mês — teto bem acima de qualquer parcelamento real
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const pvAtMid = presentValueOfSeries(pmt, mid, months);
    if (pvAtMid > pv) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// 1) Simulador de juros compostos
// ---------------------------------------------------------------------------

export function compoundInterestProjection({
  initial = 0,
  monthlyContribution = 0,
  annualRatePercent = 0,
  months = 0,
  annualInflationPercent = 0
}) {
  const buildScenario = ratePercent => {
    const monthlyRate = annualToMonthlyRate(ratePercent) / 100;
    const monthlyInflation = annualToMonthlyRate(annualInflationPercent) / 100;
    const nominalFinal =
      futureValueLumpSum(initial, monthlyRate, months) + futureValueOfSeries(monthlyContribution, monthlyRate, months);
    const totalInvested = Number(initial || 0) + Number(monthlyContribution || 0) * months;
    const nominalInterest = nominalFinal - totalInvested;
    const realFinal = nominalFinal / Math.pow(1 + monthlyInflation, months);
    const realInterest = realFinal - totalInvested;
    return { ratePercent, nominalFinal, totalInvested, nominalInterest, realFinal, realInterest };
  };

  return {
    expected: buildScenario(annualRatePercent),
    conservative: buildScenario(annualRatePercent * (1 - SCENARIO_SWING)),
    optimistic: buildScenario(annualRatePercent * (1 + SCENARIO_SWING))
  };
}

// ---------------------------------------------------------------------------
// 2) Posso comprar? / Parcelado x à vista (4 níveis)
// ---------------------------------------------------------------------------

export const PURCHASE_TIERS = {
  GREEN: { icon: '🟢', label: 'Tranquila financeiramente' },
  YELLOW: { icon: '🟡', label: 'Possível, mas exige planejamento' },
  ORANGE: { icon: '🟠', label: 'Pode atrasar seus objetivos' },
  RED: { icon: '🔴', label: 'Financeiramente desaconselhável' }
};

export function purchaseDecision({
  totalValue,
  installmentsCount = 1,
  cashPrice = null,
  investmentAnnualRatePercent = 0,
  liquidBalance = 0,
  safetyMargin = 0
}) {
  const months = Math.max(1, Number(installmentsCount || 1));
  const total = Number(totalValue || 0);
  const installmentValue = total / months;
  const effectiveCashPrice = cashPrice === null || cashPrice === '' ? total : Number(cashPrice);
  const monthlyInvestRate = annualToMonthlyRate(investmentAnnualRatePercent) / 100;

  const impliedMonthly = months > 1 ? impliedMonthlyRate(effectiveCashPrice, installmentValue, months) : 0;
  const pvInstallments = months > 1 ? presentValueOfSeries(installmentValue, monthlyInvestRate, months) : total;

  let mathVerdict = 'EQUIVALENT';
  if (months > 1) {
    const diff = pvInstallments - effectiveCashPrice;
    const threshold = Math.max(1, effectiveCashPrice * 0.01);
    if (diff > threshold) mathVerdict = 'CASH';
    else if (diff < -threshold) mathVerdict = 'INSTALLMENTS';
  }

  const safeSpendNow = Math.max(0, Number(liquidBalance || 0) - Number(safetyMargin || 0));
  const immediateHit = months > 1 ? installmentValue : total;

  let tier = 'RED';
  if (immediateHit <= 0) tier = 'GREEN';
  else if (immediateHit <= safeSpendNow * 0.5) tier = 'GREEN';
  else if (immediateHit <= safeSpendNow) tier = 'YELLOW';
  else if (immediateHit <= Number(liquidBalance || 0)) tier = 'ORANGE';
  else tier = 'RED';

  return {
    months,
    installmentValue,
    effectiveCashPrice,
    impliedMonthlyRatePercent: impliedMonthly * 100,
    pvInstallments,
    mathVerdict, // 'CASH' | 'INSTALLMENTS' | 'EQUIVALENT'
    safeSpendNow,
    immediateHit,
    tier, // 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
    tierInfo: PURCHASE_TIERS[tier]
  };
}

// ---------------------------------------------------------------------------
// 3) Dívida: quitar x investir
// ---------------------------------------------------------------------------

export function debtVsInvest({
  availableAmount = 0,
  debtAnnualRatePercent = 0,
  investAnnualRatePercent = 0,
  months = 12
}) {
  const amount = Number(availableAmount || 0);
  const debtMonthly = annualToMonthlyRate(debtAnnualRatePercent) / 100;
  const investMonthly = annualToMonthlyRate(investAnnualRatePercent) / 100;
  const n = Math.max(1, Number(months || 1));

  const interestAvoidedByPayingDebt = amount * (Math.pow(1 + debtMonthly, n) - 1);
  const returnIfInvested = amount * (Math.pow(1 + investMonthly, n) - 1);
  const advantage = interestAvoidedByPayingDebt - returnIfInvested;

  let recommendation = 'EQUIVALENT';
  if (Math.abs(advantage) > Math.max(1, amount * 0.005)) {
    recommendation = advantage > 0 ? 'PAY_DEBT' : 'INVEST';
  }

  return {
    interestAvoidedByPayingDebt,
    returnIfInvested,
    advantage,
    recommendation // 'PAY_DEBT' | 'INVEST' | 'EQUIVALENT'
  };
}

// ---------------------------------------------------------------------------
// 4) Aposentadoria / independência financeira
// ---------------------------------------------------------------------------

export function retirementPlan({
  currentAge,
  targetAge,
  desiredMonthlyIncomeToday,
  safeWithdrawalAnnualPercent = 4,
  currentInvested = 0,
  monthlyContribution = null,
  expectedAnnualReturnPercent = 0,
  annualInflationPercent = 0
}) {
  const monthsToTarget = Math.max(0, Math.round((Number(targetAge) - Number(currentAge)) * 12));
  const monthlyReturn = annualToMonthlyRate(expectedAnnualReturnPercent) / 100;
  const monthlyInflation = annualToMonthlyRate(annualInflationPercent) / 100;

  const requiredCapitalToday = (Number(desiredMonthlyIncomeToday || 0) * 12) / (Number(safeWithdrawalAnnualPercent || 0.0001) / 100);
  const requiredCapitalFuture = requiredCapitalToday * Math.pow(1 + monthlyInflation, monthsToTarget);

  const result = {
    monthsToTarget,
    requiredCapitalToday,
    requiredCapitalFuture
  };

  if (monthlyContribution === null || monthlyContribution === undefined || monthlyContribution === '') {
    result.requiredMonthlyContribution = requiredPaymentForFutureValue(
      requiredCapitalFuture,
      currentInvested,
      monthlyReturn,
      monthsToTarget
    );
  } else {
    const projectedCapital =
      futureValueLumpSum(currentInvested, monthlyReturn, monthsToTarget) +
      futureValueOfSeries(monthlyContribution, monthlyReturn, monthsToTarget);
    result.projectedCapital = projectedCapital;
    result.surplusOrShortfall = projectedCapital - requiredCapitalFuture;
    result.onTrack = result.surplusOrShortfall >= 0;
    result.monthsToReachWithThisContribution = monthsToReachFutureValue(
      requiredCapitalFuture,
      currentInvested,
      monthlyContribution,
      monthlyReturn
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// 5) Comparador de renda fixa (com IR regressivo)
// ---------------------------------------------------------------------------

export const IR_REGRESSIVE_TABLE = [
  { maxDays: 180, ratePercent: 22.5, label: 'até 180 dias' },
  { maxDays: 360, ratePercent: 20, label: 'de 181 a 360 dias' },
  { maxDays: 720, ratePercent: 17.5, label: 'de 361 a 720 dias' },
  { maxDays: Infinity, ratePercent: 15, label: 'acima de 720 dias' }
];

export function incomeTaxRateForDays(days) {
  const bracket = IR_REGRESSIVE_TABLE.find(item => days <= item.maxDays) || IR_REGRESSIVE_TABLE[IR_REGRESSIVE_TABLE.length - 1];
  return bracket.ratePercent;
}

export function fixedIncomeNetReturn({ grossAnnualRatePercent, days, isExempt = false, annualInflationPercent = 0 }) {
  const d = Math.max(1, Number(days || 1));
  const grossGrowth = Math.pow(1 + Number(grossAnnualRatePercent || 0) / 100, d / 365) - 1;
  const irRatePercent = isExempt ? 0 : incomeTaxRateForDays(d);
  const netGrowth = grossGrowth * (1 - irRatePercent / 100);
  const netAnnualEquivalentPercent = (Math.pow(1 + netGrowth, 365 / d) - 1) * 100;
  const inflationGrowth = Math.pow(1 + Number(annualInflationPercent || 0) / 100, d / 365) - 1;
  const realGrowth = (1 + netGrowth) / (1 + inflationGrowth) - 1;
  const realAnnualEquivalentPercent = (Math.pow(1 + realGrowth, 365 / d) - 1) * 100;
  return {
    grossGrowthPercent: grossGrowth * 100,
    irRatePercent,
    netGrowthPercent: netGrowth * 100,
    netAnnualEquivalentPercent,
    realAnnualEquivalentPercent
  };
}

export function compareFixedIncomeOptions(options, { annualInflationPercent = 0 } = {}) {
  return options.map(option => ({
    ...option,
    result: fixedIncomeNetReturn({
      grossAnnualRatePercent: option.grossAnnualRatePercent,
      days: option.days,
      isExempt: option.isExempt,
      annualInflationPercent
    })
  }));
}
