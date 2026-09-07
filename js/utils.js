// Funções puras de formatação e utilidades gerais.
// Nada neste arquivo toca no DOM ou no localStorage — por isso é
// seguro importar tanto no navegador quanto nos testes (Node).
'use strict';

export const brl = value =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export const money = (value, currency = 'BRL') =>
  new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency }).format(
    Number(value || 0)
  );

export const percent = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;

export const pad = value => String(value).padStart(2, '0');

export const today = () => new Date();

export const toISODate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const monthKeyFromDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const monthKeyFromISO = value => (value ? String(value).slice(0, 7) : '');

export const parseDate = iso => {
  const [y, m, d] = String(iso || '')
    .split('-')
    .map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};

export const formatDate = iso => {
  if (!iso) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR').format(parseDate(iso));
};

export const monthParts = monthKey => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, monthIndex: month - 1 };
};

export const monthLabel = monthKey => {
  const { year, monthIndex } = monthParts(monthKey);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1));
};

const SHORT_MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Formato curto e fixo ("jan/24"), construído manualmente em vez de via
// Intl: o formato "short" do Intl varia entre motores ICU (ex.: "jan de 24"
// no Node vs. "jan/24" em alguns navegadores), o que quebraria o rótulo
// compacto que o gráfico precisa.
export const shortMonthLabel = monthKey => {
  const { year, monthIndex } = monthParts(monthKey);
  return `${SHORT_MONTHS_PT[((monthIndex % 12) + 12) % 12]}/${String(year).slice(-2)}`;
};

export const shiftMonth = (monthKey, amount) => {
  const { year, monthIndex } = monthParts(monthKey);
  const date = new Date(year, monthIndex + amount, 1, 12);
  return monthKeyFromDate(date);
};

export const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

export const escapeHTML = value =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])
  );

export const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const initials = name => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'FP';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Converte uma taxa anual (%) para a taxa mensal equivalente (%),
// respeitando juros compostos (não é simplesmente dividir por 12).
export const annualToMonthlyRate = annualPercent => {
  const annual = Number(annualPercent || 0) / 100;
  return (Math.pow(1 + annual, 1 / 12) - 1) * 100;
};

export const monthlyToAnnualRate = monthlyPercent => {
  const monthly = Number(monthlyPercent || 0) / 100;
  return (Math.pow(1 + monthly, 12) - 1) * 100;
};
