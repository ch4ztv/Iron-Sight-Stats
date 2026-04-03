import { sectionFrame, emptyState } from '../ui.js';
import { titleizeSlug, safe } from '../formatters.js';
import { playerImagePath, teamLogoPath } from '../asset-paths.js';

function getPlayerTeam(player) {
  return player.teamId || player.team || player.teamSlug || '';
}
function getPlayerName(player) {
  return player.displayName || player.name || player.playerName || player.id || 'Unknown';
}
function getPlayerSlug(player) {
  return (player.slug || player.id || getPlayerName(player)).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mergedPlayers(players, stats) {
  const statMap = new Map();
  stats.forEach(stat => {
    const key = stat.playerId || stat.id || stat.player || stat.name;
    statMap.set(key, stat);
  });
  return players.map(player => {
    const key = player.id || player.playerId || player.slug || getPlayerName(player);
    return { ...player, stat: statMap.get(key) || statMap.get(getPlayerName(player)) || {} };
  });
}

export function renderPlayers(container, state) {
  const players = mergedPlayers(state.data.players || [], state.data.playerStats || []).slice(0, 40);

  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Players', 'Roster cards with stat hooks wired to players.json and player-stats.json')}
      ${players.length ? `
        <div class="card-list">
          ${players.map(player => {
            const teamId = getPlayerTeam(player);
            const name = getPlayerName(player);
            const slug = getPlayerSlug(player);
            const stat = player.stat || {};
            return `
              <article class="player-card">
                <div class="player-row">
                  <img class="player-photo" src="${playerImagePath(teamId, slug)}" alt="${name}" onerror="this.onerror=null;this.src='${teamLogoPath(teamId)}'" />
                  <div>
                    <div class="eyebrow">${titleizeSlug(teamId)}</div>
                    <h3 style="margin:4px 0 6px">${name}</h3>
                    <div class="muted">${safe(player.role || player.position || 'Player')}</div>
                  </div>
                  <div class="small-grid">
                    <div class="stat-card"><div class="stat-label">K/D</div><div class="stat-value">${safe(stat.kd ?? stat.overallKd ?? stat['K/D'])}</div></div>
                    <div class="stat-card"><div class="stat-label">Slayer</div><div class="stat-value">${safe(stat.slayerRating ?? stat.slayer ?? stat.rating)}</div></div>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      ` : emptyState('Player data was not found or could not be matched yet.')}
    </div></div>
  `;
}
