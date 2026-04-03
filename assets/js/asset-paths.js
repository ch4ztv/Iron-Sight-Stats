function clean(val=''){
  return String(val).toLowerCase().replace(/[^a-z0-9]+/g,'');
}

export function teamLogoCandidates(teamId){
  const id = clean(teamId);
  return [
    `./assets/img/logos/${id}.png`,
    `./assets/img/logos/${id}.webp`,
    `./assets/img/logos/${id}.jpg`,
    `./assets/img/logos/${id}.jpeg`,
    `./assets/img/logos/${id}.svg`
  ];
}
export function teamLogoPath(teamId){
  return teamLogoCandidates(teamId)[0];
}
export function playerImageCandidates(teamId, playerName){
  const team = clean(teamId);
  const player = clean(playerName);
  return [
    `./assets/img/players/${team}/${player}.png`,
    `./assets/img/players/${team}/${player}.webp`,
    `./assets/img/players/${team}/${player}.jpg`,
    `./assets/img/players/${team}/${player}.jpeg`
  ];
}
export function playerImagePath(teamId, playerName){
  return playerImageCandidates(teamId, playerName)[0];
}
export function teamStatCandidates(teamId, key){
  const team = clean(teamId);
  return [
    `./assets/img/team-stats/${team}/${key}.png`,
    `./assets/img/team-stats/${team}/${key}.webp`,
    `./assets/img/team-stats/${team}/${key}.jpg`,
    `./assets/img/team-stats/${team}/${key}.jpeg`
  ];
}
export function teamStatPath(teamId, key){
  return teamStatCandidates(teamId, key)[0];
}
export function brandingPath(name='logo.png'){
  return `./assets/img/branding/${name}`;
}
