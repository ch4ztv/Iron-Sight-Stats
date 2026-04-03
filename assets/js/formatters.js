export function formatMode(mode) {
  const map = { HP: 'Hardpoint', SND: 'Search & Destroy', OL: 'Overload' };
  return map[mode] || mode || '—';
}
export function formatEvent(eventId) {
  const map = { M1Q: 'Major 1 Qualifiers', M1T: 'Major 1', M2Q: 'Major 2 Qualifiers', M2T: 'Major 2' };
  return map[eventId] || eventId || 'Event';
}
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function safe(value, fallback = '—') {
  return value === undefined || value === null || value === '' ? fallback : value;
}
export function titleizeSlug(slug) {
  if (!slug) return 'Unknown';
  const overrides = { faze: 'Atlanta FaZe', optic: 'OpTic Texas', lat: 'LA Thieves', c9: 'Cloud9', pgm: 'Paris Gaming', toronto: 'Toronto Ultra', ravens: 'Carolina Ravens', miami: 'Miami Heretics', boston: 'Boston Breach', falcons: 'Vegas Falcons', vancouver: 'Vancouver Surge', g2: 'G2' };
  return overrides[slug] || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
