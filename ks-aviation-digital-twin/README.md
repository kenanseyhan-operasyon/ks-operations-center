# KS Aviation Digital Twin

TR/EN aviation workspace using Vite, TypeScript and Three.js. No Cesium dependency.

## Navigation and editing

- World and Türkiye camera views, then ADB Airport or ADB Facility.
- Airport and Facility share one scene; changing the camera never replaces objects.
- Design: click or Ctrl-click objects; Shift-drag selects a rectangle, or select a group in the list. In orbit mode W/E/R select move/rotate/scale gizmos in 3D. In 2D, drag a selected object to move it.
- Add aircraft, refuellers, tanks, buildings, trees and equipment; draw ground polygons, walls, fences and gates.
- Rename, change color, duplicate, group, ungroup, ground, undo/redo, save camera and import/export JSON.
- Edits stay in a draft until **Save**; **Discard & exit** restores the last saved state in this browser under `KS_DIGITAL_TWIN_ADB_V1`. Export JSON for a portable backup. Edits do not write to the old site's storage or Supabase.
- R14 loads lazily and has platform, railing and gate animation controls. The whole vehicle has a stable selection wrapper.
- The 2D satellite map/editor and 3D scene use the same records and history. 2D is available when WebGL is unavailable.

## Migrated data

`public/data/adb-legacy.json` contains 61 ADB objects and 4 groups from the user's `KS-KAYITLAR-20260915-101627.json` backup. Original IDs, geographic footprints, headings, dimensions, colors and groups are preserved. Terrain is a flat local map plane; historical terrain elevations are not treated as object elevations. One separately editable R14 is added on first load.

On 2026-09-20 the user authorized reading the old Supabase ADB record. Reads, including the post-deployment retry, returned HTTP 502. This version uses the dated backup, not an unverified latest cloud revision. No Supabase credentials are included in this app.

Import accepts the new schema, a legacy `KS_AIRPORT_3D_V2` ADB scene, or an old complete backup containing `airport3d.ADB.scene`. Import replaces the workspace and can be undone. BJV scenes are rejected in this ADB workspace.

## Maps

World: bundled Three.js earth texture with country-outline fallback. ADB: bundled, georeferenced Esri World Imagery rasters, with attribution. A fixed 3 × 5.1 km airport image and a 370 × 400 m facility detail use the same scaled EPSG:3857 coordinates as the existing objects. No zoom-dependent tile replacement occurs.

## Development

Run `npm install`, then `npm run dev` or `npm run build`.

Prebuild reconstructs the validated 6,437,208-byte GLB from `model-parts/`. Render watches only the `ks-aviation-digital-twin` branch, builds this directory and publishes its `dist` directory. The root `index.html` and `main` branch are unrelated to this release.

Run focused data/geometry checks with `npm test`. They verify all 61 objects and 4 groups, geographic coordinate round trips, mesh ground placement, stable object identity during transforms, undo/redo, deletion recovery, and invalid import rejection. 3D visual QA still requires a WebGL-capable browser.

## Operational aircraft and photo ground

A320 and B737 catalogue objects now use variant-specific dimensions and named service anchors. **Aircraft services / Uçak servis noktaları** opens source-linked points and focuses the camera. Optional fittings, approximate drawing positions and unverified attachments are distinguished. Covers can open; tank regions and physical model envelopes can be shown. Overall geometry remains simplified and the nine-ray height screening is not a certified access/safety check. See [the source and validation specification](docs/operational-aircraft.md).

**Airport and facility now default to the same static ground.** Navigation only changes the camera. Older per-view ground preferences migrate to this shared default, without moving any object. The cleaned user photo remains an optional reference; its perspective prevents a globally accurate alignment. Ground settings are shared across both views.

## Phone support and vehicle library

Phones automatically open the lightweight 2D workspace, with 3D on request, pinch controls and an adaptive portrait/landscape layout. The GSE library contains five manufacturer-referenced models: TAM apron bus, MULAG baggage tractor and belt loader, and empty/loaded Orientitan baggage carts. See [mobile changes, sources and tests](docs/mobile-and-gse.md).

## 2026-09-22 design update

- **Serbest dolaşım / Free navigation:** drag to look in 3D, W/A/S/D to move horizontally, Q/E to change elevation, Shift for speed; touch camera pad. The camera does not continuously look at the scene center. Minimum camera height is 0.25 m.
- Ctrl-click, Shift-box selection and dragging selected objects work in 2D/3D; arrows and the lower-right pad move selected objects.
- Buildings expose independent width/length/height and short/long-side door position. Tanks and walls expose radius/thickness.
- Save/discard is explicit. Navigation and closing a dirty design ask what to keep; storage failures preserve the previous save. JSON remains the way to transfer scenes between devices. No new cloud authentication or shared writes are enabled.
- New manufacturer-envelope models: Gulfstream G500, Citation Latitude, King Air 360 and Cessna 172S Skyhawk. These are simplified measured envelopes, not validated servicing meshes. Primary sources are linked in each library card.
- World panel includes operation layers and the old 13-link sea/road logistics topology. Animated routes are schematic training connections, not real navigable routes, dispatch data or elapsed transport times.
- `ground-parts/` stores transport-encoded map images; prebuild verifies SHA-256 and reconstructs the two WebP files. Images were exported from the existing Esri World Imagery service on 2026-09-22. The manifest retains exact returned extents.
- Legacy scene migration, static-ground alignment/mesh retention, saved-state recovery, geometric envelopes, camera inputs and selection gestures have automated checks in `npm test`. Hardware WebGL appearance still needs user-device inspection.
