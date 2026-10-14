# Integration status — v1.37 Burning Sun Celestial Scene

- Source base: exact EARTH-LIVE-Celestial-View-Prototype-v1.36.zip candidate.
- Changed: sun-moon-tracker.js, app-version.js, service-worker.js, README-FIRST.md, PACKAGE-METADATA.json, INTEGRATION-STATUS.md.
- Unchanged: index.html, style.css, app.js, data-store.js, moon-dataset.js.
- Opening state: Celestial View opens by default with Sun selected and both bodies rendered.
- Sun: spherical ellipsoid with a locally generated orange-gold plasma texture and a soft corona halo.
- Moon: spherical ellipsoid with a locally generated crater texture; position and approximate phase continue to follow the existing local Moon calculator.
- Orbit: subtle dotted polyline around Earth as a visual Moon-orbit guide.
- Existing time scroller, scene persistence, zoom-exit logic, centred dock, responsive layout, and Earth assets remain otherwise unchanged.
- Validation: JavaScript syntax checks and ZIP integrity checks performed.
- Not performed: iPhone/PWA runtime test, visual test, camera interaction test, performance test, or independent astronomy validation.
- Candidate only; keep v1.35/v1.36 and known-good v1.32 available for rollback.
