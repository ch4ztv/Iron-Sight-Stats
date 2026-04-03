import { sectionFrame, emptyState } from '../ui.js';
import { formatDate, formatEvent, formatMode, titleizeSlug } from '../formatters.js';
import { teamLogoPath } from '../asset-paths.js';

function mapsForMatch(matchId, maps) {
  return maps.filter(map => map.matchId === matchId).sort((a,b) => (a.mapNum || 0) - (b.mapNum || 0));
}

function withSeriesScore(match, maps) {
  if (match.seriesScore1 !== undefined && match.seriesScore2 !== undefined) return match;
  const score1 = maps.filter(m => m.winner === match.team1Id).length;
  const score2 = maps.filter(m => m.winner === match.team2Id).length;
  return { ...match, seriesScore1: score1 || undefined, seriesScore2: score2 || undefined };
}

export function renderMatches(container, state) {
  const allMatches = [...(state.data.matches || [])].sort((a,b) => (b.ts||0) - (a.ts||0));
  const maps = state.data.maps || [];
  const matches = allMatches.slice(0, 30).map(match => ({ ...withSeriesScore(match, mapsForMatch(match.id, maps)), maps: mapsForMatch(match.id, maps) }));

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel"><div class="panel-body">
        ${sectionFrame('Matches', 'Recent series with map-by-map detail pulled from matches.json and maps.json')}
        <div class="card-list">
          ${matches.length ? matches.map(match => `
            <details class="match-card">
              <summary>
                <div class="match-top">
                  <div>
                    <div class="eyebrow">${formatEvent(match.eventId)} • ${formatDate(match.date)} • ${match.time || 'TBD'}</div>
                    <div class="match-teams" style="margin-top:12px">
                      <div class="team-line">
                        <div class="team-line-main"><img class="team-logo-sm" src="${teamLogoPath(match.team1Id)}" alt="" onerror="this.style.visibility='hidden'" /><span>${titleizeSlug(match.team1Id)}</span></div>
                        <span class="score-pill ${match.seriesScore1 > match.seriesScore2 ? 'win' : ''}">${match.seriesScore1 ?? '—'}</span>
                      </div>
                      <div class="team-line">
                        <div class="team-line-main"><img class="team-logo-sm" src="${teamLogoPath(match.team2Id)}" alt="" onerror="this.style.visibility='hidden'" /><span>${titleizeSlug(match.team2Id)}</span></div>
                        <span class="score-pill ${match.seriesScore2 > match.seriesScore1 ? 'win' : ''}">${match.seriesScore2 ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <span class="pill">${match.format}</span>
                </div>
              </summary>
              <div style="margin-top:16px">
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
          `).join('') : emptyState('No matches found.')}
        </div>
      </div></div>
    </div>
  `;
}
