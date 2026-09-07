'use strict';

import { escapeHTML, monthKeyFromDate, today } from '../utils.js';
import { openModal, closeModal } from '../ui.js';
import { getState, getSelectedMonth, persistOnly, persistAndRender } from '../store.js';
import { askAI, buildFinancialSummary, isAIConfigured, formatReplyHTML } from '../ai.js';
import { assistantReply } from '../views/assistant.js';

const MAX_STORED_HISTORY = 12;

function appendMessage(role, html) {
  const wrap = document.querySelector('#chatMessages');
  if (!wrap) return null;
  const el = document.createElement('div');
  el.className = `message ${role === 'user' ? 'user' : 'bot'}`;
  el.innerHTML = html;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
  return el;
}

async function handleAsk(question) {
  const state = getState();
  appendMessage('user', escapeHTML(question));
  const input = document.querySelector('#assistantInput');
  if (input) input.value = '';

  if (!isAIConfigured(state)) {
    appendMessage('bot', assistantReply(state, question));
    return;
  }

  const askBtn = document.querySelector('#askBtn');
  if (askBtn) askBtn.disabled = true;
  const thinking = appendMessage('bot', '<i>Pensando...</i>');

  try {
    const reply = await askAI({
      endpoint: state.settings.aiEndpoint,
      accessKey: state.settings.aiAccessKey,
      message: question,
      history: state.aiHistory,
      financialSummary: buildFinancialSummary(state, getSelectedMonth() || monthKeyFromDate(today())),
      profile: state.profile
    });
    if (thinking) thinking.innerHTML = formatReplyHTML(reply);
    state.aiHistory.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
    if (state.aiHistory.length > MAX_STORED_HISTORY) state.aiHistory.splice(0, state.aiHistory.length - MAX_STORED_HISTORY);
    persistOnly();
  } catch (err) {
    if (thinking) thinking.innerHTML = `⚠️ ${escapeHTML(err.message)}`;
  } finally {
    if (askBtn) askBtn.disabled = false;
  }
}

export const assistantActions = {
  ask() {
    const input = document.querySelector('#assistantInput');
    if (!input || !input.value.trim()) return;
    handleAsk(input.value.trim());
  },

  openProfileInterview() {
    const profile = getState().profile;
    openModal(
      'Perfil para a IA',
      `<div class="modal-note">Isso não muda nenhum cálculo do app — é só contexto que a IA vai lembrar sempre que você conversar com ela.</div>
      <form id="profileForm"><div class="form-grid">
        <div class="field full"><label for="profSpending">No que você mais gosta de gastar dinheiro?</label><textarea id="profSpending" name="spendingJoys" rows="2" placeholder="Ex.: viagens, comer fora, tecnologia...">${escapeHTML(profile.spendingJoys)}</textarea></div>
        <div class="field full"><label for="profStyle">Como você se descreveria?</label><select id="profStyle" name="savingStyle">
          <option value="">Prefiro não dizer</option>
          <option value="saver" ${profile.savingStyle === 'saver' ? 'selected' : ''}>Prefiro guardar bastante</option>
          <option value="balanced" ${profile.savingStyle === 'balanced' ? 'selected' : ''}>Gosto de equilíbrio</option>
          <option value="spender" ${profile.savingStyle === 'spender' ? 'selected' : ''}>Prefiro aproveitar o presente</option>
        </select></div>
        <div class="field full"><label for="profPriorities">Quais são suas prioridades financeiras agora?</label><textarea id="profPriorities" name="priorities" rows="2" placeholder="Ex.: quitar uma dívida, juntar pra um imóvel...">${escapeHTML(profile.priorities)}</textarea></div>
        <div class="field full"><label for="profDependents">Tem dependentes ou responsabilidades importantes?</label><textarea id="profDependents" name="dependents" rows="2" placeholder="Opcional">${escapeHTML(profile.dependents)}</textarea></div>
        <div class="field full"><label for="profNotes">Algo mais que a IA deveria sempre lembrar?</label><textarea id="profNotes" name="notes" rows="2" placeholder="Opcional">${escapeHTML(profile.notes)}</textarea></div>
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar perfil</button></div></form>`
    );
    document.querySelector('#profileForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const state = getState();
      state.profile = {
        spendingJoys: String(form.get('spendingJoys') || '').trim(),
        savingStyle: String(form.get('savingStyle') || ''),
        priorities: String(form.get('priorities') || '').trim(),
        dependents: String(form.get('dependents') || '').trim(),
        notes: String(form.get('notes') || '').trim(),
        updatedAt: new Date().toISOString()
      };
      closeModal();
      persistAndRender();
    };
  }
};
