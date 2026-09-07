// Cliente de IA do FinPilot. `buildFinancialSummary` é puro (fácil de
// testar); `askAI` é a única função do projeto que faz uma chamada de rede
// pra fora do dispositivo do usuário — e só roda quando ele mesmo configurar
// um endpoint de IA nas configurações.
'use strict';

import { escapeHTML } from './utils.js';
import { financialTotals } from './calculations.js';

export function buildFinancialSummary(state, selectedMonth) {
  const totals = financialTotals(state, selectedMonth);
  return {
    mes: selectedMonth,
    saldoDisponivel: round2(totals.liquid),
    garantidoAReceber: round2(totals.guaranteed),
    previstoMaisVariavel: round2(totals.expected + totals.variable),
    eventual: round2(totals.eventual),
    saldoSeguroFuturo: round2(totals.safeFuture),
    saldoProjetado: round2(totals.projected),
    potencialMaximo: round2(totals.potentialMax),
    reservado: round2(totals.reservedBRL),
    recebidoNoMes: round2(totals.receivedTotal),
    despesasNoMes: round2(totals.spend),
    resultadoDoMes: round2(totals.saving),
    margemDeSeguranca: round2(Number(state.user.safetyMargin || 0)),
    dividaCartoes: round2(totals.debt),
    parcelamentosMensais: round2(totals.installmentsMonthly),
    metas: state.goals.map(goal => ({
      nome: goal.name,
      alvo: round2(goal.target),
      atual: round2(goal.current),
      prazo: goal.deadline,
      prioridade: goal.priority
    })),
    cartoes: state.cards.map(card => ({
      nome: card.name,
      limite: round2(card.limit),
      usado: round2(card.used),
      fatura: round2(card.invoice)
    }))
  };
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function isAIConfigured(state) {
  return Boolean(state.settings.aiEndpoint && state.settings.aiEndpoint.trim());
}

// Formatação mínima e seguindo escapando primeiro: só depois de escapar o
// texto é que aplicamos **negrito** e quebras de linha, então não tem como
// a IA injetar HTML de verdade — na pior hipótese aparece um <b> literal.
export function formatReplyHTML(text) {
  return escapeHTML(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

export async function askAI({ endpoint, accessKey, message, history, financialSummary, profile }) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessKey ? { 'X-App-Access-Key': accessKey } : {})
      },
      body: JSON.stringify({ message, history, financialSummary, profile })
    });
  } catch (err) {
    throw new Error('Não consegui conectar ao endpoint de IA configurado. Confira a URL nas configurações.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status} ao falar com a IA.`);
  if (!data.reply) throw new Error('A IA não devolveu nenhuma resposta.');
  return data.reply;
}
