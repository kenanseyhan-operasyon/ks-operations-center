# Axor day-cab reference and verification

Scope: the cab and its access on the test branch's existing 2000/3000 refuellers. This is a dimensioned adaptation of the project's custom GLB. It is **not an OEM CAD asset**, a certified reconstruction of a particular VIN, or a dimensional certification of the complete tanker/chassis.

## Primary reference

Mercedes-Benz / Daimler AG, **The Atego. The Axor — Distribution. 7.5–26 tonnes**, publication date 29 July 2011, imprint `TE/SM3 4500·0137·02-UK-03/0911`.

- Manufacturer-authored brochure, hosted by a document mirror: https://www.linardos.gr/brochures/brochures.specific/brochures.chassis.cab.trucks/MERCEDES-BENZ/MERCEDES-BENZ_ATEGO_AXOR.pdf
- **Printed p.42 / PDF p.43**: Axor day-cab side and plan drawings. Do not confuse these with the Atego drawings on printed p.24.
- Printed p.45: non-slip treads and handles on both sides of the entrance.
- Retrieved file SHA-256: `3de837387fbe397afbf4258efe272f7a96d24f639608a4c5233dea29a27d8384` (6,957,374 bytes).
- The original brochure is not redistributed in this repository.

A second Mercedes-Benz Axor brochure states 90-degree doors (PDF p.17): https://m.mengerler.com/AppFiles/newvehicle/81c15ea8662542608c06e72a1dd60da9.pdf . Its chassis variants are not treated as an exact identity match for the project's tanker.

## Dimensions and provenance

All values below are at the application's nominal **13.5 m vehicle length and scale 1**. User scaling scales the whole vehicle, including its cab.

| Feature | Model value | Evidence / limit |
|---|---:|---|
| Day-cab exterior length | 1,650 mm | Printed dimension, p.42 |
| Exterior width / fender envelope | 2,490 mm | Printed dimension, p.42; does not include mirrors |
| Interior width | 2,000 mm | Printed dimension, p.42 |
| Interior floor-to-headliner height | 1,510 mm | Printed dimension, p.42 |
| Exterior floor-to-roof height | 1,591 mm | Dimension in side drawing, p.42 |
| Steering-wheel outer diameter | 450 mm | Dimension in side drawing, p.42 |
| Lower → middle → upper → floor rises | 277 / 286 / 263 mm | Dimensions in side drawing, p.42 |
| Door opening angle | 90° | Second manufacturer brochure, PDF p.17 |
| Main shell width | 2,295 mm | Drawing-derived shared cab-body proportion; not a printed Axor shell-width dimension |
| Front-to-front-axle centre | 1,510 mm | Estimated from the side drawing; not an explicit dimension |
| Ground-to-floor height | 1,200 mm | Integration assumption for existing tyres/chassis; varies with configuration/load |
| Tread heights above ground | 374 / 651 / 937 mm | Derived from assumed floor height and printed rises |
| Tread size / longitudinal centre | 520 × 240 mm / 440 mm from front | Drawing/photo-derived integration dimensions |
| Grab-handle mounts, pedal/seat/eye positions | Parametric model coordinates | Fit to source layout and supplied photos; not manufacturer-coordinate measurements |
| Platform assembly offset | 355.25 mm aft | Project integration clearance, not an Axor specification |

The truck photographs supplied in this conversation guide the recessed stepwell, fixed handholds and complete door leaf. Exact panel curvature, trim, upholstery, chassis wheelbase, steering sweep tolerances and hand/finger grip anatomy are not established by this brochure. Factory STEP/CAD or a bodybuilder chassis drawing for the exact truck would be needed for that level of matching.

## Implementation

- `src/cab-reference.ts` holds the nominal units and provenance.
- `src/cab-geometry.ts` refits cloned cab vertices, removes the previous overlapping step/fender correction, builds attached recessed treads, and moves the fixed/lifting platform assemblies together to clear the corrected front axle.
- `src/vehicle-cab.ts` builds a matching floor/headliner/interior, cut-out door opening, mounted handles, and a 90° complete leaf carrying its glass, trim, lettering and upper-step cover. In-cab view fades window borders and corners; exterior materials return on exit.
- `src/nathan-driver.ts` uses actual tread/threshold/seat/pedal/wheel anchors. The body stays outside the sill while stepping, crouches for the lintel, then transfers onto the seat. Descent reverses the cab-facing climbing clip over the same contacts.
- Cached source GLB data, Nathan assets, existing animation target names and scene persistence are retained. Nothing is published to the main branch or production service.

## Verification

Run `npm run test:cab-reference` for independent geometry measurements, steering/step clearance, door hierarchy and sampled skinned-body clearance. Run `npm test` for the existing vehicle, camera, touch input, ADB navigation, library/persistence, gate/lift/boarding and animation suites. Build the isolated site with `VITE_KS_TEST_SITE=1 npm run build` and `npm run verify:test-build`.

`scripts/inspect-cab.ts` exports offline projected geometry into `CAB_QA_DIR`; it does not start a browser or connect to a live scene. These are depth-buffered diagnostic images without GPU materials/textures, not browser screenshots. Actual desktop/phone WebGL appearance and hand/finger articulation require device review; passing geometry and JSDOM tests does not establish those.
