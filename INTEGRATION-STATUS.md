# v1.17 Integration Status

Checks completed: ZIP integrity and JavaScript syntax.
Not verified: runtime behavior on iPhone PWA, Cesium time-dependent lighting, overlay smoothness, astronomy precision, and visual regression.

Test:
1. First view shows only Sun and Moon toggles plus Past/Future Position.
2. Tap Sun: live Sun info appears; tap again: it turns off.
3. Tap Moon: live Moon info and internal 40° region appear; tap again: it turns off.
4. Tap Past/Future Position: horizontal scrubber appears, limited to ±12 hours.
5. Drag scrubber: displayed time and position update.
6. Back to live returns to first Sun/Moon selection view.
7. Verify Basic/HD, Location, Layers, zoom and rotation.
8. Restore previous files if any regression appears.
