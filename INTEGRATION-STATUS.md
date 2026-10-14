# Integration status — v1.33

- Source base: user-tested EARTH-LIVE-Adaptive-Landscape-Scroller-v1.32.zip
- Changed: sun-moon-tracker.js, app-version.js, service-worker.js, style.css (explanatory note only), package metadata, README, integration status
- Unchanged: index.html, app.js, data-store.js, moon-dataset.js
- Sun marker: calculated subsolar direction, visually scaled above Earth
- Moon marker: local approximate RA/declination and illumination, directionally placed and visually scaled above Earth
- Shared time: tracker updates Cesium clock for live time and ±12-hour scrubber selections
- Moon visibility overlay: existing 40° threshold retained
- ZIP integrity: to be checked after packaging
- JavaScript syntax: checked after changes
- iPhone/PWA runtime test: not performed
- Astronomical accuracy: not independently validated; Moon model remains a lightweight approximation


## v1.34 persistence fix
- Updated celestial marker entities in place to avoid remove/recreate flicker during time updates.
- LIVE now preserves the selected celestial object and recalculates its current-time position.
- No layout, globe camera, base app, data store, or Moon calculator changes.
- Requires iPhone/PWA runtime verification; syntax/ZIP checks are not runtime tests.


## v1.35 size and persistence
- Based on the exact v1.34 candidate ZIP supplied in this conversation.
- Sun marker enlarged to 76 px; Moon marker enlarged to 66 px.
- Billboard and label depth testing disabled so the active marker stays visible through the globe.
- Re-selecting the active Sun/Moon tab no longer clears it; closing the main Sun/Moon panel clears it.
- LIVE continues to preserve selection and update to current time.
- Layout, index.html, app.js, data-store.js, and moon-dataset.js are unchanged from v1.34.
- iPhone/PWA runtime test not performed.
