# v1.18 Status

Completed: package assembly, ZIP integrity check, JavaScript syntax checks.
Not verified: iPhone PWA runtime, CSS behavior on deployment, simulated Cesium lighting, astronomy accuracy, overlay performance.

Test checklist:
1. Open app: tracker panel must be closed.
2. Tap Lighting: Sun/Moon panel opens.
3. Tap Sun/Moon: live selection info appears; tapping the same selection again turns it off.
4. Tap Past/Future Position: only scrubber + small Live button remain.
5. Drag scrubber: time-linked values update, within ±12 hours.
6. Tap Live: return to first Sun/Moon selection view.
7. Confirm Basic/HD, Location, Layers, zoom and rotation still work.
