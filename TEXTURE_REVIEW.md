# Texture review and provenance

- Texture: `earth-relief-skin.jpg`
- Dimensions: 8192 × 4096 pixels (2:1 equirectangular aspect ratio)
- Candidate style: Sculpted Earth — stronger ocean depth contrast and terrain relief.
- Base: ETOPO1-style global topography/bathymetry image distributed with Matplotlib Basemap (5400 × 2700 source).
- Styling: palette and contrast processing for snow/ice, forests, dry regions, mountains, and ocean depth.
- The geographic source is real global relief, but the broad biome masks are artistic approximations.
- River paths are inherited from the base relief and have not been separately checked against authoritative river-centerline data.
- Upscaling to 8192 × 4096 does not create extra geographic detail.
- This is a review candidate, not a scientifically validated or live-deployed update.
