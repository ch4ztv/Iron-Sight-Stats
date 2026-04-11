const DEFAULT_SAMPLE = 8;

const CDL_AVERAGES = {
  HP: {
    kd: 1.0,
    slayerScore: 88,
    kills10m: 24.2,
    engagements10m: 58.0,
    damage10m: 3150,
    objectiveScore: 62
  },
  SND: {
    kd: 1.0,
    slayerScore: 88,
    kills10m: 0.72,
    damage10m: 102,
    objectiveScore: 18,
    firstBloodRate: 0.23,
    plantsDefuses: 13
  },
  OL: {
    kd: 1.0,
    slayerScore: 88,
    kills10m: 23.4,
    engagements10m: 55.0,
    damage10m: 2980,
    objectiveScore: 46
  },
  OVERALL: {
    kd: 1.0,
    slayerScore: 88,
    kills10m: 23.8,
    engagements10m: 56.5,
    damage10m: 3060,
    objectiveScore: 42,
    firstBloodRate: 0.23,
    plantsDefuses: 13
  }
};

const ISR_TIERS = [
  { minimum: 64, label: 'Elite', colorClass: 'isr-tier-elite' },
  { minimum: 60, label: 'Premier', colorClass: 'isr-tier-premier' },
  { minimum: 55, label: 'Strong', colorClass: 'isr-tier-strong' },
  { minimum: 48, label: 'Steady', colorClass: 'isr-tier-steady' },
  { minimum: 0, label: 'Developing', colorClass: 'isr-tier-developing' }
];

function normalizeName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  const filtered = values.map(num).filter(value => value !== null);
  return filtered.length
    ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length
    : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function findPlayerRow(bucket, playerName) {
  const list = bucket?.players || [];
  const target = normalizeName(playerName);
  return list.find(row => normalizeName(row.player) === target) || null;
}

function averageModeMultiplier(modeMultipliers = {}, statKey) {
  const modes = ['HP', 'SND', 'OL'];
  const values = modes
    .map(mode => num(modeMultipliers?.[mode]?.[statKey]))
    .filter(value => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 1;
}

function sndObjectiveScore(firstBloodRate, plants, defuses) {
  const firstBloodValue = num(firstBloodRate);
  const plantsValue = num(plants);
  const defusesValue = num(defuses);
  const score =
    (firstBloodValue !== null ? firstBloodValue * 50 : 0) +
    (plantsValue !== null ? plantsValue * 0.6 : 0) +
    (defusesValue !== null ? defusesValue * 0.9 : 0);
  return score > 0 ? score : null;
}

function overloadObjectiveScore(goals10m) {
  const value = num(goals10m);
  return value !== null ? value * 55 : null;
}

function plantsDefusesScore(plants, defuses) {
  const plantsValue = num(plants);
  const defusesValue = num(defuses);
  const score = (plantsValue !== null ? plantsValue : 0) + (defusesValue !== null ? defusesValue * 1.5 : 0);
  return score > 0 ? score : null;
}

function overallObjectiveScore(player) {
  return average([
    num(player.hardpointObjective),
    sndObjectiveScore(player.firstBloodRate, player.plants, player.defuses),
    overloadObjectiveScore(player.overloadGoals10m)
  ]);
}

function statValue(player, statKey, mode = null) {
  if(mode === 'HP'){
    if(statKey === 'kd') return num(player.hardpointKd ?? player.kd);
    if(statKey === 'slayerScore') return num(player.slayerScore);
    if(statKey === 'kills10m') return num(player.hardpointKills10m);
    if(statKey === 'engagements10m') return num(player.hardpointEngagements10m);
    if(statKey === 'damage10m') return num(player.hardpointDamage10m);
    if(statKey === 'objectiveScore') return num(player.hardpointObjective);
    return null;
  }

  if(mode === 'SND'){
    if(statKey === 'kd') return num(player.sndKd ?? player.kd);
    if(statKey === 'slayerScore') return num(player.slayerScore);
    if(statKey === 'kills10m') return num(player.kRound);
    if(statKey === 'damage10m') return num(player.damagePerRound);
    if(statKey === 'objectiveScore') return sndObjectiveScore(player.firstBloodRate, player.plants, player.defuses);
    if(statKey === 'firstBloodRate') return num(player.firstBloodRate);
    if(statKey === 'plantsDefuses') return plantsDefusesScore(player.plants, player.defuses);
    return null;
  }

  if(mode === 'OL'){
    if(statKey === 'kd') return num(player.overloadKd ?? player.kd);
    if(statKey === 'slayerScore') return num(player.slayerScore);
    if(statKey === 'kills10m') return num(player.overloadKills10m);
    if(statKey === 'engagements10m') return num(player.overloadEngagements10m);
    if(statKey === 'damage10m') return num(player.overloadDamage10m);
    if(statKey === 'objectiveScore') return overloadObjectiveScore(player.overloadGoals10m);
    return null;
  }

  if(statKey === 'objectiveScore') return overallObjectiveScore(player);
  if(statKey === 'plantsDefuses') return plantsDefusesScore(player.plants, player.defuses);
  return num(player[statKey]);
}

export function computeISR(player, mode = null, config = {}) {
  if(!player || !config?.weights || !config?.modeMultipliers) return null;

  const weights = config.weights;
  const averages = CDL_AVERAGES[mode || 'OVERALL'];
  const entries = Object.entries(weights)
    .map(([statKey, weight]) => {
      const value = statValue(player, statKey, mode);
      const averageValue = num(averages?.[statKey]);
      const numericWeight = num(weight);
      const multiplier = mode
        ? num(config.modeMultipliers?.[mode]?.[statKey]) ?? 1
        : averageModeMultiplier(config.modeMultipliers, statKey);

      if(value === null || averageValue === null || averageValue <= 0 || numericWeight === null){
        return null;
      }

      const normalizedStat = (value / averageValue) * 50;
      return {
        weightedScore: normalizedStat * numericWeight * multiplier,
        weight: numericWeight * multiplier
      };
    })
    .filter(Boolean);

  if(!entries.length) return null;

  const totalWeightedScore = entries.reduce((sum, entry) => sum + entry.weightedScore, 0);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if(totalWeight <= 0) return null;

  const sampleThreshold = Math.max(num(config.samplePenaltyThreshold) ?? 0, 0);
  const sample = Math.max(num(player.sample) ?? DEFAULT_SAMPLE, 0);
  const sampleFactor = sampleThreshold > 0 ? Math.min(sample / sampleThreshold, 1) : 1;
  const maxRating = Math.max(num(config.maxRating) ?? 100, 1);
  const score = (totalWeightedScore / totalWeight) * sampleFactor;

  return Math.round(clamp(score, 0, maxRating) * 10) / 10;
}

export function isrTier(score) {
  const numericScore = num(score);
  if(numericScore === null) return { label: 'Unavailable', colorClass: 'isr-tier-unavailable' };
  return ISR_TIERS.find(tier => numericScore >= tier.minimum) || ISR_TIERS[ISR_TIERS.length - 1];
}

export function buildIsrPlayerFromTeamStats(teamStats, teamId, playerName, playerAggList = []) {
  const team = teamStats?.[teamId] || {};
  const overall = findPlayerRow(team.overall, playerName);
  const hardpoint = findPlayerRow(team.hardpoint, playerName);
  const snd = findPlayerRow(team.snd, playerName);
  const overload = findPlayerRow(team.overload, playerName);
  const aggregate = (playerAggList || []).find(row =>
    normalizeName(row.name) === normalizeName(playerName) &&
    String(row.teamId || '').toLowerCase() === String(teamId || '').toLowerCase()
  );

  const sample = num(aggregate?.maps) ?? DEFAULT_SAMPLE;
  const firstBloodFallback = num(snd?.bloods) !== null
    ? Math.min(1, Number(snd.bloods) / Math.max(sample, 50))
    : null;

  return {
    name: overall?.player || hardpoint?.player || snd?.player || overload?.player || playerName,
    teamId,
    sample,
    kd: num(overall?.kd) ?? average([hardpoint?.kd, snd?.kd, overload?.kd]),
    slayerScore: num(overall?.slayerRating),
    kills10m: average([hardpoint?.k10m, overload?.k10m]),
    engagements10m: average([hardpoint?.eng10m, overload?.eng10m]),
    damage10m: average([hardpoint?.dmg10m, overload?.dmg10m]),
    firstBloodRate: num(snd?.firstBloodRate) ?? firstBloodFallback,
    plants: num(snd?.plants),
    defuses: num(snd?.defuses),
    hardpointKd: num(hardpoint?.kd),
    hardpointKills10m: num(hardpoint?.k10m),
    hardpointEngagements10m: num(hardpoint?.eng10m),
    hardpointDamage10m: num(hardpoint?.dmg10m),
    hardpointObjective: num(hardpoint?.obj10m),
    sndKd: num(snd?.kd),
    kRound: num(snd?.kRound),
    damagePerRound: num(snd?.dmgRound),
    overloadKd: num(overload?.kd),
    overloadKills10m: num(overload?.k10m),
    overloadEngagements10m: num(overload?.eng10m),
    overloadDamage10m: num(overload?.dmg10m),
    overloadGoals10m: num(overload?.goals10m)
  };
}
