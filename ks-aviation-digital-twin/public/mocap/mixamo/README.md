# Nathan laboratory — supplied Mixamo captures

`nathan-mixamo.json` contains the motion data extracted from the five FBX files
provided by the user on 2 November 2026. Original filenames and SHA-256 hashes
are retained in each motion's `source` record. Character meshes and textures
from those FBX files are not included.

The import is reproducible:

```sh
npm run prebuild
node scripts/import-nathan2-mixamo.mjs /path/to/the/five/fbx/files
```

The importer maps all 52 animated Mixamo bones onto Nathan's bind skeleton,
including hips, legs, feet and fingers. It retains the full captured timeline,
hip translation and original joint motion. World-space rotation deltas are
converted through each target parent; displacement is scaled once by the
relative thigh-plus-shin length. Remaining Nathan bone transforms are reset to
their bind values to prevent another clip leaking into the preview.

The captures are `Start Walking`, `Walking`, `Stop Walking`, `Ascending Stairs`
and `Walking Up The Stairs`. Starting and stopping include their original
standing frames. Each stair recording is a cycle cut from ongoing ascent and
begins/ends during a step; it is not a complete approach-and-arrival sequence.

For faithful playback, sample the animation mixer directly with a fixed scene
origin/ground offset. Nathan's facility controller normally cancels root
translation and solves both feet; that mode is intentionally not used for this
raw capture preview. Optional rail contact must use an arm-only post-animation
constraint so it cannot replace the captured hip, knee or foot motion.

Trajectory positions are in the native Nathan GLTF model coordinate space in
metres, facing +Z. Apply the actor's height scale and facing transform when
using them in the laboratory scene. `leftFoot` and `rightFoot` are fixed sole
points calibrated from the bind pose, not ankle joint origins.
