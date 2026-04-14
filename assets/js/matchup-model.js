const MODE_SEQUENCE = {
  BO5: ['HP', 'SND', 'OL', 'HP', 'SND'],
  BO7: ['HP', 'SND', 'OL', 'HP', 'SND', 'OL', 'SND']
};

const FORMAT_WINS = {
  BO5: 3,
  BO7: 4
};

const MODEL_CACHE = new WeakMap();
const DERIVED_CACHE = new WeakMap();

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

function normalizeName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rateWithPrior(wins, losses, priorMean = 0.5, strength = 6) {
  const safeWins = Number(wins || 0);
  const safeLosses = Number(losses || 0);
  return (safeWins + (priorMean * strength)) / Math.max(1, safeWins + safeLosses + strength);
}

function weightedAverage(entries) {
  let totalWeight = 0;
  let totalValue = 0;
  entries.forEach(entry => {
    const value = num(entry?.value);
    const weight = num(entry?.weight);
    if (value === null || weight === null || weight <= 0) return;
    totalWeight += weight;
    totalValue += value * weight;
  });
  return totalWeight ? totalValue / totalWeight : null;
}

function hashSeed(value = '') {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function logistic(edge) {
  return 1 / (1 + Math.exp(-edge));
}

function emptyStatBucket() {
  return {
    wins: 0,
    losses: 0,
    plays: 0,
    history: []
  };
}

function getDerivedData(data = {}) {
  if (DERIVED_CACHE.has(data)) {
    return DERIVED_CACHE.get(data);
  }

  const mapNamesByMode = { HP: new Set(), SND: new Set(), OL: new Set() };
  const seasonMapFrequency = { HP: {}, SND: {}, OL: {} };
  const teamModeStats = {};
  const teamModeMapStats = {};
  const teamSeriesHistory = {};
  const pairMatches = {};
  const teamStatLookup = {};

  for (const [teamId, teamStats] of Object.entries(data.teamStats || {})) {
    const lookup = {
      overall: new Map(),
      hardpoint: new Map(),
      snd: new Map(),
      overload: new Map()
    };
    (teamStats.overall?.players || []).forEach(row => lookup.overall.set(normalizeName(row.player), row));
    (teamStats.hardpoint?.players || []).forEach(row => lookup.hardpoint.set(normalizeName(row.player), row));
    (teamStats.snd?.players || []).forEach(row => lookup.snd.set(normalizeName(row.player), row));
    (teamStats.overload?.players || []).forEach(row => lookup.overload.set(normalizeName(row.player), row));
    teamStatLookup[teamId] = lookup;
  }

  (data.maps || []).forEach(map => {
    const match = data.matchesById?.[map.matchId];
    const mode = String(map.mode || '').toUpperCase();
    const mapName = map.mapName || `Map ${map.mapNum || ''}`.trim();
    if (!match || !mapNamesByMode[mode]) return;

    mapNamesByMode[mode].add(mapName);
    seasonMapFrequency[mode][mapName] = (seasonMapFrequency[mode][mapName] || 0) + 1;

    [match.team1Id, match.team2Id].forEach(teamId => {
      (teamModeStats[teamId] ||= {});
      (teamModeStats[teamId][mode] ||= emptyStatBucket());
      (teamModeMapStats[teamId] ||= {});
      (teamModeMapStats[teamId][mode] ||= {});
      (teamModeMapStats[teamId][mode][mapName] ||= emptyStatBucket());
    });

    const teams = [match.team1Id, match.team2Id];
    teams.forEach(teamId => {
      const won = map.winner === teamId;
      const lost = Boolean(map.winner) && map.winner !== teamId;
      const modeBucket = teamModeStats[teamId][mode];
      const mapBucket = teamModeMapStats[teamId][mode][mapName];
      modeBucket.plays += 1;
      mapBucket.plays += 1;
      if (won) {
        modeBucket.wins += 1;
        mapBucket.wins += 1;
      }
      if (lost) {
        modeBucket.losses += 1;
        mapBucket.losses += 1;
      }
      modeBucket.history.push({
        ts: Number(map.ts || match.ts || 0),
        mapName,
        win: won,
        opponentId: teamId === match.team1Id ? match.team2Id : match.team1Id
      });
      mapBucket.history.push({
        ts: Number(map.ts || match.ts || 0),
        win: won,
        opponentId: teamId === match.team1Id ? match.team2Id : match.team1Id
      });
    });
  });

  Object.values(teamModeStats).forEach(byMode => {
    Object.values(byMode).forEach(bucket => {
      bucket.history.sort((left, right) => right.ts - left.ts);
    });
  });
  Object.values(teamModeMapStats).forEach(byMode => {
    Object.values(byMode).forEach(byMap => {
      Object.values(byMap).forEach(bucket => {
        bucket.history.sort((left, right) => right.ts - left.ts);
      });
    });
  });

  (data.matches || []).forEach(match => {
    const pairKey = [match.team1Id, match.team2Id].sort().join('::');
    (pairMatches[pairKey] ||= []).push(match);
    const maps = data.mapsByMatch?.[match.id] || [];
    const score1 = num(match.seriesScore1) ?? maps.filter(map => map.winner === match.team1Id).length;
    const score2 = num(match.seriesScore2) ?? maps.filter(map => map.winner === match.team2Id).length;
    const completed = score1 !== null && score2 !== null && (score1 > 0 || score2 > 0);
    if (!completed) return;
    [match.team1Id, match.team2Id].forEach(teamId => {
      const bucket = (teamSeriesHistory[teamId] ||= []);
      const ownScore = teamId === match.team1Id ? score1 : score2;
      const oppScore = teamId === match.team1Id ? score2 : score1;
      bucket.push({
        ts: Number(match.ts || 0),
        win: ownScore > oppScore,
        opponentId: teamId === match.team1Id ? match.team2Id : match.team1Id,
        eventId: match.eventId,
        date: match.date,
        score: `${ownScore}-${oppScore}`
      });
    });
  });

  Object.values(pairMatches).forEach(list => list.sort((left, right) => Number(right.ts || 0) - Number(left.ts || 0)));
  Object.values(teamSeriesHistory).forEach(list => list.sort((left, right) => right.ts - left.ts));

  const derived = {
    mapNamesByMode: {
      HP: Array.from(mapNamesByMode.HP).sort(),
      SND: Array.from(mapNamesByMode.SND).sort(),
      OL: Array.from(mapNamesByMode.OL).sort()
    },
    seasonMapFrequency,
    teamModeStats,
    teamModeMapStats,
    teamSeriesHistory,
    pairMatches,
    teamStatLookup
  };

  DERIVED_CACHE.set(data, derived);
  return derived;
}

function getRosterProfiles(data, teamId, limit = 4) {
  const all = data.computed?.profilesByTeam?.[teamId] || [];
  const active = all.filter(profile => profile.active !== false);
  const source = active.length ? active : all;
  return [...source]
    .sort((left, right) =>
      (num(right.overallOVR) ?? -1) - (num(left.overallOVR) ?? -1) ||
      (num(right.overallISR) ?? -1) - (num(left.overallISR) ?? -1) ||
      (num(right.sample) ?? 0) - (num(left.sample) ?? 0) ||
      String(left.displayName || '').localeCompare(String(right.displayName || ''))
    )
    .slice(0, limit);
}

function latestSeriesForm(derived, teamId, limit = 5) {
  return (derived.teamSeriesHistory?.[teamId] || []).slice(0, limit);
}

function recentWinRate(bucket, fallback = 0.5, limit = 6) {
  const sample = (bucket?.history || []).slice(0, limit);
  if (!sample.length) return fallback;
  const wins = sample.filter(entry => entry.win).length;
  return rateWithPrior(wins, sample.length - wins, fallback, 2);
}

function playerLookupRow(derived, teamId, profile, lane) {
  const lookup = derived.teamStatLookup?.[teamId];
  if (!lookup || !profile) return null;
  return lookup[lane]?.get(normalizeName(profile.displayName || profile.name || profile.playerId)) || null;
}

function playerModeRating(profile, mode) {
  if (!profile) return null;
  if (mode === 'HP') return num(profile.hpOVR) ?? num(profile.overallOVR) ?? num(profile.overallISR);
  if (mode === 'SND') return num(profile.sndOVR) ?? num(profile.overallOVR) ?? num(profile.overallISR);
  if (mode === 'OL') return num(profile.olOVR) ?? num(profile.overallOVR) ?? num(profile.overallISR);
  return num(profile.overallOVR) ?? num(profile.overallISR);
}

function teamAverageModeRating(roster, mode) {
  return average(roster.map(profile => playerModeRating(profile, mode)));
}

function teamAverageSlayer(derived, teamId, roster) {
  return average(roster.map(profile => num(playerLookupRow(derived, teamId, profile, 'overall')?.slayerRating)));
}

function winRateForTeam(bucket, fallback = 0.5, prior = 6) {
  return rateWithPrior(bucket?.wins || 0, bucket?.losses || 0, fallback, prior);
}

function getH2HBundle(data, teamA, teamB) {
  const derived = getDerivedData(data);
  const pairKey = [teamA, teamB].sort().join('::');
  const matches = [...(derived.pairMatches?.[pairKey] || [])];
  let seriesA = 0;
  let seriesB = 0;
  let mapsA = 0;
  let mapsB = 0;
  const modeSummary = { HP: { winsA: 0, winsB: 0, plays: 0 }, SND: { winsA: 0, winsB: 0, plays: 0 }, OL: { winsA: 0, winsB: 0, plays: 0 } };
  const modeMapSummary = {};

  matches.forEach(match => {
    const maps = data.mapsByMatch?.[match.id] || [];
    const score1 = num(match.seriesScore1) ?? maps.filter(map => map.winner === match.team1Id).length;
    const score2 = num(match.seriesScore2) ?? maps.filter(map => map.winner === match.team2Id).length;
    const ownScore = match.team1Id === teamA ? score1 : score2;
    const oppScore = match.team1Id === teamA ? score2 : score1;
    if (ownScore > oppScore) seriesA += 1;
    if (oppScore > ownScore) seriesB += 1;

    maps.forEach(map => {
      const mode = String(map.mode || '').toUpperCase();
      const mapName = map.mapName || `Map ${map.mapNum || ''}`.trim();
      if (!modeSummary[mode]) return;
      modeSummary[mode].plays += 1;
      (modeMapSummary[mode] ||= {});
      (modeMapSummary[mode][mapName] ||= { winsA: 0, winsB: 0, plays: 0 });
      modeMapSummary[mode][mapName].plays += 1;
      if (map.winner === teamA) {
        mapsA += 1;
        modeSummary[mode].winsA += 1;
        modeMapSummary[mode][mapName].winsA += 1;
      }
      if (map.winner === teamB) {
        mapsB += 1;
        modeSummary[mode].winsB += 1;
        modeMapSummary[mode][mapName].winsB += 1;
      }
    });
  });

  return { matches, seriesA, seriesB, mapsA, mapsB, modeSummary, modeMapSummary };
}

function mapWeightScore(derived, teamA, teamB, mode, mapName, h2hBundle) {
  const seasonCounts = derived.seasonMapFrequency?.[mode] || {};
  const maxSeasonCount = Math.max(1, ...Object.values(seasonCounts));
  const seasonPopularity = (seasonCounts[mapName] || 0) / maxSeasonCount;

  const teamAMode = derived.teamModeStats?.[teamA]?.[mode] || emptyStatBucket();
  const teamBMode = derived.teamModeStats?.[teamB]?.[mode] || emptyStatBucket();
  const teamAMap = derived.teamModeMapStats?.[teamA]?.[mode]?.[mapName] || emptyStatBucket();
  const teamBMap = derived.teamModeMapStats?.[teamB]?.[mode]?.[mapName] || emptyStatBucket();
  const familiarityA = teamAMode.plays ? teamAMap.plays / teamAMode.plays : 0;
  const familiarityB = teamBMode.plays ? teamBMap.plays / teamBMode.plays : 0;
  const h2hCount = h2hBundle.modeMapSummary?.[mode]?.[mapName]?.plays || 0;

  return 1
    + (seasonPopularity * 1.25)
    + (((familiarityA + familiarityB) / 2) * 1.2)
    + (Math.min(h2hCount, 3) * 0.14);
}

function matchupMapProbability(data, derived, teamA, teamB, mode, mapName, rosterA, rosterB, h2hBundle) {
  const teamAMode = derived.teamModeStats?.[teamA]?.[mode] || emptyStatBucket();
  const teamBMode = derived.teamModeStats?.[teamB]?.[mode] || emptyStatBucket();
  const teamAMap = derived.teamModeMapStats?.[teamA]?.[mode]?.[mapName] || emptyStatBucket();
  const teamBMap = derived.teamModeMapStats?.[teamB]?.[mode]?.[mapName] || emptyStatBucket();
  const h2hMode = h2hBundle.modeSummary?.[mode] || { winsA: 0, winsB: 0, plays: 0 };
  const h2hModeMap = h2hBundle.modeMapSummary?.[mode]?.[mapName] || { winsA: 0, winsB: 0, plays: 0 };

  const modeRateA = winRateForTeam(teamAMode, 0.5, 8);
  const modeRateB = winRateForTeam(teamBMode, 0.5, 8);
  const mapRateA = winRateForTeam(teamAMap, modeRateA, 4);
  const mapRateB = winRateForTeam(teamBMap, modeRateB, 4);
  const recentModeA = recentWinRate(teamAMode, modeRateA, 7);
  const recentModeB = recentWinRate(teamBMode, modeRateB, 7);
  const recentMapA = recentWinRate(teamAMap, mapRateA, 4);
  const recentMapB = recentWinRate(teamBMap, mapRateB, 4);
  const h2hModeRateA = rateWithPrior(h2hMode.winsA, h2hMode.winsB, 0.5, 2);
  const h2hMapRateA = rateWithPrior(h2hModeMap.winsA, h2hModeMap.winsB, h2hModeRateA, 1.5);

  const rosterModeA = teamAverageModeRating(rosterA, mode);
  const rosterModeB = teamAverageModeRating(rosterB, mode);
  const rosterOverallA = average(rosterA.map(profile => num(profile.overallOVR) ?? num(profile.overallISR)));
  const rosterOverallB = average(rosterB.map(profile => num(profile.overallOVR) ?? num(profile.overallISR)));
  const slayerA = teamAverageSlayer(derived, teamA, rosterA);
  const slayerB = teamAverageSlayer(derived, teamB, rosterB);

  const edge =
    ((mapRateA - mapRateB) * 1.85) +
    ((modeRateA - modeRateB) * 1.2) +
    ((recentModeA - recentModeB) * 0.75) +
    ((recentMapA - recentMapB) * 0.45) +
    ((((rosterModeA ?? rosterOverallA ?? 80) - (rosterModeB ?? rosterOverallB ?? 80)) / 18) * 1.0) +
    ((((rosterOverallA ?? 80) - (rosterOverallB ?? 80)) / 20) * 0.45) +
    ((((slayerA ?? 75) - (slayerB ?? 75)) / 20) * 0.35) +
    (((h2hMapRateA - (1 - h2hMapRateA)) * 0.25));

  const probabilityA = clamp(logistic(edge * 2.45), 0.17, 0.83);

  return {
    mode,
    mapName,
    pickWeight: mapWeightScore(derived, teamA, teamB, mode, mapName, h2hBundle),
    probabilityA,
    probabilityB: 1 - probabilityA,
    teamAMapRate: mapRateA,
    teamBMapRate: mapRateB,
    teamAMapPlays: teamAMap.plays,
    teamBMapPlays: teamBMap.plays,
    teamAModeRate: modeRateA,
    teamBModeRate: modeRateB,
    recentModeA,
    recentModeB
  };
}

function weightedChoice(rng, options) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  if (!total) return options[0];
  let roll = rng() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option;
  }
  return options[options.length - 1];
}

function confidenceBand(probability) {
  if (probability >= 0.72) return { label: 'Heavy Lean', tone: 'high' };
  if (probability >= 0.62) return { label: 'Strong Edge', tone: 'mid' };
  if (probability >= 0.55) return { label: 'Lean', tone: 'low' };
  return { label: 'Toss-Up', tone: 'flat' };
}

function formatRecord(record) {
  return `${record?.wins || 0}-${record?.losses || 0}`;
}

function formatRecent(results = []) {
  return (results || []).slice(0, 5).map(entry => entry === 'W' ? 'W' : 'L');
}

function formatSeriesRecent(list = []) {
  return list.slice(0, 5).map(entry => entry.win ? 'W' : 'L');
}

function projectPlayer(profile, teamId, derived, expectedModeCounts) {
  const overall = playerLookupRow(derived, teamId, profile, 'overall') || {};
  const hardpoint = playerLookupRow(derived, teamId, profile, 'hardpoint') || {};
  const snd = playerLookupRow(derived, teamId, profile, 'snd') || {};
  const overload = playerLookupRow(derived, teamId, profile, 'overload') || {};
  const totalExpectedMaps = Math.max(1, Object.values(expectedModeCounts).reduce((sum, value) => sum + value, 0));
  const projectedIsr = weightedAverage([
    { value: playerModeRating(profile, 'HP'), weight: expectedModeCounts.HP || 0 },
    { value: playerModeRating(profile, 'SND'), weight: expectedModeCounts.SND || 0 },
    { value: playerModeRating(profile, 'OL'), weight: expectedModeCounts.OL || 0 }
  ]) ?? num(profile.overallOVR) ?? num(profile.overallISR);

  return {
    ...profile,
    projectedIsr,
    projectedShareHP: (expectedModeCounts.HP || 0) / totalExpectedMaps,
    projectedShareSND: (expectedModeCounts.SND || 0) / totalExpectedMaps,
    projectedShareOL: (expectedModeCounts.OL || 0) / totalExpectedMaps,
    slayerRating: num(overall.slayerRating),
    respawnKd: num(overall.respawnKd) ?? average([num(hardpoint.kd), num(overload.kd)]),
    sndMetric: num(snd.kd) ?? num(profile.sndOVR),
    hpMetric: num(hardpoint.kd) ?? num(profile.hpOVR),
    olMetric: num(overload.kd) ?? num(profile.olOVR),
    overallKd: num(overall.kd) ?? num(profile.kd),
    ntkPct: num(overall.ntkPct),
    matchCount: num(profile.ratingMatchCount) ?? num(profile.sample) ?? 0
  };
}

function buildPlayerEdges(data, derived, teamA, teamB, rosterA, rosterB, expectedModeCounts) {
  const projectionsA = rosterA.map(profile => projectPlayer(profile, teamA, derived, expectedModeCounts));
  const projectionsB = rosterB.map(profile => projectPlayer(profile, teamB, derived, expectedModeCounts));

  const avgSndA = average(projectionsA.map(player => player.sndMetric));
  const avgSndB = average(projectionsB.map(player => player.sndMetric));
  const avgRespA = average(projectionsA.map(player => player.respawnKd));
  const avgRespB = average(projectionsB.map(player => player.respawnKd));
  const avgProjA = average(projectionsA.map(player => player.projectedIsr));
  const avgProjB = average(projectionsB.map(player => player.projectedIsr));
  const avgSlayerA = average(projectionsA.map(player => player.slayerRating));
  const avgSlayerB = average(projectionsB.map(player => player.slayerRating));

  projectionsA.forEach(player => {
    player.sndEdge = (num(player.sndMetric) ?? 0) - (num(avgSndB) ?? 0);
    player.respawnEdge = (num(player.respawnKd) ?? 0) - (num(avgRespB) ?? 0);
    player.swingScore = ((num(player.projectedIsr) ?? 0) - (num(avgProjA) ?? 0))
      + (((num(player.slayerRating) ?? 0) - (num(avgSlayerA) ?? 0)) * 0.2)
      + (Math.abs(player.sndEdge) * 2.2);
  });
  projectionsB.forEach(player => {
    player.sndEdge = (num(player.sndMetric) ?? 0) - (num(avgSndA) ?? 0);
    player.respawnEdge = (num(player.respawnKd) ?? 0) - (num(avgRespA) ?? 0);
    player.swingScore = ((num(player.projectedIsr) ?? 0) - (num(avgProjB) ?? 0))
      + (((num(player.slayerRating) ?? 0) - (num(avgSlayerB) ?? 0)) * 0.2)
      + (Math.abs(player.sndEdge) * 2.2);
  });

  const byProjected = list => [...list].sort((left, right) =>
    (num(right.projectedIsr) ?? -1) - (num(left.projectedIsr) ?? -1) ||
    (num(right.slayerRating) ?? -1) - (num(left.slayerRating) ?? -1) ||
    String(left.displayName || '').localeCompare(String(right.displayName || ''))
  );
  const byMetric = (list, metric) => [...list]
    .filter(player => num(player[metric]) !== null)
    .sort((left, right) => (num(right[metric]) ?? -1) - (num(left[metric]) ?? -1) || String(left.displayName || '').localeCompare(String(right.displayName || '')))[0] || null;

  const orderedA = byProjected(projectionsA);
  const orderedB = byProjected(projectionsB);
  const comparisonRows = Array.from({ length: Math.max(orderedA.length, orderedB.length) }).map((_, index) => {
    const left = orderedA[index] || null;
    const right = orderedB[index] || null;
    const diff = (num(left?.projectedIsr) ?? 0) - (num(right?.projectedIsr) ?? 0);
    return {
      left,
      right,
      edge: Math.abs(diff),
      edgeTeamId: diff >= 0 ? teamA : teamB
    };
  }).filter(row => row.left || row.right);

  return {
    teamA: {
      roster: orderedA,
      topIsr: byMetric(orderedA, 'projectedIsr'),
      topSlayer: byMetric(orderedA, 'slayerRating'),
      bestSnd: byMetric(orderedA, 'sndEdge'),
      bestRespawn: byMetric(orderedA, 'respawnEdge'),
      swing: byMetric(orderedA, 'swingScore')
    },
    teamB: {
      roster: orderedB,
      topIsr: byMetric(orderedB, 'projectedIsr'),
      topSlayer: byMetric(orderedB, 'slayerRating'),
      bestSnd: byMetric(orderedB, 'sndEdge'),
      bestRespawn: byMetric(orderedB, 'respawnEdge'),
      swing: byMetric(orderedB, 'swingScore')
    },
    starDuel: {
      teamA: orderedA[0] || null,
      teamB: orderedB[0] || null
    },
    comparisonRows
  };
}

function buildKeyBullets(teamId, opponentId, hero, simulation, playerEdges, teamPerspective = 'team') {
  const ownKey = teamPerspective === 'team' ? (teamId === hero.teamA.teamId ? 'teamA' : 'teamB') : (teamId === hero.teamA.teamId ? 'teamA' : 'teamB');
  const own = hero[ownKey];
  const opp = hero[ownKey === 'teamA' ? 'teamB' : 'teamA'];
  const ownPlayers = playerEdges[ownKey];
  const bullets = [];

  if ((own.modeEdges?.SND ?? 0) > 0.03) {
    bullets.push(`Lean on Search & Destroy. ${own.name} owns the stronger S&D model edge in this matchup.`);
  }
  if ((own.modeEdges?.HP ?? 0) > 0.03 || (own.modeEdges?.OL ?? 0) > 0.03) {
    bullets.push(`Protect the respawn maps. ${own.name} projects better across the respawn side of the series.`);
  }
  if (ownPlayers?.topIsr) {
    bullets.push(`${ownPlayers.topIsr.displayName} is the headline engine. A strong series from them pushes the model toward ${own.name}.`);
  }
  const bestMap = simulation.path.find(slot => slot.projectedWinnerId === teamId && slot.probability >= 0.56);
  if (bestMap) {
    bullets.push(`Capitalize on ${bestMap.mapName} ${bestMap.mode}. That is the cleanest projected swing map for ${own.name}.`);
  }
  if ((own.recentFormScore ?? 0) > (opp.recentFormScore ?? 0)) {
    bullets.push(`${own.name} comes in with the better recent trend line, which helps if the series goes long.`);
  }

  return bullets.slice(0, 3);
}

export function buildMatchupModel(data = {}, teamA, teamB, format = 'BO5') {
  if (!teamA || !teamB || teamA === teamB) return null;
  const safeFormat = Object.prototype.hasOwnProperty.call(MODE_SEQUENCE, format) ? format : 'BO5';
  const cacheKey = `${teamA}|${teamB}|${safeFormat}`;
  const dataCache = MODEL_CACHE.get(data) || new Map();
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }

  const derived = getDerivedData(data);
  const h2hBundle = getH2HBundle(data, teamA, teamB);
  const sequence = MODE_SEQUENCE[safeFormat];
  const neededWins = FORMAT_WINS[safeFormat];
  const rosterA = getRosterProfiles(data, teamA, 4);
  const rosterB = getRosterProfiles(data, teamB, 4);
  const mapOptions = {};

  ['HP', 'SND', 'OL'].forEach(mode => {
    mapOptions[mode] = (derived.mapNamesByMode?.[mode] || []).map(mapName =>
      matchupMapProbability(data, derived, teamA, teamB, mode, mapName, rosterA, rosterB, h2hBundle)
    );
  });

  const runs = 10000;
  const slotStats = sequence.map(mode => ({
    mode,
    played: 0,
    winsA: 0,
    winsB: 0,
    mapCounts: {}
  }));
  const modePlayedCounts = { HP: 0, SND: 0, OL: 0 };
  const scorelineCounts = {};
  const winCounts = { [teamA]: 0, [teamB]: 0 };
  const rng = mulberry32(hashSeed(cacheKey));

  for (let run = 0; run < runs; run += 1) {
    let winsA = 0;
    let winsB = 0;
    const remaining = {
      HP: [...mapOptions.HP],
      SND: [...mapOptions.SND],
      OL: [...mapOptions.OL]
    };

    for (let slotIndex = 0; slotIndex < sequence.length; slotIndex += 1) {
      if (winsA >= neededWins || winsB >= neededWins) break;
      const mode = sequence[slotIndex];
      const pool = remaining[mode].length ? remaining[mode] : mapOptions[mode];
      const picked = weightedChoice(rng, pool.map(option => ({ value: option, weight: option.pickWeight }))).value;
      const removeIndex = remaining[mode].findIndex(option => option.mapName === picked.mapName);
      if (removeIndex >= 0) remaining[mode].splice(removeIndex, 1);

      const teamAWon = rng() <= picked.probabilityA;
      if (teamAWon) winsA += 1;
      else winsB += 1;

      const slot = slotStats[slotIndex];
      slot.played += 1;
      slot.winsA += teamAWon ? 1 : 0;
      slot.winsB += teamAWon ? 0 : 1;
      slot.mapCounts[picked.mapName] = (slot.mapCounts[picked.mapName] || 0) + 1;
      modePlayedCounts[mode] += 1;
    }

    winCounts[winsA > winsB ? teamA : teamB] += 1;
    scorelineCounts[`${winsA}-${winsB}`] = (scorelineCounts[`${winsA}-${winsB}`] || 0) + 1;
  }

  const winPctA = winCounts[teamA] / runs;
  const winPctB = winCounts[teamB] / runs;
  const favoriteId = winPctA >= winPctB ? teamA : teamB;
  const underdogId = favoriteId === teamA ? teamB : teamA;
  const favoriteProb = Math.max(winPctA, winPctB);
  const confidence = confidenceBand(favoriteProb);
  const expectedModeCounts = {
    HP: modePlayedCounts.HP / runs,
    SND: modePlayedCounts.SND / runs,
    OL: modePlayedCounts.OL / runs
  };

  const playerEdges = buildPlayerEdges(data, derived, teamA, teamB, rosterA, rosterB, expectedModeCounts);

  const topScorelines = Object.entries(scorelineCounts)
    .map(([label, count]) => ({
      label,
      pct: count / runs,
      winnerId: Number(label.split('-')[0]) > Number(label.split('-')[1]) ? teamA : teamB
    }))
    .sort((left, right) => right.pct - left.pct)
    .slice(0, 4);

  const path = slotStats.map((slot, index) => {
    const topMap = Object.entries(slot.mapCounts).sort((left, right) => right[1] - left[1])[0];
    const mapName = topMap?.[0] || (mapOptions[slot.mode]?.[0]?.mapName || 'No data');
    const mapMeta = mapOptions[slot.mode].find(option => option.mapName === mapName) || mapOptions[slot.mode][0];
    const probability = slot.played ? Math.max(slot.winsA, slot.winsB) / slot.played : 0.5;
    const projectedWinnerId = (slot.played ? slot.winsA / slot.played : 0.5) >= 0.5 ? teamA : teamB;
    return {
      slot: index + 1,
      mode: slot.mode,
      mapName,
      appearancePct: slot.played ? (topMap?.[1] || 0) / slot.played : 0,
      playPct: slot.played / runs,
      probability,
      projectedWinnerId,
      teamAWinPct: slot.played ? slot.winsA / slot.played : mapMeta?.probabilityA ?? 0.5,
      mapMeta
    };
  });

  const mapPoolRows = ['HP', 'SND', 'OL'].flatMap(mode =>
    (mapOptions[mode] || [])
      .slice()
      .sort((left, right) => right.pickWeight - left.pickWeight)
      .map(option => ({
        ...option,
        likelyPct: (() => {
          const matchingSlots = path.filter(slot => slot.mode === mode);
          const hit = matchingSlots.reduce((sum, slot) => sum + (slot.mapName === option.mapName ? slot.appearancePct : 0), 0);
          return hit / Math.max(1, matchingSlots.length || 1);
        })(),
        edgeTeamId: option.probabilityA >= 0.5 ? teamA : teamB,
        edgePct: Math.max(option.probabilityA, option.probabilityB)
      }))
  );

  const hero = {
    teamA: {
      teamId: teamA,
      name: data.teams?.find(team => team.id === teamA)?.name || teamA,
      record: data.teamRecords?.[teamA] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] },
      recent: formatRecent(data.teamRecords?.[teamA]?.recent || []),
      recentFormScore: (data.teamRecords?.[teamA]?.recent || []).reduce((sum, result) => sum + (result === 'W' ? 1 : -1), 0),
      avgRosterRating: average(rosterA.map(profile => num(profile.overallOVR) ?? num(profile.overallISR))),
      avgSlayer: teamAverageSlayer(derived, teamA, rosterA),
      roster: rosterA,
      topPlayer: playerEdges.teamA.topIsr,
      modeEdges: {
        HP: average(mapOptions.HP.map(option => option.probabilityA)) - 0.5,
        SND: average(mapOptions.SND.map(option => option.probabilityA)) - 0.5,
        OL: average(mapOptions.OL.map(option => option.probabilityA)) - 0.5
      }
    },
    teamB: {
      teamId: teamB,
      name: data.teams?.find(team => team.id === teamB)?.name || teamB,
      record: data.teamRecords?.[teamB] || { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] },
      recent: formatRecent(data.teamRecords?.[teamB]?.recent || []),
      recentFormScore: (data.teamRecords?.[teamB]?.recent || []).reduce((sum, result) => sum + (result === 'W' ? 1 : -1), 0),
      avgRosterRating: average(rosterB.map(profile => num(profile.overallOVR) ?? num(profile.overallISR))),
      avgSlayer: teamAverageSlayer(derived, teamB, rosterB),
      roster: rosterB,
      topPlayer: playerEdges.teamB.topIsr,
      modeEdges: {
        HP: 0.5 - average(mapOptions.HP.map(option => option.probabilityA)),
        SND: 0.5 - average(mapOptions.SND.map(option => option.probabilityA)),
        OL: 0.5 - average(mapOptions.OL.map(option => option.probabilityA))
      }
    }
  };

  const drivers = [
    {
      key: 'snd',
      score: Math.abs((hero.teamA.modeEdges.SND || 0) - (hero.teamB.modeEdges.SND || 0)),
      teamId: Math.abs(hero.teamA.modeEdges.SND || 0) >= Math.abs(hero.teamB.modeEdges.SND || 0) ? teamA : teamB,
      label: 'S&D edge',
      detail: `${Math.abs(hero.teamA.modeEdges.SND || 0) >= Math.abs(hero.teamB.modeEdges.SND || 0) ? hero.teamA.name : hero.teamB.name} owns the cleaner Search edge in the model.`
    },
    {
      key: 'roster',
      score: Math.abs((hero.teamA.avgRosterRating || 0) - (hero.teamB.avgRosterRating || 0)),
      teamId: (hero.teamA.avgRosterRating || 0) >= (hero.teamB.avgRosterRating || 0) ? teamA : teamB,
      label: 'Roster rating',
      detail: `${(hero.teamA.avgRosterRating || 0) >= (hero.teamB.avgRosterRating || 0) ? hero.teamA.name : hero.teamB.name} carries the stronger average roster card.`
    },
    {
      key: 'form',
      score: Math.abs((hero.teamA.recentFormScore || 0) - (hero.teamB.recentFormScore || 0)),
      teamId: (hero.teamA.recentFormScore || 0) >= (hero.teamB.recentFormScore || 0) ? teamA : teamB,
      label: 'Recent form',
      detail: `${(hero.teamA.recentFormScore || 0) >= (hero.teamB.recentFormScore || 0) ? hero.teamA.name : hero.teamB.name} has the better recent series trend.`
    },
    {
      key: 'pool',
      score: Math.abs(path.reduce((sum, slot) => sum + ((slot.projectedWinnerId === teamA ? slot.teamAWinPct : 1 - slot.teamAWinPct) - 0.5), 0)),
      teamId: path.reduce((sum, slot) => sum + (slot.projectedWinnerId === teamA ? 1 : -1), 0) >= 0 ? teamA : teamB,
      label: 'Map pool path',
      detail: `${path.reduce((sum, slot) => sum + (slot.projectedWinnerId === teamA ? 1 : -1), 0) >= 0 ? hero.teamA.name : hero.teamB.name} shows up on more of the likely map path.`
    }
  ].sort((left, right) => right.score - left.score).slice(0, 4);

  const simulation = {
    runs,
    winPctA,
    winPctB,
    favoriteId,
    underdogId,
    confidence,
    scorelines: topScorelines,
    path,
    expectedModeCounts
  };

  const model = {
    format: safeFormat,
    sequence,
    neededWins,
    summary: {
      favoriteId,
      underdogId,
      confidence,
      drivers
    },
    hero,
    simulation,
    mapPool: {
      rows: mapPoolRows
    },
    headToHead: {
      matches: h2hBundle.matches,
      seriesA: h2hBundle.seriesA,
      seriesB: h2hBundle.seriesB,
      mapsA: h2hBundle.mapsA,
      mapsB: h2hBundle.mapsB
    },
    playerEdges,
    keys: {
      teamA: buildKeyBullets(teamA, teamB, hero, simulation, playerEdges, 'team'),
      teamB: buildKeyBullets(teamB, teamA, hero, simulation, playerEdges, 'team')
    }
  };

  model.keys.underdog = buildKeyBullets(underdogId, favoriteId, hero, simulation, playerEdges, 'underdog');

  dataCache.set(cacheKey, model);
  MODEL_CACHE.set(data, dataCache);
  return model;
}
