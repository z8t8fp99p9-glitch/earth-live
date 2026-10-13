# EARTH // LIVE — Live Location Dataset Plan

## Final behavior
1. The app does nothing with location at launch.
2. Only a deliberate tap on the existing Location button starts one geolocation request.
3. The browser/iOS permission prompt is controlled by the operating system.
4. On success, validate and save the returned fix locally.
5. Do not automatically refresh, track movement, upload coordinates, or move the camera.
6. A future map/pointer integration can read the locally saved record; this dataset package does not change visible UI.

## Schema
Stored in existing IndexedDB collection `location`, stable ID `current`:
- `latitude`, `longitude`: decimal degrees
- `accuracyMeters`: reported horizontal accuracy
- `altitudeMeters`: optional device-reported altitude
- `altitudeAccuracyMeters`: optional altitude accuracy
- `headingDegrees`: optional heading, when available
- `speedMetersPerSecond`: optional speed, when available
- `capturedAt`: timestamp of this fix
- `source`: browser device geolocation
- `permissionMode`: one-shot request
- `schemaVersion`: 1

Coordinates are not rounded in the stored record. Do not log coordinates to the console.

## Storage and privacy
- Reuse `EarthLiveCollections`; do not create or upgrade the database.
- Keep only the latest fix to minimize sensitive location history.
- Repeated successful taps overwrite `location:current`.
- Denied, timed-out or invalid fixes do not erase the previous valid record.
- No location information is sent to any server by this module.
- No watchPosition, interval, background collection, or automatic request on load.

## Accuracy and permission
- Request high accuracy with a bounded timeout and no cached fix.
- The browser must be in a secure context (normally HTTPS).
- User permission is required; app code cannot bypass it.
- If unavailable, expose a generic status string without exposing coordinates.

## Integration boundary
No visible UI changes, camera movement, marker rendering, or GitHub edits. The existing Location button is wired to capture only; any later pointer/camera feature must be a separate agreed change.
