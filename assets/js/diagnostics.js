(function () {
  const results = [];
  const check = (label, ok, details = '') => {
    results.push({ label, ok, details });
  };

  const requiredPaths = [
    './data/meta.json',
    './data/matches.json',
    './data/maps.json',
    './data/players.json',
    './data/player-stats.json',
    './data/points.json',
    './data/team-stats.json',
    './data/bracket-data.json',
    './data/isr-config.json',
    './data/rulesets.json',
    './brackets/major-1.html',
    './brackets/major-2.html',
    './brackets/minor-1.html'
  ];

  async function runDiagnostics() {
    for (const path of requiredPaths) {
      try {
        const res = await fetch(path, { method: 'GET' });
        check(path, res.ok, `${res.status} ${res.statusText}`);
      } catch (err) {
        check(path, false, err instanceof Error ? err.message : String(err));
      }
    }

    console.group('Iron Sight Stats diagnostics');
    for (const item of results) {
      const fn = item.ok ? console.log : console.warn;
      fn(`${item.ok ? 'OK' : 'FAIL'} ${item.label}${item.details ? ` - ${item.details}` : ''}`);
    }
    console.groupEnd();
    return results;
  }

  window.ISSRunDiagnostics = runDiagnostics;
})();
