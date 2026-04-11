import { sectionFrame, emptyState, selectControl } from '../ui.js';
import { formatDateTime, formatEvent, formatMode, titleizeSlug, slugify } from '../formatters.js';
import { teamLogoCandidates, teamLogoPath } from '../asset-paths.js';

function mapsForMatch(matchId, maps) {
  return maps.filter(map => map.matchId === matchId).sort((a, b) => (a.mapNum || 0) - (b.mapNum || 0));
}

function withSeriesScore(match, maps) {
  if (match.seriesScore1 !== undefined && match.seriesScore2 !== undefined) return match;
  const score1 = maps.filter(m => m.winner === match.team1Id).length;
  const score2 = maps.filter(m => m.winner === match.team2Id).length;
  return { ...match, seriesScore1: score1 || undefined, seriesScore2: score2 || undefined };
}

function collectTeams(matches) {
  return [...new Set(matches.flatMap(match => [match.team1Id, match.team2Id]).filter(Boolean))].sort();
}

function resultLabel(match) {
  if (match.seriesScore1 === undefined || match.seriesScore2 === undefined) return 'Scheduled';
  return match.seriesScore1 > match.seriesScore2 ? `${titleizeSlug(match.team1Id)} won` : `${titleizeSlug(match.team2Id)} won`;
}

function recentSummary(matches) {
  const completed = matches.filter(match => match.seriesScore1 !== undefined && match.seriesScore2 !== undefined);
  return {
    total: matches.length,
    completed: completed.length,
    sweeps: completed.filter(match => Math.max(match.seriesScore1, match.seriesScore2) === 3 && Math.min(match.seriesScore1, match.seriesScore2) === 0).length,
    map5: completed.filter(match => match.format === 'BO5' && match.seriesScore1 === 3 && match.seriesScore2 === 2 || match.seriesScore1 === 2 && match.seriesScore2 === 3).length
  };
}

function teamRecord(teamId, matches) {
  let wins = 0;
  let losses = 0;
  matches.forEach(match => {
    if (![match.team1Id, match.team2Id].includes(teamId)) return;
    if (match.seriesScore1 === undefined || match.seriesScore2 === undefined) return;
    const won = (match.team1Id === teamId && match.seriesScore1 > match.seriesScore2) || (match.team2Id === teamId && match.seriesScore2 > match.seriesScore1);
    if (won) wins += 1; else losses += 1;
  });
  return `${wins}-${losses}`;
}

export function renderMatches(container, state) {
  const allMatches = [...(state.data.matches || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const maps = state.data.maps || [];
  const enriched = allMatches.map(match => {
    const matchMaps = mapsForMatch(match.id, maps);
    return { ...withSeriesScore(match, matchMaps), maps: matchMaps };
  });

  const teams = collectTeams(enriched);
  const events = [...new Set(enriched.map(match => match.eventId).filter(Boolean))].sort();
  const selectedTeam = teams.includes(state.currentMatchesTeamFilter) ? state.currentMatchesTeamFilter : 'all';
  const selectedEvent = events.includes(state.currentMatchesEventFilter) ? state.currentMatchesEventFilter : 'all';
  const selectedStatus = ['all', 'completed', 'scheduled'].includes(state.currentMatchesStatusFilter) ? state.currentMatchesStatusFilter : 'all';
  const search = (state.currentMatchesSearch || '').trim().toLowerCase();

  let matches = enriched.filter(match => {
    if (selectedTeam !== 'all' && ![match.team1Id, match.team2Id].includes(selectedTeam)) return false;
    if (selectedEvent !== 'all' && match.eventId !== selectedEvent) return false;
    if (selectedStatus === 'completed' && (match.seriesScore1 === undefined || match.seriesScore2 === undefined)) return false;
    if (selectedStatus === 'scheduled' && (match.seriesScore1 !== undefined && match.seriesScore2 !== undefined)) return false;
    if (search) {
      const haystack = [titleizeSlug(match.team1Id), titleizeSlug(match.team2Id), formatEvent(match.eventId), match.date, match.time].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const summary = recentSummary(matches);
  matches = matches.slice(0, 40);

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel hero-card"><div class="panel-body">
        ${sectionFrame('Matches', 'Recent series with filters, event grouping, and map-by-map breakdowns from your public data layer', `
          <div class="filters-row compact toolbar-wrap">
            <input id="matches-search" class="search-input" type="search" placeholder="Search team, event, or date" value="${state.currentMatchesSearch || ''}" />
            ${selectControl('matches-team-filter', [{ value: 'all', label: 'All Teams' }, ...teams.map(teamId => ({ value: teamId, label: titleizeSlug(teamId) }))], selectedTeam)}
            ${selectControl('matches-event-filter', [{ value: 'all', label: 'All Events' }, ...events.map(eventId => ({ value: eventId, label: formatEvent(eventId) }))], selectedEvent)}
            ${selectControl('matches-status-filter', [
              { value: 'all', label: 'All Matches' },
              { value: 'completed', label: 'Completed' },
              { value: 'scheduled', label: 'Scheduled' }
            ], selectedStatus)}
          </div>
        `)}
        <div class="grid-4 compact-stats" style="margin-top:18px">
          <div class="stat-card compact"><div class="stat-label">Shown</div><div class="stat-value">${summary.total}</div><div class="stat-subvalue">After filters</div></div>
          <div class="stat-card compact"><div class="stat-label">Completed</div><div class="stat-value">${summary.completed}</div><div class="stat-subvalue">Final scores available</div></div>
          <div class="stat-card compact"><div class="stat-label">Sweeps</div><div class="stat-value">${summary.sweeps}</div><div class="stat-subvalue">3-0 results</div></div>
          <div class="stat-card compact"><div class="stat-label">Map 5s</div><div class="stat-value">${summary.map5}</div><div class="stat-subvalue">BO5 thrillers</div></div>
        </div>
      </div></div>

      <div class="card-list">
        ${matches.length ? matches.map(match => {
          const team1Win = match.seriesScore1 !== undefined && match.seriesScore2 !== undefined && match.seriesScore1 > match.seriesScore2;
          const team2Win = match.seriesScore1 !== undefined && match.seriesScore2 !== undefined && match.seriesScore2 > match.seriesScore1;
          const t1Fallbacks = teamLogoCandidates(match.team1Id).slice(1).join(',');
          const t2Fallbacks = teamLogoCandidates(match.team2Id).slice(1).join(',');
          return `
            <details class="match-card elevated">
              <summary>
                <div class="match-top">
                  <div>
                    <div class="eyebrow">${formatEvent(match.eventId)} • ${formatDateTime(match.date, match.time)}</div>
                    <div class="match-teams">
                      <div class="team-line ${team1Win ? 'winner-line' : ''}">
                        <div class="team-line-main">
                          <img class="team-logo-sm" src="${teamLogoPath(match.team1Id)}" data-fallbacks="${t1Fallbacks}" alt="${titleizeSlug(match.team1Id)} logo" />
                          <span>${titleizeSlug(match.team1Id)}</span>
                        </div>
                        <span class="score-pill ${team1Win ? 'win' : ''}">${match.seriesScore1 ?? '—'}</span>
                      </div>
                      <div class="team-line ${team2Win ? 'winner-line' : ''}">
                        <div class="team-line-main">
                          <img class="team-logo-sm" src="${teamLogoPath(match.team2Id)}" data-fallbacks="${t2Fallbacks}" alt="${titleizeSlug(match.team2Id)} logo" />
                          <span>${titleizeSlug(match.team2Id)}</span>
                        </div>
                        <span class="score-pill ${team2Win ? 'win' : ''}">${match.seriesScore2 ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div class="match-side-meta">
                    <span class="pill accent">${match.format}</span>
                    <span class="pill">${resultLabel(match)}</span>
                  </div>
                </div>
              </summary>
              <div class="details-stack">
                <div class="grid-3 compact-stats">
                  <div class="stat-card compact"><div class="stat-label">Series result</div><div class="stat-value smallish">${resultLabel(match)}</div><div class="stat-subvalue">${titleizeSlug(match.team1Id)} record: ${teamRecord(match.team1Id, enriched)}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Maps played</div><div class="stat-value">${match.maps.length || '—'}</div><div class="stat-subvalue">${match.maps.length ? 'Detailed below' : 'No map rows yet'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Teams</div><div class="stat-value smallish">${titleizeSlug(match.team1Id)} vs ${titleizeSlug(match.team2Id)}</div><div class="stat-subvalue">${formatEvent(match.eventId)}</div></div>
                </div>
                ${match.maps.length ? `
                  <div class="table-wrap">
                    <table>
                      <thead><tr><th>Map</th><th>Mode</th><th>Name</th><th>Score</th><th>Winner</th></tr></thead>
                      <tbody>
                        ${match.maps.map(map => `
                          <tr>
                            <td>${map.mapNum}</td>
                            <td>${formatMode(map.mode)}</td>
                            <td>${map.mapName}</td>
                            <td>${map.score1}-${map.score2}</td>
                            <td>${titleizeSlug(map.winner)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : emptyState('Map details are not available for this match yet.')}
              </div>
            </details>
          `;
        }).join('') : emptyState('No matches matched these filters yet.')}
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#matches-search');
  const teamSelect = container.querySelector('#matches-team-filter');
  const eventSelect = container.querySelector('#matches-event-filter');
  const statusSelect = container.querySelector('#matches-status-filter');

  if (searchInput) searchInput.addEventListener('input', () => {
    state.currentMatchesSearch = searchInput.value;
    renderMatches(container, state);
  });
  if (teamSelect) teamSelect.addEventListener('change', () => {
    state.currentMatchesTeamFilter = teamSelect.value;
    renderMatches(container, state);
  });
  if (eventSelect) eventSelect.addEventListener('change', () => {
    state.currentMatchesEventFilter = eventSelect.value;
    renderMatches(container, state);
  });
  if (statusSelect) statusSelect.addEventListener('change', () => {
    state.currentMatchesStatusFilter = statusSelect.value;
    renderMatches(container, state);
  });
}
