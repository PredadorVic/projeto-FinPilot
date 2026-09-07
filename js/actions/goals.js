'use strict';

import { uid } from '../utils.js';
import { openModal, confirmAction, closeModal } from '../ui.js';
import { getState, persistAndRender } from '../store.js';

export const goalActions = {
  addGoal() {
    openModal(
      'Novo objetivo',
      `<form id="goalForm"><div class="form-grid">
        <div class="field full"><label for="goalName">Nome</label><input id="goalName" name="name" required placeholder="Digite sua meta"></div>
        <div class="field"><label for="goalTarget">Valor alvo</label><input id="goalTarget" name="target" type="number" min="0" step="0.01" required placeholder="0,00"></div>
        <div class="field"><label for="goalCurrent">Já guardado</label><input id="goalCurrent" name="current" type="number" min="0" step="0.01" placeholder="0,00"></div>
        <div class="field"><label for="goalDeadline">Prazo</label><input id="goalDeadline" name="deadline" type="date" required></div>
        <div class="field"><label for="goalPriority">Prioridade</label><select id="goalPriority" name="priority" required><option value="">Selecione...</option><option>Alta</option><option>Média</option><option>Baixa</option></select></div>
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
    );
    document.querySelector('#goalForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      getState().goals.push({
        id: uid('goal'),
        name: String(form.get('name')).trim(),
        target: Number(form.get('target')),
        current: Number(form.get('current') || 0),
        deadline: String(form.get('deadline')),
        priority: String(form.get('priority'))
      });
      closeModal();
      persistAndRender();
    };
  },

  editGoal(button) {
    const state = getState();
    const goal = state.goals.find(item => item.id === button.dataset.id);
    if (!goal) return;
    openModal(
      `Atualizar "${goal.name}"`,
      `<form id="goalEditForm"><div class="form-grid">
        <div class="field"><label for="goalEditCurrent">Valor já guardado</label><input id="goalEditCurrent" name="current" type="number" min="0" step="0.01" required value="${Number(goal.current || 0)}"></div>
        <div class="field"><label for="goalEditTarget">Valor alvo</label><input id="goalEditTarget" name="target" type="number" min="0" step="0.01" required value="${Number(goal.target || 0)}"></div>
        <div class="field"><label for="goalEditDeadline">Prazo</label><input id="goalEditDeadline" name="deadline" type="date" required value="${goal.deadline || ''}"></div>
        <div class="field"><label for="goalEditPriority">Prioridade</label><select id="goalEditPriority" name="priority" required>${['Alta', 'Média', 'Baixa']
          .map(p => `<option ${p === goal.priority ? 'selected' : ''}>${p}</option>`)
          .join('')}</select></div>
      </div><div class="actions"><button type="button" class="ghost" data-action="closeModal">Cancelar</button><button class="primary" type="submit">Salvar</button></div></form>`
    );
    document.querySelector('#goalEditForm').onsubmit = event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      Object.assign(goal, {
        current: Number(form.get('current')),
        target: Number(form.get('target')),
        deadline: String(form.get('deadline')),
        priority: String(form.get('priority'))
      });
      closeModal();
      persistAndRender();
    };
  },

  deleteGoal(button) {
    const state = getState();
    const goal = state.goals.find(item => item.id === button.dataset.id);
    if (!goal) return;
    confirmAction({
      title: 'Excluir meta',
      message: `Tem certeza que deseja excluir "${goal.name}"?`,
      onConfirm: () => {
        state.goals = state.goals.filter(item => item.id !== button.dataset.id);
        persistAndRender();
      }
    });
  }
};
