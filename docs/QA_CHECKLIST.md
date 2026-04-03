# Iron Sight Stats — QA + Finish Pass Checklist

Use this after each upload/deploy.

## Deployment
- [ ] GitHub Pages source is set correctly.
- [ ] Latest workflow run passed.
- [ ] Site opens without a blank screen.
- [ ] Custom domain is **not** configured unless intentional.

## Navigation
- [ ] Dashboard loads by default.
- [ ] Every nav tab opens correctly.
- [ ] Browser back/forward works with section hashes.
- [ ] Mobile nav opens and closes cleanly.

## Data
- [ ] `data/meta.json` loads.
- [ ] `data/matches.json` loads.
- [ ] `data/maps.json` loads.
- [ ] `data/players.json` loads.
- [ ] `data/player-stats.json` loads.
- [ ] `data/points.json` loads.
- [ ] `data/team-stats.json` loads.
- [ ] `data/bracket-data.json` loads.
- [ ] `data/bpr-coefficients.json` loads.
- [ ] No fetch 404s in browser devtools.

## Images
- [ ] Team logos appear for every team.
- [ ] Player headshots appear for every expected player.
- [ ] Team stats images appear for every team page.
- [ ] Missing images fall back gracefully.
- [ ] No broken-image icons appear in public pages.

## Matches
- [ ] Series cards render.
- [ ] Map detail expansion works.
- [ ] Search works.
- [ ] Filters work.
- [ ] BO5 / BO7 labels display correctly.

## Players
- [ ] Search works.
- [ ] Sort works.
- [ ] Team filter works.
- [ ] Player images and team branding render correctly.

## Teams
- [ ] Team selector works.
- [ ] Roster cards render.
- [ ] Team stat images load.
- [ ] Team record/form values look correct.

## Betting Lab
- [ ] Team selector works.
- [ ] Coefficient cards render.
- [ ] Recent form and mode snapshots render.
- [ ] Empty/missing data states are readable.

## Brackets
- [ ] Major 1 opens.
- [ ] Major 2 opens.
- [ ] Embedded preview works.
- [ ] Full-page bracket link works.

## Mobile
- [ ] Header stays usable.
- [ ] Navigation is accessible.
- [ ] Cards stack correctly.
- [ ] Tables are scrollable or converted appropriately.
- [ ] Bracket view is still usable.

## Final polish
- [ ] Title and description are correct.
- [ ] Favicon is present.
- [ ] Footer text looks intentional.
- [ ] No admin/dev controls are visible.
