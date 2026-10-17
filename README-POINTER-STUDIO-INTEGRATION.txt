EARTH // LIVE v1.5.56 — Pointer Studio Red Family P1–P8

Upload the ZIP contents to the GitHub repository root, preserving the eight SVG filenames at the root.

Changed app files:
- app.js
- index.html
- app-version.js
- service-worker.js

Assets:
- P1_Alien_Pin_Classic.svg
- P2_Alien_Glow.svg
- P3_Alien_Hologram.svg
- P4_Alien_Plus_Ring.svg
- P5_Red_Pin.svg
- P6_Neon_Outline.svg
- P7_Pulse_Ring.svg
- P8_Alien_Icon.svg

What this patch does:
- Adds Pointer Studio to the existing Stacks panel.
- Displays selectable P1–P8 red-family pointers with an in-app preview grid.
- Saves the selected pointer in localStorage on this device.
- Uses the selected SVG for the actual Live Location marker after the impact sequence.
- If Live Location is already active, changing selection replaces the displayed marker immediately without moving the camera.
- Bumps app version/cache to 1.5.56.

Does not change data-store.js, existing Orb artwork/settings, globe controls, camera framing, or orientation logic.

Validation performed locally: JavaScript syntax, SVG XML parsing, required app references, and ZIP integrity. Live iPhone testing remains necessary.
