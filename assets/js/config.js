export const APP_CONFIG = {
  appName: 'Iron Sight Stats',
  shortName: 'ISS',
  versionLabelFallback: 'Public Build',
  defaultSection: 'dashboard',
  featureFlags: {
    enableMatchup: true,
    enableMobileDrawer: true,
    enableVersionBadge: true,
  },
  sections: [
    { id: 'dashboard', label: 'Dashboard', hash: '#dashboard', enabled: true },
    { id: 'standings', label: 'Standings', hash: '#standings', enabled: true },
    { id: 'matches', label: 'Matches', hash: '#matches', enabled: true },
    { id: 'players', label: 'Players', hash: '#players', enabled: true },
    { id: 'teams', label: 'Teams', hash: '#teams', enabled: true },
    { id: 'betting', label: 'Betting Lab', hash: '#betting', enabled: true },
    { id: 'brackets', label: 'Brackets', hash: '#brackets', enabled: true },
    { id: 'matchup', label: 'Matchup', hash: '#matchup', enabled: true },
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
    manifest: './data/manifest.json',
  },
};

export const SECTION_META = {
  dashboard: {
    title: 'Dashboard',
    description: 'Public-facing landing page for snapshots, featured data, and fast navigation.',
  },
  standings: {
    title: 'Standings',
    description: 'League table, points context, and ranking structure for the public build.',
  },
  matches: {
    title: 'Matches',
    description: 'Series browser and match-detail foundation for event and map-by-map viewing.',
  },
  players: {
    title: 'Players',
    description: 'Public player explorer with searchable stats and cleaner mobile presentation.',
  },
  teams: {
    title: 'Teams',
    description: 'Team pages, roster context, logos, and team-stat visual destinations.',
  },
  betting: {
    title: 'Betting Lab',
    description: 'Flagship public analysis section for matchup and betting-oriented insight.',
  },
  brackets: {
    title: 'Brackets',
    description: 'Major bracket viewer hooks and tournament navigation entry point.',
  },
  matchup: {
    title: 'Matchup',
    description: 'Team-vs-team comparison area reserved for the public matchup experience.',
  },
};
