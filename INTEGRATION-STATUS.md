# v1.19 Integration Status

Completed: package assembly, ZIP integrity check, JavaScript syntax checks.
Not verified: actual iPhone PWA runtime, CSS vertical slider appearance, rail placement in portrait/landscape, Cesium time-linked lighting, overlay performance.

Test:
1. App launches with panel closed.
2. Open Lighting and enter Past/Future.
3. Portrait: slim rail is on right, no horizontal overlay across globe.
4. Landscape: rail stays near right edge and doesn't block globe center.
5. Drag vertically to change time within ±12 hours.
6. Tap LIVE to return to first Sun/Moon selection view.
7. Confirm Basic/HD, Location, Layers, zoom and rotation still work.
