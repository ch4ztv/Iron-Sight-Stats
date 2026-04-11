(function () {
  function getState() {
    return (window.ISSState && window.ISSState.getState && window.ISSState.getState()) || {};
  }

  function el(id) {
    return document.getElementById(id);
  }

  function average(nums) {
    const values = (nums || []).filter(value => Number.isFinite(Number(value))).map(Number);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function render() {
    const container = el('betting-section');
    if (!container) return;

    const state = getState();
    const isrConfig = state.isrConfig || state.isr || {};
    const teamIds = Object.keys((state.teamPoints || state.data?.teamPoints || {}));
    const selectedTeam = state.selectedBettingTeam || teamIds[0] || '';
    const weights = Object.entries(isrConfig.weights || {});

    const setTeam = (value) => {
      if (window.ISSState && window.ISSState.setState) {
        window.ISSState.setState({ selectedBettingTeam: value });
      }
      render();
    };

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2>Betting Lab</h2>
          <div class="section-subtitle">ISR-weight reference values and a lightweight team selector.</div>
        </div>
      </div>

      <div class="hero-card">
        <div class="controls-row">
          <select id="iss-betting-team-select">
            ${teamIds.map(teamId => `<option value="${teamId}" ${teamId === selectedTeam ? 'selected' : ''}>${teamId.toUpperCase()}</option>`).join('')}
          </select>
          <div class="pill">Selected Team: ${selectedTeam ? selectedTeam.toUpperCase() : 'N/A'}</div>
          <div class="pill">Weight Count: ${weights.length}</div>
          <div class="pill">Sample Threshold: ${isrConfig.samplePenaltyThreshold ?? '-'}</div>
        </div>

        <div class="stats-grid">
          <div class="bet-card">
            <div class="helper-text">Average Weight</div>
            <div class="section-title">${average(weights.map(([, value]) => value))?.toFixed(2) ?? '-'}</div>
          </div>
          <div class="bet-card">
            <div class="helper-text">Max Rating</div>
            <div class="section-title">${isrConfig.maxRating ?? '-'}</div>
          </div>
        </div>
      </div>

      <div class="bet-grid" style="margin-top:16px;">
        <div class="bet-card">
          <div class="section-header">
            <div>
              <h3 style="margin:0;">ISR weights</h3>
              <div class="helper-text">Public configuration snapshot from the modular app.</div>
            </div>
          </div>
          <div class="mode-strip">
            ${weights.length ? weights.map(([key, value]) => `
              <div class="mode-box">
                <div class="helper-text">${key}</div>
                <div class="section-title" style="font-size:1.1rem;">${typeof value === 'number' ? value.toFixed(2) : String(value)}</div>
              </div>
            `).join('') : '<div class="empty-state">No ISR config data found.</div>'}
          </div>
        </div>
      </div>
    `;

    const select = el('iss-betting-team-select');
    if (select) {
      select.addEventListener('change', (event) => setTeam(event.target.value));
    }
  }

  window.ISSSections = window.ISSSections || {};
  window.ISSSections.betting = { render };
})();
