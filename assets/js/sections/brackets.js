import { APP_CONFIG } from '../config.js';
import { sectionFrame, selectControl, emptyState } from '../ui.js';
import { titleizeSlug } from '../formatters.js';

function summarizeBracket(data) {
  const matches = Object.entries(data || {}).map(([slot, value]) => ({ slot, ...value }));
  return {
    matchCount: matches.length,
    firstMatch: matches[0] || null,
    grandFinal: matches.find(match => /GF$/.test(match.slot)) || matches[matches.length - 1] || null
  };
}

export function renderBrackets(container, state) {
  const bracketData = state.data.bracketData || {};
  const options = APP_CONFIG.brackets.map(bracket => ({ value: bracket.id, label: bracket.label }));
  const selected = state.currentBracketView && APP_CONFIG.brackets.some(br => br.id === state.currentBracketView)
    ? state.currentBracketView
    : APP_CONFIG.brackets[0]?.id;
  const selectedBracket = APP_CONFIG.brackets.find(br => br.id === selected);
  const data = selectedBracket ? bracketData?.[selectedBracket.dataKey] : null;
  const summary = data ? summarizeBracket(data) : null;

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel"><div class="panel-body">
        ${sectionFrame('Brackets', 'Standalone major bracket pages with an embedded preview inside the public app', `
          <div class="filters-row compact">
            <label class="muted" for="bracket-select">Bracket</label>
            ${selectControl('bracket-select', options, selected)}
          </div>
        `)}
        ${selectedBracket ? `
          <div class="grid-2 bracket-grid">
            <div class="panel inset"><div class="panel-body">
              <div class="eyebrow">Bracket Summary</div>
              <h3 style="margin:8px 0 12px">${selectedBracket.label}</h3>
              ${summary ? `
                <div class="card-list compact-gap">
                  <div class="stat-card compact"><div class="stat-label">Imported Matches</div><div class="stat-value">${summary.matchCount}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Opening Slot</div><div class="stat-subvalue">${summary.firstMatch ? `${summary.firstMatch.slot}: ${titleizeSlug(summary.firstMatch.t1)} vs ${titleizeSlug(summary.firstMatch.t2)}` : '—'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Grand Final</div><div class="stat-subvalue">${summary.grandFinal ? `${titleizeSlug(summary.grandFinal.t1)} ${summary.grandFinal.score1}-${summary.grandFinal.score2} ${titleizeSlug(summary.grandFinal.t2)}` : '—'}</div></div>
                </div>
              ` : emptyState('No imported bracket summary was found for this event.')}
              <div style="margin-top:16px">
                <a class="link-card compact-link" href="${selectedBracket.href}" target="_blank" rel="noopener noreferrer">Open full bracket page</a>
              </div>
            </div></div>
            <div class="panel inset"><div class="panel-body bracket-frame-wrap">
              <iframe class="bracket-frame" title="${selectedBracket.label}" src="${selectedBracket.href}"></iframe>
            </div></div>
          </div>
        ` : emptyState('No bracket pages configured yet.')}
      </div></div>
    </div>
  `;

  const select = container.querySelector('#bracket-select');
  if (select) {
    select.addEventListener('change', () => {
      state.currentBracketView = select.value;
      renderBrackets(container, state);
    });
  }
}
