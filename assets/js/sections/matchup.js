import { sectionFrame, emptyState } from '../ui.js';
export function renderMatchup(container) {
  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Matchup', 'Reserved for the full compare-builder pass')}
      ${emptyState('This section is scaffolded and routed, but the real compare logic is still ahead.')}
    </div></div>
  `;
}
