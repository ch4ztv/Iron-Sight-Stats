export function qs(selector, root = document) { return root.querySelector(selector); }
export function qsa(selector, root = document) { return [...root.querySelectorAll(selector)]; }
export function clear(el) { if (el) el.innerHTML = ''; }
export function showMessage(text) {
  const el = qs('#global-message');
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}
export function sectionFrame(title, subtitle = '') {
  return `
    <div class="panel-header">
      <div>
        <h2 class="section-title">${title}</h2>
        ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}
      </div>
    </div>
  `;
}
export function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}
