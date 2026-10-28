# Colt M4 R0977 carbine v3: catalogue proportions

Revision `r_f0ad6458af8b40c48ca99eca88d48abe` (tag `firearm-carbine-v3-proportions`) is a child of the v2 sights revision
`r_776d1f994d254c8ca5a414029e26c57f` in asset `a_b50808618ce54c1386d12212e186cc47`, collection `project`.
It implements the owner decision of 27 Oct 2026: rescale the whole M4 to the catalogue side view with the stock
retracted, move every affected anchor and pivot with its part, and keep the v2 sight parts and the recessed muzzle.
This is authoring only. Nothing in `game/`, `weapon-extension.jsx` or `native/` changed.

- GLB: `authoring/assets/kiln/a_b50808618ce54c1386d12212e186cc47/revisions/r_f0ad6458af8b40c48ca99eca88d48abe/asset.glb`, 959976 bytes, `sha256:d91af29c8b87e85ca1bb277eed9991b9c6b46a738919704ab943fc4f6b60162b` (copy: `evidence/firearm-carbine-v3-proportions/final.glb`)
- Source: `authoring/firearm-carbine-v3-proportions.kiln.js` (program `p_2959d01f8463`, identical to the saved source)
- Pins: `authoring/firearm-carbine-v3-pins.json` (same shape as the v2 pins, with `anchorsAndPivots` and `artifacts.glb`)
- Verify: `node evidence/firearm-carbine-v3-proportions/verify.mjs evidence/firearm-carbine-v3-proportions/final.glb` → **pass** (`evidence/firearm-carbine-v3-proportions/geometry-proof.json`)
- Cost (Measured): 14896 triangles, 18 draws, 5 materials (v2: 13952 triangles, 18 draws, 5 materials). Runtime performance was not measured.

**Do not use the sibling `r_26ab873e90b746a39efec6509a301da9`.** It has the same geometry, but its root userData
(4566 bytes) exceeded Kiln's 4096-byte export limit, so the GLB lost the root contract, sight, rights and proportions
extras. The v3 root metadata was compacted (rounded maps and anchor copies, shorter labels; 4034 bytes) and saved
again as `r_f0ad6458af8b40c48ca99eca88d48abe`. Its save output is kept as `evidence/firearm-carbine-v3-proportions/save-superseded-r_26ab873e.json`.

## Reference and scale

The reference is the Colt 2024 MLE catalogue, printed p24, R0977 side view (S5). The photograph shows the stock
**retracted**. v1 had traced it at the extended-stock scale. At 300 dpi, the documented retracted length of
77.55 cm gives 0.39365 mm per pixel. Values read from the catalogue are **Estimates**: one photograph, about 0.4 mm
per pixel, plus print and perspective error (roughly ±1 to 2 mm). Model values are **measurements** of the saved GLB.
The catalogue pixels stay in private study outside this repository. The evidence here carries only numbers and
model renders.

## Part maps

Every v2 part goes through a map in the final frame: x' = Dx·x + Tx, y' = 0.08 + Dy·(y − 0.08), z' = Dz·z, about the
bore axis. These are Derived values (fitted to catalogue landmarks). The base scale 0.918 comes from three
catalogue spans: muzzle to post 0.921, muzzle to lower-receiver rear 0.920, muzzle to rail rear 0.914.

| part | Dx | Dy | Dz | Tx |
|---|---|---|---|---|
| base | 0.918 | 0.918 | 0.918 | +0.0 mm |
| handle | 0.918 | 0.918 | 0.918 | +19.0 mm |
| stock | 0.918 | 0.918 | 0.918 | +14.0 mm |
| handguard | 0.8243 | 1.2118 | 1.2118 | +15.4 mm |
| collar | 1.5288 | 0.918 | 0.918 | -31.2 mm |
| cap | 0.918 | 0.918 | 0.918 | -13.0 mm |
| magwell | 0.918 | 0.918 | 0.918 | -14.0 mm |

The base, handle, stock, front cap and magazine-well maps share the uniform 0.918. The handle moves 19 mm forward on
the rail, the retracted stock moves 14 mm, and the magazine well and magazine move 14 mm aft. The handguard is
shorter and taller (157 mm long, about 65 mm tall), and the delta-ring collar is longer, as in the catalogue.

Several shapes were redrawn to the catalogue outline because a map alone could not match them:

- **Lower receiver.** The trigger-well floor and guard are raised. The rear-bottom steps up to about 33 mm under the
  bore and curves into the grip top.
- **Grip.** The back edge and beavertail line follow the catalogue, about 15 mm further aft at the top.
- **Front sight.** The A-frame and window are redrawn. The ears follow the catalogue's upper outline (66.8 mm top,
  rear slope continuing the frame). They now sit on the frame sides (contact verified).
  Their inner faces are 3.83 mm from the post.
- **Carry handle.** The opening follows the catalogue, and the solid core stays under the pinhole cone. Two side
  walls carry the catalogue top line, from 58 mm at the front leg to 69 mm at the sight housing.
- **Stock.** The front tube housing is added, and the cheek shell and rib are retimed.

The side walls are a **Model constraint.** The catalogue handle top rises above the 63.5 mm sight line in front of
the rear sight, so the real handle must carry the sight line in a channel. The model keeps the channel between the
walls open: inner faces are 7.1 mm off the bore plane. The nearest off-sight geometry projects to
2.79 mm on the aperture plane, which is 1.10 × the large-aperture radius
(`Mesh_CarryHandle_Carbine_Anodized`, the wall inner face). No ray through the open aperture can touch it. The real
channel width was not measured.

**Sight parts kept.** The flip leaf under `Joint_RearSight` is geometrically identical to v2 relative to its pivot.
Its apertures measure 5.08 and 1.78 mm (Documented
secondary 5.08 and 1.78 mm). The post under `Joint_FrontSight` keeps its 1.83 × 1.83 mm section
(Estimate). It is 12.5 mm tall (v2 10.5 mm) because the catalogue frame top sits lower. Its apparent
width is 5.4 px at 1080p and 45°, above the 2.5 px floor.

**Muzzle.** The recess is kept and scaled with the muzzle: the visible setback is 33.05 mm
(v2 36.00 mm × 0.918). `anchor_vfx_muzzle` sits on the mouth at x = 0.4443.

## Anchors and pivots moved (v2 → v3, metres)

All node names, materials and the five material slots are unchanged. No node was added or removed, and there are
no animation clips. `anchor_mount_receiver_top` and `anchor_mount_carry_handle` still coincide.

| node | v2 | v3 |
|---|---|---|
| `Joint_CarryHandle` | [-0.0600, 0.1164, 0.0000] | [-0.0361, 0.1134, 0.0000] |
| `Joint_ChargingHandle` | [-0.1570, 0.1017, 0.0000] | [-0.1441, 0.0999, 0.0000] |
| `Joint_FrontSight` | [0.2930, 0.1365, 0.0000] | [0.2690, 0.1320, 0.0000] |
| `Joint_Handguard` | [0.1600, 0.0800, 0.0000] | [0.1473, 0.0800, 0.0000] |
| `Joint_Magazine` | [0.0140, -0.0005, 0.0000] | [-0.0011, 0.0061, 0.0000] |
| `Joint_Muzzle` | [0.4420, 0.0800, 0.0000] | [0.4058, 0.0800, 0.0000] |
| `Joint_RearSight` | [-0.1360, 0.1385, 0.0000] | [-0.1011, 0.1360, 0.0000] |
| `Joint_Receiver` | [0.0000, 0.0240, 0.0000] | [0.0000, 0.0286, 0.0000] |
| `Joint_Stock` | [-0.1750, 0.0800, 0.0000] | [-0.1467, 0.0800, 0.0000] |
| `anchor_eye` | [-0.2072, 0.1460, 0.0000] | [-0.1723, 0.1435, 0.0000] |
| `anchor_grip_primary` | [-0.1360, -0.0145, 0.0000] | [-0.1248, -0.0068, 0.0000] |
| `anchor_grip_support` | [0.1570, 0.0660, 0.0000] | [0.1449, 0.0630, 0.0000] |
| `anchor_hand_left` | [0.1550, 0.0576, -0.0182] | [0.1432, 0.0529, -0.0221] |
| `anchor_hand_right` | [-0.1310, -0.0201, 0.0147] | [-0.1203, -0.0119, 0.0135] |
| `anchor_interaction_magazine` | [0.0210, -0.0600, 0.0119] | [0.0053, -0.0485, 0.0109] |
| `anchor_mount_carry_handle` | [-0.0600, 0.1164, 0.0000] | [-0.0361, 0.1134, 0.0000] |
| `anchor_mount_receiver_top` | [-0.0600, 0.1164, 0.0000] | [-0.0361, 0.1134, 0.0000] |
| `anchor_sight_front` | [0.2930, 0.1460, 0.0000] | [0.2690, 0.1435, 0.0000] |
| `anchor_sight_rear` | [-0.1373, 0.1460, 0.0000] | [-0.1023, 0.1435, 0.0000] |
| `anchor_sight_rear_alt` | [-0.1373, 0.1460, 0.0000] | [-0.1023, 0.1435, 0.0000] |
| `anchor_support_butt` | [-0.3750, 0.0480, 0.0000] | [-0.3302, 0.0506, 0.0000] |
| `anchor_vfx_muzzle` | [0.4840, 0.0800, 0.0000] | [0.4443, 0.0800, 0.0000] |

The batched mesh nodes move with their groups: `Mesh_CarryHandle_Carbine_Anodized`, `Mesh_CarryHandle_Carbine_Steel`, `Mesh_ChargingHandle_Carbine_Steel`, `Mesh_FrontSightPost`, `Mesh_Handguard_Carbine_Polymer`, `Mesh_Handguard_Carbine_Steel`, `Mesh_Magazine_Carbine_Magazine`, `Mesh_Magazine_Carbine_Steel`, `Mesh_Muzzle_Carbine_Cavity`, `Mesh_Muzzle_InnerWall`, `Mesh_Muzzle_Outer`, `Mesh_Muzzle_RimAndSlots`, `Mesh_RearApertureLeaf`, `Mesh_Receiver_Carbine_Anodized`, `Mesh_Receiver_Carbine_Polymer`, `Mesh_Receiver_Carbine_Steel`, `Mesh_Stock_Carbine_Polymer`, `Mesh_Stock_Carbine_Steel`. The root is the only unmoved node.
`geometry-proof.json` lists `movedNodes` with exact v2 and v3 positions and deltas.

Anchors stay on or in their parts. Distance from each anchor to the nearest surface, in mm:

| anchor | v2 | v3 | nearest mesh |
|---|---|---|---|
| `anchor_grip_primary` | 13.2 | 14.3 | Mesh_Receiver_Carbine_Polymer |
| `anchor_grip_support` | 8.8 | 10.6 | Mesh_Handguard_Carbine_Polymer |
| `anchor_hand_left` | 4.2 | 4.7 | Mesh_Handguard_Carbine_Polymer |
| `anchor_hand_right` | 1.1 | 1.0 | Mesh_Receiver_Carbine_Polymer |
| `anchor_interaction_magazine` | 0.8 | 0.7 | Mesh_Magazine_Carbine_Steel |
| `anchor_mount_carry_handle` | 0.0 | 0.0 | Mesh_Receiver_Carbine_Anodized |
| `anchor_mount_receiver_top` | 0.0 | 0.0 | Mesh_Receiver_Carbine_Anodized |
| `anchor_support_butt` | 0.0 | 0.0 | Mesh_Stock_Carbine_Polymer |
| `anchor_vfx_muzzle` | 5.0 | 4.6 | Mesh_Muzzle_InnerWall |

The grip and hand anchors are interior points. Their distances scale with the part maps; for example
grip support 8.8 → 10.6 mm, with the handguard's 1.21 diametral factor.

## Sight-line results (Measured on the saved GLB)

- **Collinear.** Rear and alternate rear anchors are 0 m off the eye-to-post line. `anchor_eye` is
  0.070 m behind the aperture on the line. The post tip anchor is on the tip (2.2e-11 m).
- **Clear segment.** The eye-to-post segment hits no triangles.
- **Aperture rays.** 253 rays from the eye go through the large aperture (rest pose) and 253 through the small
  aperture (leaf flipped +90° about local Z), each out to 0.95R. None of them is blocked before the front-sight
  region (x < 0.2340).
- **Leaf faces.** Both anchors sit on their leaf's eye-side face inside its outline. The clear diameters are within
  1e-9 m of nominal.
- **Contacts.** sideWallsToHandleCore 0.00 mm; postToFrontFrame touching (crossing); postToFrontEars 3.83 mm; frontEarsToFrame touching (crossing); leafToAxle touching (crossing); leafToRearEars 0.60 mm; leafToHandle 1.23 mm; rearEarsToHandle touching (crossing); axleToRearEars 0.00 mm; flippedLeafToRearEars 0.60 mm; flippedLeafToHandle 1.23 mm.
- **Stock sanity.** The eye is 0.158 m forward of the retracted-stock butt anchor (band 0.15 to 0.35 m).

## Residuals

| quantity | v3 (Measured) | reference | residual |
|---|---|---|---|
| sight radius | 0.3713 m | 0.368 m Documented (secondary, S4: about 14.5 in) | +3.3 mm (+0.89%) |
| sight radius | 0.3713 m | 0.371 m Estimate (catalogue, retracted scale) | +0.3 mm |
| sight height over bore | 63.5 mm | 63.5 mm Estimate (catalogue, 63 to 64 mm) | -0.0 mm |
| sight height over bore | 63.5 mm | 63.5 to 66.0 mm Documented (secondary): quoted 2.5 to 2.6 in | inside the band (lower edge) |
| overall length | 0.7763 m | 0.7755 m Documented (catalogue, stock retracted) | +0.8 mm |

v2 had a 0.4303 m radius, 66.0 mm height and 0.8609 m length.

**Silhouette IoU against the catalogue** (Measured overlap of the model raster with the catalogue mask, private
study). Overall: v3 0.904, v2 0.5457 at the same scale.

| region | v2 | v3 |
|---|---|---|
| front (muzzle to receiver front) | 0.7199 | 0.8801 |
| upper receiver | 0.9144 | 0.9741 |
| carry handle and rear sight | 0.2222 | 0.9044 |
| lower receiver, magazine, grip | 0.4848 | 0.8982 |
| stock | 0.3644 | 0.8897 |

**Landmarks.** Residual = model − catalogue, in mm; for x, positive means toward the muzzle. The figure
`evidence/firearm-carbine-v3-proportions/side-elevation-landmarks.png` marks each pair on the GPU orthographic left elevation.

| landmark | where | catalogue | v3 | v3 residual | v2 residual |
|---|---|---|---|---|---|
| muzzle tip | bore line | 0.4447 | 0.4447 | +0.0 | +0.0 |
| front sight front face | 30 mm above bore | 0.2766 | 0.2778 | +1.2 | -12.6 |
| front sight rear edge | 50 mm above bore | 0.2502 | 0.2491 | -1.1 | -6.3 |
| handguard front | 22 mm below bore | 0.2254 | 0.225 | -0.4 | -10.6 |
| handle front leg | 48 mm above bore | 0.0452 | 0.0479 | +2.7 | -53.2 |
| handle opening fore edge | 45 mm above bore | 0.029 | 0.0266 | -2.4 | -54.3 |
| handle opening aft edge | 45 mm above bore | -0.071 | -0.0674 | +3.6 | +44.5 |
| magazine well front | 60 mm below bore | 0.0353 | 0.0365 | +1.2 | -19.3 |
| grip back edge | 70 mm below bore | -0.1367 | -0.1367 | +0.0 | -33.1 |
| lower receiver rear face | 20 mm below bore | -0.1529 | -0.1532 | -0.3 | -11.8 |
| butt end | any height | -0.3335 | -0.332 | +1.5 | -13.0 |
| front sight top | x 0.25 to 0.285 | 66.9 | 67.3 | +0.4 | +2.4 |
| handle top at x=0.0404 | x = 0.0404 | 57.9 | 58.3 | +0.4 | n/a |
| handle top at x=0.0117 | x = 0.0117 | 61.8 | 62.2 | +0.4 | n/a |
| handle top at x=-0.0352 | x = -0.0352 | 66.1 | 66.1 | +0.0 | -9.8 |
| rear sight top | x -0.13 to -0.06 | 73.2 | 72.8 | -0.4 | -14.2 |
| handguard top (envelope) | x 0.08 to 0.22 | 35.4 | 33.9 | -1.5 | -8.2 |
| handguard bottom (envelope) | x 0.08 to 0.22 | -32.3 | -33.5 | -1.2 | +5.5 |
| magazine bottom | x -0.06 to 0.06 (model value from GLB triangles: the raster crop ends at -187 mm) | -183.4 | -188.9 | -5.5 | n/a |
| grip bottom | x -0.19 to -0.10 | -144.5 | -145.7 | -1.2 | -14.1 |
| trigger guard bottom | x = -0.06 | -77.9 | -78.3 | -0.4 | -17.0 |
| lower receiver rear-bottom step | x = -0.145 | -32.7 | -33.1 | -0.4 | n/a |
| stock top | x = -0.25 | 19.7 | 22.8 | +3.1 | -9.5 |
| butt toe | x -0.345 to -0.28 | -113.0 | -115.3 | -2.3 | +31.9 |

**Known residuals.** None of these affects a sight check.

- The magazine bottom is 5.5 mm long. The catalogue crop ends at −187 mm, so the model value comes from the GLB.
- The stock top at x = −0.25 is 3.1 mm high.
- The handle opening's aft edge is 3.6 mm short, and the front leg is 2.7 mm forward.
- The handguard envelope is about 1.5 mm thin at the ribs.
- Below the bore at the delta ring, the collar's lower edge is 1 to 2 mm low. A small receiver-front feature
  (about 8 × 18 mm) seen in the catalogue is not modelled.

## Evidence

All paths are under `evidence/firearm-carbine-v3-proportions/`:

- `verify.mjs`: v3 against v2. Its output is `geometry-proof.json`, with a console summary in `verify-output.json`.
- `reference-reconciliation.json`: the IoU and landmark numbers, with method and labels.
- `side-elevation.png`: the GPU orthographic left elevation (`authoring/firearm-carbine-v3-side-capture.json`).
- `side-elevation-landmarks.png`: the same elevation with catalogue and model landmark marks and residuals.
- `final-sights.png`: eight shots, including the 45° pinhole sight picture from `anchor_eye`
  (`authoring/firearm-carbine-v3-sight-capture.json`).
- `final-overview.png`: six views.
- `review-flipped-small-aperture.png` with `review-flipped.kiln.js`: a review-only flipped leaf
  (`authoring/firearm-carbine-v3-flipped-capture.json`).
- `save.json`, `source-export.json`, and `final.glb`.

All renders ran on the GPU (dawn-d3d12, RTX 3070) with no degradation. Their GLBs hash identically to the saved
`asset.glb`.

Reproduce with:

```
node authoring/kiln.mjs render authoring/firearm-carbine-v3-proportions.kiln.js --out <glb> --views <png> --capture authoring/firearm-carbine-v3-sight-capture.json --render gpu --no-project
node evidence/firearm-carbine-v3-proportions/verify.mjs authoring/assets/kiln/a_b50808618ce54c1386d12212e186cc47/revisions/r_f0ad6458af8b40c48ca99eca88d48abe/asset.glb
```
