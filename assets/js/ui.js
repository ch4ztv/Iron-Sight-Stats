(function (window) {
  'use strict';

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function clearElement(element) {
    if (!element) return;
    element.innerHTML = '';
  }

  function createElement(tag, options) {
    const el = document.createElement(tag);
    const opts = options || {};

    if (opts.className) el.className = opts.className;
    if (opts.text) el.textContent = opts.text;
    if (opts.html) el.innerHTML = opts.html;

    if (opts.attributes && typeof opts.attributes === 'object') {
      Object.entries(opts.attributes).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          el.setAttribute(key, String(value));
        }
      });
    }

    if (Array.isArray(opts.children)) {
      opts.children.forEach((child) => {
        if (child) el.appendChild(child);
      });
    }

    return el;
  }

  function createSectionScaffold(title, description) {
    const wrapper = createElement('div', { className: 'section-shell' });
    const header = createElement('div', { className: 'section-heading' });
    header.appendChild(createElement('h2', { text: title }));
    if (description) {
      header.appendChild(createElement('p', { text: description }));
    }

    const body = createElement('div', { className: 'section-body card surface-soft' });
    wrapper.appendChild(header);
    wrapper.appendChild(body);

    return { wrapper, body, header };
  }

  function createStatGrid(stats) {
    const grid = createElement('div', { className: 'stats-grid' });
    (stats || []).forEach((item) => {
      const card = createElement('div', { className: 'stat-card card' });
      card.appendChild(createElement('div', { className: 'stat-label', text: item.label || 'Metric' }));
      card.appendChild(createElement('div', { className: 'stat-value', text: item.value || '—' }));
      if (item.helper) {
        card.appendChild(createElement('div', { className: 'stat-helper', text: item.helper }));
      }
      grid.appendChild(card);
    });
    return grid;
  }

  function createList(items, formatter) {
    const list = createElement('div', { className: 'stack-list' });
    (items || []).forEach((item, index) => {
      const row = formatter ? formatter(item, index) : createElement('div', { className: 'list-row', text: String(item) });
      list.appendChild(row);
    });
    return list;
  }

  function createNotice(message, variant) {
    return createElement('div', {
      className: 'notice-block' + (variant ? ' ' + variant : ''),
      text: message || 'No additional information available.'
    });
  }

  function createEmptyState(title, description) {
    const wrap = createElement('div', { className: 'empty-state card surface-soft' });
    wrap.appendChild(createElement('h3', { text: title || 'Nothing here yet' }));
    if (description) {
      wrap.appendChild(createElement('p', { text: description }));
    }
    return wrap;
  }

  function setStatusMessage(message, variant) {
    const node = qs('[data-role="app-status"]');
    if (!node) return;
    node.textContent = message || '';
    node.setAttribute('data-variant', variant || 'default');
  }

  function renderSectionMount(sectionId, node) {
    const mount = qs('[data-section="' + sectionId + '"]');
    if (!mount) return;
    clearElement(mount);
    if (node) {
      mount.appendChild(node);
    }
  }

  window.ISSUI = {
    qs,
    qsa,
    clearElement,
    createElement,
    createSectionScaffold,
    createStatGrid,
    createList,
    createNotice,
    createEmptyState,
    setStatusMessage,
    renderSectionMount
  };
})(window);
