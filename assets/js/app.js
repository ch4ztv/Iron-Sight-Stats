import { APP_CONFIG } from './config.js';
import { getState, updateState } from './state.js';
import { initializeRouter, initializeMobileNav } from './router.js';

function setStatus(text) {
  const status = document.getElementById('global-status');
  if (status) status.textContent = text;
}

function setVersionText() {
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = APP_CONFIG.versionLabelFallback;
  }
}

function renderSectionPlaceholder(sectionId) {
  const container = document.getElementById(`${sectionId}-section`);
  if (!container) return;

  const title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
  container.innerHTML = `
    <div class="card">
      <p class="eyebrow">Foundation Ready</p>
      <h2>${title}</h2>
      <p class="muted-text">This section is wired into the public app shell and ready for data-backed implementation in the next build pass.</p>
      <div class="placeholder-grid">
        <article class="card placeholder-card">
          <h3>Section shell</h3>
          <div class="placeholder-list">
            <div class="placeholder-line long"></div>
            <div class="placeholder-line mid"></div>
            <div class="placeholder-line short"></div>
          </div>
        </article>
        <article class="card placeholder-card">
          <h3>Data hook</h3>
          <div class="placeholder-list">
            <div class="placeholder-line long"></div>
            <div class="placeholder-line long"></div>
            <div class="placeholder-line mid"></div>
          </div>
        </article>
        <article class="card placeholder-card">
          <h3>Mobile pass</h3>
          <div class="placeholder-list">
            <div class="placeholder-line mid"></div>
            <div class="placeholder-line short"></div>
            <div class="placeholder-line long"></div>
          </div>
        </article>
      </div>
    </div>
  `;
}

function renderAllPlaceholders() {
  APP_CONFIG.sections.filter((section) => section.enabled).forEach((section) => {
    renderSectionPlaceholder(section.id);
  });
}

function initializeApp() {
  updateState('app.isLoading', false);
  updateState('app.isReady', true);
  updateState('app.hasError', false);

  setVersionText();
  renderAllPlaceholders();
  initializeMobileNav();
  initializeRouter();

  const footerMeta = document.getElementById('footer-meta');
  if (footerMeta) {
    footerMeta.textContent = `Shell ready • active section: ${getState().navigation.currentSection}`;
  }
  setStatus('Shell ready');
}

try {
  initializeApp();
} catch (error) {
  console.error(error);
  updateState('app.hasError', true);
  const banner = document.getElementById('global-error');
  if (banner) {
    banner.hidden = false;
    banner.textContent = 'The public shell hit an unexpected error during startup.';
  }
  setStatus('Startup error');
}
