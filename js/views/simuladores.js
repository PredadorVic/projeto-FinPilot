'use strict';

import { toolCard } from '../ui.js';

export function renderSimuladores() {
  return `
    <div class="hero simuladores-hero">
      <h2>Simuladores financeiros</h2>
      <p>Cada simulador faz apenas a conta com os números que você informar. Nenhuma taxa vem pré-preenchida com valores de mercado — confira sempre a taxa atual antes de decidir, e lembre-se: retornos passados não garantem retornos futuros.</p>
    </div>
    <div class="grid quick-add-grid tool-grid">
      ${toolCard('openCompoundInterest', 'Juros compostos', 'Projete um aporte mensal no tempo, em 3 cenários e em valor real.', '📈')}
      ${toolCard('openPurchaseDecision', 'Posso comprar? / Parcelado x à vista', 'Compare pagar à vista ou parcelar, com o juro embutido calculado.', '🛒')}
      ${toolCard('openDebtVsInvest', 'Quitar dívida x investir', 'Descubra o que compensa mais matematicamente com o dinheiro que sobrou.', '⚖️')}
      ${toolCard('openRetirementPlan', 'Aposentadoria / independência financeira', 'Quanto acumular e quanto investir por mês para chegar lá.', '🏖️')}
      ${toolCard('openFixedIncomeCompare', 'Comparador de renda fixa', 'Compare até 3 opções já descontando o IR regressivo.', '🧮')}
    </div>`;
}
