import { APP_CONFIG } from './config.js';
import { loadAllData } from './data-loader.js';
import { initRouter } from './router.js';
import { getState, patchState } from './state.js';
import { qs, showMessage, wireImageFallbacks } from './ui.js';
import { renderDashboard } from './sections/dashboard.js';
import { renderStandings } from './sections/standings.js';
import { renderMatches } from './sections/matches.js';
import { renderPlayers } from './sections/players.js';
import { renderTeams } from './sections/teams.js';
import { renderBetting } from './sections/betting.js';
import { renderBrackets } from './sections/brackets.js';
import { renderMatchup } from './sections/matchup.js';

const renderers = {
  dashboard: renderDashboard,
  standings: renderStandings,
  matches: renderMatches,
  players: renderPlayers,
  teams: renderTeams,
  betting: renderBetting,
  brackets: renderBrackets,
  matchup: renderMatchup
};

function renderSection(section) {
  const container = qs(`#${section}-section`);
  if (!container) return;
  const render = renderers[section];
  if (render) {
    render(container, getState());
    wireImageFallbacks(container);
  }
}

function renderAll() {
  APP_CONFIG.sections.forEach(renderSection);
}

function initMobileNav() {
  const toggle = qs('#mobile-nav-toggle');
  const mobileNav = qs('#mobile-nav');
  if (!toggle || !mobileNav) return;
  toggle.addEventListener('click', () => {
    const next = mobileNav.hidden;
    mobileNav.hidden = !next;
    toggle.setAttribute('aria-expanded', String(next));
    patchState({ mobileNavOpen: next });
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileNav.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    patchState({ mobileNavOpen: false });
  }));
}

async function boot() {
  try {
    patchState({ isLoading: true });
    initMobileNav();
    await loadAllData();
    patchState({ isLoading: false, isReady: true });
    const meta = getState().data.meta;
    qs('#footer-version').textContent = meta?.version ? `v${meta.version}` : 'Public build';
    renderAll();
    initRouter((section) => renderSection(section));
  } catch (error) {
    console.error(error);
    showMessage('The public data layer failed to load. Check that your JSON files are in /data and named correctly.');
  }
}

boot();
