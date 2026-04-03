import { getState } from '../state.js';
import { qs, renderSectionHeader, renderEmptyState, renderErrorState, renderBadge } from '../ui.js';
import { buildStandingsFromPoints, getLatestCompletedMatches, getUpcomingMatches } from '../data-loader.js';
import { formatDateTime, formatEventLabel, formatSeriesLabel } from '../formatters.js';
import { initials } from '../asset-paths.js';

function renderFeaturedMatch(match) {
  const team1 = match.team1Id || 'TBD';
  const team2 = match.team2Id || 'TBD';
  const hasScore = Number.isFinite(Number(match.seriesScore1)) && Number.isFinite(Number(match.seriesScore2));
  return `
    <div class="hero-card section-card">
      ${renderSectionHeader('Featured Match', 'Latest result or next scheduled series')}
      <div class="hero-card__scoreline">
        <div class="hero-card__teams">
          <div class="team-cell"><div class="logo-fallback">${initials(team1, 1)}</div><strong>${team1}</strong></div>
          <span class="muted">vs</span>
          <div class="team-cell"><div class="logo-fallback">${initials(team2, 1)}</div><strong>${team2}</strong></div>
        </div>
        <div class="hero-card__score">${hasScore ? `${match.seriesScore1} – ${match.seriesScore2}` : 'Upcoming'}</div>
      </div>
      <div class="hero-card__meta">
        ${renderBadge(formatEventLabel(match.eventId), true)}
        ${renderBadge(formatSeriesLabel(match.format))}
        ${renderBadge(formatDateTime(match.date, match.time))}
      </div>
    </div>
  `;
}

export function renderDashboard() {
  const target = qs('#dashboard-section');
  if (!target) return;
  const { data } = getState();

  try {
    const standings = buildStandingsFromPoints(data.points, data.matches);
    const latestResults = getLatestCompletedMatches(data.matches).slice(0, 5);
    const upcoming = getUpcomingMatches(data.matches).slice(0, 4);
    const featured = latestResults[0] || upcoming[0] || data.matches[0];

    const totalMatches = (data.matches || []).length;
    const totalMaps = (data.maps || []).length;
    const totalPlayers = (data.players || []).length;
    const totalTeams = new Set((data.matches || []).flatMap((m) => [m.team1Id, m.team2Id]).filter(Boolean)).size;

    if (!featured) {
      renderEmptyState(target, 'No match data yet', 'Add your public data files and the dashboard will populate.');
      return;
    }

    target.innerHTML = `
      <div class="stack">
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Teams tracked</div>
            <div class="kpi-value">${totalTeams}</div>
            <div class="kpi-meta">Unique teams found in public match data</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Matches tracked</div>
            <div class="kpi-value">${totalMatches}</div>
            <div class="kpi-meta">Series currently available in the dataset</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Maps tracked</div>
            <div class="kpi-value">${totalMaps}</div>
            <div class="kpi-meta">Map-level results connected to those matches</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Players tracked</div>
            <div class="kpi-value">${totalPlayers}</div>
            <div class="kpi-meta">Public player records available to the site</div>
          </div>
        </div>

        ${renderFeaturedMatch(featured)}

        <div class="grid-2">
          <div class="section-card">
            ${renderSectionHeader('Top teams', 'Quick standings snapshot')}
            <div class="list">
              ${standings.slice(0, 5).map((row, index) => `
                <div class="list-item">
                  <div>
                    <strong>#${index + 1} ${row.teamId}</strong>
                    <div class="muted">${row.wins}-${row.losses} record</div>
                  </div>
                  <div>
                    <strong>${row.points}</strong>
                    <div class="muted">${row.mapDiff >= 0 ? '+' : ''}${row.mapDiff} map diff</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="section-card">
            ${renderSectionHeader('Recent results', 'Latest completed matches')}
            <div class="list">
              ${latestResults.slice(0, 5).map((match) => `
                <div class="list-item">
                  <div>
                    <strong>${match.team1Id} vs ${match.team2Id}</strong>
                    <div class="muted">${formatEventLabel(match.eventId)} • ${formatDateTime(match.date, match.time)}</div>
                  </div>
                  <div><strong>${match.seriesScore1} – ${match.seriesScore2}</strong></div>
                </div>
              `).join('') || '<div class="muted">No completed matches yet.</div>'}
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="section-card">
            ${renderSectionHeader('Upcoming slate', 'Next scheduled matches')}
            <div class="list">
              ${upcoming.map((match) => `
                <div class="list-item">
                  <div>
                    <strong>${match.team1Id} vs ${match.team2Id}</strong>
                    <div class="muted">${formatEventLabel(match.eventId)}</div>
                  </div>
                  <div class="muted">${formatDateTime(match.date, match.time)}</div>
                </div>
              `).join('') || '<div class="muted">No upcoming matches found in current data.</div>'}
            </div>
          </div>

          <div class="section-card">
            ${renderSectionHeader('About this build', 'Public read-only foundation')}
            <div class="stack">
              <div class="inline-stat"><span>Data model</span><strong>Static JSON</strong></div>
              <div class="inline-stat"><span>Deployment target</span><strong>GitHub Pages</strong></div>
              <div class="inline-stat"><span>Current phase</span><strong>Foundation + first live sections</strong></div>
              <div class="inline-stat"><span>Next step</span><strong>Matches, Players, Teams, Betting</strong></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    renderErrorState(target, 'Dashboard failed to render', error.message);
  }
}
