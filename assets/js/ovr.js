const MODES = ['HP', 'SND', 'OL'];
const SCORE_FLOOR = 50;
const SCORE_CEILING = 99;
const SCORE_MIDPOINT = (SCORE_FLOOR + SCORE_CEILING) / 2;
const MATCH_WIN_BONUS = 0.75;
const ASSIST_WEIGHT = 0.06;
const CARD_SPREAD_MULTIPLIER = 1.6;
const FULL_SAMPLE_MATCHES = 12;
const FORGIVENESS_OFFSET = 2.5;
const ELITE_ACCELERATION_START = 82;
const ELITE_ACCELERATION_FACTOR = 0.28;

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function average(values) {
  const filtered = values.map(num).filter(value => value !== null);
  return filtered.length
    ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length
    : null;
}

function roundScore(value) {
  const parsed = num(value);
  return parsed === null ? null : Math.round(parsed * 10) / 10;
}

function stretchScore(value) {
  const parsed = num(value);
  if (parsed === null) return null;
  return clamp(SCORE_MIDPOINT + (parsed - SCORE_MIDPOINT) * CARD_SPREAD_MULTIPLIER, SCORE_FLOOR, SCORE_CEILING);
}

function forgivingScore(value) {
  const parsed = num(value);
  if (parsed === null) return null;
  const eliteBonus = Math.max(0, parsed - ELITE_ACCELERATION_START) * ELITE_ACCELERATION_FACTOR;
  return clamp(parsed + FORGIVENESS_OFFSET + eliteBonus, SCORE_FLOOR, SCORE_CEILING);
}

function stabilizeScore(value, sampleSize, fullSample = FULL_SAMPLE_MATCHES) {
  const parsed = num(value);
  if (parsed === null) return null;
  const factor = clamp((num(sampleSize) ?? 0) / fullSample, 0, 1);
  return clamp(SCORE_MIDPOINT + (parsed - SCORE_MIDPOINT) * factor, SCORE_FLOOR, SCORE_CEILING);
}

function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function upperBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function percentileRank(values, target) {
  if (!values.length) return 0.5;
  if (values.length === 1) return 0.5;

  const firstIndex = lowerBound(values, target);
  const lastIndex = upperBound(values, target) - 1;
  const midRank = (firstIndex + Math.max(firstIndex, lastIndex)) / 2;
  return clamp(midRank / (values.length - 1), 0, 1);
}

function percentileScore(values, target) {
  return SCORE_FLOOR + (SCORE_CEILING - SCORE_FLOOR) * percentileRank(values, target);
}

function seriesScore(match, maps) {
  const score1 = num(match?.seriesScore1);
  const score2 = num(match?.seriesScore2);
  if (score1 !== null && score2 !== null) {
    return { score1, score2 };
  }
  return {
    score1: (maps || []).filter(map => map.winner === match?.team1Id).length,
    score2: (maps || []).filter(map => map.winner === match?.team2Id).length
  };
}

export function ovrTier(score) {
  const value = num(score);
  if (value === null) return { label: 'Unrated', colorClass: 'isr-tier-unavailable' };
  if (value >= 90) return { label: 'Elite', colorClass: 'isr-tier-elite' };
  if (value >= 85) return { label: 'Premier', colorClass: 'isr-tier-premier' };
  if (value >= 80) return { label: 'Strong', colorClass: 'isr-tier-strong' };
  if (value >= 75) return { label: 'Steady', colorClass: 'isr-tier-steady' };
  return { label: 'Developing', colorClass: 'isr-tier-developing' };
}

export function buildSeasonOvrModel(data = {}) {
  const playerMapRows = [];
  const rowsByMode = { HP: [], SND: [], OL: [] };
  const byMapPlayerKey = {};

  for (const map of data.maps || []) {
    const mode = String(map.mode || '').toUpperCase();
    if (!MODES.includes(mode)) continue;

    const rows = data.playerStatsByMap?.[map.id] || [];
    if (!rows.length) continue;

    const teamTotals = new Map();
    rows.forEach(row => {
      const totals = teamTotals.get(row.teamId) || { kills: 0, damage: 0, assists: 0 };
      totals.kills += Number(row.kills || 0);
      totals.damage += Number(row.damage || 0);
      totals.assists += Number(row.assists || 0);
      teamTotals.set(row.teamId, totals);
    });

    rows.forEach(row => {
      const totals = teamTotals.get(row.teamId) || { kills: 0, damage: 0, assists: 0 };
      const kills = Number(row.kills || 0);
      const deaths = Number(row.deaths || 0);
      const damage = Number(row.damage || 0);
      const assists = Number(row.assists || 0);
      const entry = {
        playerId: row.playerId,
        teamId: row.teamId,
        matchId: map.matchId,
        mapId: map.id,
        mode,
        mapWin: map.winner === row.teamId,
        kills,
        deaths,
        damage,
        assists,
        kd: kills / Math.max(1, deaths),
        killShare: totals.kills > 0 ? kills / totals.kills : 0,
        damageShare: totals.damage > 0 ? damage / totals.damage : 0,
        assistShare: totals.assists > 0 ? assists / totals.assists : 0
      };
      playerMapRows.push(entry);
      rowsByMode[mode].push(entry);
    });
  }

  MODES.forEach(mode => {
    const rows = rowsByMode[mode] || [];
    const kdValues = rows.map(row => row.kd).sort((left, right) => left - right);
    const killShareValues = rows.map(row => row.killShare).sort((left, right) => left - right);
    const damageShareValues = rows.map(row => row.damageShare).sort((left, right) => left - right);
    const assistShareValues = rows.map(row => row.assistShare).sort((left, right) => left - right);

    rows.forEach(row => {
      row.kdScore = percentileScore(kdValues, row.kd);
      row.killScore = percentileScore(killShareValues, row.killShare);
      row.damageScore = percentileScore(damageShareValues, row.damageShare);
      row.assistScore = percentileScore(assistShareValues, row.assistShare);

      const base = [row.kdScore, row.killScore, row.damageScore]
        .sort((left, right) => right - left)
        .slice(0, 2);
      const assistAdjustment = (row.assistScore - SCORE_MIDPOINT) * ASSIST_WEIGHT;
      row.mapRating = forgivingScore(stretchScore(clamp(average(base) + assistAdjustment, SCORE_FLOOR, SCORE_CEILING)));
      byMapPlayerKey[`${row.playerId}::${row.mapId}`] = {
        playerId: row.playerId,
        teamId: row.teamId,
        matchId: row.matchId,
        mapId: row.mapId,
        mode: row.mode,
        overall: roundScore(row.mapRating)
      };
    });
  });

  const perMatchByPlayer = new Map();
  const byMatchPlayerKey = {};
  playerMapRows.forEach(row => {
    const key = `${row.playerId}::${row.matchId}`;
    const entry = perMatchByPlayer.get(key) || {
      playerId: row.playerId,
      teamId: row.teamId,
      matchId: row.matchId,
      modes: { HP: [], SND: [], OL: [] },
      mapCount: 0
    };
    entry.modes[row.mode].push(row.mapRating);
    entry.mapCount += 1;
    perMatchByPlayer.set(key, entry);
  });

  const byPlayerId = {};
  for (const entry of perMatchByPlayer.values()) {
    const match = data.matchesById?.[entry.matchId];
    const maps = data.mapsByMatch?.[entry.matchId] || [];
    const hp = average(entry.modes.HP);
    const snd = average(entry.modes.SND);
    const ol = average(entry.modes.OL);
    const modeRatings = [hp, snd, ol].filter(value => value !== null);
    if (!modeRatings.length) continue;

    const { score1, score2 } = seriesScore(match, maps);
    let seriesWin = false;
    if (match) {
      const ownScore = match.team1Id === entry.teamId ? score1 : score2;
      const oppScore = match.team1Id === entry.teamId ? score2 : score1;
      seriesWin = ownScore > oppScore;
    }

    const matchOvr = forgivingScore(clamp(average(modeRatings) + (seriesWin ? MATCH_WIN_BONUS : 0), SCORE_FLOOR, SCORE_CEILING));
    const matchEntry = {
      matchId: entry.matchId,
      teamId: entry.teamId,
      overall: roundScore(matchOvr),
      hp: roundScore(hp),
      snd: roundScore(snd),
      ol: roundScore(ol),
      mapCount: entry.mapCount,
      seriesWin
    };
    byMatchPlayerKey[`${entry.playerId}::${entry.matchId}`] = {
      playerId: entry.playerId,
      ...matchEntry
    };
    const player = byPlayerId[entry.playerId] || {
      overall: null,
      hp: null,
      snd: null,
      ol: null,
      matchCount: 0,
      mapCount: 0,
      matches: []
    };

    player.matches.push(matchEntry);
    player.mapCount += entry.mapCount;
    byPlayerId[entry.playerId] = player;
  }

  Object.values(byPlayerId).forEach(player => {
    player.matchCount = player.matches.length;
    const hpMatches = player.matches.filter(match => match.hp !== null);
    const sndMatches = player.matches.filter(match => match.snd !== null);
    const olMatches = player.matches.filter(match => match.ol !== null);
    player.overall = roundScore(stabilizeScore(average(player.matches.map(match => match.overall)), player.matchCount));
    player.hp = roundScore(stabilizeScore(average(hpMatches.map(match => match.hp)), hpMatches.length));
    player.snd = roundScore(stabilizeScore(average(sndMatches.map(match => match.snd)), sndMatches.length));
    player.ol = roundScore(stabilizeScore(average(olMatches.map(match => match.ol)), olMatches.length));
  });

  return { byPlayerId, byMatchPlayerKey, byMapPlayerKey };
}
