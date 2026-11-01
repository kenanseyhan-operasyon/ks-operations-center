# 21 October: wheel and equipment deck proportions

Applied to both R14 vehicle variants in the Nathan test project.

- The requested 5 cm reduction is interpreted as the complete tyre diameter:
  1,093.117 mm to 1,043.117 mm. Tyres, rims, hubs, bolts and ventilation holes
  scale together by 0.954259259. Axle centres lower by 25 mm to preserve ground
  contact, with matching axle rods, wheel arches and front mudflaps. Steering
  pivots and rolling distance use the new geometry and radius.
- Remove the long silver cab sill strips on both sides, matching the arrows in
  `image(20261021-093914).png`. The landing and black wheelhouse closure remain
  continuous.
- Shorten all six equipment deck risers by 100 mm, from about 219 to 119 mm.
  This is a modelling interpretation of the red line in
  `image(20261021-094342).png`, which contains no dimension. Keep their chassis
  seats fixed and lower the deck, complete scissor platform, panel, sample jar,
  both hose reels, couplings, worklight and bonding equipment together. The
  lower deck retains about 9.3 mm of clearance over the chassis rails.
- Keep the bottom platform step at 355 mm. Redistribute the next two steps
  evenly to the equipment deck; shorten their stringers at the top. Preserve
  the 150 mm forward platform extension and the full lift stroke. Platform
  floor heights are now 1.33745 m folded and 2.95526 m raised.
- The two supplied images do not show a replacement signal outline. Keep the
  existing front/side wraparound indicator pending that reference.

Validation uses the actual GLB in both chassis variants: wheel dimensions,
ground contact, concentric fixed arches, retained deck/riser contact, unchanged
source cache, steering clearance, 81 lift poses, connected 30 m hoses, Nathan
access/grasp and deadman interaction regressions. Local before/after geometry
renders inspect the cab, wheel arches and equipment deck. The cloud browser
cannot render WebGL; the deployed version badge is checked separately.
