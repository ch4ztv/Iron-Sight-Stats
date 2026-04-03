export function qs(selector, root = document) { return root.querySelector(selector); }
export function qsa(selector, root = document) { return [...root.querySelectorAll(selector)]; }
export function clear(el) { if (el) el.innerHTML = ''; }

export function showMessage(text) {
  const el = qs('#global-message');
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

export function sectionFrame(title, subtitle = '', actions = '') {
  return `
    <div class="panel-header">
      <div>
        <h2 class="section-title">${title}</h2>
        ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
    </div>
  `;
}

export function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

export function statCard(label, value, sublabel = '') {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${sublabel ? `<div class="stat-subvalue">${sublabel}</div>` : ''}
    </div>
  `;
}

export function pill(text, variant = '') {
  return `<span class="pill ${variant}">${text}</span>`;
}

export function selectControl(id, options, selectedValue) {
  return `
    <select id="${id}" class="control">
      ${options.map(option => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${label}</option>`;
      }).join('')}
    </select>
  `;
}

export function wireImageFallbacks(root = document) {
  qsa('img[data-fallbacks]', root).forEach(img => {
    if (img.dataset.boundFallback === 'true') return;
    img.dataset.boundFallback = 'true';
    const candidates = (img.dataset.fallbacks || '').split(',').map(v => v.trim()).filter(Boolean);
    let index = 0;
    img.addEventListener('error', () => {
      const next = candidates[index++];
      if (next) {
        img.src = next;
      } else {
        img.classList.add('is-missing');
        if (img.dataset.missingLabel) {
          const holder = document.createElement('div');
          holder.className = img.dataset.missingClass || 'empty-state compact';
          holder.textContent = img.dataset.missingLabel;
          img.replaceWith(holder);
        } else {
          img.style.visibility = 'hidden';
        }
      }
    });
  });
}
