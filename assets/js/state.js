const state = {
  isLoading: false,
  isReady: false,
  hasError: false,
  currentSection: 'dashboard',
  previousSection: null,
  mobileNavOpen: false,
  data: {
    meta: null,
    season: null,
    matches: [],
    maps: [],
    players: [],
    playerStats: [],
    points: [],
    bracketData: null,
    teamStats: [],
    bprCoefficients: null,
    manifest: null,
  },
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(getState()));
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch) {
  Object.assign(state, patch);
  notify();
}

export function setData(key, value) {
  state.data[key] = value;
  notify();
}

export function mergeData(patch) {
  state.data = { ...state.data, ...patch };
  notify();
}

export function setCurrentSection(section) {
  state.previousSection = state.currentSection;
  state.currentSection = section;
  notify();
}

export function setLoading(isLoading) {
  state.isLoading = isLoading;
  notify();
}

export function setError(hasError) {
  state.hasError = hasError;
  notify();
}

export function setReady(isReady) {
  state.isReady = isReady;
  notify();
}

export function setMobileNavOpen(isOpen) {
  state.mobileNavOpen = isOpen;
  notify();
}
