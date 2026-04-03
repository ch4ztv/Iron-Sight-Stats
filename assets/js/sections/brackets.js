(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function getState() {
    return (window.ISSState && window.ISSState.getState && window.ISSState.getState()) || {};
  }

  const BRACKETS = [
    { id: 'major-1', label: 'Major 1', file: './brackets/major-1.html' },
    { id: 'major-2', label: 'Major 2', file: './brackets/major-2.html' }
  ];

  function render() {
    const container = el('brackets-section');
    if (!container) return;

    const state = getState();
    const selected = state.selectedBracket || BRACKETS[0].id;
    const active = BRACKETS.find(b => b.id === selected) || BRACKETS[0];
    const bracketData = state.bracketData || {};

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2>Brackets</h2>
          <div class="section-subtitle">Event bracket viewing with embed preview and quick open links.</div>
        </div>
      </div>

      <div class="hero-card">
        <div class="controls-row">
          <select id="iss-bracket-select">
            ${BRACKETS.map(b => `<option value="${b.id}" ${b.id === active.id ? 'selected' : ''}>${b.label}</option>`).join('')}
          </select>
          <a class="pill" href="${active.file}" target="_blank" rel="noopener noreferrer">Open ${active.label}</a>
        </div>
      </div>

      <div class="bracket-grid" style="margin-top:16px;">
        <div class="bracket-card">
          <div class="section-header">
            <div>
              <h3 style="margin:0;">${active.label} Preview</h3>
              <div class="helper-text">Embedded bracket file served from the public repo.</div>
            </div>
          </div>
          <div class="embed-shell">
            <iframe src="${active.file}" title="${active.label} bracket"></iframe>
          </div>
        </div>

        <div class="bracket-card">
          <div class="section-header">
            <div>
              <h3 style="margin:0;">Bracket Data Summary</h3>
              <div class="helper-text">Imported summary from bracket-data.json when available.</div>
            </div>
          </div>
          <pre style="white-space:pre-wrap; word-break:break-word; margin:0; color:rgba(255,255,255,.8);">${JSON.stringify(bracketData[active.id] || bracketData[active.label] || {}, null, 2)}</pre>
        </div>
      </div>
    `;

    const select = el('iss-bracket-select');
    if (select) {
      select.addEventListener('change', (event) => {
        if (window.ISSState && window.ISSState.setState) {
          window.ISSState.setState({ selectedBracket: event.target.value });
        }
        render();
      });
    }
  }

  window.ISSSections = window.ISSSections || {};
  window.ISSSections.brackets = { render };
})();
