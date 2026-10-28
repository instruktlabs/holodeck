# Model 1866 v3: open sights

Recorded 27 October 2026. **Current delivery is v3b**, an anchors-only child of v3 (see the first section). This is a child of `r_d1fa6f16dd67465ba6f41a66a1b9d6f8` ([v2](rifle-1866-v2.md)) that implements the owner-approved sight plan in [sight-research-v1](sight-research-v1.md) sections 4.2, 5.1, 6.1, 6.3 and 8. Identity and provenance stay with [next-firearm-v1](next-firearm-v1.md).

- Revision: `r_c2f00fc88d564e9580c7badb1e6d86a4` (collection `next-firearm-v1`, asset `a_a8c8a92ae979442dbcf5836c8e72ee2e`, tag `rifle-1866-v3-sights`).
- GLB: `sha256:0243d836b7f0c0988f66dd3cf1b7e0b04fb2ae68376828bec910fde473be9a68`, 584,848 bytes, at `assets/next-firearm-v1/a_a8c8a92ae979442dbcf5836c8e72ee2e/revisions/r_c2f00fc88d564e9580c7badb1e6d86a4/asset.glb`.
- Source: [authoring/rifle-1866-v3-sights.kiln.js](../authoring/rifle-1866-v3-sights.kiln.js). Pins: [authoring/rifle-1866-v3-pins.json](../authoring/rifle-1866-v3-pins.json).
- Cost: 10,260 triangles (+460) and 17 draws (+1). The extra draw is the leaf's own mesh under `Joint_RearSight`. Materials (5) and images are unchanged. Bounds are unchanged.

## v3b: shoulder-top rear reference (current delivery)

**Owner decision (27 October 2026):** for open notch sights, the rear sight-line reference is the top of the notch shoulders. The blade top therefore sits level with the shoulders, with light bars on either side, matching [first-pistol-v6](../authoring/first-pistol-v6-pins.json). This resolves v3 residual 2 below. A second decision, implemented by the game adapter: the Ready/aim pose holds the hammer cocked.

- Revision: `r_efaced2294e24e9890f47971a737d375` (child of v3 `r_c2f00fc88d564e9580c7badb1e6d86a4`, tag `rifle-1866-v3b-sights`).
- GLB: `sha256:e6232965c5d40f2d2b227331ed30c389bbcbe6ad2172ce8b8238d48e1659036c`, 585,632 bytes, at `assets/next-firearm-v1/a_a8c8a92ae979442dbcf5836c8e72ee2e/revisions/r_efaced2294e24e9890f47971a737d375/asset.glb`.
- Source: [authoring/rifle-1866-v3b-sights.kiln.js](../authoring/rifle-1866-v3b-sights.kiln.js). [Pins](../authoring/rifle-1866-v3-pins.json) now point at v3b.
- **Anchors only.** Kiln reports `geometryIdentical: true`. Triangles, draws, materials and bounds are unchanged (10,260, 17, 5).

| Anchor | v3 | v3b |
|---|---|---|
| `anchor_sight_rear` | `[0.110, 0.1983, 0]` (notch bottom) | **`[0.110, 0.1995, 0]`**: notch centre on the leaf rear face at shoulder-top height. The notch bottom `[0.110, 0.1983, 0]` is kept in extras as `notchBottomCentreRearFace`, along with `notchWidthM` and `notchDepthM`. |
| `anchor_sight_front` | `[0.568, 0.1983, 0]` | unchanged (blade tip) |
| `anchor_eye` | `[-0.190, 0.1983, 0]` | **`[-0.18999897, 0.20028602, 0]`**: 0.300 m behind the new rear anchor on the new line. It rises 1.986 mm and stays 0.313 m forward of the butt. |

- **Sight line:** from the shoulder top (26.5 mm over the bore) to the blade tip (25.3 mm). The slope is **−0.0026201 dy/dx (−0.1501°)**, descending toward the muzzle, so the line is no longer parallel to the bore (Derived).
- **Root `sight` extras** add `rearReference`, `rearSightLineY 0.1995`, `notchBottomY 0.1983`, `rearSightLineHeightAboveBoreM 0.0265`, `sightLineSlopeDyDx` and `sightLineSlopeDeg`. `sightLine` and `aimHammer` are rewritten. Every other value is unchanged.
- **Verify:** [verify.mjs](../evidence/rifle-1866-v3b-sights/verify.mjs) ran against v3. [geometry-proof.json](../evidence/rifle-1866-v3b-sights/geometry-proof.json) reports **pass** on 23 checks:
  - The triangle set is identical (0 changed). Only `anchor_sight_rear` and `anchor_eye` positions and extras, plus the root `sight` extras, differ.
  - With the hammer at 43°, the eye-to-front segment hits only the blade tip. It passes through the notch without touching the shoulders. All 72 notch rays are unobstructed: 56 reach the blade and 16 the sky.
  - The blade tip and the shoulder top lie at the same elevation from the eye (1.8e-8 rad).
  - The light bars are equal: 0.124 mm each at the leaf face, 0.05 mm below the shoulder, which is 0.54 px at 45° and 1080p. The rounded blade bevel makes them slightly wider than the analytic 0.45 px.
  - From the higher eye, the hammer clears the line at ≥ 35.1°.
- **Render:** [review-hammer43-sights.png](../evidence/rifle-1866-v3b-sights/review-hammer43-sights.png) is a review-only copy with the hammer posed at 43°. It was not saved ([source](../evidence/rifle-1866-v3b-sights/review-hammer43.kiln.js), [capture](../authoring/rifle-1866-v3b-sight-capture-cocked.json)). It shows the 45° picture from the new `anchor_eye`, plus 3° and 1° details: the blade top is level with the shoulders, with an equal light bar on each side.

The sections below describe v3; its sight geometry carries over unchanged to v3b.

Labels: **Model** is an authored value, **Estimate** has no documented dimension behind it, **Target** is an owner-approved presentation value, **Derived** is computed from the others. Measured values come from the saved GLB.

## What changed

| Item | v2 | v3 | Label |
|---|---|---|---|
| Rear sight | Notchless 6 × 9 × 18 mm slab on a 48 mm base | Folding leaf with a cut U notch, on a transverse dovetail slide with hinge knuckles and a forward spring tail | Model (pattern from 4.2) |
| Notch width | none | **1.0 mm** (measured at mid-depth) | Estimate |
| Notch depth | none | **1.2 mm** (floor y 0.1983, shoulders y 0.1995) | Estimate |
| Leaf | — | 1.5 mm thick (X), 16 mm wide (Z), flat floor 0.8 mm between 0.1 mm fillets | Estimate (thickness), Model |
| Leaf owner | root batch | `Joint_RearSight`, pivot `[0.11075, 0.19, 0]` on the hinge axis at the leaf base, axis +Z; −90° folds it forward | Model |
| Front blade width (Z) | 2.6 mm as built (2 mm extrusion plus bevel) | **2.0 mm** as built; same outline, top and tip height | Model |
| Blade foot | 0.74 mm above the front base | 0.4 mm into the base | Model |
| `anchor_sight_front` | `[0.568, 0.200, 0]`, 1.7 mm above the tip | `[0.568, 0.1983, 0]`; 12 µm from the top-flat centre, 4 nm from the surface | — |
| `anchor_sight_rear` | `[0.110, 0.200, 0]` | `[0.110, 0.1983, 0]`, notch-bottom centre at the leaf's rear face (4 nm) | — |
| `anchor_eye` | none | `[-0.190, 0.1983, 0]`, 0.300 m behind the rear anchor on the line | Estimate |
| Sight line over bore (bore y 0.173) | 27 mm (anchors) | **25.3 mm**, parallel to the bore | Model; no documented figure |
| Sight radius | 458 mm | 458 mm | Model |

### Notch and blade from the eye

| Quantity | Value | Label |
|---|---|---|
| Blade angular width at 0.758 m | 2.638 mrad | Derived |
| Notch angular width at 0.300 m | 3.333 mrad | Derived |
| Blade / notch ratio | **0.79** | Derived; Target band 0.70 to 0.85 |
| Blade at 45° vertical FOV, 1080 px | 3.44 px | Derived (above the 2.5 px floor) |
| Notch width / depth at 45°, 1080 px | 4.35 px / 5.21 px | Derived |
| Light bar each side | 0.45 px | Derived |

### Stock sanity

`anchor_eye` lies **0.313 m** forward of `anchor_support_butt` (−0.503) in X, inside the 0.15 to 0.35 m band. Its `extras` carry `eyeReliefM 0.3`, `basis "estimate"`, a low `confidence` and `sourceIds` (`sight-research-v1#4.2`, `#5.1`, `#8`).

### Root `sight` block (section 6.1 item 5)

`rearType notch-u`, `frontType blade`, `apertureInnerDiameterM []`, `notchWidthM 0.001`, `notchDepthM 0.0012`, `leafThicknessM 0.0015`, `frontWidthM 0.002`, `frontHeightAboveBoreM 0.0253`, `sightRadiusM 0.458`, `eyeReliefM 0.3` and `bladeToNotchAngularRatio 0.7915` with its `[0.7, 0.85]` Target. Each value has its own `…Label` key, as on the No.4 v2. `presentationPivots` gains a `Joint_RearSight` entry; the lever and hammer entries are byte-identical.

### Unchanged

Every other node, mesh (batch) name, pivot and anchor is unchanged, with the same world matrix and extras. That covers:

- `Joint_Lever` and `Joint_Hammer` and their children
- the hand, grip, loading-gate, select, lever, muzzle and butt anchors
- `PresentationLeverReview`, the five materials, both images, and the muzzle cavity

## Residuals (not achieved or needing an owner call)

1. **Hammer blocks the line at rest.** The unchanged hammer spur reaches y 0.2087 at x ≈ −0.1, between the eye and the rear sight. At rest, and at the review clip's 22° peak, it crosses the eye-to-front segment and fills the sight picture ([final-sights.png](../evidence/rifle-1866-v3-sights/final-sights.png), top left). The segment clears at **≥ 39.8°** of +Z hammer rotation (cocked). The verify checks use 43°. No clip reaches that; the game adapter needs a cocked aim pose. Moving the eye forward past the hammer would break the 0.30 m eye relief. Raising the line over the spur would need a front blade of about 20 mm.
2. **Blade tip on the notch floor (resolved in v3b by the owner decision above).** Section 6.1 puts `anchor_sight_rear` at the notch bottom and the brief puts the blade tip level with it. A pinhole eye on that line sees the blade tip exactly on the notch floor, with the blade body hidden behind the leaf (review sheet, 3° detail). The 4.2 hold (blade top level with the shoulders, light bars beside it) appears with the eye **2.0 mm** higher (diagnostic shot). The owner can either keep this or move the rear anchor or the aim camera to the shoulder line. Neither was applied.
3. Notch width, depth and leaf thickness are Estimates; no documented 1866 dimension was found (4.2, 7). The sight height and radius are Model values.

## Evidence (`evidence/rifle-1866-v3-sights/`)

- [geometry-proof.json](../evidence/rifle-1866-v3-sights/geometry-proof.json) comes from [verify.mjs](../evidence/rifle-1866-v3-sights/verify.mjs), run on the saved GLB against the v2 GLB (console copy in `verify-output.json`). It is adapted from the No.4 script and reports **pass** on 20 checks:
  - Non-sight anchors, pivots, hierarchy, mesh names, animation channels, material names and definitions, and images are identical.
  - All 788 changed triangles (624 added, 164 removed) lie inside the two sight regions.
  - The front anchor is on the blade tip, and the rear anchor is on the notch bottom.
  - Eye, rear and front are collinear (0 m off-line), with the eye 0.300 m behind the rear.
  - The ratio is in the Target band.
  - With the hammer at 43°, the eye-to-front segment touches only the notch-floor edges and grazes the blade top. All 72 rays through the notch reach the sky.
  - At rest, only the hammer blocks.
  - Rest contacts: leaf to dovetail 0.1 mm and leaf to base knuckles 0.3 mm. The knuckles and dovetail are seated into the base and barrel, as intended.
  - The −90° fold clears the base by 0.1 mm and the barrel by 2.7 mm.
  - The muzzle rays are unchanged (centre X 0.589, lip X 0.598).
- [final-sights.png](../evidence/rifle-1866-v3-sights/final-sights.png) is a material-faithful GPU (D3D12) render of the saved GLB from [the capture recipe](../authoring/rifle-1866-v3-sight-capture.json). It shows the sight picture from `anchor_eye` at a 45° vertical FOV (pinhole) and a 4° detail, both blocked by the resting hammer. It also shows rear-sight side, behind and oblique views and a front-sight oblique view.
- [review-hammer43-sights.png](../evidence/rifle-1866-v3-sights/review-hammer43-sights.png) is a **review-only** copy with the hammer posed at 43° ([source](../evidence/rifle-1866-v3-sights/review-hammer43.kiln.js), [capture](../authoring/rifle-1866-v3-sight-capture-cocked.json)). It was not saved. It shows:
  - the 45° sight picture
  - a 3° detail from `anchor_eye` (notch visible, blade tip on the floor)
  - a diagnostic 3° view with the eye 2.0 mm higher (blade filling the notch)
  - a side elevation
- [final-overview.png](../evidence/rifle-1866-v3-sights/final-overview.png) shows the standard six views. [save.json](../evidence/rifle-1866-v3-sights/save.json) is the save receipt. The saved preview is exact-artifact and material-faithful. `final.glb` equals the saved GLB.

## Limits

- These are Kiln review renders, not the game's aim camera. There is no ghost-ring treatment, readability scale, near-plane change or forced-WebGL2 run.
- The eye distance is an Estimate to confirm with a hands-and-stock pose.
- The fold is a sampled pose, not continuous clearance. The leaf has no clip.
- Performance status is **DIRTY**: structural costs only.
