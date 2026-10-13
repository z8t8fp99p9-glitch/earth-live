# EARTH // LIVE — Satellite Dataset Plan (Final)

## 1. Confirmed settings
- Coverage: global
- Active-app check interval: 30 minutes
- Observation history: 7 days
- Catalog scope: useful starting catalog
- Local storage: balanced

## 2. Source selection
Primary: CelesTrak GP data in OMM JSON format. JSON/OMM is preferred over legacy TLE because CelesTrak documents that TLE does not support catalog numbers above 99999, while OMM JSON supports the newer catalog identifiers.

Selected useful groups:
- `STATIONS`
- `WEATHER`
- `EARTH-RESOURCES`
- `GPS-OPS`

Each group is fetched at most once every two hours. CelesTrak's published usage policy says GP data should be retrieved once per update, and updates are generally on a two-hour cadence. The app's 30-minute interval is a local due-check interval, not permission to poll the provider every 30 minutes.

Official references:
- GP data formats and OMM JSON: https://celestrak.org/NORAD/documentation/gp-data-formats.php
- CelesTrak usage policy: https://celestrak.org/usage-policy.php
- Satellite.js propagation API: https://shashwatak.github.io/satellite-js/docs/propagation

## 3. Stored record schema
Each satellite record uses the existing `satellites` collection and a stable ID based on provider + catalog identifier + element epoch:
- identity: catalog ID, object name, international designator when available
- source: CelesTrak GP, group name, source URL, OMM format
- element epoch: source epoch, captured time, last successful update
- orbital elements: inclination, RAAN, eccentricity, argument of pericenter, mean anomaly, mean motion, BSTAR and other OMM fields when supplied
- metadata: classification, object type, center/frame/time system when supplied
- validity: observation epoch, record capture time and expiry
- integrity: schema version and validation state

The seven-day policy retains recent element-set versions for history. The newest element set for a catalog ID is used for current propagation; older element sets are historical only.

## 4. Orbital propagation
Store orbital elements locally; do not store a constantly changing stream of position samples. Use satellite.js SGP4 propagation on demand for the requested timestamp. It returns position and velocity in the TEME frame; a later globe integration must explicitly transform coordinates to the globe's expected Earth-fixed frame and units before rendering. Do not treat TEME coordinates as Cesium longitude/latitude directly.

The module exposes a propagation helper but does not add satellite markers or alter the visible app UI.

## 5. Update and deduplication policy
- On app activation, check whether each group is due.
- Check again every 30 minutes while active.
- Do not refetch a group until two hours have elapsed since its last successful fetch.
- Fetch OMM JSON once per group per update window.
- Validate response shape and required catalog ID / epoch before saving.
- Deduplicate by source + catalog ID + epoch; same record updates rather than duplicates.
- Keep prior records if a network error, throttling response, malformed payload or empty unexpected result occurs.
- Do not retry HTTP 301/403/404 in a tight loop; wait for a later scheduled check.
- Retain no more than seven days of element-set history.

## 6. Balanced local storage
- Reuse `EarthLiveCollections`; do not create a new database or upgrade IndexedDB.
- Store compact OMM records only; no downloaded imagery or high-frequency position samples.
- Prune only the `satellites` collection.
- Respect browser quota; existing data is never cleared to make room.
- Use storage estimates only as advisory information.
- Display/animation should use locally stored orbital elements and local propagation. Network is used only for dataset refresh.
- iOS may suspend the PWA while closed; background refresh is not guaranteed.

## 7. Boundaries
This package does not modify `index.html`, `app.js`, `style.css`, service worker, camera behavior, buttons, or the cloud dataset. Integration is manual by the user. No GitHub changes are performed by the assistant.
