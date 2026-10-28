# Bolt rifle v2: documented sights

Recorded 27 October 2026. This is a child of `r_3a58c8007f544b1e9a3a3dc6028fd583` ([v1](firearm-bolt-v1.md)) that implements the owner decisions in [sight-research-v1](sight-research-v1.md) sections 4.4, 5.5, 6.1 and 8. The geometry follows the documented values, and the presentation layer handles readability.

- Revision: `r_7a36158e3c3b4db99eacb702f1785f64` (collection `project`, asset `a_84c94455cca54d4baba72eef11958017`, tag `firearm-bolt-v2`).
- GLB: `sha256:d145f7eb441bdcd0031de2342f1cc581f34de6a513754249de546a564de30153`, 651,760 bytes.
- Source: [authoring/firearm-bolt-v2-sights.kiln.js](../authoring/firearm-bolt-v2-sights.kiln.js). Pins: [authoring/firearm-bolt-v2-pins.json](../authoring/firearm-bolt-v2-pins.json).
- Cost: 12,320 triangles (unchanged) and 14 draws (13 before). The extra draw is the blade's own owner. Materials and textures are unchanged.

## What changed

| Item | v1 | v2 | Label |
|---|---|---|---|
| Front blade width (gun Z) | 3.0 mm | **1.2 mm** measured from the GLB | Derived (REME zeroing data) |
| Blade owner | root batch | `Joint_FrontSight`, pivot `[0.578, 0.1295, 0]` at the blade base on the sight plane | — |
| Sight line over bore (bore y = 0.110) | 42 mm (front), 41 mm (rear) | **29.0 mm**, parallel to the bore | Model; Documented value is 25.4 mm |
| `anchor_sight_front` | `[0.578, 0.152, 0]` | `[0.578, 0.139, 0]`, exactly at the blade tip (offset 3e-10 m) | — |
| `anchor_sight_rear` | `[-0.116, 0.151, 0]` | `[-0.1195, 0.139, 0]`, at the aperture centre | — |
| `anchor_eye` | none | `[-0.2195, 0.139, 0]`, 0.100 m behind the rear anchor on the sight line | Target (cheek weld) |
| `Joint_RearSight` pivot | `[-0.116, 0.137, 0]` | `[-0.1195, 0.131, 0]` (the hinge axle) | — |
| Clear aperture | about 5.4 mm (the bevel narrowed the 6.2 mm path) | 6.2 mm | Estimate |
| Sight radius | 694 mm | 697.5 mm | Model; Documented value is 730 mm |

### Front sight

- The blade alone sits under `Joint_FrontSight`. A game can scale that node's local Z for the 2.5 px readability floor without moving the tip or the protector.
- The protector ears stay in the root batch. Their tops drop by 13 mm along with the blade, so they keep v1's 8 mm rise over the tip.
- The front sight base is unchanged.

### Rear sight

- The Mk 2 style L-shaped flip sight now hinges on a 3 mm axle just behind the receiver bridge. The axle is carried by the unchanged rear protectors.
- The upright leaf rises behind the bridge, so the aperture looks over the bridge top.
- The unused leg lies rearward over the bolt way. It sits below the eye-to-aperture rays and 2.3 mm above the lifted bolt handle at full lift.

### Unchanged

Every other node, pivot and anchor name and position is unchanged. That covers:

- `Joint_BoltSlide` and `Joint_BoltLift` at `[-0.14, 0.11, 0]`
- the magazine, trigger, hand, grip, muzzle and sling anchors
- materials, batch names, the recessed muzzle and `Inspect_Bolt_Exterior`

## Sight height residual (not achieved)

The sight line is 3.6 mm (14%) above the documented 25.4 mm. Two parts of the model set the floor:

- The receiver bridge top is at y = 0.135, which is 25 mm over the bore. The model bolt is 10.8 mm in radius, and the bridge sits above it with a 4.2 mm gap.
- The rear handguard crest is also at y = 0.135.

A 6.2 mm aperture has to look over the bridge without the bridge entering the view, and 29 mm is the lowest clean line. A full correction would mean rebuilding the bolt diameter and the bridge and handguard heights. That was out of scope. In the sight picture, the handguard crest hides the bottom of the blade and the top of the front sight base. The tip and about 8 mm of the blade stay visible.

## Evidence (`evidence/firearm-bolt-v2/`)

- [geometry-proof.json](../evidence/firearm-bolt-v2/geometry-proof.json) comes from [verify.mjs](../evidence/firearm-bolt-v2/verify.mjs), which runs on the saved GLB against the v1 GLB. It reports **pass**:
  - Non-sight anchors and pivots, animation channels and material names are identical.
  - All 5,304 changed triangles lie inside the two sight regions.
  - The muzzle centre ray terminates 26 mm behind the rim, as in v1.
  - The eye-to-front-tip segment hits no geometry.
  - Of 253 pinhole rays from `anchor_eye` through the aperture, none are blocked at or before the aperture or by the bridge.
  - Bolt lift and slide samples clear the rear sight by at least 2.3 mm.
  - The rest contacts are intended: blade into base, axle into the protectors, and leaf on the axle. The leaf clears the bridge by 2.1 mm and the bolt by 8.4 mm.
- [final-sights.png](../evidence/firearm-bolt-v2/final-sights.png) is a material-faithful GPU (D3D12) render from [the capture recipe](../authoring/firearm-bolt-v2-sight-capture.json). It shows:
  - the sight picture from `anchor_eye` at 45° vertical FOV, plus a 10° detail
  - side, front and oblique close views of both sights
  - The front sight's side view shows only the protector ear. The muzzle-side and oblique views show the blade.
- [motion-rear-sight.png](../evidence/firearm-bolt-v2/motion-rear-sight.png) shows `Inspect_Bolt_Exterior` sampled past the rear sight. [final-overview.png](../evidence/firearm-bolt-v2/final-overview.png) shows the standard views.
- [save.json](../evidence/firearm-bolt-v2/save.json) is the save receipt. The saved preview is exact-artifact and material-faithful.

## Limits

- These are review renders from the Kiln tool camera, not the game's aim camera.
- There is no ghost-ring treatment, readability scale or near-plane change.
- There is no forced-WebGL2 run.
- The eye distance is a Target to confirm with a hands-and-stock pose.
- The aperture diameter remains an Estimate.
- Performance status is **DIRTY**.
