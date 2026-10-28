# Pattern 1742 musket v3: ramrod owner and lock block

Revision `r_f052d566fab74b82b005050758dd180a` of asset `a_0a31fd5eeb864b529202724a65de4623` (project collection),
child of v2 `r_209f60c0d25c48c78b470b192e5f5942`. Source `authoring/firearm-flintlock-v3-ramrod.kiln.js`, alias
`authoring/flintlock-1742-v3.glb` (sha256 `8cdee65995d12d8079bb15682ad7934f054dd842f9b9d540a99b97a3148672db`),
receipt `authoring/firearm-flintlock-v3-pins.json`. Gun frame: metres, +X muzzle, +Y up, +Z right.

## What changed

- **`Joint_Ramrod`** owns the stored ramrod (`Mesh_Joint_Ramrod_Flintlock_Steel`: the rod and its head). Origin at the
  head's end face under the muzzle, `[1.1055, -0.040, 0]`, unrotated, so local +X runs along the rod toward the muzzle
  and the rod lies along local -X (0.9605 m). Drawing is a translation along +X. The rear end clears the front pipe rim
  after 0.912 m (Model); the motion uses `drawMetres` 0.93, where the drawn rod is 1.27 mm clear of the fore-end.
- **`anchor_interaction_ramrod`** `[1.095, -0.040, 0]`: grasp point on the head at rest (a root child; add
  `ramrod x drawMetres` along +X while drawn). **`anchor_vfx_pan`** `[0.0223, -0.0073, 0.034]`: area centroid of
  the pan top, where the flash appears (37 micrometres from the measured centroid).
- **Root `lock` block** (root extras 2127 bytes, under Kiln's 4096-byte limit). Angles in degrees about gun +Z through
  each pivot, relative to the GLB rest; positive turns the top toward the butt.

| Part | Pivot | Pose | Angle | Label |
|---|---|---|---|---|
| Joint_Cock | [-0.072, -0.026, 0.034] | down (fired) | -59.5 | Estimate |
| | | half-cock | -14 | Estimate |
| | | full cock | +18 | Estimate |
| Joint_Frizzen | [0.040, -0.009, 0.035] | closed (over the pan) | 0 | Model (GLB rest) |
| | | open (thrown forward) | -45 | Estimate |

Nothing else changed: 17,044 triangles, the same world-space triangles, normals and UVs per material, ramrod vertices
within 4.5e-8 m of v2 at rest, and every other node, extra, clip, material and texture equal
(`evidence/flintlock-1742-v14/gun-v3-comparison.json`, `pipeline/flintlock-v3-verify.mjs`). Draw calls rise from 9
to 10; four welded vertices are stored again in the new primitive.

## Lock measurements (`pipeline/flintlock-lock-measure.mjs`)

- The flint swings on a 72.0 mm radius about the cock axis; the nearest frizzen point is 103.1 mm away, so **the
  modelled cock cannot strike the frizzen**. Down is the flint's closest approach to the closed frizzen (30.2 mm
  short); the jaw would meet the lock-plate top near -62 degrees.
- Frizzen open: 1.52 mm clear of the lock plate at -45 (contact near -55); the shell clears the pan from -30.
- Clearance of free parts (cock beyond its pivot join, frizzen beyond its boss) is at least 3.0 mm in Ready
  (18, 0), Fired (-59.5, -45), half-cock open and closed, and over every Fire and drill transition sampled at 2.5%.
  The authored joins are reported, not hidden: cock neck root 0.4 mm into the lock plate at every angle, frizzen shell
  edge 2.8 mm into the pan front when closed (both as in v1).

All lock angles are Estimates measured from this model, not documented dimensions.
