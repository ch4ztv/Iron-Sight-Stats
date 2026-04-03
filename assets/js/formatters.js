import { EVENT_LABELS, MODE_LABELS } from './config.js';

export function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatDateTime(dateValue, timeValue = '') {
  if (!dateValue) return '—';
  return `${formatDate(dateValue)}${timeValue ? ` • ${timeValue}` : ''}`;
}

export function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(value));
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatEventLabel(eventId) {
  return EVENT_LABELS[eventId] || eventId || '—';
}

export function formatModeLabel(mode) {
  return MODE_LABELS[mode] || mode || '—';
}

export function formatSeriesLabel(format) {
  return format || 'BO5';
}

export function fallback(value, empty = '—') {
  return value === null || value === undefined || value === '' ? empty : value;
}
