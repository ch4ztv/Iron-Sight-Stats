import { sectionFrame, emptyState } from '../ui.js';
import { titleizeSlug, slugify } from '../formatters.js';
import { playerImageCandidates, playerImagePath, teamLogoCandidates, teamLogoPath, teamStatCandidates, teamStatPath } from '../asset-paths.js';

function getUniqueTeams(matches) {
  return [...new Set(matches.flatMap(m => [m.team1Id, m.team2Id]).filter(Boolean))].sort();
}
function getTeamRoster(teamId, players) {
  return players.filter(player => (player.teamId || player.team || player.teamSlug) === teamId);
}
function playerName(player) {
  return player.displayName || player.name || player.playerName || player.id || 'Unknown';
}
function playerSlug(player) {
  return slugify(player.slug || player.id || playerName(player));
}

export function renderTeams(container, state) {
  const teams = getUniqueTeams(state.data.matches || []);
  const selected = state.currentTeamView && teams.includes(state.currentTeamView) ? state.currentTeamView : teams[0];
  const roster = getTeamRoster(selected, state.data.players || []);
  const importedTeamStats = state.data.teamStats?.[selected] || null;
  const confidence = importedTeamStats?.confidence || '—';

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel"><div class="panel-body">
        ${sectionFrame('Teams', 'Team pages with roster view, stat-image hooks, and imported parser metadata')}
        <div class="filters-row">
          <label class="muted" for="team-select">Choose team</label>
          <select id="team-select" class="control">
            ${teams.map(teamId => `<option value="${teamId}" ${teamId === selected ? 'selected' : ''}>${titleizeSlug(teamId)}</option>`).join('')}
          </select>
        </div>

        ${selected ? `
          <div class="team-card hero-card">
            <div class="team-hero">
              <img class="team-logo-lg" src="${teamLogoPath(selected)}" alt="${titleizeSlug(selected)}" data-fallbacks="${teamLogoCandidates(selected).slice(1).join(',')}" />
              <div>
                <div class="eyebrow">Team Overview</div>
                <h3 style="margin:6px 0 8px">${titleizeSlug(selected)}</h3>
                <div class="inline-pills">
                  <span class="pill accent">Confidence: ${confidence}</span>
                  <span class="pill">Rostered: ${roster.length}</span>
                  <span class="pill">Images: ${importedTeamStats?.imageCount ?? 0}</span>
                </div>
                <p class="muted" style="margin:10px 0 0">${importedTeamStats?.notes || 'Public team page foundation with roster media and imported stat image panels.'}</p>
              </div>
            </div>
          </div>

          <div class="grid-2" style="margin-top:18px">
            <div class="panel"><div class="panel-body">
              <div class="panel-header"><div><h3 class="section-title" style="font-size:1.15rem">Roster</h3></div></div>
              ${roster.length ? `<div class="card-list">${roster.map(player => `
                <article class="player-card elevated">
                  <div class="player-row">
                    <img class="player-photo" src="${playerImagePath(selected, playerSlug(player))}" alt="${playerName(player)}" data-fallbacks="${playerImageCandidates(selected, playerSlug(player)).slice(1).concat(teamLogoCandidates(selected)).join(',')}" />
                    <div>
                      <strong>${playerName(player)}</strong>
                      <div class="muted" style="margin-top:6px">${player.role || player.position || 'Player'}</div>
                    </div>
                    <div class="muted">${player.twitter || player.handle || ''}</div>
                  </div>
                </article>
              `).join('')}</div>` : emptyState('No roster players matched this team yet.')}
            </div></div>

            <div class="panel"><div class="panel-body">
              <div class="panel-header"><div><h3 class="section-title" style="font-size:1.15rem">Imported Team Stat Images</h3></div></div>
              <div class="team-stats-grid">
                ${['overall','hardpoint','search-and-destroy','overload','map-records','picks-vetoes'].map(key => `
                  <div class="image-panel">
                    <div class="label">${key.replace(/-/g, ' ')}</div>
                    <img src="${teamStatPath(selected, key)}" alt="${titleizeSlug(selected)} ${key}" data-fallbacks="${teamStatCandidates(selected, key).slice(1).join(',')}" data-missing-label="Image not found yet" data-missing-class="empty-state compact" />
                  </div>
                `).join('')}
              </div>
            </div></div>
          </div>
        ` : emptyState('No teams found in the loaded match data.')}
      </div></div>
    </div>
  `;

  const select = container.querySelector('#team-select');
  if (select) {
    select.addEventListener('change', () => {
      state.currentTeamView = select.value;
      renderTeams(container, state);
    });
  }
}
