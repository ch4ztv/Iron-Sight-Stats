
import { teamLogoCandidates, playerImageCandidates, teamStatCandidates } from '../asset-paths.js';

function esc(str='') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function q(id){ return document.getElementById(id); }

function num(v){
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function imgWithFallback(candidates, cls, alt, extra=''){
  if (!candidates?.length) {
    return `<div class="${cls} iss-missing" ${extra}></div>`;
  }
  const first = candidates[0];
  const handler = candidates.slice(1).map(x => `'${x}'`).join(',');
  return `<img src="${first}" class="${cls}" alt="${esc(alt)}" data-fallbacks="[${handler}]"
    onerror="(function(img){try{const arr=JSON.parse(img.dataset.fallbacks||'[]');const next=arr.shift();img.dataset.fallbacks=JSON.stringify(arr);if(next){img.src=next;return;}img.style.display='none';const init=img.parentElement?.querySelector('.bp-player-init');if(init)init.style.display='flex';}catch(e){img.style.display='none';}})(this)">`;
}

function getGlobalData(){
  const src =
    window.ISS_DATA ||
    window.__ISS_DATA__ ||
    window.appState?.data ||
    {};
  const season = src.season || src;
  return {
    meta: src.meta || season.meta || {},
    matches: src.matches || season.matches || [],
    maps: src.maps || season.maps || [],
    players: src.players || season.players || [],
    points: src.points || season.points || [],
    teamStats: src.teamStats || src['team-stats'] || season.teamStats || season.team_stats || {},
  };
}

function getTeamsFromData(data){
  const map = new Map();
  (data.players || []).forEach(p => {
    if (!p?.teamId) return;
    if (!map.has(p.teamId)) {
      map.set(p.teamId, {
        id: p.teamId,
        name: p.teamName || titleize(p.teamId),
        shortName: p.teamAbbr || (p.teamId || '').toUpperCase(),
        color: p.teamColor || '#17ff6d',
      });
    }
  });
  (data.points || []).forEach(row => {
    if (!row?.teamId) return;
    if (!map.has(row.teamId)) {
      map.set(row.teamId, {
        id: row.teamId,
        name: row.teamName || titleize(row.teamId),
        shortName: row.teamAbbr || (row.teamId || '').toUpperCase(),
        color: row.teamColor || '#17ff6d',
      });
    }
  });
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

function titleize(value=''){
  return String(value).split(/[-_\s]+/).map(x => x ? x[0].toUpperCase()+x.slice(1) : '').join(' ');
}

function rosterForTeam(data, teamId){
  return (data.players || [])
    .filter(p => p.teamId === teamId)
    .sort((a,b) => Number(Boolean(b.active ?? true)) - Number(Boolean(a.active ?? true)) || String(a.name||'').localeCompare(String(b.name||'')));
}

function summaryForTeam(data, teamId){
  const matches = (data.matches || []).filter(m => m.team1Id === teamId || m.team2Id === teamId);
  let seriesW = 0, seriesL = 0, mapW = 0, mapL = 0;
  matches.forEach(match => {
    const maps = (data.maps || []).filter(mp => mp.matchId === match.id);
    let t = 0, o = 0;
    maps.forEach(mp => {
      if (mp.winner === teamId) { t++; mapW++; }
      else if (mp.winner) { o++; mapL++; }
    });
    if (t > o) seriesW++;
    if (o > t) seriesL++;
  });

  const pointsRows = (data.points || []).filter(p => p.teamId === teamId);
  const cdlPoints = pointsRows.reduce((sum, row) => sum + Number(row.points || row.cdlPoints || 0), 0);
  const rank = 1 + getTeamsFromData(data)
    .map(team => ({
      id: team.id,
      pts: (data.points || []).filter(p => p.teamId === team.id)
        .reduce((sum, row) => sum + Number(row.points || row.cdlPoints || 0), 0)
    }))
    .sort((a,b)=>b.pts-a.pts)
    .findIndex(x => x.id === teamId);

  return { seriesW, seriesL, mapW, mapL, cdlPoints, rank: rank > 0 ? rank : '—' };
}

function modeKeyToLabel(mode){
  return ({
    overall: 'Overall',
    hardpoint: 'Hardpoint',
    snd: 'S&D',
    overload: 'Overload',
    maprecords: 'Maps',
    picksvetos: 'Picks/Vetos',
  })[mode] || mode;
}

function parsedStatsForTeam(data, teamId){
  return data.teamStats?.[teamId] || null;
}

function renderParsedTable(stats, mode){
  if (!stats) return `<div class="team-empty">No parsed team stats available yet.</div>`;

  if (mode === 'overall' && stats.overall?.players?.length) {
    return renderPlayerMetricTable('Overall Stats', stats.overall.players, [
      ['player','Player','text'],
      ['kd','K/D','num'],
      ['slayerRating','Slayer RTG','num'],
      ['respawnKd','Respawn KD','num'],
      ['ntkPct','NTK%','num hi'],
      ['bpRating','BP Rating','num']
    ]);
  }
  if (mode === 'hardpoint' && stats.hardpoint?.players?.length) {
    return renderPlayerMetricTable('Hardpoint Stats', stats.hardpoint.players, [
      ['player','Player','text'],
      ['kd','K/D','num'],
      ['k10m','K/10m','num'],
      ['dmg10m','DMG/10m','num'],
      ['obj10m','OBJ/10m','num hi'],
      ['eng10m','Eng/10m','num']
    ]);
  }
  if (mode === 'snd' && stats.snd?.players?.length) {
    return renderPlayerMetricTable('Search & Destroy', stats.snd.players, [
      ['player','Player','text'],
      ['kd','K/D','num'],
      ['kRound','K/Round','num'],
      ['bloods','Bloods','num hi'],
      ['plants','Plants','num'],
      ['defuses','Defuses','num'],
      ['snipes','Snipes','num'],
      ['dmgRound','DMG/Round','num']
    ]);
  }
  if (mode === 'overload' && stats.overload?.players?.length) {
    return renderPlayerMetricTable('Overload Stats', stats.overload.players, [
      ['player','Player','text'],
      ['kd','K/D','num'],
      ['k10m','K/10m','num'],
      ['dmg10m','DMG/10m','num'],
      ['goals10m','Goals/10m','num hi'],
      ['eng10m','Eng/10m','num']
    ]);
  }
  if (mode === 'maprecords' && stats.mapRecords?.maps?.length) {
    const rows = stats.mapRecords.maps;
    const totals = stats.mapRecords.totals || {};
    return `
      <div class="team-parsed-head">
        <div><div class="label">Map Records</div><div class="title">Mode records by map</div></div>
      </div>
      <div class="tbl-wrap">
        <table class="ts-table">
          <thead><tr>
            <th>Map</th>
            <th class="num">HP W</th><th class="num">HP L</th>
            <th class="num">S&D W</th><th class="num">S&D L</th>
            <th class="num">OVL W</th><th class="num">OVL L</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${esc(r.map)}</strong></td>
                <td class="num">${num(r.hpW)}</td><td class="num">${num(r.hpL)}</td>
                <td class="num">${num(r.sndW)}</td><td class="num">${num(r.sndL)}</td>
                <td class="num">${num(r.ovlW)}</td><td class="num">${num(r.ovlL)}</td>
              </tr>`).join('')}
            <tr>
              <td><strong>Totals</strong></td>
              <td class="num hi">${num(totals.hpW)}</td><td class="num">${num(totals.hpL)}</td>
              <td class="num hi">${num(totals.sndW)}</td><td class="num">${num(totals.sndL)}</td>
              <td class="num hi">${num(totals.ovlW)}</td><td class="num">${num(totals.ovlL)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }
  if (mode === 'picksvetos' && stats.picksVetos?.maps?.length) {
    return `
      <div class="team-parsed-head">
        <div><div class="label">Picks / Vetos</div><div class="title">Map tendencies</div></div>
      </div>
      <div class="tbl-wrap">
        <table class="ts-table">
          <thead><tr>
            <th>Map</th>
            <th class="num">HP Pick</th><th class="num">HP Veto</th>
            <th class="num">S&D Pick</th><th class="num">S&D Veto</th>
            <th class="num">OVL Pick</th><th class="num">OVL Veto</th>
          </tr></thead>
          <tbody>
            ${stats.picksVetos.maps.map(r => `
              <tr>
                <td><strong>${esc(r.map)}</strong></td>
                <td class="num hi">${num(r.hpPick)}</td><td class="num">${num(r.hpVeto)}</td>
                <td class="num hi">${num(r.sndPick)}</td><td class="num">${num(r.sndVeto)}</td>
                <td class="num hi">${num(r.ovlPick)}</td><td class="num">${num(r.ovlVeto)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
  return `<div class="team-empty">No ${esc(modeKeyToLabel(mode))} parsed data for this team yet.</div>`;
}

function renderPlayerMetricTable(label, rows, columns){
  return `
    <div class="team-parsed-head">
      <div><div class="label">${esc(label)}</div><div class="title">Parsed from JSON</div></div>
    </div>
    <div class="tbl-wrap">
      <table class="ts-table">
        <thead><tr>${columns.map(c => `<th class="${c[2] === 'text' ? '' : 'num'}">${esc(c[1])}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${columns.map(col => {
                const key = col[0];
                const cls = col[2] === 'text' ? '' : 'num';
                const value = num(row[key]);
                const plus = col[2]?.includes('hi') ? ' hi' : '';
                return `<td class="${cls}${plus}">${esc(value)}</td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function fallbackStatImage(teamId, mode){
  const candidates = teamStatCandidates(teamId, mode);
  if (!candidates.length) return `<div class="bp-img-err">No stat image found.</div>`;
  const first = candidates[0];
  const handler = candidates.slice(1).map(x => `'${x}'`).join(',');
  return `
    <div class="bp-stat-frame">
      <img src="${first}" class="bp-stat-image" alt="${esc(modeKeyToLabel(mode))}"
        data-fallbacks="[${handler}]"
        onerror="(function(img){try{const arr=JSON.parse(img.dataset.fallbacks||'[]');const next=arr.shift();img.dataset.fallbacks=JSON.stringify(arr);if(next){img.src=next;return;}img.outerHTML='<div class=\\'bp-img-err\\'>📁 No parsed data and no stat image found for this mode.</div>';}catch(e){img.outerHTML='<div class=\\'bp-img-err\\'>📁 Missing team stat image.</div>';}})(this)">
    </div>`;
}

export function renderTeamsSection(){
  const mount = q('teams-section');
  if (!mount) return;

  const data = getGlobalData();
  const teams = getTeamsFromData(data);
  if (!teams.length) {
    mount.innerHTML = `<div class="iss-card team-empty">No teams available.</div>`;
    return;
  }

  window.ISS_TEAMS_UI = window.ISS_TEAMS_UI || { teamId: teams.find(t => t.id === 'optic')?.id || teams[0].id, mode: 'overall', showInactive: false };
  const ui = window.ISS_TEAMS_UI;
  const team = teams.find(t => t.id === ui.teamId) || teams[0];
  ui.teamId = team.id;

  const roster = rosterForTeam(data, team.id).filter(p => ui.showInactive ? true : (p.active ?? true));
  const summary = summaryForTeam(data, team.id);
  const parsed = parsedStatsForTeam(data, team.id);

  const modes = ['overall','hardpoint','snd','overload','maprecords','picksvetos'];

  mount.innerHTML = `
    <div class="team-shell">
      <div class="section-title">
        <h2>Teams</h2>
      </div>

      <div class="team-toolbar">
        <select id="team-selector" class="select" aria-label="Select team">
          ${teams.map(t => `<option value="${esc(t.id)}" ${t.id === team.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
        </select>
        <div class="team-logo-rail">
          ${teams.map(t => `
            <button class="team-mini-logo ${t.id === team.id ? 'active' : ''}" type="button" data-team-jump="${esc(t.id)}" title="${esc(t.name)}">
              ${imgWithFallback(teamLogoCandidates(t.id), '', t.name)}
              <span class="team-check">✓</span>
            </button>`).join('')}
        </div>
      </div>

      <div class="team-hero card">
        <div class="team-hero-grid">
          <div>
            <div class="team-hero-head">
              <div class="team-hero-logo">${imgWithFallback(teamLogoCandidates(team.id), '', team.name)}</div>
              <div class="team-hero-copy">
                <h1>${esc(team.name)}</h1>
                <p>${esc((team.shortName || team.id).toUpperCase())} · Season 2026</p>
              </div>
            </div>

            <div class="bp-roster-strip">
              ${roster.map(player => {
                const initials = (player.name || '').slice(0,3).toUpperCase();
                return `
                  <div class="bp-player-chip ${player.active === false ? 'bp-player-inactive' : ''}">
                    <div class="bp-player-art">
                      <div class="bp-player-backdrop">${imgWithFallback(teamLogoCandidates(team.id), '', team.name)}</div>
                      ${imgWithFallback(playerImageCandidates(team.id, player.name), 'bp-player-img', player.name)}
                      <div class="bp-player-init">${esc(initials || 'ISS')}</div>
                    </div>
                    <div class="bp-player-meta">
                      <div class="bp-player-name">${esc(player.name || 'Unknown')}</div>
                      ${player.active === false ? '<div class="bp-player-sub">Inactive</div>' : ''}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <div>
            <div class="team-kpis">
              <div class="team-kpi"><span class="v">${summary.seriesW}&ndash;${summary.seriesL}</span><span class="l">Series</span></div>
              <div class="team-kpi"><span class="v">${summary.mapW}&ndash;${summary.mapL}</span><span class="l">Maps</span></div>
              <div class="team-kpi"><span class="v">#${summary.rank}</span><span class="l">Rank</span></div>
              <div class="team-kpi"><span class="v">${summary.cdlPoints}</span><span class="l">CDL Pts</span></div>
              <button id="toggle-inactive" class="btn ghost" type="button">${ui.showInactive ? 'Hide Inactive' : 'Show Inactive'}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="bp-mode-bar">
        ${modes.map(mode => `<button class="bp-mode-btn ${ui.mode === mode ? 'active' : ''}" type="button" data-mode="${mode}">${modeKeyToLabel(mode)}</button>`).join('')}
      </div>

      <div class="team-parsed-wrap">
        ${parsed ? renderParsedTable(parsed, ui.mode) : fallbackStatImage(team.id, ui.mode)}
      </div>
    </div>
  `;

  q('team-selector')?.addEventListener('change', e => {
    ui.teamId = e.target.value;
    renderTeamsSection();
  });

  mount.querySelectorAll('[data-team-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.teamId = btn.getAttribute('data-team-jump');
      renderTeamsSection();
    });
  });

  mount.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.mode = btn.getAttribute('data-mode');
      renderTeamsSection();
    });
  });

  q('toggle-inactive')?.addEventListener('click', () => {
    ui.showInactive = !ui.showInactive;
    renderTeamsSection();
  });
}
