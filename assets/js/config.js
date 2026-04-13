export const APP_CONFIG = {
  sections: ['dashboard','standings','matches','players','teams','betting','brackets','matchup'],
  defaultSection: 'dashboard',
  dataFiles: {
    meta: './data/meta.json',
    season: './data/season.json',
    matches: './data/matches.json',
    maps: './data/maps.json',
    players: './data/players.json',
    playerBios: './data/player-bios.json',
    playerStats: './data/player-stats.json',
    points: './data/points.json',
    teams: './data/teams.json',
    teamStats: './data/team-stats.json',
    bracketData: './data/bracket-data.json',
    isr: './data/isr-config.json'
  },
  teamMeta: {
    boston: {name:'Boston Breach',abbr:'BOS'},
    ravens: {name:'Carolina Royal Ravens',abbr:'CRR'},
    c9: {name:'Cloud9 New York',abbr:'C9'},
    faze: {name:'FaZe Vegas',abbr:'FAZE'},
    g2: {name:'G2 Minnesota',abbr:'G2'},
    lat: {name:'Los Angeles Thieves',abbr:'LAT'},
    miami: {name:'Miami Heretics',abbr:'MIA'},
    optic: {name:'OpTic Texas',abbr:'OPT'},
    pgm: {name:'Paris Gentle Mates',abbr:'PGM'},
    falcons: {name:'Riyadh Falcons',abbr:'RF'},
    toronto: {name:'Toronto KOI',abbr:'TOR'},
    vancouver: {name:'Vancouver Surge',abbr:'VAN'}
  }
};
