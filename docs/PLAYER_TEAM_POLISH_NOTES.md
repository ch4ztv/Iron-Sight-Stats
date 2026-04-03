# Player + Team Polish Pack

This pack is focused on two things:

1. making player portraits much more resilient to filename and extension mismatches
2. bringing the Players / Teams sections closer to the "premium" feel of the old single-file app

## Files included
- `assets/js/asset-paths.js`
- `assets/js/sections/players.js`
- `assets/js/sections/teams.js`
- `assets/css/components.css`
- `assets/css/responsive.css`

## Why this should help
The new `asset-paths.js` tries multiple filename variants and multiple extensions for:
- team logos
- player portraits
- team stat images

That makes it much more forgiving when your real assets do not perfectly match a single slug assumption.

## Suggested next pass
After dropping this in, the next best pass is:
- image audit against live repo asset names
- dashboard/teams/player visual tightening
- betting lab parity pass
