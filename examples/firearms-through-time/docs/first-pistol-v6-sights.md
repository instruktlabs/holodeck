# Pistol v6: GI-proportioned sights

Recorded 27 October 2026. This is a child of `r_5dd04d19ed3d445f9cb2c9fa2cc00494`, the integrated 1911-style pistol. It implements the owner decisions in [sight-research-v1](sight-research-v1.md) sections 4.1, 5.1, 6.1, 6.3 and 8. The geometry uses labelled GI-style Estimates. The 0.55 m eye is a Target.

- Revision: `r_7074467518f94364b59838f83f31ff93` (collection `project`, asset `a_b6ba0dec31d14d90ae315fa5e555ec1d`, tag `first-pistol-v6-sights`, program `p_35b71e4b7f54`).
- GLB: `authoring/assets/kiln/a_b6ba0dec31d14d90ae315fa5e555ec1d/revisions/r_7074467518f94364b59838f83f31ff93/asset.glb`, `sha256:d5ef4e9f695adc4b88cea7cde0d5854c40579a262f4ff099b5f873e3c0d88435`, 941,576 bytes.
- Source: [authoring/first-pistol-v6-sights.kiln.js](../authoring/first-pistol-v6-sights.kiln.js), byte-identical to the saved `source.kiln.js`. Pins: [authoring/first-pistol-v6-pins.json](../authoring/first-pistol-v6-pins.json).
- Cost: 4,092 triangles (4,104 before) and 71 draws (72 before, because two rear posts became one block). Materials, textures and material names are unchanged.

## What changed

All values are in the Model frame: metres, +X muzzle, +Y up. The slide top is y = 0.068 and the bore axis is y = 0.049 (`Joint_MuzzleFX`).

| Item | v5 | v6 | Label |
|---|---|---|---|
| Rear sight | Two 9 × 7 × 6 mm posts with a 12 mm gap, floating 0.5 mm above the slide | One `Mesh_RearSight` block: 11 mm wide, vertical rear face at x = −0.0735, 3 mm top, sloped front to a 7.5 mm base, on a transverse dovetail base | Estimate (form documented qualitatively [S7]) |
| Notch | 12 mm gap; the slide top formed the floor | Square-bottom notch cut through the block: **1.75 mm wide, 1.5 mm deep** (measured from the GLB: 1.75 and 1.49 mm) | Width Derived, depth Estimate |
| Front sight | 12 × 6 × 4 mm box, top at y = 0.074 | `Mesh_FrontSight`: low half-moon blade, **1.8 mm wide**, 3.6 mm above the slide, 8 mm chord, tip at y = 0.0716 | Estimate (form documented qualitatively [S7], [S8]) |
| Tops | Front 1.5 mm below the rear | Front tip and rear shoulders both at **y = 0.0716** (measured difference 0) | Model |
| Owner | `Joint_Slide` | `Joint_Slide` (no `Joint_FrontSight`) | — |
| `anchor_sight_rear` | none | `[-0.0735, 0.0716, 0]` under `Joint_Slide` | — |
| `anchor_sight_front` | none | `[0.111, 0.0716, 0]` under `Joint_Slide`, 2.5e-9 m from the blade tip | — |
| `anchor_eye` | none | `[-0.6235, 0.0716, 0]` under the root, 0.550 m behind the rear anchor on the line | Target |
| `Joint_Sight` | `[0, 0.077, 0]`, root | `[0, 0.0716, 0]`, root (name and parent kept; now on the line) | — |
| Height over bore | 25 mm (front top) | 22.6 mm | Model |
| Sight radius | 180 mm (centre to centre) | 184.5 mm (rear face to blade tip; same positions) | Model |

### Basis for the Estimates

No GI notch or blade dimension was found ([sight-research-v1](sight-research-v1.md) 4.1 and 7), so every size is an Estimate.

- **Blade width, 1.8 mm (about 0.07 in):** a narrow GI-class blade. From the 0.55 m eye it subtends 2.45 mrad, or 2.7 px at 1080p and 52° vertical FOV. That is above the 2.5 px presentation floor (owner decision 4) without any scaling.
- **Blade height, 3.6 mm over the slide:** a low half-moon. The line stays 1.8 mm above the barrel hood (top y = 0.0698), so the hood never enters the notch.
- **Notch depth, 1.5 mm:** a shallow GI notch. It shows about 2 mm of the blade below the tip.
- **Notch width, 1.75 mm:** derived to put the angular ratio in the Target band. Because the blade is 0.1845 m farther from the eye, it can be about as wide as the notch:

| Quantity | Value |
|---|---|
| Blade angular width | 1.8 mm / 0.7345 m = 2.451 mrad |
| Notch angular width | 1.75 mm / 0.550 m = 3.182 mrad at the rear face; 3.165 mrad at the far face of the 3 mm top |
| **Ratio (Target 0.7 to 0.85)** | **0.770** at the rear face; 0.774 at the far face |
| Each light bar | 0.36 mrad, about 0.4 px at 1080p and 52° |

### Rear anchor definition (deviation from the brief)

The brief and section 6.1 put `anchor_sight_rear` at the centre of the notch **bottom**. With the blade tip level with the notch shoulders, an eye on the notch-bottom-to-blade-tip line sees the tip at the notch floor. The whole blade then hides behind the rear sight. That conflicts with the tops-level sight picture the same sections require.

`anchor_sight_rear` therefore sits at the notch centre on the rear face, at shoulder height (the sight line). Eye, rear and front are collinear, and the picture is correct. The notch-bottom point `[-0.0735, 0.0701, 0]` is kept in `anchor_sight_rear.extras.notchBottomCentreRearFace`, and it lies on geometry. The owner should amend section 6.1 for notch sights, or say so if the literal point is wanted.

### Dovetail

The rear block sits on a transverse trapezoid base across the slide top. The base is 0.3 mm proud and undercut 1.5 mm into the slide, and its ends show on the slide-edge bevels. The parent `Mesh_SlideHousing` is not cut, so the slot is represented, not modelled as a hole.

### Unchanged

Every other node name, parent, pivot and world matrix is unchanged. That covers:

- `Joint_Slide`, `Joint_Magazine`, `Joint_Grip_L/R`, `Joint_Contact_RightHand/LeftHand` and `Joint_MuzzleFX`
- the hammer, trigger, frame, grips, magazine and muzzle meshes
- the material names `ParkerizedSteel`, `RecessSteel`, `PolishedEdges` and `WalnutGrip`

The parent GLB has no animation clips (the game drives the pivots), and v6 has none either. The only nodes removed are `Mesh_RearSight_L` and `Mesh_RearSight_R`. The added nodes are `Mesh_RearSight`, `anchor_sight_rear`, `anchor_sight_front` and `anchor_eye`. Root `extras.sight` is new, with per-value labels.

## Residuals

- **Sight radius:** 184.5 mm against about 163 mm (Documented, secondary search snippet [S9]). It is 21.5 mm (13%) long. The brief marked this low priority. Moving the front blade to about x = 0.0895 would fix it in one constant, but it was left unchanged because the only source is weak and the front position is part of the integrated silhouette.
- **Height over bore:** 22.6 mm is Model. No documented figure was found.
- **Light bars at play resolution:** at 52° and 1080p each light bar is about 0.4 px. That is the honest result of GI widths at 0.55 m. Readability is a presentation decision (the front-width floor), not geometry.
- **Rear anchor:** see the deviation above.
- **Dovetail:** a visual cue only. The slide is not cut.
- **Eye distance:** a Target. Hand reach at the 0.55 m pose is a gate in section 6.2, not checked here.

## Evidence (`evidence/first-pistol-v6-sights/`)

[geometry-proof.json](../evidence/first-pistol-v6-sights/geometry-proof.json) comes from [verify.mjs](../evidence/first-pistol-v6-sights/verify.mjs), adapted from the No.4 v2 script. It runs on the saved GLB against the parent GLB and reports **pass** on all 15 checks:

- Non-sight anchors and pivots (with parents and extras), every non-sight node's world matrix, animation clips and material names are identical.
- All 252 changed triangles lie inside the front and rear sight boxes.
- `anchor_sight_front` is 2.5e-9 m from the blade tip. The rear anchor lies on the rear-face plane at shoulder height, centred in the notch. The notch-bottom point is on geometry.
- The tops are level: the difference is 0, against a 0.3 mm tolerance.
- The eye is 0.550 m behind the rear anchor and on the line, in the order eye, rear, front. `Joint_Sight` is on the line.
- The eye-to-front-tip segment hits no geometry. Only the notch walls flank it, 0.875 mm to each side.
- The angular ratio is 0.770 at the rear face and 0.774 at the far face.
- Pinhole rays at 0.1, 0.5, 1 and 2 mrad below the line give equal left and right light bars, 0.36 mrad each (0.34 at 2 mrad), with the blade centred at 0 mrad.
- Moving `Joint_Slide` by −20 mm moves both sight meshes and both sight anchors by −20 mm. `anchor_eye` and `Joint_Sight` stay put.
- Both sights are seated on the slide: the surface distance is 0.

The review renders are material-faithful GPU renders (D3D12, RTX 3070). Each render's `inputGlbSha256` equals the saved GLB.

- [final-sight.shot-01.png](../evidence/first-pistol-v6-sights/final-sight.shot-01.png) is the pinhole picture from `anchor_eye` along the line at 52° vertical FOV. The sights are small at this distance, as expected.
- [shot-02](../evidence/first-pistol-v6-sights/final-sight.shot-02.png) is the same camera at 6°.
- [shot-03](../evidence/first-pistol-v6-sights/final-sight.shot-03.png) is the same camera at 1.2°. It shows the blade centred in the notch, equal light bars, and the tip level with the shoulders.
- The recipe is [sight-picture-capture.json](../evidence/first-pistol-v6-sights/sight-picture-capture.json).
- [final-detail.png](../evidence/first-pistol-v6-sights/final-detail.png) shows side, eye-side and dovetail views of the rear sight, side and oblique views of the front sight, and the slide top. The recipe is [sight-detail-capture.json](../evidence/first-pistol-v6-sights/sight-detail-capture.json).
- [final-overview.png](../evidence/first-pistol-v6-sights/final-overview.png) shows the standard views. [final.glb](../evidence/first-pistol-v6-sights/final.glb) is the render's GLB, byte-identical to the saved one.
- [save.json](../evidence/first-pistol-v6-sights/save.json) is the save receipt. The saved preview is exact-artifact and material-faithful. The save comparison gives −12 triangles, −1 draw and the same 4 materials.

## Limits

- These are Kiln review cameras, not the game's aim camera.
- There is no forced-WebGL2 or WebGPU game run, no ghost-ring or front-width presentation, and no near-plane change.
- The game, `weapon-extension.jsx`, `native/` and `game/asset-pins.json` were not touched. Integration is pending.
- Performance status is **DIRTY** (not measured).
