EARTH // LIVE — Clean Live Location Reset
Version: 1.5.58-clean-location-reset

ROOT UPLOAD: Upload the four files in this ZIP to the repository root, replacing files with the same names:
- app.js
- app-version.js
- index.html
- service-worker.js

What changed:
- Replaced the previous Live Location implementation with one isolated location flow.
- Waits for a valid GPS fix before turning the existing Location Orb on.
- Centres the camera on the GPS coordinates with a predictable downward view while retaining the current camera height.
- Maintains one selected pointer and refreshes its position on subsequent GPS fixes without repeatedly moving the camera.
- Removes the pointer and stops tracking on the second Orb tap without moving the camera back.
- Keeps the existing Pointer Studio and pointer assets. No launcher, fireball, impact, crater, or location activation effect is added.
- Leaves style.css, data-store.js, imagery, general camera controls, and other Orb behavior unchanged.

Validation performed: JavaScript syntax checks and ZIP integrity check. Not tested on a physical iPhone/browser; please verify on device after upload.
