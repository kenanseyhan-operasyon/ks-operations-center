# 19 October — second vehicle detail review

Reference: the nine annotated user screenshots ending 113746 through 120904.
Baseline: ab60d88cc2677eb3cf65a5c74eb8451889644d3c.

- Cab floor: remove the coincident rubber floor / metal landing / sill surfaces. The sill and landing meet the floor at separate boundaries. Remove both old white wheel humps from below the seats; close the wheelhouse top slot with fixed black panels. Exterior access trim still hides in the interior camera.
- Accelerator: length 120 → 180 mm, width 80 → 95 mm, centre 60 mm forward; rounded edges and tread strips. The right foot target follows the actual pedal. Brake geometry stays in its previous location.
- Platform stairs: first tread remains 355 mm above ground. Treads two and three are lowered to divide the rise to the existing equipment deck into three equal intervals (approximately 607, 858 and 1,110 mm). The equipment deck is level four, with no extra floating tread. Nathan uses this real deck before the moving platform landing.
- Front corners: mirrored amber triangular lenses with rounded corners fill the lower front-jamb recesses. They stay on the body and follow the left/right/hazard blink controls.
- Equipment order, front to rear: parked red coupling, drum, bonding. Drum and its complete roller frame move a further 50 mm aft. The hose is one constant-diameter tube from the outer winding, through the roller aperture and into the coupling. The wider rigid vehicle includes a deck tab supporting its bonding mounting foot.
- Rear ladder: both stiles and all eleven tread levels share a vertical fore/aft station. The stiles join the bumper mounting plates; short brackets join the tank. The roof walkway reaches the ladder directly.
- Tank rail: posts and upper rail are 100 mm taller. The old projecting handhold extensions are replaced with rounded transitions into the rail at the ladder. Horizontal rail animation is resampled from the real hinge arc so the joints remain connected during folding.
- Cab handholds: 22 mm diameter satin dark tubes, smaller mounting feet and a narrow seat-front return replace the long rail above the seat. Left/right contact pools remain independent, and hands release on the ground.

## Validation

`test:vehicle-details` loads the actual GLB for both articulated and rigid variants. It checks single visible floor surfaces, removed wheel humps, closed wheelhouse tops, pedal/foot alignment, corner-light blinking, equipment order/support, hose diameter and endpoints, straight ladder geometry, and 41 folded/raised railing poses per variant.

Existing cab reference, cab motion, Nathan interaction/access/movement and Gemini video regression suites remain required. The cab body check samples 202 skinned boarding/alighting poses; the hand-grasp check samples 620 contacts at 30/60 fps. TypeScript and the production Vite build are checked before deployment.

Visual checks use the application's real transformed geometry through an offline EGL renderer. This is geometry review, not a claim that the live browser's WebGL rendering has been verified.
