function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getLogoPath(teamId) {
  return `./assets/img/logos/${slugify(teamId)}.png`;
}

export function getPlayerImageCandidates(teamId, playerName) {
  const team = slugify(teamId);
  const player = slugify(playerName);
  return [
    `./assets/img/players/${team}/${player}.png`,
    `./assets/img/players/${team}/${player}.webp`,
    `./assets/img/players/${team}/${player}.jpg`,
    `./assets/img/players/${team}/${player}.jpeg`,
  ];
}

export function getTeamStatImagePath(teamId, fileKey) {
  return `./assets/img/team-stats/${slugify(teamId)}/${slugify(fileKey)}.png`;
}

export function getBrandingPath(fileName = 'logo.png') {
  return `./assets/img/branding/${fileName}`;
}

export function initials(value, max = 2) {
  const parts = String(value || '').split(/\s+/).filter(Boolean);
  return parts.slice(0, max).map((part) => part[0]?.toUpperCase() || '').join('') || 'IS';
}
