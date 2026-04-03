import { APP_CONFIG } from './config.js';
import { setLoading, setReady, setError, mergeData, getState } from './state.js';
import { loadAllData } from './data-loader.js';
import { setLoadingMessage, hideLoadingMessage, showGlobalError, clearGlobalError, qs } from './ui.js';
import { initRouter, registerRoute, initMobileNav, navigate } from './router.js';
import { renderDashboard } from './sections/dashboard.js';
import { renderStandings } from './sections/standings.js';
import { renderMatches } from './sections/matches.js';
import { renderPlayers } from './sections/players.js';
import { renderTeams } from './sections/teams.js';
import { renderBetting } from './sections/betting.js';
import { renderBrackets } from './sections/brackets.js';
import { renderMatchup } from './sections/matchup.js';

function registerSections() {
  registerRoute('dashboard', renderDashboard);
  registerRoute('standings', renderStandings);
  registerRoute('matches', renderMatches);
  registerRoute('players', renderPlayers);
  registerRoute('teams', renderTeams);
  registerRoute('betting', renderBetting);
  registerRoute('brackets', renderBrackets);
  if (APP_CONFIG.featureFlags.matchup) {
    registerRoute('matchup', renderMatchup);
  }
}

async function init() {
  try {
    setLoading(true);
    setLoadingMessage('Loading Iron Sight Stats…');
    registerSections();
    initRouter();
    initMobileNav();

    const data = await loadAllData();
    mergeData(data);

    const versionText = data.meta?.version ? `v${data.meta.version}` : 'Public Build';
    const subtitle = qs('#app-version');
    const footerMeta = qs('#footer-meta');
    if (subtitle) subtitle.textContent = versionText;
    if (footerMeta) footerMeta.textContent = data.meta?.exported ? `Data exported ${data.meta.exported}` : 'Static public build';

    clearGlobalError();
    setReady(true);
    setError(false);

    const sectionFromHash = window.location.hash.replace('#', '') || APP_CONFIG.defaultSection;
    navigate(sectionFromHash, { replaceHash: true });
  } catch (error) {
    console.error(error);
    setError(true);
    showGlobalError(`App failed to initialize: ${error.message}`);
  } finally {
    hideLoadingMessage();
    setLoading(false);
  }
}

init();
