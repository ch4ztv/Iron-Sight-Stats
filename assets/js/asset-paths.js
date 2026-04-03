(function () {
  const IMG_BASE = './assets/img';

  const fallbackTeamNames = {
    faze: 'atlanta-faze',
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

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function teamSlug(teamId) {
    return fallbackTeamNames[teamId] || slugify(teamId);
  }

  function buildCandidates(basePath, exts) {
    return exts.map(ext => `${basePath}.${ext}`);
  }

  function getLogoCandidates(teamId) {
    const slug = teamSlug(teamId);
    return buildCandidates(`${IMG_BASE}/logos/${slug}`, ['png', 'webp', 'jpg', 'jpeg', 'svg']);
  }

  function getPlayerCandidates(teamId, playerName) {
    const team = teamSlug(teamId);
    const player = slugify(playerName);
    return buildCandidates(`${IMG_BASE}/players/${team}/${player}`, ['png', 'webp', 'jpg', 'jpeg']);
  }

  function getTeamStatCandidates(teamId, statKey) {
    const team = teamSlug(teamId);
    const stat = slugify(statKey);
    return buildCandidates(`${IMG_BASE}/team-stats/${team}/${stat}`, ['png', 'webp', 'jpg', 'jpeg']);
  }

  function getBrandingCandidates(name) {
    return buildCandidates(`${IMG_BASE}/branding/${slugify(name)}`, ['png', 'webp', 'jpg', 'jpeg', 'svg']);
  }

  function pickFirstImage(candidates, fallback = '') {
    return Array.isArray(candidates) && candidates.length ? candidates[0] : fallback;
  }

  window.ISSAssetPaths = {
    slugify,
    teamSlug,
    getLogoCandidates,
    getPlayerCandidates,
    getTeamStatCandidates,
    getBrandingCandidates,
    pickFirstImage
  };
})();
