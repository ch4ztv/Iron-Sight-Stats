# Deployment notes

## GitHub Actions runtime warning
If you saw a warning about Node.js 20 on GitHub Pages actions, this workflow updates the Pages actions to current major versions:

- `actions/configure-pages@v5`
- `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v5`

That is the cleanest fix for the deprecation warning you saw.

## Pages settings
Use:
- **Source**: GitHub Actions

If your repository is already configured for branch deployment, switching to GitHub Actions may be required after adding this workflow.

## If Pages publishes the wrong thing
Make sure the repo root contains:
- `index.html`
- `assets/`
- `data/`
- `brackets/`

and not another nested top-level folder.
