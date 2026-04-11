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

function median(values){
  const filtered = values.map(num).filter(value => value !== null).sort((left, right) => left - right);
  if(!filtered.length) return null;
  const middle = Math.floor(filtered.length / 2);
  return filtered.length % 2
    ? filtered[middle]
    : (filtered[middle - 1] + filtered[middle]) / 2;
}

function unique(values){
  return Array.from(new Set(values.filter(Boolean)));
}

function teamLogoPath(teamId){
  return teamLogoCandidates(teamId)[0] || brandingPath('logo.png');
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

const BETTING_MARKETS = [
  {
    id: 'seriesKills',
    label: 'Series Kills',
    shortLabel: 'Kills',
    sampleDigits: 0,
    displayDigits: 1,
    description: 'Total kills across the selected series filters.'
  },
  {
    id: 'seriesDamage',
    label: 'Series Damage',
    shortLabel: 'Damage',
    sampleDigits: 0,
    displayDigits: 0,
    description: 'Total damage across the selected series filters.'
  },
  {
    id: 'seriesAssists',
    label: 'Series Assists',
    shortLabel: 'Assists',
    sampleDigits: 0,
    displayDigits: 1,
    description: 'Total assists across the selected series filters.'
  },
  {
    id: 'seriesKillsAssists',
    label: 'Kills + Assists',
    shortLabel: 'K+A',
    sampleDigits: 0,
    displayDigits: 1,
    description: 'Kills plus assists across the selected series filters.'
  },
  {
    id: 'seriesKD',
    label: 'Series K/D',
    shortLabel: 'K/D',
    sampleDigits: 2,
    displayDigits: 2,
    description: 'Kills divided by deaths across the selected series filters.'
  }
];

const BETTING_EVENT_ORDER = ['M1Q', 'M1T', 'M2Q', 'M2T', 'CHAMPS', 'EWC'];
const BETTING_EVENT_LABELS = {
  M1Q: 'Major 1 Qualifiers',
  M1T: 'Major 1 Tournament',
  M2Q: 'Major 2 Qualifiers',
  M2T: 'Major 2 Tournament',
  CHAMPS: 'Championship Weekend',
  EWC: 'Esports World Cup'
};

const BETTING_MODE_OPTIONS = [
  { id: 'all', label: 'All Modes' },
  { id: 'HP', label: 'Hardpoint' },
  { id: 'SND', label: 'Search & Destroy' },
  { id: 'OL', label: 'Overload' }
];

function getBettingMarket(marketId = state.ui.bettingMarket){
  return BETTING_MARKETS.find(market => market.id === marketId) || BETTING_MARKETS[0];
}

function formatBettingEvent(eventId){
  return BETTING_EVENT_LABELS[eventId] || eventId || 'Full Season';
}

function normalizeBettingLine(value = ''){
  return String(value)
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
    .trim();
}

function parseBettingLine(){
  const parsed = Number.parseFloat(state.ui.bettingLine);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPropValue(value, marketId, kind = 'sample'){
  const market = getBettingMarket(marketId);
  const digits = kind === 'sample' ? market.sampleDigits : market.displayDigits;
  return fmtNum(value, digits);
}

function formatBettingDate(match){
  return `${fmtDate(match.date)}${match.time ? ` · ${escapeHtml(match.time)}` : ''}`;
}

function getBettingRoster(teamId){
  const roster = state.data.computed?.profilesByTeam?.[teamId] || [];
  if(roster.length) return roster;
  return (state.data.playersByTeam?.[teamId] || []).map(player => ({
    playerId: player.id,
    displayName: player.name,
    teamId,
    active: player.active ?? true,
    overallISR: null,
    tier: isrTier(null)
  }));
}

function getBettingPlayer(playerId){
  if(!playerId) return null;
  return state.data.playerById?.[playerId] || state.data.computed?.allProfiles?.find(profile => profile.playerId === playerId) || null;
}

function getBettingProfile(playerId){
  return state.data.computed?.allProfiles?.find(profile => profile.playerId === playerId) || null;
}

function buildBettingEventOptions(teamId, opponentId = 'all'){
  const eventIds = unique((state.data.matches || [])
    .filter(match => (match.team1Id === teamId || match.team2Id === teamId))
    .filter(match => opponentId === 'all' || match.team1Id === opponentId || match.team2Id === opponentId)
    .map(match => match.eventId));

  eventIds.sort((left, right) => {
    const leftIndex = BETTING_EVENT_ORDER.indexOf(left);
    const rightIndex = BETTING_EVENT_ORDER.indexOf(right);
    if(leftIndex !== -1 || rightIndex !== -1){
      return (leftIndex === -1 ? BETTING_EVENT_ORDER.length : leftIndex) - (rightIndex === -1 ? BETTING_EVENT_ORDER.length : rightIndex);
    }
    return String(left).localeCompare(String(right));
  });

  return [{ id: 'all', label: 'Full Season' }, ...eventIds.map(eventId => ({ id: eventId, label: formatBettingEvent(eventId) }))];
}

function ensureBettingSelections(){
  const defaultTeam = TEAM_IDS.includes(state.ui.selectedTeam) ? state.ui.selectedTeam : TEAM_IDS[0];
  const teamId = TEAM_IDS.includes(state.ui.bettingTeam) ? state.ui.bettingTeam : defaultTeam;
  if(state.ui.bettingTeam !== teamId){
    setUI('bettingTeam', teamId);
  }

  const roster = getBettingRoster(teamId);
  const playerId = roster.some(player => player.playerId === state.ui.bettingPlayerId)
    ? state.ui.bettingPlayerId
    : (roster[0]?.playerId || '');
  if(state.ui.bettingPlayerId !== playerId){
    setUI('bettingPlayerId', playerId);
  }

  const opponentOptions = [
    { id: 'all', label: 'All Opponents' },
    ...TEAM_IDS
      .filter(id => id !== teamId)
      .sort((left, right) => teamName(left).localeCompare(teamName(right)))
      .map(id => ({ id, label: teamName(id) }))
  ];
  const opponentId = opponentOptions.some(option => option.id === state.ui.bettingOpponent)
    ? state.ui.bettingOpponent
    : 'all';
  if(state.ui.bettingOpponent !== opponentId){
    setUI('bettingOpponent', opponentId);
  }

  const eventOptions = buildBettingEventOptions(teamId, opponentId);
  const eventId = eventOptions.some(option => option.id === state.ui.bettingEvent)
    ? state.ui.bettingEvent
    : 'all';
  if(state.ui.bettingEvent !== eventId){
    setUI('bettingEvent', eventId);
  }

  const modeId = BETTING_MODE_OPTIONS.some(option => option.id === state.ui.bettingMode)
    ? state.ui.bettingMode
    : 'all';
  if(state.ui.bettingMode !== modeId){
    setUI('bettingMode', modeId);
  }

  const market = getBettingMarket(state.ui.bettingMarket);
  if(state.ui.bettingMarket !== market.id){
    setUI('bettingMarket', market.id);
  }

  const line = normalizeBettingLine(state.ui.bettingLine);
  if(state.ui.bettingLine !== line){
    setUI('bettingLine', line);
  }

  return { teamId, playerId, roster, opponentId, opponentOptions, eventId, eventOptions, modeId, market, line };
}

function aggregatePropRows(rows){
  return rows.reduce((totals, entry) => ({
    kills: totals.kills + Number(entry.row.kills || 0),
    deaths: totals.deaths + Number(entry.row.deaths || 0),
    assists: totals.assists + Number(entry.row.assists || 0),
    damage: totals.damage + Number(entry.row.damage || 0)
  }), { kills: 0, deaths: 0, assists: 0, damage: 0 });
}

function propValueFromTotals(totals, marketId){
  if(marketId === 'seriesDamage') return totals.damage;
  if(marketId === 'seriesAssists') return totals.assists;
  if(marketId === 'seriesKillsAssists') return totals.kills + totals.assists;
  if(marketId === 'seriesKD') return totals.deaths ? totals.kills / totals.deaths : totals.kills;
  return totals.kills;
}

function buildBettingSampleLabel(marketId, modeId){
  const market = getBettingMarket(marketId);
  return modeId === 'all' ? market.label : `${market.shortLabel} · ${modeLabel(modeId)}`;
}

function buildBettingSamples({ teamId, playerId, opponentId, eventId, modeId, marketId, lineValue }){
  if(!teamId || !playerId) return [];
  const matches = (state.data.matches || [])
    .filter(match => match.team1Id === teamId || match.team2Id === teamId)
    .filter(match => opponentId === 'all' || match.team1Id === opponentId || match.team2Id === opponentId)
    .filter(match => eventId === 'all' || match.eventId === eventId)
    .sort((left, right) => (right.ts || 0) - (left.ts || 0));

  return matches.map(match => {
    const rows = (state.data.mapsByMatch?.[match.id] || [])
      .filter(map => modeId === 'all' || map.mode === modeId)
      .map(map => {
        const row = (state.data.playerStatsByMap?.[map.id] || []).find(playerStat => playerStat.playerId === playerId);
        return row ? { map, row } : null;
      })
      .filter(Boolean);

    if(!rows.length) return null;

    const totals = aggregatePropRows(rows);
    const value = propValueFromTotals(totals, marketId);
    const opponent = match.team1Id === teamId ? match.team2Id : match.team1Id;
    return {
      match,
      ts: match.ts || 0,
      eventLabel: formatBettingEvent(match.eventId),
      opponentId: opponent,
      opponentName: teamName(opponent),
      value,
      label: buildBettingSampleLabel(marketId, modeId),
      mapsUsed: rows.map(entry => entry.map),
      hit: lineValue === null ? null : value > lineValue,
      totals,
      displayDate: formatBettingDate(match)
    };
  }).filter(Boolean);
}

function buildBettingProjection(samples, marketId){
  if(!samples.length) return null;
  const values = samples.map(sample => sample.value);
  const recentAverage = average(values.slice(0, 5));
  const seasonAverage = average(values);
  const medianValue = median(values);
  if(recentAverage === null || seasonAverage === null || medianValue === null) return null;
  const projection = recentAverage * 0.55 + seasonAverage * 0.3 + medianValue * 0.15;
  const digits = getBettingMarket(marketId).displayDigits;
  return Number(projection.toFixed(digits));
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
  const { teamId, playerId, roster, opponentId, opponentOptions, eventId, eventOptions, modeId, market, line } = ensureBettingSelections();
  const player = getBettingPlayer(playerId);
  const profile = getBettingProfile(playerId);
  const lineValue = parseBettingLine();
  const samples = buildBettingSamples({ teamId, playerId, opponentId, eventId, modeId, marketId: market.id, lineValue });
  const values = samples.map(sample => sample.value);
  const seasonAverage = average(values);
  const recentAverage = average(values.slice(0, 5));
  const medianValue = median(values);
  const bestValue = values.length ? Math.max(...values) : null;
  const projection = buildBettingProjection(samples, market.id);
  const hits = samples.filter(sample => sample.hit === true).length;
  const hitRate = lineValue !== null && samples.length ? (hits / samples.length) * 100 : null;
  const edge = lineValue !== null && projection !== null ? projection - lineValue : null;
  const playerName = player?.displayName || player?.name || profile?.displayName || 'Select a player';
  const filterSummary = [
    modeId === 'all' ? 'All Modes' : modeLabel(modeId),
    opponentId === 'all' ? 'All Opponents' : `Vs ${teamName(opponentId)}`,
    eventId === 'all' ? 'Full Season' : formatBettingEvent(eventId)
  ].join(' | ');

  const lineMarkup = lineValue === null
    ? '<span class="muted">Enter a line</span>'
    : formatPropValue(lineValue, market.id, 'display');
  const projectionMarkup = projection === null
    ? '<span class="muted">No data</span>'
    : formatPropValue(projection, market.id, 'display');
  const edgeMarkup = edge === null
    ? '<span class="muted">Line needed</span>'
    : `<span class="${edge >= 0 ? 'value-pos' : 'value-neg'}">${edge >= 0 ? '+' : ''}${formatPropValue(edge, market.id, 'display')}</span>`;

  const summaryMarkup = [
    kpiCard('Samples', fmtNum(samples.length), 'Matching series'),
    kpiCard('Season Avg', seasonAverage === null ? 'No data' : formatPropValue(seasonAverage, market.id, 'display'), market.description),
    kpiCard('Last 5 Avg', recentAverage === null ? 'No data' : formatPropValue(recentAverage, market.id, 'display'), samples.length ? samples.slice(0, 5).map(sample => formatPropValue(sample.value, market.id, 'sample')).join(' | ') : 'No recent trend'),
    kpiCard('Median', medianValue === null ? 'No data' : formatPropValue(medianValue, market.id, 'display'), 'Middle sample'),
    kpiCard('Hit Rate', hitRate === null ? 'Line Needed' : fmtPct(hitRate, 1), hitRate === null ? 'Add a line to grade overs' : `${hits}/${samples.length} overs`),
    kpiCard('Best Result', bestValue === null ? 'No data' : formatPropValue(bestValue, market.id, 'sample'), 'Highest matching sample')
  ].join('');

  const lastFiveMarkup = samples.length
    ? `<div class="prop-sample-grid">${samples.slice(0, 5).map(sample => {
        const mapsText = sample.mapsUsed.map(map => `M${map.mapNum} ${modeLabel(map.mode)} | ${escapeHtml(map.mapName)}`).join(' | ');
        const badge = sample.hit === null
          ? '<span class="prop-sample-badge muted">No line</span>'
          : `<span class="prop-sample-badge ${sample.hit ? 'hit' : 'miss'}">${sample.hit ? 'Hit' : 'Miss'}</span>`;
        return `<article class="prop-sample-card">
          <div class="prop-sample-top">
            <div>
              <div class="prop-sample-date">${sample.displayDate}</div>
              <div class="muted">${escapeHtml(sample.eventLabel)} | vs ${escapeHtml(sample.opponentName)}</div>
            </div>
            ${badge}
          </div>
          <div class="prop-sample-value">${formatPropValue(sample.value, market.id, 'sample')}</div>
          <div class="prop-sample-meta">
            ${escapeHtml(sample.label)}<br>
            ${mapsText}<br>
            ${fmtNum(sample.totals.kills)}K / ${fmtNum(sample.totals.deaths)}D / ${fmtNum(sample.totals.assists)}A
          </div>
        </article>`;
      }).join('')}</div>`
    : '<div class="empty">No matching player prop samples for the current filters yet.</div>';

  const logMarkup = samples.length
    ? samples.map(sample => {
        const mapsText = sample.mapsUsed.map(map => `M${map.mapNum} ${escapeHtml(map.mapName)}`).join(', ');
        const lineResult = lineValue === null
          ? '<span class="muted">-</span>'
          : `<span class="${sample.hit ? 'value-pos' : 'value-neg'}">${sample.hit ? 'Over' : 'Under'} ${formatPropValue(lineValue, market.id, 'display')}</span>`;
        return `<tr>
          ${tableCell('Date', sample.displayDate)}
          ${tableCell('Event', escapeHtml(sample.eventLabel))}
          ${tableCell('Opponent', escapeHtml(sample.opponentName))}
          ${tableCell('Maps', mapsText)}
          ${tableCell('Result', `<strong>${formatPropValue(sample.value, market.id, 'sample')}</strong>`)}
          ${tableCell('K / D / A', `${fmtNum(sample.totals.kills)} / ${fmtNum(sample.totals.deaths)} / ${fmtNum(sample.totals.assists)}`)}
          ${tableCell('Damage', fmtNum(sample.totals.damage))}
          ${tableCell('Line Result', lineResult)}
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" class="empty">No matching performances yet.</td></tr>';

  $('#betting').innerHTML = `
    ${sectionHeader('Betting Lab', 'Player prop lines using real series samples, matchup filters, and entered over/under thresholds.')}
    <article class="card prop-filter-card">
      <div class="prop-filter-grid">
        <div>
          <label for="bettingTeamSelect">Team</label>
          <select id="bettingTeamSelect">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamId ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
        </div>
        <div>
          <label for="bettingPlayerSelect">Player</label>
          <select id="bettingPlayerSelect">${roster.map(entry => `<option value="${entry.playerId}" ${entry.playerId === playerId ? 'selected' : ''}>${escapeHtml(entry.displayName || entry.name || entry.playerId)}</option>`).join('')}</select>
        </div>
        <div>
          <label for="bettingOpponentSelect">Opponent</label>
          <select id="bettingOpponentSelect">${opponentOptions.map(option => `<option value="${option.id}" ${option.id === opponentId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div>
          <label for="bettingEventSelect">Event</label>
          <select id="bettingEventSelect">${eventOptions.map(option => `<option value="${option.id}" ${option.id === eventId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div>
          <label for="bettingModeSelect">Mode</label>
          <select id="bettingModeSelect">${BETTING_MODE_OPTIONS.map(option => `<option value="${option.id}" ${option.id === modeId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div>
          <label for="bettingLineInput">Prop Line</label>
          <input id="bettingLineInput" type="text" inputmode="decimal" placeholder="23.5" value="${escapeAttr(line)}">
        </div>
      </div>
      <div class="prop-market-tabs">
        ${BETTING_MARKETS.map(entry => `<button class="prop-market-pill ${entry.id === market.id ? 'active' : ''}" type="button" data-prop-market="${entry.id}">${entry.shortLabel}</button>`).join('')}
      </div>
    </article>
    <article class="card prop-hero">
      <div class="prop-hero-media">
        ${img(playerImageCandidates(teamId, playerName), 'prop-player-avatar', playerName)}
        ${img(teamLogoCandidates(teamId), 'prop-team-logo', teamName(teamId))}
      </div>
      <div class="prop-hero-copy">
        <p class="eyebrow">Player Prop Betting Line</p>
        <h3>${escapeHtml(playerName)}</h3>
        <p class="muted">${escapeHtml(teamName(teamId))} | ${escapeHtml(filterSummary)}</p>
        <div class="prop-hero-badges">
          ${profile ? isrBadge(profile.overallISR) : '<span class="pill">ISR unavailable</span>'}
          <span class="pill">${market.label}</span>
        </div>
        <div class="prop-line-row">
          <div class="prop-line-box"><span>Prop Line</span><strong>${lineMarkup}</strong></div>
          <div class="prop-line-box"><span>Projection</span><strong>${projectionMarkup}</strong></div>
          <div class="prop-line-box"><span>Edge</span><strong>${edgeMarkup}</strong></div>
        </div>
        <p class="prop-note">${lineValue === null ? 'Enter a line to start grading overs and unders. Projection leans on recent form without hiding the full sample history.' : `Hit rate grades overs against ${formatPropValue(lineValue, market.id, 'display')}. Projection blends the last 5, full sample average, and median.`}</p>
      </div>
    </article>
    <div class="grid cols-3 prop-summary-grid">${summaryMarkup}</div>
    <article class="card">
      <div class="prop-section-head">
        <div>
          <h3>Last 5 Samples</h3>
          <p class="muted">Most recent matching series for ${escapeHtml(playerName)}.</p>
        </div>
        <span class="pill">${samples.length} total samples</span>
      </div>
      ${lastFiveMarkup}
    </article>
    <article class="card">
      <div class="prop-section-head">
        <div>
          <h3>Full Prop Log</h3>
          <p class="muted">Every matching series result, map context, and line outcome.</p>
        </div>
        <span class="prop-log-note">${lineValue === null ? 'Line logic off until a number is entered.' : `Over logic against ${formatPropValue(lineValue, market.id, 'display')}`}</span>
      </div>
      <div class="table-wrap stack-on-mobile">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Opponent</th>
              <th>Maps</th>
              <th>Result</th>
              <th>K / D / A</th>
              <th>Damage</th>
              <th>Line Result</th>
            </tr>
          </thead>
          <tbody>${logMarkup}</tbody>
        </table>
      </div>
    </article>
  `;

  $('#bettingTeamSelect')?.addEventListener('change', event => {
    setUI('bettingTeam', event.target.value);
    setUI('bettingPlayerId', '');
    if(state.ui.bettingOpponent === event.target.value){
      setUI('bettingOpponent', 'all');
    }
    renderBetting();
  });
  $('#bettingPlayerSelect')?.addEventListener('change', event => {
    setUI('bettingPlayerId', event.target.value);
    renderBetting();
  });
  $('#bettingOpponentSelect')?.addEventListener('change', event => {
    setUI('bettingOpponent', event.target.value);
    renderBetting();
  });
  $('#bettingEventSelect')?.addEventListener('change', event => {
    setUI('bettingEvent', event.target.value);
    renderBetting();
  });
  $('#bettingModeSelect')?.addEventListener('change', event => {
    setUI('bettingMode', event.target.value);
    renderBetting();
  });
  document.querySelectorAll('[data-prop-market]').forEach(button => button.addEventListener('click', () => {
    setUI('bettingMarket', button.dataset.propMarket);
    renderBetting();
  }));
  $('#bettingLineInput')?.addEventListener('input', event => {
    const next = normalizeBettingLine(event.target.value);
    setUI('bettingLine', next);
    event.target.value = next;
  });
  $('#bettingLineInput')?.addEventListener('change', event => {
    const next = normalizeBettingLine(event.target.value);
    setUI('bettingLine', next);
    event.target.value = next;
    renderBetting();
  });
  $('#bettingLineInput')?.addEventListener('keydown', event => {
    if(event.key === 'Enter'){
      const next = normalizeBettingLine(event.target.value);
      setUI('bettingLine', next);
      event.target.value = next;
      renderBetting();
    }
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
