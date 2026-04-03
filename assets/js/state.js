const state = {
  isLoading: false,
  isReady: false,
  hasError: false,
  currentSection: 'dashboard',
  mobileNavOpen: false,
  data: {
    meta: null,
    season: null,
    matches: [],
    maps: [],
    players: [],
    playerStats: [],
    points: [],
    bracketData: [],
    teamStats: [],
    bprCoefficients: [],
    manifest: null
  }
};
export function getState() { return state; }
export function patchState(partial) { Object.assign(state, partial); }
export function setData(key, value) { state.data[key] = value; }
