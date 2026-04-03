import { sectionFrame, emptyState, statCard, selectControl } from '../ui.js';
import { titleizeSlug, formatSignedNumber, formatPercent } from '../formatters.js';
import { teamLogoCandidates, teamLogoPath } from '../asset-paths.js';

function getTeams(matches) {
  return [...new Set(matches.flatMap(match => [match.team1Id, match.team2Id]).filter(Boolean))].sort();
}

function modeKey(mode) {
  return mode === 'SND' ? 'snd' : mode === 'OL' ? 'overload' : 'hardpoint';
}

function summarizeTeam(teamId, state) {
  const maps = state.data.maps || [];
  const matches = state.data.matches || [];
  const teamStats = state.data.teamStats?.[teamId] || null;
  const relatedMaps = maps.filter(map => {
    const match = matches.find(entry => entry.id === map.matchId);
    return match && (match.team1Id === teamId || match.team2Id === teamId);
  });
  const relatedMatches = matches.filter(match => match.team1Id === teamId || match.team2Id === teamId);

  const byMode = { HP: { wins: 0, losses: 0 }, SND: { wins: 0, losses: 0 }, OL: { wins: 0, losses: 0 } };
  relatedMaps.forEach(map => {
    const match = relatedMatches.find(entry => entry.id === map.matchId);
    if (!match || !byMode[map.mode]) return;
    if (map.winner === teamId) byMode[map.mode].wins += 1;
    else byMode[map.mode].losses += 1;
  });

  const completedSeries = relatedMatches.map(match => {
    const seriesMaps = maps.filter(map => map.matchId === match.id);
    const score1 = match.seriesScore1 ?? seriesMaps.filter(map => map.winner === match.team1Id).length;
    const score2 = match.seriesScore2 ?? seriesMaps.filter(map => map.winner === match.team2Id).length;
    const teamScore = match.team1Id === teamId ? score1 : score2;
    const oppScore = match.team1Id === teamId ? score2 : score1;
    return { ts: match.ts || 0, won: teamScore > oppScore, played: teamScore + oppScore > 0 };
  }).filter(entry => entry.played).sort((a, b) => b.ts - a.ts);

  const seriesWins = completedSeries.filter(entry => entry.won).length;
  const seriesLosses = completedSeries.filter(entry => !entry.won).length;
  const recent = completedSeries.slice(0, 5);
  const recentWinPct = recent.length ? (recent.filter(entry => entry.won).length / recent.length) * 100 : null;

  const confidence = teamStats?.confidence || '—';
  const notes = teamStats?.notes || '';
  const overallPlayers = teamStats?.overall?.players || [];
  const avgBp = overallPlayers.length ? overallPlayers.reduce((sum, p) => sum + Number(p.bpRating || 0), 0) / overallPlayers.length : null;

  return {
    teamId,
    byMode,
    seriesWins,
    seriesLosses,
    recentWinPct,
    confidence,
    notes,
    avgBp,
    imageCount: teamStats?.imageCount ?? 0
  };
}

export function renderBetting(container, state) {
  const coefficients = state.data.bprCoefficients || {};
  const matches = state.data.matches || [];
  const teams = getTeams(matches);
  const selected = state.currentBettingTeam && teams.includes(state.currentBettingTeam) ? state.currentBettingTeam : teams[0];
  const summary = selected ? summarizeTeam(selected, state) : null;

  const coefficientCards = ['HP', 'SND', 'OL'].map(mode => {
    const entry = coefficients?.[mode] || {};
    return statCard(`${mode} Model`, `${entry.b1 ?? '—'} / ${entry.b2 ?? '—'}`, `σ ${entry.sigma ?? '—'}`);
  }).join('');

  const modeRows = summary ? Object.entries(summary.byMode).map(([mode, record]) => {
    const total = record.wins + record.losses;
    const pct = total ? formatPercent((record.wins / total) * 100, 0) : '—';
    return `
      <tr>
        <td>${mode}</td>
        <td>${record.wins}-${record.losses}</td>
        <td>${formatSignedNumber(record.wins - record.losses)}</td>
        <td>${pct}</td>
      </tr>
    `;
  }).join('') : '';

  container.innerHTML = `
    <div class="section-stack">
      <div class="grid-3 betting-top-grid">${coefficientCards}</div>

      <div class="grid-2 betting-grid">
        <div class="panel"><div class="panel-body">
          ${sectionFrame('Betting Lab', 'Public-facing signals built from model coefficients, team summaries, and recent form', `
            <div class="filters-row compact">
              <label class="muted" for="betting-team-select">Team focus</label>
              ${selectControl('betting-team-select', teams.map(teamId => ({ value: teamId, label: titleizeSlug(teamId) })), selected)}
            </div>
          `)}
          ${summary ? `
            <div class="betting-team-header">
              <img class="team-logo-lg" src="${teamLogoPath(summary.teamId)}" alt="${titleizeSlug(summary.teamId)}" data-fallbacks="${teamLogoCandidates(summary.teamId).slice(1).join(',')}" />
              <div>
                <div class="eyebrow">Team focus</div>
                <h3 style="margin:6px 0 10px">${titleizeSlug(summary.teamId)}</h3>
                <div class="inline-pills">
                  <span class="pill accent">Confidence: ${summary.confidence}</span>
                  <span class="pill">Series ${summary.seriesWins}-${summary.seriesLosses}</span>
                  <span class="pill">Recent ${summary.recentWinPct === null ? '—' : formatPercent(summary.recentWinPct, 0)}</span>
                </div>
              </div>
            </div>
            <div class="grid-3 compact-stats" style="margin-top:16px">
              ${statCard('Avg BP Rating', summary.avgBp ? Number(summary.avgBp).toFixed(2) : '—', `${summary.imageCount} parsed team images`)}
              ${statCard('Recent Form', summary.recentWinPct === null ? '—' : formatPercent(summary.recentWinPct, 0), 'Last five completed series')}
              ${statCard('Team Notes', summary.notes ? 'Available' : '—', summary.notes ? 'Parser notes imported' : 'No notes provided')}
            </div>
          ` : emptyState('No team betting summary available yet.')}
        </div></div>

        <div class="panel"><div class="panel-body">
          ${sectionFrame('Mode Performance Snapshot', 'Quick read on how the selected team has performed by mode')}
          ${summary ? `
            <div class="table-wrap">
              <table>
                <thead><tr><th>Mode</th><th>Record</th><th>Diff</th><th>Win Rate</th></tr></thead>
                <tbody>${modeRows}</tbody>
              </table>
            </div>
          ` : emptyState('Mode splits will appear once a team is selected.')}
        </div></div>
      </div>
    </div>
  `;

  const select = container.querySelector('#betting-team-select');
  if (select) {
    select.addEventListener('change', () => {
      state.currentBettingTeam = select.value;
      renderBetting(container, state);
    });
  }
}
