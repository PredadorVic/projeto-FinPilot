'use strict';

import { toISODate, today } from '../utils.js';
import { exportStateAsJSON, parseImportedState } from '../state.js';
import { openModal, confirmAction } from '../ui.js';
import { getState, replaceState, persistAndRender } from '../store.js';

function summarizeBackup(state) {
  return [
    `${state.accounts.length} conta(s)/caixinha(s)`,
    `${state.incomeDefinitions.length} fonte(s) de renda`,
    `${state.expenses.length} despesa(s)`,
    `${state.goals.length} meta(s)`,
    `${state.cards.length} cartão(ões)`,
    `${state.installments.length} parcelamento(s)`
  ].join(' • ');
}

export const dataActions = {
  exportData() {
    const state = getState();
    const json = exportStateAsJSON(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finpilot-backup-${toISODate(today())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  importData() {
    openModal(
      'Restaurar backup',
      `<div class="modal-note"><b>Atenção:</b> restaurar um backup substitui TODOS os dados atuais do FinPilot neste navegador. Se quiser manter o que está aqui, exporte um backup primeiro.</div>
      <div class="field full"><label for="importFile">Arquivo de backup (.json)</label><input id="importFile" type="file" accept="application/json,.json"></div>
      <div id="importFeedback"></div>
      <div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button></div>`
    );

    document.querySelector('#importFile').onchange = event => {
      const file = event.target.files?.[0];
      const feedback = document.querySelector('#importFeedback');
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = parseImportedState(String(reader.result));
          feedback.innerHTML = `<div class="modal-note">Backup válido: ${summarizeBackup(imported)}.</div>
            <div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button type="button" class="danger-btn" id="confirmImportBtn">Substituir meus dados</button></div>`;
          document.querySelector('#confirmImportBtn').onclick = () => {
            confirmAction({
              title: 'Substituir todos os dados?',
              message: 'Essa ação não pode ser desfeita. Os dados atuais deste navegador serão apagados e trocados pelo conteúdo do backup.',
              confirmLabel: 'Substituir',
              onConfirm: () => {
                replaceState(imported);
                persistAndRender();
              }
            });
          };
        } catch (error) {
          feedback.innerHTML = `<div class="modal-note">⚠️ ${error.message}</div>`;
        }
      };
      reader.readAsText(file);
    };
  }
};
