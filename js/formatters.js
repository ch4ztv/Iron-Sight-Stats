export function fmtDate(dateStr){
  if(!dateStr) return '-';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

export function fmtNum(v, digits=0){
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined,{maximumFractionDigits:digits, minimumFractionDigits:digits})
    : '-';
}

export function fmtPct(v, digits=1){
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '-';
}

export function safeKD(k,d){
  return d ? (k/d) : k;
}

export function modeLabel(mode){
  return ({HP:'Hardpoint',SND:'Search & Destroy',OL:'Overload'})[mode] || mode || '-';
}

export function formatSeries(match){
  const s1 = match.seriesScore1 ?? '';
  const s2 = match.seriesScore2 ?? '';
  return (s1 !== '' && s2 !== '') ? `${s1}-${s2}` : match.format;
}
