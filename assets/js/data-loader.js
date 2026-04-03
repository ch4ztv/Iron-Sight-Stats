import { APP_CONFIG } from './config.js';

async function fetchJson(path, fallback, required = false) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    if (required) throw new Error(`Failed to load ${path}: ${error.message}`);
    return fallback;
  }
}

export async function loadAllData() {
  const [
    meta,
    season,
    matches,
    maps,
    players,
    playerStats,
    points,
    bracketData,
    teamStats,
    bprCoefficients,
    manifest,
  ] = await Promise.all([
    fetchJson(APP_CONFIG.dataFiles.meta, {}, false),
    fetchJson(APP_CONFIG.dataFiles.season, null, false),
    fetchJson(APP_CONFIG.dataFiles.matches, [], true),
    fetchJson(APP_CONFIG.dataFiles.maps, [], false),
    fetchJson(APP_CONFIG.dataFiles.players, [], false),
    fetchJson(APP_CONFIG.dataFiles.playerStats, [], false),
    fetchJson(APP_CONFIG.dataFiles.points, [], false),
    fetchJson(APP_CONFIG.dataFiles.bracketData, {}, false),
    fetchJson(APP_CONFIG.dataFiles.teamStats, [], false),
    fetchJson(APP_CONFIG.dataFiles.bprCoefficients, {}, false),
    fetchJson(APP_CONFIG.dataFiles.manifest, {}, false),
  ]);

  return normalizeData({
    meta,
    season,
    matches,
    maps,
    players,
    playerStats,
    points,
    bracketData,
    teamStats,
    bprCoefficients,
    manifest,
  });
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeData(data) {
  return {
    meta: data.meta || {},
    season: data.season || null,
    matches: toArray(data.matches).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    maps: toArray(data.maps),
    players: toArray(data.players),
    playerStats: toArray(data.playerStats),
    points: toArray(data.points),
    bracketData: data.bracketData || {},
    teamStats: toArray(data.teamStats),
    bprCoefficients: data.bprCoefficients || {},
    manifest: data.manifest || {},
  };
}

export function getMapsForMatch(maps, matchId) {
  return (maps || [])
    .filter((map) => Number(map.matchId) === Number(matchId))
    .sort((a, b) => Number(a.mapNum || 0) - Number(b.mapNum || 0));
}

export function getLatestCompletedMatches(matches) {
  return (matches || [])
    .filter((match) => Number.isFinite(Number(match.seriesScore1)) && Number.isFinite(Number(match.seriesScore2)))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function getUpcomingMatches(matches) {
  return (matches || [])
    .filter((match) => !Number.isFinite(Number(match.seriesScore1)) || !Number.isFinite(Number(match.seriesScore2)))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

export function buildStandingsFromPoints(points, matches) {
  if (Array.isArray(points) && points.length) {
    return points
      .map((entry) => ({
        teamId: entry.teamId || entry.id || entry.team || 'unknown',
        points: Number(entry.points ?? entry.totalPoints ?? entry.cdlPoints ?? 0),
        wins: Number(entry.wins ?? entry.matchWins ?? 0),
        losses: Number(entry.losses ?? entry.matchLosses ?? 0),
        mapDiff: Number(entry.mapDiff ?? entry.diff ?? 0),
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || b.mapDiff - a.mapDiff);
  }

  const table = new Map();
  for (const match of matches || []) {
    if (!Number.isFinite(Number(match.seriesScore1)) || !Number.isFinite(Number(match.seriesScore2))) continue;
    const t1 = match.team1Id;
    const t2 = match.team2Id;
    if (!table.has(t1)) table.set(t1, { teamId: t1, wins: 0, losses: 0, points: 0, mapDiff: 0 });
    if (!table.has(t2)) table.set(t2, { teamId: t2, wins: 0, losses: 0, points: 0, mapDiff: 0 });
    const row1 = table.get(t1);
    const row2 = table.get(t2);
    row1.mapDiff += Number(match.seriesScore1 || 0) - Number(match.seriesScore2 || 0);
    row2.mapDiff += Number(match.seriesScore2 || 0) - Number(match.seriesScore1 || 0);
    if (Number(match.seriesScore1) > Number(match.seriesScore2)) {
      row1.wins += 1; row1.points += 10; row2.losses += 1;
    } else {
      row2.wins += 1; row2.points += 10; row1.losses += 1;
    }
  }
  return Array.from(table.values()).sort((a, b) => b.points - a.points || b.wins - a.wins || b.mapDiff - a.mapDiff);
}
