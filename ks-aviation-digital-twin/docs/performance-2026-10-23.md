# Smooth, shadowless training scene

The pre-optimization application and all original model inputs are preserved on
`backup/2026-10-23-before-performance`, commit
`9a25e4d355a747ab55532ddc15eac8b6ab41da04`.

Changes are confined to the 3D test application. No scene records, database
schema, cloud access rules, API configuration or credentials are modified.

- Disable shadow-map generation and remove the contact-shadow plane. Keep the
  daylight colours, reflections and day/night controls.
- Keep SMAA before tone mapping, with FXAA as the existing compatibility
  fallback. Remove stacked MSAA buffers and enforce a real render-pixel limit,
  including high-DPI screens. Small desktop views retain 1.5x sampling density.
- Compute Nathan's bone matrices once per bounds evaluation. The resulting
  skin bounds remain exact; grounding, IK, hand grips and animation clips are
  unchanged. All 57 sampled poses match the reference vertex calculations.
- Preserve the original 25,874,096-byte Nathan GLB. Build a separate
  6,497,380-byte runtime GLB using a 4096px JPEG, retaining every geometry,
  skinning and animation buffer byte. Texture metadata and JPEG completeness
  are checked during preparation. The original asset remains available.
- Merge rigid vehicle geometry within animation boundaries. Keep named
  collision/picking meshes and all moving components. Never merge across
  hinges, wheel pivots, articulated tank joints, changing cab surfaces or
  material-controlled lamps. Preserve mirrored winding.
- Reduce hose longitudinal subdivisions while preserving diameters, path
  lengths, endpoints and smooth cross sections. Replace repeated full-shell
  decal raycasts with a spatial index; preserve paint holes and surface fit.
- Avoid repeated closed-door matrix updates and hidden selection-box work.

Local CPU checks (Node, texture decoding mocked; these are not browser FPS):
walking update approximately 0.6 ms versus 4–5 ms; climbing approximately
2–3 ms versus 9–12 ms. Vehicle preparation was approximately halved. The
articulated vehicle has 377 potentially rendered meshes versus 853, with
476 fewer submissions when all parts are in view; the rigid vehicle saves 456.

Validation: TypeScript, production build, test-build verification, performance
regressions, Nathan animation/movement/access/grasp/interactions, cab geometry
and motion, vehicle details/surfaces, deadman, tank access transitions, ground
tools and shared-cloud regressions. Both vehicle variants retain the same
rendered coordinates at four combined animation/steering/articulation poses.
The available browser has WebGL disabled, so GPU timing and final hardware
image quality must not be inferred from these CPU checks.

Rollback: restore the tree of the preserved commit in a new commit on
`fix/nathan-grip-continuity`, then redeploy only `ks-gemini-nathan-test`.
This keeps history and restores the old rendering/model pipeline without any
database operation. Render's retained pre-change deploy is
`dep-dbdloc5g1s2s73budps0`.

To regenerate the runtime texture, extract the embedded JPEG from the archived
GLB, resize with Lanczos to 4096x4096, strip metadata, and encode JPEG quality
90 with 4:4:4 sampling. Update the numbered `runtime-texture-*.b64` chunks and
their SHA-256 metadata, then run the preparation and byte-equivalence tests.
