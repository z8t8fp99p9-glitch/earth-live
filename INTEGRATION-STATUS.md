# Integration status — v1.20

- Built locally from the previous v1.19 package; GitHub was not edited.
- Slider direction: horizontal in portrait, vertical in landscape.
- Slider input: input/change handlers retained; simulation time anchored when simulation begins to make the drag position stable.
- Launch state: panel hidden, no active Sun/Moon selection, tracker button's active style removed.
- Black bottom strip: estimated visually at ~116 px in supplied 707 × 1536 screenshot; app controls continue to use the safe-area inset. The strip is not assumed to be the safe-area height, and exact viewport behavior still requires iPhone testing.
- Not runtime-tested in Safari/PWA; astronomy output not independently validated.


v1.24: Landscape-only vertical rail spacing adjustment. Portrait CSS and application JavaScript unchanged from v1.22. Needs visual testing in the deployed iPhone app.


v1.24 scope: responsive layout for the initial Sun/Moon selection panel only. Portrait placement and the simulation slider design are preserved. Landscape placement/size adapts to available viewport and safe areas. Needs real-device visual testing.
