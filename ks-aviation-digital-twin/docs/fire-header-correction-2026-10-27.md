# Valve bay inlet and elbows — 27 October 2026

Base: 431f3677a87d1f3595b9ca186513bffbc7d745cc. Evidence: user-marked images 112440, 112646, 112930, 113033 and renewed close inspection of videos 9–11.

The previous revision incorrectly extended the DHMI feed past the foam-side end, fed the other end through a low tee, and used diagonal descending spans. The marked arrows supersede that interpretation.

- DHMI now turns at the foam-side end, runs low beside the foam valves, rises vertically, and enters the distribution header. Remove the crossed-out continuation along the fence beyond that turn.
- Header diameter is 0.150 m versus 0.1016 m branch diameter. This is an explicitly provisional visual fit; the user specified a larger header but no measured diameter. Header inlet bend is part of the same continuous pipe mesh. The capped connection retains its original axial direction.
- The opposite header end continues parallel to the valve outlets before an upright drop and low fence turn. Remove the former outward loop beside the office.
- Lower Tank 2 branches stay level from their valves to the turning point, then descend vertically through rounded elbows. No diagonal ramp remains. Upper branches stay level.
- Revision 9 preserves routeEdited, existing equipment identity, valve state, editor/undo/redo, canopy lighting and other prior work. No Supabase or Operations Center changes.

Checks: all independent centreline clearance tests, office walking samples, 2.488 × 2.180 m bay and ~1.132 m office clearance. Added assertions for foam-side supply, low approach, upright rise, larger header and opposite-end source topology. Local bay/foam WebGL views inspected. TypeScript and full production build required before publication. Previous version for rollback: 431f3677a87d1f3595b9ca186513bffbc7d745cc.

## Revision 10 — collector elbows and direct point editing

Supersedes revision 9's opposite-end B routing. Reviewed user images 185731,
185956, 190356 and the additional video still 191344 alongside the previous
112440/112646/112930/113033 annotations and Teams video frames.

The collector now owns both end elbows. Smaller pipes join on straight tangents
with short diameter transitions, including after a manual header edit. The B
outlet has an upper turn parallel to the valve branches, a full straight before
its vertical drop, and a third elbow into its low fence lane. All valve-bank
coordinates use the same fence frame; selectively rotating route vertices no
longer introduces bends into otherwise straight runs. The two wall-top runs use
parallel offsets and intersections instead of independently displaced corners.

Model fits, not site measurements: 150 mm collector, 101.6 mm branches, 12 cm
reducers, B's 1.3 m fence offset and 24 cm wall-pipe spacing. The full valve-bank
mesh measures 2.4880 × 2.1879 m in its own aligned frame, with 1.1316 m geometric
office clearance. The requested 2.50 × 2.20 m envelope and 90 cm crossbar remain.
No hidden drain depth is established by these pictures.

The pipe editor displays numbered point handles at the actual pipe elevations.
Drag a point horizontally; use the six direction buttons to move one point or
one straight section, including vertically. “Düz hizala” interpolates internal
points between two fixed boundary points. Connected pipe endpoints move their
adjoining vertex; equipment ports remain fixed, with a plus control to insert
an editable interior elbow. Whole-entity dragging is disabled while this panel
is open. Each drag is one undo operation; viewer permissions remain enforced.
Existing routeEdited entities retain their saved geometry through migration.

Validation: npm run test:fire, TypeScript, production build; additional tests for
three orthogonal B turns, tangent mesh seams, reducer end radii, constant wall
spacing and rounded-pipe clearance (minimum 91.1 mm among sampled independent
bay runs). Local Chromium tests cover point drag, isolated vertices, undo/redo,
straightening, vertical nudge and viewer denial. Local WebGL views inspect the
bay, both collector ends, wall runs, filling/receiving transitions and night
lights. Automated checks do not establish unmeasured field dimensions.

## Direct section selection — 28 October 2026

A design-mode click on a rendered pipe now resolves its actual supply/concentrate
route and nearest straight section, instead of moving the valve entity. The panel
asks for Single section or Group; Group accumulates individual sections across
routes. Orange overlays show the current route's selected sections and the panel
lists every selected section by name. Six direction controls move selected
vertices once, in one undo transaction. Equipment endpoint positions are retained
by adding connecting spans when the selected section includes those endpoints;
connected equipment and source-pipe geometry are not silently dragged.

The operator can choose a supply start explicitly by clicking a main pipe. Both
source ID and the projected tap (stored in source-local coordinates) are persisted;
source taps follow that source's transform and are included in render cache keys.
This changes the hydraulic source too. It is an explicit user operation, not a
photo-derived automatic route correction. Existing intermediate points remain
editable/removable with the point controls. Independent endpoints support section
length adjustment; attached equipment endpoints retain their connection constraint.

Undo/redo and point insertion/removal clear the section selection so stale indices
cannot move a different segment. No reference migration or default monitor route
was changed in this update. Existing routeEdited data and simulator controls remain.

Validation: fire suite plus new pipe-selection regressions; TypeScript and build;
local Chromium/WebGL clicks on MONITOR 4 and MONITOR 3 supply routes, single/group
movement with unchanged neighbouring objects, and explicit clicked B-source tap
with undo. Cloud browser publication check is separate from local WebGL QA.
