'use strict';

import { escapeHTML } from '../utils.js';
import { openModal, closeModal } from '../ui.js';
import { getState, persistAndRender } from '../store.js';

export const settingsActions = {
  openSettings() {
    const state = getState();
    const holidays = state.settings.holidays.join(', ');
    openModal(
      'Perfil financeiro',
      `<form id="settingsForm"><div class="form-grid">
        <div class="field"><label for="settingsName">Seu nome</label><input id="settingsName" name="name" value="${escapeHTML(state.user.name)}" placeholder="Opcional"></div>
        <div class="field"><label for="settingsMargin">Margem de segurança</label><input id="settingsMargin" name="safetyMargin" type="number" min="0" step="0.01" value="${Number(state.user.safetyMargin || 0) || ''}" placeholder="0,00"></div>
        <div class="field full"><label for="settingsHolidays">Feriados considerados como não úteis</label><textarea id="settingsHolidays" name="holidays" rows="3" placeholder="AAAA-MM-DD, AAAA-MM-DD">${escapeHTML(holidays)}</textarea><small>Separe as datas por vírgula. Você decide quais feriados o cálculo de dias úteis deve considerar.</small></div>
      </div>
      <div class="modal-note">
        <b>Assistente de IA (opcional):</b> conecta o chat da aba Assistente a uma IA de verdade, via o Worker descrito no README. Sem isso, o Assistente continua com respostas fixas.
        <div class="form-grid" style="margin-top:8px">
          <div class="field full"><label for="settingsAiEndpoint">URL do endpoint de IA</label><input id="settingsAiEndpoint" name="aiEndpoint" value="${escapeHTML(state.settings.aiEndpoint || '')}" placeholder="https://finpilot-ai.SEU-USUARIO.workers.dev"></div>
          <div class="field full"><label for="settingsAiKey">Senha de acesso do app (se configurou uma)</label><input id="settingsAiKey" name="aiAccessKey" type="password" value="${escapeHTML(state.settings.aiAccessKey || '')}" placeholder="Opcional"></div>
        </div>
      </div>
      <div class="modal-note">
        <b>Seus dados / backup:</b> tudo fica salvo só neste navegador. Vale o hábito de exportar de vez em quando.
        <div class="item-actions" style="margin-top:8px">
          <button type="button" class="tiny-btn" data-action="exportData">⬇ Exportar backup (.json)</button>
          <button type="button" class="tiny-btn" data-action="importData">⬆ Importar backup</button>
        </div>
      </div>
      <div class="actions"><button class="ghost" data-action="closeModal" type="button">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
    );
    document.querySelector('#settingsForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      state.user.name = String(form.get('name') || '').trim();
      state.user.safetyMargin = Number(form.get('safetyMargin') || 0);
      state.settings.holidays = String(form.get('holidays') || '')
        .split(',')
        .map(x => x.trim())
        .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
      state.settings.aiEndpoint = String(form.get('aiEndpoint') || '').trim();
      state.settings.aiAccessKey = String(form.get('aiAccessKey') || '').trim();
      closeModal();
      persistAndRender();
    };
  }
};
