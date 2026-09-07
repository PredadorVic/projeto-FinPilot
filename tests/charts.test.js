import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineChartSVG, incomeExpenseBarChartSVG } from '../js/charts.js';

test('lineChartSVG lida com lista vazia sem lançar erro', () => {
  const svg = lineChartSVG([]);
  assert.match(svg, /<svg/);
  assert.match(svg, /Ainda sem histórico/);
});

test('lineChartSVG desenha um ponto por entrada e não estoura com valor único', () => {
  const svg = lineChartSVG([{ label: 'jan/24', value: 1000 }]);
  assert.match(svg, /<svg/);
  assert.match(svg, /chart-dot/);
});

test('lineChartSVG lida com patrimônio negativo (linha de zero visível)', () => {
  const svg = lineChartSVG([
    { label: 'jan/24', value: -500 },
    { label: 'fev/24', value: 300 }
  ]);
  assert.match(svg, /chart-zero-line/);
});

test('incomeExpenseBarChartSVG lida com lista vazia sem lançar erro', () => {
  const svg = incomeExpenseBarChartSVG([]);
  assert.match(svg, /<svg/);
});

test('incomeExpenseBarChartSVG desenha duas barras por grupo', () => {
  const svg = incomeExpenseBarChartSVG([
    { label: 'jan/24', income: 1000, expense: 400 },
    { label: 'fev/24', income: 1200, expense: 900 }
  ]);
  const incomeBars = svg.match(/chart-bar-income/g) || [];
  const expenseBars = svg.match(/chart-bar-expense/g) || [];
  assert.equal(incomeBars.length, 2);
  assert.equal(expenseBars.length, 2);
});
