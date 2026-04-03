export const APP_CONFIG = {
  appName: 'Iron Sight Stats',
  defaultSection: 'dashboard',
  sections: [
    'dashboard','standings','matches','players','teams','betting','brackets','matchup'
  ],
  dataFiles: {
    meta: './data/meta.json',
    season: './data/season.json',
    matches: './data/matches.json',
    maps: './data/maps.json',
    players: './data/players.json',
    playerStats: './data/player-stats.json',
    points: './data/points.json',
    bracketData: './data/bracket-data.json',
    teamStats: './data/team-stats.json',
    bprCoefficients: './data/bpr-coefficients.json',
    manifest: './data/manifest.json'
  },
  brackets: [
    { id: 'major-1', dataKey: 'M1T', label: 'Major 1', href: './brackets/major-1.html' },
    { id: 'major-2', dataKey: 'M2T', label: 'Major 2', href: './brackets/major-2.html' }
  ]
};
