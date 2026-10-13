# Integration status and test checklist

## Automated checks completed
- ZIP archive integrity check.
- JavaScript syntax check with Node.js for `app.js`, `app-version.js`, `data-store.js`, `moon-dataset.js`, and `sun-moon-tracker.js`.
- Reviewed package paths and script order.

## Not completed
- No runtime test in Cesium browser or installed iPhone PWA.
- No visual regression test against the live app.
- No astronomical cross-validation against USNO/JPL ephemerides.
- No verification that Cesium globe lighting follows a manually assigned `viewer.clock.currentTime` on the target iOS browser.
- No verification of service-worker update behavior on device.

## Manual acceptance checklist
1. App opens with same globe, Basic/HD, Location, Lighting and Layers positions.
2. App stamp reports v1.15.
3. Tapping Lighting opens/closes the compact Sun/Moon panel.
4. Live mode shows current time; selecting Moon shows approximate phase and illumination.
5. Simulation time changes when date input or ±1h buttons are used; Play/Pause works.
6. Confirm Sun/day-night lighting responds to simulation time on the actual iPhone PWA.
7. Confirm Moon 40° overlay appears only when Moon is selected and overlay toggle is enabled.
8. Rotate/zoom globe and switch Basic/HD; camera controls and texture quality should remain intact.
9. Close and reopen app; check service worker loads new files and no stale UI remains.
10. If any regression appears, restore the saved v1.14 files immediately.
