# EARTH // LIVE — Day/Night Shadow Dataset Plan

## Final dataset decisions
- Coverage: global Earth
- Update: every 30 minutes while the app is active; recalculate on return to foreground if due
- History: 7 days of calculation snapshots
- Storage: balanced, compact numeric records
- Source: local calculation from UTC timestamp; no external data download
- Existing IndexedDB collection: `solar-shadow`
- No visible UI changes and no direct GitHub edits

## Calculation approach
Use a low-precision solar ephemeris approximation to calculate the Sun's right ascension and declination, Greenwich mean sidereal time, and the subsolar point for a UTC timestamp. The subsolar latitude is the solar declination; subsolar longitude is right ascension minus Greenwich sidereal angle, normalized to [-180°, 180°].

The terminator is the great circle perpendicular to the Earth-fixed Sun direction. Sample points along that great circle for future rendering. A later renderer must use a consistent Earth-fixed coordinate convention; this package exposes coordinates and does not draw them.

## Record schema
Each snapshot in `solar-shadow` includes:
- `id`: UTC time bucket identifier
- `source`: `local-solar-calculation`
- `algorithm`: `EARTH-LIVE-SOLAR-LOW-PRECISION-v1`
- `calculatedAt`: UTC timestamp
- `julianDay`: Julian day
- `sunRightAscensionDeg`, `sunDeclinationDeg`
- `greenwichSiderealAngleDeg`
- `subsolarLatitudeDeg`, `subsolarLongitudeDeg`
- `sunDirectionEcef`: unit vector in Earth-fixed coordinates
- `terminator`: sampled geographic points, latitude/longitude
- `illumination`: model note; no claims about atmospheric twilight or terrain shadow
- `schemaVersion`

## Update and deduplication
- Calculate immediately on module activation, then every 30 minutes while active.
- Recalculate when the page becomes visible if the last calculation is due.
- Deduplicate by UTC 30-minute bucket; same bucket overwrites the existing snapshot.
- Retain seven days of snapshots; prune only the `solar-shadow` collection.
- No network calls. If calculation fails, retain prior records.
- This module never modifies location, clouds, earthquakes, or satellite collections.

## Storage and limitations
- Reuse `EarthLiveCollections`; no database creation or version upgrade.
- Store compact numeric records, not images or per-pixel masks.
- Browser timers may pause while the iOS web app is suspended or closed.
- The low-precision solar model is intended for visual day/night separation. It is not a high-precision ephemeris.
- Visible lighting and shadow rendering remain a separate integration step.
