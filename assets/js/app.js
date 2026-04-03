import { APP_CONFIG } from './config.js';
import { state, setData, setSection, setUI } from './state.js';
import { loadAllData } from './data-loader.js';
import { fmtDate, fmtNum, safeKD, modeLabel, formatSeries } from './formatters.js';
import { teamLogoCandidates, teamLogoPath, playerImageCandidates, playerImagePath, teamStatCandidates, teamStatPath } from './asset-paths.js';

const $ = (sel, el=document) => el.querySelector(sel);

const TEAM_COLORS = {
  optic: '181,220,72',
  faze: '255,72,72',
  lat: '255,70,70',
  toronto: '143,82,255',
  g2: '173,71,255',
  falcons: '255,136,42',
  miami: '66,211,163',
  ravens: '130,102,255',
  boston: '72,255,126',
  c9: '79,188,255',
  vancouver: '59,201,255',
  pgm: '0,255,179'
};


function teamName(id){ return APP_CONFIG.teamMeta[id]?.name || id; }
function teamAbbr(id){ return APP_CONFIG.teamMeta[id]?.abbr || String(id).toUpperCase(); }
function teamColor(id){ return TEAM_COLORS[id] || '0,255,102'; }
function escapeAttr(value=''){ return String(value).replace(/"/g,'&quot;'); }
function img(src, cls, alt=''){
  return `<img src="${src}" class="${cls||''}" alt="${alt}" onerror="this.style.display='none'">`;
}
function candidateImg(candidates, cls, alt=''){
  const safe = candidates.map(escapeAttr).join('|');
  return `<img src="${escapeAttr(candidates[0] || '')}" data-candidates="${safe}" data-candidate-index="0" class="${cls||''}" alt="${alt}" onerror="window.ISSHandleCandidateError && window.ISSHandleCandidateError(this)">`;
}
function sectionHeader(title, desc='', extra=''){
  return `<div class="section-title"><div><h2>${title}</h2><p>${desc}</p></div>${extra}</div>`;
}
function teamChip(id){
  return `<span class="team-chip">${img(teamLogoPath(id),'mini-logo',teamName(id))}<span>${teamName(id)}</span></span>`;
}
function playerMediaCard(player, compact=false){
  const color = teamColor(player.teamId);
  const portrait = playerImagePath(player.teamId, player.name);
  return `<article class="player-card" style="--team-rgb:${color}">
    <div class="top">
      <img src="${teamLogoPath(player.teamId)}" class="team-backdrop-logo" alt="${teamName(player.teamId)} logo" aria-hidden="true">
      ${img(portrait,'player-avatar',player.name)}
      <div>
        <div class="muted">${teamName(player.teamId)}</div>
        <h3 style="margin:6px 0 0;font-size:${compact ? '1.15rem' : '1.35rem'}">${player.name}</h3>
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
function playerCard(player){
  return playerMediaCard(player, true);
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
  const activeTab = state.ui.selectedTeamTab || 'overall';
  const showInactive = Boolean(state.ui.showInactivePlayers);
  const teamStats = state.data.teamStats[teamId] || {};
  const rosterAll = state.data.playersByTeam[teamId] || [];
  const roster = showInactive ? rosterAll : rosterAll.filter(p => p.active !== false);
  const rec = state.data.teamRecords[teamId] || {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
  const color = teamColor(teamId);
  const teamIds = Object.keys(APP_CONFIG.teamMeta);
  const tabs = [
    { id: 'overall', label: '📊 Overall' },
    { id: 'hardpoint', label: '🏁 Hardpoint' },
    { id: 'snd', label: '💣 S&D' },
    { id: 'overload', label: '🎯 Overload' },
    { id: 'maps', label: '🗺️ Maps' },
    { id: 'picks', label: '☒ Picks/Vetoes' }
  ];

  const totalTrophies = Math.max(0, Math.round((state.data.teamPoints[teamId] || 0) / 100));
  const lastFive = (rec.recent || []).slice(-5);
  const recentMatches = [...(state.data.matches || [])]
    .filter(m => m.team1Id === teamId || m.team2Id === teamId)
    .sort((a,b)=>b.ts-a.ts)
    .slice(0,5);

  const renderPlayerTable = (players=[]) => {
    if(!players.length) return `<div class="empty">No parsed player stats found for this tab yet.</div>`;
    const headers = Object.keys(players[0]);
    return `<div class="team-table-wrap"><table><thead><tr>${headers.map(key => `<th>${String(key).replace(/([A-Z])/g,' $1').replace(/^./, m => m.toUpperCase())}</th>`).join('')}</tr></thead><tbody>${players.map(row => `<tr>${headers.map(key => `<td>${row[key] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };

  const renderMapRecords = (section={}) => {
    const maps = section.maps || [];
    if(!maps.length) return `<div class="empty">No map records parsed for this team yet.</div>`;
    return `<div class="team-table-wrap"><table><thead><tr><th>Map</th><th>HP</th><th>S&D</th><th>Overload</th></tr></thead><tbody>${maps.map(row => `<tr><td>${row.map}</td><td>${(row.hpW ?? 0)}-${(row.hpL ?? 0)}</td><td>${(row.sndW ?? 0)}-${(row.sndL ?? 0)}</td><td>${(row.ovlW ?? 0)}-${(row.ovlL ?? 0)}</td></tr>`).join('')}</tbody></table></div>`;
  };

  const renderPicks = (section={}) => {
    const maps = section.maps || [];
    if(!maps.length) return `<div class="empty">No picks/vetoes parsed for this team yet.</div>`;
    return `<div class="team-table-wrap"><table><thead><tr><th>Map</th><th>HP Pick/Veto</th><th>S&D Pick/Veto</th><th>Overload Pick/Veto</th></tr></thead><tbody>${maps.map(row => `<tr><td>${row.map}</td><td>${row.hpPick ?? '—'} / ${row.hpVeto ?? '—'}</td><td>${row.sndPick ?? '—'} / ${row.sndVeto ?? '—'}</td><td>${row.ovlPick ?? '—'} / ${row.ovlVeto ?? '—'}</td></tr>`).join('')}</tbody></table></div>`;
  };

  const currentPanel = (() => {
    if(activeTab === 'maps') return renderMapRecords(teamStats.mapRecords || {});
    if(activeTab === 'picks') return renderPicks(teamStats.picksVetos || {});
    if(activeTab === 'snd') return renderPlayerTable(teamStats.snd?.players || []);
    return renderPlayerTable(teamStats[activeTab]?.players || []);
  })();

  const imagePanels = [
    ['overall','overall'],
    ['hardpoint','hardpoint'],
    ['search-and-destroy','search and destroy']
  ];

  $('#teams').innerHTML = `
    ${sectionHeader('Teams','Closer to the original DB look: branded hero, portrait roster cards, and parsed mode splits.')}
    <section class="teams-shell" style="--team-rgb:${color}">
      <div class="teams-toolbar">
        <select id="teamSelect" class="iss-select">${teamIds.map(id=>`<option value="${id}" ${id===teamId?'selected':''}>${teamName(id)}</option>`).join('')}</select>
        <div class="team-logo-row">${teamIds.map(id => `<button class="team-logo-btn ${id===teamId?'active':''}" data-team-logo="${id}" aria-label="Select ${teamName(id)}">${img(teamLogoPath(id),'',teamName(id))}</button>`).join('')}</div>
      </div>

      <article class="team-hero-card">
        <div class="team-hero-top">
          <div>
            <div class="team-identity">
              ${img(teamLogoPath(teamId),'',teamName(teamId))}
              <div>
                <h3>${teamName(teamId)}</h3>
                <p>${teamAbbr(teamId)} · Season 2026</p>
              </div>
            </div>
          </div>
          <div class="team-summary-grid">
            <div class="team-summary-box"><span class="value">${rec.wins}-${rec.losses}</span><span class="label">Series</span></div>
            <div class="team-summary-box"><span class="value">${rec.mapWins}-${rec.mapLosses}</span><span class="label">Maps</span></div>
            <div class="team-summary-box"><span class="value">#${getStandings().findIndex(r => r.teamId === teamId) + 1}</span><span class="label">Rank</span></div>
            <div class="team-summary-box"><span class="value">${state.data.teamPoints[teamId] || 0}</span><span class="label">CDL Pts</span></div>
            <button class="team-inactive-toggle" id="teamInactiveToggle">${showInactive ? 'Hide inactive' : 'Show inactive'}</button>
          </div>
        </div>

        <div class="team-divider"></div>
        <div class="team-roster-grid">
          ${roster.length ? roster.map(player => `
            <article class="team-portrait-card">
              ${candidateImg(teamLogoCandidates(teamId),'team-backdrop-logo',`${teamName(teamId)} logo`) }
              ${candidateImg(playerImageCandidates(teamId, player.name),'team-portrait-image',player.name)}
              <div class="team-portrait-name">${player.name}</div>
            </article>`).join('') : '<div class="empty">No active roster entries available.</div>'}
        </div>
      </article>

      <div class="team-tabs">
        ${tabs.map(tab => `<button class="team-tab ${tab.id===activeTab?'active':''}" data-team-tab="${tab.id}">${tab.label}</button>`).join('')}
      </div>

      <section class="team-tab-panel">
        <div class="team-panel-label">${tabs.find(tab => tab.id===activeTab)?.label || 'Overview'} stats</div>
        ${currentPanel}
        ${teamStats.parsedAt ? `<div class="muted" style="margin-top:10px">Parsed ${new Date(teamStats.parsedAt).toLocaleString()} · ${teamStats.notes || ''}</div>` : ''}
      </section>

      <div class="team-lower-grid">
        <section class="team-subpanel">
          <h3>Trophy Case</h3>
          <div class="trophy-grid">
            <div class="trophy-card"><strong>${totalTrophies}</strong><span class="muted">Majors / wins</span></div>
            <div class="trophy-card"><strong>${Math.max(1, Math.round(rec.wins / 8))}</strong><span class="muted">Finals</span></div>
            <div class="trophy-card"><strong>${teamStats.confidence || 'high'}</strong><span class="muted">Parser confidence</span></div>
            <div class="trophy-card"><strong>${roster.length}</strong><span class="muted">Active core</span></div>
          </div>

          <h3 style="margin-top:18px">Recent Form</h3>
          <div class="recent-form-list">
            ${recentMatches.map(match => {
              const isTeam1 = match.team1Id === teamId;
              const maps = state.data.mapsByMatch[match.id] || [];
              const scoreA = match.seriesScore1 ?? maps.filter(m => m.winner === match.team1Id).length;
              const scoreB = match.seriesScore2 ?? maps.filter(m => m.winner === match.team2Id).length;
              const myScore = isTeam1 ? scoreA : scoreB;
              const oppScore = isTeam1 ? scoreB : scoreA;
              const oppId = isTeam1 ? match.team2Id : match.team1Id;
              const result = myScore >= oppScore ? 'W' : 'L';
              return `<div class="recent-form-item"><div><strong>${teamName(teamId)} vs ${teamName(oppId)}</strong><div class="muted">${match.eventId} · ${fmtDate(match.date)} · ${match.format}</div></div><div class="recent-form-pill ${result==='W'?'win':'loss'}">${result} ${myScore}-${oppScore}</div></div>`;
            }).join('') || '<div class="empty">No recent matches loaded for this team yet.</div>'}
          </div>
        </section>

        <section class="team-subpanel">
          <h3>Imported team stat panels</h3>
          <div class="team-image-grid">
            ${imagePanels.map(([key,label]) => `<article class="team-image-card"><h4>${label}</h4>${img(teamStatPath(teamId,key),'',`${teamName(teamId)} ${label}`)}</article>`).join('')}
          </div>
        </section>
      </div>
    </section>`;

  $('#teamSelect')?.addEventListener('change', e => { setUI('selectedTeam', e.target.value); renderTeams(); renderBetting(); renderMatchup(); });
  $('#teamInactiveToggle')?.addEventListener('click', () => { setUI('showInactivePlayers', !showInactive); renderTeams(); });
  document.querySelectorAll('[data-team-logo]').forEach(btn => btn.addEventListener('click', () => { setUI('selectedTeam', btn.dataset.teamLogo); renderTeams(); renderBetting(); renderMatchup(); }));
  document.querySelectorAll('[data-team-tab]').forEach(btn => btn.addEventListener('click', () => { setUI('selectedTeamTab', btn.dataset.teamTab); renderTeams(); }));
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


window.ISSHandleCandidateError = function(node){
  const list = (node.dataset.candidates || '').split('|').filter(Boolean);
  let index = Number(node.dataset.candidateIndex || 0) + 1;
  if(index < list.length){
    node.dataset.candidateIndex = String(index);
    node.src = list[index];
  }else{
    node.style.display = 'none';
  }
};

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
