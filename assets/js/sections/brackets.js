import { APP_CONFIG } from '../config.js';
import { sectionFrame } from '../ui.js';
export function renderBrackets(container) {
  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Brackets', 'Major bracket pages already placed in the public repo')}
      <div class="link-grid">
        ${APP_CONFIG.brackets.map(bracket => `
          <a class="link-card" href="${bracket.href}" target="_blank" rel="noopener noreferrer">
            <div class="eyebrow">Bracket</div>
            <h3 style="margin:6px 0 8px">${bracket.label}</h3>
            <div class="muted">Open the standalone bracket page</div>
          </a>
        `).join('')}
      </div>
    </div></div>
  `;
}
