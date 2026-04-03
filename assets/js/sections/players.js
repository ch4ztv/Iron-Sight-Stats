import { sectionFrame, emptyState, selectControl } from '../ui.js';
import { titleizeSlug, safe, slugify } from '../formatters.js';
import { playerImageCandidates, playerImagePath, teamLogoCandidates, teamLogoPath } from '../asset-paths.js';

function getPlayerTeam(player) {
  return player.teamId || player.team || player.teamSlug || '';
}
function getPlayerName(player) {
  return player.displayName || player.name || player.playerName || player.id || 'Unknown';
}
function getPlayerSlug(player) {
  return slugify(player.slug || player.id || getPlayerName(player));
}

function aggregatePlayerStats(stats) {
  const grouped = new Map();
  stats.forEach(stat => {
    const key = stat.playerId || stat.id || stat.player || stat.name;
    if (!grouped.has(key)) grouped.set(key, { kills: 0, deaths: 0, damage: 0, assists: 0, maps: 0, teamId: stat.teamId || '' });
    const row = grouped.get(key);
    row.kills += Number(stat.kills || 0);
    row.deaths += Number(stat.deaths || 0);
    row.damage += Number(stat.damage || 0);
    row.assists += Number(stat.assists || 0);
    row.maps += 1;
    if (!row.teamId && stat.teamId) row.teamId = stat.teamId;
  });
  return grouped;
}

export function renderPlayers(container, state) {
  const teams = [...new Set((state.data.players || []).map(getPlayerTeam).filter(Boolean))].sort();
  const selectedTeam = state.currentPlayersTeamFilter && teams.includes(state.currentPlayersTeamFilter) ? state.currentPlayersTeamFilter : 'all';
  const statsByPlayer = aggregatePlayerStats(state.data.playerStats || []);
  let players = (state.data.players || []).map(player => {
    const name = getPlayerName(player);
    const aggregate = statsByPlayer.get(player.id) || statsByPlayer.get(name) || { kills: 0, deaths: 0, damage: 0, assists: 0, maps: 0 };
    const kd = aggregate.deaths ? (aggregate.kills / aggregate.deaths) : 0;
    return { ...player, aggregate, kd };
  });
  if (selectedTeam !== 'all') players = players.filter(player => getPlayerTeam(player) === selectedTeam);
  players = players.sort((a, b) => b.kd - a.kd || (b.aggregate.kills - a.aggregate.kills)).slice(0, 60);

  container.innerHTML = `
    <div class="panel"><div class="panel-body">
      ${sectionFrame('Players', 'Roster cards with aggregated public stats across loaded map-level player data', `
        <div class="filters-row compact">
          <label class="muted" for="players-team-filter">Team</label>
          ${selectControl('players-team-filter', [{ value: 'all', label: 'All Teams' }, ...teams.map(teamId => ({ value: teamId, label: titleizeSlug(teamId) }))], selectedTeam)}
        </div>
      `)}
      ${players.length ? `
        <div class="card-list">
          ${players.map(player => {
            const teamId = getPlayerTeam(player);
            const name = getPlayerName(player);
            const slug = getPlayerSlug(player);
            const { aggregate, kd } = player;
            return `
              <article class="player-card elevated">
                <div class="player-row">
                  <img class="player-photo" src="${playerImagePath(teamId, slug)}" alt="${name}" data-fallbacks="${playerImageCandidates(teamId, slug).slice(1).concat(teamLogoCandidates(teamId)).join(',')}" />
                  <div>
                    <div class="eyebrow">${titleizeSlug(teamId)}</div>
                    <h3 style="margin:4px 0 6px">${name}</h3>
                    <div class="muted">${safe(player.role || player.position || 'Player')}</div>
                  </div>
                  <div class="small-grid">
                    <div class="stat-card compact"><div class="stat-label">K/D</div><div class="stat-value">${aggregate.maps ? kd.toFixed(2) : '—'}</div></div>
                    <div class="stat-card compact"><div class="stat-label">Kills</div><div class="stat-value">${aggregate.kills || '—'}</div></div>
                    <div class="stat-card compact"><div class="stat-label">Damage</div><div class="stat-value">${aggregate.damage || '—'}</div></div>
                    <div class="stat-card compact"><div class="stat-label">Maps</div><div class="stat-value">${aggregate.maps || '—'}</div></div>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      ` : emptyState('Player data was not found or could not be matched yet.')}
    </div></div>
  `;

  const select = container.querySelector('#players-team-filter');
  if (select) {
    select.addEventListener('change', () => {
      state.currentPlayersTeamFilter = select.value;
      renderPlayers(container, state);
    });
  }
}
