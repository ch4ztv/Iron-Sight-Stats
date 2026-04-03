import { APP_CONFIG } from './config.js';
import { qs, clearNode, updatePageHeading } from './ui.js';
import { setCurrentSection, setMobileNavOpen, getState } from './state.js';

const routes = new Map();

export function registerRoute(sectionId, renderer) {
  routes.set(sectionId, renderer);
}

export function renderNav() {
  const desktop = qs('#desktop-nav');
  const mobile = qs('#mobile-nav-list');
  if (!desktop || !mobile) return;

  const items = APP_CONFIG.sections.filter((item) => item.enabled);
  const markup = items.map((item) => `
    <li><a class="nav-link" data-section-link="${item.id}" href="${item.hash}">${item.label}</a></li>
  `).join('');

  desktop.innerHTML = markup;
  mobile.innerHTML = markup;
}

export function initRouter() {
  renderNav();

  window.addEventListener('hashchange', () => {
    navigate(getSectionFromHash());
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-section-link]');
    if (!target) return;
    setMobileNavOpen(false);
    syncMobileNav();
  });

  navigate(getSectionFromHash(), { replaceHash: true });
}

function getSectionFromHash() {
  const raw = window.location.hash.replace('#', '').trim();
  const enabledIds = APP_CONFIG.sections.filter((item) => item.enabled).map((item) => item.id);
  return enabledIds.includes(raw) ? raw : APP_CONFIG.defaultSection;
}

export function navigate(sectionId, { replaceHash = false } = {}) {
  const enabledIds = APP_CONFIG.sections.filter((item) => item.enabled).map((item) => item.id);
  const safeSection = enabledIds.includes(sectionId) ? sectionId : APP_CONFIG.defaultSection;

  setCurrentSection(safeSection);

  for (const item of APP_CONFIG.sections) {
    const panel = qs(`#${item.id}-section`);
    if (panel) panel.hidden = item.id !== safeSection;
  }

  document.querySelectorAll('[data-section-link]').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.sectionLink === safeSection);
  });

  if (replaceHash || window.location.hash !== `#${safeSection}`) {
    history.replaceState(null, '', `#${safeSection}`);
  }

  const route = routes.get(safeSection);
  if (route) {
    route();
  } else {
    const panel = qs(`#${safeSection}-section`);
    if (panel) {
      clearNode(panel);
      panel.innerHTML = '<div class="placeholder-card section-placeholder">Section not wired yet.</div>';
    }
  }

  const label = APP_CONFIG.sections.find((item) => item.id === safeSection)?.label || safeSection;
  const meta = getState().isReady ? 'Data connected' : 'Shell ready';
  updatePageHeading(label, meta);
}

export function initMobileNav() {
  const toggle = qs('#mobile-nav-toggle');
  const mobileNav = qs('#mobile-nav');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    const next = !getState().mobileNavOpen;
    setMobileNavOpen(next);
    syncMobileNav();
  });

  syncMobileNav();
}

export function syncMobileNav() {
  const toggle = qs('#mobile-nav-toggle');
  const mobileNav = qs('#mobile-nav');
  const open = getState().mobileNavOpen;
  if (!toggle || !mobileNav) return;
  mobileNav.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}
