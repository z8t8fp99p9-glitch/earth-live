# EARTH // LIVE — Moon Dataset v1.0

## Recommendation: calculate on demand, store minimally
Moon position is deterministic for a given timestamp. Persisting a dense timeline is unnecessary and would create avoidable storage, synchronization and performance work. The module computes a result only when requested and memoizes the last exact timestamp.

## Calculations returned
- `timestamp`: requested instant in ISO format.
- `rightAscensionDeg`, `declinationDeg`: approximate geocentric equatorial coordinates.
- `eclipticLongitudeDeg`, `eclipticLatitudeDeg`: approximate ecliptic coordinates.
- `distanceKm`: approximate geocentric distance.
- `phaseAngleDeg`: approximate Sun-Moon elongation angle.
- `illuminationFraction`, `illuminationPercent`.
- `phaseName`: approximate phase label.
- `source`: `local-calculation`.
- `accuracy`: `lightweight-approximation`.

## Performance behavior
- Pure JavaScript math; no network or database needed for normal calculations.
- No `setInterval`, animation loop or automatic database writes.
- `calculate(timestamp)` accepts a Date, number (Unix milliseconds) or ISO string.
- Cache last timestamp/result. Repeated requests for same time return cached result.
- Call once per simulation step or user input change, not on every render frame.
- Globe rendering should interpolate/render independently and should not rerun astronomy math in the frame loop.

## Optional storage
`saveSnapshot(timestamp)` explicitly stores a compact calculation to existing IndexedDB collection `moon`. It does not automatically write every calculation. Suggested storage policy: keep only a small number of useful reference snapshots (e.g. latest real-time snapshot and user-saved simulation checkpoints), not a dense timeline.
`getSnapshot(id)` retrieves a saved snapshot.
No database schema upgrade is required when the generic store accepts arbitrary collection names.

## Integration and validation
- Load `moon-dataset.js` after `data-store.js` and before `app.js`.
- Runtime-test calculations against trusted ephemeris examples before claiming astronomical accuracy.
- This module is a lightweight visual approximation; it is not suitable for navigation, precise occultation/timing, or scientific measurement.
- No UI changes, globe rendering, camera movement or buttons are implemented here.
