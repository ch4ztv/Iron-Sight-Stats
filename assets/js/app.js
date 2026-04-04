import { APP_CONFIG } from './config.js';
import { state, setData, setSection, setUI } from './state.js';
import { loadAllData } from './data-loader.js';
import { fmtDate, fmtNum, safeKD, modeLabel, formatSeries } from './formatters.js';
import { teamLogoCandidates, playerImageCandidates, teamStatCandidates, brandingPath } from './asset-paths.js';

const $ = (sel, el=document) => el.querySelector(sel);

function teamName(id){ return APP_CONFIG.teamMeta[id]?.name || id; }
function teamAbbr(id){ return APP_CONFIG.teamMeta[id]?.abbr || String(id).toUpperCase(); }
function escapeAttr(value=''){
  return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function img(srcOrCandidates, cls, alt=''){
  const fallback = brandingPath('logo.png');
  const candidates = Array.isArray(srcOrCandidates)
    ? [...srcOrCandidates, fallback]
    : [srcOrCandidates, fallback];
  const first = candidates[0] || fallback;
  const encoded = escapeAttr(JSON.stringify(candidates));
  return `<img src="${first}" class="${cls||''}" alt="${escapeAttr(alt)}" data-candidates="${encoded}" data-candidate-index="0" onerror="(function(img){try{const list=JSON.parse(img.dataset.candidates||'[]');let i=Number(img.dataset.candidateIndex||0)+1;img.dataset.candidateIndex=String(i);if(i<list.length){img.src=list[i];return;}img.style.display='none';}catch(e){img.style.display='none';}})(this)">`;
}
function sectionHeader(title, desc='', extra=''){
  return `<div class="section-title"><div><h2>${title}</h2><p>${desc}</p></div>${extra}</div>`;
}
function teamChip(id){
  return `<span class="team-chip">${img(teamLogoCandidates(id),'mini-logo',teamName(id))}<span>${teamName(id)}</span></span>`;
}
function playerCard(player){
  return `<article class="card player-card">
    <div class="top">
      ${img(playerImageCandidates(player.teamId, player.name),'player-avatar',player.name)}
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
  const teamStats = state.data.teamStats[teamId];
  const roster = state.data.playersByTeam[teamId] || [];
  const rec = state.data.teamRecords[teamId] || {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
  $('#teams').innerHTML = `
    ${sectionHeader('Teams','Roster view, records, and imported team stat images.',
      `<div class="controls">
        <select id="teamSelect">${Object.keys(APP_CONFIG.teamMeta).map(id=>`<option value="${id}" ${id===teamId?'selected':''}>${teamName(id)}</option>`).join('')}</select>
      </div>`)}
    <div class="hero">
      <article class="card team-hero">
        ${img(teamLogoCandidates(teamId),'brand-logo',teamName(teamId))}
        <div>
          <h3 style="font-size:1.9rem">${teamName(teamId)}</h3>
          <div class="muted">Series ${rec.wins}-${rec.losses} · Maps ${rec.mapWins}-${rec.mapLosses}</div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            <span class="pill">Points ${state.data.teamPoints[teamId] || 0}</span>
            <span class="pill">Recent ${rec.recent.join(' ') || '—'}</span>
            <span class="pill">Confidence ${teamStats?.confidence || '—'}</span>
          </div>
        </div>
      </article>
      <article class="card">
        <h3>Imported notes</h3>
        <p class="muted">${teamStats?.notes || 'No parser notes available.'}</p>
      </article>
    </div>
    <div class="grid cols-2">
      <article class="card">
        <h3>Roster</h3>
        <div class="roster-grid">
          ${roster.map(p => `<div class="card" style="padding:14px">
            <div class="top" style="display:flex;gap:12px;align-items:center">
              ${img(playerImageCandidates(teamId,p.name),'player-avatar',p.name)}
              <div><strong>${p.name}</strong><div class="muted">${p.active ? 'Active' : 'Inactive'}</div></div>
            </div>
          </div>`).join('')}
        </div>
      </article>
      <article class="card">
        <h3>Overall player metrics</h3>
        <div class="table-wrap">
          <table><thead><tr><th>Player</th><th>KD</th><th>Slayer</th><th>Respawn KD</th><th>NTK%</th><th>BP</th></tr></thead>
          <tbody>
            ${(teamStats?.overall?.players || []).map(p => `<tr><td>${p.player}</td><td>${p.kd}</td><td>${p.slayerRating}</td><td>${p.respawnKd}</td><td>${p.ntkPct}</td><td>${p.bpRating}</td></tr>`).join('')}
          </tbody></table>
        </div>
      </article>
    </div>
    <div class="grid cols-3" style="margin-top:18px">
      ${['overall','hardpoint','search-and-destroy','overload','map-records','picks-vetoes'].map(key => `<article class="card">
        <h3>${key.replace(/-/g,' ')}</h3>
        ${img(teamStatCandidates(teamId,key),'',`${teamName(teamId)} ${key}`)}
      </article>`).join('')}
    </div>`;
  $('#teamSelect')?.addEventListener('change', e => { setUI('selectedTeam', e.target.value); renderTeams(); renderBetting(); renderMatchup(); });
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
