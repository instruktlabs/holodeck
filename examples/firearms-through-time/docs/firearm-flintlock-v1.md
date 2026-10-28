# Pattern 1742 flintlock exterior candidate

One original editable LOD0 game-art candidate is saved in the Kiln project collection. The identity is tied to Colonial Williamsburg **1982-9**, a Pattern 1742 Land Service Musket in its surviving modified configuration. This is a proposed representative; roster mapping and catalog ID remain unresolved. Read the [pre-modeling dossier](firearm-flintlock-v1-dossier.md) for sources, viewed images, rights and historical limits.

Asset `a_0a31fd5eeb864b529202724a65de4623`, revision `r_30a6f49421c44da2995ee562e92ab3bc`, source `p_f8b72f92b57a`. Exact source/GLB/preview paths and SHA-256 hashes are in `evidence/firearm-flintlock-v1-inventory.json`; the detailed audit is `evidence/firearm-flintlock-v1-summary.json`. `authoring/firearm-flintlock-v1-pins.json` is this batch's handoff only. Saved source and `firearm-flintlock-v1-final-exact.kiln.js` are authoritative; draft files retain development history.

## Delivered and reviewed

The stock uses rounded longitudinal sections with original procedural walnut. Steel and brass have restrained PBR finishes; the visible guard is open. The final refinement replaced an angular cock plate with a rounded curved neck, softened the frizzen profile, removed duplicate role names and corrected cap normals. Static parts are batched by owner/material while retaining semantic part bounds, anchors and separate moving owners. The barrel remains a separate mesh for inspection.

The muzzle has an annular front rim, inward-facing side walls and a blind end behind the opening. This is actual modeled depth, not a disk at the mouth. Exported-GLB checks verified center and radial rays travel past the mouth to the recessed termination, the inner/outer wall winding faces the appropriate direction, the rim remains, and the shell has two incident faces per welded edge without degenerate triangles. The authored visual setback is approximately 0.046 m; it is artistic cavity depth, not a historical bore specification. Three actual GPU muzzle angles show changing wall occlusion and parallax. A separate grazing-light rig is not qualified.

The two-second `ExteriorInspection` clip articulates `Joint_Cock`, `Joint_Frizzen` and `Joint_Trigger`. It is a limited visual clearance study, not a Fire/Reload animation or a historically validated sequence. Five GPU phases were inspected. Independent decoded-GLB sampling at nine phases found minimum selected surface distances of approximately 0.0587 m cock/barrel, 0.0090 m frizzen/barrel, 0.0676 m cock/frizzen and 0.0152 m trigger/brass guard-and-fittings. Attached pivots and intentional furniture embedment are excluded from separation rejection. These samples do not certify continuous swept volumes, all joins or hand fit.

Saved previews are material-faithful exact-artifact GPU renders with matching GLB hashes. The final structural QA reports no blockers or warnings and ten overlap observations for joined shells/details. No claim of comprehensive collision clearance or visual owner acceptance follows from that status.

## Structural cost and contract

| Cost | Saved candidate |
|---|---:|
| Triangles | 17,044 |
| Mesh primitives / draw estimate | 9 |
| Materials | 5 |
| GLB bytes | 1,003,748 |
| Embedded texture images | 2 |
| Decoded RGBA8 bytes | 4,259,840 |
| Estimated texture bytes with mipmaps | 5,679,788 |

The textures are original 1024² walnut albedo and 128² packed steel surface data; no museum photographs are included. There are no external material pins. All materials are opaque and single-sided. No LOD was created: a destination distance requirement and close-view acceptance are needed before selecting a transition. Both machines are under load, so these counts establish neither FPS nor resident GPU memory.

Coordinates are meters, +X toward muzzle, +Y up, +Z right, root at an authored breech frame. The measured envelope is approximately 1.553 × 0.2425 × 0.0786 m. Named `anchor_hand_*`, `anchor_grip_*`, `anchor_sight_*`, `anchor_vfx_muzzle`, interaction and butt-support nodes are preserved through the refinement; exact transforms are in the pins. `anchor_sight_rear` is an abstract alignment target, not a physical rear sight. `anchor_attachment_bayonet_reference` is reserved and unqualified. The attachment allowlist is empty; no bayonet, sling or modern accessory fit is approved.

## Remaining work

Historical exactness remains limited by the available museum image resolution. Fine markings, hidden surfaces, conservation-specific wear and precise muzzle details were not reconstructed. The silhouette and materials are reference-informed original art, not an exact replica or AAA-qualified hero asset.

Integration requires an authoritative roster mapping, destination catalog registration, explicit frame conversion, hand grip/contact fitting, complete inspect/equip/action presentation, attachment validation if later introduced, collision/selection proxies and muzzle/target-event binding. Unreal and Holodeck close/aim/third-person views, dedicated lighting review, LOD transition tests, clean-host performance and owner acceptance are pending. No canonical pins, world, native maps, gameplay, shaders or hand assets were changed.

Reproduce the bounded file/geometry audit from `authoring/`: `node firearm-flintlock-v1-verify.mjs`, then `node firearm-flintlock-v1-finalize.mjs`. The geometry check samples the exported animation and may take time under shared load. Neither script mutates a shared destination.
