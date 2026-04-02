# GitHub Pages deployment notes

## Recommended setup
- Pages source: `main` / root
- static site only
- no build pipeline required for v1 unless later needed

## Path strategy
Use relative paths for internal assets and data files.

Examples:
- `./assets/css/app.css`
- `./assets/js/app.js`
- `./data/standings.json`
- `./brackets/major-1.html`

Avoid root-absolute paths like `/assets/...` on a project Pages site.
