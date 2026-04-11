export const state = {
  data: {},
  currentSection: 'dashboard',
  ui: {
    selectedTeam: 'optic',
    selectedTeamB: 'faze',
    matchFilter: 'all',
    playerSearch: '',
    playerSort: 'isr',
    bettingTeam: 'optic',
    bettingPlayerId: '',
    bettingOpponent: 'all',
    bettingEvent: 'all',
    bettingMode: 'all',
    bettingMarket: 'seriesKills',
    bettingLine: ''
  }
};

export function setData(next){ state.data = next; }
export function setSection(section){ state.currentSection = section; }
export function setUI(key,val){ state.ui[key]=val; }
