import { APP_CONFIG } from './config.js';
import { setData } from './state.js';

async function fetchJson(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function loadAllData() {
  const entries = Object.entries(APP_CONFIG.dataFiles);
  await Promise.all(entries.map(async ([key, path]) => {
    const fallback = key === 'meta' || key === 'manifest' ? null : [];
    const value = await fetchJson(path, fallback);
    setData(key, value);
  }));
}
