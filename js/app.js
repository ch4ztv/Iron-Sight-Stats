import { APP_CONFIG } from './config.js';
import { state, setData, setSection, setUI } from './state.js';
import { loadAllData } from './data-loader.js';
import { fmtDate, fmtNum, fmtPct, modeLabel } from './formatters.js';
import { teamLogoCandidates, playerImageCandidates, teamStatCandidates, brandingPath } from './asset-paths.js';
import { computeISR, isrTier, buildIsrPlayerFromTeamStats } from './isr.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const TEAM_IDS = Object.keys(APP_CONFIG.teamMeta);
let globalEventsAttached = false;

function teamName(teamId){
  return APP_CONFIG.teamMeta[teamId]?.name || String(teamId || '').toUpperCase();
}

function teamAbbr(teamId){
  return APP_CONFIG.teamMeta[teamId]?.abbr || String(teamId || '').toUpperCase();
}

function normalizeName(value = ''){
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeHtml(value = ''){
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value = ''){
  return escapeHtml(value);
}

function num(value){
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values){
  const filtered = values.map(num).filter(value => value !== null);
  return filtered.length
    ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length
    : null;
}

function unique(values){
  return Array.from(new Set(values.filter(Boolean)));
}

function img(candidates, className, alt = ''){
  const fallback = brandingPath('logo.png');
  const list = Array.isArray(candidates) ? unique([...candidates, fallback]) : [candidates || fallback, fallback];
  const first = list[0] || fallback;
  const encoded = escapeAttr(JSON.stringify(list));
  return `<img src="${first}" class="${className}" alt="${escapeAttr(alt)}" data-candidates="${encoded}" data-candidate-index="0" onerror="(function(node){try{const list=JSON.parse(node.dataset.candidates||'[]');const index=Number(node.dataset.candidateIndex||0)+1;node.dataset.candidateIndex=String(index);if(index<list.length){node.src=list[index];return;}node.style.display='none';}catch(error){node.style.display='none';}})(this)">`;
}

function sectionHeader(title, description = '', extra = ''){
  return `<div class="section-title"><div><h2>${title}</h2><p>${description}</p></div>${extra}</div>`;
}

function kpiCard(label, value, detail = ''){
  return `<article class="card kpi"><span class="label">${label}</span><span class="value">${value}</span>${detail ? `<span class="kpi-detail">${detail}</span>` : ''}</article>`;
}

function recentPills(results = []){
  if(!results.length) return `<span class="muted">-</span>`;
  return `<div class="recent-pill-row">${results.map(result => `<span class="recent-pill ${result === 'W' ? 'win' : 'loss'}">${result}</span>`).join('')}</div>`;
}

function isrBadge(score){
  const tier = isrTier(score);
  const formattedScore = num(score) === null ? 'ISR unavailable' : `${fmtNum(score, 1)} ${tier.label}`;
  return `<span class="isr-badge ${tier.colorClass}"><span class="isr-dot"></span>${formattedScore}</span>`;
}

function playerCard(player, options = {}){
  const computedScore = options.precomputedISR ?? (options.isrConfig ? computeISR(player, null, options.isrConfig) : null);
  const displayName = player.displayName || player.name;
  return `<article class="card player-card">
    <div class="top">
      ${img(playerImageCandidates(player.teamId, displayName), 'player-avatar', displayName)}
      <div class="player-card-copy">
        <div class="player-card-team">${teamName(player.teamId)}</div>
        <h3>${escapeHtml(displayName)}</h3>
        ${isrBadge(computedScore)}
      </div>
    </div>
    <div class="stat-list compact">
      <div class="stat-row"><span>K/D</span><strong>${fmtNum(player.kd, 2)}</strong></div>
      <div class="stat-row"><span>Maps</span><strong>${fmtNum(player.maps || player.sample)}</strong></div>
      <div class="stat-row"><span>Kills</span><strong>${fmtNum(player.kills)}</strong></div>
      <div class="stat-row"><span>Damage / Map</span><strong>${fmtNum(player.dmgPerMap, 0)}</strong></div>
    </div>
  </article>`;
}

function getSeriesScore(match){
  const maps = state.data.mapsByMatch?.[match.id] || [];
  const s1 = num(match.seriesScore1);
  const s2 = num(match.seriesScore2);
  if(s1 !== null && s2 !== null){
    return { s1, s2, maps };
  }
  if(maps.length){
    return {
      s1: maps.filter(map => map.winner === match.team1Id).length,
      s2: maps.filter(map => map.winner === match.team2Id).length,
      maps
    };
  }
  return { s1: null, s2: null, maps };
}

function isCompletedMatch(match){
  const { s1, s2 } = getSeriesScore(match);
  return s1 !== null && s2 !== null;
}

function getStandings(){
  const rows = TEAM_IDS.map(teamId => {
    const record = state.data.teamRecords?.[teamId] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
    return {
      teamId,
      pts: state.data.teamPoints?.[teamId] || 0,
      wins: record.wins,
      losses: record.losses,
      mapWins: record.mapWins,
      mapLosses: record.mapLosses,
      mapDiff: record.mapWins - record.mapLosses,
      recent: record.recent || []
    };
  });
  rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.mapDiff - a.mapDiff || a.teamId.localeCompare(b.teamId));
  return rows;
}

function extractTeamStatNames(team){
  return unique([
    ...(team?.overall?.players || []).map(row => row.player),
    ...(team?.hardpoint?.players || []).map(row => row.player),
    ...(team?.snd?.players || []).map(row => row.player),
    ...(team?.overload?.players || []).map(row => row.player)
  ]);
}

function buildComputedModel(data){
  const aggregateByKey = new Map((data.playerAggList || []).map(row => [`${row.teamId}::${normalizeName(row.name)}`, row]));
  const metaByKey = new Map((data.players || []).map(row => [`${row.teamId}::${normalizeName(row.name)}`, row]));
  const profilesByTeam = {};
  const allProfiles = [];
  const avgIsrByTeam = {};
  const topPerformerByTeam = {};
  TEAM_IDS.forEach(teamId => {
    const names = unique([
      ...(data.playersByTeam?.[teamId] || []).map(player => player.name),
      ...extractTeamStatNames(data.teamStats?.[teamId]),
      ...(data.playerAggList || []).filter(row => row.teamId === teamId).map(row => row.name)
    ]);

    const profiles = names.map(name => {
      const key = `${teamId}::${normalizeName(name)}`;
      const aggregate = aggregateByKey.get(key) || {};
      const meta = metaByKey.get(key) || {};
      const base = buildIsrPlayerFromTeamStats(data.teamStats, teamId, name, data.playerAggList);
      const maps = num(aggregate.maps) ?? base.sample ?? 0;
      const damage = num(aggregate.damage) ?? 0;
      const profile = {
        ...base,
        displayName: meta.name || base.name || name,
        playerId: meta.id || aggregate.playerId || `${teamId}_${normalizeName(name)}`,
        active: meta.active ?? true,
        kills: num(aggregate.kills) ?? 0,
        deaths: num(aggregate.deaths) ?? 0,
        damage,
        maps,
        sample: maps || base.sample,
        dmgPerMap: maps ? damage / maps : 0,
        kd: base.kd ?? num(aggregate.kd),
        teamId
      };

      profile.overallISR = computeISR(profile, null, data.isr);
      profile.hpISR = computeISR(profile, 'HP', data.isr);
      profile.sndISR = computeISR(profile, 'SND', data.isr);
      profile.olISR = computeISR(profile, 'OL', data.isr);
      profile.tier = isrTier(profile.overallISR);
      profile.hasStats = [
        profile.overallISR,
        profile.kd,
        profile.kills,
        profile.damage,
        profile.sample
      ].some(value => num(value) !== null && Number(value) > 0);
      return profile;
    }).filter(profile => profile.displayName);

    profiles.sort((a, b) =>
      Number(Boolean(b.active)) - Number(Boolean(a.active)) ||
      (num(b.overallISR) ?? -1) - (num(a.overallISR) ?? -1) ||
      a.displayName.localeCompare(b.displayName)
    );

    profilesByTeam[teamId] = profiles;
    const ratedProfiles = profiles.filter(profile => profile.overallISR !== null);
    const activeRatedProfiles = ratedProfiles.filter(profile => profile.active);
    const pool = activeRatedProfiles.length ? activeRatedProfiles : ratedProfiles;
    avgIsrByTeam[teamId] = average(pool.map(profile => profile.overallISR));
    topPerformerByTeam[teamId] = pool[0] || null;
    allProfiles.push(...profiles.filter(profile => profile.hasStats));
  });

  return { profilesByTeam, allProfiles, avgIsrByTeam, topPerformerByTeam };
}

function recentFormScore(teamId){
  const record = state.data.teamRecords?.[teamId] || { recent: [] };
  return (record.recent || []).reduce((sum, result) => sum + (result === 'W' ? 1 : -1), 0);
}

function averageModeWinRate(teamId){
  const totals = state.data.teamStats?.[teamId]?.mapRecords?.totals || {};
  const hpRate = (num(totals.hpW) !== null && num(totals.hpL) !== null && (Number(totals.hpW) + Number(totals.hpL)) > 0)
    ? Number(totals.hpW) / (Number(totals.hpW) + Number(totals.hpL))
    : null;
  const sndRate = (num(totals.sndW) !== null && num(totals.sndL) !== null && (Number(totals.sndW) + Number(totals.sndL)) > 0)
    ? Number(totals.sndW) / (Number(totals.sndW) + Number(totals.sndL))
    : null;
  const olRate = (num(totals.ovlW) !== null && num(totals.ovlL) !== null && (Number(totals.ovlW) + Number(totals.ovlL)) > 0)
    ? Number(totals.ovlW) / (Number(totals.ovlW) + Number(totals.ovlL))
    : null;
  return average([hpRate, sndRate, olRate]);
}

function teamLeanScore(teamId){
  const record = state.data.teamRecords?.[teamId] || { wins: 0, losses: 0 };
  const totalSeries = (record.wins || 0) + (record.losses || 0);
  const winRate = totalSeries ? (record.wins / totalSeries) * 100 : 50;
  const points = state.data.teamPoints?.[teamId] || 0;
  const avgIsr = state.data.computed?.avgIsrByTeam?.[teamId] || 0;
  return winRate + points * 0.35 + avgIsr * 0.35;
}

function matchupHeadToHead(teamA, teamB){
  const matches = (state.data.matches || [])
    .filter(match =>
      (match.team1Id === teamA && match.team2Id === teamB) ||
      (match.team1Id === teamB && match.team2Id === teamA)
    )
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  let seriesA = 0;
  let seriesB = 0;
  let mapsA = 0;
  let mapsB = 0;

  matches.forEach(match => {
    const { s1, s2, maps } = getSeriesScore(match);
    if(s1 !== null && s2 !== null){
      const aScore = match.team1Id === teamA ? s1 : s2;
      const bScore = match.team1Id === teamA ? s2 : s1;
      if(aScore > bScore) seriesA += 1;
      if(bScore > aScore) seriesB += 1;
    }
    maps.forEach(map => {
      if(map.winner === teamA) mapsA += 1;
      if(map.winner === teamB) mapsB += 1;
    });
  });

  return { matches, seriesA, seriesB, mapsA, mapsB, latest: matches[0] || null };
}

function tableCell(label, value){
  return `<td data-label="${label}">${value}</td>`;
}

function renderDashboardSkeleton(){
  $('#dashboard').innerHTML = `
    ${sectionHeader('Dashboard', 'Loading season snapshot and leaders...')}
    <div class="grid cols-3">
      <article class="card skeleton-card">
        <div class="skeleton skeleton-line wide"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line short"></div>
      </article>
      <article class="card skeleton-card">
        <div class="skeleton skeleton-line wide"></div>
        <div class="skeleton skeleton-block"></div>
      </article>
      <article class="card skeleton-card">
        <div class="skeleton skeleton-line wide"></div>
        <div class="skeleton skeleton-block"></div>
      </article>
    </div>
  `;
}

function renderDashboard(){
  const { data } = state;
  const recentMatches = [...(data.matches || [])]
    .filter(isCompletedMatch)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 5);
  const standings = getStandings().slice(0, 5);
  const topPlayers = [...(data.computed?.allProfiles || [])]
    .sort((a, b) => (num(b.kd) ?? -1) - (num(a.kd) ?? -1))
    .slice(0, 6);
  const exported = data.meta?.exported ? new Date(data.meta.exported) : null;

  $('#dashboard').innerHTML = `
    ${sectionHeader('Dashboard', 'Season snapshot, recent results, and player leaders.')}
    <div class="hero">
      <article class="card hero-card">
        <div class="hero-copy">
          <div class="pill accent">Last updated ${exported ? exported.toLocaleString() : 'recently'}</div>
          <h3>ISR-powered CDL tracking built for standings, matchup reads, roster context, and betting support.</h3>
          <p class="muted">This shell now runs the modular app directly, so GitHub Pages serves the live public build instead of the old monolith.</p>
        </div>
      </article>
      <div class="grid cols-2 compact-grid">
        ${kpiCard('Matches', fmtNum((data.matches || []).length))}
        ${kpiCard('Maps', fmtNum((data.maps || []).length))}
        ${kpiCard('Players', fmtNum((data.computed?.allProfiles || []).length))}
        ${kpiCard('Teams', fmtNum(TEAM_IDS.length))}
      </div>
    </div>

    <div class="grid cols-2">
      <article class="card">
        <h3>Top 5 standings</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Team</th><th>Pts</th><th>Series</th><th>Recent</th></tr></thead>
            <tbody>
              ${standings.map((row, index) => `<tr>
                ${tableCell('#', index + 1)}
                ${tableCell('Team', `<span class="team-chip">${img(teamLogoCandidates(row.teamId), 'mini-logo', teamName(row.teamId))}<span>${teamName(row.teamId)}</span></span>`)}
                ${tableCell('Points', row.pts)}
                ${tableCell('Series', `${row.wins}-${row.losses}`)}
                ${tableCell('Recent', recentPills(row.recent))}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>
      <article class="card">
        <h3>Recent matches</h3>
        <div class="grid">
          ${recentMatches.map(match => {
            const { s1, s2 } = getSeriesScore(match);
            return `<a class="match-card match-card-link" href="#matches">
              <div class="match-head">
                <div>
                  <div class="muted">${escapeHtml(match.eventId || 'Event')} - ${fmtDate(match.date)} - ${escapeHtml(match.time || '')}</div>
                  <div class="match-teams">
                    <div class="match-team">${img(teamLogoCandidates(match.team1Id), 'mini-logo', teamName(match.team1Id))}<strong>${teamName(match.team1Id)}</strong></div>
                    <div class="match-team">${img(teamLogoCandidates(match.team2Id), 'mini-logo', teamName(match.team2Id))}<strong>${teamName(match.team2Id)}</strong></div>
                  </div>
                </div>
                <div class="score-badge">${s1}-${s2}</div>
              </div>
            </a>`;
          }).join('')}
        </div>
      </article>
    </div>

    <article class="card">
      <h3>Top K/D leaders</h3>
      <div class="player-grid">${topPlayers.map(player => playerCard(player, { precomputedISR: player.overallISR, isrConfig: data.isr })).join('')}</div>
    </article>
  `;
}

function renderStandings(){
  const rows = getStandings();
  $('#standings').innerHTML = `
    ${sectionHeader('Standings', 'Points combined with series, maps, and recent form.')}
    <div class="table-wrap stack-on-mobile">
      <table class="responsive-table">
        <thead><tr><th>#</th><th>Team</th><th>Points</th><th>Series</th><th>Map Record</th><th>Map Diff</th><th>Recent</th></tr></thead>
        <tbody>
          ${rows.map((row, index) => `<tr>
            ${tableCell('#', index + 1)}
            ${tableCell('Team', `<span class="team-chip">${img(teamLogoCandidates(row.teamId), 'mini-logo', teamName(row.teamId))}<span>${teamName(row.teamId)}</span></span>`)}
            ${tableCell('Points', row.pts)}
            ${tableCell('Series', `${row.wins}-${row.losses}`)}
            ${tableCell('Map Record', `${row.mapWins}-${row.mapLosses}`)}
            ${tableCell('Map Diff', `${row.mapDiff > 0 ? '+' : ''}${row.mapDiff}`)}
            ${tableCell('Recent', recentPills(row.recent))}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMatches(){
  const filter = state.ui.matchFilter;
  const options = ['all', ...TEAM_IDS];
  let matches = [...(state.data.matches || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if(filter !== 'all'){
    matches = matches.filter(match => match.team1Id === filter || match.team2Id === filter);
  }

  $('#matches').innerHTML = `
    ${sectionHeader('Matches', 'Series results with map detail and public event context.', `<div class="controls"><select id="matchFilter">${options.map(teamId => `<option value="${teamId}" ${teamId === filter ? 'selected' : ''}>${teamId === 'all' ? 'All teams' : teamName(teamId)}</option>`).join('')}</select></div>`)}
    <div class="grid">
      ${matches.slice(0, 60).map(match => {
        const { s1, s2, maps } = getSeriesScore(match);
        return `<article class="card match-card">
          <div class="match-head">
            <div>
              <div class="muted">${escapeHtml(match.eventId || 'Event')} - ${fmtDate(match.date)} - ${escapeHtml(match.time || '')} - ${escapeHtml(match.format || '')}</div>
              <div class="match-teams">
                <div class="match-team">${img(teamLogoCandidates(match.team1Id), 'mini-logo', teamName(match.team1Id))}<strong>${teamName(match.team1Id)}</strong></div>
                <div class="match-team">${img(teamLogoCandidates(match.team2Id), 'mini-logo', teamName(match.team2Id))}<strong>${teamName(match.team2Id)}</strong></div>
              </div>
            </div>
            <div class="score-badge">${s1 !== null && s2 !== null ? `${s1}-${s2}` : 'TBD'}</div>
          </div>
          <div class="map-grid">
            ${maps.length ? maps.map(map => `<div class="map-tile">
              <div class="pill">${modeLabel(map.mode)} - Map ${map.mapNum}</div>
              <h3>${escapeHtml(map.mapName || 'Unknown map')}</h3>
              <div class="muted">${fmtNum(map.score1)} - ${fmtNum(map.score2)}</div>
              <div class="map-winner"><strong>${teamName(map.winner)}</strong></div>
            </div>`).join('') : '<div class="empty">No map detail available yet.</div>'}
          </div>
        </article>`;
      }).join('')}
    </div>
  `;

  $('#matchFilter')?.addEventListener('change', event => {
    setUI('matchFilter', event.target.value);
    renderMatches();
  });
}

function renderPlayers(){
  const search = state.ui.playerSearch.trim().toLowerCase();
  const sort = state.ui.playerSort;
  let rows = [...(state.data.computed?.allProfiles || [])];
  if(search){
    rows = rows.filter(player => player.displayName.toLowerCase().includes(search) || teamName(player.teamId).toLowerCase().includes(search));
  }
  rows.sort((a, b) => {
    if(sort === 'kd') return (num(b.kd) ?? -1) - (num(a.kd) ?? -1);
    if(sort === 'kills') return (num(b.kills) ?? -1) - (num(a.kills) ?? -1);
    if(sort === 'damage') return (num(b.dmgPerMap) ?? -1) - (num(a.dmgPerMap) ?? -1);
    return (num(b.overallISR) ?? -1) - (num(a.overallISR) ?? -1);
  });

  const featurePlayer = [...rows].sort((a, b) => (num(b.overallISR) ?? -1) - (num(a.overallISR) ?? -1))[0] || null;

  $('#players').innerHTML = `
    ${sectionHeader('Players', 'ISR rankings and searchable player performance from the public data package.', `<div class="controls"><input id="playerSearch" placeholder="Search players or teams" value="${escapeAttr(state.ui.playerSearch)}"><select id="playerSort"><option value="isr" ${sort === 'isr' ? 'selected' : ''}>Sort by ISR</option><option value="kd" ${sort === 'kd' ? 'selected' : ''}>Sort by K/D</option><option value="kills" ${sort === 'kills' ? 'selected' : ''}>Sort by kills</option><option value="damage" ${sort === 'damage' ? 'selected' : ''}>Sort by damage / map</option></select></div>`)}
    ${featurePlayer ? `<article class="card player-feature">
      <div class="player-feature-media">
        ${img(playerImageCandidates(featurePlayer.teamId, featurePlayer.displayName), 'player-avatar feature-avatar', featurePlayer.displayName)}
        ${img(teamLogoCandidates(featurePlayer.teamId), 'feature-team-logo', teamName(featurePlayer.teamId))}
      </div>
      <div class="player-feature-copy">
        <p class="eyebrow">ISR leader</p>
        <h3>${escapeHtml(featurePlayer.displayName)}</h3>
        <p class="muted">${teamName(featurePlayer.teamId)} - ${fmtNum(featurePlayer.sample)} map sample</p>
        <div class="player-feature-stats">
          ${isrBadge(featurePlayer.overallISR)}
          <span class="pill">K/D ${fmtNum(featurePlayer.kd, 2)}</span>
          <span class="pill">Kills / 10m ${fmtNum(featurePlayer.kills10m, 2)}</span>
          <span class="pill">First blood ${fmtPct((featurePlayer.firstBloodRate || 0) * 100, 1)}</span>
        </div>
      </div>
    </article>` : ''}
    ${rows.length ? `<div class="table-wrap stack-on-mobile">
      <table class="responsive-table">
        <thead><tr><th>Player</th><th>Team</th><th>ISR</th><th>Tier</th><th>K/D</th><th>Kills</th><th>Damage / Map</th><th>Maps</th></tr></thead>
        <tbody>
          ${rows.slice(0, 80).map(player => `<tr>
            ${tableCell('Player', `<span class="player-chip">${img(playerImageCandidates(player.teamId, player.displayName), 'mini-avatar', player.displayName)}<span>${escapeHtml(player.displayName)}</span></span>`)}
            ${tableCell('Team', teamAbbr(player.teamId))}
            ${tableCell('ISR', fmtNum(player.overallISR, 1))}
            ${tableCell('Tier', `<span class="table-tier ${player.tier.colorClass}">${player.tier.label}</span>`)}
            ${tableCell('K/D', fmtNum(player.kd, 2))}
            ${tableCell('Kills', fmtNum(player.kills))}
            ${tableCell('Damage / Map', fmtNum(player.dmgPerMap, 0))}
            ${tableCell('Maps', fmtNum(player.maps))}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<div class="empty">No players matched "${escapeHtml(state.ui.playerSearch)}".</div>`}
  `;

  $('#playerSearch')?.addEventListener('input', event => {
    setUI('playerSearch', event.target.value);
    renderPlayers();
  });
  $('#playerSort')?.addEventListener('change', event => {
    setUI('playerSort', event.target.value);
    renderPlayers();
  });
}

function renderTeams(){
  const teamId = state.ui.selectedTeam;
  const teamStats = state.data.teamStats?.[teamId] || {};
  const record = state.data.teamRecords?.[teamId] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
  const roster = state.data.computed?.profilesByTeam?.[teamId] || [];
  const topPerformer = state.data.computed?.topPerformerByTeam?.[teamId] || null;
  const averageWinRate = averageModeWinRate(teamId);
  const overallRows = (teamStats.overall?.players || []).map(row => {
    const profile = roster.find(player => normalizeName(player.displayName) === normalizeName(row.player)) || null;
    return {
      player: row.player,
      kd: num(row.kd),
      slayerRating: num(row.slayerRating),
      respawnKd: num(row.respawnKd),
      ntkPct: num(row.ntkPct),
      isr: profile?.overallISR ?? null,
      tier: isrTier(profile?.overallISR)
    };
  });

  $('#teams').innerHTML = `
    ${sectionHeader('Teams', 'Roster ISR, season summary, and imported stat visuals.', `<div class="controls"><select id="teamSelect">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamId ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select></div>`)}
    <div class="hero">
      <article class="card team-hero">
        ${img(teamLogoCandidates(teamId), 'brand-logo', teamName(teamId))}
        <div class="team-hero-copy">
          <h3>${teamName(teamId)}</h3>
          <div class="muted">Series ${record.wins}-${record.losses} - Maps ${record.mapWins}-${record.mapLosses}</div>
          <div class="team-hero-pills">
            <span class="pill">Points ${state.data.teamPoints?.[teamId] || 0}</span>
            <span class="pill">Recent ${record.recent.join(' ') || '-'}</span>
            <span class="pill">Parser confidence ${teamStats.confidence || '-'}</span>
          </div>
        </div>
      </article>
      <article class="card">
        <h3>Season stats summary</h3>
        <div class="stat-list">
          <div class="stat-row"><span>Total maps</span><strong>${fmtNum((record.mapWins || 0) + (record.mapLosses || 0))}</strong></div>
          <div class="stat-row"><span>Avg mode win rate</span><strong>${averageWinRate !== null ? fmtPct(averageWinRate * 100, 1) : '-'}</strong></div>
          <div class="stat-row"><span>Top performer</span><strong>${topPerformer ? `${topPerformer.displayName} (${fmtNum(topPerformer.overallISR, 1)} ISR)` : '-'}</strong></div>
          <div class="stat-row"><span>Roster ISR average</span><strong>${fmtNum(state.data.computed?.avgIsrByTeam?.[teamId], 1)}</strong></div>
        </div>
      </article>
    </div>
    <div class="grid cols-2">
      <article class="card">
        <h3>Roster</h3>
        <div class="roster-grid">
          ${roster.map(player => `<div class="card roster-card">
            <div class="top">
              ${img(playerImageCandidates(teamId, player.displayName), 'player-avatar', player.displayName)}
              <div>
                <strong>${escapeHtml(player.displayName)}</strong>
                <div class="muted">${player.active ? 'Active roster' : 'Inactive roster'}</div>
                ${isrBadge(player.overallISR)}
              </div>
            </div>
          </div>`).join('')}
        </div>
      </article>
      <article class="card">
        <h3>Overall player metrics</h3>
        <div class="table-wrap stack-on-mobile">
          <table class="responsive-table">
            <thead><tr><th>Player</th><th>K/D</th><th>Slayer</th><th>Respawn K/D</th><th>NTK%</th><th>ISR</th><th>Tier</th></tr></thead>
            <tbody>
              ${overallRows.map(row => `<tr>
                ${tableCell('Player', escapeHtml(row.player))}
                ${tableCell('K/D', fmtNum(row.kd, 2))}
                ${tableCell('Slayer', fmtNum(row.slayerRating, 2))}
                ${tableCell('Respawn K/D', fmtNum(row.respawnKd, 2))}
                ${tableCell('NTK%', row.ntkPct !== null ? fmtPct(row.ntkPct * 100, 0) : '-')}
                ${tableCell('ISR', fmtNum(row.isr, 1))}
                ${tableCell('Tier', `<span class="table-tier ${row.tier.colorClass}">${row.tier.label}</span>`)}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>
    </div>
    <div class="grid cols-3">
      ${['overall', 'hardpoint', 'search-and-destroy', 'overload', 'map-records', 'picks-vetoes'].map(key => `<article class="card stat-image-card"><h3>${key.replace(/-/g, ' ')}</h3>${img(teamStatCandidates(teamId, key), 'team-stat-image', `${teamName(teamId)} ${key}`)}</article>`).join('')}
    </div>
  `;

  $('#teamSelect')?.addEventListener('change', event => {
    setUI('selectedTeam', event.target.value);
    renderTeams();
    renderBetting();
    renderMatchup();
  });
}

function renderBetting(){
  const teamA = state.ui.selectedTeam;
  const teamB = state.ui.selectedTeamB;
  const recordA = state.data.teamRecords?.[teamA] || { wins: 0, losses: 0, recent: [] };
  const recordB = state.data.teamRecords?.[teamB] || { wins: 0, losses: 0, recent: [] };
  const avgIsrA = state.data.computed?.avgIsrByTeam?.[teamA] || 0;
  const avgIsrB = state.data.computed?.avgIsrByTeam?.[teamB] || 0;
  const scoreA = (state.data.teamPoints?.[teamA] || 0) * 0.4 + recentFormScore(teamA) * 8 + avgIsrA * 0.6;
  const scoreB = (state.data.teamPoints?.[teamB] || 0) * 0.4 + recentFormScore(teamB) * 8 + avgIsrB * 0.6;
  const totalScore = Math.max(scoreA + scoreB, 0);
  const confidencePct = totalScore > 0 ? (scoreA / totalScore) * 100 : 50;
  const lean = Math.abs(scoreA - scoreB) < 0.5 ? 'Even matchup' : (scoreA > scoreB ? teamName(teamA) : teamName(teamB));

  $('#betting').innerHTML = `
    ${sectionHeader('Betting Lab', 'Public model lean using standings points, recent form, and team ISR averages.', `<div class="controls betting-controls"><select id="betTeamA">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamA ? 'selected' : ''}>Team A - ${teamName(id)}</option>`).join('')}</select><select id="betTeamB">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamB ? 'selected' : ''}>Team B - ${teamName(id)}</option>`).join('')}</select></div>`)}
    <div class="grid cols-3">
      <article class="card kpi model-lean-card"><span class="label">Model lean</span><span class="value">${lean}</span><span class="lean-summary">${teamAbbr(teamA)} ${fmtNum(scoreA, 1)} - ${fmtNum(scoreB, 1)} ${teamAbbr(teamB)}</span></article>
      ${kpiCard(`${teamAbbr(teamA)} score`, fmtNum(scoreA, 1), `Avg ISR ${fmtNum(avgIsrA, 1)}`)}
      ${kpiCard(`${teamAbbr(teamB)} score`, fmtNum(scoreB, 1), `Avg ISR ${fmtNum(avgIsrB, 1)}`)}
    </div>
    <article class="card confidence-card">
      <div class="confidence-head"><h3>Confidence bar</h3><span class="muted">${fmtPct(confidencePct, 1)} ${teamAbbr(teamA)} lean</span></div>
      <div class="confidence-meter"><span style="width:${confidencePct}%"></span></div>
      <div class="confidence-foot"><span>${teamName(teamA)}</span><span>${teamName(teamB)}</span></div>
    </article>
    <div class="grid cols-2">
      <article class="card">
        <h3>ISR weights snapshot</h3>
        <div class="weight-grid">
          ${Object.entries(state.data.isr?.weights || {}).map(([key, value]) => `<div class="weight-card"><span>${key.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase())}</span><strong>${fmtNum(value, 2)}</strong></div>`).join('')}
        </div>
        <p class="muted">Sample threshold ${fmtNum(state.data.isr?.samplePenaltyThreshold)} maps. Max rating ${fmtNum(state.data.isr?.maxRating)}.</p>
      </article>
      <article class="card">
        <h3>Recent form</h3>
        <div class="stat-list">
          <div class="stat-row"><span>${teamName(teamA)}</span><strong>${recordA.wins}-${recordA.losses}</strong></div>
          <div class="stat-row"><span>${teamName(teamA)} trend</span><strong>${recordA.recent.join(' ') || '-'}</strong></div>
          <div class="stat-row"><span>${teamName(teamB)}</span><strong>${recordB.wins}-${recordB.losses}</strong></div>
          <div class="stat-row"><span>${teamName(teamB)} trend</span><strong>${recordB.recent.join(' ') || '-'}</strong></div>
        </div>
      </article>
    </div>
  `;

  $('#betTeamA')?.addEventListener('change', event => {
    setUI('selectedTeam', event.target.value);
    renderTeams();
    renderBetting();
    renderMatchup();
  });
  $('#betTeamB')?.addEventListener('change', event => {
    setUI('selectedTeamB', event.target.value);
    renderBetting();
    renderMatchup();
  });
}

function renderBrackets(){
  $('#brackets').innerHTML = `
    ${sectionHeader('Brackets', 'Major event bracket pages and the bracket-data summary.')}
    <div class="controls"><a class="pill" href="./brackets/major-1.html" target="_blank" rel="noopener">Open Major 1</a><a class="pill" href="./brackets/major-2.html" target="_blank" rel="noopener">Open Major 2</a></div>
    <div class="embed-wrap"><iframe src="./brackets/major-2.html" title="Major 2 bracket"></iframe></div>
  `;
}

function renderMatchup(){
  const teamA = state.ui.selectedTeam;
  const teamB = state.ui.selectedTeamB;
  const recordA = state.data.teamRecords?.[teamA] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
  const recordB = state.data.teamRecords?.[teamB] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
  const avgIsrA = state.data.computed?.avgIsrByTeam?.[teamA] || 0;
  const avgIsrB = state.data.computed?.avgIsrByTeam?.[teamB] || 0;
  const topA = state.data.computed?.topPerformerByTeam?.[teamA] || null;
  const topB = state.data.computed?.topPerformerByTeam?.[teamB] || null;
  const leanA = teamLeanScore(teamA);
  const leanB = teamLeanScore(teamB);
  const leanPct = leanA + leanB > 0 ? (leanA / (leanA + leanB)) * 100 : 50;
  const h2h = matchupHeadToHead(teamA, teamB);
  const metricRows = [
    { label: 'Points', left: fmtNum(state.data.teamPoints?.[teamA] || 0), right: fmtNum(state.data.teamPoints?.[teamB] || 0) },
    { label: 'Series', left: `${recordA.wins}-${recordA.losses}`, right: `${recordB.wins}-${recordB.losses}` },
    { label: 'Maps', left: `${recordA.mapWins}-${recordA.mapLosses}`, right: `${recordB.mapWins}-${recordB.mapLosses}` },
    { label: 'Recent', left: recentPills(recordA.recent), right: recentPills(recordB.recent) },
    { label: 'Avg ISR', left: fmtNum(avgIsrA, 1), right: fmtNum(avgIsrB, 1) },
    { label: 'Mode win rate', left: averageModeWinRate(teamA) !== null ? fmtPct(averageModeWinRate(teamA) * 100, 1) : '-', right: averageModeWinRate(teamB) !== null ? fmtPct(averageModeWinRate(teamB) * 100, 1) : '-' }
  ];

  $('#matchup').innerHTML = `
    ${sectionHeader('Matchup', 'Side-by-side comparison using points, form, ISR, and head-to-head context.', `<div class="controls betting-controls"><select id="matchupTeamA">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamA ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select><select id="matchupTeamB">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamB ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select></div>`)}
    <div class="matchup-compare">
      <article class="card matchup-side"><div class="matchup-side-head">${img(teamLogoCandidates(teamA), 'brand-logo', teamName(teamA))}<div><h3>${teamName(teamA)}</h3><p class="muted">${topA ? `${topA.displayName} leads the roster at ${fmtNum(topA.overallISR, 1)} ISR.` : 'No ISR leader yet.'}</p></div></div></article>
      <article class="card matchup-center">
        <div class="lean-card">
          <div class="confidence-head"><h3>Win% lean</h3><span class="muted">${fmtPct(leanPct, 1)} ${teamAbbr(teamA)} / ${fmtPct(100 - leanPct, 1)} ${teamAbbr(teamB)}</span></div>
          <div class="confidence-meter"><span style="width:${leanPct}%"></span></div>
        </div>
        <div class="metric-grid">
          ${metricRows.map(row => `<div class="metric-row"><div class="metric-value left">${row.left}</div><div class="metric-label">${row.label}</div><div class="metric-value right">${row.right}</div></div>`).join('')}
        </div>
      </article>
      <article class="card matchup-side"><div class="matchup-side-head">${img(teamLogoCandidates(teamB), 'brand-logo', teamName(teamB))}<div><h3>${teamName(teamB)}</h3><p class="muted">${topB ? `${topB.displayName} leads the roster at ${fmtNum(topB.overallISR, 1)} ISR.` : 'No ISR leader yet.'}</p></div></div></article>
    </div>
    <div class="grid cols-2">
      <article class="card">
        <h3>Head-to-head</h3>
        ${h2h.matches.length ? `<div class="stat-list"><div class="stat-row"><span>Series</span><strong>${teamAbbr(teamA)} ${h2h.seriesA}-${h2h.seriesB} ${teamAbbr(teamB)}</strong></div><div class="stat-row"><span>Maps</span><strong>${teamAbbr(teamA)} ${h2h.mapsA}-${h2h.mapsB} ${teamAbbr(teamB)}</strong></div><div class="stat-row"><span>Last meeting</span><strong>${fmtDate(h2h.latest?.date)} - ${escapeHtml(h2h.latest?.eventId || '')}</strong></div></div>` : '<div class="empty">These teams have not played each other in the current dataset yet.</div>'}
      </article>
      <article class="card">
        <h3>Top roster edge</h3>
        <div class="stat-list">
          <div class="stat-row"><span>${teamName(teamA)}</span><strong>${topA ? `${topA.displayName} - ${fmtNum(topA.overallISR, 1)} ISR` : '-'}</strong></div>
          <div class="stat-row"><span>${teamName(teamB)}</span><strong>${topB ? `${topB.displayName} - ${fmtNum(topB.overallISR, 1)} ISR` : '-'}</strong></div>
          <div class="stat-row"><span>Lean driver</span><strong>${leanPct >= 50 ? teamName(teamA) : teamName(teamB)}</strong></div>
        </div>
      </article>
    </div>
  `;

  $('#matchupTeamA')?.addEventListener('change', event => {
    setUI('selectedTeam', event.target.value);
    renderTeams();
    renderBetting();
    renderMatchup();
  });
  $('#matchupTeamB')?.addEventListener('change', event => {
    setUI('selectedTeamB', event.target.value);
    renderBetting();
    renderMatchup();
  });
}

function renderAll(){
  renderDashboard();
  renderStandings();
  renderMatches();
  renderPlayers();
  renderTeams();
  renderBetting();
  renderBrackets();
  renderMatchup();
}

function setNavOpen(isOpen){
  const nav = $('#siteNav');
  const backdrop = $('#siteNavBackdrop');
  const button = $('#mobileMenuBtn');
  nav?.classList.toggle('open', isOpen);
  backdrop?.toggleAttribute('hidden', !isOpen);
  document.body.classList.toggle('nav-open', isOpen);
  if(button){
    button.setAttribute('aria-expanded', String(isOpen));
  }
}

function applyRoute(){
  const hash = (location.hash || `#${APP_CONFIG.defaultSection}`).replace('#', '');
  const section = APP_CONFIG.sections.includes(hash) ? hash : APP_CONFIG.defaultSection;
  setSection(section);
  document.querySelectorAll('.page-section').forEach(node => node.classList.toggle('active', node.id === section));
  document.querySelectorAll('.site-nav a').forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${section}`));
  setNavOpen(false);
}

function attachGlobalEvents(){
  if(globalEventsAttached) return;
  globalEventsAttached = true;
  $('#mobileMenuBtn')?.addEventListener('click', () => setNavOpen(!$('#siteNav')?.classList.contains('open')));
  $('#siteNavBackdrop')?.addEventListener('click', () => setNavOpen(false));
  document.querySelectorAll('.site-nav a').forEach(link => link.addEventListener('click', () => setNavOpen(false)));
  window.addEventListener('hashchange', applyRoute);
  window.addEventListener('resize', () => {
    if(window.innerWidth > 980){
      setNavOpen(false);
    }
  });
}

async function init(){
  try{
    attachGlobalEvents();
    renderDashboardSkeleton();
    applyRoute();

    const data = await loadAllData();
    data.computed = buildComputedModel(data);
    setData(data);

    window.ISSState = {
      getState: () => state,
      setState: next => {
        Object.entries(next || {}).forEach(([key, value]) => setUI(key, value));
        renderAll();
      }
    };

    $('#footerMeta').textContent = `${data.meta?.app || 'Iron Sight Stats'} - Exported ${data.meta?.exported ? new Date(data.meta.exported).toLocaleString() : 'unknown'}`;
    renderAll();
    applyRoute();
  }catch(error){
    console.error(error);
    $('.site-main').innerHTML = `<section class="page-section active"><div class="notice">The app could not finish loading. Check the browser console for the exact file that failed.</div><pre class="card error-pre">${escapeHtml(error.message)}</pre></section>`;
  }
}

init();
