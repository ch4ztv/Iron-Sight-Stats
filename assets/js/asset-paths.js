const exts = ['png','webp','jpg','jpeg','svg'];

function clean(value=''){
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g,'')
    .replace(/\./g,'')
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function variants(value=''){
  const base = clean(value);
  if (!base) return [];
  const set = new Set([base, base.replace(/-/g,''), base.replace(/-/g,'_')]);
  if (base === 'joe-deceives') { set.add('joedeceives'); set.add('joe-deceives'); }
  if (base === 'mercules') { set.add('mercules'); set.add('mercu-les'); }
  if (base === 'mettalz') { set.add('mettalz'); }
  if (base === 'renkor') { set.add('renkor'); }
  return [...set];
}

export function brandingPath(name='logo.png'){
  return `./assets/img/branding/${name}`;
}

export function teamLogoCandidates(teamId){
  const ids = variants(teamId);
  const out = [];
  ids.forEach(id => exts.forEach(ext => out.push(`./assets/img/logos/${id}.${ext}`)));
  return out;
}

export function teamLogoPath(teamId){
  return teamLogoCandidates(teamId)[0];
}

export function playerImageCandidates(teamId, playerName=''){
  const teamIds = variants(teamId);
  const playerIds = variants(playerName);
  const out = [];
  teamIds.forEach(team => {
    playerIds.forEach(player => {
      exts.forEach(ext => out.push(`./assets/img/players/${team}/${player}.${ext}`));
    });
  });
  return out;
}

export function playerImagePath(teamId, playerName=''){
  return playerImageCandidates(teamId, playerName)[0];
}

export function teamStatCandidates(teamId, statKey='overall'){
  const teamIds = variants(teamId);
  const statMap = {
    overall: ['overall'],
    hardpoint: ['hardpoint'],
    snd: ['snd', 'search-and-destroy'],
    overload: ['overload'],
    maprecords: ['map-records'],
    picksvetos: ['picks-vetoes'],
  };
  const statIds = statMap[String(statKey).toLowerCase()] || variants(statKey);
  const out = [];
  teamIds.forEach(team => {
    statIds.forEach(stat => {
      exts.forEach(ext => out.push(`./assets/img/team-stats/${team}/${stat}.${ext}`));
    });
  });
  return out;
}

export function teamStatPath(teamId, statKey='overall'){
  return teamStatCandidates(teamId, statKey)[0];
}

// Backward compatible alias
export const teamStatImageCandidates = teamStatCandidates;
