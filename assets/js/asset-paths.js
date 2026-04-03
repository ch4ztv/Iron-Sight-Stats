(function (window) {
  'use strict';

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildLogoPath(teamId) {
    return './assets/img/logos/' + normalizeToken(teamId) + '.png';
  }

  function buildPlayerCandidates(teamId, playerName) {
    const team = normalizeToken(teamId);
    const player = normalizeToken(playerName);
    return [
      './assets/img/players/' + team + '/' + player + '.png',
      './assets/img/players/' + team + '/' + player + '.webp',
      './assets/img/players/' + team + '/' + player + '.jpg',
      './assets/img/players/' + team + '/' + player + '.jpeg'
    ];
  }

  function buildTeamStatPath(teamId, statKey) {
    return './assets/img/team-stats/' + normalizeToken(teamId) + '/' + normalizeToken(statKey) + '.png';
  }

  function buildBrandingPath(fileName) {
    return './assets/img/branding/' + String(fileName || '').trim();
  }

  window.ISSAssetPaths = {
    normalizeToken,
    buildLogoPath,
    buildPlayerCandidates,
    buildTeamStatPath,
    buildBrandingPath
  };
})(window);
