import { sectionFrame, emptyState } from '../ui.js';
import { titleizeSlug, formatSignedNumber } from '../formatters.js';
import { teamLogoCandidates, teamLogoPath } from '../asset-paths.js';

function aggregatePoints(rows) {
  const totals = new Map();
  rows.forEach(row => {
    const teamId = row.teamId || row.id || row.team;
    if (!teamId) return;
    if (!totals.has(teamId)) {
      totals.set(teamId, { teamId, points: 0, eventPoints: {}, entries: 0 });
    }
    const item = totals.get(teamId);
    const pts = Number(row.pts ?? row.points ?? row.cdlPoints ?? 0) || 0;
    item.points += pts;
    item.entries += 1;
    if (row.eventId) item.eventPoints[row.eventId] = (item.eventPoints[row.eventId] || 0) + pts;
  });
  return [...totals.values()].sort((a, b) => b.points - a.points || a.teamId.localeCompare(b.teamId));
}

function buildRecordMaps(matches, maps) {
  const matchRecords = new Map();
  const mapRecords = new Map();
  const completed = matches.filter(m => m.seriesScore1 !== undefined || m.seriesScore2 !== undefined || maps.some(map => map.matchId === m.id));

  completed.forEach(match => {
    const teamIds = [match.team1Id, match.team2Id].filter(Boolean);
    teamIds.forEach(teamId => {
      if (!matchRecords.has(teamId)) matchRecords.set(teamId, { wins: 0, losses: 0 });
      if (!mapRecords.has(teamId)) mapRecords.set(teamId, { wins: 0, losses: 0 });
    });

    const seriesMaps = maps.filter(map => map.matchId === match.id);
    const score1 = match.seriesScore1 ?? seriesMaps.filter(map => map.winner === match.team1Id).length;
    const score2 = match.seriesScore2 ?? seriesMaps.filter(map => map.winner === match.team2Id).length;

    if (score1 !== score2 && score1 + score2 > 0) {
      const winner = score1 > score2 ? match.team1Id : match.team2Id;
      const loser = score1 > score2 ? match.team2Id : match.team1Id;
      if (winner && loser) {
        matchRecords.get(winner).wins += 1;
        matchRecords.get(loser).losses += 1;
      }
    }

    seriesMaps.forEach(map => {
      const loser = map.winner === match.team1Id ? match.team2Id : match.team1Id;
      if (map.winner && mapRecords.has(map.winner)) mapRecords.get(map.winner).wins += 1;
      if (loser && mapRecords.has(loser)) mapRecords.get(loser).losses += 1;
    });
  });

  return { matchRecords, mapRecords };
}

export function renderStandings(container, state) {
  const rows = aggregatePoints(state.data.points || []);
  const { matchRecords, mapRecords } = buildRecordMaps(state.data.matches || [], state.data.maps || []);

  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Standings', 'Aggregated from points.json and cross-checked against loaded match results')}
      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Rank</th><th>Team</th><th>Total Points</th><th>Series</th><th>Maps</th><th>Map Diff</th><th>Event Split</th></tr>
            </thead>
            <tbody>
              ${rows.map((row, i) => {
                const series = matchRecords.get(row.teamId) || { wins: 0, losses: 0 };
                const maps = mapRecords.get(row.teamId) || { wins: 0, losses: 0 };
                const diff = maps.wins - maps.losses;
                const split = Object.entries(row.eventPoints).sort(([a], [b]) => a.localeCompare(b)).map(([event, pts]) => `${event}: ${pts}`).join(' • ');
                return `
                  <tr>
                    <td>#${i + 1}</td>
                    <td>
                      <div class="team-line-main">
                        <img class="team-logo-sm" src="${teamLogoPath(row.teamId)}" alt="" data-fallbacks="${teamLogoCandidates(row.teamId).slice(1).join(',')}" />
                        <span>${titleizeSlug(row.teamId)}</span>
                      </div>
                    </td>
                    <td><strong>${row.points}</strong></td>
                    <td>${series.wins}-${series.losses}</td>
                    <td>${maps.wins}-${maps.losses}</td>
                    <td>${formatSignedNumber(diff)}</td>
                    <td class="muted">${split || '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : emptyState('No standings rows found in points.json.')}
    </div></div>
  `;
}
