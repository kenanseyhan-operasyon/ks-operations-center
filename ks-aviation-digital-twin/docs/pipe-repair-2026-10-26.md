# Pipe geometry repair and PDF comparison — 26 October 2026

Sources inspected: `adb tesis fotoları 1.pdf` (28 pages), `adb tesis fotoları 2.pdf` (25 pages), and user screenshot image(20261026-123046).png. All pages were visually surveyed; fire-pipe pages 1–8 in volume 1 were checked in detail. Original source PDFs remain unchanged.

## Confirmed defects and repairs

The former TubeGeometry sampled a complete route uniformly by distance, with roughly one sample per 50 cm. Short 16 cm elbows were skipped on long pipe routes, producing polygonal/chamfered corners and distorted tubes. Increasing total length also changed the appearance of the same elbow. Geometry now allocates one straight span and 16 subdivisions per curved fitting, explicitly preserving tangent transition points. Circular cross sections have 16 sides. Straight runs do not gain needless length-dependent subdivisions. Underground visibility and picking are retained.

The loading and receiving routes used identical points on the containment wall after their separate rack risers. Volume 1 page 3 shows two separate red runs; they now remain distinct through the risers and wall turns. A 24 cm coordinate offset is an illustrative fit, not a measured spacing. Revision 4 installs this correction while preserving user-edited routes (`routeEdited`) and saved valve states. Geometry repair also applies to user-edited paths.

Volume 1 pages 6–8 show a blue flanged valve body, red single lever and silver capped coupling beside the hose cabinet. The hose take-off now includes the blue valve body. Existing two reconstructed take-off positions remain provisional; photos do not establish every outlet's surveyed position.

## Photo-to-model comparison

- Volume 1 pp. 1–5: manifold, stacked foam/cooling runs, paired wall crossing, vertical tank risers. Corrected rounded bends and separate loading/receiving paths. Tank positions retained.
- Volume 1 pp. 6–8: low fire main, riser, hose cabinet and capped take-off. Body color/form corrected; cabinet count and exact take-off coordinates need reconciliation with a measured plan.
- Volume 1 pp. 8–15, volume 2 pp. 10–20: loading canopy has a broad dark SOCAR fascia, light underside and slender columns; green pump/motor assemblies, white filter vessels and black flexible hoses. Existing simple canopy and equipment are still simplified. These photos support a dedicated next modeling pass; they do not establish dimensions or all connectivity.
- Volume 1 pp. 16–28, volume 2 pp. 1–9: receiving/tank-side equipment, meters, valves, fuel filters, sampling vessels, grated platforms and yellow rails. Fuel-pipe connections must be traced separately from the red fire network; no invented operational hydraulic connection is added in this repair.
- Volume 2 pp. 21–25: office is a low light-colored building with dark fascia, SOCAR signs, windows, entry and adjacent marked walkway. Existing footprint retained. Night illumination cannot be verified from these daylight photos.

## Validation

Regression test compares actual mesh ring centers with all 17 elbow sample points between both short and 200 m straight runs. A second test prevents identical wall route points. Existing 187 original objects, independent circuits, editor undo/redo, underground toggle, vehicle corridor and migration tests remain in force. 178 mesh batches, about 158k vertices before the small valve body addition; existing 190k vertex budget retained. Numerical tests do not substitute for all real-world dimensions.

This repair addresses the reported visual regression and confirmed pipe overlaps. It does not claim the full fuel-system, canopy or nighttime reconstruction is finished.
