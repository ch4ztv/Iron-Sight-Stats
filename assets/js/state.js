const state = {
  app: {
    isLoading: false,
    isReady: false,
    hasError: false,
  },
  navigation: {
    currentSection: 'dashboard',
    previousSection: null,
    mobileNavOpen: false,
  },
  data: {
    meta: null,
    season: null,
    matches: [],
    maps: [],
    players: [],
    playerStats: [],
    points: [],
    bracketData: {},
    teamStats: [],
    bprCoefficients: {},
    manifest: null,
  },
  ui: {
    selectedTeam: null,
    selectedPlayer: null,
    searchQuery: '',
    sortKey: null,
    sortDirection: 'desc',
    expandedMatchId: null,
  },
};

export function getState() {
  return state;
}

export function updateState(path, value) {
  const keys = path.split('.');
  let target = state;
  for (let i = 0; i < keys.length - 1; i += 1) {
    target = target[keys[i]];
  }
  target[keys[keys.length - 1]] = value;
  return state;
}

export function mergeState(path, partial) {
  const keys = path.split('.');
  let target = state;
  for (let i = 0; i < keys.length; i += 1) {
    target = target[keys[i]];
  }
  Object.assign(target, partial);
  return state;
}

export function resetUiState() {
  state.ui.selectedTeam = null;
  state.ui.selectedPlayer = null;
  state.ui.searchQuery = '';
  state.ui.sortKey = null;
  state.ui.sortDirection = 'desc';
  state.ui.expandedMatchId = null;
  return state;
}
