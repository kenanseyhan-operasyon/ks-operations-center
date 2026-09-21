# Operational aircraft geometry · 2026-09-21

## Scope and coordinate contract

Profiles: A320-200 / CFM56 / Sharklets, and B737-800 / CFM56-7B / winglets. Other aircraft remain legacy visual placeholders. One scene unit is one metre. Local +X is starboard, +Y is up and -Z points towards the nose; origin is halfway along overall length at apron elevation. Published aft-of-nose stations become `z = station - length/2`. Heading rotates the whole aircraft, mesh and anchors together. Original entity IDs, positions, groups and user scale are retained. Canonical A320/B737 dimensions replace the old rounded catalogue dimensions. A 1:1 reset is available.

Independent profiles live in `src/aircraft-specs.ts`; named geometry and service anchors live in `src/aircraft-model.ts`. A future GLB can replace the visual mesh without changing the point definitions. Fuselage/wing surfaces, pylons and door movement are simplified; published overall dimensions do not make every surface a measured aircraft envelope.

## Sources

- [Airbus A320 Aircraft Characteristics, 1 July 2026](https://mediaassets.airbus.com/pm_38_916_916266-iujedqawwy.pdf?fileName=aca32001-jul-2026-2.pdf)
- [Boeing 737NG D6-58325-7 Rev C, October 2025](https://www.boeing.com/content/dam/boeing/v2/airports/acaps/737NG_REV_C.pdf)

Page numbers below are one-based PDF pages. Source documents are linked, not redistributed.

| Reference | A320-200 Sharklets | B737-800 winglets |
|---|---:|---:|
| Overall length | 37.57 m | 39.47 m |
| Span | 35.80 m | 35.79 m |
| Chosen nominal tail height | 12.00 m | 12.55 m |
| Fuselage width | 3.95 m | 3.76 m |
| Nose gear station | 5.07 m | 4.09 m |
| Main gear axle station | 17.71 m | 19.69 m |
| Main gear track | 7.59 m | 5.72 m |
| Dimension source | PDF 46–47, §2-2-0 | PDF 35, §2.2.6 |
| Load/attitude clearance source | PDF 55–56, §2-3-0 | PDF 40, §2.3.3 |

## A320 service reference values

Coordinates are aft of nose / RH offset (+), LH offset (-) / mean above-ground height, metres.

| Point | Station | Offset | Height | Source PDF / section |
|---|---:|---:|---:|---|
| RH refuel coupling, 622HB | 17.59 | 9.83 | 3.65 | 254 / 5-4-6 |
| Refuel control panel, 192MB | 16.40 | 1.80 | 1.80 | 254 / 5-4-6 |
| NLG grounding stud | 5.07 | 0 | 0.94 | 238 / 5-4-2 |
| External electrical power, 121AL | 2.55 | 0 | 2.00 | 250 / 5-4-4 |
| High-pressure air, 191DB | 12.98 | -0.84 | 1.76 | 260 / 5-4-7 |
| Low-pressure air, 191CB | 12.45 | -1.11 | 1.73 | 260 / 5-4-7 |
| Potable water, 171AL | 31.30 | -0.30 | 2.60 | 282 / 5-4-9 |
| Waste service, 172AR | 31.30 | 0.80 | 2.80 | 286 / 5-4-10 |

LH fuel coupling is optional and hidden by default, using the mirrored 522HB coordinates only for the applicable configuration. Grounding/earthing terminology is retained: this source alone does not establish approval to attach a fuel vehicle's bonding cable to that stud.

Cargo/passenger door stations and sill-height references come from Airbus PDF 80–87 and 55–56. Lateral surface positions are approximate, so their complete 3D points carry the `diagram` quality rather than `table`. Covers are a visual interaction; door mechanics, interior apertures and belt-loader contact geometry are not validated.

## B737 validation boundary

Ground-service positions are approximately digitized from PDF 153 / §5.4.5, not numerical connection coordinates. Cargo/passenger reference heights also use PDF 40. The refuel control panel is not independently located in the source used here. Neither it nor a bonding attachment is exposed as a usable 3D point. They remain visible as disabled pending items. Do not silently substitute a general earthing point or the coupling's station for either.

GPU electrical power and ASU starting air are distinct systems. Aircraft fuel tank boxes are schematic region labels; they do not define volumes, capacities, fuel transfer logic or tank boundaries. Engine and gear boxes are physical model envelopes, not running-engine danger zones.

## Camera and height screening

Service focus flies to a point, then releases the camera. User input cancels an in-progress flight. Full azimuth and below-wing views are allowed; camera height is clamped above the apron. The 2D view uses the same transformed anchors.

Height screening samples nine upward rays over the current vehicle world bounding rectangle against the selected aircraft mesh and subtracts the current vehicle top. Animated geometry is included. It is a conservative, sparse model check, not swept-path collision detection, certified underwing access or a safety clearance. A positive result is not labelled safe; the UI states the missing load/suspension/margin checks. Scaled aircraft must be reset to 1:1 first. Fuel sequencing, bonding validation and live tank/valve simulation are not implemented by this change.

## ADB photo ground

`public/textures/adb-ground-clean.webp` is derived from Kenan's attached airport image. Image generation edited that image to remove baked aircraft/shadows, title, north arrow and scale bar while preserving the camera, runway layout, buildings and roads. The clean PNG was converted to WebP (quality 86) for delivery; the original upload is not modified.

Edit prompt intent: remove all aircraft and their shadows; remove overlay labels, arrow and scale; inpaint matching pavement/landscape; retain terminal, airport geometry, perspective and runway markings; invent no new geometry.

This oblique image is illustrative, not georectified. A single affine transform cannot recover a survey from perspective imagery. It is an optional layer; satellite imagery remains the default. X/Z, width/depth, rotation and opacity can be adjusted without moving any scene entities. Settings persist in browser saves and JSON import/export, and participate in scene undo/redo. The illustration is not used to derive aircraft/service dimensions.

## Verification

`npm test` covers legacy IDs/groups/coordinates; stable transforms; undo/redo/import; aircraft bounds and tyre ground contact; exact A320 table anchors; omitted optional and pending anchors; transformed world locations; cover node persistence; wing interception at the fuel station; and photo calibration serialization. `npm run build` checks TypeScript and production bundling. CPU-rendered 3D previews support geometry inspection; they do not substitute for interactive WebGL testing on the target computer.
