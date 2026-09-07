'use strict';

import { brl, monthKeyFromDate, today } from '../utils.js';
import { financialTotals, lastMonthsIncomeExpense } from '../calculations.js';
import { metric, heroMetric } from '../ui.js';
import { lineChartSVG, incomeExpenseBarChartSVG } from '../charts.js';

export function renderAnalysis(state) {
  const currentMonth = monthKeyFromDate(today());
  const totals = financialTotals(state, currentMonth);
  const uncertain = totals.expected + totals.variable + totals.eventual;

  const historyPoints = state.history.map(point => ({
    label: point.date.slice(5).split('-').reverse().join('/'),
    value: point.netWorth
  }));
  const incomeExpenseGroups = lastMonthsIncomeExpense(state, currentMonth, 6);

  return `
    <div class="grid cards">
      ${heroMetric('Cenário seguro', brl(totals.safeFuture), 'Saldo atual + garantido', 'positive')}
      ${metric('Cenário projetado', brl(totals.projected), 'Inclui previsto + variável', 'warning')}
      ${metric('Potencial máximo', brl(totals.potentialMax), 'Inclui eventual', 'neutral')}
      ${metric('Patrimônio líquido', brl(totals.net), 'Contas + reservas - faturas', totals.net >= 0 ? 'positive' : 'danger')}
    </div>
    <div class="grid section-grid">
      <div class="card">
        <div class="section-title"><h3>Evolução patrimonial</h3><span class="subtle">Um ponto por dia de uso do app</span></div>
        ${lineChartSVG(historyPoints)}
      </div>
      <div class="card">
        <div class="section-title"><h3>Recebido x despesas</h3><span class="subtle">Últimos 6 meses</span></div>
        ${incomeExpenseBarChartSVG(incomeExpenseGroups)}
        <div class="chart-legend">
          <span><i class="chart-legend-dot chart-legend-income"></i> Recebido</span>
          <span><i class="chart-legend-dot chart-legend-expense"></i> Despesas</span>
        </div>
      </div>
    </div>
    <div class="grid section-grid">
      <div class="card">
        <div class="section-title"><h3>Cenários</h3></div>
        <div class="scenario"><strong class="positive">🛡️ Seguro — ${brl(totals.safeFuture)}</strong><p class="subtle">Apenas valores disponíveis e entradas garantidas.</p></div>
        <div class="scenario"><strong class="warning">◷ Projetado — ${brl(totals.projected)}</strong><p class="subtle">Acrescenta valores previstos e variáveis.</p></div>
        <div class="scenario"><strong>○ Potencial — ${brl(totals.potentialMax)}</strong><p class="subtle">Inclui também entradas eventuais.</p></div>
      </div>
      <div class="card">
        <h3>Leitura dos seus dados</h3>
        <div class="alert">Entradas incertas pendentes: ${brl(uncertain)}.</div>
        <div class="alert">Parcelamentos mensais cadastrados: ${brl(totals.installmentsMonthly)}.</div>
        <div class="alert">Margem de segurança definida por você: ${brl(state.user.safetyMargin)}.</div>
      </div>
    </div>`;
}
