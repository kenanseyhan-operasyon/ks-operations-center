# Nathan laboratory — supplied Mixamo captures

`nathan-mixamo.json` contains the motion data extracted from the seven FBX files
provided by the user on 2 November 2026. Original filenames and SHA-256 hashes
are retained in each motion's `source` record. Character meshes and textures
from those FBX files are not included.

The import is reproducible:

```sh
npm run prebuild
node scripts/import-nathan2-mixamo.mjs /path/to/initial/fbx/files /path/to/new/fbx/files
```

The importer maps all 52 animated Mixamo bones onto Nathan's bind skeleton,
including hips, legs, feet and fingers. It retains the full captured timeline,
hip translation and original joint motion. World-space rotation deltas are
converted through each target parent; displacement is scaled once by the
relative thigh-plus-shin length. Remaining Nathan bone transforms are reset to
their bind values to prevent another clip leaking into the preview.

The captures are `Start Walking`, `Walking`, `Stop Walking`, `Ascending Stairs`,
`Walking Up The Stairs`, `Descending Stairs (1)` and `Driving (1)`. Source names,
including the `(1)` suffixes, are retained exactly. The importer searches the
provided directories without moving, renaming or modifying those originals;
it requires one unambiguous match for each filename.

Starting and stopping include their original standing frames. Stair recordings
are cycles cut from ongoing travel and begin/end during a step; they are not
complete approach-and-arrival sequences. The 5-second driving recording has a
stationary pelvis and preserves the captured seated pose and upper-body animation.

`Descending Stairs (1)` is explicitly marked `previewOnly` and labelled
`İniş kaydı`. The original, unmodified FBX keeps the toe bases near a fixed
height (about 3.28 cm) while its pelvis drops approximately 49.2 cm during the
0.9333-second recording. The final part therefore crouches rather than
performing verified stair descent. Restoring the source skeleton from its
inverse bind matrices gives the same behavior; this is present before Nathan
retargeting. The laboratory retains the original pose for inspection. Its
default raised view adds an upper platform, an intermediate tread and a lower
landing, plus one constant scene elevation of approximately 0.487 m. The
`Yüksekten iniş` / `Düz zemin` controls compare both surfaces at the same
animation time. All captured joint rotations and relative hip translations
remain identical; no leg or rail IK is applied to this recording.

The terrain comparison does not validate the clip as natural stair descent:
the original deep knee bend remains and the feet end roughly half a metre
above the lower landing in the raised view. The captured downward hip
translation (about 0.512 m at native Nathan model scale) is preserved.

For faithful playback, sample the animation mixer directly with a fixed scene
origin/ground offset. Nathan's facility controller normally cancels root
translation and solves both feet; that mode is intentionally not used for this
raw capture preview. Optional rail contact must use an arm-only post-animation
constraint so it cannot replace the captured hip, knee or foot motion.
Driving is an unmodified recording: it does not receive stair or rail IK.

Trajectory positions are in the native Nathan GLTF model coordinate space in
metres, facing +Z. Apply the actor's height scale and facing transform when
using them in the laboratory scene. `leftFoot` and `rightFoot` are fixed sole
points calibrated from the bind pose, not ankle joint origins.
