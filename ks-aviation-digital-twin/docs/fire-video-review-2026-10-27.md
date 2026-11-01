# ADB video corrections — 27 October 2026

Base: remote branch fix/nathan-grip-continuity at 39a4195be229bc5dcbf1c99930e2365e1df30afa (also confirmed on the live page). Preserve that revision's gate connections, lower tank branches and inspection access.

Evidence: MicrosoftTeams-video (9), (10), (11), (12), and image(20261027-081522).png. All four clips inspected through timestamped frames, with close views of the fittings and canopy.

- Videos 9 at 15–24 s and 10 at 0–6 s show a metal concentrate tee with two separate blue-handled small valves, unions and elbows into the mixers. Add independent valves to the existing network; preserve the main isolation valve and its state. Closing one small valve removes concentrate only from its own mixer.
- Videos 10–11 show parallel straight valve exits and fence turns. Rotate the exit approach consistently with the bay, rather than rotating only its first vertex and leaving a kink. Preserve the previous revision's lower Tank 2 routes; no new rise at the valves. The measured bay remains 2.488 × 2.180 m, with approximately 1.132 m office clearance. The 0.90 m transverse supports remain unchanged.
- Video 12 at 6–18 s shows the receiving wall crossing and column rise. Remove the unnecessary return at the wall notch. At 21–29 s the pipe turns under the canopy, has two intermediate downward branches and a final downward return. Reconstruct that topology; join the inlet on a straight section to eliminate the pointed overlapping bend visible in the supplied screenshot.
- Video 12 at 24–29 s shows two hanging round ceiling luminaires and their adjacent cable support. Add these to the receiving canopy, linked to the existing day/night switch, with two lights and no extra shadow passes. Preserve loading canopy lighting.
- Pipe editor: add single-vertex and single-section movement with X/Y/Z forward/back/up/down controls and a centimetre step. Equipment ports remain locked; inserting an interior point permits adjustment beside a port. Changes use the existing undo/redo and mark routeEdited. Existing bulk stretch/move and point table remain available.

Distances, fixture sizes and unmeasured elevations are visual fits, not field survey data. No unseen channel depth is introduced. User-edited routes are retained by revision 8 and can therefore continue showing the user's old geometry. No Supabase operations, credentials, permissions, or Operations Center changes.

Validation: npm run test:fire, npx tsc --noEmit, npm run build (full existing prebuild regressions), independent small-valve isolation, single-point/section edit and undo/redo, straight receiving seam, terminal drop, night lights, migration and existing clearance checks. Local WebGL views inspected for valve bay, receiving day/night and concentrate fittings. Live cloud browser reports WebGL unavailable; it can verify the deployed build but cannot independently verify live 3D rendering.

Geometry budget remains bounded; the two added valves and luminaires bring the reference to about 202 meshes / 191k vertices. Static material batching and elbow subdivision strategy are unchanged. Rollback: redeploy 39a4195be229bc5dcbf1c99930e2365e1df30afa.
