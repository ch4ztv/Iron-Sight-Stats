import { qs, renderSectionHeader } from '../ui.js';
export function renderMatchup() {
  const target = qs('#matchup-section');
  if (!target) return;
  target.innerHTML = `
    <div class="section-card section-placeholder">
      ${renderSectionHeader('Matchup', 'This module is scaffolded and ready for the next build pass.')}
      <p class="muted">The shell, routing, and data pipeline are already connected. This section is next in line for full implementation.</p>
    </div>
  `;
}
