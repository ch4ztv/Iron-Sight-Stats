# Public data folder

The public app should use static read-only JSON files loaded with `fetch()`.

Suggested files:
- `meta.json`
- `standings.json`
- `matches.json`
- `players.json`
- `teams.json`
- `betting.json`
- `season.json` only if a consolidated all-in-one data file is preferred initially

Recommendation:
Start with one or a few clean JSON files if that is faster, then split by domain only when useful.
