(function (window) {
  'use strict';

  function fallback(value, fallbackValue) {
    if (value === undefined || value === null || value === '') {
      return fallbackValue || '—';
    }
    return value;
  }

  function formatNumber(value, digits) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
    const num = Number(value);
    return typeof digits === 'number' ? num.toFixed(digits) : String(num);
  }

  function formatPercent(value, digits) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(typeof digits === 'number' ? digits : 1) + '%';
  }

  function formatMode(mode) {
    const normalized = String(mode || '').toUpperCase();
    return ({ HP: 'Hardpoint', SND: 'Search & Destroy', OL: 'Overload' })[normalized] || fallback(mode);
  }

  function formatSeries(format) {
    if (!format) return '—';
    const normalized = String(format).toUpperCase();
    if (normalized === 'BO5') return 'Best of 5';
    if (normalized === 'BO7') return 'Best of 7';
    return normalized;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      const plain = new Date(String(value) + 'T12:00:00');
      if (Number.isNaN(plain.getTime())) return String(value);
      return plain.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(dateValue, timeValue) {
    const dateText = formatDate(dateValue);
    if (!timeValue) return dateText;
    return dateText + ' • ' + timeValue;
  }

  function formatRecord(wins, losses) {
    if (wins === undefined && losses === undefined) return '—';
    return String(wins || 0) + '-' + String(losses || 0);
  }

  window.ISSFormatters = {
    fallback,
    formatNumber,
    formatPercent,
    formatMode,
    formatSeries,
    formatDate,
    formatDateTime,
    formatRecord
  };
})(window);
