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
