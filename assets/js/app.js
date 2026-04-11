import { APP_CONFIG } from './config.js';
import { state, setData, setSection, setUI } from './state.js';
import { loadAllData } from './data-loader.js';
import { fmtDate, fmtNum, fmtPct, modeLabel } from './formatters.js';
import { teamLogoCandidates, playerImageCandidates, teamStatCandidates, brandingPath } from './asset-paths.js';
import { computeISR, isrTier, buildIsrPlayerFromTeamStats } from './isr.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const TEAM_IDS = Object.keys(APP_CONFIG.teamMeta);
const TEAM_ACCENTS = {
  optic: '#9cc43d',
  pgm: '#ce00c9',
  faze: '#ff00ff',
  toronto: '#782cf2',
  g2: '#e72328',
  lat: '#ff0000',
  falcons: '#1a835a',
  miami: '#fd6905',
  ravens: '#0087dd',
  boston: '#02ff5b',
  vancouver: '#116781',
  c9: '#00bdff'
};
let globalEventsAttached = false;

function teamName(teamId){
  return APP_CONFIG.teamMeta[teamId]?.name || String(teamId || '').toUpperCase();
}

function teamAbbr(teamId){
  return APP_CONFIG.teamMeta[teamId]?.abbr || String(teamId || '').toUpperCase();
}

function teamColor(teamId){
  return TEAM_ACCENTS[teamId] || '#1cff6a';
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
  return `<div class="sh"><div><div class="sh-title">${title}</div>${description ? `<div class="sh-sub">${description}</div>` : ''}</div>${extra || ''}</div>`;
}

function kpiCard(label, value, detail = ''){
  return `<article class="kpi"><div class="kpi-val">${value}</div><div class="kpi-lbl">${label}</div>${detail ? `<div class="kpi-sub">${detail}</div>` : ''}</article>`;
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

function modePill(mode){
  const className = mode === 'HP'
    ? 'pill pill-hp'
    : mode === 'SND'
      ? 'pill pill-snd'
      : 'pill pill-ol';
  return `<span class="${className}">${escapeHtml(modeLabel(mode))}</span>`;
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
  return `${fmtDate(match.date)}${match.time ? ` | ${escapeHtml(match.time)}` : ''}`;
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
  return modeId === 'all' ? market.label : `${market.shortLabel} | ${modeLabel(modeId)}`;
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
    .sort((a, b) => (num(b.kills) ?? -1) - (num(a.kills) ?? -1))
    .slice(0, 5);
  const seasonPoints = Object.values(data.teamPoints || {}).reduce((sum, value) => sum + (num(value) ?? 0), 0);
  const eventSteps = BETTING_EVENT_ORDER.filter(eventId => (data.matches || []).some(match => match.eventId === eventId));

  $('#dashboard').innerHTML = `
    ${sectionHeader('Season Overview', 'CDL 2026 | Black Ops 7 | 12 Teams')}
    <div class="season-strip">
      ${eventSteps.map((eventId, index) => `<div class="season-step active">
        <span class="season-step-dot">${index + 1}</span>
        <span class="season-step-label">${escapeHtml(formatBettingEvent(eventId))}</span>
      </div>`).join('')}
    </div>
    <div class="dashboard-kpis">
      ${kpiCard('Matches Logged', fmtNum((data.matches || []).length))}
      ${kpiCard('Maps Played', fmtNum((data.maps || []).length))}
      ${kpiCard('CDL Points Awarded', fmtNum(seasonPoints))}
      ${kpiCard('Player-Map Stats', fmtNum((data.playerStats || []).length))}
    </div>

    <div class="dashboard-panels">
      <article class="card">
        <div class="card-title">CDL Standings <span class="small">Top 5</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Team</th><th>CDL Pts</th><th>Series</th><th>Maps</th></tr></thead>
            <tbody>
              ${standings.map((row, index) => `<tr>
                ${tableCell('#', `<span class="rnk ${index === 0 ? 'r1' : index === 1 ? 'r2' : index === 2 ? 'r3' : 'rd'}">${index + 1}</span>`)}
                ${tableCell('Team', `<span class="team-chip">${img(teamLogoCandidates(row.teamId), 'mini-logo', teamName(row.teamId))}<span>${teamName(row.teamId)}</span></span>`)}
                ${tableCell('CDL Pts', `<strong>${fmtNum(row.pts)}</strong>`)}
                ${tableCell('Series', `<span class="value-pos">${row.wins}</span> - <span class="value-neg">${row.losses}</span>`)}
                ${tableCell('Maps', `${row.mapWins}-${row.mapLosses}`)}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </article>

      <article class="card">
        <div class="card-title">Kill Leaders <span class="small">Season total</span></div>
        <div class="leader-list">
          ${topPlayers.map(player => `<div class="leader-row">
            <div>
              <div class="leader-name">${escapeHtml(player.displayName)}</div>
              <div class="leader-team" style="color:${teamColor(player.teamId)}">${escapeHtml(teamName(player.teamId))}</div>
            </div>
            <div class="leader-metrics">
              <strong>${fmtNum(player.kills)}</strong>
              <span>${fmtNum(player.maps ? player.kills / player.maps : null, 1)}/map</span>
            </div>
          </div>`).join('')}
        </div>
      </article>

      <article class="card recent-results-card">
        <div class="card-title">Recent Results <span class="small">Latest completed series</span></div>
        <div class="result-list">
          ${recentMatches.map(match => {
            const { s1, s2 } = getSeriesScore(match);
            return `<div class="result-item">
              <div class="result-main">
                <div class="result-line">
                  <span class="team-chip">${img(teamLogoCandidates(match.team1Id), 'mini-logo', teamName(match.team1Id))}<strong>${teamName(match.team1Id)}</strong></span>
                  <span class="result-score"><span class="${s1 > s2 ? 'value-pos' : 'value-neg'}">${s1}</span> - <span class="${s2 > s1 ? 'value-pos' : 'value-neg'}">${s2}</span></span>
                  <span class="team-chip"><strong>${teamName(match.team2Id)}</strong>${img(teamLogoCandidates(match.team2Id), 'mini-logo', teamName(match.team2Id))}</span>
                </div>
              </div>
              <div class="result-meta">${escapeHtml(formatBettingEvent(match.eventId || ''))}<br>${fmtDate(match.date)}</div>
            </div>`;
          }).join('')}
        </div>
      </article>
    </div>
  `;
}

function renderStandings(){
  const rows = getStandings();
  $('#standings').innerHTML = `
    ${sectionHeader('CDL Standings', 'Sorted by CDL points with series, maps, and recent form.')}
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
    ${sectionHeader('Match Results', 'Series results with map detail and public event context.', `<div class="controls"><select id="matchFilter">${options.map(teamId => `<option value="${teamId}" ${teamId === filter ? 'selected' : ''}>${teamId === 'all' ? 'All teams' : teamName(teamId)}</option>`).join('')}</select></div>`)}
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
    ${sectionHeader('Player Stats', 'ISR rankings and searchable player performance from the public data package.', `<div class="controls"><input id="playerSearch" placeholder="Search players or teams" value="${escapeAttr(state.ui.playerSearch)}"><select id="playerSort"><option value="isr" ${sort === 'isr' ? 'selected' : ''}>Sort by ISR</option><option value="kd" ${sort === 'kd' ? 'selected' : ''}>Sort by K/D</option><option value="kills" ${sort === 'kills' ? 'selected' : ''}>Sort by kills</option><option value="damage" ${sort === 'damage' ? 'selected' : ''}>Sort by damage / map</option></select></div>`)}
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
  const selectedRosterEntry = roster.find(entry => entry.playerId === playerId) || player || null;
  const selectedSplitLabel = eventId === 'all' ? 'Full Season' : formatBettingEvent(eventId);
  const filterSummary = [
    opponentId === 'all' ? 'All Opponents' : `Vs ${teamName(opponentId)}`,
    modeId === 'all' ? 'All Modes' : modeLabel(modeId)
  ].join(' | ');

  const summaryMarkup = [
    { label: 'Samples', value: fmtNum(samples.length) },
    { label: 'Average', value: seasonAverage === null ? '-' : formatPropValue(seasonAverage, market.id, 'display') },
    { label: 'Median', value: medianValue === null ? '-' : formatPropValue(medianValue, market.id, 'display') },
    { label: 'Projection', value: projection === null ? '-' : formatPropValue(projection, market.id, 'display') },
    { label: 'Edge', value: edge === null ? '-' : `${edge >= 0 ? '+' : ''}${formatPropValue(edge, market.id, 'display')}`, tone: edge === null ? '' : edge >= 0 ? 'value-pos' : 'value-neg' },
    { label: 'Line Hit Rate', value: hitRate === null ? '-' : `${hits}/${samples.length}` }
  ].map(item => `<div class="bet-kpi"><div class="v ${item.tone || ''}">${item.value}</div><div class="l">${item.label}</div></div>`).join('');

  const lastFiveMarkup = samples.length
    ? `<div class="bet-games">${samples.slice(0, 5).map(sample => {
        const mapsText = sample.mapsUsed.map(map => `M${map.mapNum} ${modeLabel(map.mode)} ${escapeHtml(map.mapName)}`).join(' | ');
        const badge = sample.hit === null
          ? '<div class="res">-</div>'
          : `<div class="res ${sample.hit ? 'hit' : 'miss'}">${sample.hit ? 'HIT' : 'MISS'}</div>`;
        return `<div class="bet-game ${sample.hit === true ? 'hit' : sample.hit === false ? 'miss' : ''}">
          <div class="top">
            <div class="bet-mini">${sample.displayDate}</div>
            ${badge}
          </div>
          <div class="val">${formatPropValue(sample.value, market.id, 'sample')}</div>
          <div class="meta">
            <div>${escapeHtml(sample.eventLabel)} | vs ${escapeHtml(sample.opponentName)}</div>
            <div>${mapsText || escapeHtml(sample.label)}</div>
            <div>${fmtNum(sample.totals.kills)}K / ${fmtNum(sample.totals.deaths)}D / ${fmtNum(sample.totals.assists)}A</div>
            <div>${fmtNum(sample.totals.damage)} DMG</div>
          </div>
        </div>`;
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
    ${sectionHeader('Betting Lab', 'PrizePicks-style player prop tracker built from live series samples in the public data package.')}
    <div class="info-box"><strong>Player prop line engine:</strong> enter a line, compare it to real series history, and use the opponent, split, and mode filters to tighten the read before lock.</div>
    <div class="card bet-card">
      <div class="bet-form-grid">
        <div class="fg">
          <label for="bettingTeamSelect">Team</label>
          <select id="bettingTeamSelect">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamId ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
        </div>
        <div class="fg">
          <label for="bettingPlayerSelect">Player</label>
          <select id="bettingPlayerSelect">${roster.map(entry => `<option value="${entry.playerId}" ${entry.playerId === playerId ? 'selected' : ''}>${escapeHtml(entry.displayName || entry.name || entry.playerId)}</option>`).join('')}</select>
        </div>
        <div class="fg">
          <label for="bettingOpponentSelect">Opponent</label>
          <select id="bettingOpponentSelect">${opponentOptions.map(option => `<option value="${option.id}" ${option.id === opponentId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div class="fg">
          <label for="bettingEventSelect">Split</label>
          <select id="bettingEventSelect">${eventOptions.map(option => `<option value="${option.id}" ${option.id === eventId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div class="fg">
          <label for="bettingLineInput">Line (Optional)</label>
          <input id="bettingLineInput" type="text" inputmode="decimal" placeholder="Ex: 23.5" value="${escapeAttr(line)}">
        </div>
        <div class="fg">
          <label for="bettingModeSelect">Mode Drill-Down</label>
          <select id="bettingModeSelect">${BETTING_MODE_OPTIONS.map(option => `<option value="${option.id}" ${option.id === modeId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
      </div>
      ${selectedRosterEntry ? `<div class="bet-hero">
        <div class="bet-hero-id">
          ${img(teamLogoCandidates(teamId), 't-logo-lg', teamName(teamId))}
          <div>
            <div class="bet-hero-name" style="color:${teamColor(teamId)}">${escapeHtml(playerName)}</div>
            <div class="bet-hero-sub">${escapeHtml(teamName(teamId))} | ${escapeHtml(selectedSplitLabel)} | ${fmtNum(samples.length)} series logs</div>
          </div>
        </div>
        <div class="bet-hero-right">
          <div class="bet-pill">${selectedRosterEntry.active === false ? 'Inactive / Bench' : 'Active Roster'}</div>
          ${profile ? isrBadge(profile.overallISR) : '<span class="bet-pill">ISR unavailable</span>'}
        </div>
      </div>` : `<div class="bet-empty">Choose a player to start building a card.</div>`}
    </div>

    <div class="bet-panel">
      <div class="bet-flex">
        <div>
          <div class="card-title">Player Prop Market Tracker</div>
          <div class="bet-subtle">Quick read on the selected market, recent form, and the entered line.</div>
        </div>
        <div class="bet-subtle">${lineValue === null ? 'Enter a line to unlock projection edge and hit-rate grading.' : `Line ${formatPropValue(lineValue, market.id, 'display')} | ${edge === null ? 'No lean yet' : edge >= 0 ? 'Lean over' : 'Lean under'}`}</div>
      </div>
      <div class="bet-market-row">
        ${BETTING_MARKETS.map(entry => `<button class="bet-chip ${entry.id === market.id ? 'on' : ''}" type="button" data-prop-market="${entry.id}">${entry.shortLabel}</button>`).join('')}
      </div>
      <div class="bet-kpis">${summaryMarkup}</div>
      <div class="bet-filter-line">
        <span class="bet-mini-pill">${escapeHtml(selectedSplitLabel)}</span>
        <span class="bet-mini-pill">${escapeHtml(filterSummary)}</span>
        <span class="bet-mini-pill">${market.label}</span>
      </div>
      ${lastFiveMarkup}
      <div class="bet-table-note">${lineValue === null ? 'Projection blends the full-sample average, median, and recent form. Add a line to grade overs against the prop number.' : `Hit rate uses over logic against ${formatPropValue(lineValue, market.id, 'display')}. Projection blends the full-sample average, median, and last 5.`}</div>
    </div>

    <div class="bet-panel">
      <div class="bet-flex">
        <div>
          <div class="card-title">Filtered Prop Log</div>
          <div class="bet-subtle">Every matching series result, map context, and line outcome for the selected player prop.</div>
        </div>
      </div>
      <div class="table-wrap stack-on-mobile">
        <table class="responsive-table table">
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
    </div>
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
  const h2h = matchupHeadToHead(teamA, teamB);
  const teamRowsA = (state.data.playerAggList || []).filter(row => row.teamId === teamA);
  const teamRowsB = (state.data.playerAggList || []).filter(row => row.teamId === teamB);
  const totalKillsA = teamRowsA.reduce((sum, row) => sum + (num(row.kills) ?? 0), 0);
  const totalKillsB = teamRowsB.reduce((sum, row) => sum + (num(row.kills) ?? 0), 0);
  const pickFrequency = (teamId, mode) => {
    const counts = {};
    (state.data.maps || []).forEach(map => {
      const match = state.data.matchesById?.[map.matchId];
      if(match && (match.team1Id === teamId || match.team2Id === teamId) && map.mode === mode){
        counts[map.mapName] = (counts[map.mapName] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((left, right) => right[1] - left[1]);
  };
  const suggestedMaps = ['HP', 'SND', 'OL', 'HP', 'SND'].map((mode, index) => {
    const combined = {};
    pickFrequency(teamA, mode).forEach(([mapName, count]) => {
      combined[mapName] = (combined[mapName] || 0) + count;
    });
    pickFrequency(teamB, mode).forEach(([mapName, count]) => {
      combined[mapName] = (combined[mapName] || 0) + count;
    });
    const top = Object.entries(combined).sort((left, right) => right[1] - left[1])[0];
    return {
      mapNum: index + 1,
      mode,
      mapName: top?.[0] || 'No data',
      plays: top?.[1] || 0
    };
  });
  const statBar = (leftValue, rightValue, label) => {
    const total = (leftValue || 0) + (rightValue || 0) || 1;
    const leftPct = ((leftValue || 0) / total) * 100;
    const rightPct = ((rightValue || 0) / total) * 100;
    return `<div class="stat-cmp">
      <div class="scl" style="color:${teamColor(teamA)}">${fmtNum(leftValue)}</div>
      <div class="sc-lbl">${label}</div>
      <div class="scr" style="color:${teamColor(teamB)}">${fmtNum(rightValue)}</div>
    </div>
    <div class="h2h-bar">
      <span style="width:${leftPct}%;background:${teamColor(teamA)}"></span>
      <span style="width:${rightPct}%;background:${teamColor(teamB)}"></span>
    </div>`;
  };

  $('#matchup').innerHTML = `
    ${sectionHeader('Matchup Builder', 'Head-to-head analysis and map pool context.')}
    <div class="card" style="margin-bottom:14px">
      <div class="mu-grid">
        <div class="team-sel-card">
          <div class="fg" style="margin-bottom:8px">
            <label for="matchupTeamA">Team 1</label>
            <select id="matchupTeamA">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamA ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
          </div>
          <div style="text-align:center;padding:8px">${img(teamLogoCandidates(teamA), 't-logo-lg', teamName(teamA))}</div>
          <div style="font-weight:800;text-align:center;color:${teamColor(teamA)}">${teamName(teamA)}</div>
        </div>
        <div class="vs-div">VS</div>
        <div class="team-sel-card">
          <div class="fg" style="margin-bottom:8px">
            <label for="matchupTeamB">Team 2</label>
            <select id="matchupTeamB">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamB ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
          </div>
          <div style="text-align:center;padding:8px">${img(teamLogoCandidates(teamB), 't-logo-lg', teamName(teamB))}</div>
          <div style="font-weight:800;text-align:center;color:${teamColor(teamB)}">${teamName(teamB)}</div>
        </div>
      </div>
      <div class="matchup-format-pill">Best of 5</div>
    </div>

    <div class="grid cols-2">
      <article class="card">
        <div class="card-title">Head-to-Head Record</div>
        ${h2h.matches.length ? `<div class="matchup-score">
          <div><div class="matchup-score-value" style="color:${teamColor(teamA)}">${h2h.seriesA}</div><div class="small">Series W</div></div>
          <div class="matchup-score-dash">-</div>
          <div><div class="matchup-score-value" style="color:${teamColor(teamB)}">${h2h.seriesB}</div><div class="small">Series W</div></div>
        </div>
        <div class="matchup-mapline">Maps: <span style="color:${teamColor(teamA)}">${h2h.mapsA}</span> - <span style="color:${teamColor(teamB)}">${h2h.mapsB}</span></div>
        <div class="divider"></div>
        ${h2h.matches.slice(0, 5).map(match => {
          const { s1, s2 } = getSeriesScore(match);
          const leftScore = match.team1Id === teamA ? s1 : s2;
          const rightScore = match.team1Id === teamA ? s2 : s1;
          return `<div class="mc-row">
            <span class="small muted" style="flex:1">${escapeHtml(formatBettingEvent(match.eventId || ''))} | ${fmtDate(match.date)}</span>
            <span class="${leftScore > rightScore ? 'value-pos' : 'value-neg'}">${leftScore}-${rightScore}</span>
          </div>`;
        }).join('')}` : '<div class="empty">These teams have not played each other in the current dataset yet.</div>'}
      </article>

      <article class="card">
        <div class="card-title">Season Stats Comparison</div>
        ${statBar(recordA.mapWins, recordB.mapWins, 'Map Wins')}
        ${statBar((state.data.maps || []).filter(map => map.mode === 'HP' && map.winner === teamA).length, (state.data.maps || []).filter(map => map.mode === 'HP' && map.winner === teamB).length, 'HP Wins')}
        ${statBar((state.data.maps || []).filter(map => map.mode === 'SND' && map.winner === teamA).length, (state.data.maps || []).filter(map => map.mode === 'SND' && map.winner === teamB).length, 'SND Wins')}
        ${statBar((state.data.maps || []).filter(map => map.mode === 'OL' && map.winner === teamA).length, (state.data.maps || []).filter(map => map.mode === 'OL' && map.winner === teamB).length, 'OL Wins')}
        ${statBar(totalKillsA, totalKillsB, 'Total Kills')}
      </article>
    </div>

    <article class="card">
      <div class="card-title">Suggested BO5 Map Picks <span class="small">Based on historical play frequency</span></div>
      ${suggestedMaps.map(entry => `<div class="matchup-pick-row">
        <span class="small muted">Map ${entry.mapNum}</span>
        ${modePill(entry.mode)}
        <strong>${escapeHtml(entry.mapName)}</strong>
        <span class="small muted">${entry.plays ? `${entry.plays} plays` : 'No data'}</span>
      </div>`).join('')}
    </article>
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
