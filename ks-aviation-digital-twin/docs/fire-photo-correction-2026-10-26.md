# ADB fire routing and loading canopy - revision 6

Base: 77d82a96470e01cca7b5418a5e7fe1c71ff9074d on fix/nathan-grip-continuity. Scope is the test app only. No cloud scene write, database/schema/key/permission change or Operations Center change.

## Evidence and geometry

- User correction + PDF 1 page 1: the first manifold outlet bends are horizontal. All six water/foam routes leave the actual 0.77 m valve port plane and remain there through their first fence corner. Transitions to existing two-tier supports occur beyond the valve bay. The measured 2.50 x 2.20 m bay and 0.90 m transverse support bars remain unchanged.
- User image(20261026-193248).png + PDF 1 pages 5-8: the low perimeter main follows the fence to its far corner, turns and ends with one capped connection with a blue valve and red lever, beside a closed hose cabinet. The previous second default intermediate outlet is removed; operator-edited retired outlets survive migration. Exact endpoint station and cabinet setback are fitted to existing fence geometry, not surveyed dimensions.
- PDF 1 pages 3, 11-12: separate loading/receiving wall routes retain spacing and rounded turns; wall-bearing supports are added. Receiving turns across the notch and rises at the small roof column. Heights, support spacing and notch offset are model fits.
- PDF 1 pages 9-11/13 and PDF 2 pages 9-11/20: loading sprinkler feed follows the island curb and turns to a central column. Remove the invented -0.40 m channel depth. A surface grate represents the crossing; its unseen pipe span is explicitly omitted from the physical rendering/navigation while preserving hydraulic connectivity. `unverifiedSupplySpan` records this uncertainty and survives save/import. Editing the route explicitly overrides that automatic gap treatment.
- PDF 1 page 8 and PDF 2 page 20: the existing loading canopy entity gains a narrow yellow/white curb island, paired central white columns, broad roof with dark fascia and ribbed underside, existing SOCAR artwork, fixtures and two non-shadow-casting night spotlights. Existing entity ID, transform, scale and dimensions remain unchanged. Internal equipment is preserved, not claimed to be a detailed pump/filter reconstruction.

## Unresolved evidence

The separate fire-service connection BEFORE the valve group could not be unambiguously traced to the main in the supplied views. It has not been invented, conflated with the terminal outlet or assigned intake/discharge functionality. A marked close-up showing its branch to the main is needed to finish that item. Night lamp output and all unmeasured small dimensions are illustrative, not engineering specifications.

## Preservation and validation

Revision migration preserves `routeEdited` geometry and operating settings, including an edited retired hose outlet. Existing pipe editor, undo/redo, group stretch, underground visibility (off initially), simulation branches, vehicle/personnel work and source isolation remain intact. All 187 original entities retain identity and transforms. The loading roof's pedestrian collision uses its central columns instead of a solid canopy volume.

Checks: npm run test:fire, npx tsc --noEmit, npm run build including existing prebuild regression suites. Measured bay 2.488 x 2.108 m, office clearance 1.021 m; 192 office walking samples remain clear. Visual checks use rendered views of the bay, terminal, receiving passage, loading island and night lighting. The unknown covered span is excluded from physical clearance sampling because it is not rendered as surveyed pipework.

Rollback: deploy the retained 77d82a9 build. This is client-side reference geometry, not a database migration; saved operator edits remain authoritative. No existing manual route is silently replaced.
