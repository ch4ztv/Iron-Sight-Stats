import { APP_CONFIG } from './config.js';
import { state, setData, setSection, setUI } from './state.js';
import { loadAllData } from './data-loader.js';
import { fmtDate, fmtNum, safeKD, modeLabel, formatSeries } from './formatters.js';
import { teamLogoPath, playerImagePath, teamStatPath } from './asset-paths.js';

const $ = (sel, el=document) => el.querySelector(sel);

function teamName(id){ return APP_CONFIG.teamMeta[id]?.name || id; }
function teamAbbr(id){ return APP_CONFIG.teamMeta[id]?.abbr || String(id).toUpperCase(); }
function img(src, cls, alt=''){
  return `<img src="${src}" class="${cls||''}" alt="${alt}" onerror="this.style.display='none'">`;
}
function sectionHeader(title, desc='', extra=''){
  return `<div class="section-title"><div><h2>${title}</h2><p>${desc}</p></div>${extra}</div>`;
}
function teamChip(id){
  return `<span class="team-chip">${img(teamLogoPath(id),'mini-logo',teamName(id))}<span>${teamName(id)}</span></span>`;
}

const TEAM_COLORS = {
  optic: { accent: '#b3dc39', glow: 'rgba(150,255,54,.26)', glowSoft: 'rgba(150,255,54,.14)', bright: '#00ff7f' },
  faze: { accent: '#ff5151', glow: 'rgba(255,81,81,.24)', glowSoft: 'rgba(255,81,81,.12)', bright: '#ff8f8f' },
  ravens: { accent: '#a86cff', glow: 'rgba(168,108,255,.24)', glowSoft: 'rgba(168,108,255,.12)', bright: '#d3b5ff' },
  g2: { accent: '#ff4df1', glow: 'rgba(255,77,241,.22)', glowSoft: 'rgba(255,77,241,.11)', bright: '#ff9cf7' },
  c9: { accent: '#67d1ff', glow: 'rgba(103,209,255,.22)', glowSoft: 'rgba(103,209,255,.11)', bright: '#9ae3ff' },
  lat: { accent: '#ff3e3e', glow: 'rgba(255,62,62,.22)', glowSoft: 'rgba(255,62,62,.11)', bright: '#ff9c9c' },
  miami: { accent: '#00c27b', glow: 'rgba(0,194,123,.24)', glowSoft: 'rgba(0,194,123,.12)', bright: '#5effbb' },
  toronto: { accent: '#8d7cff', glow: 'rgba(141,124,255,.24)', glowSoft: 'rgba(141,124,255,.12)', bright: '#c6bcff' },
  boston: { accent: '#74ff7a', glow: 'rgba(116,255,122,.24)', glowSoft: 'rgba(116,255,122,.12)', bright: '#a8ffac' },
  pgm: { accent: '#45ff9f', glow: 'rgba(69,255,159,.24)', glowSoft: 'rgba(69,255,159,.12)', bright: '#9affc6' },
  falcons: { accent: '#ff9b2f', glow: 'rgba(255,155,47,.24)', glowSoft: 'rgba(255,155,47,.12)', bright: '#ffc27c' },
  vancouver: { accent: '#2dd6ff', glow: 'rgba(45,214,255,.24)', glowSoft: 'rgba(45,214,255,.12)', bright: '#9bf0ff' }
};

function teamTheme(teamId){
  return TEAM_COLORS[teamId] || { accent: '#49d17d', glow: 'rgba(73,209,125,.22)', glowSoft: 'rgba(73,209,125,.11)', bright: '#7dffb7' };
}

function prettyLabel(key){
  const map = { kd:'K/D', ntkPct:'NTK%', bpRating:'BP Rating', slayerRating:'Slayer Rtg', respawnKd:'Respawn KD', k10m:'K/10m', dmg10m:'DMG/10m', obj10m:'OBJ/10m', eng10m:'Eng/10m', kRound:'K/Round', dmgRound:'DMG/Round', goals10m:'Goals/10m', hpW:'HP W', hpL:'HP L', sndW:'S&D W', sndL:'S&D L', ovlW:'OVL W', ovlL:'OVL L', hpPick:'HP Pick', hpVeto:'HP Veto', sndPick:'S&D Pick', sndVeto:'S&D Veto', ovlPick:'OVL Pick', ovlVeto:'OVL Veto' };
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s=>s.toUpperCase());
}

function renderValue(val){ return val == null || val === '' ? '—' : val; }
function playerCard(player){
  return `<article class="card player-card">
    <div class="top">
      ${img(playerImagePath(player.teamId, player.name),'player-avatar',player.name)}
      <div>
        <div class="muted">${teamName(player.teamId)}</div>
        <h3>${player.name}</h3>
      </div>
    </div>
    <div class="stat-list">
      <div class="stat-row"><span>KD</span><strong>${fmtNum(player.kd,2)}</strong></div>
      <div class="stat-row"><span>Kills</span><strong>${fmtNum(player.kills)}</strong></div>
      <div class="stat-row"><span>Deaths</span><strong>${fmtNum(player.deaths)}</strong></div>
      <div class="stat-row"><span>Damage / Map</span><strong>${fmtNum(player.dmgPerMap)}</strong></div>
      <div class="stat-row"><span>Maps</span><strong>${fmtNum(player.maps)}</strong></div>
    </div>
  </article>`;
}
function renderDashboard(){
  const { data } = state;
  const matches = [...(data.matches||[])].sort((a,b)=>b.ts-a.ts);
  const recent = matches.slice(0,5);
  const standings = getStandings().slice(0,5);
  const topPlayers = [...data.playerAggList].sort((a,b)=>b.kd-a.kd).slice(0,4);

  $('#dashboard').innerHTML = `
    ${sectionHeader('Dashboard','Season snapshot, recent results, and quick leaders.')}
    <div class="hero">
      <article class="card hero-card">
        <div class="pill">Live data package · ${data.meta?.app || 'Iron Sight Stats'}</div>
        <h3 style="font-size:2rem;margin-top:14px;">Public CDL hub built for standings, stats, match tracking, and betting context.</h3>
        <p class="muted">This public build reads static JSON and normalized assets, making it GitHub Pages friendly and easy to update.</p>
      </article>
      <div class="grid cols-2">
        <article class="card kpi"><span class="label">Matches</span><span class="value">${fmtNum(data.matches?.length||0)}</span></article>
        <article class="card kpi"><span class="label">Maps</span><span class="value">${fmtNum(data.maps?.length||0)}</span></article>
        <article class="card kpi"><span class="label">Players</span><span class="value">${fmtNum(data.playerAggList?.length||0)}</span></article>
        <article class="card kpi"><span class="label">Teams</span><span class="value">${fmtNum(Object.keys(APP_CONFIG.teamMeta).length)}</span></article>
      </div>
    </div>

    <div class="grid cols-2">
      <article class="card">
        <h3>Top 5 standings</h3>
        <div class="table-wrap">
          <table><thead><tr><th>#</th><th>Team</th><th>Pts</th><th>Record</th></tr></thead>
            <tbody>
              ${standings.map((row,i)=>`<tr><td>${i+1}</td><td>${teamChip(row.teamId)}</td><td>${row.pts}</td><td>${row.wins}-${row.losses}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>
      <article class="card">
        <h3>Recent matches</h3>
        <div class="grid">
          ${recent.map(match => {
            const maps = data.mapsByMatch[match.id] || [];
            const s1 = match.seriesScore1 ?? maps.filter(m=>m.winner===match.team1Id).length;
            const s2 = match.seriesScore2 ?? maps.filter(m=>m.winner===match.team2Id).length;
            return `<div class="match-card">
              <div class="match-head">
                <div>
                  <div class="muted">${match.eventId} · ${fmtDate(match.date)} · ${match.time || ''}</div>
                  <div class="match-teams">
                    <div class="match-team">${img(teamLogoPath(match.team1Id),'mini-logo',teamName(match.team1Id))}<strong>${teamName(match.team1Id)}</strong></div>
                    <div class="match-team">${img(teamLogoPath(match.team2Id),'mini-logo',teamName(match.team2Id))}<strong>${teamName(match.team2Id)}</strong></div>
                  </div>
                </div>
                <div class="score-badge">${s1}-${s2}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </article>
    </div>

    <article class="card" style="margin-top:18px">
      <h3>Top KD leaders</h3>
      <div class="player-grid">${topPlayers.map(playerCard).join('')}</div>
    </article>
  `;
}

function getStandings(){
  const rows = Object.keys(APP_CONFIG.teamMeta).map(teamId => {
    const rec = state.data.teamRecords[teamId] || {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
    return {
      teamId,
      pts: state.data.teamPoints[teamId] || 0,
      wins: rec.wins,
      losses: rec.losses,
      mapWins: rec.mapWins,
      mapLosses: rec.mapLosses,
      mapDiff: rec.mapWins - rec.mapLosses,
      recent: rec.recent.join('')
    };
  });
  rows.sort((a,b)=> b.pts-a.pts || b.wins-a.wins || b.mapDiff-a.mapDiff || a.teamId.localeCompare(b.teamId));
  return rows;
}
function renderStandings(){
  const rows = getStandings();
  $('#standings').innerHTML = `
    ${sectionHeader('Standings','Points combined with series and map performance.')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Team</th><th>Points</th><th>Series</th><th>Map Record</th><th>Map Diff</th><th>Recent</th></tr></thead>
        <tbody>
          ${rows.map((row,i)=>`<tr>
            <td>${i+1}</td>
            <td>${teamChip(row.teamId)}</td>
            <td>${row.pts}</td>
            <td>${row.wins}-${row.losses}</td>
            <td>${row.mapWins}-${row.mapLosses}</td>
            <td>${row.mapDiff > 0 ? '+' : ''}${row.mapDiff}</td>
            <td>${row.recent || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderMatches(){
  const data = state.data;
  const filter = state.ui.matchFilter;
  const options = ['all', ...Object.keys(APP_CONFIG.teamMeta)];
  let matches = [...data.matches].sort((a,b)=>b.ts-a.ts);
  if(filter !== 'all'){
    matches = matches.filter(m => m.team1Id===filter || m.team2Id===filter);
  }
  $('#matches').innerHTML = `
    ${sectionHeader('Matches','Series results with map-by-map detail.',
      `<div class="controls"><select id="matchFilter">${options.map(id=>`<option value="${id}" ${filter===id?'selected':''}>${id==='all'?'All teams':teamName(id)}</option>`).join('')}</select></div>`)}
    <div class="grid">
      ${matches.slice(0,60).map(match => {
        const maps = data.mapsByMatch[match.id] || [];
        const s1 = match.seriesScore1 ?? maps.filter(m=>m.winner===match.team1Id).length;
        const s2 = match.seriesScore2 ?? maps.filter(m=>m.winner===match.team2Id).length;
        return `<article class="card match-card">
          <div class="match-head">
            <div>
              <div class="muted">${match.eventId} · ${fmtDate(match.date)} · ${match.time || ''} · ${match.format}</div>
              <div class="match-teams">
                <div class="match-team">${img(teamLogoPath(match.team1Id),'mini-logo',teamName(match.team1Id))}<strong>${teamName(match.team1Id)}</strong></div>
                <div class="match-team">${img(teamLogoPath(match.team2Id),'mini-logo',teamName(match.team2Id))}<strong>${teamName(match.team2Id)}</strong></div>
              </div>
            </div>
            <div class="score-badge">${s1}-${s2}</div>
          </div>
          <div class="map-grid">
            ${maps.length ? maps.map(map => `<div class="map-tile">
              <div class="pill">${modeLabel(map.mode)} · Map ${map.mapNum}</div>
              <h3 style="margin-top:10px">${map.mapName}</h3>
              <div class="muted">${map.score1} - ${map.score2}</div>
              <div style="margin-top:8px"><strong>${teamName(map.winner)}</strong></div>
            </div>`).join('') : '<div class="empty">No map detail available yet.</div>'}
          </div>
        </article>`;
      }).join('')}
    </div>`;
  $('#matchFilter')?.addEventListener('change', e => { setUI('matchFilter', e.target.value); renderMatches(); });
}

function renderPlayers(){
  const search = state.ui.playerSearch.trim().toLowerCase();
  const sort = state.ui.playerSort;
  let rows = [...state.data.playerAggList];
  if(search){
    rows = rows.filter(p => p.name.toLowerCase().includes(search) || teamName(p.teamId).toLowerCase().includes(search));
  }
  rows.sort((a,b)=>{
    if(sort==='kills') return b.kills-a.kills;
    if(sort==='damage') return b.damage-a.damage;
    return b.kd-a.kd;
  });
  $('#players').innerHTML = `
    ${sectionHeader('Players','Aggregated player performance from player-stats.json.',
      `<div class="controls">
        <input id="playerSearch" placeholder="Search players or teams" value="${state.ui.playerSearch.replace(/"/g,'&quot;')}">
        <select id="playerSort">
          <option value="kd" ${sort==='kd'?'selected':''}>Sort by KD</option>
          <option value="kills" ${sort==='kills'?'selected':''}>Sort by kills</option>
          <option value="damage" ${sort==='damage'?'selected':''}>Sort by damage</option>
        </select>
      </div>`)}
    <div class="player-grid">
      ${rows.slice(0,80).map(playerCard).join('')}
    </div>`;
  $('#playerSearch')?.addEventListener('input', e => { setUI('playerSearch', e.target.value); renderPlayers(); });
  $('#playerSort')?.addEventListener('change', e => { setUI('playerSort', e.target.value); renderPlayers(); });
}

function renderTeams(){
  const teamId = state.ui.selectedTeam;
  const teamIdNorm = teamId;
  const theme = teamTheme(teamIdNorm);
  const teamStats = state.data.teamStats[teamIdNorm] || {};
  const roster = state.data.playersByTeam[teamIdNorm] || [];
  const rec = state.data.teamRecords[teamIdNorm] || {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
  const standings = getStandings();
  const standingIndex = Math.max(1, standings.findIndex(r=>r.teamId===teamIdNorm)+1);
  const activeTab = state.ui.teamTab || 'overall';
  const tabDefs = [
    ['overall','📊 Overall'],
    ['hardpoint','🏳️ Hardpoint'],
    ['snd','💣 S&D'],
    ['overload','🎯 Overload'],
    ['mapRecords','🗺️ Maps'],
    ['picksVetos','🔀 Picks/Vetoes']
  ];

  const panel = teamStats[activeTab] || {};
  const rows = panel.players || panel.maps || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const logoRows = Object.keys(APP_CONFIG.teamMeta).map(id => `
    <button class="iss-mini-logo-btn ${id===teamIdNorm?'active':''}" data-team-logo-btn="${id}" aria-label="${teamName(id)}">
      <img src="${teamLogoPath(id)}" alt="${teamName(id)}" onerror="this.style.display='none'">
    </button>`).join('');

  const rowHtml = roster.map(p => `
    <article class="iss-roster-card">
      <img class="iss-roster-backdrop" src="${teamLogoPath(teamIdNorm)}" alt="" aria-hidden="true" onerror="this.style.display='none'">
      <img class="iss-roster-photo" src="${playerImagePath(teamIdNorm, p.name)}" alt="${p.name}" onerror="this.onerror=null;this.src='./assets/img/branding/logo.png';this.style.objectFit='contain';this.style.padding='30px'">
      <div class="iss-roster-name">${p.name}</div>
    </article>`).join('');

  const tableHtml = rows.length ? `
    <div class="table-wrap">
      <table class="iss-team-table">
        <thead><tr>${columns.map(c=>`<th>${prettyLabel(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(row => {
            const numericKeys = columns.filter(c => c !== 'player' && c !== 'map');
            const maxKey = numericKeys.reduce((best, key) => {
              const v = Number(row[key]);
              const b = Number(row[best]);
              if (!Number.isFinite(v)) return best;
              if (!Number.isFinite(b)) return key;
              return v > b ? key : best;
            }, numericKeys[0]);
            return `<tr>${columns.map(c => {
              const cls = (c === 'player' || c === 'map') ? 'iss-player-col' : (c === maxKey ? 'iss-highlight' : '');
              return `<td class="${cls}">${renderValue(row[c])}</td>`;
            }).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : `<div class="empty">No parsed data found for this tab yet.</div><div style="margin-top:12px">${img(teamStatPath(teamIdNorm, activeTab.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())),'',`${teamName(teamIdNorm)} ${activeTab}`)}</div>`;

  $('#teams').innerHTML = `
    <div class="iss-team-page" style="--team-accent:${theme.accent};--team-glow:${theme.glow};--team-glow-soft:${theme.glowSoft};--team-bright:${theme.bright};">
      ${sectionHeader('Teams','')}
      <div class="iss-team-strip">
        <div class="iss-team-strip-left">
          <img class="iss-team-badge" src="${teamLogoPath(teamIdNorm)}" alt="${teamName(teamIdNorm)}" onerror="this.style.display='none'">
          <select id="teamSelect" class="iss-team-select">${Object.keys(APP_CONFIG.teamMeta).map(id=>`<option value="${id}" ${id===teamIdNorm?'selected':''}>${teamName(id)}</option>`).join('')}</select>
        </div>
        <div class="iss-team-logo-row">${logoRows}</div>
      </div>

      <section class="iss-team-shell">
        <div class="iss-team-hero-wrap">
          <div class="iss-team-hero">
            <div class="iss-team-hero-main">
              <img class="iss-team-hero-logo" src="${teamLogoPath(teamIdNorm)}" alt="${teamName(teamIdNorm)}" onerror="this.style.display='none'">
              <div>
                <h2 class="iss-team-title">${teamName(teamIdNorm)}</h2>
                <div class="iss-team-sub">${APP_CONFIG.teamMeta[teamIdNorm]?.abbr || teamIdNorm.toUpperCase()} · Season 2026</div>
              </div>
            </div>
            <div class="iss-team-summary">
              <div class="iss-summary-box"><strong>${rec.wins}-${rec.losses}</strong><span>Series</span></div>
              <div class="iss-summary-box"><strong>${rec.mapWins}-${rec.mapLosses}</strong><span>Maps</span></div>
              <div class="iss-summary-box"><strong>#${standingIndex}</strong><span>Rank</span></div>
              <div class="iss-summary-box"><strong>${state.data.teamPoints[teamIdNorm] || 0}</strong><span>CDL Pts</span></div>
              <div class="iss-summary-box iss-summary-box--button">Show Inactive</div>
            </div>
          </div>

          <div class="iss-roster-grid">${rowHtml || '<div class="empty">No roster found.</div>'}</div>
        </div>
      </section>

      <div class="iss-team-tabs">
        ${tabDefs.map(([key,label]) => `<button class="iss-tab-btn ${key===activeTab?'active':''}" data-team-tab="${key}">${label}</button>`).join('')}
      </div>

      <section class="iss-team-table-shell">
        <div class="iss-table-title">
          <h3>${prettyLabel(activeTab)} Stats</h3>
          <div class="iss-parsed-note">Parsed ${teamStats.parsedAt ? new Date(teamStats.parsedAt).toLocaleString() : '—'} · <a href="#" style="color:#66b7ff">Re-parse →</a></div>
        </div>
        ${tableHtml}
      </section>

      <div class="iss-bottom-tabs">
        <span class="iss-bottom-pill">👥 Overview</span>
        <span class="iss-bottom-pill">📈 Splits</span>
        <span class="iss-bottom-pill">📋 Matches</span>
        <span class="iss-bottom-pill">🧾 Parse Stats</span>
      </div>
    </div>`;

  $('#teamSelect')?.addEventListener('change', e => { setUI('selectedTeam', e.target.value); renderTeams(); renderBetting(); renderMatchup(); });
  document.querySelectorAll('[data-team-logo-btn]').forEach(btn => btn.addEventListener('click', () => { setUI('selectedTeam', btn.dataset.teamLogoBtn); renderTeams(); renderBetting(); renderMatchup(); }));
  document.querySelectorAll('[data-team-tab]').forEach(btn => btn.addEventListener('click', () => { setUI('teamTab', btn.dataset.teamTab); renderTeams(); }));
}

function recentFormScore(teamId){
  const rec = state.data.teamRecords[teamId] || {recent:[]};
  return (rec.recent || []).reduce((acc,r)=>acc + (r==='W' ? 1 : -1), 0);
}
function renderBetting(){
  const a = state.ui.selectedTeam;
  const b = state.ui.selectedTeamB;
  const recA = state.data.teamRecords[a] || {wins:0,losses:0,recent:[]};
  const recB = state.data.teamRecords[b] || {wins:0,losses:0,recent:[]};
  const coeff = state.data.bpr || {};
  const overallA = Number(state.data.teamStats[a]?.overall?.players?.[0]?.bpRating || 1);
  const overallB = Number(state.data.teamStats[b]?.overall?.players?.[0]?.bpRating || 1);
  const scoreA = (state.data.teamPoints[a] || 0) + recentFormScore(a)*6 + overallA*25;
  const scoreB = (state.data.teamPoints[b] || 0) + recentFormScore(b)*6 + overallB*25;
  const lean = scoreA === scoreB ? 'Even' : scoreA > scoreB ? teamName(a) : teamName(b);
  $('#betting').innerHTML = `
    ${sectionHeader('Betting Lab','Public-facing lean tools using team form, points, and imported coefficient context.',
      `<div class="controls">
        <select id="betTeamA">${Object.keys(APP_CONFIG.teamMeta).map(id=>`<option value="${id}" ${id===a?'selected':''}>Team A · ${teamName(id)}</option>`).join('')}</select>
        <select id="betTeamB">${Object.keys(APP_CONFIG.teamMeta).map(id=>`<option value="${id}" ${id===b?'selected':''}>Team B · ${teamName(id)}</option>`).join('')}</select>
      </div>`)}
    <div class="grid cols-3">
      <article class="card kpi"><span class="label">Model lean</span><span class="value" style="font-size:1.4rem">${lean}</span></article>
      <article class="card kpi"><span class="label">${teamName(a)} score</span><span class="value">${fmtNum(scoreA,1)}</span></article>
      <article class="card kpi"><span class="label">${teamName(b)} score</span><span class="value">${fmtNum(scoreB,1)}</span></article>
    </div>
    <div class="grid cols-2" style="margin-top:18px">
      <article class="card">
        <h3>Coefficient snapshot</h3>
        <div class="stat-list">
          ${Object.entries(coeff).map(([mode,obj]) => `<div class="stat-row"><span>${modeLabel(mode)}</span><strong>Kill ${obj.killWeight ?? '—'} · Assist ${obj.assistWeight ?? '—'} · Damage ${obj.damageWeight ?? '—'}</strong></div>`).join('')}
        </div>
      </article>
      <article class="card">
        <h3>Recent form</h3>
        <div class="stat-list">
          <div class="stat-row"><span>${teamName(a)}</span><strong>${recA.recent?.join(' ') || '—'} · ${recA.wins}-${recA.losses}</strong></div>
          <div class="stat-row"><span>${teamName(b)}</span><strong>${recB.recent?.join(' ') || '—'} · ${recB.wins}-${recB.losses}</strong></div>
        </div>
      </article>
    </div>`;
  $('#betTeamA')?.addEventListener('change', e => { setUI('selectedTeam', e.target.value); renderTeams(); renderBetting(); renderMatchup(); });
  $('#betTeamB')?.addEventListener('change', e => { setUI('selectedTeamB', e.target.value); renderBetting(); renderMatchup(); });
}

function renderBrackets(){
  $('#brackets').innerHTML = `
    ${sectionHeader('Brackets','Major event bracket pages and bracket-data summary.')}
    <div class="controls">
      <a class="pill" href="./brackets/major-1.html" target="_blank" rel="noopener">Open Major 1</a>
      <a class="pill" href="./brackets/major-2.html" target="_blank" rel="noopener">Open Major 2</a>
    </div>
    <div class="embed-wrap"><iframe src="./brackets/major-2.html" title="Major 2 bracket"></iframe></div>
  `;
}

function renderMatchup(){
  const a = state.ui.selectedTeam;
  const b = state.ui.selectedTeamB;
  const ra = state.data.teamRecords[a] || {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
  const rb = state.data.teamRecords[b] || {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
  $('#matchup').innerHTML = `
    ${sectionHeader('Matchup','Quick compare shell for two selected teams.')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Metric</th><th>${teamName(a)}</th><th>${teamName(b)}</th></tr></thead>
        <tbody>
          <tr><td>Points</td><td>${state.data.teamPoints[a] || 0}</td><td>${state.data.teamPoints[b] || 0}</td></tr>
          <tr><td>Series record</td><td>${ra.wins}-${ra.losses}</td><td>${rb.wins}-${rb.losses}</td></tr>
          <tr><td>Map record</td><td>${ra.mapWins}-${ra.mapLosses}</td><td>${rb.mapWins}-${rb.mapLosses}</td></tr>
          <tr><td>Recent form</td><td>${ra.recent.join(' ') || '—'}</td><td>${rb.recent.join(' ') || '—'}</td></tr>
          <tr><td>Parser confidence</td><td>${state.data.teamStats[a]?.confidence || '—'}</td><td>${state.data.teamStats[b]?.confidence || '—'}</td></tr>
        </tbody>
      </table>
    </div>`;
}

function applyRoute(){
  const hash = (location.hash || `#${APP_CONFIG.defaultSection}`).replace('#','');
  const section = APP_CONFIG.sections.includes(hash) ? hash : APP_CONFIG.defaultSection;
  setSection(section);
  document.querySelectorAll('.page-section').forEach(el => el.classList.toggle('active', el.id === section));
  document.querySelectorAll('.site-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${section}`));
}

function attachGlobalEvents(){
  $('#mobileMenuBtn')?.addEventListener('click', () => $('#siteNav')?.classList.toggle('open'));
  window.addEventListener('hashchange', applyRoute);
}

async function init(){
  try{
    const data = await loadAllData();
    setData(data);
    document.getElementById('footerMeta').textContent = `${data.meta?.app || 'Iron Sight Stats'} · Exported ${new Date(data.meta?.exported || Date.now()).toLocaleString()}`;

    renderDashboard();
    renderStandings();
    renderMatches();
    renderPlayers();
    renderTeams();
    renderBetting();
    renderBrackets();
    renderMatchup();
    applyRoute();
    attachGlobalEvents();
  }catch(err){
    console.error(err);
    document.querySelector('.site-main').innerHTML = `<section class="page-section active"><div class="notice">The app could not finish loading. Check the browser console for the exact file that failed.</div><pre class="card" style="white-space:pre-wrap;margin-top:16px">${err.message}</pre></section>`;
  }
}
init();
