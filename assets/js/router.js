import { APP_CONFIG } from './config.js';
import { getState, patchState } from './state.js';
import { qsa, qs } from './ui.js';

export function initRouter(onRouteChange) {
  const applyRoute = () => {
    const hash = window.location.hash.replace('#', '') || APP_CONFIG.defaultSection;
    const next = APP_CONFIG.sections.includes(hash) ? hash : APP_CONFIG.defaultSection;
    patchState({ currentSection: next });

    APP_CONFIG.sections.forEach(section => {
      const el = qs(`#${section}-section`);
      if (el) el.hidden = section !== next;
    });

    qsa('[data-route]').forEach(link => {
      link.classList.toggle('active', link.dataset.route === next);
    });

    if (typeof onRouteChange === 'function') onRouteChange(next, getState());
  };

  window.addEventListener('hashchange', applyRoute);
  applyRoute();
}
