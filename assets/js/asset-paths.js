import { slugify } from './formatters.js';

const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

function buildCandidates(basePath) {
  return IMAGE_EXTENSIONS.map(ext => `${basePath}.${ext}`);
}

export function teamLogoCandidates(teamId) {
  return buildCandidates(`./assets/img/logos/${slugify(teamId)}`);
}

export function teamLogoPath(teamId) {
  return teamLogoCandidates(teamId)[0];
}

export function playerImageCandidates(teamId, playerSlug) {
  return buildCandidates(`./assets/img/players/${slugify(teamId)}/${slugify(playerSlug)}`);
}

export function playerImagePath(teamId, playerSlug) {
  return playerImageCandidates(teamId, playerSlug)[0];
}

export function teamStatCandidates(teamId, statKey) {
  return buildCandidates(`./assets/img/team-stats/${slugify(teamId)}/${slugify(statKey)}`);
}

export function teamStatPath(teamId, statKey) {
  return teamStatCandidates(teamId, statKey)[0];
}

export function brandingPath(file = 'logo') {
  return `./assets/img/branding/${file}.png`;
}
