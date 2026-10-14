# Integration status — v1.36 Celestial View Prototype

- Source base: exact EARTH-LIVE-Sun-Moon-Screen-Lock-v1.35.zip uploaded/tested by user.
- Changed: sun-moon-tracker.js, app-version.js, service-worker.js, README-FIRST.md, PACKAGE-METADATA.json, INTEGRATION-STATUS.md.
- Unchanged: index.html, style.css, app.js, data-store.js, moon-dataset.js.
- Scene behaviour: Sun and Moon are rendered together after selecting either celestial tab.
- Fixed Sun: Sun's direction is anchored at scene entry; Cesium lighting clock is held at that anchor while camera rotation represents Earth spin.
- Earth time scrub: camera rotates around Earth's polar axis based on elapsed time; ±12-hour slider remains in place.
- Moon: local approximate RA/declination and illumination update with selected time.
- Persistence: celestial scene remains active until panel closes or camera zooms to within the auto-exit threshold.
- Zoom exit: closes celestial panel and clears markers while preserving the close-up camera view.
- Moon overlay: blocky 10-degree visibility overlay is disabled in Celestial View.
- Layout and existing app files remain untouched.
- Validation: JavaScript syntax checks and ZIP integrity checks performed after packaging.
- Not performed: iPhone/PWA runtime test, visual test, camera interaction test, or independent astronomy validation.
- Candidate only; retain v1.35 and known-good v1.32 baseline for rollback.
