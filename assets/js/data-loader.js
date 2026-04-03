(function (window) {
  'use strict';

  async function fetchJson(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) {
      throw new Error('Failed to load ' + path + ' (' + response.status + ')');
    }
    return response.json();
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  async function loadPublicData() {
    const config = window.ISSConfig;
    const state = window.ISSState;
    const ui = window.ISSUI;

    if (!config || !state) {
      throw new Error('Config or state not initialized before data load.');
    }

    const files = config.dataFiles || {};
    const entries = Object.entries(files);
    const results = {};
    const warnings = [];

    ui && ui.setStatusMessage('Loading public data…', 'loading');
    state.merge({ isLoading: true, hasError: false });

    for (const [key, path] of entries) {
      try {
        results[key] = await fetchJson(path, { cache: 'no-store' });
      } catch (error) {
        results[key] = null;
        warnings.push(error.message);
      }
    }

    const normalized = {
      meta: ensureObject(results.meta),
      season: ensureObject(results.season),
      matches: ensureArray(results.matches),
      maps: ensureArray(results.maps),
      players: ensureArray(results.players),
      playerStats: ensureArray(results.playerStats),
      points: ensureArray(results.points),
      bracketData: ensureArray(results.bracketData),
      teamStats: ensureArray(results.teamStats),
      bprCoefficients: ensureObject(results.bprCoefficients),
      manifest: ensureObject(results.manifest),
      warnings
    };

    state.merge({
      data: normalized,
      isLoading: false,
      isReady: true,
      hasError: false
    });

    if (ui) {
      if (warnings.length) {
        ui.setStatusMessage('Loaded with ' + warnings.length + ' warning' + (warnings.length === 1 ? '' : 's') + '.', 'warning');
      } else {
        ui.setStatusMessage('Public data loaded.', 'success');
      }
    }

    return normalized;
  }

  function getData() {
    const state = window.ISSState;
    return state ? state.get().data : null;
  }

  function getSummaryCounts() {
    const data = getData() || {};
    return {
      matches: ensureArray(data.matches).length,
      maps: ensureArray(data.maps).length,
      players: ensureArray(data.players).length,
      playerStats: ensureArray(data.playerStats).length,
      teamStats: ensureArray(data.teamStats).length,
      points: ensureArray(data.points).length
    };
  }

  function getMapsForMatch(matchId) {
    const data = getData() || {};
    return ensureArray(data.maps).filter((map) => String(map.matchId) === String(matchId));
  }

  window.ISSDataLoader = {
    loadPublicData,
    getData,
    getSummaryCounts,
    getMapsForMatch
  };
})(window);
