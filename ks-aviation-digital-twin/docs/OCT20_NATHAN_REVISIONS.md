# 20 October: cab exit, ladder grasp and service equipment

The previous limb-endpoint checks did not catch the reported defects. An IK
endpoint can be correct while the rail passes through the palm, the wrist is
rotated backward, or the controller releases the sitting pose before the door
has opened.

## Changes

- Keep the seated pose in the actual controller's `preparing` state during cab
  exit. Door opening no longer switches Nathan to standing Idle on the seat.
- Restore the slender 22 mm curved seat-edge handrail. The right hand can use
  the outside upper part of the physical steering rim on the upper cab steps.
- Use separate left/right rail sets on the platform and vertical rear ladder.
  The procedural contact phase owns the torso, limbs and fingers instead of
  mixing incompatible poses from a looping climb clip.
- Solve grasp rotation and elbow direction together. Keep elbows below the
  shoulders and close to the body; distribute axial rotation into the forearm.
  During reach/release, orient the wrist after solving the arm. Preserve the
  preceding grasp solution when selecting the next elbow plane. Open the fingers
  and move the released hand between disconnected fixtures instead of snapping
  from the steering wheel to the side rail. Match the cab rail/seat phase boundary.
- Fit grasp centres to the actual skinned finger/thumb surfaces, with separate
  profiles for the cab/steering tube, rear ladder and square platform post.
  Calibrate the profiles in the same neutral pose, independent of the animation
  playing when Nathan first reaches a ladder.
- Release the handholds when both feet reach the ground.
- Centre the parked red coupling on the drum's hose exit, on its outward
  operating face. Rebuild the continuous hose through the rollers into the head.
  Place the bonding base 25 mm inside the deck's rear/outboard corner. A 240 mm
  wide bonding mounting plate removes the overlap with the coupling foot on the
  rigid vehicle without adding an extension to the deck.

## Regression coverage

`test:nathan-interactions` now loads the supplemental access clips and checks
actual head skin and seat contact throughout the controller's door-opening wait.
`test:nathan-grasp` checks anatomical forearm/metacarpal angles during ascent,
descent, reaching and release; the enclosed grip centre; hand-side ownership;
ground release; and triangle intersections between the real closed hand surface
and the actual square platform profiles. It runs in the Render prebuild gate.

`test:cab-reference` checks actual skinned body vertices against the roof, floor
and open door through the complete cab route. `test:vehicle-details` checks both
vehicle variants, equipment separation, corner placement and the joined hose.
The earlier door/mirror, inside-view, thumb, steering, access and movement checks
remain in place.

## Reference material consulted

The implementation uses the existing Nathan rig and existing supplied clips;
no unrelated rig or downloaded animation was substituted.

- [Unity Animation Rigging: Two Bone IK Constraint](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html): separate end target and bend hint.
- [Three.js CCDIKSolver](https://threejs.org/docs/pages/CCDIKSolver.html): articulated chain constraints and limits.
- [Epic Motion Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine): matching animation phases to physical interaction targets.

These references inform the approach. The analytic two-link solver, grasp
calibration and controller transitions are implemented specifically for this
model. Automated geometry checks and offline renders of the actual deformed
mesh supplement each other; they do not replace browser/GPU playback review.
