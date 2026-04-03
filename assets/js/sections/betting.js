import { sectionFrame, emptyState } from '../ui.js';
export function renderBetting(container, state) {
  const coefficients = state.data.bprCoefficients || [];
  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Betting Lab', 'Connected to the public data layer, ready for the full logic pass')}
      ${coefficients.length ? `<div class="table-wrap"><table><thead><tr><th>Entry</th><th>Value</th></tr></thead><tbody>${coefficients.slice(0, 20).map((entry, index) => `<tr><td>${entry.name || entry.id || `Coefficient ${index + 1}`}</td><td>${entry.value ?? entry.coefficient ?? '—'}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Betting logic is the next major polish phase.')}
    </div></div>
  `;
}
