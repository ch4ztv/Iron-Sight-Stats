import { playerImageCandidates, teamLogoCandidates, normalizeTeamId } from '../asset-paths.js';

const FEATURE_KEYS = ['kd', 'slayerscore', 'kills10m', 'engagements10m', 'fb', 'plants', 'defuses'];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickPlayerStats(rawStats, rawPlayers) {
  const stats = Array.isArray(rawStats) ? rawStats : [];
  if (!stats.length) return [];

  return stats.map((row, idx) => {
    const playerId = row.playerId ?? row.id ?? idx;
    const playerMeta = (Array.isArray(rawPlayers) ? rawPlayers : []).find(p =>
      String(p.id ?? p.playerId ?? '').toLowerCase() === String(playerId).toLowerCase() ||
      String(p.tag ?? p.name ?? '').toLowerCase() === String(row.tag ?? row.name ?? '').toLowerCase()
    ) || {};

    const tag = row.tag || row.name || playerMeta.tag || playerMeta.name || `Player ${idx + 1}`;
    const teamId = row.teamId || playerMeta.teamId || playerMeta.team || row.team || 'unknown';

    const sample = num(row.seriesPlayed ?? row.matchesPlayed ?? row.sample ?? row.matches ?? 0);
    return {
      id: playerId,
      tag,
      teamId: normalizeTeamId(teamId),
      sample,
      kd: num(row.kd ?? row.KD),
      slayerScore: num(row.slayerScore ?? row.slayerscore ?? row.ss),
      kills10m: num(row.kills10m ?? row.k10),
      deaths10m: num(row.deaths10m ?? row.d10),
      engagements10m: num(row.engagements10m ?? row.e10),
      fb: num(row.firstBloodRate ?? row.fb ?? row.fbRate),
      plants: num(row.plants ?? row.bombPlants),
      defuses: num(row.defuses ?? row.bombDefuses),
      raw: row,
      meta: playerMeta,
    };
  });
}

function fmt(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(digits);
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

function metricCard(label, value, hint = '') {
  return `
    <div class="iss-mini-stat">
      <span class="iss-mini-stat-label">${label}</span>
      <strong class="iss-mini-stat-value">${value}</strong>
      ${hint ? `<span class="iss-mini-stat-hint">${hint}</span>` : ''}
    </div>
  `;
}

export function renderPlayersSection({ state, data } = {}) {
  const container = document.getElementById('players-section');
  if (!container) return;

  const players = Array.isArray(data?.players) ? data.players : [];
  const playerStats = pickPlayerStats(data?.playerStats, players);

  const teamFilter = state?.ui?.selectedPlayersTeam || 'all';
  const query = (state?.ui?.playersQuery || '').toLowerCase().trim();
  const sortKey = state?.ui?.playersSort || 'kd';

  let filtered = playerStats.filter(p => (teamFilter === 'all' || p.teamId === teamFilter));
  if (query) {
    filtered = filtered.filter(p =>
      p.tag.toLowerCase().includes(query) ||
      p.teamId.toLowerCase().includes(query)
    );
  }

  filtered.sort((a, b) => {
    const lookup = {
      kd: b.kd - a.kd,
      slayerScore: b.slayerScore - a.slayerScore,
      kills10m: b.kills10m - a.kills10m,
      engagements10m: b.engagements10m - a.engagements10m,
      sample: b.sample - a.sample,
    };
    return lookup[sortKey] ?? lookup.kd;
  });

  const top = filtered[0];
  const teamIds = Array.from(new Set(playerStats.map(p => p.teamId))).sort();

  container.innerHTML = `
    <section class="iss-section-shell">
      <div class="iss-section-topline">
        <div>
          <p class="iss-eyebrow">Public stats explorer</p>
          <h2 class="iss-section-title">Players</h2>
          <p class="iss-section-copy">Sharper player cards, stronger stats hierarchy, and safer image fallback logic.</p>
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
            <option value="kd" ${sortKey === 'kd' ? 'selected' : ''}>K/D</option>
            <option value="slayerScore" ${sortKey === 'slayerScore' ? 'selected' : ''}>Slayer Score</option>
            <option value="kills10m" ${sortKey === 'kills10m' ? 'selected' : ''}>Kills / 10m</option>
            <option value="engagements10m" ${sortKey === 'engagements10m' ? 'selected' : ''}>Engagements / 10m</option>
            <option value="sample" ${sortKey === 'sample' ? 'selected' : ''}>Sample</option>
          </select>
        </label>
      </div>

      ${top ? `
      <div class="iss-feature-card iss-feature-card--player">
        <div class="iss-feature-media" id="iss-player-feature-media"></div>
        <div class="iss-feature-body">
          <p class="iss-kicker">Current leader</p>
          <h3>${top.tag}</h3>
          <p>${top.teamId.toUpperCase()} · ${top.sample} series sample</p>
          <div class="iss-mini-stat-grid">
            ${metricCard('K/D', fmt(top.kd))}
            ${metricCard('Slayer Score', fmt(top.slayerScore))}
            ${metricCard('Kills / 10m', fmt(top.kills10m))}
            ${metricCard('Engagements / 10m', fmt(top.engagements10m))}
          </div>
        </div>
      </div>` : ''}

      <div class="iss-card-grid iss-card-grid--players">
        ${filtered.map(player => `
          <article class="iss-player-card" data-player="${player.tag}">
            <div class="iss-player-card-top">
              <div class="iss-player-portrait" data-player-media="${player.id}"></div>
              <div class="iss-player-copy">
                <span class="iss-team-pill">${player.teamId.toUpperCase()}</span>
                <h3>${player.tag}</h3>
                <p>${player.sample} series sample</p>
              </div>
            </div>

            <div class="iss-mini-stat-grid">
              ${metricCard('K/D', fmt(player.kd))}
              ${metricCard('Slayer Score', fmt(player.slayerScore))}
              ${metricCard('Kills / 10m', fmt(player.kills10m))}
              ${metricCard('Eng / 10m', fmt(player.engagements10m))}
              ${metricCard('FB', fmt(player.fb))}
              ${metricCard('Plants', fmt(player.plants, 0))}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;

  if (top) {
    const featureTarget = container.querySelector('#iss-player-feature-media');
    featureTarget?.appendChild(createCandidateImg(playerImageCandidates(top.teamId, top.tag), `${top.tag} portrait`, 'iss-feature-player-img'));
    featureTarget?.appendChild(createCandidateImg(teamLogoCandidates(top.teamId), `${top.teamId} logo`, 'iss-feature-team-logo'));
  }

  container.querySelectorAll('[data-player-media]').forEach(node => {
    const pid = node.getAttribute('data-player-media');
    const player = filtered.find(p => String(p.id) === pid);
    if (!player) return;
    node.appendChild(createCandidateImg(playerImageCandidates(player.teamId, player.tag), `${player.tag} portrait`, 'iss-player-img'));
    node.appendChild(createCandidateImg(teamLogoCandidates(player.teamId), `${player.teamId} logo`, 'iss-player-team-logo'));
  });

  container.querySelector('#iss-players-search')?.addEventListener('input', (e) => {
    state.ui.playersQuery = e.target.value;
    renderPlayersSection({ state, data });
  });

  container.querySelector('#iss-players-team-filter')?.addEventListener('change', (e) => {
    state.ui.selectedPlayersTeam = e.target.value;
    renderPlayersSection({ state, data });
  });

  container.querySelector('#iss-players-sort')?.addEventListener('change', (e) => {
    state.ui.playersSort = e.target.value;
    renderPlayersSection({ state, data });
  });
}
