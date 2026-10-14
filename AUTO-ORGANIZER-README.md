# EARTH // LIVE — one-time asset organizer

## What it does
- Runs automatically on every push to `main` using the existing Pages workflow.
- Creates the `Assets` branch on its first successful run; no separate branch-creation action is needed.
- Moves only the explicit allowlist in `scripts/organize-assets.mjs` into `Assets/library/`.
- Checks HTML, CSS, JavaScript and the web manifest for runtime references before moving any allowlisted file. If a reference is found, it stops without moving or deleting that file.
- Publishes to `Assets` first. Only after that push succeeds does it remove those same files from `main`.
- Stages a runtime-only Pages artifact, excluding project notes, plans, patches, diagnostics and non-runtime reference artwork.
- Leaves all other files alone. In particular, it does not modify `data-store.js`, `DATABASE-SCHEMA.txt`, dataset/collector scripts, database schemas, current runtime art, service-worker source or app behavior.

## Safety and recovery
- The allowlist is intentionally narrow. Add a file only after checking that the running app does not need it.
- Assets are never automatically deleted from the `Assets` branch. Replacing a library file creates Git history, so previous versions remain recoverable.
- The workflow validates the uploaded source before organizing. A failed validation prevents organization and deployment.
- If a branch push or main cleanup push fails, the workflow stops; it does not proceed as if cleanup succeeded.
- GitHub Actions needs `contents: write` permission for the repository. If repository/org policy prohibits workflow writes, the run fails safely and the workflow permission policy must be adjusted once by a repository administrator.
- This is a source-file organizer, not a database migration. The current `data-store.js` documents browser-local IndexedDB storage; this workflow does not access or modify users' stored browser data.

## Initial installation
Upload this patch's files to `main` while preserving their paths:
- `.github/workflows/pages.yml` (replace the existing Pages workflow)
- `scripts/organize-assets.mjs` (add the organizer)
- `AUTO-ORGANIZER-README.md` (this documentation)

After the workflow file is present on `main`, subsequent normal patch uploads trigger organization automatically. No manual branch creation or workflow-dispatch click is required.


## ZIP layout
The ZIP has no extra project-name wrapper folder. Extract it at the repository root and merge the included paths: `.github/workflows/pages.yml`, `scripts/organize-assets.mjs`, and `AUTO-ORGANIZER-README.md`. The `.github/workflows/` nesting is required by GitHub Actions.
