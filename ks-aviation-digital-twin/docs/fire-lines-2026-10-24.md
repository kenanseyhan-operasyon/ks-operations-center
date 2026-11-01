# SOCAR ADB fire-water and foam training model

Photo/video alignment revision 2, 25 October 2026. The application enriches the existing ADB scene on the client. All 187 original entities, their identities/transforms and vehicle routes remain in place. No Supabase record is published or updated. The read-only revision-6 snapshot remains in `backups/adb-before-fire-lines-revision-6.json`.

Git backups: `backup/2026-10-24-before-fire-lines` preserves application commit `3d06d9376e35d350c4392501c8111574e0a64eee`; `backup/2026-10-24-before-photo-alignment` preserves `06f83070651b4e8b8cd656ccd85cf5db9123004d`. A recovery checkpoint is also retained on `work/2026-10-25-fire-photo-alignment`.

## Evidence and placement

| Supplied source | Observed relationship used in the model |
| --- | --- |
| Lexmark 24-10-2026 070258 / 070432 | Site arrangement, tank/building context, perimeter routes; red water and yellow foam legend |
| 070540 | Electrical/site context only; electrical lines are not modeled as fire pipes |
| 070718 / 070742 | Four-inch water pipe labels and partial site plans |
| 070859 / 070939 | P04 connectivity: two DHMİ feeds, water header, two eductors sharing a concentrate pickup, FC-01/02 tank foam chambers |
| Photos 69(3), 72(3–5), 73(1,4,5), 74(1–4) | Six-valve bank immediately beside the foam storage shelter, west of it; operating side faces the offices; short common concentrate pickup |
| Photos 75(4), 76(1–2) | Facing the bank: Tank 2 foam, Tank 1 foam, Tank 2 cooling, Tank 1 cooling, loading, receiving |
| Photos 76(4–5), 77(1–3), 79(2–4); Teams clip 11 | Six lines run on two-level supports along the western fence behind the offices |
| Photos 80–85; clip 12 | Raised crossings over containment wall, tank risers, red cooling and yellow foam lines |
| Clip 12 at 6 s | Readable **MAL KABUL ADASI** label on the red line at the containment corner: receiving is present in the supplied videos |
| Clip 12 at 10–28 s, clip 13 at 0–18 s, photo 87(1) | Small metal roof at the containment recess, by the FS01/product-recovery equipment |
| Clip 14 at 0–4 s / 6–12 s | Separate large SOCAR loading canopy; protected island-edge piping, grated channel and pendant sprinkler placement beneath the roof |
| Photos 2, 8, 10–13, 38, 47, 58–65 | Low red main follows landscaping/fence edges; entrance and vehicle apron are not crossed by exposed low pipes |
| Photos 10, 44–45, 58(1), 63(1,3), 79(3,4) | Monitor-local foam drums and visible pickup hoses |

Six videos were visually reviewed at two-second intervals with detailed frames for distinguishing features, alongside 71 photos. Audio was not transcribed. Source images/videos are not included in startup downloads.

## Resulting geometry and connectivity

The manifold is placed beside the existing foam shelter using the photographed valve order. A short concentrate pickup replaces the prior cross-site suction route. The two existing storage tanks remain in place; only the first supplies the common pickup, with no undocumented automatic crossover to the second.

Six parallel supply lines turn around the perimeter and follow a two-level fence-side rack. Tank branches rise over the existing containment wall and continue to the cooling rings or foam chambers. The former combined loading/receiving roof assignment is replaced by two separate zones: the existing large loading canopy and a small reconstructed receiving roof at the containment recess. Sprinkler risers follow roof columns. Pipe routes follow current saved fence and wall geometry instead of crossing the open vehicle apron.

Where the loading connection or entrance route is hidden, the visualization uses a below-grade segment at an **illustrative -0.40 m**, not a measured trench depth. The SVG uses dashed segments and an explicit qualification. The visible placement relationships are evidenced; precise concealed routing is not.

Four monitors retain their original coordinates and outlet settings. Each has an independent water isolation valve and a pickup hose to its nearest existing local foam drum. Emptying a local drum leaves that monitor on water and does not disable other monitors. Unknown mixture ratios stay unspecified. Generic monitors without local pickups and existing explicitly configured eductors retain their behavior.

## Interaction and migration

The `Yangın hatları` panel operates the existing transient `FacilityNetwork`: start/reset/stop never changes saved design settings. Ten independent circuits can be selected and operated. Water cooling/sprinkler branches do not inherit concentrate from foam branches.

The SVG is generated from the same 3D connection paths; its download and checked-in `public/reference/socar-adb-fire-lines.svg` show the same separation and placement. Both foam stores, site boundaries, manifold and separate roofs are labeled.

A versioned client-side migration replaces only old reference-generated `adb-fire-` entities in the reference group, preserving explicit valve/source states, ratios, capacity, volume and flow settings. Other designer objects are retained. Revision 2 is idempotent; later edits or deletions are not continually regenerated. The real v1 fixture tests this upgrade path.

Nathan navigation uses the actual reference pipe segments and elevations rather than generic equipment boxes at their metadata origins. Below-grade connections do not block ground walking, elevated sprinklers do not create phantom ground obstacles, and the new receiving roof is represented by its posts and roof. Existing character motion and original geometry remain unchanged.

## Remaining verification limits

This is a source-based training reconstruction, not a surveyed as-built or hydraulic design. The following remain unmeasured or unconfirmed:

- Absolute survey coordinates, exact pipe elevations, concealed routes/depths, roof dimensions, support spacing, nozzle spacing/count. Roofs/supports/nozzles are visual reconstructions fitted to the current model.
- Physical DHMİ source positions and monitor label mapping. P04's two-feed split is retained; the north/east pair is assigned to feed 1 and the south/west pair plus manifold to feed 2, pending field confirmation.
- Second central foam-store selection and any hidden crossovers; no automatic crossover is invented.
- Mixture percentage, pressure, flow, losses, discharge reach or extinguishing effectiveness. Only explicit designer ratios/flow rates can enable consumption; none is fabricated.

## Verification

`npm run test:fire` covers preservation of all 187 original objects, save/validation roundtrip, idempotence, migration from real v1 data, independent source/circuit isolation, water/foam separation, local monitor drum depletion, UI reset/stop/focus and explicit ratio editing. Alignment tests check photographed valve order, distinct roofs, short suction length and 8,498 sampled pipe points against the vehicle corridors. Nathan checks cover existing clear lanes, buried pipes, elevated outlets and open canopy interiors.

Generated reference geometry is bounded to fewer than 160 mesh batches and 190,000 vertices (current result: 155 batches, 137,889 vertices). No new media downloads, textures or runtime libraries are added. Existing facility/detail/library tests and production prebuild regressions must pass before deployment. This is a bounded geometry check, not an FPS guarantee.
