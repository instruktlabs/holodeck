# Model 1866 satin v2 — muzzle and presentation pivots

Saved immutable child of satin revision `r_cbbfbbc333fe461e939e10361c3453f6`. The previous satin, aged and display LOD remain intact. This lane changes only the rifle asset and its delivery evidence; hands, game/native behavior and canonical pins are owned by the other integration lanes.

## Exact delivery

Asset `a_a8c8a92ae979442dbcf5836c8e72ee2e`, revision `r_d1fa6f16dd67465ba6f41a66a1b9d6f8`, collection `next-firearm-v1`, program `p_5607a0d30c5b`.

- [Pins and transforms](../authoring/rifle-1866-v2-pins.json)
- [Summary](../evidence/rifle-1866-v2-summary.json)
- [Editable source](../authoring/rifle-1866-v2-qualified.kiln.js)
- [Saved GLB](../assets/next-firearm-v1/a_a8c8a92ae979442dbcf5836c8e72ee2e/revisions/r_d1fa6f16dd67465ba6f41a66a1b9d6f8/asset.glb)
- GLB SHA-256: `7496ea5eda935106a15d53b8de3546216d0a78f78575a2a45a4923d983026efe`
- Source SHA-256: `5607a0d30c5b9c356db4ec0fa40adc4345adf3642ac34d8890245f4e45d47874`

The [existing reference dossier](next-firearm-v1.md) remains the identity/provenance authority: a plain sporting-form interpretation, not a reproduction of one museum object. No additional historical or engineering claim is made. No third-party pixels were added. The cavity and pivots are presentation artwork only.

## What changed and what was preserved

The two dark cylinders and eight front-cap triangles were removed. A lip with an open center, receding interior wall and blind back surface now produces readable depth from both oblique sides. The outer octagonal barrel surface is retained. A ray through the center first meets the blind back at X≈0.589; a rim ray first meets X≈0.598, an authored visual setback of 0.009 asset metres. This is not a through-bore or functional interior.

Lever and hammer meshes were parented under separate pivots. Child translations cancel pivot translations at rest, preserving the old world-space shape. The four existing thumb ribs were moved from the static fastener batch to a hammer child so they travel with it. The trigger remains a separate stationary mesh.

The [independent saved-GLB audit](../evidence/rifle-1866-v2/geometry-audit.json) compares triangle multisets in world coordinates at 1e-7 m tolerance. Only 8 barrel-cap and 224 placeholder-muzzle triangles are removed; only 256 new muzzle triangles are added. All other world triangles, all eleven old anchors, both embedded image byte hashes and every named material definition are preserved. Material array order changed because of node traversal; material values did not. Kiln's [comparison](../evidence/rifle-1866-v2/final-comparison.json) independently identifies the expected hierarchy and muzzle changes. No global geometry-identical claim is made.

## Rig contract

Metres, +X forward, +Y up, +Z right, receiver reference origin. Both pivots have identity rest quaternion [0,0,0,1] and scale [1,1,1]. Rotate locally about +Z for the included cosmetic review. These are visual pivot choices, not mechanical specifications.

| Pivot | Parent-local / world rest XYZ | Child local translation | Review maximum |
|---|---|---|---|
| Joint_Lever | -0.011, 0.091, 0 | 0.011, -0.091, 0 | +32° Z |
| Joint_Hammer | -0.101, 0.166, 0 | 0.101, -0.166, 0 | +22° Z |

Lever child: `Mesh_Lever_Exterior_NextFirearm_BluedSteel`. Hammer children: `Mesh_Hammer_Exterior_NextFirearm_SteelContact` and `Mesh_Hammer_ThumbRibs_NextFirearm_BluedSteel`. Child quaternion/scale remain identity. Do not apply the pivot translation twice when importing world-baked vertex positions.

Included `PresentationLeverReview` is a one-second looping authoring demonstration: rest → peak at 0.5 → rest at 1.0, using eased quaternion tracks. Adapter gameplay clips and timing remain separate. Five sampled GPU poses were actually viewed, and endpoint closure reports closed. This does not certify continuous clearance or hands.

| Preserved anchor | World XYZ metres |
|---|---|
| anchor_hand_right | -0.147, 0.089, 0.019 |
| anchor_hand_left | 0.215, 0.106, -0.02 |
| anchor_grip_primary | -0.147, 0.084, 0 |
| anchor_grip_support | 0.215, 0.115, 0 |
| anchor_sight_rear | 0.11, 0.2, 0 |
| anchor_sight_front | 0.568, 0.2, 0 |
| anchor_vfx_muzzle | 0.601, 0.173, 0 |
| anchor_interaction_select | -0.005, 0.14, 0.03 |
| anchor_interaction_loading_gate | 0.024, 0.13, 0.024 |
| anchor_interaction_lever | -0.142, 0.026, 0 |
| anchor_support_butt | -0.503, 0.005, 0 |

Every anchor has identity quaternion and unit scale. Loading-gate point remains the existing right-side visual anchor; outward is +Z. No new loading-gate opening or functional loading internals were made. No accessories are allowed by the existing contract.

## Costs and visual evidence

9,800 triangles (+24), 16 estimated draw primitives (+2), five materials (unchanged), 555,636 GLB bytes. Two unchanged original images: 512² walnut and 128² brass packed roughness, estimated 1,485,484 decoded RGBA8 bytes including mips. Rest bounds: 1.112849 × 0.281447 × 0.048772 m. X is 0.00105 m shorter because the old dark disks protruded beyond the actual barrel face; Y/Z bounds are unchanged. Zero nonfinite vertices and degenerate triangles.

Actually reviewed [final muzzle/assembly sheet](../evidence/rifle-1866-v2/final-review.png), [sampled motion](../evidence/rifle-1866-v2/final-motion-review.png), and the exact saved preview. Saved preview reports materialFaithful=true and exactArtifact=true. In-loop custom views and sampled pose derivatives are material-faithful GPU reviews, not independent exact-artifact flags; saved GLB hash matches the final in-loop geometry. QA acceptance is a structural pass, not owner approval.

- Blind cavity, lip dimensions and pivot centers are artistic exterior estimates, not exact historical or functional dimensions.
- Cavity interior facets remain visible at extreme macro view; no normal-map/sculpted-wear refinement.
- Five sampled cosmetic poses and closed endpoints do not prove continuous motion clearance, physical operation or hand contact.
- First-person aim projection, trigger contact, hand/lever separation, loading gesture and both engine imports are destination gates.
- Old satin, aged and LOD revisions are intact; old variants retain their placeholder muzzle and are not substitutes for this child.
- No clean FPS/timing claim: hub and PC load contaminates performance measurements.

## Separate loading cue

[Token pins](../authoring/rifle-1866-v2-loading-token-pins.json) record independent original asset `a_98ff5290ff394615bd25913a3a60f3d4` / `r_3ff9c7f1eb254f14a4efbb7ec4e58265`. The rifle child was not modified for this cue. It is an abstract 0.030 m long brass/copper token for the fingers-to-gate gesture, not an exact caliber or historically qualified ammunition replica. +X long axis, center origin; center/nose/base anchors at X=0/+0.015/-0.015. Two materials, two draw primitives, 296 triangles, no textures, 12632 GLB bytes. Original procedural geometry and constant PBR only; no borrowed pixels. Saved six-view GPU preview inspected, exactArtifact=true. Hand fit, gate approach, visibility timing and engine import remain integration gates.

GLB: `assets/next-firearm-v1/a_98ff5290ff394615bd25913a3a60f3d4/revisions/r_3ff9c7f1eb254f14a4efbb7ec4e58265/asset.glb`; SHA-256 `a6c1ab594c8e5595c788345ce91a01baa408255c94860d88526b01d9c43026f5`.
