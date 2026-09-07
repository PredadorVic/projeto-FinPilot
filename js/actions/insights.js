'use strict';

// Análise proativa: em vez de esperar uma pergunta, monta uma "pergunta"
// fixa e abrangente e manda pro mesmo endpoint do chat. Guardamos um
// "fingerprint" dos dados usados pra saber se vale a pena gerar de novo, e
// um cooldown mínimo pra nunca chamar a IA mais que o necessário.
import { monthKeyFromDate, today } from '../utils.js';
import { getState, getSelectedMonth, persistOnly, requestRender } from '../store.js';
import { askAI, buildFinancialSummary, isAIConfigured, formatReplyHTML } from '../ai.js';

const MIN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

const INSIGHT_PROMPT = `Faça uma análise proativa e completa da minha situação financeira agora, sem eu precisar perguntar nada específico. Cubra, em tópicos curtos:
1. Quanto eu posso gastar com segurança nos próximos dias.
2. Quanto eu deveria guardar este mês.
3. Um alerta sobre metas, cartões ou dívidas, se houver algo relevante.
4. Uma recomendação prática pra próxima semana.
Seja direto — isto vai aparecer num card pequeno do app, não escreva um relatório longo.`;

let generating = false;

export function insightFingerprint(state, selectedMonth) {
  const summary = buildFinancialSummary(state, selectedMonth);
  return `${JSON.stringify(summary)}|${JSON.stringify(state.profile)}`;
}

export function isInsightGenerating() {
  return generating;
}

export async function generateInsight() {
  const state = getState();
  if (!isAIConfigured(state) || generating) return;

  const month = getSelectedMonth() || monthKeyFromDate(today());
  const fingerprint = insightFingerprint(state, month);

  generating = true;
  requestRender();

  try {
    const reply = await askAI({
      endpoint: state.settings.aiEndpoint,
      accessKey: state.settings.aiAccessKey,
      message: INSIGHT_PROMPT,
      history: [],
      financialSummary: buildFinancialSummary(state, month),
      profile: state.profile
    });
    state.aiInsight = { text: reply, generatedAt: new Date().toISOString(), forFingerprint: fingerprint, error: '' };
  } catch (err) {
    state.aiInsight = { ...state.aiInsight, error: err.message };
  } finally {
    generating = false;
    persistOnly();
    requestRender();
  }
}

// Chamado pelo main.js só ao entrar/renderizar Início ou Análise — nunca em
// toda ação. Só gera de novo se: já passou o cooldown mínimo E os dados
// mudaram desde a última análise (ou nunca houve uma).
export function maybeAutoRefreshInsight() {
  const state = getState();
  if (!isAIConfigured(state) || generating) return;

  const lastAt = state.aiInsight.generatedAt ? new Date(state.aiInsight.generatedAt).getTime() : 0;
  if (Date.now() - lastAt < MIN_REFRESH_INTERVAL_MS) return;

  const month = getSelectedMonth() || monthKeyFromDate(today());
  const fingerprint = insightFingerprint(state, month);
  const stale = !state.aiInsight.text || state.aiInsight.forFingerprint !== fingerprint;
  if (stale) generateInsight();
}

export const insightActions = {
  refreshInsight() {
    generateInsight();
  }
};

export function insightCardHTML(state) {
  if (!isAIConfigured(state)) return '';
  const insight = state.aiInsight;
  const generatedLabel = insight.generatedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(insight.generatedAt))
    : null;

  let body;
  if (generating) body = '<p class="subtle">Analisando seus dados agora...</p>';
  else if (insight.error) body = `<p class="subtle">⚠️ ${formatReplyHTML(insight.error)}</p>`;
  else if (insight.text) body = `<div>${formatReplyHTML(insight.text)}</div>`;
  else body = '<p class="subtle">Gerando sua primeira análise automática...</p>';

  return `<div class="card ai-insight-card">
    <div class="section-title">
      <h3>🤖 Análise da IA</h3>
      <button class="tiny-btn" data-action="refreshInsight" type="button" ${generating ? 'disabled' : ''}>Atualizar agora</button>
    </div>
    ${body}
    ${generatedLabel ? `<p class="subtle" style="margin-top:8px">Gerado em ${generatedLabel}${insight.forFingerprint === insightFingerprint(state, getSelectedMonth() || monthKeyFromDate(today())) ? '' : ' — seus dados mudaram desde então'}.</p>` : ''}
  </div>`;
}
