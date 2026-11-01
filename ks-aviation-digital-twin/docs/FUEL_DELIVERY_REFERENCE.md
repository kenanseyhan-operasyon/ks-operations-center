# Fuel delivery equipment — 21 October 2026

The parked equipment is original procedural scene geometry. Manufacturer literature informs its dimensions and appearance; it is not manufacturer CAD or a certified engineering design.

## References

- Eaton Carter 64200 pressure nozzle: [official brochure](https://www.eaton.com/content/dam/eaton/products/fuel-systems/ground-fueling/documents/eaton-64200-pressure-fueling-nozzle-brochure-tf100-100c-en-us.pdf). Two-inch inlet, three aircraft-adapter lugs, silver cast body, nose bumper, twin grips, operating lever.
- Elaflex ZVF 25 JET overwing nozzle: [official catalogue, pages 537–538](https://elaflex.de/dokumente/download/Catalogue/CatPage537_538.pdf). One-inch inlet, manual deadman trigger and 52 × 70 mm JET spout profile.
- Elaflex aviation hoses: [official catalogue, pages 107–108](https://elaflexus.com/downloads/aircraft-refueling/aviation-refueling-hoses/CatPage107_108_US.pdf). DN25 and DN50 visual outside diameters of 37 and 66 mm; corresponding minimum reel-core diameters of 200 and 400 mm.
- [Hannay aviation reels](https://www.hannay.com/en-US/industry/aviation/) provide general aviation-reel context. The compact upright reel is a custom scene arrangement fitted to the user's marked bay.

## Scene implementation

Both hoses contain 30 m of continuous centreline including their exposed tails. The two-inch delivery hose remains on the large upright reel; its pressure nozzle is docked directly in front of the exit guide. The one-inch overwing hose uses a separate vertical reel in the user's XX bay, with a slip-in nozzle holder at X. The bonding base remains at the rear/outboard deck corner. Both vehicle variants use this arrangement.

The layered windings retain circular sections despite inherited model scaling. Their 404 mm / 203 mm core diameters, flange clearance, independent strand separation, tail joins, deck support and guide apertures are checked in `tests/vehicle-detail-review.test.ts`. The labels identify JET A-1 and the smaller reel's hose capacity. This change models parked equipment; it does not introduce hose deployment, fluid simulation or refuelling procedures.

The corner indicator is a separate continuous amber lens across the existing front/side triangular recess, with a narrow gasket and curved corner. It stays fixed to the cab body, shares the existing indicator/hazard controls and is hidden with cab trim in the interior view.


## Deadman cabinet and operator interaction

The new cabinet replaces the hanging yellow spiral and generic block beside the meter. Its hinged lid encloses a wound yellow cable and a removable normally-open hand switch, following the appearance of [GNY electric deadman handles](https://www.gnyequipment.com/gny-electric-deadman-handle/) and [Liquip deadman assemblies](https://www.liquip.com/products/aviation/accessories/deadman-assemblies). **40 m is the user's requested cable capacity**, not a quoted manufacturer specification.

Click the cabinet or select the vehicle's **Deadman · 40 m** button. Open the lid and choose **Nathan alsın**. Nathan walks to the cabinet, faces it, leans forward and grasps the switch with his right hand. The switch follows the calibrated finger cavity; a separate arm contact overlay preserves the left-arm swing and original walking animation. **İkmal izni için basılı tut** closes the simulated normally-open signal only while held. Pointer release/cancel, lost capture, key release, focus loss, hidden page, camera mode and closing operator control all remove permission. There is no latched on/off toggle.

The continuous live cable follows a grounded route and returns slack as the operator retraces his path. A step guard reserves 35 cm of the 40 m for hand animation, preventing overextension. **Kutusuna bırak** releases the signal, returns Nathan, seats the handle, withdraws the hand and closes the lid. The vehicle and ladder access remain unavailable while the handle is in use. Removing/moving the associated scene objects clears the ephemeral attachment. The cabinet, raised-lid state and carried-switch state do not alter saved fuel volumes or claim actual fuel transfer.

The pressure-nozzle bail has been removed to clear its operating lever. The large guide now sits behind the parked coupling. The smaller upright reel has its own four-roller guide behind the overwing nozzle. Both continuous 30 m fuel hoses remain parked equipment. `tests/deadman.test.ts` exercises the real Nathan skeleton, reach/return, walking, input release, cable routing and maximum payout; `tests/vehicle-detail-review.test.ts` checks both refueller variants and updated guide/flange clearances.
