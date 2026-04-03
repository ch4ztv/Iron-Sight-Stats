import { getState } from '../state.js';
import { qs, renderSectionHeader, renderEmptyState, renderErrorState } from '../ui.js';
import { buildStandingsFromPoints } from '../data-loader.js';
import { initials } from '../asset-paths.js';

export function renderStandings() {
  const target = qs('#standings-section');
  if (!target) return;
  const { data } = getState();

  try {
    const rows = buildStandingsFromPoints(data.points, data.matches);
    if (!rows.length) {
      renderEmptyState(target, 'No standings data yet', 'Once points or completed match results are available, standings will appear here.');
      return;
    }

    target.innerHTML = `
      <div class="stack">
        <div class="section-card">
          ${renderSectionHeader('Standings', 'League table generated from public points data or completed series')}
          <div class="table-shell">
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Points</th>
                    <th>Record</th>
                    <th>Map Diff</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row, index) => `
                    <tr>
                      <td><strong>#${index + 1}</strong></td>
                      <td>
                        <div class="team-cell">
                          <div class="logo-fallback">${initials(row.teamId, 1)}</div>
                          <span>${row.teamId}</span>
                        </div>
                      </td>
                      <td><strong>${row.points}</strong></td>
                      <td>${row.wins}-${row.losses}</td>
                      <td class="${row.mapDiff >= 0 ? 'stat-positive' : ''}">${row.mapDiff >= 0 ? '+' : ''}${row.mapDiff}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid-3">
          ${rows.slice(0, 3).map((row, index) => `
            <div class="kpi-card">
              <div class="kpi-label">Rank #${index + 1}</div>
              <div class="kpi-value">${row.teamId}</div>
              <div class="kpi-meta">${row.wins}-${row.losses} • ${row.points} pts • ${row.mapDiff >= 0 ? '+' : ''}${row.mapDiff} map diff</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    renderErrorState(target, 'Standings failed to render', error.message);
  }
}
