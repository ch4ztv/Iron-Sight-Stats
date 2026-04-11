import { playerImageCandidates, teamLogoCandidates, normalizeTeamId } from '../asset-paths.js';
import { computeISR, isrTier, buildIsrPlayerFromTeamStats } from '../isr.js';

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, digits = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '-';
}

function normalizeName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function metricCard(label, value, hint = '') {
  return `
    <div class="iss-mini-stat">
      <span class="iss-mini-stat-label">${label}</span>
      <strong class="iss-mini-stat-value">${value}</strong>
      ${hint ? `<span class="iss-mini-stat-hint">${hint}</span>` : ''}
    </div>
  `;
}

function createCandidateImg(candidates, alt, className = 'iss-media-img') {
  const img = document.createElement('img');
  img.alt = alt;
  img.className = className;
  const list = Array.isArray(candidates) ? [...candidates] : [];
  const fallback = './assets/img/branding/logo.png';

  const tryNext = () => {
    const next = list.shift();
    img.src = next || fallback;
    img.onerror = () => {
      img.onerror = null;
      tryNext();
    };
  };

  tryNext();
  return img;
}

function buildRows(data = {}) {
  const players = Array.isArray(data.players) ? data.players : [];
  const teamStats = data.teamStats || {};
  const playerAggList = Array.isArray(data.playerAggList) ? data.playerAggList : [];
  const isrConfig = data.isr || {};
  const allNames = new Map();

  players.forEach(player => {
    const key = `${normalizeTeamId(player.teamId)}::${normalizeName(player.name)}`;
    allNames.set(key, { teamId: normalizeTeamId(player.teamId), name: player.name, active: player.active });
  });

  Object.entries(teamStats).forEach(([teamId, value]) => {
    ['overall', 'hardpoint', 'snd', 'overload'].forEach(bucket => {
      (value?.[bucket]?.players || []).forEach(row => {
        const key = `${teamId}::${normalizeName(row.player)}`;
        if (!allNames.has(key)) {
          allNames.set(key, { teamId, name: row.player, active: true });
        }
      });
    });
  });

  return Array.from(allNames.values()).map(entry => {
    const merged = buildIsrPlayerFromTeamStats(teamStats, entry.teamId, entry.name, playerAggList);
    const aggregate = playerAggList.find(row => row.teamId === entry.teamId && normalizeName(row.name) === normalizeName(entry.name)) || {};
    const isr = computeISR({ ...merged, sample: num(aggregate.maps) ?? merged.sample }, null, isrConfig);
    return {
      ...entry,
      kd: merged.kd ?? num(aggregate.kd),
      maps: num(aggregate.maps) ?? merged.sample,
      kills: num(aggregate.kills),
      dmgPerMap: num(aggregate.dmgPerMap),
      isr,
      tier: isrTier(isr)
    };
  });
}

export function renderPlayersSection({ state, data } = {}) {
  const container = document.getElementById('players-section');
  if (!container) return;

  const rows = buildRows(data);
  const teamIds = Array.from(new Set(rows.map(row => row.teamId))).sort();
  const teamFilter = state?.ui?.selectedPlayersTeam || 'all';
  const query = (state?.ui?.playersQuery || '').toLowerCase().trim();
  const sortKey = state?.ui?.playersSort || 'isr';

  let filtered = rows.filter(row => teamFilter === 'all' || row.teamId === teamFilter);
  if (query) {
    filtered = filtered.filter(row =>
      row.name.toLowerCase().includes(query) ||
      row.teamId.toLowerCase().includes(query)
    );
  }

  filtered.sort((a, b) => {
    if (sortKey === 'kd') return (num(b.kd) ?? -1) - (num(a.kd) ?? -1);
    if (sortKey === 'kills') return (num(b.kills) ?? -1) - (num(a.kills) ?? -1);
    return (num(b.isr) ?? -1) - (num(a.isr) ?? -1);
  });

  const top = filtered[0];

  container.innerHTML = `
    <section class="iss-section-shell">
      <div class="iss-section-topline">
        <div>
          <p class="iss-eyebrow">Public stats explorer</p>
          <h2 class="iss-section-title">Players</h2>
          <p class="iss-section-copy">ISR sorting, tier badges, and safer image fallback logic.</p>
        </div>
      </div>

      <div class="iss-toolbar iss-toolbar--players">
        <label class="iss-field">
          <span>Search</span>
          <input id="iss-players-search" type="search" placeholder="Search player or team" value="${state?.ui?.playersQuery || ''}">
        </label>

        <label class="iss-field">
          <span>Team</span>
          <select id="iss-players-team-filter">
            <option value="all">All teams</option>
            ${teamIds.map(teamId => `<option value="${teamId}" ${teamFilter === teamId ? 'selected' : ''}>${teamId.toUpperCase()}</option>`).join('')}
          </select>
        </label>

        <label class="iss-field">
          <span>Sort</span>
          <select id="iss-players-sort">
            <option value="isr" ${sortKey === 'isr' ? 'selected' : ''}>ISR</option>
            <option value="kd" ${sortKey === 'kd' ? 'selected' : ''}>K/D</option>
            <option value="kills" ${sortKey === 'kills' ? 'selected' : ''}>Kills</option>
          </select>
        </label>
      </div>

      ${top ? `
      <div class="iss-feature-card iss-feature-card--player">
        <div class="iss-feature-media" id="iss-player-feature-media"></div>
        <div class="iss-feature-body">
          <p class="iss-kicker">Current ISR leader</p>
          <h3>${top.name}</h3>
          <p>${top.teamId.toUpperCase()} - ${fmt(top.maps, 0)} map sample</p>
          <div class="iss-mini-stat-grid">
            ${metricCard('ISR', fmt(top.isr))}
            ${metricCard('Tier', top.tier.label)}
            ${metricCard('K/D', fmt(top.kd, 2))}
            ${metricCard('Damage / Map', fmt(top.dmgPerMap, 0))}
          </div>
        </div>
      </div>` : ''}

      <div class="iss-card-grid iss-card-grid--players">
        ${filtered.map(player => `
          <article class="iss-player-card" data-player="${player.name}">
            <div class="iss-player-card-top">
              <div class="iss-player-portrait" data-player-media="${player.teamId}::${player.name}"></div>
              <div class="iss-player-copy">
                <span class="iss-team-pill">${player.teamId.toUpperCase()}</span>
                <h3>${player.name}</h3>
                <p>${fmt(player.maps, 0)} map sample</p>
                <span class="iss-team-pill ${player.tier.colorClass}">${fmt(player.isr)} ISR - ${player.tier.label}</span>
              </div>
            </div>

            <div class="iss-mini-stat-grid">
              ${metricCard('K/D', fmt(player.kd, 2))}
              ${metricCard('Kills', fmt(player.kills, 0))}
              ${metricCard('Damage / Map', fmt(player.dmgPerMap, 0))}
              ${metricCard('Tier', player.tier.label)}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;

  if (top) {
    const featureTarget = container.querySelector('#iss-player-feature-media');
    featureTarget?.appendChild(createCandidateImg(playerImageCandidates(top.teamId, top.name), `${top.name} portrait`, 'iss-feature-player-img'));
    featureTarget?.appendChild(createCandidateImg(teamLogoCandidates(top.teamId), `${top.teamId} logo`, 'iss-feature-team-logo'));
  }

  container.querySelectorAll('[data-player-media]').forEach(node => {
    const [teamId, playerName] = (node.getAttribute('data-player-media') || '').split('::');
    node.appendChild(createCandidateImg(playerImageCandidates(teamId, playerName), `${playerName} portrait`, 'iss-player-img'));
    node.appendChild(createCandidateImg(teamLogoCandidates(teamId), `${teamId} logo`, 'iss-player-team-logo'));
  });

  container.querySelector('#iss-players-search')?.addEventListener('input', (event) => {
    state.ui.playersQuery = event.target.value;
    renderPlayersSection({ state, data });
  });

  container.querySelector('#iss-players-team-filter')?.addEventListener('change', (event) => {
    state.ui.selectedPlayersTeam = event.target.value;
    renderPlayersSection({ state, data });
  });

  container.querySelector('#iss-players-sort')?.addEventListener('change', (event) => {
    state.ui.playersSort = event.target.value;
    renderPlayersSection({ state, data });
  });
}
