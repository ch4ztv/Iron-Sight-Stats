import { APP_CONFIG } from '../config.js';
import { qs, renderSectionHeader } from '../ui.js';

export function renderBrackets() {
  const target = qs('#brackets-section');
  if (!target) return;
  target.innerHTML = `
    <div class="stack">
      <div class="section-card">
        ${renderSectionHeader('Brackets', 'Major event bracket files already connected')}
        <div class="grid-2">
          <a class="panel" href="${APP_CONFIG.bracketPages.major1}" target="_blank" rel="noopener noreferrer">
            <h3>Major 1 Bracket</h3>
            <p class="muted">Open the standalone bracket page in a new tab.</p>
          </a>
          <a class="panel" href="${APP_CONFIG.bracketPages.major2}" target="_blank" rel="noopener noreferrer">
            <h3>Major 2 Bracket</h3>
            <p class="muted">Open the standalone bracket page in a new tab.</p>
          </a>
        </div>
      </div>
    </div>
  `;
}
