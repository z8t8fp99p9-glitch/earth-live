# EARTH // LIVE — Cloud Dataset Master Plan

## Confirmed settings
- Coverage: global
- Collection check interval: 30 minutes while app is active
- Observation history: 7 days
- Scientific measurements: included in the target schema
- Storage strategy: balanced

## Source selection
### 1. Imagery and temporal layer metadata
NASA Global Imagery Browse Services (GIBS), using its time-aware WMTS tile service:
- Documentation: https://nasa-gibs.github.io/gibs-api-docs/
- Access basics: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
GIBS tiles are visualization imagery. They are not a substitute for numeric scientific data.

### 2. Scientific cloud products
NASA MODIS cloud products:
- Terra: MOD06_L2
- Aqua: MYD06_L2
- Product overview: https://modis.gsfc.nasa.gov/data/dataprod/mod06.php
- Current product listing: https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MYD06_L2

These products can include cloud fraction, cloud-top temperature/height, cloud phase and optical
properties, subject to product version, retrieval availability and quality flags. The products are
distributed as HDF-EOS granules. A working granule discovery/download route and a browser-compatible
parser must be verified before raw numeric observations are written to the database.

## Record schema (schemaVersion 1)
Each record is stored in the existing `clouds` collection:
- `id`: stable deduplication key
- `source`: provider/source identifier
- `productId`: source product or visualization layer
- `observedAt`: observation timestamp, when supplied by the source
- `publishedAt`: publication/processing timestamp, when supplied
- `capturedAt`: local collection timestamp
- `validUntil`: expiry timestamp for cache policy
- `geometry`: tile bounds, granule footprint, or grid bounds
- `payload`: typed object containing `kind`, product metadata, measurement values and/or cached
  imagery Blob only where that imagery has actually been downloaded
- `tags`: product, platform, resolution and quality tags

Scientific measurement fields are optional and must be omitted or marked unavailable if the source
does not provide them. Never derive numerical values from the colour of a rendered image.

## Update policy
1. On activation, check source availability and due timestamps.
2. Check again every 30 minutes while the page is active.
3. When the page returns to foreground, perform a due check immediately.
4. Use stable source/product/observation/area keys to update an existing record rather than duplicate it.
5. Validate record identity and timestamps before saving.
6. Preserve last-known-good records if a request fails.
7. Prune records older than seven days, based on observation time when available and capture time
   as fallback.
8. Do not attempt background collection while the iOS web app is suspended or closed.

## Balanced local storage
- Keep metadata and normalized scientific records in IndexedDB.
- Cache only a bounded set of imagery tiles; do not cache every zoom level or every tile for every
  historical observation.
- Apply a conservative per-record size ceiling and stop adding optional imagery if quota pressure is
  detected.
- Use `navigator.storage.estimate()` when available as an advisory signal, not as a guarantee.
- Delete expired records through the existing database API; do not clear unrelated collections.
- All map display/animation should read local records. Fetching is solely for collection/update.

## Explicit implementation boundary
The existing IndexedDB wrapper stores one record per `collection:id` and supports structured-clone
payloads. The collector module implements scheduling, validation, deduplication and expiry. It does
not mark the scientific measurement feed as active until the HDF-EOS ingestion path has been verified.
This prevents falsely labeling imagery metadata as scientific measurements.
