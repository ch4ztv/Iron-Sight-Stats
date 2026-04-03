export const APP_CONFIG = {
  name: 'Iron Sight Stats',
  shortName: 'ISS',
  defaultSection: 'dashboard',
  featureFlags: {
    matchup: true,
    brackets: true,
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
  bracketPages: {
    major1: './brackets/major-1.html',
    major2: './brackets/major-2.html',
  }
};

export const MODE_LABELS = {
  HP: 'Hardpoint',
  SND: 'Search & Destroy',
  OL: 'Overload',
};

export const EVENT_LABELS = {
  M1Q: 'Major 1 Qualifiers',
  M1T: 'Major 1',
  M2Q: 'Major 2 Qualifiers',
  M2T: 'Major 2',
};
