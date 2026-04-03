import { qs, renderSectionHeader } from '../ui.js';
export function renderMatches() {
  const target = qs('#matches-section');
  if (!target) return;
  target.innerHTML = `
    <div class="section-card section-placeholder">
      ${renderSectionHeader('Matches', 'This module is scaffolded and ready for the next build pass.')}
      <p class="muted">The shell, routing, and data pipeline are already connected. This section is next in line for full implementation.</p>
    </div>
  `;
}
