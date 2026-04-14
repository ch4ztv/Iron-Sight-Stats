import { APP_CONFIG } from './config.js';

async function fetchJson(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

function eventOrderValue(eventId){
  return APP_CONFIG.eventMeta?.[eventId]?.order ?? -1;
}

function sortStints(left, right){
  const activeDiff = Number(Boolean(right?.active)) - Number(Boolean(left?.active));
  if(activeDiff) return activeDiff;

  const startDiff = eventOrderValue(right?.startEventId) - eventOrderValue(left?.startEventId);
  if(startDiff) return startDiff;

  return Number(right?.ts || 0) - Number(left?.ts || 0) || String(left?.name || '').localeCompare(String(right?.name || ''));
}

function normalizePlayer(player = {}){
  const personId = player.personId || String(player.id || '').split('_', 2).slice(1).join('_') || player.id;
  return {
    ...player,
    personId,
    status: player.status || (player.active ? 'active' : 'inactive')
  };
}

function normalizeBio(key, bio = {}){
  const personId = bio.personId || String(key || '').split('_', 2).slice(1).join('_') || key;
  return {
    ...bio,
    personId
  };
}

export async function loadAllData(){
  const entries = await Promise.all(Object.entries(APP_CONFIG.dataFiles).map(async ([key, url]) => [key, await fetchJson(url)]));
  const data = Object.fromEntries(entries);

  data.players = (data.players || []).map(normalizePlayer);
  data.playerBios = Object.fromEntries(
    Object.entries(data.playerBios || {}).map(([key, bio]) => [key, normalizeBio(key, bio)])
  );

  data.matchesById = Object.fromEntries((data.matches || []).map(match => [match.id, match]));
  data.mapsById = Object.fromEntries((data.maps || []).map(map => [map.id, map]));

  data.mapsByMatch = {};
  for(const map of data.maps || []){
    (data.mapsByMatch[map.matchId] ||= []).push(map);
  }
  for(const list of Object.values(data.mapsByMatch)){
    list.sort((a, b) => a.mapNum - b.mapNum);
  }

  data.playerStatsByMap = {};
  for(const row of data.playerStats || []){
    (data.playerStatsByMap[row.mapId] ||= []).push(row);
  }

  data.playerById = Object.fromEntries((data.players || []).map(player => [player.id, player]));
  data.personByPlayerId = Object.fromEntries((data.players || []).map(player => [player.id, player.personId]));

  data.playersByTeam = {};
  for(const player of data.players || []){
    (data.playersByTeam[player.teamId] ||= []).push(player);
  }
  Object.values(data.playersByTeam).forEach(list => list.sort(sortStints));

  data.playersByPersonId = {};
  for(const player of data.players || []){
    (data.playersByPersonId[player.personId] ||= []).push(player);
  }
  Object.values(data.playersByPersonId).forEach(list => list.sort(sortStints));

  data.currentPlayerByPersonId = {};
  for(const [personId, stints] of Object.entries(data.playersByPersonId)){
    data.currentPlayerByPersonId[personId] = stints[0] || null;
  }

  data.playerBiosByPersonId = {};
  for(const [playerId, bio] of Object.entries(data.playerBios || {})){
    const player = data.playerById[playerId];
    const personId = bio.personId || player?.personId || playerId;
    const current = data.playerBiosByPersonId[personId];
    if(!current){
      data.playerBiosByPersonId[personId] = bio;
      continue;
    }
    const currentOrder = eventOrderValue(current.startEventId);
    const nextOrder = eventOrderValue(bio.startEventId);
    if(nextOrder > currentOrder || (nextOrder === currentOrder && Number(bio.active) > Number(current.active))){
      data.playerBiosByPersonId[personId] = bio;
    }
  }

  data.playerAgg = {};
  data.playerAggByPersonId = {};
  for(const row of data.playerStats || []){
    const player = data.playerById[row.playerId];
    const rawKey = row.playerId;
    const personId = player?.personId || rawKey;
    const playerTeamId = row.teamId || player?.teamId || '';

    const rawAgg = data.playerAgg[rawKey] ||= {
      playerId: rawKey,
      personId,
      name: player?.name || rawKey,
      teamId: playerTeamId,
      kills: 0,
      deaths: 0,
      damage: 0,
      assists: 0,
      maps: 0
    };
    rawAgg.kills += Number(row.kills || 0);
    rawAgg.deaths += Number(row.deaths || 0);
    rawAgg.damage += Number(row.damage || 0);
    rawAgg.assists += Number(row.assists || 0);
    rawAgg.maps += 1;

    const currentStint = data.currentPlayerByPersonId[personId] || player || {};
    const personAgg = data.playerAggByPersonId[personId] ||= {
      personId,
      playerId: currentStint.id || rawKey,
      name: currentStint.name || player?.name || rawKey,
      teamId: currentStint.teamId || playerTeamId,
      kills: 0,
      deaths: 0,
      damage: 0,
      assists: 0,
      maps: 0,
      rawPlayerIds: new Set()
    };
    personAgg.kills += Number(row.kills || 0);
    personAgg.deaths += Number(row.deaths || 0);
    personAgg.damage += Number(row.damage || 0);
    personAgg.assists += Number(row.assists || 0);
    personAgg.maps += 1;
    personAgg.rawPlayerIds.add(rawKey);
  }

  data.playerAggList = Object.values(data.playerAgg).map(player => ({
    ...player,
    kd: player.deaths ? player.kills / player.deaths : player.kills,
    dmgPerMap: player.maps ? player.damage / player.maps : 0
  }));

  data.playerAggListByPerson = Object.values(data.playerAggByPersonId).map(player => ({
    ...player,
    rawPlayerIds: Array.from(player.rawPlayerIds || []),
    kd: player.deaths ? player.kills / player.deaths : player.kills,
    dmgPerMap: player.maps ? player.damage / player.maps : 0
  }));

  data.teamPoints = {};
  for(const row of data.points || []){
    data.teamPoints[row.teamId] = (data.teamPoints[row.teamId] || 0) + Number(row.pts || 0);
  }

  data.teamRecords = {};
  for(const match of data.matches || []){
    const maps = data.mapsByMatch[match.id] || [];
    const explicitScore1 = Number(match.seriesScore1 ?? 0);
    const explicitScore2 = Number(match.seriesScore2 ?? 0);
    const hasExplicit = match.seriesScore1 !== undefined || match.seriesScore2 !== undefined;
    const score1 = hasExplicit ? explicitScore1 : maps.filter(map => map.winner === match.team1Id).length;
    const score2 = hasExplicit ? explicitScore2 : maps.filter(map => map.winner === match.team2Id).length;

    const rec1 = data.teamRecords[match.team1Id] ||= { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
    const rec2 = data.teamRecords[match.team2Id] ||= { wins: 0, losses: 0, mapWins: 0, mapLosses: 0, recent: [] };
    rec1.mapWins += score1;
    rec1.mapLosses += score2;
    rec2.mapWins += score2;
    rec2.mapLosses += score1;

    if(score1 || score2){
      const t1Win = score1 > score2;
      rec1[t1Win ? 'wins' : 'losses'] += 1;
      rec2[t1Win ? 'losses' : 'wins'] += 1;
      rec1.recent.unshift(t1Win ? 'W' : 'L');
      rec2.recent.unshift(t1Win ? 'L' : 'W');
    }
  }
  for(const record of Object.values(data.teamRecords)){
    record.recent = record.recent.slice(0, 5);
  }

  return data;
}
