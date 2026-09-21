# Mobile stability and GSE library · 2026-09-21

## Airport photo
The cleaned user-supplied ADB image is now the default **airport** ground. The facility keeps satellite imagery. A ground selector offers photo, satellite, overlay and plain ground independently for both modes. Existing objects and geographic coordinates are retained. The oblique photo is illustrative, not an orthophoto; its alignment remains editable and approximate. Ground choices and calibration survive browser saves and JSON export/import, including undo/redo.

## Mobile rendering
- Viewport size, orientation and pointer capability select the layout. Phones open in lightweight 2D. 3D remains available on request; its renderer and the R14 GLB are allocated only when requested. No user-agent sniffing.
- Pixel ratio capped at 1.25 on phones, 30 fps target, no multisample antialiasing on mobile. Canvas backing stores resize only when dimensions change. 2D painting is coalesced per animation frame.
- Flat ground, satellite imagery and the photo render in a separate ordered ground pass with depth writes/tests disabled. Depth is cleared before drawing the object scene. This removes millimetre-separated ground surfaces competing at kilometre camera ranges. The object renderer uses logarithmic depth.
- Existing satellite tiles stay visible until all replacement tiles are ready. A failed replacement retains the previous map. Cache and retained tile counts are bounded.
- WebGL context loss switches to 2D without replacing the scene. Restored 3D is offered manually, avoiding a retry loop.
- One-finger map pan, two-finger pinch and pan, and +/- controls. Touch dragging an object requires selecting it first. Pinching cannot place a new object. A cancelled gesture cannot select an object.
- Focus Selected remains available on mobile. Toolbars scroll horizontally; editing and service panels close independently so the map remains usable in portrait and landscape.

## Manufacturer-referenced models
One unit = one metre, +X right, +Y up, forward = -Z. Models are procedural, named modules. Main dimensions are nominal; detailed body shapes and unreferenced internal placements are simplified. No claim of certified manoeuvring, collision, or articulated coupling behaviour.

| Preset | Reference | Length × width × height (m) | Qualification |
|---|---|---|---|
| APRON_BUS | [TAM VIVAIR 104WL](https://www.tam-motors.eu/buses/vivair-104wl/) | 14.720 × 3.170 × 3.100 | Height with A/C; six side doors |
| BAGGAGE_TRACTOR | [MULAG Comet 4D](https://www.mulag.de/en/ground-support-equipment/products/towing-tractors/comet-4d/) | 2.940 × 1.450 × 2.220 | Cabin fitted; length excludes tow hitch; wheelbase 1.640 |
| BAGGAGE_CART | [Orientitan open baggage trailer](https://uld-equipment.com/2-1-open-airport-baggage-cart.html) | 4.141 × 1.500 × 1.262 | Overall including drawbar; deck 3 × 1.5 at height 0.560 |
| BAGGAGE_CART_LOADED | Same cart | Same envelope | Luggage is illustrative, not a manufacturer payload arrangement |
| BELT_LOADER | [MULAG Orbiter 7.5](https://www.mulag.de/en/ground-support-equipment/products/conveyor-belt-vehicles/orbiter-75/) | 7.800 × 2.190 × 2.109 | Cabin, transport stance; wheelbase 3.100 |

[TAM's linked datasheet](https://www.tam-motors.eu/wp-content/uploads/2018/05/data-sheet_vivair_view_bv_20180205_v2-prodaja-popravki.pdf) supplies wheelbase 8.210, front/rear overhang 3.270/3.240, track 2.156/2.538, floor height 0.350, and passenger door width/height 1.350/2.157 m. It is an older linked sheet; powertrain and capacity configurations are not inferred from it. MULAG dimensions vary by configuration (manufacturer says approximately ±5%). Orbiter belt: 7.5 × 0.6 m, front/rear transport heights 1.120/0.459 m; front maximum working height 4.125 m is metadata only, not an implemented lift animation.

Library cards expose source links and dimensions, then allow map placement or add-at-center-and-focus. Existing edit, rotate, duplicate, delete, undo, export and save work with the new vehicles. Vehicles are not pre-populated into the airport.

## Verification
`npm test` covers published GSE bounding dimensions and ground contact, existing aircraft anchor geometry, persistent object identity after transformations, legacy ID preservation, scene history/import, photo preferences, phone/landscape profiles, pinch anchoring, pointer selection guards, tile loading failure retention and ground material depth flags. `npm run build` validates TypeScript and the production bundle. `/mobile-preview.html` is a noindex responsive QA page using the actual app at 393 × 740 and 844 × 390; it does not emulate a physical phone GPU.
