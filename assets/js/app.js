import { APP_CONFIG } from './config.js';
import { state, setData, setSection, setUI } from './state.js';
import { loadAllData } from './data-loader.js';
import { fmtDate, fmtNum, fmtPct, modeLabel } from './formatters.js';
import { teamLogoCandidates, playerImageCandidates, brandingPath } from './asset-paths.js';
import { computeISR, isrTier, buildIsrPlayerFromTeamStats } from './isr.js';
import { buildSeasonOvrModel, ovrTier } from './ovr.js';
import { buildMatchupModel } from './matchup-model.js';

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

function portraitImg(candidates, className, alt = '', initials = ''){
  const list = Array.isArray(candidates) ? unique(candidates) : unique([candidates]);
  const hasSource = Boolean(list[0]);
  const first = list[0] || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const encoded = escapeAttr(JSON.stringify(list));
  const imgStyle = hasSource ? '' : ' style="display:none"';
  const fallbackStyle = hasSource ? ' style="display:none"' : '';
  return `<div class="portrait-wrap"><img src="${first}" class="${className}" alt="${escapeAttr(alt)}" data-candidates="${encoded}" data-candidate-index="0"${imgStyle} onerror="(function(node){try{const list=JSON.parse(node.dataset.candidates||'[]');const index=Number(node.dataset.candidateIndex||0)+1;node.dataset.candidateIndex=String(index);if(index<list.length){node.src=list[index];return;}}catch(error){}node.style.display='none';const fallback=node.nextElementSibling;if(fallback){fallback.style.display='flex';}})(this)"><div class="bp-player-init"${fallbackStyle}>${escapeHtml(initials)}</div></div>`;
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

function ovrBadge(score){
  const tier = ovrTier(score);
  const formattedScore = num(score) === null ? 'ISR unavailable' : `ISR ${fmtNum(score, 1)}`;
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

const TEAM_PAGE_TABS = [
  { id: 'overall', label: 'Overall' },
  { id: 'hardpoint', label: 'Hardpoint' },
  { id: 'snd', label: 'S&D' },
  { id: 'overload', label: 'Overload' },
  { id: 'mapRecords', label: 'Maps' },
  { id: 'picksVetos', label: 'Picks/Vetoes' }
];

function getTeamPageTab(tabId = state.ui.teamStatsTab){
  return TEAM_PAGE_TABS.find(tab => tab.id === tabId) || TEAM_PAGE_TABS[0];
}

function statValue(value, digits = 2){
  return num(value) === null ? '-' : fmtNum(value, digits);
}

function statPctValue(value, digits = 0){
  return num(value) === null ? '-' : fmtPct(Number(value) * 100, digits);
}

function statIntValue(value){
  return num(value) === null ? '-' : fmtNum(value);
}

function pairedRecordValue(win, loss){
  const hasWin = num(win) !== null;
  const hasLoss = num(loss) !== null;
  if(!hasWin && !hasLoss) return '-';
  return `${fmtNum(hasWin ? win : 0)}-${fmtNum(hasLoss ? loss : 0)}`;
}

function orderedTeamRoster(teamId, roster, teamStats, showInactive = false){
  const visibleRoster = showInactive ? [...roster] : roster.filter(player => player.active !== false);
  const order = new Map((teamStats?.overall?.players || []).map((row, index) => [normalizeName(row.player), index]));
  return visibleRoster.sort((left, right) =>
    (order.get(normalizeName(left.displayName || left.name)) ?? 99) - (order.get(normalizeName(right.displayName || right.name)) ?? 99) ||
    left.displayName.localeCompare(right.displayName)
  );
}

function teamTablePanel(title, subtitle, headerCells, rowMarkup, summaryMarkup = ''){
  return `
    <article class="card team-data-card">
      <div class="card-title">
        <span>${escapeHtml(title)}</span>
        <span class="team-data-subtle">${escapeHtml(subtitle)}</span>
      </div>
      ${summaryMarkup}
      <div class="table-wrap stack-on-mobile">
        <table class="responsive-table table">
          <thead><tr>${headerCells.map(cell => `<th>${cell}</th>`).join('')}</tr></thead>
          <tbody>${rowMarkup}</tbody>
        </table>
      </div>
    </article>
  `;
}

function teamProfileLookup(teamId){
  return new Map(
    (state.data.computed?.profilesByTeam?.[teamId] || [])
      .map(profile => [normalizeName(profile.displayName || profile.name || profile.playerId), profile])
  );
}

function teamTablePlayerName(profile, fallbackName){
  return profile?.displayName || fallbackName || '-';
}

function teamTableRating(profile, mode = null){
  if(!profile) return '-';
  const score = mode === 'HP'
    ? profile.hpOVR
    : mode === 'SND'
      ? profile.sndOVR
      : mode === 'OL'
        ? profile.olOVR
        : profile.overallOVR;
  return fmtNum(score, 1);
}

function buildTeamStatsPanel(teamId, teamStats, activeTab){
  const profiles = teamProfileLookup(teamId);
  const findProfile = playerName => profiles.get(normalizeName(playerName)) || null;

  if(activeTab === 'hardpoint'){
    const rows = (teamStats.hardpoint?.players || []).map(row => {
      const profile = findProfile(row.player);
      return `<tr>
      ${tableCell('Player', escapeHtml(teamTablePlayerName(profile, row.player)))}
      ${tableCell('K/D', statValue(row.kd, 2))}
      ${tableCell('K/10m', statValue(row.k10m, 2))}
      ${tableCell('Damage/10m', statIntValue(row.dmg10m))}
      ${tableCell('Obj/10m', statValue(row.obj10m, 2))}
      ${tableCell('Eng/10m', statValue(row.eng10m, 2))}
      ${tableCell('HP ISR', teamTableRating(profile, 'HP'))}
    </tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No hardpoint team stats available yet.</td></tr>';
    return teamTablePanel('Hardpoint', 'JSON-backed team breakdown with match-averaged ISR', ['Player', 'K/D', 'K/10m', 'Damage/10m', 'Obj/10m', 'Eng/10m', 'HP ISR'], rows);
  }
  if(activeTab === 'snd'){
    const rows = (teamStats.snd?.players || []).map(row => {
      const profile = findProfile(row.player);
      return `<tr>
      ${tableCell('Player', escapeHtml(teamTablePlayerName(profile, row.player)))}
      ${tableCell('K/D', statValue(row.kd, 2))}
      ${tableCell('K/Round', statValue(row.kRound, 2))}
      ${tableCell('Bloods', statIntValue(row.bloods))}
      ${tableCell('Plants', statIntValue(row.plants))}
      ${tableCell('Defuses', statIntValue(row.defuses))}
      ${tableCell('Snipes', statIntValue(row.snipes))}
      ${tableCell('Dmg/Round', statValue(row.dmgRound, 2))}
      ${tableCell('S&D ISR', teamTableRating(profile, 'SND'))}
    </tr>`;
    }).join('') || '<tr><td colspan="9" class="empty">No search and destroy stats available yet.</td></tr>';
    return teamTablePanel('Search and Destroy', 'JSON-backed team breakdown with match-averaged ISR', ['Player', 'K/D', 'K/Round', 'Bloods', 'Plants', 'Defuses', 'Snipes', 'Dmg/Round', 'S&D ISR'], rows);
  }
  if(activeTab === 'overload'){
    const rows = (teamStats.overload?.players || []).map(row => {
      const profile = findProfile(row.player);
      return `<tr>
      ${tableCell('Player', escapeHtml(teamTablePlayerName(profile, row.player)))}
      ${tableCell('K/D', statValue(row.kd, 2))}
      ${tableCell('K/10m', statValue(row.k10m, 2))}
      ${tableCell('Damage/10m', statIntValue(row.dmg10m))}
      ${tableCell('Goals/10m', statValue(row.goals10m, 2))}
      ${tableCell('Eng/10m', statValue(row.eng10m, 2))}
      ${tableCell('OL ISR', teamTableRating(profile, 'OL'))}
    </tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No overload stats available yet.</td></tr>';
    return teamTablePanel('Overload', 'JSON-backed team breakdown with match-averaged ISR', ['Player', 'K/D', 'K/10m', 'Damage/10m', 'Goals/10m', 'Eng/10m', 'OL ISR'], rows);
  }
  if(activeTab === 'mapRecords'){
    const totals = teamStats.mapRecords?.totals || {};
    const summary = `<div class="team-table-summary">
      <span class="team-table-pill">HP ${pairedRecordValue(totals.hpW, totals.hpL)}</span>
      <span class="team-table-pill">S&D ${pairedRecordValue(totals.sndW, totals.sndL)}</span>
      <span class="team-table-pill">Overload ${pairedRecordValue(totals.ovlW, totals.ovlL)}</span>
    </div>`;
    const rows = (teamStats.mapRecords?.maps || []).map(row => `<tr>
      ${tableCell('Map', `<strong>${escapeHtml(row.map)}</strong>`)}
      ${tableCell('HP', pairedRecordValue(row.hpW, row.hpL))}
      ${tableCell('S&D', pairedRecordValue(row.sndW, row.sndL))}
      ${tableCell('Overload', pairedRecordValue(row.ovlW, row.ovlL))}
    </tr>`).join('') || '<tr><td colspan="4" class="empty">No map records available yet.</td></tr>';
    return teamTablePanel('Map Records', 'Wins and losses by map and mode', ['Map', 'HP', 'S&D', 'Overload'], rows, summary);
  }
  if(activeTab === 'picksVetos'){
    const rows = (teamStats.picksVetos?.maps || []).map(row => `<tr>
      ${tableCell('Map', `<strong>${escapeHtml(row.map)}</strong>`)}
      ${tableCell('HP Pick', statIntValue(row.hpPick))}
      ${tableCell('HP Veto', statIntValue(row.hpVeto))}
      ${tableCell('S&D Pick', statIntValue(row.sndPick))}
      ${tableCell('S&D Veto', statIntValue(row.sndVeto))}
      ${tableCell('Ovl Pick', statIntValue(row.ovlPick))}
      ${tableCell('Ovl Veto', statIntValue(row.ovlVeto))}
    </tr>`).join('') || '<tr><td colspan="7" class="empty">No picks and vetoes data available yet.</td></tr>';
    return teamTablePanel('Picks and Vetoes', 'Map pool tendencies from the exported team JSON', ['Map', 'HP Pick', 'HP Veto', 'S&D Pick', 'S&D Veto', 'Ovl Pick', 'Ovl Veto'], rows);
  }
  const rows = (teamStats.overall?.players || []).map(row => {
    const profile = findProfile(row.player);
    return `<tr>
    ${tableCell('Player', `<strong>${escapeHtml(teamTablePlayerName(profile, row.player))}</strong>`)}
    ${tableCell('K/D', statValue(row.kd, 2))}
    ${tableCell('Slayer RTG', statValue(row.slayerRating, 2))}
    ${tableCell('Respawn K/D', statValue(row.respawnKd, 2))}
    ${tableCell('NTK%', statPctValue(row.ntkPct))}
    ${tableCell('ISR', teamTableRating(profile))}
  </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty">No overall team stats available yet.</td></tr>';
  return teamTablePanel('Overall Stats', 'JSON-backed player rows with match-averaged season ISR', ['Player', 'K/D', 'Slayer RTG', 'Respawn K/D', 'NTK%', 'ISR'], rows);
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
  const seasonOvrModel = buildSeasonOvrModel(data);
  const profilesByTeam = {};
  const allProfiles = [];
  const avgIsrByTeam = {};
  const avgOvrByTeam = {};
  const topPerformerByTeam = {};
  const topRatedByTeam = {};
  TEAM_IDS.forEach(teamId => {
    const preferredNames = new Map();
    const rememberName = (name, priority = 0) => {
      const normalized = normalizeName(name);
      if(!normalized) return;
      const existing = preferredNames.get(normalized);
      if(!existing || priority >= existing.priority){
        preferredNames.set(normalized, { name, priority });
      }
    };

    extractTeamStatNames(data.teamStats?.[teamId]).forEach(name => rememberName(name, 1));
    (data.playerAggList || [])
      .filter(row => row.teamId === teamId)
      .forEach(row => rememberName(row.name, 2));
    (data.playersByTeam?.[teamId] || []).forEach(player => rememberName(player.name, 3));

    const names = Array.from(preferredNames.values()).map(entry => entry.name);

    const profiles = names.map(name => {
      const key = `${teamId}::${normalizeName(name)}`;
      const aggregate = aggregateByKey.get(key) || {};
      const meta = metaByKey.get(key) || {};
      const base = buildIsrPlayerFromTeamStats(data.teamStats, teamId, name, data.playerAggList);
      const maps = num(aggregate.maps) ?? base.sample ?? 0;
      const damage = num(aggregate.damage) ?? 0;
      const playerId = meta.id || aggregate.playerId || `${teamId}_${normalizeName(name)}`;
      const ovrCard = seasonOvrModel.byPlayerId?.[playerId] || null;
      const profile = {
        ...base,
        displayName: meta.name || base.name || name,
        playerId,
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

      profile.overallOVR = ovrCard?.overall ?? null;
      profile.hpOVR = ovrCard?.hp ?? null;
      profile.sndOVR = ovrCard?.snd ?? null;
      profile.olOVR = ovrCard?.ol ?? null;
      profile.ratingMatchCount = ovrCard?.matchCount ?? 0;
      profile.ratingMapCount = ovrCard?.mapCount ?? 0;
      profile.ratingMatches = ovrCard?.matches || [];
      profile.ovrTier = ovrTier(profile.overallOVR);
      profile.overallISR = computeISR(profile, null, data.isr);
      profile.hpISR = computeISR(profile, 'HP', data.isr);
      profile.sndISR = computeISR(profile, 'SND', data.isr);
      profile.olISR = computeISR(profile, 'OL', data.isr);
      profile.tier = isrTier(profile.overallISR);
      profile.hasStats = [
        profile.overallOVR,
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
      (num(b.overallOVR) ?? -1) - (num(a.overallOVR) ?? -1) ||
      (num(b.overallISR) ?? -1) - (num(a.overallISR) ?? -1) ||
      a.displayName.localeCompare(b.displayName)
    );

    profilesByTeam[teamId] = profiles;
    const ratedProfiles = profiles.filter(profile => profile.overallISR !== null);
    const activeRatedProfiles = ratedProfiles.filter(profile => profile.active);
    const pool = activeRatedProfiles.length ? activeRatedProfiles : ratedProfiles;
    avgIsrByTeam[teamId] = average(pool.map(profile => profile.overallISR));
    topPerformerByTeam[teamId] = pool[0] || null;

    const ovrProfiles = profiles.filter(profile => profile.overallOVR !== null);
    const activeOvrProfiles = ovrProfiles.filter(profile => profile.active);
    const ovrPool = activeOvrProfiles.length ? activeOvrProfiles : ovrProfiles;
    avgOvrByTeam[teamId] = average(ovrPool.map(profile => profile.overallOVR));
    topRatedByTeam[teamId] = ovrPool[0] || null;
    allProfiles.push(...profiles.filter(profile => profile.hasStats));
  });

  return {
    profilesByTeam,
    allProfiles,
    avgIsrByTeam,
    avgOvrByTeam,
    topPerformerByTeam,
    topRatedByTeam,
    matchRatingByKey: seasonOvrModel.byMatchPlayerKey || {},
    mapRatingByKey: seasonOvrModel.byMapPlayerKey || {}
  };
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

const BETTING_MAP_STATS = [
  { id: 'kills', label: 'Kills', digits: 0 },
  { id: 'deaths', label: 'Deaths', digits: 0 },
  { id: 'kd', label: 'K/D', digits: 2 },
  { id: 'damage', label: 'Damage', digits: 0 },
  { id: 'assists', label: 'Assists', digits: 0 }
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

function buildBettingMapNameOptions({ teamId, playerId, opponentId = 'all', eventId = 'all', modeId = 'all' }){
  if(!teamId || !playerId){
    return [{ id: 'all', label: 'All Maps' }];
  }
  const names = unique((state.data.matches || [])
    .filter(match => match.team1Id === teamId || match.team2Id === teamId)
    .filter(match => opponentId === 'all' || match.team1Id === opponentId || match.team2Id === opponentId)
    .filter(match => eventId === 'all' || match.eventId === eventId)
    .flatMap(match => (state.data.mapsByMatch?.[match.id] || [])
      .filter(map => modeId === 'all' || map.mode === modeId)
      .filter(map => (state.data.playerStatsByMap?.[map.id] || []).some(row => row.playerId === playerId))
      .map(map => map.mapName)
    ));
  names.sort((left, right) => left.localeCompare(right));
  return [{ id: 'all', label: 'All Maps' }, ...names.map(name => ({ id: name, label: name }))];
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

  const mapStat = BETTING_MAP_STATS.some(option => option.id === state.ui.bettingMapStat)
    ? state.ui.bettingMapStat
    : BETTING_MAP_STATS[0].id;
  if(state.ui.bettingMapStat !== mapStat){
    setUI('bettingMapStat', mapStat);
  }

  const mapOptions = buildBettingMapNameOptions({ teamId, playerId, opponentId, eventId, modeId });
  const mapName = mapOptions.some(option => option.id === state.ui.bettingMapName)
    ? state.ui.bettingMapName
    : 'all';
  if(state.ui.bettingMapName !== mapName){
    setUI('bettingMapName', mapName);
  }

  const market = getBettingMarket(state.ui.bettingMarket);
  if(state.ui.bettingMarket !== market.id){
    setUI('bettingMarket', market.id);
  }

  const line = normalizeBettingLine(state.ui.bettingLine);
  if(state.ui.bettingLine !== line){
    setUI('bettingLine', line);
  }

  return {
    teamId,
    playerId,
    roster,
    opponentId,
    opponentOptions,
    eventId,
    eventOptions,
    modeId,
    market,
    line,
    mapName,
    mapOptions,
    mapStat
  };
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

function getBettingMapStat(statId = state.ui.bettingMapStat){
  return BETTING_MAP_STATS.find(stat => stat.id === statId) || BETTING_MAP_STATS[0];
}

function getMapStatValue(row, statId){
  if(statId === 'deaths') return Number(row.deaths || 0);
  if(statId === 'damage') return Number(row.damage || 0);
  if(statId === 'assists') return Number(row.assists || 0);
  if(statId === 'kd'){
    const kills = Number(row.kills || 0);
    const deaths = Number(row.deaths || 0);
    return deaths ? kills / deaths : kills;
  }
  return Number(row.kills || 0);
}

function formatMapStatValue(value, statId){
  const stat = getBettingMapStat(statId);
  return fmtNum(value, stat.digits);
}

function formatMapLineValue(value, statId){
  const parsed = num(value);
  if(parsed === null) return '-';
  if(statId === 'kd') return fmtNum(parsed, 2);
  if(statId === 'damage') return Number.isInteger(parsed) ? fmtNum(parsed, 0) : fmtNum(parsed, 1);
  return Number.isInteger(parsed) ? fmtNum(parsed, 0) : fmtNum(parsed, 1);
}

function buildBettingMapLogs({ teamId, playerId, opponentId, eventId, modeId, mapName, statId, lineValue }){
  if(!teamId || !playerId) return [];
  const matches = (state.data.matches || [])
    .filter(match => match.team1Id === teamId || match.team2Id === teamId)
    .filter(match => opponentId === 'all' || match.team1Id === opponentId || match.team2Id === opponentId)
    .filter(match => eventId === 'all' || match.eventId === eventId)
    .sort((left, right) => (right.ts || 0) - (left.ts || 0));

  const rows = [];
  matches.forEach(match => {
    const opponent = match.team1Id === teamId ? match.team2Id : match.team1Id;
    (state.data.mapsByMatch?.[match.id] || [])
      .filter(map => modeId === 'all' || map.mode === modeId)
      .filter(map => mapName === 'all' || map.mapName === mapName)
      .forEach(map => {
        const row = (state.data.playerStatsByMap?.[map.id] || []).find(playerStat => playerStat.playerId === playerId);
        if(!row) return;
        const value = getMapStatValue(row, statId);
        rows.push({
          match,
          map,
          row,
          ts: map.ts || match.ts || 0,
          eventLabel: formatBettingEvent(match.eventId),
          opponentId: opponent,
          opponentName: teamName(opponent),
          value,
          hit: lineValue === null ? null : value > lineValue,
          displayDate: formatBettingDate(match)
        });
      });
  });
  return rows.sort((left, right) => (right.ts || 0) - (left.ts || 0));
}

function buildMatchEventOptions(){
  const eventIds = unique((state.data.matches || []).map(match => match.eventId));
  eventIds.sort((left, right) => {
    const leftIndex = BETTING_EVENT_ORDER.indexOf(left);
    const rightIndex = BETTING_EVENT_ORDER.indexOf(right);
    if(leftIndex !== -1 || rightIndex !== -1){
      return (leftIndex === -1 ? BETTING_EVENT_ORDER.length : leftIndex) - (rightIndex === -1 ? BETTING_EVENT_ORDER.length : rightIndex);
    }
    return String(left).localeCompare(String(right));
  });
  return [{ id: 'all', label: 'All Events' }, ...eventIds.map(eventId => ({ id: eventId, label: formatBettingEvent(eventId) }))];
}

function sortMatchesDescending(left, right){
  return (right.ts || 0) - (left.ts || 0) ||
    String(right.date || '').localeCompare(String(left.date || '')) ||
    String(right.time || '').localeCompare(String(left.time || ''));
}

function formatMatchDayLabel(dayKey){
  if(dayKey === 'undated') return 'Undated Matches';
  const date = new Date(`${dayKey}T12:00:00`);
  if(Number.isNaN(date.getTime())) return dayKey;
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMatchMeta(match){
  const parts = [formatBettingEvent(match.eventId), fmtDate(match.date)];
  if(match.time) parts.push(escapeHtml(match.time));
  if(match.format) parts.push(escapeHtml(match.format));
  return parts.filter(Boolean).join(' | ');
}

function getMatchSeriesRating(playerId, matchId){
  return state.data.computed?.matchRatingByKey?.[`${playerId}::${matchId}`]?.overall ?? null;
}

function getMatchMapRating(playerId, mapId){
  return state.data.computed?.mapRatingByKey?.[`${playerId}::${mapId}`]?.overall ?? null;
}

function formatMatchIsr(value){
  const parsed = num(value);
  if(parsed === null) return '<span class="muted">-</span>';
  const tier = ovrTier(parsed);
  return `<span class="match-isr ${tier.colorClass}">${fmtNum(parsed, 1)}</span>`;
}

function getMatchTabKey(tab = state.ui.matchStatsTab){
  return tab || 'series';
}

function buildMatchSeriesRows(match, maps){
  const totals = new Map();
  maps.forEach(map => {
    (state.data.playerStatsByMap?.[map.id] || []).forEach(row => {
      const player = state.data.playerById?.[row.playerId];
      const key = row.playerId;
      const entry = totals.get(key) || {
        playerId: key,
        playerName: player?.name || key,
        teamId: row.teamId || player?.teamId || '',
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        maps: 0
      };
      entry.kills += Number(row.kills || 0);
      entry.deaths += Number(row.deaths || 0);
      entry.assists += Number(row.assists || 0);
      entry.damage += Number(row.damage || 0);
      entry.maps += 1;
      totals.set(key, entry);
    });
  });
  return Array.from(totals.values()).map(entry => ({
    ...entry,
    kd: entry.deaths ? entry.kills / entry.deaths : entry.kills,
    isr: getMatchSeriesRating(entry.playerId, match.id)
  }));
}

function buildMatchMapRows(map){
  return (state.data.playerStatsByMap?.[map.id] || []).map(row => {
    const player = state.data.playerById?.[row.playerId];
    const kills = Number(row.kills || 0);
    const deaths = Number(row.deaths || 0);
    return {
      playerId: row.playerId,
      playerName: player?.name || row.playerId,
      teamId: row.teamId || player?.teamId || '',
      kills,
      deaths,
      assists: Number(row.assists || 0),
      damage: Number(row.damage || 0),
      kd: deaths ? kills / deaths : kills,
      isr: getMatchMapRating(row.playerId, map.id)
    };
  });
}

function renderMatchStatsTable(teamId, rows, columns = 'series'){
  const sortedRows = [...rows].sort((left, right) =>
    (right.kills - left.kills) ||
    (right.kd - left.kd) ||
    left.playerName.localeCompare(right.playerName)
  );
  const maxKills = Math.max(1, ...sortedRows.map(row => row.kills || 0));
  return `
    <tr class="match-team-divider">
      <td colspan="${columns === 'series' ? 8 : 7}" style="border-left-color:${teamColor(teamId)}">${escapeHtml(teamName(teamId))}</td>
    </tr>
    ${sortedRows.map(row => {
      const barWidth = Math.max(8, Math.round(((row.kills || 0) / maxKills) * 100));
      return `<tr>
        <td class="match-player-name">${escapeHtml(row.playerName)}</td>
        <td class="num"><strong>${fmtNum(row.kills)}</strong></td>
        <td class="num">${fmtNum(row.deaths)}</td>
        <td class="num">${fmtNum(row.assists)}</td>
        <td class="num ${row.kd >= 1 ? 'value-pos' : row.kd < 1 ? 'value-neg' : ''}">${fmtNum(row.kd, 2)}</td>
        <td class="num">${fmtNum(row.damage)}</td>
        <td>${formatMatchIsr(row.isr)}</td>
        ${columns === 'series' ? `<td><div class="match-kill-bar"><span class="match-kill-fill" style="width:${barWidth}%;background:${teamColor(teamId)}"></span></div></td>` : ''}
      </tr>`;
    }).join('')}
  `;
}

function buildMatchDetailPanel(match, activeTab = 'series'){
  const maps = state.data.mapsByMatch?.[match.id] || [];
  const seriesRows = buildMatchSeriesRows(match, maps);
  const team1Series = seriesRows.filter(row => row.teamId === match.team1Id);
  const team2Series = seriesRows.filter(row => row.teamId === match.team2Id);
  const { s1, s2 } = getSeriesScore(match);
  const tabs = [
    { id: 'series', label: 'Series Stats' },
    ...maps.map(map => ({ id: `map-${map.id}`, label: `Map ${map.mapNum} | ${modeLabel(map.mode)}` }))
  ];

  const tabMarkup = tabs.map(tab => `
    <button class="match-detail-tab ${tab.id === activeTab ? 'on' : ''}" type="button" data-match-tab="${tab.id}" data-match-id="${match.id}">
      ${escapeHtml(tab.label)}
    </button>
  `).join('');

  if(activeTab === 'series'){
    return `
      <div class="match-detail">
        <div class="match-detail-tabs">${tabMarkup}</div>
        <div class="match-detail-pane">
          ${seriesRows.length ? `
            <div class="match-detail-summary">
              <span class="bet-mini-pill">${fmtNum(maps.length)} maps</span>
              <span class="bet-mini-pill">${fmtNum(seriesRows.length)} player stat lines</span>
              <span class="bet-mini-pill">${s1 !== null && s2 !== null ? `${fmtNum(s1)}-${fmtNum(s2)} final` : 'Series in progress'}</span>
            </div>
            <div class="table-wrap match-stats-wrap">
              <table class="table">
                <thead>
                  <tr><th>Player</th><th>K</th><th>D</th><th>A</th><th>K/D</th><th>Damage</th><th>ISR</th><th></th></tr>
                </thead>
                <tbody>
                  ${renderMatchStatsTable(match.team1Id, team1Series, 'series')}
                  ${renderMatchStatsTable(match.team2Id, team2Series, 'series')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty">No player stats were exported for this series yet.</div>'}
        </div>
      </div>
    `;
  }

  const activeMap = maps.find(map => `map-${map.id}` === activeTab) || maps[0] || null;
  if(!activeMap){
    return `
      <div class="match-detail">
        <div class="match-detail-tabs">${tabMarkup}</div>
        <div class="match-detail-pane"><div class="empty">No maps were logged for this series yet.</div></div>
      </div>
    `;
  }

  const mapRows = buildMatchMapRows(activeMap);
  const team1Rows = mapRows.filter(row => row.teamId === match.team1Id);
  const team2Rows = mapRows.filter(row => row.teamId === match.team2Id);
  const team1Won = activeMap.winner === match.team1Id;
  const team2Won = activeMap.winner === match.team2Id;

  return `
    <div class="match-detail">
      <div class="match-detail-tabs">${tabMarkup}</div>
      <div class="match-detail-pane">
        <div class="match-score-banner">
          <div class="match-score-team">
            ${img(teamLogoCandidates(match.team1Id), 'mini-logo', teamName(match.team1Id))}
            <div>
              <div class="match-score-name">${escapeHtml(teamName(match.team1Id))}</div>
              <div class="match-score-sub">${team1Won ? 'Map win' : team2Won ? 'Map loss' : 'Pending'}</div>
            </div>
            <div class="match-score-val ${team1Won ? 'win' : team2Won ? 'loss' : ''}">${fmtNum(activeMap.score1)}</div>
          </div>
          <div class="match-score-center">
            ${modePill(activeMap.mode)}
            <div class="match-score-mapname">${escapeHtml(activeMap.mapName || 'Unknown Map')}</div>
            <div class="match-score-sub">${activeMap.duration ? `${fmtNum(activeMap.duration)} min` : `Map ${fmtNum(activeMap.mapNum)}`}</div>
          </div>
          <div class="match-score-team right">
            <div class="match-score-val ${team2Won ? 'win' : team1Won ? 'loss' : ''}">${fmtNum(activeMap.score2)}</div>
            <div>
              <div class="match-score-name">${escapeHtml(teamName(match.team2Id))}</div>
              <div class="match-score-sub">${team2Won ? 'Map win' : team1Won ? 'Map loss' : 'Pending'}</div>
            </div>
            ${img(teamLogoCandidates(match.team2Id), 'mini-logo', teamName(match.team2Id))}
          </div>
        </div>
        ${mapRows.length ? `
          <div class="table-wrap match-stats-wrap">
            <table class="table">
              <thead>
                <tr><th>Player</th><th>K</th><th>D</th><th>A</th><th>K/D</th><th>Damage</th><th>ISR</th></tr>
              </thead>
              <tbody>
                ${renderMatchStatsTable(match.team1Id, team1Rows, 'map')}
                ${renderMatchStatsTable(match.team2Id, team2Rows, 'map')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty">No player stats were exported for this map yet.</div>'}
      </div>
    </div>
  `;
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
  const teamFilter = TEAM_IDS.includes(state.ui.matchFilter) ? state.ui.matchFilter : 'all';
  const eventFilter = buildMatchEventOptions().some(option => option.id === state.ui.matchEvent)
    ? state.ui.matchEvent
    : 'all';
  const search = state.ui.matchSearch.trim().toLowerCase();
  const expandedId = state.ui.matchExpandedId === null || state.ui.matchExpandedId === ''
    ? null
    : Number(state.ui.matchExpandedId);
  const activeTab = getMatchTabKey(state.ui.matchStatsTab);
  const teamOptions = ['all', ...TEAM_IDS];
  let matches = [...(state.data.matches || [])].sort(sortMatchesDescending);

  if(teamFilter !== 'all'){
    matches = matches.filter(match => match.team1Id === teamFilter || match.team2Id === teamFilter);
  }
  if(eventFilter !== 'all'){
    matches = matches.filter(match => match.eventId === eventFilter);
  }
  if(search){
    matches = matches.filter(match => {
      const maps = state.data.mapsByMatch?.[match.id] || [];
      const haystack = [
        teamName(match.team1Id),
        teamName(match.team2Id),
        formatBettingEvent(match.eventId),
        match.format,
        ...maps.map(map => map.mapName)
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }

  const groups = new Map();
  matches.forEach(match => {
    const key = match.date || 'undated';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  });

  const dayKeys = [...groups.keys()].sort((left, right) => {
    if(left === 'undated') return 1;
    if(right === 'undated') return -1;
    return right.localeCompare(left);
  });

  $('#matches').innerHTML = `
    ${sectionHeader(
      'Match Results',
      `${fmtNum(matches.length)} matches. Public drilldown now includes series stats and per-map player lines.`,
      `<div class="controls match-filter-bar">
        <select id="matchTeamFilter">${teamOptions.map(teamId => `<option value="${teamId}" ${teamId === teamFilter ? 'selected' : ''}>${teamId === 'all' ? 'All Teams' : teamName(teamId)}</option>`).join('')}</select>
        <select id="matchEventFilter">${buildMatchEventOptions().map(option => `<option value="${option.id}" ${option.id === eventFilter ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        <input id="matchSearchInput" type="text" placeholder="Search team, event, or map..." value="${escapeAttr(state.ui.matchSearch)}">
      </div>`
    )}
    ${matches.length ? dayKeys.map(dayKey => `
      <section class="match-day">
        <div class="match-day-hd">${formatMatchDayLabel(dayKey)}</div>
        <div class="match-day-list">
          ${groups.get(dayKey).map(match => {
            const { s1, s2, maps } = getSeriesScore(match);
            const isOpen = expandedId === match.id;
            const toggleLabel = isOpen ? 'Hide Stats' : 'View Stats';
            const mapStrip = maps.length
              ? `<div class="match-row-mapchips">${maps.map(map => {
                  const isWin = map.winner === match.team1Id;
                  const isLoss = map.winner === match.team2Id;
                  return `<span class="match-map-chip ${isWin ? 'win' : isLoss ? 'loss' : ''}" title="${escapeAttr(`Map ${map.mapNum} | ${modeLabel(map.mode)} | ${map.mapName || 'Unknown Map'}`)}">${escapeHtml(map.mode)}</span>`;
                }).join('')}</div>`
              : '<div class="match-row-mapchips"><span class="match-map-chip">TBD</span></div>';
            return `<article class="match-row ${isOpen ? 'open' : ''}">
              <div class="match-row-head">
                <div class="match-row-main">
                  <div class="match-row-meta">${formatMatchMeta(match)}</div>
                  <div class="match-row-line">
                    <span class="team-chip">${img(teamLogoCandidates(match.team1Id), 'mini-logo', teamName(match.team1Id))}<strong>${escapeHtml(teamName(match.team1Id))}</strong></span>
                    <span class="match-row-score">${s1 !== null && s2 !== null ? `<span class="${s1 > s2 ? 'value-pos' : ''}">${fmtNum(s1)}</span> - <span class="${s2 > s1 ? 'value-pos' : ''}">${fmtNum(s2)}</span>` : 'TBD'}</span>
                    <span class="team-chip"><strong>${escapeHtml(teamName(match.team2Id))}</strong>${img(teamLogoCandidates(match.team2Id), 'mini-logo', teamName(match.team2Id))}</span>
                    ${mapStrip}
                  </div>
                </div>
                <div class="match-row-actions">
                  <div class="match-row-event">${escapeHtml(formatBettingEvent(match.eventId))}</div>
                  <button class="match-toggle-btn" type="button" data-match-toggle="${match.id}">${toggleLabel}</button>
                </div>
              </div>
              ${isOpen ? buildMatchDetailPanel(match, activeTab) : ''}
            </article>`;
          }).join('')}
        </div>
      </section>
    `).join('') : '<div class="empty">No matches matched the current filters.</div>'}
  `;

  $('#matchTeamFilter')?.addEventListener('change', event => {
    setUI('matchFilter', event.target.value);
    renderMatches();
  });
  $('#matchEventFilter')?.addEventListener('change', event => {
    setUI('matchEvent', event.target.value);
    renderMatches();
  });
  $('#matchSearchInput')?.addEventListener('input', event => {
    setUI('matchSearch', event.target.value);
    renderMatches();
  });
  document.querySelectorAll('[data-match-toggle]').forEach(button => button.addEventListener('click', () => {
    const matchId = Number(button.dataset.matchToggle);
    const isOpen = Number(state.ui.matchExpandedId) === matchId;
    setUI('matchExpandedId', isOpen ? null : matchId);
    setUI('matchStatsTab', 'series');
    renderMatches();
  }));
  document.querySelectorAll('[data-match-tab]').forEach(button => button.addEventListener('click', () => {
    const matchId = Number(button.dataset.matchId);
    setUI('matchExpandedId', matchId);
    setUI('matchStatsTab', button.dataset.matchTab || 'series');
    renderMatches();
  }));
}

const PLAYER_MODE_OPTIONS = [
  { id: 'all', label: 'All Modes' },
  { id: 'HP', label: 'Hardpoint' },
  { id: 'SND', label: 'Search & Destroy' },
  { id: 'OL', label: 'Overload' },
  { id: 'RESP', label: 'Respawn' }
];

const PLAYER_TABLE_COLUMNS = [
  { id: 'player', label: 'Player', type: 'text', info: 'Open the player card popup for bio, accomplishments, and current scope stats.' },
  { id: 'team', label: 'Team', type: 'text', info: 'Current roster team for the selected scope.' },
  { id: 'maps', label: 'Maps', type: 'number', info: 'Maps played inside the current Event, Team, Mode, and Active filters.' },
  { id: 'kills', label: 'Kills', type: 'number', info: 'Total kills inside the current scope.' },
  { id: 'deaths', label: 'Deaths', type: 'number', info: 'Total deaths inside the current scope.' },
  { id: 'kd', label: 'K/D', type: 'number', info: 'Kills divided by deaths inside the current scope.' },
  { id: 'kPerMap', label: 'K/Map', type: 'number', info: 'Average kills per map inside the current scope.' },
  { id: 'kr', label: 'K/R', type: 'number', info: 'Respawn kills per respawn map. Uses Hardpoint and Overload maps only.' },
  { id: 'respawnKd', label: 'Respawn K/D', type: 'number', info: 'Combined Hardpoint and Overload kills divided by combined Hardpoint and Overload deaths.' },
  { id: 'isr', label: 'ISR', type: 'number', info: 'Average match rating inside the current scope. Mode filters use the matching mode-specific rating.' },
  { id: 'slayerRating', label: 'Slayer Rating', type: 'number', info: 'Card-scaled slaying score built from HP K/Map + (S&D K/Map x 3) + OL K/Map. Only shows when all 3 modes exist in the current scope.' },
  { id: 'hpKd', label: 'HP K/D', type: 'number', info: 'Hardpoint kills divided by Hardpoint deaths in the current scope.' },
  { id: 'sndKd', label: 'S&D K/D', type: 'number', info: 'Search and Destroy kills divided by Search and Destroy deaths in the current scope.' },
  { id: 'olKd', label: 'OL K/D', type: 'number', info: 'Overload kills divided by Overload deaths in the current scope.' }
];

function playerSortDefault(sortKey){
  return ['player', 'team'].includes(sortKey) ? 'asc' : 'desc';
}

function getPlayerEventOptions(){
  const eventIds = unique((state.data.matches || []).map(match => match.eventId));
  eventIds.sort((left, right) => {
    const leftIndex = BETTING_EVENT_ORDER.indexOf(left);
    const rightIndex = BETTING_EVENT_ORDER.indexOf(right);
    if(leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if(leftIndex === -1) return 1;
    if(rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
  return [{ id: 'all', label: 'Season Wide' }, ...eventIds.map(eventId => ({ id: eventId, label: formatBettingEvent(eventId) }))];
}

function matchesPlayerModeFilter(selectedMode, mapMode){
  if(selectedMode === 'all') return true;
  if(selectedMode === 'RESP') return mapMode === 'HP' || mapMode === 'OL';
  return mapMode === selectedMode;
}

function playerScopeRating(matchEntry, modeId){
  if(!matchEntry) return null;
  if(modeId === 'HP') return num(matchEntry.hp);
  if(modeId === 'SND') return num(matchEntry.snd);
  if(modeId === 'OL') return num(matchEntry.ol);
  if(modeId === 'RESP') return average([matchEntry.hp, matchEntry.ol]);
  return num(matchEntry.overall);
}

function formatPlayerModeLabel(modeId){
  return modeId === 'RESP' ? 'Respawn' : modeId === 'all' ? 'All Modes' : modeLabel(modeId);
}

function playerAgeLabel(dob){
  if(!dob) return '-';
  const birthDate = new Date(`${dob}T12:00:00`);
  if(Number.isNaN(birthDate.getTime())) return '-';
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed = now.getMonth() > birthDate.getMonth() || (
    now.getMonth() === birthDate.getMonth() &&
    now.getDate() >= birthDate.getDate()
  );
  if(!hasBirthdayPassed) age -= 1;
  return age >= 0 ? String(age) : '-';
}

function playerSeasonAccomplishments(){
  const byPlayerId = {};
  const matchesByEvent = {};
  (state.data.matches || []).forEach(match => {
    if(!match.eventId) return;
    (matchesByEvent[match.eventId] ||= []).push(match);
  });

  Object.entries(matchesByEvent).forEach(([eventId, matches]) => {
    const finalMatch = [...matches]
      .filter(isCompletedMatch)
      .sort((left, right) => {
        const leftStamp = new Date(`${left.date || '1970-01-01'} ${left.time || '12:00 AM'}`).getTime();
        const rightStamp = new Date(`${right.date || '1970-01-01'} ${right.time || '12:00 AM'}`).getTime();
        return leftStamp - rightStamp || Number(left.id || 0) - Number(right.id || 0);
      })
      .pop();
    if(!finalMatch) return;
    const { s1, s2 } = getSeriesScore(finalMatch);
    const winningTeam = s1 > s2 ? finalMatch.team1Id : s2 > s1 ? finalMatch.team2Id : null;
    if(!winningTeam) return;

    const statRows = matches.flatMap(match =>
      (state.data.mapsByMatch?.[match.id] || []).flatMap(map => state.data.playerStatsByMap?.[map.id] || [])
    );
    const winningPlayerIds = unique(statRows.filter(row => row.teamId === winningTeam).map(row => row.playerId));
    const bucketKey = eventId === 'CHAMPS'
      ? 'champsWins'
      : eventId === 'EWC'
        ? 'ewcWins'
        : eventId.endsWith('T')
          ? 'majorWins'
          : null;
    if(!bucketKey) return;
    winningPlayerIds.forEach(playerId => {
      const entry = byPlayerId[playerId] ||= { majorWins: 0, champsWins: 0, ewcWins: 0 };
      entry[bucketKey] += 1;
    });
  });

  return byPlayerId;
}

function rawSlayerRating(hpKpm, sndKpm, olKpm){
  return [hpKpm, sndKpm, olKpm].every(value => value !== null)
    ? hpKpm + (sndKpm * 3) + olKpm
    : null;
}

function scaleSlayerRating(rawScore){
  const value = num(rawScore);
  if(value === null) return null;
  const baseline = 60 + ((value - 60) * 1.85);
  const eliteBonus = Math.max(0, value - 72) * 0.75;
  return Math.round(Math.min(Math.max(baseline + eliteBonus, 60), 99) * 10) / 10;
}

function buildPlayerLeaderboardRows(){
  const search = state.ui.playerSearch.trim().toLowerCase();
  const eventId = getPlayerEventOptions().some(option => option.id === state.ui.playerEvent)
    ? state.ui.playerEvent
    : 'all';
  if(eventId !== state.ui.playerEvent) setUI('playerEvent', eventId);

  const teamFilter = TEAM_IDS.includes(state.ui.playerTeamFilter) ? state.ui.playerTeamFilter : 'all';
  if(teamFilter !== state.ui.playerTeamFilter) setUI('playerTeamFilter', teamFilter);

  const modeId = PLAYER_MODE_OPTIONS.some(option => option.id === state.ui.playerMode) ? state.ui.playerMode : 'all';
  if(modeId !== state.ui.playerMode) setUI('playerMode', modeId);

  const rowsByPlayer = new Map();
  for(const row of state.data.playerStats || []){
    const map = state.data.mapsById?.[row.mapId];
    const match = state.data.matchesById?.[map?.matchId];
    const playerMeta = state.data.playerById?.[row.playerId] || {};
    const playerTeamId = row.teamId || playerMeta.teamId || '';
    const playerName = playerMeta.name || row.playerId;
    const active = playerMeta.active ?? true;
    const mapMode = String(map?.mode || '').toUpperCase();

    if(!map || !match) continue;
    if(eventId !== 'all' && match.eventId !== eventId) continue;
    if(teamFilter !== 'all' && playerTeamId !== teamFilter) continue;
    if(!state.ui.playerShowInactive && active === false) continue;
    if(!matchesPlayerModeFilter(modeId, mapMode)) continue;

    const entry = rowsByPlayer.get(row.playerId) || {
      playerId: row.playerId,
      displayName: playerName,
      teamId: playerTeamId,
      active,
      maps: 0,
      kills: 0,
      deaths: 0,
      damage: 0,
      assists: 0,
      byMode: {
        HP: { maps: 0, kills: 0, deaths: 0 },
        SND: { maps: 0, kills: 0, deaths: 0 },
        OL: { maps: 0, kills: 0, deaths: 0 }
      },
      matchIds: new Set()
    };

    entry.maps += 1;
    entry.kills += Number(row.kills || 0);
    entry.deaths += Number(row.deaths || 0);
    entry.damage += Number(row.damage || 0);
    entry.assists += Number(row.assists || 0);
    entry.matchIds.add(map.matchId);

    if(entry.byMode[mapMode]){
      entry.byMode[mapMode].maps += 1;
      entry.byMode[mapMode].kills += Number(row.kills || 0);
      entry.byMode[mapMode].deaths += Number(row.deaths || 0);
    }

    rowsByPlayer.set(row.playerId, entry);
  }

  let rows = Array.from(rowsByPlayer.values()).map(entry => {
    const hpBucket = entry.byMode.HP;
    const sndBucket = entry.byMode.SND;
    const olBucket = entry.byMode.OL;
    const hpKpm = hpBucket.maps ? hpBucket.kills / hpBucket.maps : null;
    const sndKpm = sndBucket.maps ? sndBucket.kills / sndBucket.maps : null;
    const olKpm = olBucket.maps ? olBucket.kills / olBucket.maps : null;
    const rawSlayer = rawSlayerRating(hpKpm, sndKpm, olKpm);
    const respawnMaps = hpBucket.maps + olBucket.maps;
    const respawnKills = hpBucket.kills + olBucket.kills;
    const ratingValues = Array.from(entry.matchIds)
      .map(matchId => playerScopeRating(state.data.computed?.matchRatingByKey?.[`${entry.playerId}::${matchId}`], modeId))
      .filter(value => value !== null);
    const searchKey = `${entry.displayName} ${teamName(entry.teamId)} ${teamAbbr(entry.teamId)}`.toLowerCase();
    return {
      ...entry,
      kd: entry.deaths ? entry.kills / entry.deaths : entry.kills,
      kPerMap: entry.maps ? entry.kills / entry.maps : null,
      kr: respawnMaps ? respawnKills / respawnMaps : null,
      hpKd: hpBucket.deaths ? hpBucket.kills / hpBucket.deaths : hpBucket.kills || null,
      sndKd: sndBucket.deaths ? sndBucket.kills / sndBucket.deaths : sndBucket.kills || null,
      olKd: olBucket.deaths ? olBucket.kills / olBucket.deaths : olBucket.kills || null,
      respawnKd: (hpBucket.deaths + olBucket.deaths)
        ? (hpBucket.kills + olBucket.kills) / (hpBucket.deaths + olBucket.deaths)
        : (hpBucket.kills + olBucket.kills) || null,
      dmgPerMap: entry.maps ? entry.damage / entry.maps : null,
      isr: average(ratingValues),
      scopeMatchCount: entry.matchIds.size,
      slayerRatingRaw: rawSlayer,
      slayerRating: scaleSlayerRating(rawSlayer),
      searchKey
    };
  });

  if(search){
    rows = rows.filter(row => row.searchKey.includes(search));
  }

  return rows;
}

function playerSortValue(row, sortKey){
  if(sortKey === 'player') return row.displayName;
  if(sortKey === 'team') return teamName(row.teamId);
  return num(row[sortKey]);
}

function sortPlayerRows(rows){
  const validSort = PLAYER_TABLE_COLUMNS.some(column => column.id === state.ui.playerSort)
    ? state.ui.playerSort
    : 'isr';
  if(validSort !== state.ui.playerSort) setUI('playerSort', validSort);
  const direction = ['asc', 'desc'].includes(state.ui.playerSortDir) ? state.ui.playerSortDir : playerSortDefault(validSort);
  if(direction !== state.ui.playerSortDir) setUI('playerSortDir', direction);
  const column = PLAYER_TABLE_COLUMNS.find(item => item.id === validSort) || PLAYER_TABLE_COLUMNS[0];

  return [...rows].sort((left, right) => {
    const leftValue = playerSortValue(left, validSort);
    const rightValue = playerSortValue(right, validSort);

    if(column.type === 'text'){
      return direction === 'asc'
        ? String(leftValue || '').localeCompare(String(rightValue || ''))
        : String(rightValue || '').localeCompare(String(leftValue || ''));
    }

    if(leftValue === null && rightValue === null) return left.displayName.localeCompare(right.displayName);
    if(leftValue === null) return 1;
    if(rightValue === null) return -1;
    if(leftValue === rightValue){
      return left.displayName.localeCompare(right.displayName);
    }
    return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
  });
}

function playerRatingToneClass(score){
  const value = num(score);
  if(value === null) return 'rating-tone-unrated';
  if(value >= 90) return 'rating-tone-90';
  if(value >= 80) return 'rating-tone-80';
  if(value >= 70) return 'rating-tone-70';
  return 'rating-tone-sub70';
}

function playerRatingValue(score, digits = 1){
  return `<span class="player-rating-text ${playerRatingToneClass(score)}">${fmtNum(score, digits)}</span>`;
}

function legacyPlayerHeaderButton(column, activeSort, direction){
  const isActive = activeSort === column.id;
  const arrow = !isActive ? '' : direction === 'asc' ? ' ▲' : ' ▼';
  return `<button class="player-sort-btn ${isActive ? 'is-active' : ''}" type="button" data-player-sort="${column.id}">${column.label}${arrow}</button>`;
}

function legacyPlayerLeaderboardRowMarkup(player, index){
  const rankClass = index === 0 ? 'r1' : index === 1 ? 'r2' : index === 2 ? 'r3' : 'rd';
  return `<tr>
    ${tableCell('#', `<span class="rnk ${rankClass}">${index + 1}</span>`)}
    ${tableCell('Player', `<button class="player-open-btn" type="button" data-player-open="${escapeAttr(player.playerId)}"><span class="player-chip">${img(playerImageCandidates(player.teamId, player.displayName), 'mini-avatar', player.displayName)}<span>${escapeHtml(player.displayName)}</span></span></button>`)}
    ${tableCell('Team', `<span class="team-chip">${img(teamLogoCandidates(player.teamId), 'mini-logo', teamName(player.teamId))}<span>${teamAbbr(player.teamId)}</span></span>`)}
    ${tableCell('Maps', fmtNum(player.maps))}
    ${tableCell('Kills', fmtNum(player.kills))}
    ${tableCell('Deaths', fmtNum(player.deaths))}
    ${tableCell('K/D', fmtNum(player.kd, 2))}
    ${tableCell('K/Map', fmtNum(player.kPerMap, 1))}
    ${tableCell('HP K/D', fmtNum(player.hpKd, 2))}
    ${tableCell('S&D K/D', fmtNum(player.sndKd, 2))}
    ${tableCell('OL K/D', fmtNum(player.olKd, 2))}
    ${tableCell('Respawn K/D', fmtNum(player.respawnKd, 2))}
    ${tableCell('ISR', `<span class="match-isr ${ovrTier(player.isr).colorClass}">${fmtNum(player.isr, 1)}</span>`)}
    ${tableCell('Slayer Rating', fmtNum(player.slayerRating, 1))}
  </tr>`;
}

function playerBioMeta(playerId){
  return state.data.playerBios?.[playerId] || {};
}

function legacyPlayerModalMarkup(player){
  if(!player) return '';
  const bio = playerBioMeta(player.playerId);
  const seasonWins = playerSeasonAccomplishments()[player.playerId] || { majorWins: 0, champsWins: 0, ewcWins: 0 };
  const majorWins = num(bio.seasonMajorWins) ?? num(bio.majorWins) ?? seasonWins.majorWins;
  const champsWins = num(bio.seasonChampsWins) ?? num(bio.champsWins) ?? seasonWins.champsWins;
  const ewcWins = num(bio.seasonEwcWins) ?? num(bio.ewcWins) ?? seasonWins.ewcWins;
  const scopeLabel = getPlayerEventOptions().find(option => option.id === state.ui.playerEvent)?.label || 'Season Wide';
  const modeLabelText = formatPlayerModeLabel(state.ui.playerMode);
  const dob = bio.dob ? fmtDate(bio.dob) : 'Not added';
  const age = bio.dob ? playerAgeLabel(bio.dob) : '-';
  const role = bio.role || 'Role not added';
  const fullName = bio.fullName || player.displayName;

  return `<div class="player-modal-backdrop" data-player-close="backdrop">
    <article class="player-modal-card">
      <button class="player-modal-close" type="button" aria-label="Close player details" data-player-close="button">×</button>
      <div class="player-modal-top">
        <div class="player-modal-visual">
          ${portraitImg(playerImageCandidates(player.teamId, player.displayName), 'player-modal-avatar', player.displayName, player.displayName.slice(0, 3).toUpperCase())}
          ${img(teamLogoCandidates(player.teamId), 'player-modal-team-logo', teamName(player.teamId))}
        </div>
        <div class="player-modal-copy">
          <div class="eyebrow">Player Card</div>
          <h3>${escapeHtml(player.displayName)}</h3>
          <p class="player-modal-fullname">${escapeHtml(fullName)}</p>
          <p class="muted">${teamName(player.teamId)} • ${escapeHtml(role)} • ${player.active === false ? 'Inactive roster spot' : 'Active roster'} • ${scopeLabel} • ${modeLabelText}</p>
          <div class="player-modal-pillrow">
            ${ovrBadge(player.isr)}
            <span class="pill">${escapeHtml(role)}</span>
            <span class="pill">Slayer ${fmtNum(player.slayerRating, 1)}</span>
            <span class="pill">Maps ${fmtNum(player.maps)}</span>
            <span class="pill">K/D ${fmtNum(player.kd, 2)}</span>
          </div>
        </div>
      </div>
      <div class="player-modal-grid">
        <section class="card player-modal-panel">
          <div class="card-title"><span>Bio</span><span class="team-data-subtle">Metadata-backed popup card</span></div>
          <div class="player-modal-meta">
            <div><span>DOB</span><strong>${escapeHtml(dob)}</strong></div>
            <div><span>Age</span><strong>${escapeHtml(age)}</strong></div>
            <div><span>2026 Major Wins</span><strong>${fmtNum(majorWins)}</strong></div>
            <div><span>2026 Champs Wins</span><strong>${fmtNum(champsWins)}</strong></div>
            <div><span>2026 EWC Wins</span><strong>${fmtNum(ewcWins)}</strong></div>
            <div><span>Player ID</span><strong>${escapeHtml(player.playerId)}</strong></div>
          </div>
        </section>
        <section class="card player-modal-panel">
          <div class="card-title"><span>Scope Stats</span><span class="team-data-subtle">Current table filters applied</span></div>
          <div class="player-modal-meta">
            <div><span>Kills</span><strong>${fmtNum(player.kills)}</strong></div>
            <div><span>Deaths</span><strong>${fmtNum(player.deaths)}</strong></div>
            <div><span>K/Map</span><strong>${fmtNum(player.kPerMap, 1)}</strong></div>
            <div><span>HP K/D</span><strong>${fmtNum(player.hpKd, 2)}</strong></div>
            <div><span>S&D K/D</span><strong>${fmtNum(player.sndKd, 2)}</strong></div>
            <div><span>OL K/D</span><strong>${fmtNum(player.olKd, 2)}</strong></div>
            <div><span>Respawn K/D</span><strong>${fmtNum(player.respawnKd, 2)}</strong></div>
            <div><span>Matches</span><strong>${fmtNum(player.scopeMatchCount)}</strong></div>
          </div>
        </section>
      </div>
    </article>
  </div>`;
}

function legacyRenderPlayers(){
  const rows = sortPlayerRows(buildPlayerLeaderboardRows());
  const playerCountLabel = `${fmtNum(rows.length)} players • Click headers to sort`;
  const activeSort = PLAYER_TABLE_COLUMNS.some(column => column.id === state.ui.playerSort) ? state.ui.playerSort : 'isr';
  const activeDir = ['asc', 'desc'].includes(state.ui.playerSortDir) ? state.ui.playerSortDir : playerSortDefault(activeSort);
  const modalPlayer = rows.find(player => player.playerId === state.ui.playerModalId) || null;

  $('#players').innerHTML = `
    ${sectionHeader('Player Stats', playerCountLabel)}
    <div class="notice player-stats-note">ISR = average match rating inside the selected scope. Slayer Rating uses HP K/Map + (S&amp;D K/Map × 3) + OL K/Map, then remaps it to a 60-99 public card scale.</div>
    <div class="controls player-filter-grid">
      <select id="playerEventFilter">${getPlayerEventOptions().map(option => `<option value="${option.id}" ${option.id === state.ui.playerEvent ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
      <select id="playerTeamFilter">${[{ id: 'all', label: 'All Teams' }, ...TEAM_IDS.map(teamId => ({ id: teamId, label: teamName(teamId) }))].map(option => `<option value="${option.id}" ${option.id === state.ui.playerTeamFilter ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
      <select id="playerModeFilter">${PLAYER_MODE_OPTIONS.map(option => `<option value="${option.id}" ${option.id === state.ui.playerMode ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
      <input id="playerSearch" placeholder="Search players or teams" value="${escapeAttr(state.ui.playerSearch)}">
      <label class="player-toggle">
        <input id="playerInactiveToggle" type="checkbox" ${state.ui.playerShowInactive ? 'checked' : ''}>
        <span>Show Inactive</span>
      </label>
    </div>
    ${rows.length ? `<div class="table-wrap stack-on-mobile player-leaderboard-wrap">
      <table class="responsive-table table">
        <thead>
          <tr>
            <th>#</th>
            ${PLAYER_TABLE_COLUMNS.map(column => `<th>${playerHeaderButton(column, activeSort, activeDir)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((player, index) => playerLeaderboardRowMarkup(player, index)).join('')}
        </tbody>
      </table>
    </div>` : `<div class="empty">No players matched the current Player Stats filters.</div>`}
    ${playerModalMarkup(modalPlayer)}
  `;

  $('#playerEventFilter')?.addEventListener('change', event => {
    setUI('playerEvent', event.target.value);
    setUI('playerModalId', null);
    renderPlayers();
  });
  $('#playerTeamFilter')?.addEventListener('change', event => {
    setUI('playerTeamFilter', event.target.value);
    setUI('playerModalId', null);
    renderPlayers();
  });
  $('#playerModeFilter')?.addEventListener('change', event => {
    setUI('playerMode', event.target.value);
    setUI('playerModalId', null);
    renderPlayers();
  });
  $('#playerSearch')?.addEventListener('input', event => {
    setUI('playerSearch', event.target.value);
    renderPlayers();
  });
  $('#playerInactiveToggle')?.addEventListener('change', event => {
    setUI('playerShowInactive', event.target.checked);
    setUI('playerModalId', null);
    renderPlayers();
  });
  document.querySelectorAll('[data-player-sort]').forEach(button => button.addEventListener('click', () => {
    const nextSort = button.dataset.playerSort;
    if(nextSort === state.ui.playerSort){
      setUI('playerSortDir', state.ui.playerSortDir === 'asc' ? 'desc' : 'asc');
    }else{
      setUI('playerSort', nextSort);
      setUI('playerSortDir', playerSortDefault(nextSort));
    }
    renderPlayers();
  }));
  document.querySelectorAll('[data-player-open]').forEach(button => button.addEventListener('click', () => {
    setUI('playerModalId', button.dataset.playerOpen || null);
    renderPlayers();
  }));
  document.querySelectorAll('[data-player-close]').forEach(button => button.addEventListener('click', event => {
    if(event.target !== event.currentTarget && button.dataset.playerClose === 'backdrop') return;
    setUI('playerModalId', null);
    renderPlayers();
  }));
}

function playerHeaderButton(column, activeSort, direction){
  const isActive = activeSort === column.id;
  const arrow = !isActive ? '' : direction === 'asc' ? ' &#9650;' : ' &#9660;';
  const infoMarkup = column.info
    ? `<button class="player-stat-help" type="button" data-player-stat-info="${escapeAttr(column.info)}" aria-label="${escapeAttr(column.label)} info">?</button>`
    : '';
  return `<div class="player-th-wrap">
    <button class="player-sort-btn ${isActive ? 'is-active' : ''}" type="button" data-player-sort="${column.id}">${column.label}${arrow}</button>
    ${infoMarkup}
  </div>`;
}

function playerCellMarkup(player, columnId){
  if(columnId === 'player'){
    return `<button class="player-open-btn" type="button" data-player-open="${escapeAttr(player.playerId)}"><span class="player-chip">${img(playerImageCandidates(player.teamId, player.displayName), 'mini-avatar', player.displayName)}<span>${escapeHtml(player.displayName)}</span></span></button>`;
  }
  if(columnId === 'team'){
    return `<span class="team-logo-only" title="${escapeAttr(teamName(player.teamId))}">${img(teamLogoCandidates(player.teamId), 'mini-logo', teamName(player.teamId))}</span>`;
  }
  if(columnId === 'isr'){
    return playerRatingValue(player.isr, 1);
  }
  if(columnId === 'maps' || columnId === 'kills' || columnId === 'deaths'){
    return fmtNum(player[columnId]);
  }
  if(columnId === 'slayerRating'){
    return playerRatingValue(player[columnId], 1);
  }
  if(columnId === 'kPerMap' || columnId === 'kr'){
    return fmtNum(player[columnId], 1);
  }
  return fmtNum(player[columnId], 2);
}

function ensurePlayerStatTooltip(){
  let tooltip = document.getElementById('playerStatTooltip');
  if(!tooltip){
    tooltip = document.createElement('div');
    tooltip.id = 'playerStatTooltip';
    tooltip.className = 'player-stat-tooltip-layer';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function placePlayerStatTooltip(anchor, tooltip){
  const rect = anchor.getBoundingClientRect();
  const margin = 12;
  tooltip.style.left = '0px';
  tooltip.style.top = '0px';
  tooltip.classList.add('is-visible');
  const tipRect = tooltip.getBoundingClientRect();
  let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
  left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));
  let top = rect.top - tipRect.height - 10;
  if(top < margin){
    top = rect.bottom + 10;
  }
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function bindPlayerStatTooltips(){
  const tooltip = ensurePlayerStatTooltip();
  const hideTooltip = () => {
    tooltip.classList.remove('is-visible');
    tooltip.textContent = '';
  };
  const showTooltip = target => {
    const text = target.dataset.playerStatInfo || '';
    if(!text) return;
    tooltip.textContent = text;
    placePlayerStatTooltip(target, tooltip);
  };

  document.querySelectorAll('[data-player-stat-info]').forEach(button => {
    button.addEventListener('mouseenter', () => showTooltip(button));
    button.addEventListener('focus', () => showTooltip(button));
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if(tooltip.classList.contains('is-visible') && tooltip.textContent === (button.dataset.playerStatInfo || '')){
        hideTooltip();
      }else{
        showTooltip(button);
      }
    });
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('blur', hideTooltip);
  });

  if(!tooltip.dataset.bound){
    window.addEventListener('scroll', hideTooltip, { passive: true });
    window.addEventListener('resize', hideTooltip, { passive: true });
    document.addEventListener('click', event => {
      if(event.target.closest('[data-player-stat-info]')) return;
      hideTooltip();
    });
    tooltip.dataset.bound = 'true';
  }
}

function topPlayerByMetric(rows, metric){
  return [...rows]
    .filter(row => num(row[metric]) !== null)
    .sort((left, right) => {
      const diff = num(right[metric]) - num(left[metric]);
      return diff || left.displayName.localeCompare(right.displayName);
    })[0] || null;
}

function playerOverviewLeaderCard(title, player, metric, digits = 1, useRatingTone = false){
  if(!player){
    return `<article class="player-overview-card">
      <div class="player-overview-label">${escapeHtml(title)}</div>
      <div class="player-overview-empty">Unavailable in current scope.</div>
    </article>`;
  }

  const valueMarkup = useRatingTone
    ? playerRatingValue(player[metric], digits)
    : `<span class="player-overview-plain">${fmtNum(player[metric], digits)}</span>`;

  return `<article class="player-overview-card">
    <div class="player-overview-label">${escapeHtml(title)}</div>
    <div class="player-overview-identity">
      <span class="player-chip">${img(playerImageCandidates(player.teamId, player.displayName), 'mini-avatar', player.displayName)}<span>${escapeHtml(player.displayName)}</span></span>
      <span class="team-logo-only" title="${escapeAttr(teamName(player.teamId))}">${img(teamLogoCandidates(player.teamId), 'mini-logo', teamName(player.teamId))}</span>
    </div>
    <div class="player-overview-metric">${valueMarkup}</div>
    <div class="player-overview-sub">${teamName(player.teamId)}</div>
  </article>`;
}

function playerLeaderboardRowMarkup(player, index){
  const rankClass = index === 0 ? 'r1' : index === 1 ? 'r2' : index === 2 ? 'r3' : 'rd';
  return `<tr>
    ${tableCell('#', `<span class="rnk ${rankClass}">${index + 1}</span>`)}
    ${PLAYER_TABLE_COLUMNS.map(column => tableCell(column.label, playerCellMarkup(player, column.id))).join('')}
  </tr>`;
}

function playerModalMarkup(player){
  if(!player) return '';
  const bio = playerBioMeta(player.playerId);
  const majorWins = num(bio.careerMajorWins) ?? 0;
  const champsWins = num(bio.careerChampsWins) ?? 0;
  const ewcWins = num(bio.careerEwcWins) ?? 0;
  const eventMvpCount = num(bio.majorMVPs) ?? 0;
  const careerAccolades = Array.isArray(bio.careerAccolades) ? bio.careerAccolades : [];
  const highlightItems = [
    bio.rookieOfTheYear ? `Rookie of the Year: ${bio.rookieOfTheYear}` : null,
    ...careerAccolades
  ].filter(Boolean);
  const scopeLabel = getPlayerEventOptions().find(option => option.id === state.ui.playerEvent)?.label || 'Season Wide';
  const modeLabelText = formatPlayerModeLabel(state.ui.playerMode);
  const dob = bio.dob ? fmtDate(bio.dob) : 'Not added';
  const age = bio.dob ? playerAgeLabel(bio.dob) : '-';
  const role = bio.role || 'Role not added';
  const fullName = bio.fullName || player.displayName;

  return `<div class="player-modal-backdrop" data-player-close="backdrop">
    <article class="player-modal-card">
      <button class="player-modal-close" type="button" aria-label="Close player details" data-player-close="button">&times;</button>
      <div class="player-modal-top">
        <div class="player-modal-visual">
          <div class="bp-player-art player-modal-art" style="--thc:${teamColor(player.teamId)}">
            <div class="bp-player-backdrop">${img(teamLogoCandidates(player.teamId), 'bp-player-backdrop-logo', teamName(player.teamId))}</div>
            ${portraitImg(playerImageCandidates(player.teamId, player.displayName), 'bp-player-img player-modal-avatar', player.displayName, player.displayName.slice(0, 3).toUpperCase())}
          </div>
        </div>
        <div class="player-modal-copy">
          <div class="eyebrow">Player Card</div>
          <h3>${escapeHtml(player.displayName)}</h3>
          <p class="player-modal-fullname">${escapeHtml(fullName)}</p>
          <p class="muted">${teamName(player.teamId)} | ${escapeHtml(role)} | ${player.active === false ? 'Inactive roster spot' : 'Active roster'} | ${scopeLabel} | ${modeLabelText}</p>
          <div class="player-modal-pillrow">
            ${ovrBadge(player.isr)}
            <span class="pill">${escapeHtml(role)}</span>
            <span class="pill">Slayer ${fmtNum(player.slayerRating, 1)}</span>
            <span class="pill">Maps ${fmtNum(player.maps)}</span>
            <span class="pill">K/D ${fmtNum(player.kd, 2)}</span>
          </div>
        </div>
      </div>
      <div class="player-modal-grid">
        <section class="card player-modal-panel">
          <div class="card-title"><span>Bio</span><span class="team-data-subtle">Career bio and accomplishments</span></div>
          <div class="player-modal-meta">
            <div><span>DOB</span><strong>${escapeHtml(dob)}</strong></div>
            <div><span>Age</span><strong>${escapeHtml(age)}</strong></div>
            <div><span>Career Major Wins</span><strong>${fmtNum(majorWins)}</strong></div>
            <div><span>Career Champs Wins</span><strong>${fmtNum(champsWins)}</strong></div>
            <div><span>Career EWC Wins</span><strong>${fmtNum(ewcWins)}</strong></div>
            <div><span>Career Event MVPs</span><strong>${fmtNum(eventMvpCount)}</strong></div>
          </div>
          <div class="player-modal-highlights">
            <div class="player-modal-highlights-head">Career Highlights</div>
            ${highlightItems.length
              ? `<div class="player-modal-highlights-list">${highlightItems.map(item => `<span class="player-modal-highlight-pill">${escapeHtml(item)}</span>`).join('')}</div>`
              : '<div class="player-modal-highlights-empty">Career highlights are still being researched for this player.</div>'}
          </div>
        </section>
        <section class="card player-modal-panel">
          <div class="card-title"><span>Scope Stats</span><span class="team-data-subtle">Current table filters applied</span></div>
          <div class="player-modal-meta">
            <div><span>Kills</span><strong>${fmtNum(player.kills)}</strong></div>
            <div><span>Deaths</span><strong>${fmtNum(player.deaths)}</strong></div>
            <div><span>K/Map</span><strong>${fmtNum(player.kPerMap, 1)}</strong></div>
            <div><span>K/R</span><strong>${fmtNum(player.kr, 1)}</strong></div>
            <div><span>ISR</span><strong>${playerRatingValue(player.isr, 1)}</strong></div>
            <div><span>Slayer Rating</span><strong>${playerRatingValue(player.slayerRating, 1)}</strong></div>
            <div><span>HP K/D</span><strong>${fmtNum(player.hpKd, 2)}</strong></div>
            <div><span>S&D K/D</span><strong>${fmtNum(player.sndKd, 2)}</strong></div>
            <div><span>OL K/D</span><strong>${fmtNum(player.olKd, 2)}</strong></div>
            <div><span>Respawn K/D</span><strong>${fmtNum(player.respawnKd, 2)}</strong></div>
            <div><span>Matches</span><strong>${fmtNum(player.scopeMatchCount)}</strong></div>
          </div>
        </section>
      </div>
    </article>
  </div>`;
}

function renderPlayers(){
  const sourceRows = buildPlayerLeaderboardRows();
  const rows = sortPlayerRows(sourceRows);
  const playerCountLabel = `${fmtNum(rows.length)} players | Click headers to sort`;
  const activeSort = PLAYER_TABLE_COLUMNS.some(column => column.id === state.ui.playerSort) ? state.ui.playerSort : 'isr';
  const activeDir = ['asc', 'desc'].includes(state.ui.playerSortDir) ? state.ui.playerSortDir : playerSortDefault(activeSort);
  const modalPlayer = rows.find(player => player.playerId === state.ui.playerModalId) || null;
  const scopeLabel = getPlayerEventOptions().find(option => option.id === state.ui.playerEvent)?.label || 'Season Wide';
  const teamScopeLabel = state.ui.playerTeamFilter === 'all' ? 'All Teams' : teamName(state.ui.playerTeamFilter);
  const modeScopeLabel = formatPlayerModeLabel(state.ui.playerMode);
  const totalMaps = rows.reduce((sum, row) => sum + row.maps, 0);
  const topIsr = topPlayerByMetric(sourceRows, 'isr');
  const topSlayer = topPlayerByMetric(sourceRows, 'slayerRating');
  const topKr = topPlayerByMetric(sourceRows, 'kr');

  $('#players').innerHTML = `
    ${sectionHeader('Player Stats', playerCountLabel)}
    <div class="player-overview-grid">
      <article class="player-overview-card player-overview-card-scope">
        <div class="player-overview-label">Current Scope</div>
        <div class="player-overview-value">${escapeHtml(scopeLabel)}</div>
        <div class="player-overview-sub">${escapeHtml(teamScopeLabel)} | ${escapeHtml(modeScopeLabel)}</div>
        <div class="player-overview-meta">
          <span>${fmtNum(rows.length)} players in view</span>
          <span>${fmtNum(totalMaps)} maps in view</span>
        </div>
        <div class="player-overview-foot">ISR = average match rating. Slayer Rating uses HP K/Map + (S&amp;D K/Map x 3) + OL K/Map, then scales it to a public 60-99 card ladder.</div>
      </article>
      ${playerOverviewLeaderCard('Top ISR', topIsr, 'isr', 1, true)}
      ${playerOverviewLeaderCard('Top Slayer Rating', topSlayer, 'slayerRating', 1, true)}
      ${playerOverviewLeaderCard('Best K/R', topKr, 'kr', 1, false)}
    </div>
    <div class="controls player-filter-grid">
      <select id="playerEventFilter">${getPlayerEventOptions().map(option => `<option value="${option.id}" ${option.id === state.ui.playerEvent ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
      <select id="playerTeamFilter">${[{ id: 'all', label: 'All Teams' }, ...TEAM_IDS.map(teamId => ({ id: teamId, label: teamName(teamId) }))].map(option => `<option value="${option.id}" ${option.id === state.ui.playerTeamFilter ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
      <select id="playerModeFilter">${PLAYER_MODE_OPTIONS.map(option => `<option value="${option.id}" ${option.id === state.ui.playerMode ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
      <input id="playerSearch" placeholder="Search players or teams" value="${escapeAttr(state.ui.playerSearch)}">
      <label class="player-toggle">
        <input id="playerInactiveToggle" type="checkbox" ${state.ui.playerShowInactive ? 'checked' : ''}>
        <span>Show Inactive</span>
      </label>
    </div>
    ${rows.length ? `<div class="table-wrap stack-on-mobile player-leaderboard-wrap">
      <table class="responsive-table table">
        <thead>
          <tr>
            <th>#</th>
            ${PLAYER_TABLE_COLUMNS.map(column => `<th>${playerHeaderButton(column, activeSort, activeDir)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((player, index) => playerLeaderboardRowMarkup(player, index)).join('')}
        </tbody>
      </table>
    </div>` : `<div class="empty">No players matched the current Player Stats filters.</div>`}
    ${playerModalMarkup(modalPlayer)}
  `;

  $('#playerEventFilter')?.addEventListener('change', event => {
    setUI('playerEvent', event.target.value);
    setUI('playerModalId', null);
    renderPlayers();
  });
  $('#playerTeamFilter')?.addEventListener('change', event => {
    setUI('playerTeamFilter', event.target.value);
    setUI('playerModalId', null);
    renderPlayers();
  });
  $('#playerModeFilter')?.addEventListener('change', event => {
    setUI('playerMode', event.target.value);
    setUI('playerModalId', null);
    renderPlayers();
  });
  $('#playerSearch')?.addEventListener('input', event => {
    setUI('playerSearch', event.target.value);
    renderPlayers();
  });
  $('#playerInactiveToggle')?.addEventListener('change', event => {
    setUI('playerShowInactive', event.target.checked);
    setUI('playerModalId', null);
    renderPlayers();
  });
  document.querySelectorAll('[data-player-sort]').forEach(button => button.addEventListener('click', () => {
    const nextSort = button.dataset.playerSort;
    if(nextSort === state.ui.playerSort){
      setUI('playerSortDir', state.ui.playerSortDir === 'asc' ? 'desc' : 'asc');
    }else{
      setUI('playerSort', nextSort);
      setUI('playerSortDir', playerSortDefault(nextSort));
    }
    renderPlayers();
  }));
  document.querySelectorAll('[data-player-open]').forEach(button => button.addEventListener('click', () => {
    setUI('playerModalId', button.dataset.playerOpen || null);
    renderPlayers();
  }));
  document.querySelectorAll('[data-player-close]').forEach(button => button.addEventListener('click', event => {
    if(event.target !== event.currentTarget && button.dataset.playerClose === 'backdrop') return;
    setUI('playerModalId', null);
    renderPlayers();
  }));
  bindPlayerStatTooltips();
}

function renderTeams(){
  const teamId = state.ui.selectedTeam;
  const teamStats = state.data.teamStats?.[teamId] || {};
  const record = state.data.teamRecords?.[teamId] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
  const fullRoster = state.data.computed?.profilesByTeam?.[teamId] || [];
  const roster = orderedTeamRoster(teamId, fullRoster, teamStats, state.ui.teamShowInactive);
  const standings = getStandings();
  const standingRow = standings.find(row => row.teamId === teamId) || null;
  const standingPos = standingRow ? standings.findIndex(row => row.teamId === teamId) + 1 : null;
  const activeTab = getTeamPageTab().id;
  const activeCount = fullRoster.filter(player => player.active !== false).length;
  const avgOvr = state.data.computed?.avgOvrByTeam?.[teamId] ?? null;
  const topCard = state.data.computed?.topRatedByTeam?.[teamId] || null;
  const hasStats = TEAM_PAGE_TABS.some(tab => tab.id in teamStats);
  const parsedDate = teamStats.parsedAt ? new Date(teamStats.parsedAt).toLocaleDateString() : null;
  const selectorMarkup = `
    <div class="ts-selector-bar">
      <div class="ts-selector-left">
        ${img(teamLogoCandidates(teamId), 'ts-team-logo-sel', teamName(teamId))}
        <select id="teamSelect" class="ts-team-select">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamId ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
      </div>
      <div class="ts-selector-right">
        ${TEAM_IDS.map(id => `<button class="ts-logo-chip ${id === teamId ? 'ts-logo-chip-active' : ''} ${state.data.teamStats?.[id] ? 'ts-logo-chip-parsed' : ''}" type="button" data-team-chip="${id}" title="${escapeAttr(teamName(id))}">
          ${img(teamLogoCandidates(id), 'ts-chip-logo', teamName(id))}
        </button>`).join('')}
      </div>
    </div>`;

  const rosterMarkup = roster.length
    ? roster.map(player => {
        const name = player.displayName || player.name || player.playerId;
        return `<article class="bp-player-chip ${player.active === false ? 'bp-player-inactive' : ''}">
          <div class="bp-player-art">
            <div class="bp-player-backdrop">${img(teamLogoCandidates(teamId), 'bp-player-backdrop-logo', teamName(teamId))}</div>
            ${portraitImg(playerImageCandidates(teamId, name), 'bp-player-img', name, name.slice(0, 3).toUpperCase())}
          </div>
          <div class="bp-player-meta">
            <div class="bp-player-name">${escapeHtml(name)}</div>
            ${player.active === false ? '<div class="bp-player-sub">Inactive</div>' : ''}
          </div>
        </article>`;
      }).join('')
    : '<div class="empty">No roster entries matched the current team filter.</div>';

  const tabsMarkup = TEAM_PAGE_TABS.map(tab => `<button class="bp-mode-tab ${tab.id === activeTab ? 'on' : ''}" type="button" data-team-tab="${tab.id}">${tab.label}</button>`).join('');

  $('#teams').innerHTML = `
    ${sectionHeader('Teams', 'Local-style team hub powered by roster JSON and match-averaged ISR cards.')}
    ${selectorMarkup}
    <section class="bp-team-hero" style="--thc:${teamColor(teamId)}">
      <div class="bp-hero-inner">
        ${img(teamLogoCandidates(teamId), 'bp-team-logo', teamName(teamId))}
        <div class="bp-hero-copy-wrap">
          <div class="bp-hero-topline">
            <div class="bp-hero-info">
              <div class="bp-hero-name" style="color:${teamColor(teamId)}">${teamName(teamId)}</div>
              <div class="bp-hero-abbr">${teamAbbr(teamId)} - Season ${new Date().getFullYear()}</div>
            </div>
            <div class="bp-hero-stats">
              <div class="bp-stat-chip"><div class="bsc-v">${fmtNum(record.wins)}-${fmtNum(record.losses)}</div><div class="bsc-l">Series</div></div>
              <div class="bp-stat-chip"><div class="bsc-v">${fmtNum(record.mapWins)}-${fmtNum(record.mapLosses)}</div><div class="bsc-l">Maps</div></div>
              <div class="bp-stat-chip"><div class="bsc-v">${standingPos ? `#${standingPos}` : '-'}</div><div class="bsc-l">Rank</div></div>
              <div class="bp-stat-chip"><div class="bsc-v">${fmtNum(standingRow?.pts || state.data.teamPoints?.[teamId] || 0)}</div><div class="bsc-l">CDL Pts</div></div>
            </div>
          </div>
          <div class="bp-hero-meta">
            <span class="team-table-pill">Active ${fmtNum(activeCount)}</span>
            <span class="team-table-pill">Roster ISR ${fmtNum(avgOvr, 1)}</span>
            ${topCard ? `<span class="team-table-pill">Top ISR ${escapeHtml(topCard.displayName)} ${fmtNum(topCard.overallOVR, 1)}</span>` : ''}
            <span class="team-table-pill">${hasStats ? 'JSON team stats loaded' : 'No parsed team JSON'}</span>
            ${teamStats.confidence ? `<span class="team-table-pill">Confidence ${escapeHtml(teamStats.confidence)}</span>` : ''}
            ${parsedDate ? `<span class="team-table-pill">Updated ${escapeHtml(parsedDate)}</span>` : ''}
          </div>
        </div>
        <div class="team-roster-tools">
          <button id="teamToggleInactive" class="match-toggle-btn match-toggle-btn-secondary" type="button">${state.ui.teamShowInactive ? 'Hide Inactive' : 'Show Inactive'}</button>
        </div>
        <div class="bp-roster-strip">${rosterMarkup}</div>
      </div>
    </section>
    <div class="bp-mode-bar">${tabsMarkup}</div>
    ${buildTeamStatsPanel(teamId, teamStats, activeTab)}
  `;

  $('#teamSelect')?.addEventListener('change', event => {
    setUI('selectedTeam', event.target.value);
    setUI('teamStatsTab', 'overall');
    renderTeams();
    renderBetting();
    renderMatchup();
  });
  document.querySelectorAll('[data-team-chip]').forEach(button => button.addEventListener('click', () => {
    setUI('selectedTeam', button.dataset.teamChip);
    setUI('teamStatsTab', 'overall');
    renderTeams();
    renderBetting();
    renderMatchup();
  }));
  document.querySelectorAll('[data-team-tab]').forEach(button => button.addEventListener('click', () => {
    setUI('teamStatsTab', button.dataset.teamTab);
    renderTeams();
  }));
  $('#teamToggleInactive')?.addEventListener('click', () => {
    setUI('teamShowInactive', !state.ui.teamShowInactive);
    renderTeams();
  });
}

function renderBetting(){
  const { teamId, playerId, roster, opponentId, opponentOptions, eventId, eventOptions, modeId, market, line, mapName, mapOptions, mapStat } = ensureBettingSelections();
  const player = getBettingPlayer(playerId);
  const profile = getBettingProfile(playerId);
  const lineValue = parseBettingLine();
  const samples = buildBettingSamples({ teamId, playerId, opponentId, eventId, modeId: 'all', marketId: market.id, lineValue });
  const values = samples.map(sample => sample.value);
  const seasonAverage = average(values);
  const recentAverage = average(values.slice(0, 5));
  const medianValue = median(values);
  const bestValue = values.length ? Math.max(...values) : null;
  const projection = buildBettingProjection(samples, market.id);
  const hits = samples.filter(sample => sample.hit === true).length;
  const hitRate = lineValue !== null && samples.length ? (hits / samples.length) * 100 : null;
  const edge = lineValue !== null && projection !== null ? projection - lineValue : null;
  const mapLogs = buildBettingMapLogs({ teamId, playerId, opponentId, eventId, modeId, mapName, statId: mapStat, lineValue });
  const mapValues = mapLogs.map(entry => entry.value);
  const mapAverage = average(mapValues);
  const mapMedian = median(mapValues);
  const mapBest = mapValues.length ? Math.max(...mapValues) : null;
  const mapHits = mapLogs.filter(entry => entry.hit === true).length;
  const mapHitRate = lineValue !== null && mapLogs.length ? (mapHits / mapLogs.length) * 100 : null;
  const mapStatMeta = getBettingMapStat(mapStat);
  const playerName = player?.displayName || player?.name || profile?.displayName || 'Select a player';
  const selectedRosterEntry = roster.find(entry => entry.playerId === playerId) || player || null;
  const selectedSplitLabel = eventId === 'all' ? 'Full Season' : formatBettingEvent(eventId);
  const modeFilterLabel = modeId === 'all' ? 'All Modes' : modeLabel(modeId);
  const mapFilterLabel = mapName === 'all' ? 'All Maps' : mapName;
  const filterSummary = [
    opponentId === 'all' ? 'All Opponents' : `Vs ${teamName(opponentId)}`,
    selectedSplitLabel
  ].join(' | ');

  const summaryMarkup = [
    { label: 'Samples', value: fmtNum(samples.length) },
    { label: 'Average', value: seasonAverage === null ? '-' : formatPropValue(seasonAverage, market.id, 'display') },
    { label: 'Median', value: medianValue === null ? '-' : formatPropValue(medianValue, market.id, 'display') },
    { label: 'Best', value: bestValue === null ? '-' : formatPropValue(bestValue, market.id, 'display') },
    { label: 'Line Hit Rate', value: hitRate === null ? '-' : `${hits}/${samples.length}` }
  ].map(item => `<div class="bet-kpi"><div class="v ${item.tone || ''}">${item.value}</div><div class="l">${item.label}</div></div>`).join('');

  const insightMarkup = [
    { label: 'Projection', value: projection === null ? '-' : formatPropValue(projection, market.id, 'display') },
    { label: 'Recent 5 Avg', value: recentAverage === null ? '-' : formatPropValue(recentAverage, market.id, 'display') },
    { label: 'Edge', value: edge === null ? '-' : `${edge >= 0 ? '+' : ''}${formatPropValue(edge, market.id, 'display')}`, tone: edge === null ? '' : edge >= 0 ? 'value-pos' : 'value-neg' },
    { label: 'Over Rate', value: hitRate === null ? '-' : `${fmtNum(hitRate, 0)}%` }
  ].map(item => `<div class="bet-insight"><div class="bet-insight-label">${item.label}</div><div class="bet-insight-value ${item.tone || ''}">${item.value}</div></div>`).join('');

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

  const mapSummaryMarkup = [
    { label: 'Map Samples', value: fmtNum(mapLogs.length) },
    { label: 'Average', value: mapAverage === null ? '-' : formatMapStatValue(mapAverage, mapStat) },
    { label: 'Median', value: mapMedian === null ? '-' : formatMapStatValue(mapMedian, mapStat) },
    { label: 'Best', value: mapBest === null ? '-' : formatMapStatValue(mapBest, mapStat) },
    { label: 'Line Hit Rate', value: mapHitRate === null ? '-' : `${mapHits}/${mapLogs.length}` }
  ].map(item => `<div class="bet-kpi"><div class="v">${item.value}</div><div class="l">${item.label}</div></div>`).join('');

  const mapLastFiveMarkup = mapLogs.length
    ? `<div class="bet-games">${mapLogs.slice(0, 5).map(entry => {
        const badge = entry.hit === null
          ? '<div class="res">-</div>'
          : `<div class="res ${entry.hit ? 'hit' : 'miss'}">${entry.hit ? 'HIT' : 'MISS'}</div>`;
        return `<div class="bet-game ${entry.hit === true ? 'hit' : entry.hit === false ? 'miss' : ''}">
          <div class="top">
            <div class="bet-mini">${entry.displayDate}</div>
            ${badge}
          </div>
          <div class="val">${formatMapStatValue(entry.value, mapStat)}</div>
          <div class="meta">
            <div>${escapeHtml(entry.eventLabel)} | vs ${escapeHtml(entry.opponentName)}</div>
            <div>Map ${fmtNum(entry.map.mapNum)} | ${modeLabel(entry.map.mode)} | ${escapeHtml(entry.map.mapName)}</div>
            <div>${fmtNum(entry.map.score1)} - ${fmtNum(entry.map.score2)} | ${teamName(entry.map.winner)}</div>
          </div>
        </div>`;
      }).join('')}</div>`
    : '<div class="empty">No map logs matched the current mode and map filters yet.</div>';

  const logMarkup = mapLogs.length
    ? mapLogs.map(entry => {
        const lineResult = lineValue === null
          ? '<span class="muted">-</span>'
          : `<span class="${entry.hit ? 'value-pos' : 'value-neg'}">${entry.hit ? 'Over' : 'Under'} ${formatMapLineValue(lineValue, mapStat)}</span>`;
        return `<tr>
          ${tableCell('Date', entry.displayDate)}
          ${tableCell('Event', escapeHtml(entry.eventLabel))}
          ${tableCell('Opponent', escapeHtml(entry.opponentName))}
          ${tableCell('Map #', `M${fmtNum(entry.map.mapNum)}`)}
          ${tableCell('Mode', modePill(entry.map.mode))}
          ${tableCell('Map', `<strong>${escapeHtml(entry.map.mapName)}</strong>`)}
          ${tableCell(mapStatMeta.label, `<strong>${formatMapStatValue(entry.value, mapStat)}</strong>`)}
          ${tableCell('K / D / A', `${fmtNum(entry.row?.kills)} / ${fmtNum(entry.row?.deaths)} / ${fmtNum(entry.row?.assists)}`)}
          ${tableCell('Damage', fmtNum(entry.row?.damage))}
          ${tableCell('Line Result', lineResult)}
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" class="empty">No matching map logs yet.</td></tr>';

  $('#betting').innerHTML = `
    ${sectionHeader('Betting Lab', 'PrizePicks-style player prop tracker built from your exported public data package.')}
    <div class="info-box"><strong>Player prop line engine:</strong> enter a line, compare it to real series history, then use the map and mode lab below to tighten the read before lock.</div>
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
          <div class="card-title">PrizePicks Market Tracker</div>
          <div class="bet-subtle">Quick read on the selected player prop market, recent form, and the entered line.</div>
        </div>
        <div class="bet-subtle">${lineValue === null ? 'Recent samples use the latest 5 matching series performances.' : `Line ${formatPropValue(lineValue, market.id, 'display')} | ${edge === null ? 'No lean yet' : edge >= 0 ? 'Lean over' : 'Lean under'}`}</div>
      </div>
      <div class="bet-market-row">
        ${BETTING_MARKETS.map(entry => `<button class="bet-chip ${entry.id === market.id ? 'on' : ''}" type="button" data-prop-market="${entry.id}">${entry.shortLabel}</button>`).join('')}
      </div>
      <div class="bet-kpis">${summaryMarkup}</div>
      <div class="bet-insight-row">${insightMarkup}</div>
      <div class="bet-filter-line">
        <span class="bet-mini-pill">${escapeHtml(filterSummary)}</span>
        <span class="bet-mini-pill">${market.label}</span>
        ${lineValue !== null ? `<span class="bet-mini-pill">Line ${formatPropValue(lineValue, market.id, 'display')}</span>` : ''}
      </div>
      ${lastFiveMarkup}
      <div class="bet-table-note">${lineValue === null ? 'Projection blends the full-sample average, median, and recent form. Add a line to grade overs against the prop number.' : `Hit rate uses over logic against ${formatPropValue(lineValue, market.id, 'display')}. Projection blends the full-sample average, median, and last 5 for a quick lean.`}</div>
    </div>

    <div class="bet-panel">
      <div class="bet-flex">
        <div>
          <div class="card-title">Map + Mode Lab</div>
          <div class="bet-subtle">Drill all the way into individual map logs for the selected player and line.</div>
        </div>
        <div class="bet-subtle">${modeFilterLabel} | ${mapFilterLabel} | ${mapStatMeta.label}</div>
      </div>
      <div class="bet-form-grid bet-form-grid-secondary">
        <div class="fg">
          <label for="bettingModeSelect">Mode</label>
          <select id="bettingModeSelect">${BETTING_MODE_OPTIONS.map(option => `<option value="${option.id}" ${option.id === modeId ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div class="fg">
          <label for="bettingMapSelect">Map</label>
          <select id="bettingMapSelect">${mapOptions.map(option => `<option value="${option.id}" ${option.id === mapName ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div class="fg">
          <label for="bettingMapStatSelect">Stat</label>
          <select id="bettingMapStatSelect">${BETTING_MAP_STATS.map(option => `<option value="${option.id}" ${option.id === mapStat ? 'selected' : ''}>${option.label}</option>`).join('')}</select>
        </div>
        <div class="fg bet-reset-wrap">
          <button id="bettingMapReset" class="match-toggle-btn match-toggle-btn-secondary" type="button">Reset Filters</button>
        </div>
      </div>
      <div class="bet-kpis">${mapSummaryMarkup}</div>
      ${mapLastFiveMarkup}
      <div class="bet-table-note">${lineValue === null ? 'Enter a line above to grade each map sample against the number.' : `Map samples are being graded against ${formatMapLineValue(lineValue, mapStat)} on an over basis.`}</div>
      <div class="table-wrap stack-on-mobile">
        <table class="responsive-table table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Opponent</th>
              <th>Map #</th>
              <th>Mode</th>
              <th>Map</th>
              <th>${mapStatMeta.label}</th>
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
    setUI('bettingMapName', 'all');
    if(state.ui.bettingOpponent === event.target.value){
      setUI('bettingOpponent', 'all');
    }
    renderBetting();
  });
  $('#bettingPlayerSelect')?.addEventListener('change', event => {
    setUI('bettingPlayerId', event.target.value);
    setUI('bettingMapName', 'all');
    renderBetting();
  });
  $('#bettingOpponentSelect')?.addEventListener('change', event => {
    setUI('bettingOpponent', event.target.value);
    setUI('bettingMapName', 'all');
    renderBetting();
  });
  $('#bettingEventSelect')?.addEventListener('change', event => {
    setUI('bettingEvent', event.target.value);
    setUI('bettingMapName', 'all');
    renderBetting();
  });
  $('#bettingModeSelect')?.addEventListener('change', event => {
    setUI('bettingMode', event.target.value);
    setUI('bettingMapName', 'all');
    renderBetting();
  });
  $('#bettingMapSelect')?.addEventListener('change', event => {
    setUI('bettingMapName', event.target.value);
    renderBetting();
  });
  $('#bettingMapStatSelect')?.addEventListener('change', event => {
    setUI('bettingMapStat', event.target.value);
    renderBetting();
  });
  $('#bettingMapReset')?.addEventListener('click', () => {
    setUI('bettingMode', 'all');
    setUI('bettingMapName', 'all');
    setUI('bettingMapStat', 'kills');
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

function matchupFormatLabel(format){
  return format === 'BO7' ? 'Best of 7' : 'Best of 5';
}

function matchupPct(value, digits = 1){
  return fmtPct((num(value) ?? 0) * 100, digits);
}

function matchupRecordText(record){
  return `${fmtNum(record?.wins || 0)}-${fmtNum(record?.losses || 0)}`;
}

function matchupMapDiff(record){
  return (num(record?.mapWins) ?? 0) - (num(record?.mapLosses) ?? 0);
}

function matchupModeRecord(teamId, mode){
  const relevant = (state.data.maps || []).filter(map => {
    if(String(map.mode || '').toUpperCase() !== mode) return false;
    const match = state.data.matchesById?.[map.matchId];
    return Boolean(match) && (match.team1Id === teamId || match.team2Id === teamId);
  });
  const wins = relevant.filter(map => map.winner === teamId).length;
  const losses = relevant.filter(map => map.winner && map.winner !== teamId).length;
  return {
    wins,
    losses,
    pct: wins + losses ? wins / (wins + losses) : 0.5
  };
}

function matchupPill(label, value){
  return `<span class="team-table-pill">${escapeHtml(label)} ${value}</span>`;
}

function matchupMetricBar(leftValue, rightValue, label, leftText, rightText, teamA, teamB){
  const safeLeft = Math.max(0, num(leftValue) ?? 0);
  const safeRight = Math.max(0, num(rightValue) ?? 0);
  const total = safeLeft + safeRight || 1;
  const leftPct = (safeLeft / total) * 100;
  const rightPct = (safeRight / total) * 100;
  return `<div class="matchup-compare-row">
    <div class="matchup-compare-head">
      <strong style="color:${teamColor(teamA)}">${leftText}</strong>
      <span>${escapeHtml(label)}</span>
      <strong style="color:${teamColor(teamB)}">${rightText}</strong>
    </div>
    <div class="h2h-bar matchup-compare-bar">
      <span style="width:${leftPct}%;background:${teamColor(teamA)}"></span>
      <span style="width:${rightPct}%;background:${teamColor(teamB)}"></span>
    </div>
  </div>`;
}

function matchupRosterStrip(teamId, roster = []){
  if(!roster.length){
    return '<div class="empty">No active roster portraits are available for this team yet.</div>';
  }
  return `<div class="matchup-roster-strip">
    ${roster.map(player => {
      const name = player.displayName || player.name || player.playerId;
      return `<article class="matchup-roster-card">
        <div class="bp-player-art matchup-roster-art" style="--thc:${teamColor(teamId)}">
          <div class="bp-player-backdrop">${img(teamLogoCandidates(teamId), 'bp-player-backdrop-logo', teamName(teamId))}</div>
          ${portraitImg(playerImageCandidates(teamId, name), 'bp-player-img matchup-roster-img', name, name.slice(0, 3).toUpperCase())}
        </div>
        <div class="matchup-roster-meta">
          <div class="matchup-roster-name">${escapeHtml(name)}</div>
          <div class="matchup-roster-sub">${fmtNum(player.overallOVR ?? player.overallISR, 1)} rating</div>
        </div>
      </article>`;
    }).join('')}
  </div>`;
}

function matchupTeamHeroCard(teamId, hero, selectId, selectedFormat){
  const record = hero.record || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
  return `<article class="card matchup-team-hero" style="--thc:${teamColor(teamId)}">
    <div class="matchup-team-select">
      <label for="${selectId}">${selectId === 'matchupTeamA' ? 'Team 1' : 'Team 2'}</label>
      <select id="${selectId}">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamId ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
    </div>
    <div class="matchup-team-identity">
      ${img(teamLogoCandidates(teamId), 'matchup-team-logo', teamName(teamId))}
      <div class="matchup-team-copy">
        <div class="matchup-team-name" style="color:${teamColor(teamId)}">${teamName(teamId)}</div>
        <div class="matchup-team-sub">${matchupFormatLabel(selectedFormat)} lens | ${matchupRecordText(record)} series</div>
      </div>
    </div>
    <div class="matchup-team-pills">
      ${matchupPill('Map Diff', fmtNum(matchupMapDiff(record), 0))}
      ${matchupPill('Roster Rating', fmtNum(hero.avgRosterRating, 1))}
      ${hero.topPlayer ? matchupPill('Top Player', `${escapeHtml(hero.topPlayer.displayName)} ${fmtNum(hero.topPlayer.projectedIsr || hero.topPlayer.overallOVR || hero.topPlayer.overallISR, 1)}`) : ''}
    </div>
    <div class="matchup-team-recent">
      <span class="small muted">Recent form</span>
      ${recentPills(record.recent || [])}
    </div>
    ${matchupRosterStrip(teamId, hero.roster)}
  </article>`;
}

function matchupLeaderRow(label, player, metric, digits = 1, kind = 'rating'){
  if(!player){
    return `<div class="matchup-leader-row"><span>${escapeHtml(label)}</span><strong>-</strong></div>`;
  }
  const valueMarkup = kind === 'rating'
    ? playerRatingValue(player[metric], digits)
    : `<strong>${fmtNum(player[metric], digits)}</strong>`;
  return `<div class="matchup-leader-row">
    <span>${escapeHtml(label)}</span>
    <div class="matchup-leader-value">
      <strong>${escapeHtml(player.displayName)}</strong>
      ${valueMarkup}
    </div>
  </div>`;
}

function matchupBulletList(items = [], fallback = 'Model notes are still being tuned for this matchup.'){
  if(!items.length){
    return `<div class="small muted">${escapeHtml(fallback)}</div>`;
  }
  return `<ul class="matchup-bullet-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderMatchup(){
  const teamA = TEAM_IDS.includes(state.ui.matchupTeamA) ? state.ui.matchupTeamA : 'optic';
  const teamB = TEAM_IDS.includes(state.ui.matchupTeamB) ? state.ui.matchupTeamB : 'faze';
  const format = ['BO5', 'BO7'].includes(state.ui.matchupFormat) ? state.ui.matchupFormat : 'BO5';
  const model = buildMatchupModel(state.data, teamA, teamB, format);

  if(!model){
    $('#matchup').innerHTML = `
      ${sectionHeader('Matchup Builder', 'Monte Carlo team odds, player edges, and map-pool context.')}
      <div class="card matchup-empty-card">
        <div class="controls matchup-empty-controls">
          <div class="fg">
            <label for="matchupTeamA">Team 1</label>
            <select id="matchupTeamA">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamA ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
          </div>
          <div class="fg">
            <label for="matchupTeamB">Team 2</label>
            <select id="matchupTeamB">${TEAM_IDS.map(id => `<option value="${id}" ${id === teamB ? 'selected' : ''}>${teamName(id)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="empty">Pick two different teams to build the matchup simulation.</div>
      </div>
    `;
    $('#matchupTeamA')?.addEventListener('change', event => {
      setUI('matchupTeamA', event.target.value);
      renderMatchup();
    });
    $('#matchupTeamB')?.addEventListener('change', event => {
      setUI('matchupTeamB', event.target.value);
      renderMatchup();
    });
    return;
  }

  const favoriteId = model.summary.favoriteId;
  const underdogId = model.summary.underdogId;
  const favoritePct = favoriteId === teamA ? model.simulation.winPctA : model.simulation.winPctB;
  const modeRecordA = {
    HP: matchupModeRecord(teamA, 'HP'),
    SND: matchupModeRecord(teamA, 'SND'),
    OL: matchupModeRecord(teamA, 'OL')
  };
  const modeRecordB = {
    HP: matchupModeRecord(teamB, 'HP'),
    SND: matchupModeRecord(teamB, 'SND'),
    OL: matchupModeRecord(teamB, 'OL')
  };
  const mapWinPctA = (() => {
    const record = model.hero.teamA.record;
    return (record.mapWins + record.mapLosses) ? record.mapWins / (record.mapWins + record.mapLosses) : 0.5;
  })();
  const mapWinPctB = (() => {
    const record = model.hero.teamB.record;
    return (record.mapWins + record.mapLosses) ? record.mapWins / (record.mapWins + record.mapLosses) : 0.5;
  })();

  $('#matchup').innerHTML = `
    ${sectionHeader('Matchup Builder', 'Monte Carlo team odds first, then player edges, map pool context, and upset paths.')}
    <section class="card matchup-hero-shell">
      <div class="matchup-controls-row">
        <div class="matchup-controls-note">Deterministic ${fmtNum(model.simulation.runs)}-run sim using roster ratings, mode strength, map history, and recent form.</div>
        <div class="matchup-format-switch" role="tablist" aria-label="Series format">
          ${['BO5', 'BO7'].map(value => `<button class="matchup-format-btn ${value === format ? 'on' : ''}" type="button" data-matchup-format="${value}">${value}</button>`).join('')}
        </div>
      </div>
      <div class="matchup-hero-grid">
        ${matchupTeamHeroCard(teamA, model.hero.teamA, 'matchupTeamA', format)}
        <div class="matchup-vs-card card">
          <div class="matchup-vs-mark">VS</div>
          <div class="matchup-vs-sub">${matchupFormatLabel(format)}</div>
          <div class="matchup-vs-favorite">${teamName(favoriteId)} edge</div>
          <div class="matchup-vs-confidence matchup-confidence-${model.summary.confidence.tone}">${model.summary.confidence.label}</div>
        </div>
        ${matchupTeamHeroCard(teamB, model.hero.teamB, 'matchupTeamB', format)}
      </div>
    </section>

    <div class="matchup-feature-grid">
      <article class="card matchup-sim-card" style="--favorite:${teamColor(favoriteId)}">
        <div class="card-title"><span>Monte Carlo Outlook</span><span class="team-data-subtle">${fmtNum(model.simulation.runs)} deterministic runs</span></div>
        <div class="matchup-odds-board">
          <div class="matchup-odds-side">
            <div class="matchup-odds-team">${teamName(teamA)}</div>
            <div class="matchup-odds-value" style="color:${teamColor(teamA)}">${matchupPct(model.simulation.winPctA)}</div>
          </div>
          <div class="matchup-odds-center">
            <div class="matchup-odds-label">Series Win Odds</div>
            <div class="matchup-confidence-track"><span style="width:${favoritePct * 100}%;background:${teamColor(favoriteId)}"></span></div>
            <div class="matchup-odds-favorite">${teamName(favoriteId)} favored | ${model.summary.confidence.label}</div>
          </div>
          <div class="matchup-odds-side right">
            <div class="matchup-odds-team">${teamName(teamB)}</div>
            <div class="matchup-odds-value" style="color:${teamColor(teamB)}">${matchupPct(model.simulation.winPctB)}</div>
          </div>
        </div>
        <div class="matchup-scoreline-grid">
          ${model.simulation.scorelines.map(scoreline => `<div class="matchup-scoreline-chip ${scoreline.winnerId === teamA ? 'left' : 'right'}">
            <span class="matchup-scoreline-label">${scoreline.label}</span>
            <strong>${matchupPct(scoreline.pct)}</strong>
          </div>`).join('')}
        </div>
        <div class="matchup-driver-head">Why the model leans this way</div>
        ${matchupBulletList(model.summary.drivers.map(driver => `${driver.label}: ${driver.detail}`), 'More matchup signal appears once these teams add more shared maps to the public dataset.')}
      </article>

      <article class="card matchup-ladder-card">
        <div class="card-title"><span>Predicted Map Ladder</span><span class="team-data-subtle">Most likely path, not official veto ownership</span></div>
        <div class="matchup-ladder">
          ${model.simulation.path.map(slot => `<div class="matchup-ladder-row">
            <div class="matchup-ladder-slot">Map ${slot.slot}</div>
            <div class="matchup-ladder-mode">${modePill(slot.mode)}</div>
            <div class="matchup-ladder-map">
              <strong>${escapeHtml(slot.mapName)}</strong>
              <span>${matchupPct(slot.appearancePct)} seen in this slot | ${matchupPct(slot.playPct)} played at all</span>
            </div>
            <div class="matchup-ladder-proj">
              <span style="color:${teamColor(slot.projectedWinnerId)}">${teamName(slot.projectedWinnerId)}</span>
              <strong>${matchupPct(slot.probability)}</strong>
            </div>
          </div>`).join('')}
        </div>
      </article>
    </div>

    <div class="matchup-secondary-grid">
      <article class="card">
        <div class="card-title"><span>Season Edge Comparison</span><span class="team-data-subtle">Cleaner team-level context for the sim</span></div>
        ${matchupMetricBar(
          ((model.hero.teamA.record.wins + model.hero.teamA.record.losses) ? model.hero.teamA.record.wins / (model.hero.teamA.record.wins + model.hero.teamA.record.losses) : 0.5) * 100,
          ((model.hero.teamB.record.wins + model.hero.teamB.record.losses) ? model.hero.teamB.record.wins / (model.hero.teamB.record.wins + model.hero.teamB.record.losses) : 0.5) * 100,
          'Series Win %',
          matchupPct((model.hero.teamA.record.wins + model.hero.teamA.record.losses) ? model.hero.teamA.record.wins / (model.hero.teamA.record.wins + model.hero.teamA.record.losses) : 0.5),
          matchupPct((model.hero.teamB.record.wins + model.hero.teamB.record.losses) ? model.hero.teamB.record.wins / (model.hero.teamB.record.wins + model.hero.teamB.record.losses) : 0.5),
          teamA,
          teamB
        )}
        ${matchupMetricBar(mapWinPctA * 100, mapWinPctB * 100, 'Map Win %', matchupPct(mapWinPctA), matchupPct(mapWinPctB), teamA, teamB)}
        ${matchupMetricBar(modeRecordA.HP.pct * 100, modeRecordB.HP.pct * 100, 'Hardpoint Win %', matchupPct(modeRecordA.HP.pct), matchupPct(modeRecordB.HP.pct), teamA, teamB)}
        ${matchupMetricBar(modeRecordA.SND.pct * 100, modeRecordB.SND.pct * 100, 'S&D Win %', matchupPct(modeRecordA.SND.pct), matchupPct(modeRecordB.SND.pct), teamA, teamB)}
        ${matchupMetricBar(modeRecordA.OL.pct * 100, modeRecordB.OL.pct * 100, 'Overload Win %', matchupPct(modeRecordA.OL.pct), matchupPct(modeRecordB.OL.pct), teamA, teamB)}
        ${matchupMetricBar(model.hero.teamA.avgRosterRating, model.hero.teamB.avgRosterRating, 'Roster Rating', fmtNum(model.hero.teamA.avgRosterRating, 1), fmtNum(model.hero.teamB.avgRosterRating, 1), teamA, teamB)}
        ${matchupMetricBar(model.hero.teamA.avgSlayer, model.hero.teamB.avgSlayer, 'Slayer Avg', fmtNum(model.hero.teamA.avgSlayer, 1), fmtNum(model.hero.teamB.avgSlayer, 1), teamA, teamB)}
      </article>

      <article class="card">
        <div class="card-title"><span>Head-to-Head Timeline</span><span class="team-data-subtle">${model.headToHead.matches.length ? 'Current exported dataset only' : 'No shared matches yet'}</span></div>
        ${model.headToHead.matches.length ? `
          <div class="matchup-score">
            <div><div class="matchup-score-value" style="color:${teamColor(teamA)}">${model.headToHead.seriesA}</div><div class="small">Series W</div></div>
            <div class="matchup-score-dash">-</div>
            <div><div class="matchup-score-value" style="color:${teamColor(teamB)}">${model.headToHead.seriesB}</div><div class="small">Series W</div></div>
          </div>
          <div class="matchup-mapline">Maps: <span style="color:${teamColor(teamA)}">${model.headToHead.mapsA}</span> - <span style="color:${teamColor(teamB)}">${model.headToHead.mapsB}</span></div>
          <div class="matchup-timeline">
            ${model.headToHead.matches.slice(0, 6).map(match => {
              const { s1, s2 } = getSeriesScore(match);
              const leftScore = match.team1Id === teamA ? s1 : s2;
              const rightScore = match.team1Id === teamA ? s2 : s1;
              const winner = leftScore > rightScore ? teamA : rightScore > leftScore ? teamB : null;
              return `<div class="result-item matchup-timeline-item">
                <div class="result-main">
                  <div class="result-line">
                    <strong>${escapeHtml(formatBettingEvent(match.eventId || ''))}</strong>
                    <span class="${winner === teamA ? 'value-pos' : winner === teamB ? 'value-neg' : 'muted'}">${fmtNum(leftScore)}-${fmtNum(rightScore)}</span>
                  </div>
                  <div class="small muted">${fmtDate(match.date)}${match.time ? ` | ${escapeHtml(match.time)}` : ''}</div>
                </div>
                <div class="leader-metrics">
                  <strong>${winner ? teamName(winner) : 'Split'}</strong>
                </div>
              </div>`;
            }).join('')}
          </div>` : '<div class="empty">These teams have not played each other in the current public dataset yet, so the sim leans more on season and map-pool context.</div>'}
      </article>
    </div>

    <div class="matchup-player-grid">
      <article class="card matchup-duel-card">
        <div class="card-title"><span>Star Duel</span><span class="team-data-subtle">Projected impact players inside the selected format</span></div>
        <div class="matchup-duel-grid">
          ${model.playerEdges.starDuel.teamA ? `<div class="matchup-duel-side">
            <div class="bp-player-art matchup-duel-art" style="--thc:${teamColor(teamA)}">
              <div class="bp-player-backdrop">${img(teamLogoCandidates(teamA), 'bp-player-backdrop-logo', teamName(teamA))}</div>
              ${portraitImg(playerImageCandidates(teamA, model.playerEdges.starDuel.teamA.displayName), 'bp-player-img matchup-duel-img', model.playerEdges.starDuel.teamA.displayName, model.playerEdges.starDuel.teamA.displayName.slice(0, 3).toUpperCase())}
            </div>
            <div class="matchup-duel-copy">
              <div class="matchup-duel-name">${escapeHtml(model.playerEdges.starDuel.teamA.displayName)}</div>
              <div class="matchup-duel-team" style="color:${teamColor(teamA)}">${teamName(teamA)}</div>
              <div class="matchup-duel-metrics">
                <span>${playerRatingValue(model.playerEdges.starDuel.teamA.projectedIsr, 1)}</span>
                <span>${playerRatingValue(model.playerEdges.starDuel.teamA.slayerRating, 1)}</span>
              </div>
            </div>
          </div>` : '<div class="empty">No player edge available.</div>'}
          <div class="matchup-duel-vs">VS</div>
          ${model.playerEdges.starDuel.teamB ? `<div class="matchup-duel-side">
            <div class="bp-player-art matchup-duel-art" style="--thc:${teamColor(teamB)}">
              <div class="bp-player-backdrop">${img(teamLogoCandidates(teamB), 'bp-player-backdrop-logo', teamName(teamB))}</div>
              ${portraitImg(playerImageCandidates(teamB, model.playerEdges.starDuel.teamB.displayName), 'bp-player-img matchup-duel-img', model.playerEdges.starDuel.teamB.displayName, model.playerEdges.starDuel.teamB.displayName.slice(0, 3).toUpperCase())}
            </div>
            <div class="matchup-duel-copy">
              <div class="matchup-duel-name">${escapeHtml(model.playerEdges.starDuel.teamB.displayName)}</div>
              <div class="matchup-duel-team" style="color:${teamColor(teamB)}">${teamName(teamB)}</div>
              <div class="matchup-duel-metrics">
                <span>${playerRatingValue(model.playerEdges.starDuel.teamB.projectedIsr, 1)}</span>
                <span>${playerRatingValue(model.playerEdges.starDuel.teamB.slayerRating, 1)}</span>
              </div>
            </div>
          </div>` : '<div class="empty">No player edge available.</div>'}
        </div>
      </article>

      <article class="card matchup-leaders-card">
        <div class="card-title"><span>Projected Team Leaders</span><span class="team-data-subtle">Highest ISR, slaying, S&D, and respawn edges</span></div>
        <div class="matchup-leaders-grid">
          <section class="matchup-leader-panel">
            <div class="matchup-leader-head" style="color:${teamColor(teamA)}">${teamName(teamA)}</div>
            ${matchupLeaderRow('Top ISR', model.playerEdges.teamA.topIsr, 'projectedIsr')}
            ${matchupLeaderRow('Top Slayer', model.playerEdges.teamA.topSlayer, 'slayerRating')}
            ${matchupLeaderRow('Best S&D Edge', model.playerEdges.teamA.bestSnd, 'sndEdge', 2, 'number')}
            ${matchupLeaderRow('Best Respawn Edge', model.playerEdges.teamA.bestRespawn, 'respawnEdge', 2, 'number')}
            ${matchupLeaderRow('Swing Player', model.playerEdges.teamA.swing, 'swingScore', 1, 'number')}
          </section>
          <section class="matchup-leader-panel">
            <div class="matchup-leader-head" style="color:${teamColor(teamB)}">${teamName(teamB)}</div>
            ${matchupLeaderRow('Top ISR', model.playerEdges.teamB.topIsr, 'projectedIsr')}
            ${matchupLeaderRow('Top Slayer', model.playerEdges.teamB.topSlayer, 'slayerRating')}
            ${matchupLeaderRow('Best S&D Edge', model.playerEdges.teamB.bestSnd, 'sndEdge', 2, 'number')}
            ${matchupLeaderRow('Best Respawn Edge', model.playerEdges.teamB.bestRespawn, 'respawnEdge', 2, 'number')}
            ${matchupLeaderRow('Swing Player', model.playerEdges.teamB.swing, 'swingScore', 1, 'number')}
          </section>
        </div>
      </article>
    </div>

    <article class="card matchup-player-board-card">
      <div class="card-title"><span>Key Player Matchups</span><span class="team-data-subtle">Projected side-by-side roster impact</span></div>
      <div class="matchup-player-board">
        ${model.playerEdges.comparisonRows.map(row => `<div class="matchup-player-row">
          <div class="matchup-player-side left">
            ${row.left ? `<div class="matchup-player-chip">
              ${img(playerImageCandidates(teamA, row.left.displayName), 'mini-avatar', row.left.displayName)}
              <div><strong>${escapeHtml(row.left.displayName)}</strong><span>${playerRatingValue(row.left.projectedIsr, 1)}</span></div>
            </div>` : '<span class="small muted">No row</span>'}
          </div>
          <div class="matchup-player-edge ${row.edgeTeamId === teamA ? 'left' : 'right'}">${fmtNum(row.edge, 1)} edge</div>
          <div class="matchup-player-side right">
            ${row.right ? `<div class="matchup-player-chip right">
              <div><strong>${escapeHtml(row.right.displayName)}</strong><span>${playerRatingValue(row.right.projectedIsr, 1)}</span></div>
              ${img(playerImageCandidates(teamB, row.right.displayName), 'mini-avatar', row.right.displayName)}
            </div>` : '<span class="small muted">No row</span>'}
          </div>
        </div>`).join('')}
      </div>
    </article>

    <div class="matchup-insight-grid">
      <article class="card matchup-insight-card">
        <div class="card-title"><span>${teamName(teamA)} Key To Win</span><span class="team-data-subtle">How this side closes the series</span></div>
        ${matchupBulletList(model.keys.teamA, `${teamName(teamA)} needs a balanced slaying night and at least one S&D win to keep the sim honest.`)}
      </article>
      <article class="card matchup-insight-card">
        <div class="card-title"><span>${teamName(underdogId)} Upset Path</span><span class="team-data-subtle">What has to break right for the dog</span></div>
        ${matchupBulletList(model.keys.underdog, `${teamName(underdogId)} likely needs to steal the swing S&D and outperform the current map path.`)}
      </article>
      <article class="card matchup-insight-card">
        <div class="card-title"><span>${teamName(teamB)} Key To Win</span><span class="team-data-subtle">How the other side flips the script</span></div>
        ${matchupBulletList(model.keys.teamB, `${teamName(teamB)} needs to cash in on its cleanest map edges and keep the star duel close.`)}
      </article>
    </div>

    <article class="card matchup-map-pool-card">
      <div class="card-title"><span>Map Pool Edge</span><span class="team-data-subtle">All available mode/map probabilities used by the sim</span></div>
      <div class="table-wrap stack-on-mobile">
        <table class="responsive-table table">
          <thead>
            <tr><th>Mode</th><th>Map</th><th>Likely</th><th>${teamAbbr(teamA)}</th><th>${teamAbbr(teamB)}</th><th>Model Edge</th></tr>
          </thead>
          <tbody>
            ${model.mapPool.rows.map(row => `<tr>
              ${tableCell('Mode', modePill(row.mode))}
              ${tableCell('Map', `<strong>${escapeHtml(row.mapName)}</strong>`)}
              ${tableCell('Likely', matchupPct(row.likelyPct))}
              ${tableCell(teamAbbr(teamA), `${matchupPct(row.teamAMapRate)} <span class="small muted">(${fmtNum(row.teamAMapPlays)} plays)</span>`)}
              ${tableCell(teamAbbr(teamB), `${matchupPct(row.teamBMapRate)} <span class="small muted">(${fmtNum(row.teamBMapPlays)} plays)</span>`)}
              ${tableCell('Model Edge', `<span style="color:${teamColor(row.edgeTeamId)}">${teamName(row.edgeTeamId)}</span> <strong>${matchupPct(row.edgePct)}</strong>`)}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </article>
  `;

  document.querySelectorAll('[data-matchup-format]').forEach(button => button.addEventListener('click', () => {
    setUI('matchupFormat', button.dataset.matchupFormat || 'BO5');
    renderMatchup();
  }));
  $('#matchupTeamA')?.addEventListener('change', event => {
    setUI('matchupTeamA', event.target.value);
    if(event.target.value === state.ui.matchupTeamB){
      const next = TEAM_IDS.find(id => id !== event.target.value) || event.target.value;
      setUI('matchupTeamB', next);
    }
    renderMatchup();
  });
  $('#matchupTeamB')?.addEventListener('change', event => {
    setUI('matchupTeamB', event.target.value);
    if(event.target.value === state.ui.matchupTeamA){
      const next = TEAM_IDS.find(id => id !== event.target.value) || event.target.value;
      setUI('matchupTeamA', next);
    }
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
  window.addEventListener('keydown', event => {
    if(event.key === 'Escape' && state.ui.playerModalId){
      setUI('playerModalId', null);
      renderPlayers();
    }
  });
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
