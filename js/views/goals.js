'use strict';

import { brl, escapeHTML, formatDate, monthKeyFromDate, today } from '../utils.js';
import { financialTotals } from '../calculations.js';
import { emptyState, priorityChip } from '../ui.js';

function goalHtml(goal) {
  const pct = Math.min(100, (Number(goal.current || 0) / Number(goal.target || 1)) * 100);
  return `<div class="goal">
    <div class="goal-head">
      <div><div class="goal-name">${escapeHTML(goal.name)}</div><span class="subtle">Prazo: ${formatDate(goal.deadline)}</span></div>
      ${priorityChip(goal.priority)}
    </div>
    <div class="goal-row"><span>${brl(goal.current)} de ${brl(goal.target)}</span><span>${pct.toFixed(0)}%</span></div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <div class="item-actions">
      <button class="tiny-btn" data-action="editGoal" data-id="${goal.id}" type="button">Atualizar valor</button>
      <button class="tiny-btn" data-action="deleteGoal" data-id="${goal.id}" type="button">Excluir</button>
    </div>
  </div>`;
}

const PRIORITY_ORDER = { Alta: 0, Média: 1, Baixa: 2 };

export function renderGoals(state) {
  const totals = financialTotals(state, monthKeyFromDate(today()));
  const ordered = [...state.goals].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));

  return `<div class="toolbar"><button class="primary" data-action="addGoal" type="button">+ Novo objetivo</button></div>
    <div class="safety-banner">
      <div class="icon">🎯</div>
      <div><strong>As metas usam seu cenário seguro.</strong><span class="subtle">Nenhuma meta vem preenchida de fábrica. Você define objetivo, valor, prazo e prioridade.</span></div>
    </div>
    <div class="card">
      <div class="section-title"><h3>Seus objetivos</h3><span class="subtle">Saldo seguro futuro: ${brl(totals.safeFuture)}</span></div>
      ${ordered.length ? ordered.map(goalHtml).join('') : emptyState('Nenhuma meta cadastrada.', 'addGoal', 'Criar primeira meta')}
    </div>`;
}
