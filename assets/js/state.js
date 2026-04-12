export const state = {
  data: {},
  currentSection: 'dashboard',
  ui: {
    selectedTeam: 'optic',
    selectedTeamB: 'faze',
    teamStatsTab: 'overall',
    teamShowInactive: false,
    matchFilter: 'all',
    matchEvent: 'all',
    matchSearch: '',
    matchExpandedId: null,
    matchStatsTab: 'series',
    playerSearch: '',
    playerSort: 'ovr',
    bettingTeam: 'optic',
    bettingPlayerId: '',
    bettingOpponent: 'all',
    bettingEvent: 'all',
    bettingMode: 'all',
    bettingMarket: 'seriesKills',
    bettingLine: '',
    bettingMapName: 'all',
    bettingMapStat: 'kills'
  }
};

export function setData(next){ state.data = next; }
export function setSection(section){ state.currentSection = section; }
export function setUI(key,val){ state.ui[key]=val; }
