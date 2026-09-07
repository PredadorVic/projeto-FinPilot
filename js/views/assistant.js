'use strict';

// Duas camadas nesta view:
// 1) Se a pessoa configurou um endpoint de IA (Configurações), o chat chama
//    a IA de verdade, com o resumo financeiro real como contexto.
// 2) Se não configurou nada, cai de volta pras respostas fixas por palavra-
//    chave (igual à v4) — o app nunca fica quebrado por falta de IA.

import { brl, monthKeyFromDate, today } from '../utils.js';
import { financialTotals } from '../calculations.js';
import { isAIConfigured, formatReplyHTML } from '../ai.js';

export function renderAssistant(state) {
  const totals = financialTotals(state, monthKeyFromDate(today()));
  const aiOn = isAIConfigured(state);
  const hasProfile = Boolean(state.profile.spendingJoys || state.profile.priorities || state.profile.notes);
  const history = (state.aiHistory || [])
    .map(item => `<div class="message ${item.role === 'user' ? 'user' : 'bot'}">${formatReplyHTML(item.content)}</div>`)
    .join('');

  return `<div class="card assistant-box">
    ${
      aiOn
        ? `<div class="modal-note">🤖 IA conectada. ${
            hasProfile ? 'Usando seu perfil de preferências nas respostas.' : 'Configure seu perfil pra respostas mais personalizadas.'
          } <button type="button" class="tiny-btn" data-action="openProfileInterview" style="margin-left:6px">${
            hasProfile ? 'Editar perfil' : 'Configurar perfil'
          }</button></div>`
        : `<div class="modal-note">Respostas fixas (sem IA conectada). Para respostas de verdade sobre seus dados, configure um endpoint de IA em Configurações → Assistente de IA.</div>`
    }
    <div class="message bot"><b>Meu Assistente Financeiro</b><br>Eu analiso somente os valores que você cadastrou. Hoje há <b>${brl(totals.liquid)}</b> disponíveis, <b>${brl(totals.guaranteed)}</b> garantidos a receber e <b>${brl(totals.expected + totals.variable + totals.eventual)}</b> ainda incertos.</div>
    <div class="quick-prompts">
      <button data-prompt="Quanto posso gastar hoje?" type="button">Quanto posso gastar hoje?</button>
      <button data-prompt="Quanto devo guardar esse mês?" type="button">Quanto devo guardar esse mês?</button>
      <button data-prompt="Quais entradas ainda são incertas?" type="button">Entradas incertas</button>
      <button data-prompt="Como está meu mês?" type="button">Como está meu mês?</button>
    </div>
    <div id="chatMessages">${history}</div>
    <div class="assistant-input">
      <input id="assistantInput" placeholder="Pergunte sobre seus dados financeiros...">
      <button class="primary" data-action="ask" type="button" id="askBtn">Enviar</button>
    </div>
  </div>`;
}

// Mantido exatamente como na v4 — usado como fallback quando não há IA configurada.
export function assistantReply(state, question) {
  const totals = financialTotals(state, monthKeyFromDate(today()));
  const text = question.toLowerCase();
  const safeSpendNow = Math.max(0, totals.liquid - Number(state.user.safetyMargin || 0));
  const uncertain = totals.expected + totals.variable + totals.eventual;

  if (text.includes('cenário seguro') || text.includes('cenario seguro'))
    return `Seu cenário seguro futuro é <b>${brl(totals.safeFuture)}</b>: ${brl(totals.liquid)} disponíveis agora + ${brl(totals.guaranteed)} garantidos a receber.`;
  if (text.includes('incert'))
    return `Você tem <b>${brl(uncertain)}</b> em entradas ainda incertas: ${brl(totals.expected)} previstas, ${brl(totals.variable)} variáveis e ${brl(totals.eventual)} eventuais.`;
  if (text.includes('quanto devo guardar'))
    return `Baseado só no resultado deste mês (${brl(totals.saving)}), uma referência comum é guardar entre 10% e 20% do que você recebe. Isso não considera suas metas específicas — dá uma olhada na aba Metas.`;
  if (text.includes('quanto posso gastar') || text.includes('gastar hoje'))
    return `Com a margem de segurança definida por você em ${brl(state.user.safetyMargin)}, o limite conservador para novos gastos imediatos é aproximadamente <b>${brl(safeSpendNow)}</b>.`;
  if (text.includes('mês') || text.includes('mes'))
    return `Neste mês você recebeu ${brl(totals.receivedTotal)} e lançou ${brl(totals.spend)} em despesas. O resultado registrado é ${brl(totals.saving)}. Seu saldo projetado é ${brl(totals.projected)}, mas ele inclui valores que ainda podem não acontecer.`;
  return `Com os dados cadastrados, você tem <b>${brl(totals.liquid)}</b> agora, <b>${brl(totals.guaranteed)}</b> garantidos a receber e <b>${brl(uncertain)}</b> em valores incertos. Eu nunca misturo esses grupos. Para respostas mais livres, configure uma IA em Configurações.`;
}
