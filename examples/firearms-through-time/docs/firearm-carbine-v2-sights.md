# Carbine v2: documented sights

> **v3 (27 Oct 2026):** the owner approved the catalogue-proportion refit. Revision `r_f0ad6458af8b40c48ca99eca88d48abe` (tag `firearm-carbine-v3-proportions`) rescales the whole carbine with the stock retracted and keeps these sight parts. See [firearm-carbine-v3-proportions.md](firearm-carbine-v3-proportions.md).

Recorded 27 October 2026. This revision is a child of `r_74666f57c86c43fb91cdc9252736d017` ([v1](firearm-carbine-v1.md)). It implements owner decision 7 in [sight-research-v1](sight-research-v1.md) section 8: rework the M4 sights before integration. It follows sections 4.5, 5.5 and 6.1. Apertures and heights use documented or reference-measured values, and readability is left to the presentation layer. Nothing was integrated: no game, view-profile, Holodeck or native file changed.

- Revision: `r_776d1f994d254c8ca5a414029e26c57f` (collection `project`, asset `a_b50808618ce54c1386d12212e186cc47`, tag `firearm-carbine-v2-sights`).
- GLB: `sha256:5a15f623ecbe762484d1cf9ee941891f4fa4b4418c82d0a186209fcb11c22cc7`, 876,592 bytes.
- Source: [authoring/firearm-carbine-v2-sights.kiln.js](../authoring/firearm-carbine-v2-sights.kiln.js) (program `p_2728c5df9dac`). Pins: [authoring/firearm-carbine-v2-pins.json](../authoring/firearm-carbine-v2-pins.json).
- Cost: 13,952 triangles (13,596 before) and 18 draws (16 before). The two extra draws belong to the leaf and the post, which each have their own owner node. Materials (5) and textures (2) are unchanged.

## Verify the reported sight height first

The research figures in section 4.5 were read from source literals that come *before* v1's 0.70 Y/Z proportion pass. The exported v1 GLB actually measures:

- 81.9 mm sight line over the bore, not 117 mm;
- the front anchor 1.4 mm below the post top, not 2 mm;
- a 4.6 mm torus bore, not 6.6 mm.

The 434 mm sight radius is correct, because X is not scaled.

## Reconciliation against the catalogue side view

The R0977 photo on Colt 2024 page 24 **[S5]** was rendered at 300 dpi and measured; the numbers are in [reference-reconciliation.json](../evidence/firearm-carbine-v2-sights/reference-reconciliation.json). The embedded photo is 72 ppi, so each position carries about ±3 mm.

- **The photo shows the stock retracted.** No buffer tube is exposed between the castle nut and the stock. v1 scaled the photo to the *extended* 85.80 cm envelope, so v1's muzzle-to-receiver geometry is about **10.6% long in X**. v1's front sight, receiver rear and butt all match the photo mapped at that extended scale.
- **Retracted scale (77.55 cm, Documented).** At this scale the photo gives a 371 mm sight radius (against about 368 mm **[S4]**) and a 63 mm sight height (against the commonly quoted 2.5 to 2.6 in). The two readings support each other.
- **Front sight base.** At the model's own scale, it sits where the photo puts it relative to the muzzle and the handguard (0.290 against 0.293). It was **not moved** along X.
- **Carry handle.** The photo puts the handle about 13 mm further forward relative to the receiver ends. The model's rail stops 20 mm short of the receiver front (a sloped nose), so shifting the handle would overhang the rail and move both mount anchors. The handle was **not moved**. The aperture moved 3.75 mm forward, so it sits about 20 mm ahead of the handle rear, as in the photo.
- **Heights.** The reference supports a lower line, so the sight line was lowered from 81.9 mm to **66.0 mm** over the bore. This required:
  - lowering the handle profile;
  - lowering the front-sight frame top by 15 mm;
  - lowering the front ears.

## What changed

| Item | v1 | v2 | Label |
|---|---|---|---|
| Rear sight | 4.6 mm torus, no leaf | L-shaped dual flip leaf, 2.5 mm thick and 11 mm wide, in a housing with protective ears, a hinge axle and a right-side windage knob | Leaf dimensions: Estimate |
| Large aperture (default, upright) | — | **5.08 mm** (0.200 in); measured clear diameter 5.080 mm | Documented (secondary, S3) |
| Small aperture (flipped) | — | **1.78 mm** (0.070 in); measured clear diameter 1.780 mm | Documented (secondary, S3) |
| Leaf owner | — | `Joint_RearSight` at `[-0.136, 0.1385, 0]` (hinge axle, under `Joint_CarryHandle`); flip = +90° about local Z | — |
| Front post | 3 × 22 × 3 mm in the root batch, top 1.4 mm above the anchor | **1.83 mm** square post (measured from the GLB), 9.5 mm long including 1 mm set into the frame | Estimate (about 0.07 in USGI post; no source confirmed) |
| Post owner | root batch | `Joint_FrontSight` at `[0.293, 0.1365, 0]` (post base on the sight plane, under `Joint_Receiver`) | — |
| Front ears | top 2.4 mm *below* the post top | top 3 mm above the post tip | Model |
| Sight line over bore (bore y = 0.080) | 81.9 mm | **66.0 mm**, parallel to the bore | Model; reference 63 to 64 mm (Estimate) |
| Sight radius | 434 mm | **430.25 mm** | Model; reference 368 mm (Documented secondary) |

### Anchors

| Anchor | v1 | v2 | Definition |
|---|---|---|---|
| `anchor_sight_rear` | `[-0.141, 0.1619, 0]` | `[-0.13725, 0.146, 0]` | Large aperture centre on the leaf's eye-side face |
| `anchor_sight_rear_alt` | none | `[-0.13725, 0.146, 0]` | Small aperture centre on its eye-side face with the leaf flipped. It is a static anchor at the flipped position. It coincides with `anchor_sight_rear` because both apertures sit 7.5 mm from the hinge (Model; any real offset between the two apertures is not sourced). |
| `anchor_sight_front` | `[0.293, 0.1619, 0]` | `[0.293, 0.146, 0]` | Post tip, top-centre (3e-10 m from the geometry) |
| `anchor_eye` | none | `[-0.20725, 0.146, 0]` | 0.070 m behind `anchor_sight_rear` on the sight line |

`anchor_eye` extras:

- `eyeReliefM`: 0.07
- `basis`: "Derived/Estimate"
- `sourceIds`: S1, sight-research-v1 4.5, 5.1 and 8
- `confidence`: medium-low

**Stock sanity:** `anchor_eye` is **0.168 m forward** of `anchor_support_butt` in X. That anchor is on the extended-stock butt. The value is inside the 0.15 to 0.35 m band in section 6.3.

The root `sight` block carries `rearType`, `frontType`, `apertureInnerDiameterM: [0.00508, 0.00178]`, `frontWidthM`, `frontHeightAboveBoreM`, `sightRadiusM` and the reference values, each with its own label, as section 6.1 item 5 asks.

### Moved or added

- **Moved anchors:** only `anchor_sight_rear` and `anchor_sight_front`.
- **Added nodes:**
  - `Joint_RearSight` and `Joint_FrontSight`
  - `anchor_eye` and `anchor_sight_rear_alt`
  - `Mesh_RearApertureLeaf` and `Mesh_FrontSightPost`
- **Reshaped geometry, inside existing batches:**
  - `Mesh_CarryHandle_Carbine_Anodized`: the handle profile is lower, with a sloped top and a taller opening.
  - `Mesh_CarryHandle_Carbine_Steel`: the ears, axle and knob replace the base block and the torus.
  - `Mesh_Receiver_Carbine_Steel`: the front-sight frame, the ears and the removed batched post.

### Unchanged

All other anchors and pivots keep their names and world matrices. That includes:

- the hands, grips, magazine and muzzle anchors;
- the butt anchor;
- both carry-handle mount anchors, which still coincide.

Materials and the recessed muzzle are also unchanged. v1 had no clips, and v2 has none.

## Residuals (above 5% or 3 mm)

**Sight radius: 430.25 mm against 368 mm, which is 62 mm (16.9%) long.** This is not achieved. It breaks down as follows:

- **About 39 mm** comes from the 10.6% X scale of the whole muzzle-to-receiver assembly.
- **About 13 mm** comes from the handle sitting aft on the short model rail.
- **The rest** is the aperture-in-handle placement at the model's scale.

A full correction would need a whole-gun proportion revision: scale the muzzle-to-receiver X by about 0.904 and rebuild the receiver nose and rail. That would move every hand, grip, magazine, muzzle and mount anchor, so it is left for an owner decision. The effect on the sight picture is small. The post subtends 4.8 px at 1080p and 45° here, against 5.4 px at the real radius.

**Sight height: 66.0 mm against a 63 to 64 mm photo reading, a 2 to 3 mm difference.** This is within tolerance and inside the quoted 2.5 to 2.6 in. The model rail top is 4 mm higher than in the photo, which sets the floor: the aperture sits 26 mm over the rail, against 27.6 mm in the photo.

## Evidence (`evidence/firearm-carbine-v2-sights/`)

[geometry-proof.json](../evidence/firearm-carbine-v2-sights/geometry-proof.json) is written by [verify.mjs](../evidence/firearm-carbine-v2-sights/verify.mjs), which was adapted from the No.4 script. The script runs on the saved GLB and compares it with the v1 GLB. It reports **pass**:

- **Unchanged contracts:** non-sight anchors and pivots, material names and clips are identical. The mount anchors coincide.
- **Changed triangles:** all 1,772 lie inside the front-sight and carry-handle/rear-sight regions.
- **Muzzle:** the centre ray terminates 36 mm behind the rim, identical to v1.
- **Sight line:** eye, rear and front are collinear. The eye is exactly 0.070 m behind the rear anchor. The eye-to-post-tip segment hits no geometry before it reaches the post's own tip edge.
- **Rest pose (large aperture):** 253 pinhole rays go from `anchor_eye` through the aperture out to 0.95 of its radius. None is blocked before the front-sight region: 215 reach the sky, 36 hit the front-sight assembly (batched frame, ears or base), and 2 hit the post.
- **Flipped pose (small aperture):** 0 of 253 rays are blocked. The large leg lies rearward, 0.66 mm above the handle.
- **Anchors on geometry:** both rear anchors lie on their leaf's eye-side face, inside its outline. The clear diameters match the nominal values within 1e-9 m. The front anchor is 3e-10 m from the post tip.
- **Contacts (intended):**
  - The post and the leaf are set into the frame and the axle respectively.
  - The leaf clears the ears by 0.60 mm and the handle by 0.66 mm, in both poses.
  - The rear ears are seated in the handle.
- **Presentation numbers (Derived, pinhole, 45°, 1080p):**
  - Post apparent width: 4.8 px, above the 2.5 px floor, so no readability scale is needed at 1080p.
  - Large aperture: 4.16° (9.2% of screen height).
  - Small aperture: 1.46° (3.2%).

Renders:

- [final-sights.png](../evidence/firearm-carbine-v2-sights/final-sights.png) is a material-faithful GPU (D3D12) render of the saved GLB bytes, from [the capture recipe](../authoring/firearm-carbine-v2-sight-capture.json). It shows the pinhole sight picture from `anchor_eye` at 45° vertical FOV, plus a 10° detail. The post tip sits in the centre of the large aperture, between the front ears. It also has close views of both sights and a left-side view of the handle and sight line.
- [review-flipped-small-aperture.png](../evidence/firearm-carbine-v2-sights/review-flipped-small-aperture.png) comes from a **review-only** variant with the leaf rotated +90° ([review-flipped.kiln.js](../evidence/firearm-carbine-v2-sights/review-flipped.kiln.js); not saved and not the delivered pose). It shows the small-aperture sight picture.
- [final-overview.png](../evidence/firearm-carbine-v2-sights/final-overview.png) shows the standard six views.
- `draft-01*.png` are the first draft for comparison. The handle opening was enlarged afterwards.
- [save.json](../evidence/firearm-carbine-v2-sights/save.json) is the save receipt. The saved preview is exact-artifact and material-faithful.

## Limits

- **Review cameras:** these are Kiln tool cameras, not the game's aim camera. The renders use a hard pinhole, with no ghost-ring vignette, near-plane change or readability scale; those belong to the presentation layer.
- **Backends:** there is no forced-WebGL2 run.
- **Labelled Estimates:**
  - post width;
  - leaf thickness and width;
  - sight-height reference;
  - eye distance;
  - the shared height of both apertures.
- **Flip:** the flip is a pose on `Joint_RearSight` that a game applies. No clip is exported.
- **Pending:** integration, the hands-and-stock pose review, the whole-gun proportion question and owner acceptance.
- **Performance:** status is **DIRTY**.
