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
    rulesets: './data/rulesets.json',
    isr: './data/isr-config.json'
  },
  eventMeta: {
    M1Q: { label: 'Major 1 Qualifiers', order: 10 },
    M1T: { label: 'Major 1 Tournament', order: 20 },
    M2Q: { label: 'Major 2 Qualifiers', order: 30 },
    M2T: { label: 'Major 2 Tournament', order: 40 },
    M3Q: { label: 'Major 3 Qualifiers', order: 50 },
    MI1: { label: 'Minor 1', order: 55 },
    M3T: { label: 'Major 3 Tournament', order: 60 },
    M4Q: { label: 'Major 4 Qualifiers', order: 70 },
    MI2: { label: 'Minor 2', order: 75 },
    M4T: { label: 'Major 4 Tournament', order: 80 },
    CHAMPS: { label: 'Championship Weekend', order: 90 },
    EWC: { label: 'Esports World Cup', order: 100 }
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
