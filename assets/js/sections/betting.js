(function () {
  function getState() {
    return (window.ISSState && window.ISSState.getState && window.ISSState.getState()) || {};
  }

  function el(id) {
    return document.getElementById(id);
  }

  function average(nums) {
    const values = (nums || []).filter(n => Number.isFinite(Number(n))).map(Number);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  function getTeamMaps(teamId, maps, matchesById) {
    return (maps || []).filter(map => {
      const match = matchesById[map.matchId];
      return match && (match.team1Id === teamId || match.team2Id === teamId);
    });
  }

  function recentForm(teamId, matches) {
    return (matches || [])
      .filter(m => m.team1Id === teamId || m.team2Id === teamId)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 5);
  }

  function render() {
    const container = el('betting-section');
    if (!container) return;

    const state = getState();
    const matches = state.matches || [];
    const maps = state.maps || [];
    const points = state.points || [];
    const coeffs = state.bprCoefficients || {};
    const teams = state.teams || [];
    const teamIds = [...new Set(matches.flatMap(m => [m.team1Id, m.team2Id]).filter(Boolean))].sort();
    const teamOptions = teamIds.length ? teamIds : teams.map(t => t.id).filter(Boolean);

    const selectedTeam = state.selectedBettingTeam || teamOptions[0] || '';
    const matchesById = Object.fromEntries(matches.map(m => [m.id, m]));
    const teamMaps = getTeamMaps(selectedTeam, maps, matchesById);
    const hp = teamMaps.filter(m => m.mode === 'HP');
    const snd = teamMaps.filter(m => m.mode === 'SND');
    const ol = teamMaps.filter(m => m.mode === 'OL');
    const recent = recentForm(selectedTeam, matches);
    const coeffCards = Object.entries(coeffs).slice(0, 6);

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
          <div class="section-subtitle">Public-facing matchup context, recent form, and model reference values.</div>
        </div>
      </div>

      <div class="hero-card">
        <div class="controls-row">
          <select id="iss-betting-team-select">
            ${teamOptions.map(teamId => `<option value="${teamId}" ${teamId === selectedTeam ? 'selected' : ''}>${teamId.toUpperCase()}</option>`).join('')}
          </select>
          <div class="pill">Selected Team: ${selectedTeam ? selectedTeam.toUpperCase() : 'N/A'}</div>
          <div class="pill">Recent Series: ${recent.length}</div>
          <div class="pill">Maps Sample: ${teamMaps.length}</div>
        </div>

        <div class="stats-grid">
          <div class="bet-card">
            <div class="helper-text">Hardpoint Average</div>
            <div class="section-title">${average(hp.map(m => Math.max(m.score1 || 0, m.score2 || 0)))?.toFixed(1) ?? '—'}</div>
          </div>
          <div class="bet-card">
            <div class="helper-text">Search Sample</div>
            <div class="section-title">${snd.length || '—'}</div>
          </div>
          <div class="bet-card">
            <div class="helper-text">Overload Sample</div>
            <div class="section-title">${ol.length || '—'}</div>
          </div>
          <div class="bet-card">
            <div class="helper-text">Points Rows</div>
            <div class="section-title">${points.filter(p => p.teamId === selectedTeam).length}</div>
          </div>
        </div>
      </div>

      <div class="bet-grid" style="margin-top:16px;">
        <div class="bet-card">
          <div class="section-header">
            <div>
              <h3 style="margin:0;">Model Coefficients</h3>
              <div class="helper-text">Reference values from public coefficients import.</div>
            </div>
          </div>
          <div class="mode-strip">
            ${coeffCards.length ? coeffCards.map(([key, value]) => `
              <div class="mode-box">
                <div class="helper-text">${key}</div>
                <div class="section-title" style="font-size:1.1rem;">${typeof value === 'number' ? value.toFixed(3) : String(value)}</div>
              </div>
            `).join('') : '<div class="empty-state">No coefficient data found.</div>'}
          </div>
        </div>

        <div class="bet-card">
          <div class="section-header">
            <div>
              <h3 style="margin:0;">Recent Form</h3>
              <div class="helper-text">Latest series involving the selected team.</div>
            </div>
          </div>
          ${recent.length ? `
            <div class="table-shell">
              <table>
                <thead>
                  <tr><th>Date</th><th>Match</th><th>Format</th></tr>
                </thead>
                <tbody>
                  ${recent.map(match => `
                    <tr>
                      <td>${match.date || '—'}</td>
                      <td>${(match.team1Id || '').toUpperCase()} vs ${(match.team2Id || '').toUpperCase()}</td>
                      <td>${match.format || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state">No recent matches for this team yet.</div>'}
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
