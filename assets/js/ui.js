export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function clearNode(node) {
  if (!node) return;
  node.innerHTML = '';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function setHidden(node, isHidden) {
  if (!node) return;
  node.hidden = Boolean(isHidden);
}

export function setLoadingMessage(message = 'Loading data…') {
  const el = qs('#global-loading');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

export function hideLoadingMessage() {
  const el = qs('#global-loading');
  if (!el) return;
  el.hidden = true;
}

export function showGlobalError(message) {
  const el = qs('#global-banner');
  if (!el) return;
  el.className = 'global-banner global-banner--error';
  el.textContent = message;
  el.hidden = false;
}

export function clearGlobalError() {
  const el = qs('#global-banner');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
  el.className = 'global-banner';
}

export function renderEmptyState(target, title = 'Nothing here yet', text = 'Content will appear once data is available.') {
  if (!target) return;
  target.innerHTML = `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

export function renderErrorState(target, title = 'Something went wrong', text = 'Please try again later.') {
  if (!target) return;
  target.innerHTML = `<div class="error-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`;
}

export function renderSectionHeader(title, subtitle = '') {
  return `
    <div class="section-title">
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="section-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>
  `;
}

export function renderBadge(text, accent = false) {
  return `<span class="badge ${accent ? 'badge--accent' : ''}">${escapeHtml(text)}</span>`;
}

export function updatePageHeading(title, meta = '') {
  const titleEl = qs('#page-title');
  const metaEl = qs('#page-meta');
  if (titleEl) titleEl.textContent = title;
  if (metaEl) metaEl.textContent = meta;
}
