// Gráficos em SVG puro — sem biblioteca externa, para o app continuar
// funcionando 100% offline (e para o service worker não depender de CDN).
// Cada função devolve uma STRING de SVG pronta para innerHTML.
'use strict';

import { brl } from './utils.js';

function buildScale(domainMin, domainMax, rangeMin, rangeMax) {
  const domainSpan = domainMax - domainMin || 1;
  return value => rangeMin + ((value - domainMin) / domainSpan) * (rangeMax - rangeMin);
}

function emptyChart(message, width, height) {
  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${message}">
    <text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="chart-empty-text">${message}</text>
  </svg>`;
}

// points: [{ label: 'jan/24', value: 1234.5 }, ...] em ordem cronológica
export function lineChartSVG(points, { width = 640, height = 220, unit = 'BRL' } = {}) {
  if (!points || points.length === 0) return emptyChart('Ainda sem histórico suficiente.', width, height);

  const padding = { top: 20, right: 16, bottom: 28, left: 16 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = points.map(p => p.value);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) {
    min -= Math.max(1, Math.abs(min) * 0.1);
    max += Math.max(1, Math.abs(max) * 0.1);
  } else {
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;
  }

  const xScale = buildScale(0, Math.max(1, points.length - 1), padding.left, padding.left + innerW);
  const yScale = buildScale(min, max, padding.top + innerH, padding.top);
  const zeroY = yScale(0);

  const coords = points.map((p, i) => [xScale(i), yScale(p.value)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${zeroY.toFixed(1)} L${coords[0][0].toFixed(1)},${zeroY.toFixed(1)} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const labelEvery = Math.ceil(points.length / 5) || 1;

  const xLabels = points
    .map((p, i) => {
      if (i !== 0 && i !== points.length - 1 && i % labelEvery !== 0) return '';
      return `<text x="${xScale(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis-label">${p.label}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Evolução de ${first.label} a ${last.label}: de ${brl(first.value)} para ${brl(last.value)}">
    <line x1="${padding.left}" y1="${zeroY.toFixed(1)}" x2="${width - padding.right}" y2="${zeroY.toFixed(1)}" class="chart-zero-line" />
    <path d="${areaPath}" class="chart-area" />
    <path d="${linePath}" class="chart-line" />
    <circle cx="${coords[coords.length - 1][0].toFixed(1)}" cy="${coords[coords.length - 1][1].toFixed(1)}" r="4" class="chart-dot" />
    <text x="${coords[coords.length - 1][0].toFixed(1)}" y="${(coords[coords.length - 1][1] - 10).toFixed(1)}" text-anchor="end" class="chart-value-label">${brl(last.value)}</text>
    ${xLabels}
  </svg>`;
}

// groups: [{ label: 'jan/24', income: 1000, expense: 800 }, ...]
export function incomeExpenseBarChartSVG(groups, { width = 640, height = 240 } = {}) {
  if (!groups || groups.length === 0) return emptyChart('Ainda sem lançamentos suficientes.', width, height);

  const padding = { top: 20, right: 16, bottom: 34, left: 16 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...groups.flatMap(g => [g.income, g.expense]));
  const yScale = buildScale(0, max, 0, innerH);

  const groupWidth = innerW / groups.length;
  const barWidth = Math.min(22, groupWidth / 3);
  const gap = 6;

  const bars = groups
    .map((group, i) => {
      const groupX = padding.left + i * groupWidth + groupWidth / 2;
      const incomeH = yScale(group.income);
      const expenseH = yScale(group.expense);
      const incomeX = groupX - barWidth - gap / 2;
      const expenseX = groupX + gap / 2;
      const baseY = padding.top + innerH;
      return `
        <rect x="${incomeX.toFixed(1)}" y="${(baseY - incomeH).toFixed(1)}" width="${barWidth}" height="${Math.max(1, incomeH).toFixed(1)}" class="chart-bar-income" rx="3">
          <title>${group.label} · Recebido: ${brl(group.income)}</title>
        </rect>
        <rect x="${expenseX.toFixed(1)}" y="${(baseY - expenseH).toFixed(1)}" width="${barWidth}" height="${Math.max(1, expenseH).toFixed(1)}" class="chart-bar-expense" rx="3">
          <title>${group.label} · Despesas: ${brl(group.expense)}</title>
        </rect>
        <text x="${groupX.toFixed(1)}" y="${height - 10}" text-anchor="middle" class="chart-axis-label">${group.label}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Recebido x despesas por mês">
    <line x1="${padding.left}" y1="${padding.top + innerH}" x2="${width - padding.right}" y2="${padding.top + innerH}" class="chart-zero-line" />
    ${bars}
  </svg>`;
}
