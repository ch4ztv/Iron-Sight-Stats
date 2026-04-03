import { sectionFrame, emptyState } from '../ui.js';
import { formatDate, formatEvent, titleizeSlug } from '../formatters.js';
import { teamLogoPath } from '../asset-paths.js';

function recentMatches(matches) {
  return [...matches].filter(m => m.seriesScore1 !== undefined && m.seriesScore2 !== undefined).sort((a,b) => (b.ts||0)-(a.ts||0)).slice(0,5);
}

export function renderDashboard(container, state) {
  const { matches = [], points = [], meta = null } = state.data;
  const completed = matches.filter(m => m.seriesScore1 !== undefined && m.seriesScore2 !== undefined);
  const liveCounts = {
    totalMatches: matches.length,
    completedMatches: completed.length,
    totalTeams: new Set(matches.flatMap(m => [m.team1Id, m.team2Id])).size,
    events: new Set(matches.map(m => m.eventId)).size
  };
  const topTeams = [...points].slice(0, 4);
  const recent = recentMatches(matches);

  container.innerHTML = `
    <div class="section-stack">
      <section class="hero">
        <div class="eyebrow">${meta?.app || 'Iron Sight Stats'} • ${meta?.version || 'Public Build'}</div>
        <h2>CDL stats, standings, match history, and team snapshots in one clean public build.</h2>
        <p>This version is focused on public viewing only: fast reads, polished presentation, and room to scale into the full stats platform.</p>
      </section>

      <section class="grid-4">
        <div class="stat-card"><div class="stat-label">Matches Loaded</div><div class="stat-value">${liveCounts.totalMatches}</div></div>
        <div class="stat-card"><div class="stat-label">Completed Matches</div><div class="stat-value">${liveCounts.completedMatches}</div></div>
        <div class="stat-card"><div class="stat-label">Teams Seen</div><div class="stat-value">${liveCounts.totalTeams}</div></div>
        <div class="stat-card"><div class="stat-label">Events Loaded</div><div class="stat-value">${liveCounts.events}</div></div>
      </section>

      <section class="grid-2">
        <div class="panel"><div class="panel-body">
          ${sectionFrame('Recent Results', 'Latest completed series in the dataset')}
          <div class="card-list">
            ${recent.length ? recent.map(match => `
              <article class="match-card">
                <div class="match-top">
                  <div>
                    <div class="eyebrow">${formatEvent(match.eventId)}</div>
                    <strong>${formatDate(match.date)}</strong>
                  </div>
                  <span class="pill">${match.format}</span>
                </div>
                <div class="match-teams" style="margin-top:14px">
                  <div class="team-line">
                    <div class="team-line-main"><img class="team-logo-sm" src="${teamLogoPath(match.team1Id)}" alt="" onerror="this.style.visibility='hidden'" /><span>${titleizeSlug(match.team1Id)}</span></div>
                    <strong>${match.seriesScore1 ?? '—'}</strong>
                  </div>
                  <div class="team-line">
                    <div class="team-line-main"><img class="team-logo-sm" src="${teamLogoPath(match.team2Id)}" alt="" onerror="this.style.visibility='hidden'" /><span>${titleizeSlug(match.team2Id)}</span></div>
                    <strong>${match.seriesScore2 ?? '—'}</strong>
                  </div>
                </div>
              </article>
            `).join('') : emptyState('No completed matches available yet.')}
          </div>
        </div></div>

        <div class="panel"><div class="panel-body">
          ${sectionFrame('Top Standings Snapshot', 'Quick read from the points file')}
          <div class="card-list">
            ${topTeams.length ? topTeams.map((team, index) => `
              <article class="team-card">
                <div class="team-line">
                  <div class="team-line-main">
                    <span class="pill">#${index + 1}</span>
                    <img class="team-logo-sm" src="${teamLogoPath(team.teamId || team.id || team.team)}" alt="" onerror="this.style.visibility='hidden'" />
                    <strong>${titleizeSlug(team.teamId || team.id || team.team)}</strong>
                  </div>
                  <span class="muted">${team.points ?? team.cdlPoints ?? '—'} pts</span>
                </div>
              </article>
            `).join('') : emptyState('Standings data will appear here once points are available.')}
          </div>
        </div></div>
      </section>
    </div>
  `;
}
