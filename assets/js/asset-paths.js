import { slugify } from './formatters.js';

const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];
const LOGO_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg', 'svg'];

const TEAM_SLUG_ALIASES = {
  faze: 'faze',
  optic: 'optic',
  toronto: 'toronto',
  ravens: 'ravens',
  lat: 'lat',
  miami: 'miami',
  boston: 'boston',
  c9: 'c9',
  falcons: 'falcons',
  g2: 'g2',
  pgm: 'pgm',
  vancouver: 'vancouver'
};

function normalizeTeamSlug(teamId) {
  const raw = slugify(teamId);
  return TEAM_SLUG_ALIASES[raw] || raw;
}

function buildCandidates(basePath, extensions = IMAGE_EXTENSIONS) {
  return extensions.map(ext => `${basePath}.${ext}`);
}

export function teamLogoCandidates(teamId) {
  return buildCandidates(`./assets/img/logos/${normalizeTeamSlug(teamId)}`, LOGO_EXTENSIONS);
}

export function teamLogoPath(teamId) {
  return teamLogoCandidates(teamId)[0] || '';
}

export function playerImageCandidates(teamId, playerSlug) {
  return buildCandidates(`./assets/img/players/${normalizeTeamSlug(teamId)}/${slugify(playerSlug)}`);
}

export function playerImagePath(teamId, playerSlug) {
  return playerImageCandidates(teamId, playerSlug)[0] || '';
}

export function teamStatCandidates(teamId, statKey) {
  return buildCandidates(`./assets/img/team-stats/${normalizeTeamSlug(teamId)}/${slugify(statKey)}`);
}

export function teamStatPath(teamId, statKey) {
  return teamStatCandidates(teamId, statKey)[0] || '';
}

export function brandingCandidates(file = 'logo') {
  return buildCandidates(`./assets/img/branding/${slugify(file)}`, LOGO_EXTENSIONS);
}

export function brandingPath(file = 'logo') {
  return brandingCandidates(file)[0] || '';
}

// Backward-compatible aliases for any earlier helper names.
export const getLogoCandidates = teamLogoCandidates;
export const getPlayerCandidates = playerImageCandidates;
export const getTeamStatCandidates = teamStatCandidates;
export const getBrandingCandidates = brandingCandidates;
