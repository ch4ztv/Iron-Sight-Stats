export const state = {
  data: {},
  currentSection: 'dashboard',
  ui: {
    selectedTeam: 'optic',
    selectedTeamB: 'faze',
    matchupTeamA: 'optic',
    matchupTeamB: 'faze',
    matchupFormat: 'BO5',
    matchupFocus: 'odds',
    selectedBracket: 'major-1',
    bracketViewerOpen: false,
    bracketViewerMaximized: false,
    bracketViewerX: 56,
    bracketViewerY: 92,
    teamStatsTab: 'overall',
    teamShowInactive: false,
    matchFilter: 'all',
    matchEvent: 'all',
    matchSearch: '',
    matchExpandedId: null,
    matchStatsTab: 'series',
    playerSearch: '',
    playerSort: 'isr',
    playerSortDir: 'desc',
    playerEvent: 'all',
    playerTeamFilter: 'all',
    playerMode: 'all',
    playerShowInactive: false,
    playerModalId: null,
    bettingTeam: 'optic',
    bettingPlayerId: '',
    bettingOpponent: 'all',
    bettingEvent: 'all',
    bettingMode: 'all',
    bettingMarket: 'maps123Kills',
    bettingMarketSync: '',
    bettingLine: '',
    bettingMapName: 'all',
    bettingMapSlot: 'all',
    bettingMapStat: 'kills'
  }
};

export function setData(next){ state.data = next; }
export function setSection(section){ state.currentSection = section; }
export function setUI(key,val){ state.ui[key]=val; }
