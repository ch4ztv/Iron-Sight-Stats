(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function getState() {
    return (window.ISSState && window.ISSState.getState && window.ISSState.getState()) || {};
  }

  function getTeamIds(matches, teams) {
    const ids = [...new Set((matches || []).flatMap(m => [m.team1Id, m.team2Id]).filter(Boolean))];
    if (ids.length) return ids.sort();
    return (teams || []).map(t => t.id).filter(Boolean).sort();
  }

  function recordForTeam(teamId, matches) {
    let wins = 0;
    let losses = 0;
    (matches || []).forEach(match => {
      const inMatch = match.team1Id === teamId || match.team2Id === teamId;
      if (!inMatch) return;
      if (match.seriesScore1 == null || match.seriesScore2 == null) return;

      const won = match.team1Id === teamId
        ? Number(match.seriesScore1) > Number(match.seriesScore2)
        : Number(match.seriesScore2) > Number(match.seriesScore1);

      if (won) wins += 1;
      else losses += 1;
    });
    return { wins, losses };
  }

  function mapsForTeam(teamId, matches, maps) {
    const byId = Object.fromEntries((matches || []).map(m => [m.id, m]));
    return (maps || []).filter(map => {
      const match = byId[map.matchId];
      return match && (match.team1Id === teamId || match.team2Id === teamId);
    });
  }

  function winRate(teamId, matches) {
    const rec = recordForTeam(teamId, matches);
    const total = rec.wins + rec.losses;
    return total ? ((rec.wins / total) * 100).toFixed(1) + '%' : '—';
  }

  function render() {
    const container = el('matchup-section');
    if (!container) return;

    const state = getState();
    const matches = state.matches || [];
    const maps = state.maps || [];
    const teams = state.teams || [];
    const ids = getTeamIds(matches, teams);
    const teamA = state.matchupTeamA || ids[0] || '';
    const teamB = state.matchupTeamB || ids[1] || ids[0] || '';

    const teamARec = recordForTeam(teamA, matches);
    const teamBRec = recordForTeam(teamB, matches);
    const teamAMaps = mapsForTeam(teamA, matches, maps);
    const teamBMaps = mapsForTeam(teamB, matches, maps);

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2>Matchup</h2>
          <div class="section-subtitle">Quick compare shell for public team-vs-team context.</div>
        </div>
      </div>

      <div class="hero-card">
        <div class="controls-row">
          <select id="iss-matchup-team-a">
            ${ids.map(id => `<option value="${id}" ${id === teamA ? 'selected' : ''}>${id.toUpperCase()}</option>`).join('')}
          </select>
          <select id="iss-matchup-team-b">
            ${ids.map(id => `<option value="${id}" ${id === teamB ? 'selected' : ''}>${id.toUpperCase()}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="compare-grid" style="margin-top:16px;">
        <div class="compare-card">
          <div class="compare-row">
            <div>
              <div class="helper-text">Team A</div>
              <div class="section-title">${teamA ? teamA.toUpperCase() : '—'}</div>
            </div>
            <div class="compare-center">vs</div>
            <div>
              <div class="helper-text">Team B</div>
              <div class="section-title">${teamB ? teamB.toUpperCase() : '—'}</div>
            </div>
          </div>
        </div>

        <div class="compare-card">
          <div class="table-shell">
            <table>
              <thead>
                <tr><th>Metric</th><th>${teamA.toUpperCase()}</th><th>${teamB.toUpperCase()}</th></tr>
              </thead>
              <tbody>
                <tr><td>Series Record</td><td>${teamARec.wins}-${teamARec.losses}</td><td>${teamBRec.wins}-${teamBRec.losses}</td></tr>
                <tr><td>Series Win Rate</td><td>${winRate(teamA, matches)}</td><td>${winRate(teamB, matches)}</td></tr>
                <tr><td>Maps Sample</td><td>${teamAMaps.length}</td><td>${teamBMaps.length}</td></tr>
                <tr><td>HP Sample</td><td>${teamAMaps.filter(m => m.mode === 'HP').length}</td><td>${teamBMaps.filter(m => m.mode === 'HP').length}</td></tr>
                <tr><td>SND Sample</td><td>${teamAMaps.filter(m => m.mode === 'SND').length}</td><td>${teamBMaps.filter(m => m.mode === 'SND').length}</td></tr>
                <tr><td>OL Sample</td><td>${teamAMaps.filter(m => m.mode === 'OL').length}</td><td>${teamBMaps.filter(m => m.mode === 'OL').length}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const update = (patch) => {
      if (window.ISSState && window.ISSState.setState) {
        window.ISSState.setState(patch);
      }
      render();
    };

    const a = el('iss-matchup-team-a');
    const b = el('iss-matchup-team-b');
    if (a) a.addEventListener('change', e => update({ matchupTeamA: e.target.value }));
    if (b) b.addEventListener('change', e => update({ matchupTeamB: e.target.value }));
  }

  window.ISSSections = window.ISSSections || {};
  window.ISSSections.matchup = { render };
})();
