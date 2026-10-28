# Pattern 1742 musket v2: sight anchors

Recorded 27 October 2026. This is a child of `r_30a6f49421c44da2995ee562e92ab3bc` ([v1](firearm-flintlock-v1.md)). It implements the owner-approved musket sight plan in [sight-research-v1](sight-research-v1.md) sections 4.3, 5.1, 5.7, 6.1 and 8. Only anchors and extras change; the geometry is untouched.

- Revision: `r_209f60c0d25c48c78b470b192e5f5942` (collection `project`, asset `a_0a31fd5eeb864b529202724a65de4623`, tag `firearm-flintlock-v2-anchors`).
- GLB: `sha256:af6b8b63371e1e919305099c2ee4cc8959867ac779c3826574fb3d5fb170c8da`, 1,007,684 bytes. That is 3,936 bytes more than v1, all of it node extras.
- Source: [authoring/firearm-flintlock-v2-anchors.kiln.js](../authoring/firearm-flintlock-v2-anchors.kiln.js). Pins: [authoring/firearm-flintlock-v2-pins.json](../authoring/firearm-flintlock-v2-pins.json).
- Cost: 17,044 triangles, 9 draws, 5 materials and 2 textures, all unchanged. The save comparison reports `geometryIdentical: true` and `uvIdentical: true`.

## What changed (Model frame: metres, +X muzzle, +Y up)

| Item | v1 | v2 | Label |
|---|---|---|---|
| `anchor_sight_rear` | `[-0.10, 0.021, 0]`, over the tang and 3 mm above the barrel-top line | `[0.010, 0.018, 0]`, on the barrel top over the breech plug (offset 7.7e-10 m, float32) | Model; `physicalRearSight: false` kept |
| `anchor_sight_front` | `[1.104, 0.021, 0]`, 3 mm above the stud | `[1.104, 0.018, 0]`, on the bayonet-stud top-centre (offset 2.8e-8 m) | Model |
| `anchor_eye` | none | `[-0.210, 0.018, 0]`, 0.220 m behind the rear anchor on the line | Estimate [S20] |
| Root `extras.sight` | none | sight-contract-v1 block (below) | per value |

- **Rear reference:** the barrel is parallel at radius 0.018 from x 0 to 0.02, so x 0.010 is the middle of that section. As a result the eye sits 0.210 m behind the breech face. That is inside the 0.20 to 0.25 m drill estimate.
- **Front anchor:** the stud measured from the GLB is 13 mm long, 5 mm wide and 6 mm tall, centred at x 1.104. Its flat top is at y 0.018. It rises 4.8 mm above the barrel there (barrel top 0.0132).
- **Sight line:** the line runs horizontally at y 0.018 and is parallel to the bore (axis y 0). The breech top and the stud top are the same height in the model.
- **Unchanged:** the meta name, the stud geometry and `anchor_attachment_bayonet_reference` `[1.104, 0.015, 0]`. The stud's numbers are now named constants that produce the same triangles.

### `anchor_eye` extras

- `kind: eye-aim`, `eyeReliefM: 0.22`, `basis: Estimate`, `sourceIds: ["S20"]`
- `confidence: low`. The 1764 drill gives a posture, not a distance, and postdates the 1742 pattern.

### Root `extras.sight`

| Field | Value | Label |
|---|---|---|
| rearType | `none` | Documented [S19, S21] |
| frontType | `bayonet-stud` | Documented [S19] |
| apertureInnerDiameterM / notchWidthM / notchDepthM | `[]` / null / null | Not applicable: no rear sight |
| frontWidthM / frontLengthM | 0.005 / 0.013 | Model (no stud size documented) |
| frontHeightAboveBoreM | 0.018 | Model |
| sightRadiusM | 1.094 | Model: the breech-top-to-stud line, not a strict sight radius; documented Long Land barrel about 46 in [S19] |
| eyeReliefM | 0.22 | Estimate [S20] |
| aimFovDeg | 55 | Target (owner decision 8.3) |
| reticle / aids | none | No rear sight, ghost ring or reticle (4.3, 5.7) |

## Eye placement checks

- **Butt:** the eye is 0.188 m forward of `anchor_support_butt` (x −0.398). That is inside the 0.15 to 0.35 m stock sanity range.
- **Comb:** the eye is 53 mm above the comb crest (walnut top y −0.035 at x −0.30) and 68.5 mm above the wrist top directly below it (y −0.0505). It sits 90 mm forward of the crest, just ahead of the comb nose.
  - That fits the drill's "cheek close to the butt, head kept up" posture. It is plausible, not proven.
- **Right hand:** `anchor_hand_right` is only 36 mm forward of the eye in X. The thumb on the wrist will be close to the face, so check this in the hands-and-head pose review.

## Eye-to-stud segment clearance

Nothing penetrates the segment from `anchor_eye` to `anchor_sight_front`. Moller-Trumbore segment hits: 0. Downward-ray profile every 5 mm: 0 penetrations. The line does touch the geometry along two tangent stretches, and both are intended reference surfaces, not intersections:

- the barrel top over x 0 to 0.02, which is the rear reference itself
- the stud's flat top over x 1.0982 to 1.104

The clearance in both stretches is float32 rounding, 7.7e-10 m.

The barrel tapers away under the line:

| x (m) | 0 to 0.02 | 0.11 | 0.28 | 0.54 | 0.80 | 1.10 |
|---|---:|---:|---:|---:|---:|---:|
| Clearance (mm) | 0 (tangent) | 0.7 | 1.9 | 3.1 | 4.0 | 4.8 |

Off the centre plane, the nearest other geometry is the tang, 23.4 mm below the line at x −0.07. The cock, frizzen and pan sit to the right (+Z) and never cross the line. The barrel was not modified.

## Sight picture (look at it)

[final-sights.shot-01.png](../evidence/firearm-flintlock-v2-anchors/final-sights.shot-01.png) is a pinhole view from `anchor_eye` at 55° vertical FOV.

- **Centre:** the top of the breech sits exactly on screen centre.
- **Below the centre:** the exposed breech end face reads as a dark disk, with the tang wedge and the walnut wrist below it.
- **Upper right:** the cock and frizzen fill that quadrant, beside the line rather than across it.

[final-sights.shot-02.png](../evidence/firearm-flintlock-v2-anchors/final-sights.shot-02.png) is a 6° detail on the stud.

**Finding:** from the anchor, the stud is not visible. The breech top and the stud top are the same height, so the stud top lies exactly on the breech horizon (0.000°). The stud body is hidden behind the breech, and so is the whole tapered barrel forward of x 0.02. Ray checks agree: the first ray reaches the stud only at its exact top edge. Every ray 0.1 mm or more below that edge hits the breech at x 0. The rest of the musket picture follows from the same geometry:

- No barrel top is visible to carry the "small specular highlight" the plan asks for.
- The breech end face shows as a disk because the v1 barrel's breech face is exposed above the wood. That is pre-existing v1 art, not changed here.

[final-sights.shot-03.png](../evidence/firearm-flintlock-v2-anchors/final-sights.shot-03.png) is a **diagnostic only**, not an anchor. With the eye raised 1 mm, the full 4.8 mm stud rise shows. Its top sits 0.21° above the breech horizon.

**Owner decision needed.** Each option below conflicts with the plan as written:

| Option | What it does | Conflict |
|---|---|---|
| Accept as is | Keeps the plan exactly | The stud is invisible at the exact anchor |
| Presentation-only eye lift (about 1 mm, labelled Target) | The stud shows | The eye leaves the strict rear-to-front line |
| Raise the stud geometry | The stud shows | The stud height is undocumented, and this is a geometry change |

## Evidence (`evidence/firearm-flintlock-v2-anchors/`)

- [geometry-proof.json](../evidence/firearm-flintlock-v2-anchors/geometry-proof.json) comes from [verify.mjs](../evidence/firearm-flintlock-v2-anchors/verify.mjs), which runs on the saved GLB against the v1 GLB. Console output is in [verify-output.json](../evidence/firearm-flintlock-v2-anchors/verify-output.json). It reports **pass** on 18 checks:
  - Every other node, including all other anchors and pivots and every `part_*` marker, has the same world matrix, parent and extras. Root extras gain only `sight`. The only added node is `anchor_eye`.
  - The animation channels, the material JSON and the texture images and samplers are identical.
  - The triangle multiset is identical: mesh, material, positions, normals and UVs at 1e-5.
  - The anchors sit on geometry within 0.2 mm. The eye is on the line, 0.220 m behind the rear anchor and within the stock range.
  - Nothing penetrates the segment.
- [final-overview.png](../evidence/firearm-flintlock-v2-anchors/final-overview.png) is the standard GPU sheet. It is byte-identical to v1's saved preview.
- `final-sights.shot-01` to `shot-07` come from [the capture recipe](../authoring/firearm-flintlock-v2-sight-capture.json). All are material-faithful D3D12 renders of the exact saved GLB hash. They cover:
  - the pinhole, the stud detail and the +1 mm diagnostic
  - a butt-to-breech elevation, the stud side view, the breech top from the left and a full elevation
- [side-elevation-breech-annotated.png](../evidence/firearm-flintlock-v2-anchors/side-elevation-breech-annotated.png) and [side-elevation-full-annotated.png](../evidence/firearm-flintlock-v2-anchors/side-elevation-full-annotated.png) draw the eye, rear, front and butt anchors and the line. The points are projected through the same explicit cameras by [annotate-elevation.py](../evidence/firearm-flintlock-v2-anchors/annotate-elevation.py).
- [save.json](../evidence/firearm-flintlock-v2-anchors/save.json) is the save receipt. The saved preview is exact-artifact and material-faithful.
  - The saved GLB equals `final.glb` and every review render's input hash.
  - The saved source equals the authoring file.
  - The v1 source rebuilds to its saved hash.

## Limits

- These are review renders from the Kiln tool camera, not the game's aim camera.
- There is no 25 m or 100 m target and no forced-WebGL2 run.
- The eye distance is an Estimate. Confirm it, and the hand-to-face spacing, with a hands-and-head pose review.
- There is no game integration. `game/`, `weapon-extension.jsx` and `native/` are untouched.
- Performance status is **DIRTY**.
