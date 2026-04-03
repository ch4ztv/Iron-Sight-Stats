import { sectionFrame, emptyState, statCard } from '../ui.js';
import { formatDate, formatEvent, titleizeSlug, formatSignedNumber } from '../formatters.js';
import { teamLogoCandidates, teamLogoPath } from '../asset-paths.js';

function recentMatches(matches) {
  return [...matches].filter(m => m.seriesScore1 !== undefined || m.seriesScore2 !== undefined).sort((a,b) => (b.ts||0)-(a.ts||0)).slice(0,5);
}

function aggregatePoints(rows) {
  const totals = new Map();
  rows.forEach(row => {
    const teamId = row.teamId || row.id || row.team;
    if (!teamId) return;
    totals.set(teamId, (totals.get(teamId) || 0) + (Number(row.pts ?? row.points ?? row.cdlPoints ?? 0) || 0));
  });
  return [...totals.entries()].sort((a,b) => b[1]-a[1]).slice(0,4).map(([teamId, points]) => ({ teamId, points }));
}

function mapDiff(matches, maps, teamId) {
  let wins=0, losses=0;
  maps.forEach(map => {
    const match = matches.find(entry => entry.id === map.matchId);
    if (!match || (match.team1Id !== teamId && match.team2Id !== teamId)) return;
    if (map.winner === teamId) wins += 1; else losses += 1;
  });
  return wins-losses;
}

export function renderDashboard(container, state) {
  const { matches = [], points = [], meta = null, maps = [] } = state.data;
  const completed = matches.filter(m => m.seriesScore1 !== undefined || m.seriesScore2 !== undefined);
  const liveCounts = {
    totalMatches: matches.length,
    completedMatches: completed.length,
    totalTeams: new Set(matches.flatMap(m => [m.team1Id, m.team2Id])).size,
    events: new Set(matches.map(m => m.eventId)).size
  };
  const topTeams = aggregatePoints(points);
  const recent = recentMatches(matches);

  container.innerHTML = `
    <div class="section-stack">
      <section class="hero">
        <div class="eyebrow">${meta?.app || 'Iron Sight Stats'} • ${meta?.version || 'Public Build'}</div>
        <h2>CDL stats, standings, match history, and team snapshots in one clean public build.</h2>
        <p>This version is focused on public viewing only: fast reads, polished presentation, and room to scale into the full stats platform.</p>
      </section>

      <section class="grid-4">
        ${statCard('Matches Loaded', liveCounts.totalMatches)}
        ${statCard('Completed Matches', liveCounts.completedMatches)}
        ${statCard('Teams Seen', liveCounts.totalTeams)}
        ${statCard('Events Loaded', liveCounts.events)}
      </section>

      <section class="grid-2">
        <div class="panel"><div class="panel-body">
          ${sectionFrame('Recent Results', 'Latest completed series in the dataset')}
          <div class="card-list">
            ${recent.length ? recent.map(match => `
              <article class="match-card elevated">
                <div class="match-top">
                  <div>
                    <div class="eyebrow">${formatEvent(match.eventId)}</div>
                    <strong>${formatDate(match.date)}</strong>
                  </div>
                  <span class="pill">${match.format}</span>
                </div>
                <div class="match-teams" style="margin-top:14px">
                  <div class="team-line">
                    <div class="team-line-main"><img class="team-logo-sm" src="${teamLogoPath(match.team1Id)}" alt="" data-fallbacks="${teamLogoCandidates(match.team1Id).slice(1).join(',')}" /><span>${titleizeSlug(match.team1Id)}</span></div>
                    <strong>${match.seriesScore1 ?? '—'}</strong>
                  </div>
                  <div class="team-line">
                    <div class="team-line-main"><img class="team-logo-sm" src="${teamLogoPath(match.team2Id)}" alt="" data-fallbacks="${teamLogoCandidates(match.team2Id).slice(1).join(',')}" /><span>${titleizeSlug(match.team2Id)}</span></div>
                    <strong>${match.seriesScore2 ?? '—'}</strong>
                  </div>
                </div>
              </article>
            `).join('') : emptyState('No completed matches available yet.')}
          </div>
        </div></div>

        <div class="panel"><div class="panel-body">
          ${sectionFrame('Top Standings Snapshot', 'Quick public power ranking from total points and map differential')}
          <div class="card-list">
            ${topTeams.length ? topTeams.map((team, index) => `
              <article class="team-card elevated">
                <div class="team-line">
                  <div class="team-line-main">
                    <span class="pill accent">#${index + 1}</span>
                    <img class="team-logo-sm" src="${teamLogoPath(team.teamId)}" alt="" data-fallbacks="${teamLogoCandidates(team.teamId).slice(1).join(',')}" />
                    <strong>${titleizeSlug(team.teamId)}</strong>
                  </div>
                  <span class="muted">${team.points} pts • ${formatSignedNumber(mapDiff(matches, maps, team.teamId))} maps</span>
                </div>
              </article>
            `).join('') : emptyState('Standings data will appear here once points are available.')}
          </div>
        </div></div>
      </section>
    </div>
  `;
}
