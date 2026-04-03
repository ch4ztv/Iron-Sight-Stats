(function (window) {
  'use strict';

  function renderPlayersSection() {
    const ui = window.ISSUI;
    const loader = window.ISSDataLoader;
    const formatters = window.ISSFormatters;

    if (!ui) return;

    const labels = {
      dashboard: ['Dashboard', 'A public-facing overview of the season, recent results, and featured snapshots.'],
      standings: ['Standings', 'This section will turn your points and results data into the clean public standings table.'],
      matches: ['Matches', 'This section will show match cards, map breakdowns, and event filtering.'],
      players: ['Players', 'This section will become the searchable player stats explorer for the public app.'],
      teams: ['Teams', 'This section will power team pages, rosters, and team stat visuals.'],
      betting: ['Betting Lab', 'This section will become the flagship public betting and matchup insights area.'],
      brackets: ['Brackets', 'This section will connect the public app to your major bracket pages and tournament data.'],
      matchup: ['Matchup', 'This section is reserved for the future head-to-head comparison builder.']
    };

    const meta = labels['players'];
    const shell = ui.createSectionScaffold(meta[0], meta[1]);
    const counts = loader ? loader.getSummaryCounts() : {};

    const stats = [
      { label: 'Matches', value: String(counts.matches || 0) },
      { label: 'Maps', value: String(counts.maps || 0) },
      { label: 'Players', value: String(counts.players || 0) }
    ];

    shell.body.appendChild(ui.createStatGrid(stats));

    if ('players' === 'dashboard') {
      const details = ui.createNotice('Build Step 1B is now connected to the public JSON layer. Full section rendering comes next.');
      shell.body.appendChild(details);
    } else if ('players' === 'brackets') {
      const list = ui.createList([
        { name: 'Major 1', file: './brackets/major-1.html' },
        { name: 'Major 2', file: './brackets/major-2.html' }
      ], function (item) {
        const row = ui.createElement('div', { className: 'list-row card surface-soft' });
        row.appendChild(ui.createElement('strong', { text: item.name }));
        row.appendChild(ui.createElement('p', { text: item.file }));
        return row;
      });
      shell.body.appendChild(list);
    } else {
      shell.body.appendChild(ui.createEmptyState(meta[0] + ' module coming next', 'The shell, routing, and data layer are ready. This section will get its full public rendering in the next implementation pass.'));
    }

    ui.renderSectionMount('players', shell.wrapper);
  }

  window.ISSSections = window.ISSSections || {};
  window.ISSSections['players'] = renderPlayersSection;
})(window);
