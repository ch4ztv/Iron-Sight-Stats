import { APP_CONFIG } from './config.js';

async function fetchJson(url){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

export async function loadAllData(){
  const entries = await Promise.all(Object.entries(APP_CONFIG.dataFiles).map(async ([key,url]) => [key, await fetchJson(url)]));
  const data = Object.fromEntries(entries);
  data.matchesById = Object.fromEntries((data.matches || []).map(match => [match.id, match]));
  data.mapsById = Object.fromEntries((data.maps || []).map(map => [map.id, map]));
  // index maps by match
  data.mapsByMatch = {};
  for(const map of data.maps || []){
    (data.mapsByMatch[map.matchId] ||= []).push(map);
  }
  for(const list of Object.values(data.mapsByMatch)){ list.sort((a,b)=>a.mapNum-b.mapNum); }

  data.playerStatsByMap = {};
  for(const row of data.playerStats || []){
    (data.playerStatsByMap[row.mapId] ||= []).push(row);
  }

  data.playerById = Object.fromEntries((data.players||[]).map(p => [p.id,p]));
  data.playersByTeam = {};
  for(const p of data.players || []){
    (data.playersByTeam[p.teamId] ||= []).push(p);
  }
  Object.values(data.playersByTeam).forEach(arr => arr.sort((a,b)=>String(b.active).localeCompare(String(a.active)) || a.name.localeCompare(b.name)));

  data.playerAgg = {};
  for(const row of data.playerStats || []){
    const p = data.playerById[row.playerId];
    const key = row.playerId;
    const agg = data.playerAgg[key] ||= {
      playerId:key, name:p?.name || key, teamId:row.teamId || p?.teamId || '',
      kills:0,deaths:0,damage:0,assists:0,maps:0
    };
    agg.kills += Number(row.kills||0);
    agg.deaths += Number(row.deaths||0);
    agg.damage += Number(row.damage||0);
    agg.assists += Number(row.assists||0);
    agg.maps += 1;
  }
  data.playerAggList = Object.values(data.playerAgg).map(p => ({
    ...p,
    kd: p.deaths ? p.kills/p.deaths : p.kills,
    dmgPerMap: p.maps ? p.damage/p.maps : 0
  }));

  data.teamPoints = {};
  for(const row of data.points || []){
    data.teamPoints[row.teamId] = (data.teamPoints[row.teamId] || 0) + Number(row.pts || 0);
  }

  data.teamRecords = {};
  for(const m of data.matches || []){
    const maps = data.mapsByMatch[m.id] || [];
    let s1 = Number(m.seriesScore1 ?? 0), s2 = Number(m.seriesScore2 ?? 0);
    if((!m.seriesScore1 && !m.seriesScore2) && maps.length){
      s1 = maps.filter(x => x.winner === m.team1Id).length;
      s2 = maps.filter(x => x.winner === m.team2Id).length;
    }
    const rec1 = data.teamRecords[m.team1Id] ||= {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
    const rec2 = data.teamRecords[m.team2Id] ||= {wins:0,losses:0,mapWins:0,mapLosses:0,recent:[]};
    rec1.mapWins += s1; rec1.mapLosses += s2;
    rec2.mapWins += s2; rec2.mapLosses += s1;
    if(s1 || s2){
      const t1Win = s1 > s2;
      rec1[t1Win ? 'wins' : 'losses'] += 1;
      rec2[t1Win ? 'losses' : 'wins'] += 1;
      rec1.recent.unshift(t1Win ? 'W' : 'L');
      rec2.recent.unshift(t1Win ? 'L' : 'W');
    }
  }
  for(const rec of Object.values(data.teamRecords)){ rec.recent = rec.recent.slice(0,5); }

  return data;
}
