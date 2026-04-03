// Robust asset path helpers for GitHub Pages project sites.
// Backward-compatible named exports included.

const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg', 'svg', 'PNG', 'WEBP', 'JPG', 'JPEG', 'SVG'];

const TEAM_ALIASES = {
  'atlanta faze': 'faze',
  'atlanta-faze': 'faze',
  'faze': 'faze',
  'carolina ravens': 'ravens',
  'miami heretics': 'miami',
  'la thieves': 'lat',
  'los angeles thieves': 'lat',
  'optic texas': 'optic',
  'op tic texas': 'optic',
  'toronto ultra': 'toronto',
  'cloud9 ny': 'c9',
  'cloud9': 'c9',
  'vancouver surge': 'vancouver',
  'vegas falcons': 'falcons',
  'g2 esports': 'g2',
  'boston breach': 'boston',
  'paris gaming': 'pgm'
};

const PLAYER_ALIASES = {
  'joedeceives': ['joedeceives', 'joe deceives', 'joe-deceives'],
  'mercules': ['mercules', 'mercules'],
  'mettalz': ['mettalz', 'mettalz'],
  'renkor': ['renkor', 'renkoR', 'renkorr'],
  'lynnz': ['lynnz'],
  'hydra': ['hydra'],
  'shotzzy': ['shotzzy'],
  'dashy': ['dashy'],
  'simp': ['simp'],
  'abezy': ['abezy', 'aBeZy'],
  'scrap': ['scrap'],
  'envoy': ['envoy']
};

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[_]+/g, ' ')
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ');
}

export function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function normalizeTeamId(teamId) {
  const raw = normalizeText(teamId);
  return TEAM_ALIASES[raw] || slugify(raw);
}

function playerVariants(player) {
  const base = slugify(player).replace(/-/g, '');
  const aliasSet = new Set([
    slugify(player),
    base,
    normalizeText(player).replace(/\s+/g, '-'),
    normalizeText(player).replace(/\s+/g, ''),
  ]);
  if (PLAYER_ALIASES[base]) {
    PLAYER_ALIASES[base].forEach(v => {
      aliasSet.add(slugify(v));
      aliasSet.add(normalizeText(v).replace(/\s+/g, '-'));
      aliasSet.add(normalizeText(v).replace(/\s+/g, ''));
    });
  }
  return Array.from(aliasSet).filter(Boolean);
}

function teamVariants(teamId) {
  const normalized = normalizeTeamId(teamId);
  const raw = slugify(teamId);
  return Array.from(new Set([normalized, raw, normalizeText(teamId).replace(/\s+/g, '-'), normalizeText(teamId).replace(/\s+/g, '')])).filter(Boolean);
}

function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export function brandingPath(fileName = 'logo.png') {
  return `./assets/img/branding/${fileName}`;
}

export function teamLogoCandidates(teamId) {
  const teams = teamVariants(teamId);
  const candidates = [];
  for (const team of teams) {
    for (const ext of IMAGE_EXTENSIONS) {
      candidates.push(`./assets/img/logos/${team}.${ext}`);
    }
  }
  // Generic fallbacks
  candidates.push('./assets/img/branding/logo.png');
  return unique(candidates);
}

export function teamLogoPath(teamId) {
  return teamLogoCandidates(teamId)[0];
}

export function playerImageCandidates(teamId, playerName) {
  const teams = teamVariants(teamId);
  const players = playerVariants(playerName);
  const candidates = [];
  for (const team of teams) {
    for (const player of players) {
      for (const ext of IMAGE_EXTENSIONS) {
        candidates.push(`./assets/img/players/${team}/${player}.${ext}`);
      }
    }
  }
  return unique(candidates);
}

export function playerImagePath(teamId, playerName) {
  return playerImageCandidates(teamId, playerName)[0] || brandingPath('logo.png');
}

export function teamStatCandidates(teamId, statKey) {
  const teams = teamVariants(teamId);
  const stats = [
    slugify(statKey),
    normalizeText(statKey).replace(/\s+/g, '-'),
    normalizeText(statKey).replace(/\s+/g, ''),
  ];
  const candidates = [];
  for (const team of teams) {
    for (const stat of unique(stats)) {
      for (const ext of IMAGE_EXTENSIONS) {
        candidates.push(`./assets/img/team-stats/${team}/${stat}.${ext}`);
      }
    }
  }
  return unique(candidates);
}

export function teamStatPath(teamId, statKey) {
  return teamStatCandidates(teamId, statKey)[0] || brandingPath('logo.png');
}

// Backward-compatible aliases:
export const getTeamLogoCandidates = teamLogoCandidates;
export const getTeamLogoPath = teamLogoPath;
export const getPlayerImageCandidates = playerImageCandidates;
export const getPlayerImagePath = playerImagePath;
export const getTeamStatCandidates = teamStatCandidates;
export const getTeamStatPath = teamStatPath;
