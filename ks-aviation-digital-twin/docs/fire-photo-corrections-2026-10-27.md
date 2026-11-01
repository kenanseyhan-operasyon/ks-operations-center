# ADB photo corrections — 27 October 2026

Based on the ten marked user images 062509–065052 and user clarification, on top of commit 6644101.

- Tank 2 foam and cooling branches drop through two 45-degree turns before the horizontal turn. Upper runs remain at the valve-port elevation. Shared centreline sections and remote crossing ramps removed.
- A is a capped, unvalved pre-control connection. B feeds the low perimeter monitor/hose circuit; it is independent of the six controlled branches. The DHMI feed now joins at the left low tee, keeping the foam-service side clear.
- Gate 4: remove invented above-ground source body and isolation valve. Model the ground entry, main feed and exterior capped twin-head connection. No changes to the other DHMI entry.
- Compact valve assembly rotated parallel to the existing boundary; shifted 0.60 m away from the foam shelter for access. Foam-row spacing 0.28 m, other valve spacing 0.38 m. Actual mesh envelope 2.488 × 2.180 m, office clearance approximately 1.13 m.
- Short metal concentrate pickup and small isolation valve; branch connections meet mixer top nipples. Operator approach checks cover both foam outlet valves and concentrate isolation within 0.95 m. This checks walking clearance, not a new hand-grasp animation.
- Add two grated foam sight-glass inspection landings with short ladders, bracing and rails. Cooling ring follows outside the projection; riser is beside the landing. Ring and riser are meshed separately to avoid an open rounded tee seam. Add visible sight-glass detail.

## Scope and assumptions

The user's measured 2.50 × 2.20 m bay and 0.90 m support traverse are retained. Other elevations, nozzle dimensions, landing/ladder dimensions and exact inlet positioning are visual fits, not surveyed measurements. The added short ladders are geometry; dedicated Nathan climbing interactions are not added in this revision. This is a training scene, not a hydraulic calculation.

All 187 baseline entities are retained. Reference migration 7 preserves operator-edited routes and valve states. Such edited routes can keep their old locations. No Supabase writes, schema, permissions, credentials or Operations Center changes.

## Checks

Fire network, panel, migration, independent centreline clearance, closed rings, gate fitting, Nathan office/foam access, compact mesh bounds and pipe editor tests. TypeScript and Vite production build. Exact mesh offline views inspected for manifold, gate and tank top. Render build performs the existing full prebuild regression suite.
