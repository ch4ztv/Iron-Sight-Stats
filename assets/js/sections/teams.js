import { sectionFrame, emptyState, selectControl } from '../ui.js';
import { titleizeSlug, slugify, safe } from '../formatters.js';
import { playerImageCandidates, playerImagePath, teamLogoCandidates, teamLogoPath, teamStatCandidates, teamStatPath } from '../asset-paths.js';

function getUniqueTeams(matches) {
  return [...new Set(matches.flatMap(m => [m.team1Id, m.team2Id]).filter(Boolean))].sort();
}
function getTeamRoster(teamId, players) {
  return players.filter(player => (player.teamId || player.team || player.teamSlug) === teamId);
}
function playerName(player) {
  return player.displayName || player.name || player.playerName || player.id || 'Unknown';
}
function playerSlug(player) {
  return slugify(player.slug || player.id || playerName(player));
}
function computeTeamSummary(teamId, matches, maps) {
  const teamMatches = matches.filter(match => [match.team1Id, match.team2Id].includes(teamId));
  let wins = 0;
  let losses = 0;
  teamMatches.forEach(match => {
    const mapRows = maps.filter(map => map.matchId === match.id);
    const score1 = match.seriesScore1 ?? mapRows.filter(m => m.winner === match.team1Id).length;
    const score2 = match.seriesScore2 ?? mapRows.filter(m => m.winner === match.team2Id).length;
    if (!score1 && !score2) return;
    const won = (match.team1Id === teamId && score1 > score2) || (match.team2Id === teamId && score2 > score1);
    if (won) wins += 1; else losses += 1;
  });
  const recent = teamMatches.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5).map(match => {
    const isTeam1 = match.team1Id === teamId;
    const opp = isTeam1 ? match.team2Id : match.team1Id;
    const mapRows = maps.filter(map => map.matchId === match.id);
    const score1 = match.seriesScore1 ?? mapRows.filter(m => m.winner === match.team1Id).length;
    const score2 = match.seriesScore2 ?? mapRows.filter(m => m.winner === match.team2Id).length;
    const won = (isTeam1 && score1 > score2) || (!isTeam1 && score2 > score1);
    return `${won ? 'W' : 'L'} vs ${titleizeSlug(opp)}`;
  });
  return { wins, losses, total: wins + losses, recent };
}

function rowTable(title, rows, columns) {
  if (!rows?.length) return emptyState(`${title} data is not available yet.`);
  return `
    <div class="table-wrap compact-table">
      <table>
        <thead><tr>${columns.map(col => `<th>${col.label}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(row => `<tr>${columns.map(col => `<td>${safe(row[col.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderTeams(container, state) {
  const teams = getUniqueTeams(state.data.matches || []);
  const selected = state.currentTeamView && teams.includes(state.currentTeamView) ? state.currentTeamView : teams[0];
  const roster = getTeamRoster(selected, state.data.players || []);
  const importedTeamStats = state.data.teamStats?.[selected] || null;
  const confidence = importedTeamStats?.confidence || '—';
  const summary = computeTeamSummary(selected, state.data.matches || [], state.data.maps || []);
  const overviewRows = importedTeamStats?.overall?.players || [];
  const hardpointRows = importedTeamStats?.hardpoint?.players || [];
  const sndRows = importedTeamStats?.snd?.players || [];
  const overloadRows = importedTeamStats?.overload?.players || [];

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel hero-card"><div class="panel-body">
        ${sectionFrame('Teams', 'Team pages with roster view, team summary, and imported parser-backed stat tables/images', `
          <div class="filters-row compact toolbar-wrap">
            ${selectControl('team-select', teams.map(teamId => ({ value: teamId, label: titleizeSlug(teamId) })), selected)}
          </div>
        `)}
        <div class="team-hero enhanced">
          <img class="team-logo-lg" src="${teamLogoPath(selected)}" data-fallbacks="${teamLogoCandidates(selected).slice(1).join(',')}" alt="${titleizeSlug(selected)} logo" />
          <div>
            <div class="eyebrow">Team profile</div>
            <h2 style="margin:6px 0 10px">${titleizeSlug(selected)}</h2>
            <div class="inline-pills">
              <span class="pill accent">Record ${summary.wins}-${summary.losses}</span>
              <span class="pill">Recent ${summary.recent.join(' • ') || '—'}</span>
              <span class="pill">Parser confidence ${confidence}</span>
            </div>
            <p class="muted" style="margin-top:12px">${safe(importedTeamStats?.notes, 'Imported overview images and player tables will appear here when assets and parsed stats line up with the public build.')}</p>
          </div>
        </div>
      </div></div>

      <div class="grid-2 roster-layout">
        <div class="panel"><div class="panel-body">
          <div class="subsection-title-row"><h3>Roster</h3><span class="muted">${roster.length} players</span></div>
          ${roster.length ? `
            <div class="card-list compact-gap">
              ${roster.map(player => `
                <div class="player-card team-roster-card">
                  <img class="player-photo" src="${playerImagePath(selected, playerSlug(player))}" data-fallbacks="${playerImageCandidates(selected, playerSlug(player)).slice(1).concat(teamLogoCandidates(selected)).join(',')}" alt="${playerName(player)}" />
                  <div>
                    <strong>${playerName(player)}</strong>
                    <div class="muted">${safe(player.role || player.position || 'Active roster')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : emptyState('No roster rows matched this team yet.')}
        </div></div>

        <div class="panel"><div class="panel-body">
          <div class="subsection-title-row"><h3>Imported overview</h3><span class="muted">From team-stats.json</span></div>
          ${rowTable('Overall', overviewRows, [
            { key: 'player', label: 'Player' },
            { key: 'kd', label: 'K/D' },
            { key: 'slayerRating', label: 'Slayer' },
            { key: 'respawnKd', label: 'Respawn K/D' },
            { key: 'bpRating', label: 'BP Rating' }
          ])}
        </div></div>
      </div>

      <div class="grid-3 compact-stats">
        <div class="panel"><div class="panel-body"><div class="subsection-title-row"><h3>Hardpoint</h3></div>${rowTable('Hardpoint', hardpointRows, [
          { key: 'player', label: 'Player' }, { key: 'kd', label: 'K/D' }, { key: 'k10m', label: 'K/10m' }, { key: 'dmg10m', label: 'DMG/10m' }
        ])}</div></div>
        <div class="panel"><div class="panel-body"><div class="subsection-title-row"><h3>Search & Destroy</h3></div>${rowTable('S&D', sndRows, [
          { key: 'player', label: 'Player' }, { key: 'kd', label: 'K/D' }, { key: 'kRound', label: 'K/Round' }, { key: 'dmgRound', label: 'DMG/Round' }
        ])}</div></div>
        <div class="panel"><div class="panel-body"><div class="subsection-title-row"><h3>Overload</h3></div>${rowTable('Overload', overloadRows, [
          { key: 'player', label: 'Player' }, { key: 'kd', label: 'K/D' }, { key: 'k10m', label: 'K/10m' }, { key: 'goals10m', label: 'Goals/10m' }
        ])}</div></div>
      </div>

      <div class="panel"><div class="panel-body">
        <div class="subsection-title-row"><h3>Team stat images</h3><span class="muted">Public asset hooks</span></div>
        <div class="team-stats-grid expanded">
          ${[
            ['overall', 'Overall'],
            ['hardpoint', 'Hardpoint'],
            ['search-and-destroy', 'Search & Destroy'],
            ['overload', 'Overload'],
            ['map-records', 'Map Records'],
            ['picks-vetoes', 'Picks / Vetoes']
          ].map(([key, label]) => `
            <div class="image-panel">
              <div class="label">${label}</div>
              <img src="${teamStatPath(selected, key)}" data-fallbacks="${teamStatCandidates(selected, key).slice(1).join(',')}" alt="${titleizeSlug(selected)} ${label}" />
            </div>
          `).join('')}
        </div>
      </div></div>
    </div>
  `;

  const select = container.querySelector('#team-select');
  if (select) {
    select.addEventListener('change', () => {
      state.currentTeamView = select.value;
      renderTeams(container, state);
    });
  }
}
