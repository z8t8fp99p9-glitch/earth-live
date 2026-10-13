# EARTH // LIVE — Earthquake Dataset Plan v1.0

## Coverage and cadence
- Global events from the USGS `all_day.geojson` summary feed.
- Poll every 5 minutes while the app is active and visible.
- Re-check promptly when the app returns to the foreground if the last successful fetch is stale.
- The USGS feed has its own publication/update cadence; app polling does not guarantee five-minute-old data.

## Local-first architecture
- The collector fetches the public source only to collect/update dataset records.
- Map visualization should query `EarthLiveCollections` and must not fetch the network during ordinary map interaction.
- Store records in the existing `earthquakes` collection; no database version migration is intended.
- No edits to existing app files are included in this ZIP.

## Normalized event schema
- `eventId` — USGS GeoJSON feature ID, stable event key.
- `title` — source event title.
- `magnitude` — reported magnitude or null.
- `magnitudeType` — e.g. mb, md, ml, mw, or null.
- `place` — human-readable source location.
- `longitude`, `latitude`, `depthKm` — coordinates from GeoJSON order `[longitude, latitude, depth]`.
- `eventTime` — origin time, ISO timestamp.
- `updatedAt` — provider's last update timestamp, ISO timestamp.
- `status` — source status where supplied.
- `eventType`, `tsunami`, `felt`, `alert`, `significance`, `detailUrl`.
- `source` — `USGS`.
- `capturedAt` — when this app retrieved the event.
- `geometry` — GeoJSON Point for map use.

## Retention and storage
- Keep seven days of event history based on event time.
- One current record per event ID (`earthquakes:<eventId>`), updated when USGS revises the event.
- Save only valid features with a stable ID and valid coordinates.
- Prune old records from this collection only. Do not clear or modify other collections.
- Retention pruning uses the local data-store list/remove API; check compatibility against the deployed data-store before runtime verification.

## Error handling
- If the fetch fails or response is invalid, preserve existing local records.
- Avoid overlapping fetches.
- On HTTP 429 or network failures, use a delay before retrying.
- Stop the active interval when explicitly stopped; ignore polling while document is hidden.
- Browser/iOS PWA suspension may pause the collector. It does not promise background operation.

## UI and project protection
- No visible UI changes.
- No globe rendering or camera changes.
- No edits to `index.html`, `app.js`, `data-store.js`, or version files in this package.
- No direct GitHub edits.
- Not runtime-tested in the installed iPhone app.
