import { APP_CONFIG, SECTION_META } from './config.js';
import { getState, updateState } from './state.js';

function normalizeRoute(route) {
  const clean = String(route || '').replace('#', '').trim().toLowerCase();
  const valid = APP_CONFIG.sections.find((section) => section.id === clean && section.enabled);
  return valid ? valid.id : APP_CONFIG.defaultSection;
}

function updateNav(route) {
  document.querySelectorAll('.nav-link[data-route]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.route === route);
  });
}

function updateSections(route) {
  document.querySelectorAll('.app-section[data-section]').forEach((section) => {
    const active = section.dataset.section === route;
    section.hidden = !active;
    section.classList.toggle('is-active', active);
  });
}

function updatePageMeta(route) {
  const meta = SECTION_META[route] || SECTION_META[APP_CONFIG.defaultSection];
  const pageTitle = document.getElementById('page-title');
  const pageDescription = document.getElementById('page-description');
  if (pageTitle) pageTitle.textContent = meta.title;
  if (pageDescription) pageDescription.textContent = meta.description;
}

function closeMobileNav() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const toggle = document.getElementById('mobile-nav-toggle');
  if (drawer) drawer.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  updateState('navigation.mobileNavOpen', false);
}

export function openRoute(route, options = {}) {
  const normalized = normalizeRoute(route);
  const current = getState().navigation.currentSection;

  updateState('navigation.previousSection', current);
  updateState('navigation.currentSection', normalized);
  updateNav(normalized);
  updateSections(normalized);
  updatePageMeta(normalized);

  if (!options.skipHashUpdate) {
    window.location.hash = normalized;
  }

  closeMobileNav();
  return normalized;
}

export function initializeRouter() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.nav-link[data-route]');
    if (!button) return;
    event.preventDefault();
    openRoute(button.dataset.route);
  });

  window.addEventListener('hashchange', () => {
    openRoute(window.location.hash, { skipHashUpdate: true });
  });

  const initial = normalizeRoute(window.location.hash || APP_CONFIG.defaultSection);
  openRoute(initial, { skipHashUpdate: true });
}

export function initializeMobileNav() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const drawer = document.getElementById('mobile-nav-drawer');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    const shouldOpen = drawer.hidden;
    drawer.hidden = !shouldOpen;
    toggle.setAttribute('aria-expanded', String(shouldOpen));
    updateState('navigation.mobileNavOpen', shouldOpen);
  });
}
