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
        ${img(teamLogoPath(teamId),'brand-logo',teamName(teamId))}
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
              ${img(playerImagePath(teamId,p.name),'player-avatar',p.name)}
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
        ${img(teamStatPath(teamId,key),'',`${teamName(teamId)} ${key}`)}
      </article>`).join('')}
    </div>`;
  $('#teamSelect')?.addEventListener('change', e => { setUI('selectedTeam', e.target.value); renderTeams(); renderBetting(); renderMatchup(); });
}


function recentFormScore(teamId){
  const rec = state.data.teamRecords[teamId] || {recent:[]};
  return (rec.recent || []).reduce((acc,r)=>acc + (r==='W' ? 1 : -1), 0);
}

function eventLabel(eventId=''){
  const labels = {
    M1Q: 'Major 1 Qualifiers',
    M1T: 'Major 1 Tournament',
    M2Q: 'Major 2 Qualifiers',
    M2T: 'Major 2 Tournament'
  };
  return labels[eventId] || eventId || 'Unknown Event';
}
function splitLabel(split='full'){
  const labels = {
    full: 'Full Season',
    last10: 'Last 10',
    last5: 'Last 5',
    m1q: 'Major 1 Qualifiers',
    m1t: 'Major 1 Tournament',
    m2q: 'Major 2 Qualifiers',
    m2t: 'Major 2 Tournament'
  };
  return labels[split] || split;
}
function median(nums){
  const values = nums.filter(v => Number.isFinite(v)).sort((a,b)=>a-b);
  if(!values.length) return null;
  const mid = Math.floor(values.length/2);
  return values.length % 2 ? values[mid] : (values[mid-1]+values[mid])/2;
}
function buildPlayerSeriesLogs(playerId){
  const playerRows = (state.data.playerStats || []).filter(row => row.playerId === playerId);
  const mapById = Object.fromEntries((state.data.maps || []).map(map => [map.id, map]));
  const matchById = Object.fromEntries((state.data.matches || []).map(match => [match.id, match]));
  const grouped = {};
  for(const row of playerRows){
    const map = mapById[row.mapId];
    if(!map) continue;
    const match = matchById[map.matchId];
    if(!match) continue;
    const bucket = grouped[match.id] ||= {
      match,
      maps: [],
      kills: 0,
      deaths: 0,
      damage: 0,
      teamId: row.teamId,
      playerId
    };
    bucket.maps.push({ ...row, map });
    bucket.kills += Number(row.kills || 0);
    bucket.deaths += Number(row.deaths || 0);
    bucket.damage += Number(row.damage || 0);
  }
  return Object.values(grouped).map(series => {
    series.maps.sort((a,b)=>(a.map.mapNum||0)-(b.map.mapNum||0));
    const { match } = series;
    const oppTeamId = match.team1Id === series.teamId ? match.team2Id : match.team1Id;
    const mapSequence = series.maps.map(entry => `M${entry.map.mapNum} ${entry.map.mapName}`).join(' · ');
    const maps13 = series.maps.filter(entry => Number(entry.map.mapNum) <= 3);
    return {
      ...series,
      date: match.date,
      time: match.time,
      eventId: match.eventId,
      eventLabel: eventLabel(match.eventId),
      format: match.format,
      ts: match.ts || 0,
      opponentTeamId: oppTeamId,
      seriesKD: safeKD(series.kills, series.deaths),
      maps13Kills: maps13.reduce((sum, entry) => sum + Number(entry.kills || 0), 0),
      maps13Deaths: maps13.reduce((sum, entry) => sum + Number(entry.deaths || 0), 0),
      maps13KD: safeKD(
        maps13.reduce((sum, entry) => sum + Number(entry.kills || 0), 0),
        maps13.reduce((sum, entry) => sum + Number(entry.deaths || 0), 0)
      ),
      mapSequence
    };
  }).sort((a,b)=>b.ts-a.ts);
}
function filterSeriesBySplit(seriesLogs, split){
  if(split === 'last5') return seriesLogs.slice(0,5);
  if(split === 'last10') return seriesLogs.slice(0,10);
  if(['m1q','m1t','m2q','m2t'].includes(split)) return seriesLogs.filter(log => String(log.eventId || '').toLowerCase() === split);
  return seriesLogs;
}
function marketTabs(statType='kills'){
  if(statType === 'kd'){
    return [
      { key: 'series-kd', label: 'Series K/D' },
      { key: 'maps13-kd', label: 'Maps 1-3 K/D' },
      { key: 'map1-kd', label: 'Map 1 K/D' },
      { key: 'map2-kd', label: 'Map 2 K/D' },
      { key: 'map3-kd', label: 'Map 3 K/D' }
    ];
  }
  return [
    { key: 'maps13-kills', label: 'Maps 1-3 Kills' },
    { key: 'series-kd', label: 'Series K/D' },
    { key: 'map1-kills', label: 'Map 1 Kills' },
    { key: 'map2-kills', label: 'Map 2 Kills' },
    { key: 'map3-kills', label: 'Map 3 Kills' }
  ];
}
function marketValue(series, marketKey){
  if(marketKey === 'series-kd') return safeKD(series.kills, series.deaths);
  if(marketKey === 'maps13-kd') return series.maps13KD;
  if(marketKey === 'maps13-kills') return series.maps13Kills;
  const mapNum = Number((marketKey.match(/map(\d+)/) || [])[1] || 0);
  const entry = series.maps.find(item => Number(item.map.mapNum) === mapNum);
  if(!entry) return null;
  if(marketKey.endsWith('-kd')) return safeKD(entry.kills, entry.deaths);
  return Number(entry.kills || 0);
}
function marketLineLabel(value, marketKey){
  if(value == null) return '—';
  return marketKey.includes('kd') ? fmtNum(value,2) : fmtNum(value,0);
}
function renderBetting(){
  const teamOptions = Object.keys(APP_CONFIG.teamMeta);
  const selectedTeam = state.ui.bettingTeam || state.ui.selectedTeam || 'optic';
  let roster = (state.data.playersByTeam[selectedTeam] || []).slice();
  const showInactive = state.ui.bettingRosterScope === 'all';
  if(!showInactive) roster = roster.filter(player => player.active !== false);
  if(!roster.length) roster = (state.data.playersByTeam[selectedTeam] || []).slice();
  const selectedPlayerId = roster.find(player => player.id === state.ui.bettingPlayerId)?.id || roster[0]?.id || '';
  const selectedPlayer = state.data.playerById[selectedPlayerId] || null;
  const selectedSplit = state.ui.bettingSplit || 'full';
  const selectedLabStat = state.ui.bettingLabStat || 'kills';
  const tabs = marketTabs(selectedLabStat);
  const selectedMarket = tabs.find(tab => tab.key === state.ui.bettingMarket)?.key || tabs[0]?.key || 'maps13-kills';
  const lineValue = state.ui.bettingLine ?? '';
  const selectedMode = state.ui.bettingMode || 'all';
  const selectedMapName = state.ui.bettingMapName || 'all';

  const playerSeries = selectedPlayerId ? buildPlayerSeriesLogs(selectedPlayerId) : [];
  const filteredSeries = filterSeriesBySplit(playerSeries, selectedSplit);
  const marketLogs = filteredSeries
    .map(series => ({ ...series, value: marketValue(series, selectedMarket) }))
    .filter(entry => entry.value != null);
  const recentMarketLogs = marketLogs.slice(0,5);
  const values = marketLogs.map(entry => Number(entry.value)).filter(Number.isFinite);
  const lineNumber = lineValue !== '' ? Number(lineValue) : null;
  const hitCount = Number.isFinite(lineNumber)
    ? marketLogs.filter(entry => Number(entry.value) >= lineNumber).length
    : null;

  const mapRows = filteredSeries.flatMap(series => series.maps.map(entry => ({
    ...entry,
    series,
    statValue: selectedLabStat === 'kd' ? safeKD(entry.kills, entry.deaths) : Number(entry.kills || 0),
    mode: entry.map.mode,
    mapName: entry.map.mapName,
    mapNum: entry.map.mapNum,
    opponentTeamId: series.opponentTeamId,
    eventLabel: series.eventLabel,
    date: series.date,
    format: series.format
  })));
  const modeOptions = ['all', ...new Set(mapRows.map(row => row.mode).filter(Boolean))];
  const mapOptions = ['all', ...new Set(mapRows.map(row => row.mapName).filter(Boolean))];
  const labRows = mapRows.filter(row => (selectedMode === 'all' || row.mode === selectedMode) && (selectedMapName === 'all' || row.mapName === selectedMapName));
  const labValues = labRows.map(row => Number(row.statValue)).filter(Number.isFinite);

  const playerLabel = selectedPlayer ? `${teamName(selectedPlayer.teamId)} · ${splitLabel(selectedSplit)} · ${filteredSeries.length} series logs` : 'Select a player';
  const infoBanner = 'Track player props by series or map. Use the line box for hit rate, then drill into specific map + mode filters below.';

  $('#betting').innerHTML = `
    ${sectionHeader('Betting Lab','Player prop research workstation built around kills and K/D.')} 
    <div class="notice betting-banner">🎯 ${infoBanner}</div>

    <article class="card betting-shell">
      <div class="betting-control-grid">
        <label class="betting-field">
          <span>Team</span>
          <select id="betTeamSelect">${teamOptions.map(teamId => `<option value="${teamId}" ${teamId===selectedTeam?'selected':''}>${teamName(teamId)}</option>`).join('')}</select>
        </label>
        <label class="betting-field">
          <span>Player</span>
          <select id="betPlayerSelect">${roster.map(player => `<option value="${player.id}" ${player.id===selectedPlayerId?'selected':''}>${player.name}</option>`).join('')}</select>
        </label>
        <label class="betting-field">
          <span>Split</span>
          <select id="betSplitSelect">
            ${[
              ['full','Full Season'],['last10','Last 10'],['last5','Last 5'],['m2q','Major 2 Qualifiers'],['m2t','Major 2 Tournament'],['m1q','Major 1 Qualifiers'],['m1t','Major 1 Tournament']
            ].map(([value,label]) => `<option value="${value}" ${value===selectedSplit?'selected':''}>${label}</option>`).join('')}
          </select>
        </label>
        <label class="betting-field">
          <span>Line (optional)</span>
          <input id="betLineInput" type="number" step="${selectedMarket.includes('kd') ? '0.01' : '1'}" value="${lineValue}">
        </label>
        <label class="betting-field betting-field--wide">
          <span>Map + Mode Stat</span>
          <select id="betLabStatSelect">
            <option value="kills" ${selectedLabStat==='kills'?'selected':''}>Kills</option>
            <option value="kd" ${selectedLabStat==='kd'?'selected':''}>K/D</option>
          </select>
        </label>
      </div>

      <div class="betting-player-strip">
        <div class="betting-player-main">
          <div class="betting-player-media">
            ${selectedPlayer ? img(playerImagePath(selectedPlayer.teamId, selectedPlayer.name),'betting-player-photo',selectedPlayer.name) : ''}
            ${selectedPlayer ? img(teamLogoPath(selectedPlayer.teamId),'betting-player-logo',teamName(selectedPlayer.teamId)) : ''}
          </div>
          <div class="betting-player-copy">
            <div class="muted">${selectedPlayer ? teamName(selectedPlayer.teamId) : 'No Team Selected'}</div>
            <h3>${selectedPlayer ? selectedPlayer.name : 'Select a player'}</h3>
            <p class="muted">${playerLabel}</p>
          </div>
        </div>
        <button class="pill betting-roster-btn" id="betRosterToggle">${showInactive ? 'All Players' : 'Active Roster'}</button>
      </div>
    </article>

    <article class="card betting-shell">
      <div class="betting-panel-head">
        <div>
          <div class="eyebrow">PrizePicks Market Tracker</div>
          <h3>Quick-read tracker for recent player prop results</h3>
        </div>
        <p class="muted">Recent samples use the latest ${Math.min(5, marketLogs.length)} matching performances.</p>
      </div>
      <div class="betting-tab-row">
        ${tabs.map(tab => `<button class="betting-tab ${tab.key===selectedMarket?'active':''}" data-market="${tab.key}">${tab.label}</button>`).join('')}
      </div>
      <div class="grid cols-5 betting-kpi-grid">
        <article class="card betting-kpi"><span class="label">Samples</span><span class="value">${fmtNum(values.length)}</span></article>
        <article class="card betting-kpi"><span class="label">Average</span><span class="value">${values.length ? marketLineLabel(values.reduce((sum, value)=>sum+value,0)/values.length, selectedMarket) : '—'}</span></article>
        <article class="card betting-kpi"><span class="label">Median</span><span class="value">${values.length ? marketLineLabel(median(values), selectedMarket) : '—'}</span></article>
        <article class="card betting-kpi"><span class="label">Best</span><span class="value">${values.length ? marketLineLabel(Math.max(...values), selectedMarket) : '—'}</span></article>
        <article class="card betting-kpi"><span class="label">Line Hit Rate</span><span class="value">${hitCount == null ? '—' : `${hitCount}/${marketLogs.length || 0}`}</span></article>
      </div>
      <div class="betting-result-grid">
        ${recentMarketLogs.length ? recentMarketLogs.map(log => {
          const hit = Number.isFinite(lineNumber) ? Number(log.value) >= lineNumber : null;
          const resultClass = hit == null ? '' : hit ? 'hit' : 'miss';
          const titleValue = marketLineLabel(log.value, selectedMarket);
          const lineSummary = Number.isFinite(lineNumber) ? `${marketLineLabel(log.value, selectedMarket)} / ${marketLineLabel(lineNumber, selectedMarket)}` : 'No line entered';
          const detailLine = selectedMarket === 'series-kd'
            ? `${fmtNum(log.kills,0)}K / ${fmtNum(log.deaths,0)}D`
            : log.mapSequence || '—';
          return `<article class="betting-result-card ${resultClass}">
            <div class="betting-result-top">
              <span class="muted">${fmtDate(log.date)}</span>
              <strong>${hit == null ? 'LOG' : hit ? 'HIT' : 'MISS'}</strong>
            </div>
            <div class="betting-result-value">${titleValue}</div>
            <div class="betting-result-meta">
              <div>${tabs.find(tab => tab.key===selectedMarket)?.label || ''} · vs ${teamAbbr(log.opponentTeamId)}</div>
              <div>${detailLine}</div>
              <div>${log.eventLabel}</div>
              <div>${lineSummary}</div>
            </div>
          </article>`;
        }).join('') : '<div class="empty">No matching market logs yet for this player and split.</div>'}
      </div>
      <p class="muted betting-note">Line hit rate uses over logic against the number you enter above, just like a prop check.</p>
    </article>

    <article class="card betting-shell">
      <div class="betting-panel-head">
        <div>
          <div class="eyebrow">Map + Mode Lab</div>
          <h3>Filter down to exact map pools and mode performance</h3>
        </div>
      </div>
      <div class="betting-control-grid betting-control-grid--lab">
        <label class="betting-field">
          <span>Mode</span>
          <select id="betModeSelect">${modeOptions.map(value => `<option value="${value}" ${value===selectedMode?'selected':''}>${value==='all' ? 'All Modes' : modeLabel(value)}</option>`).join('')}</select>
        </label>
        <label class="betting-field">
          <span>Map</span>
          <select id="betMapSelect">${mapOptions.map(value => `<option value="${value}" ${value===selectedMapName?'selected':''}>${value==='all' ? 'All Maps' : value}</option>`).join('')}</select>
        </label>
        <label class="betting-field">
          <span>Stat</span>
          <select id="betLabStatMirror">
            <option value="kills" ${selectedLabStat==='kills'?'selected':''}>Kills</option>
            <option value="kd" ${selectedLabStat==='kd'?'selected':''}>K/D</option>
          </select>
        </label>
        <div class="betting-field betting-reset-wrap"><button id="betResetFilters" class="pill betting-reset-btn">Reset Filters</button></div>
      </div>
      <div class="grid cols-4 betting-kpi-grid">
        <article class="card betting-kpi"><span class="label">Map Logs</span><span class="value">${fmtNum(labRows.length)}</span></article>
        <article class="card betting-kpi"><span class="label">Average</span><span class="value">${labValues.length ? marketLineLabel(labValues.reduce((sum, value)=>sum+value,0)/labValues.length, selectedLabStat==='kd' ? 'series-kd' : 'map1-kills') : '—'}</span></article>
        <article class="card betting-kpi"><span class="label">Median</span><span class="value">${labValues.length ? marketLineLabel(median(labValues), selectedLabStat==='kd' ? 'series-kd' : 'map1-kills') : '—'}</span></article>
        <article class="card betting-kpi"><span class="label">Best</span><span class="value">${labValues.length ? marketLineLabel(Math.max(...labValues), selectedLabStat==='kd' ? 'series-kd' : 'map1-kills') : '—'}</span></article>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Opponent</th><th>Map</th><th>Mode</th><th>Stat</th><th>Event</th></tr></thead>
          <tbody>
            ${labRows.length ? labRows.slice(0,40).map(row => `<tr>
              <td>${fmtDate(row.date)}</td>
              <td>${teamAbbr(row.opponentTeamId)}</td>
              <td>Map ${row.mapNum} · ${row.mapName}</td>
              <td>${modeLabel(row.mode)}</td>
              <td>${selectedLabStat === 'kd' ? fmtNum(row.statValue,2) : fmtNum(row.statValue,0)}</td>
              <td>${row.eventLabel}</td>
            </tr>`).join('') : '<tr><td colspan="6">No map logs match the current filters.</td></tr>'}
          </tbody>
        </table>
      </div>
    </article>`;

  $('#betTeamSelect')?.addEventListener('change', e => {
    const nextTeam = e.target.value;
    const nextRoster = ((state.data.playersByTeam[nextTeam] || []).filter(player => showInactive || player.active !== false));
    setUI('bettingTeam', nextTeam);
    setUI('bettingPlayerId', nextRoster[0]?.id || '');
    renderBetting();
  });
  $('#betPlayerSelect')?.addEventListener('change', e => { setUI('bettingPlayerId', e.target.value); renderBetting(); });
  $('#betSplitSelect')?.addEventListener('change', e => { setUI('bettingSplit', e.target.value); renderBetting(); });
  $('#betLabStatSelect')?.addEventListener('change', e => { setUI('bettingLabStat', e.target.value); setUI('bettingMarket',''); renderBetting(); });
  $('#betLabStatMirror')?.addEventListener('change', e => { setUI('bettingLabStat', e.target.value); setUI('bettingMarket',''); renderBetting(); });
  $('#betLineInput')?.addEventListener('input', e => { setUI('bettingLine', e.target.value); renderBetting(); });
  $('#betModeSelect')?.addEventListener('change', e => { setUI('bettingMode', e.target.value); renderBetting(); });
  $('#betMapSelect')?.addEventListener('change', e => { setUI('bettingMapName', e.target.value); renderBetting(); });
  $('#betResetFilters')?.addEventListener('click', () => {
    setUI('bettingMode', 'all');
    setUI('bettingMapName', 'all');
    renderBetting();
  });
  $('#betRosterToggle')?.addEventListener('click', () => {
    setUI('bettingRosterScope', showInactive ? 'active' : 'all');
    renderBetting();
  });
  document.querySelectorAll('[data-market]').forEach(button => {
    button.addEventListener('click', () => { setUI('bettingMarket', button.dataset.market); renderBetting(); });
  });
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
