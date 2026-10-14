# Integration status — v1.39

- Source base: `EARTH-LIVE-Adaptive-Landscape-Scroller-v1.32.zip` (known-good visual baseline)
- Changed: `sun-moon-tracker.js` (adds automatic temporary dotted 10-day lunar orbital arc), `app-version.js`, `service-worker.js`, package metadata, README, integration status
- Unchanged: `index.html`, `app.js`, `style.css`, `data-store.js`, `moon-dataset.js`
- Orbit window: current time ±5 days, samples every 6 hours (41 expected points)
- Orbit path uses the existing Moon dataset's RA/declination and distance variation; radius is visually scaled inward
- User interaction required: none; path is added when the globe initializes
- ZIP integrity and JS syntax: to be checked after packaging
- iPhone/PWA runtime test: not performed
- Astronomy precision validation: not performed; existing Moon model remains approximate
