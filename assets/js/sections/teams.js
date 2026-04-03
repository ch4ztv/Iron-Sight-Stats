import { sectionFrame, emptyState } from '../ui.js';
import { titleizeSlug } from '../formatters.js';
import { playerImagePath, teamLogoPath, teamStatPath } from '../asset-paths.js';

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
  return (player.slug || player.id || playerName(player)).toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

export function renderTeams(container, state) {
  const teams = getUniqueTeams(state.data.matches || []);
  const selected = state.currentTeamView && teams.includes(state.currentTeamView) ? state.currentTeamView : teams[0];
  const roster = getTeamRoster(selected, state.data.players || []);

  container.innerHTML = `
    <div class="section-stack">
      <div class="panel"><div class="panel-body">
        ${sectionFrame('Teams', 'Team pages with roster view and stat-image hooks')}
        <div class="filters-row">
          <label class="muted" for="team-select">Choose team</label>
          <select id="team-select" class="control">
            ${teams.map(teamId => `<option value="${teamId}" ${teamId === selected ? 'selected' : ''}>${titleizeSlug(teamId)}</option>`).join('')}
          </select>
        </div>

        ${selected ? `
          <div class="team-card">
            <div class="team-hero">
              <img class="team-logo-lg" src="${teamLogoPath(selected)}" alt="${titleizeSlug(selected)}" onerror="this.style.visibility='hidden'" />
              <div>
                <div class="eyebrow">Team Overview</div>
                <h3 style="margin:6px 0 8px">${titleizeSlug(selected)}</h3>
                <p class="muted" style="margin:0">Public team page foundation with roster media and imported stat image panels.</p>
              </div>
            </div>
          </div>

          <div class="grid-2" style="margin-top:18px">
            <div class="panel"><div class="panel-body">
              <div class="panel-header"><div><h3 class="section-title" style="font-size:1.15rem">Roster</h3></div></div>
              ${roster.length ? `<div class="card-list">${roster.map(player => `
                <article class="player-card">
                  <div class="player-row">
                    <img class="player-photo" src="${playerImagePath(selected, playerSlug(player))}" alt="${playerName(player)}" onerror="this.onerror=null;this.src='${teamLogoPath(selected)}'" />
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
                ${['overall','hardpoint','search-and-destroy','overload'].map(key => `
                  <div class="image-panel">
                    <div class="label">${key.replace(/-/g, ' ')}</div>
                    <img src="${teamStatPath(selected, key)}" alt="${titleizeSlug(selected)} ${key}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'empty-state',textContent:'Image not found yet'}))" />
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
