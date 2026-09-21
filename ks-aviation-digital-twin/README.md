# KS Aviation Digital Twin

TR/EN aviation workspace using Vite, TypeScript and Three.js. No Cesium dependency.

## Navigation and editing

- World and Türkiye camera views, then ADB Airport or ADB Facility.
- Airport and Facility share one scene; changing the camera never replaces objects.
- Design: click or Shift-click objects, or select a group in the list. W/E/R select move/rotate/scale gizmos in 3D. In 2D, drag a selected object to move it.
- Add aircraft, refuellers, tanks, buildings, trees and equipment; draw ground polygons, walls, fences and gates.
- Rename, change color, duplicate, group, ungroup, ground, undo/redo, save camera and import/export JSON.
- Edits are automatically saved in this browser under `KS_DIGITAL_TWIN_ADB_V1`. Export JSON for a portable backup. Edits do not write to the old site's storage or Supabase.
- R14 loads lazily and has platform, railing and gate animation controls. The whole vehicle has a stable selection wrapper.
- The 2D satellite map/editor and 3D scene use the same records and history. 2D is available when WebGL is unavailable.

## Migrated data

`public/data/adb-legacy.json` contains 61 ADB objects and 4 groups from the user's `KS-KAYITLAR-20260915-101627.json` backup. Original IDs, geographic footprints, headings, dimensions, colors and groups are preserved. Terrain is a flat local map plane; historical terrain elevations are not treated as object elevations. One separately editable R14 is added on first load.

On 2026-09-20 the user authorized reading the old Supabase ADB record. Reads, including the post-deployment retry, returned HTTP 502. This version uses the dated backup, not an unverified latest cloud revision. No Supabase credentials are included in this app.

Import accepts the new schema, a legacy `KS_AIRPORT_3D_V2` ADB scene, or an old complete backup containing `airport3d.ADB.scene`. Import replaces the workspace and can be undone. BJV scenes are rejected in this ADB workspace.

## Maps

World: bundled Three.js earth texture with country-outline fallback. Map: Esri World Imagery tiles loaded on demand, with attribution displayed. ADB imagery is capped at the verified level 19 and enlarged for closer views; level 20 returns unavailable-image placeholders. Imagery availability is independent of editable objects; geometry works if tile requests fail.

## Development

Run `npm install`, then `npm run dev` or `npm run build`.

Prebuild reconstructs the validated 6,437,208-byte GLB from `model-parts/`. Render watches only the `ks-aviation-digital-twin` branch, builds this directory and publishes its `dist` directory. The root `index.html` and `main` branch are unrelated to this release.

Run focused data/geometry checks with `npm test`. They verify all 61 objects and 4 groups, geographic coordinate round trips, mesh ground placement, stable object identity during transforms, undo/redo, deletion recovery, and invalid import rejection. 3D visual QA still requires a WebGL-capable browser.

## Operational aircraft and photo ground

A320 and B737 catalogue objects now use variant-specific dimensions and named service anchors. **Aircraft services / Uçak servis noktaları** opens source-linked points and focuses the camera. Optional fittings, approximate drawing positions and unverified attachments are distinguished. Covers can open; tank regions and physical model envelopes can be shown. Overall geometry remains simplified and the nine-ray height screening is not a certified access/safety check. See [the source and validation specification](docs/operational-aircraft.md).

**ADB photo ground / ADB fotoğraf zemini** shows the cleaned user image on demand. It is an oblique illustration with adjustable position, size, rotation and opacity, not a survey. Settings persist with the scene. Satellite imagery remains available for comparison.
