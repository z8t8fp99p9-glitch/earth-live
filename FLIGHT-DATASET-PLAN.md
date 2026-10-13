# EARTH // LIVE — Flight Dataset Plan v1.0

## Goal
Provide a local dataset foundation so a later UI can select one aircraft and follow its most recent reported position. The design targets 10–20-second updates when an authorized free provider can supply them, but does not promise that freshness.

## Zero-dollar source strategy
- Optional adapter: public `adsb.fi` API calls by callsign or ICAO24.
- Public endpoints are documented for personal, non-commercial use, with rate limits and required attribution. Confirm current provider terms before deployment or any public/commercial distribution.
- A direct browser request may fail due to CORS. The package deliberately does not create a server, proxy, or secret-bearing endpoint.
- No fallback to paid providers and no hidden scraping.

## Collection behavior
- Track only one explicitly selected aircraft at a time by default.
- Minimum polling interval: 10 seconds; default: 15 seconds.
- Prevent overlapping requests.
- Back off on HTTP 429 and other errors; keep prior local records on failure.
- Persist only valid position observations; deduplicate identical aircraft/timestamp observations.
- Stop polling when `stopTracking()` is called. Browser suspension may pause execution; resume only when the page is active again.
- Local persistence uses the existing generic IndexedDB collection API and the collection name `flights`; no DB schema migration is needed.

## History and retention
- Default rolling history: 6 hours.
- Store latest observation and timestamped samples separately using keys:
  - `flights:latest:<icao24>`
  - `flights:sample:<icao24>:<timestamp>`
- Retention pruning is limited to records this module can identify. Existing unrelated collections are never touched.

## Observation fields
- `icao24`, `callsign`, `registration` (if available)
- `latitude`, `longitude`
- `baroAltitudeM`, `geoAltitudeM`, `velocityMps`, `trackDeg`, `verticalRateMps`
- `onGround`, `squawk`, `source`, `sourceTimestamp`, `capturedAt`
- `positionAgeSeconds` where derivable
- Provider payload retained only in a compact, source-specific field where useful.

## Later globe integration (not included)
A separate future step can read the latest local record and render an aircraft marker/route. This package intentionally adds no UI, map marker, camera-follow behavior, or visible buttons.

## Verification status
Package files and ZIP structure can be checked locally, but runtime behavior, browser CORS, and live provider responses have not been verified inside the iPhone-installed app. Treat this as a foundation until that test is completed.
