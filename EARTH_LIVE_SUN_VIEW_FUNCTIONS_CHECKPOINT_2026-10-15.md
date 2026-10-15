# EARTH // LIVE — Sun View Function & Layout Checkpoint
Date: 2026-10-15

## User-approved direction
- Rebuild the Sun View presentation using Moon View as the layout/interaction reference.
- Preserve the Sun button's existing location flow, solar calculations, sky-position updates, status/readout, sunrise/sunset window, and globe-time synchronization.
- Use the same shared bottom dock in Sun and Moon views; do not create a duplicate dock.
- Add the Sun Journey scroller using the Moon scroller's shared geometry and responsive layout.
- Defer the decorative gold tail/wave to a later pass. For this version the Sun track is a plain static gold rail; only the Sun thumb moves.

## Sun View behavior preserved
- Tapping Sun toggles Sun Sky View open/closed.
- Opening Sun closes Moon View first if active.
- Location is obtained through the existing user-initiated EarthLiveLocation API; location anchoring is retained.
- Solar position is calculated from the selected local date/time and observer latitude/longitude.
- Sunrise/sunset window is calculated locally; slider uses minute offsets between the window bounds.
- Dragging the slider updates Sun position, azimuth/altitude readout, current time label, and Cesium viewer clock.
- Tapping Moon or Stacks while Sun View is active closes Sun View.
- Existing dock markup is shared globally and remains a single dock, visible in both views.

## Layout changes in v1.92
- Sun sky markup follows the same structural pattern as Moon Sky View.
- Sun Journey panel follows the same structural pattern and responsive range geometry as Moon Journey.
- Sun track uses a static gold rail for now; no waveform/tail work included.
- Version/cache namespace advanced to v1.92.

## Protected
- Moon calculations, Moon scroller styling/behavior, globe, camera/gestures, location API, earthquake/feed features, existing art, Liquid Glass, mountain/wallpaper layers, and `data-store.js`.
- No GitHub writes; user applies the flat ZIP manually.

## Validation
- JavaScript syntax checks passed for `sun-sky-view.js`, `app-version.js`, and `service-worker.js`.
- ZIP integrity and changed-file list checked.
- Browser/iPhone visual and interaction test is pending user validation.
