# Public data strategy

## Recommended approach
The public app should read static JSON files using `fetch()`.

## Why
- GitHub Pages friendly
- deterministic
- easier to debug
- no dependency on IndexedDB for public viewing

## Suggested public data domains
- standings
- matches
- players
- teams
- betting
- metadata

## Workflow
Private master app -> cleaned public export -> commit to public repo -> GitHub Pages publishes
