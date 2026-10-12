EARTH // LIVE — Change Log

Confirmed Baseline — 12 October 2026

Current known-good release: Build 0.3
Deployment status: CONFIRMED — live on GitHub Pages and visually verified on iPhone.
Protected rollback tag: earth-live-v0.3

Confirmed Features

* Interactive 3D Earth globe with drag rotation, pinch zoom and auto orbit.
* Live public earthquake data from USGS.
* Magnitude-scaled earthquake rings: cyan for smaller, amber for moderate and red for stronger events.
* Tapping an event displays magnitude, location, depth, local event time and the official USGS link.
* Device-local time display, major-city layer, refresh control and responsive iPhone layout.
* Earthquake rings are visual markers, not impact radii. This is exploratory public data, not an emergency or navigation tool.

Confirmed Deployment Safety Setup

* .github/workflows/pages.yml — validates required app files before deploying to GitHub Pages.
* .github/workflows/rollback.yml — manual workflow for restoring a selected tagged release.
* scripts/validate-release.mjs — release validation script.
* Both deployment workflow runs were reported successful on 12 October 2026.

Release Procedure

1. Make changes and commit them to main.
2. Confirm the validation and Pages deployment workflows succeed.
3. Open the live site on iPhone and verify the result.
4. Only then record the new build as confirmed and create a protected release tag.

Rollback Procedure

Use GitHub Actions to run Roll back EARTH LIVE, selecting a known-good release tag such as earth-live-v0.3. Confirm the workflow succeeds and verify the restored live site on iPhone.

Pending Verification

* Confirm the rollback workflow appears in GitHub Actions and completes a safe test or actual recovery when needed.
* Confirm the change log is committed to the repository.
* Keep independent ZIP backups of known-good releases.

Rule: Never mark a build as deployed or verified until the live site has been checked.
