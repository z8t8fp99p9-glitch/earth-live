# EARTH // LIVE — iPhone-friendly web app

A static, independent 3D planetary viewer prototype with live earthquake events from the USGS public feed.

## Included
- Interactive 3D Earth, drag rotation, pinch zoom and auto-orbit
- USGS all-earthquakes-in-the-past-day feed, refreshed every five minutes
- Toggleable earthquake and major-city markers
- Event details on marker tap
- Responsive dark UI and iPhone safe-area support
- Web app manifest, SVG icon, and basic offline shell caching
- GitHub Pages workflow for deployment

## Deployment status
This package is source code only. It has not been published to a live URL because no GitHub account/repository connection was available during generation.

## Deployment workflow
The included `.github/workflows/pages.yml` publishes the static site to GitHub Pages when the project is pushed to a GitHub repository and Pages is enabled for GitHub Actions. The resulting URL is provided by GitHub; no custom server is required.

## Technical notes
- Three.js and Globe.gl are loaded from public CDNs. A working internet connection is needed for the map engine and imagery.
- Earthquake events are fetched from `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`.
- City markers are static reference points.
- Offline caching stores the app shell, but not the third-party globe libraries, imagery, or live data.
- This is an independent prototype, not a full port of God's Eye View. Aircraft, ships, satellites, CCTV, voice assistant, and historical playback are not implemented in this build.
- Data may be delayed, incomplete, or inaccurate. Do not use for navigation or emergency decisions.
- The upstream project is MIT-licensed; this prototype is an independent implementation. Third-party feeds, imagery, and libraries have their own terms.
