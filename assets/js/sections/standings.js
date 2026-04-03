import { sectionFrame, emptyState } from '../ui.js';
import { titleizeSlug } from '../formatters.js';
import { teamLogoPath } from '../asset-paths.js';

function normalizePointsRow(row) {
  const teamId = row.teamId || row.id || row.team;
  return {
    teamId,
    points: row.points ?? row.cdlPoints ?? row.totalPoints ?? 0,
    matchWins: row.matchWins ?? row.wins ?? row.seriesWins ?? 0,
    matchLosses: row.matchLosses ?? row.losses ?? row.seriesLosses ?? 0,
    mapWins: row.mapWins ?? row.gameWins ?? 0,
    mapLosses: row.mapLosses ?? row.gameLosses ?? 0,
    mapDiff: row.mapDiff ?? ((row.mapWins ?? 0) - (row.mapLosses ?? 0))
  };
}

export function renderStandings(container, state) {
  const rows = (state.data.points || []).map(normalizePointsRow).sort((a,b) => (b.points - a.points) || (b.mapDiff - a.mapDiff));
  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Standings', 'Public-facing league table built from the points dataset')}
      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Rank</th><th>Team</th><th>Points</th><th>Match Record</th><th>Map Record</th><th>Map Diff</th></tr>
            </thead>
            <tbody>
              ${rows.map((row, i) => `
                <tr>
                  <td>#${i + 1}</td>
                  <td>
                    <div class="team-line-main">
                      <img class="team-logo-sm" src="${teamLogoPath(row.teamId)}" alt="" onerror="this.style.visibility='hidden'" />
                      <span>${titleizeSlug(row.teamId)}</span>
                    </div>
                  </td>
                  <td>${row.points}</td>
                  <td>${row.matchWins}-${row.matchLosses}</td>
                  <td>${row.mapWins}-${row.mapLosses}</td>
                  <td>${row.mapDiff > 0 ? '+' : ''}${row.mapDiff}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : emptyState('No standings rows found in points.json.')}
    </div></div>
  `;
}
