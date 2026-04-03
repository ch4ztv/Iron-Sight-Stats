# Header + Teams Parity Pack

This pass is meant to move the public build closer to the original single-file app.

## Included changes

### Header
- stronger branded banner treatment
- tighter title proportions
- more faithful green glow / dark-panel feel
- cleaner nav presentation

### Teams page
- original-style team page rhythm:
  - team selector strip
  - hero with quick stats
  - roster strip
  - mode tabs
  - dense stat table area
- prefers parsed JSON team stats over static stat images
- still falls back to static team-stat images if parsed stats are missing
- keeps background logo / portrait style closer to the original

### Asset resolution
- more forgiving player portrait candidates
- case-insensitive-ish slug variants
- alternate extension candidates
- supports common tag variations

## Expected data
This version expects your `team-stats.json` or `season.json` data to contain parsed structures like:
- overall.players
- hardpoint.players
- snd.players
- overload.players
- mapRecords.maps
- picksVetos.maps

If the parsed team stat block is unavailable for a team, the UI falls back to the team stat image for the selected mode.
