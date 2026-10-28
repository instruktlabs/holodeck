# Retrieval rail candidate v1

Two immutable Kiln candidates are ready for parent integration. They are original fictional game scenery, not a physical mechanism specification. No world, canonical pin, native map or gameplay file was changed. PC and hub timing remain dirty; costs below are structural measurements only.

| Candidate | Exact asset / revision | Triangles | Draws / materials | GLB bytes |
|---|---|---:|---:|---:|
| Overhead extension and near portal | `a_1e848fabc2274391abc6e832db004173` / `r_acf7d9fe86504eb299d788f9ddf13671` | 660 | 3 / 3 | 47,232 |
| Retrieval-compatible paper dock | `a_9cddb328290e4240b56374d95649e4ca` / `r_946b8c27076f409fbfd96fe8ee4ab139` | 2,164 | 9 / 6 | 72,408 |

Both use zero textures. The rail batches 15 authored forms into three rigid material meshes while retaining route and mount anchors. No LOD was added: this bounded 660-triangle module does not justify another untested variant.

## Reference and frame

The exact saved paper source and GPU preview from parent revision `r_6bd698bfbc9540e4993d70544c89f6c7` governed dimensions and materials. Existing support `a_c8f201db93454d2bb3d09bc9c015d610` / `r_dfc4d696292148e4acc428cc3cfe16a2` governed the portal proportions and mounting height. These are project assembly references, not external historical or engineering references. Charcoal steel, alloy and restrained teal use the paper asset's exact named material values; no external textures, new material resources or borrowed geometry were used for the rail.

Place the rail root coincident with the paper and existing support at world `[24,0,-2.6]`, in metres, +Y up and +Z right. The existing support stays. Move only `pivot_carrier` from `[0,2.25,0]` to `[-3.2,2.25,0]`; world retrieval X is 20.8.

The new guide joins the old dock at X=-0.45 and extends to -3.6, at Y=2.35. The upper spine spans X=-3.6 through +0.29, with top at the existing Y=2.41 mounting plane. The new portal is centred at X=-3.5 with posts at Z=±0.55. Six exported anchors are `anchor_route_start`, `anchor_route_end`, `anchor_rail_join_existing`, `anchor_support_mount_near`, `anchor_mount_existing_A`, and `anchor_mount_existing_B`.

## Paper correction and preservation

The original negative-X dock stop and buffer obstructed retrieval. The child changes exactly two source positions: Dock_Stop X=-0.42 to +0.42 and Dock_Buffer X=-0.3775 to +0.3775. All names, dimensions, materials, pivot hierarchy, scoring surface, anchors and frame definitions remain. The root steel mesh changes because its stop geometry is batched; the buffer's node translation changes. No topology, triangle, draw or material count changes.

Kiln stable-part comparison reports 0 added, 0 removed, 2 changed and 22 unchanged nodes. Carrier, replaceable-sheet and scoring-anchor subtrees are unchanged. Independent saved-GLB comparison confirms unchanged material JSON, unchanged node definitions except the buffer translation, and changed vertex data only in root steel mesh index 7. Parent revision is recorded in the saved child manifest.

## Reviewed fitting and collision handoff

Actual GPU material views were read: rail multiangle, combined assembly multiangle, and the exported inspection clip at carrier X=0, -1.6 and -3.2. The default saved rail preview was also read. The inspection clip belongs only to the evidence assembly; the saved candidate assets contain no runtime animation. Camera pose images are derivatives and do not claim exact-asset preview fidelity.

The carrier's decoded rest bounds are X±0.103, Y=0.983..2.361, Z±0.34. Its complete translation envelope extends to X=-3.303. Upper spine clearance is 0.024 m; the relocated dock buffer clears the start envelope by 0.262 m; the near stop clears the retrieval envelope by 0.227 m. The guide body stays 0.006 m inside the rollers' inner Z plane; alloy wear strips meet that plane at nominal tangency. This is a visual guide contact, not a simulated wheel constraint.

`evidence/range-retrieval-v1-colliders.json` provides exactly five root-local boxes: two posts, two feet and the crossbeam. Every box is strictly separated from the full carrier translation envelope. Do not generate an enclosing hull over the route or merge these with carrier collision. The decorative guide, spine, stop and markers have no blocking collider in this manifest. Existing support and target collision remain parent-owned.

`python authoring/range-retrieval-v1-verify.py` rechecks saved hashes, exact rendered/saved GLB identity, parent/child geometry preservation, measured costs and collider envelope separation. The fitting proof is `evidence/range-retrieval-v1-fitting-proof.json`; exact absolute source/GLB/preview paths and SHA-256 values are in `evidence/range-retrieval-v1-inventory.json`.

## Remaining integration

Parent must bind the paper child revision, import the separate rail at the coincident root, convert collider axes/units through the existing adapter, retain native material overrides, and verify runtime start/middle/end travel and interaction interlocks. The existing carrier's +X axis metadata is retained; it describes the axis, while the adapter supplies negative displacement. No live retrieval, target UI, shot history, collision or destination material claim is made by these asset reviews. Continuous collider envelope separation is established for the five supplied boxes; three posed images are not a general collision certificate.

Source hashes: rail `90608247c28015422270914087755ed8d81508696d37599994a7bf379a1259af`; paper `5e121e73e026a64312157251baa8e2a1596c552b07367885319e3c31c1c9074a`.

GLB hashes: rail `4421e9677254c491c872d210d8e0879a5eb2f4c7285861ea361be634983be69d`; paper `5d75343beef29bbd6fb6269f5aba0ca3891969739a2e38ae9868153a2d74bba9`.
