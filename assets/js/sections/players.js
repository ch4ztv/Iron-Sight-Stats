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

function avg(numerator, maps) {
  return maps ? numerator / maps : 0;
}

export function renderPlayers(container, state) {
  const teams = [...new Set((state.data.players || []).map(getPlayerTeam).filter(Boolean))].sort();
  const selectedTeam = state.currentPlayersTeamFilter && teams.includes(state.currentPlayersTeamFilter) ? state.currentPlayersTeamFilter : 'all';
  const selectedSort = ['kd', 'kills', 'damage', 'maps', 'assists'].includes(state.currentPlayersSort) ? state.currentPlayersSort : 'kd';
  const search = (state.currentPlayersSearch || '').trim().toLowerCase();
  const statsByPlayer = aggregatePlayerStats(state.data.playerStats || []);

  let players = (state.data.players || []).map(player => {
    const name = getPlayerName(player);
    const aggregate = statsByPlayer.get(player.id) || statsByPlayer.get(name) || { kills: 0, deaths: 0, damage: 0, assists: 0, maps: 0 };
    const kd = aggregate.deaths ? (aggregate.kills / aggregate.deaths) : 0;
    return {
      ...player,
      aggregate,
      kd,
      kpm: avg(aggregate.kills, aggregate.maps),
      dpm: avg(aggregate.damage, aggregate.maps),
      apm: avg(aggregate.assists, aggregate.maps)
    };
  });

  if (selectedTeam !== 'all') players = players.filter(player => getPlayerTeam(player) === selectedTeam);
  if (search) players = players.filter(player => `${getPlayerName(player)} ${titleizeSlug(getPlayerTeam(player))}`.toLowerCase().includes(search));

  const sorters = {
    kd: (a, b) => b.kd - a.kd || b.aggregate.kills - a.aggregate.kills,
    kills: (a, b) => b.aggregate.kills - a.aggregate.kills,
    damage: (a, b) => b.aggregate.damage - a.aggregate.damage,
    maps: (a, b) => b.aggregate.maps - a.aggregate.maps,
    assists: (a, b) => b.aggregate.assists - a.aggregate.assists
  };
  players = players.sort(sorters[selectedSort]).slice(0, 80);

  const leader = players[0];

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel hero-card"><div class="panel-body">
        ${sectionFrame('Players', 'Searchable player cards with map-level public stat aggregation and team-aware media fallbacks', `
          <div class="filters-row compact toolbar-wrap">
            <input id="players-search" class="search-input" type="search" placeholder="Search player or team" value="${state.currentPlayersSearch || ''}" />
            ${selectControl('players-team-filter', [{ value: 'all', label: 'All Teams' }, ...teams.map(teamId => ({ value: teamId, label: titleizeSlug(teamId) }))], selectedTeam)}
            ${selectControl('players-sort-filter', [
              { value: 'kd', label: 'Sort: K/D' },
              { value: 'kills', label: 'Sort: Kills' },
              { value: 'damage', label: 'Sort: Damage' },
              { value: 'maps', label: 'Sort: Maps' },
              { value: 'assists', label: 'Sort: Assists' }
            ], selectedSort)}
          </div>
        `)}
        ${leader ? `
          <div class="featured-player-card">
            <img class="player-photo xl" src="${playerImagePath(getPlayerTeam(leader), getPlayerSlug(leader))}" alt="${getPlayerName(leader)}" data-fallbacks="${playerImageCandidates(getPlayerTeam(leader), getPlayerSlug(leader)).slice(1).concat(teamLogoCandidates(getPlayerTeam(leader))).join(',')}" />
            <div>
              <div class="eyebrow">Current filtered leader</div>
              <h3>${getPlayerName(leader)}</h3>
              <p class="muted">${titleizeSlug(getPlayerTeam(leader))} • ${safe(leader.role || leader.position || 'Player')}</p>
              <div class="inline-pills">
                <span class="pill accent">K/D ${leader.kd ? leader.kd.toFixed(2) : '—'}</span>
                <span class="pill">Kills ${leader.aggregate.kills || '—'}</span>
                <span class="pill">Damage ${leader.aggregate.damage || '—'}</span>
                <span class="pill">Maps ${leader.aggregate.maps || '—'}</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div></div>

      ${players.length ? `
        <div class="player-grid enhanced">
          ${players.map(player => {
            const teamId = getPlayerTeam(player);
            const name = getPlayerName(player);
            const slug = getPlayerSlug(player);
            const { aggregate, kd } = player;
            return `
              <article class="player-card elevated">
                <div class="player-row stacked-mobile">
                  <img class="player-photo" src="${playerImagePath(teamId, slug)}" alt="${name}" data-fallbacks="${playerImageCandidates(teamId, slug).slice(1).concat(teamLogoCandidates(teamId)).join(',')}" />
                  <div>
                    <div class="eyebrow">${titleizeSlug(teamId)}</div>
                    <h3 style="margin:4px 0 6px">${name}</h3>
                    <div class="muted">${safe(player.role || player.position || 'Player')}</div>
                  </div>
                  <div class="inline-badge-logo">
                    <img class="team-logo-sm" src="${teamLogoPath(teamId)}" data-fallbacks="${teamLogoCandidates(teamId).slice(1).join(',')}" alt="${titleizeSlug(teamId)} logo" />
                  </div>
                </div>
                <div class="small-grid" style="margin-top:14px">
                  <div class="stat-card compact"><div class="stat-label">K/D</div><div class="stat-value">${aggregate.maps ? kd.toFixed(2) : '—'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Kills</div><div class="stat-value">${aggregate.kills || '—'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Damage</div><div class="stat-value">${aggregate.damage || '—'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Assists</div><div class="stat-value">${aggregate.assists || '—'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Maps</div><div class="stat-value">${aggregate.maps || '—'}</div></div>
                  <div class="stat-card compact"><div class="stat-label">Avg Kills / Map</div><div class="stat-value">${aggregate.maps ? player.kpm.toFixed(1) : '—'}</div></div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      ` : emptyState('Player data was not found or could not be matched yet.')}
    </div>
  `;

  const searchInput = container.querySelector('#players-search');
  const teamSelect = container.querySelector('#players-team-filter');
  const sortSelect = container.querySelector('#players-sort-filter');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.currentPlayersSearch = searchInput.value;
      renderPlayers(container, state);
    });
  }
  if (teamSelect) {
    teamSelect.addEventListener('change', () => {
      state.currentPlayersTeamFilter = teamSelect.value;
      renderPlayers(container, state);
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.currentPlayersSort = sortSelect.value;
      renderPlayers(container, state);
    });
  }
}
