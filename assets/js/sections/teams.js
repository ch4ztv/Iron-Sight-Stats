import { normalizeTeamId, playerImageCandidates, teamLogoCandidates, teamStatCandidates } from '../asset-paths.js';

const TEAM_STAT_PANELS = [
  { key: 'overall', label: 'Overall' },
  { key: 'hardpoint', label: 'Hardpoint' },
  { key: 'search-and-destroy', label: 'Search & Destroy' },
  { key: 'overload', label: 'Overload' },
  { key: 'map-records', label: 'Map Records' },
  { key: 'picks-vetoes', label: 'Picks & Vetoes' },
];

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

function computeRecord(teamId, matches = []) {
  let wins = 0;
  let losses = 0;
  let lastFive = [];

  matches.forEach(match => {
    if (![match.team1Id, match.team2Id].includes(teamId)) return;
    if (!Number.isFinite(Number(match.seriesScore1)) || !Number.isFinite(Number(match.seriesScore2))) return;

    const isTeam1 = match.team1Id === teamId;
    const teamScore = isTeam1 ? Number(match.seriesScore1) : Number(match.seriesScore2);
    const oppScore = isTeam1 ? Number(match.seriesScore2) : Number(match.seriesScore1);
    const win = teamScore > oppScore;
    if (win) wins += 1; else losses += 1;
    lastFive.push(win ? 'W' : 'L');
  });

  return { wins, losses, lastFive: lastFive.slice(-5).reverse() };
}

export function renderTeamsSection({ state, data } = {}) {
  const container = document.getElementById('teams-section');
  if (!container) return;

  const teams = Array.isArray(data?.teams) ? data.teams : [];
  const players = Array.isArray(data?.players) ? data.players : [];
  const matches = Array.isArray(data?.matches) ? data.matches : [];

  const teamIds = Array.from(new Set([
    ...teams.map(t => normalizeTeamId(t.id || t.teamId || t.name)),
    ...players.map(p => normalizeTeamId(p.teamId || p.team || p.org)),
    ...matches.flatMap(m => [normalizeTeamId(m.team1Id), normalizeTeamId(m.team2Id)]),
  ].filter(Boolean))).sort();

  const selected = state?.ui?.selectedTeam || teamIds[0] || 'optic';
  const roster = players.filter(p => normalizeTeamId(p.teamId || p.team || p.org) === selected);
  const record = computeRecord(selected, matches);

  container.innerHTML = `
    <section class="iss-section-shell">
      <div class="iss-team-hero">
        <div class="iss-team-hero-media" id="iss-team-hero-media"></div>
        <div class="iss-team-hero-copy">
          <p class="iss-eyebrow">Team hub</p>
          <h2 class="iss-section-title">${selected.toUpperCase()}</h2>
          <p class="iss-section-copy">Roster, recent form, and imported team stat panels with stronger fallback handling.</p>
          <div class="iss-team-meta-row">
            <span class="iss-meta-chip">Record: ${record.wins}-${record.losses}</span>
            <span class="iss-meta-chip">Last 5: ${record.lastFive.join(' · ') || '—'}</span>
          </div>
        </div>
      </div>

      <div class="iss-toolbar">
        <label class="iss-field iss-field--wide">
          <span>Team</span>
          <select id="iss-team-select">
            ${teamIds.map(teamId => `<option value="${teamId}" ${teamId === selected ? 'selected' : ''}>${teamId.toUpperCase()}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="iss-split-layout">
        <div class="iss-split-main">
          <section class="iss-panel">
            <div class="iss-panel-head">
              <h3>Roster</h3>
              <p>${roster.length} players</p>
            </div>
            <div class="iss-card-grid iss-card-grid--roster">
              ${roster.map(player => `
                <article class="iss-roster-card">
                  <div class="iss-roster-media" data-roster-player="${player.id ?? player.tag ?? player.name}"></div>
                  <div class="iss-roster-copy">
                    <h4>${player.tag || player.name || 'Unknown player'}</h4>
                    <p>${selected.toUpperCase()}</p>
                  </div>
                </article>
              `).join('') || '<p class="iss-empty-copy">No roster data found for this team yet.</p>'}
            </div>
          </section>

          <section class="iss-panel">
            <div class="iss-panel-head">
              <h3>Imported team stat panels</h3>
              <p>Rendered from your assets folder</p>
            </div>
            <div class="iss-card-grid iss-card-grid--team-stats">
              ${TEAM_STAT_PANELS.map(panel => `
                <article class="iss-stat-image-card">
                  <div class="iss-stat-image-head">
                    <h4>${panel.label}</h4>
                  </div>
                  <div class="iss-stat-image-wrap" data-team-stat="${panel.key}"></div>
                </article>
              `).join('')}
            </div>
          </section>
        </div>

        <aside class="iss-split-side">
          <section class="iss-panel">
            <div class="iss-panel-head">
              <h3>Quick snapshot</h3>
            </div>
            <div class="iss-mini-stat-grid">
              <div class="iss-mini-stat"><span class="iss-mini-stat-label">Wins</span><strong class="iss-mini-stat-value">${record.wins}</strong></div>
              <div class="iss-mini-stat"><span class="iss-mini-stat-label">Losses</span><strong class="iss-mini-stat-value">${record.losses}</strong></div>
              <div class="iss-mini-stat"><span class="iss-mini-stat-label">Roster size</span><strong class="iss-mini-stat-value">${roster.length}</strong></div>
              <div class="iss-mini-stat"><span class="iss-mini-stat-label">Recent form</span><strong class="iss-mini-stat-value">${record.lastFive.join(' ') || '—'}</strong></div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;

  container.querySelector('#iss-team-hero-media')?.appendChild(
    createCandidateImg(teamLogoCandidates(selected), `${selected} logo`, 'iss-team-hero-logo')
  );

  container.querySelectorAll('[data-roster-player]').forEach(node => {
    const key = node.getAttribute('data-roster-player');
    const player = roster.find(p => String(p.id ?? p.tag ?? p.name) === key);
    if (!player) return;
    node.appendChild(createCandidateImg(playerImageCandidates(selected, player.tag || player.name), `${player.tag || player.name} portrait`, 'iss-roster-img'));
    node.appendChild(createCandidateImg(teamLogoCandidates(selected), `${selected} logo`, 'iss-roster-logo'));
  });

  container.querySelectorAll('[data-team-stat]').forEach(node => {
    const stat = node.getAttribute('data-team-stat');
    node.appendChild(createCandidateImg(teamStatCandidates(selected, stat), `${selected} ${stat}`, 'iss-team-stat-img'));
  });

  container.querySelector('#iss-team-select')?.addEventListener('change', (e) => {
    state.ui.selectedTeam = e.target.value;
    renderTeamsSection({ state, data });
  });
}
