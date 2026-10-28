# Range dressing v1

Four complementary service props are saved as immutable, editable Kiln revisions. The 26 October authoring pass changed no shared scene, map or runtime source. On 27 October the props were placed, unchanged, as one service station in Holodeck revision 9 and the Unreal WeaponLab map; see [Destination integration](#destination-integration-27-october). Owner visual acceptance is not claimed.

## Reference and interpretation

The governing reference is [STYLE-GUIDE v0.3](../handoff/design/firearms-through-time/STYLE-GUIDE.md) and the actually inspected [04 shared concourse image](../handoff/design/firearms-through-time/concepts/04-shared-concourse-direction.png). The style guide calls it preferred after user feedback and explicitly says working art direction, not final approval. The layout JSON remains proposal-not-approved-or-runtime-imported. Earlier museum-study01 is superseded. Exact reference hashes and roles are in [the summary](../evidence/range-dressing-v1-summary.json).

The image supplies dark steel low storage, restrained warm caps, contemporary panels and padded work surfaces. The service cabinet, empty padded support, sign and narrow service bench are complementary interpretations of that language. Their dimensions and construction details were authored; they are not measured from the image. Pale concrete remains a facility role rather than an unnecessary material added to each prop.

## Delivered kit and measured cost

All dimensions are metres in X depth/front, Y up and Z width. Origin is floor/foot contact at footprint centre, except the sign whose origin is its rear wall-mount plane at the bottom centre. +X faces the user.

| Prop | Overall X × Y × Z | Triangles | Draws | Materials | Images | Saved GLB |
|---|---:|---:|---:|---:|---:|---:|
| service-cabinet | 0.5290 × 0.8600 × 0.9000 | 748 | 7 | 5 | 3 | 1461.8 KiB |
| empty-padded-rest | 0.7200 × 0.2315 × 0.2800 | 516 | 2 | 2 | 0 | 41.1 KiB |
| wall-sign | 0.0720 × 0.8200 × 0.5200 | 480 | 6 | 6 | 3 | 1440.1 KiB |
| service-bench | 0.5200 × 0.8890 × 1.3000 | 880 | 4 | 3 | 3 | 1471.3 KiB |

One of each totals **2624 triangles and 19 draw calls**. Static construction is grouped by material; label faces, cabinet doors and bench mat stay addressable. The two unnecessary internal bolt sets were removed, saving 256 triangles and two draw calls. Chamfers use low topology. No LOD chain was added to these 480–880 triangle props; material, draw and texture sharing should be addressed first if many repeats are placed.

The wood-bearing assets share the exact `procedural-wood-dry-v3` pin `sha256:bf089c81b82a2a147b3fb814cd904bfb71219b81f6c41d97e12ce2e17f320b96`. It contains three unique 1024² images: sRGB albedo, linear normal and packed occlusion/roughness/metalness. Four slots reuse those three maps. One set is 12 MiB decoded RGBA8, approximately 16 MiB with mips. **Independent loading of the three GLBs can duplicate that to approximately 48 MiB.** The library pin alone does not prove scene deduplication. The rest has zero images and zero external dependencies. [Material provenance](../evidence/range-dressing-v1/wood-material.json) records the original local recipe, hashes and unpublished local license.

Repeat whole assets with shared mesh/material references in the destination. Per-object transforms can vary, but no GPU-instancing extension or runtime instancing has been qualified.

## Pins and evidence

- **service-cabinet**: `p_bf7e59663f42`; collection `project`, asset `a_2188ac85719f42a490b50352136da5d4`, revision `r_7addf18cafc24879acbb04d386232ff5`. [Saved source](../authoring/assets/kiln/a_2188ac85719f42a490b50352136da5d4/revisions/r_7addf18cafc24879acbb04d386232ff5/source.kiln.js), [GLB](../authoring/assets/kiln/a_2188ac85719f42a490b50352136da5d4/revisions/r_7addf18cafc24879acbb04d386232ff5/asset.glb), [exact saved preview](../authoring/assets/kiln/a_2188ac85719f42a490b50352136da5d4/revisions/r_7addf18cafc24879acbb04d386232ff5/preview.png), [construction sheet](../evidence/range-dressing-v1/service-cabinet-final.png).
- **empty-padded-rest**: `p_99b85b1af309`; collection `project`, asset `a_c8c326a77ad64596a791ee40c93afe68`, revision `r_365a891fc8b34f9cb7288180dbc2d67d`. [Saved source](../authoring/assets/kiln/a_c8c326a77ad64596a791ee40c93afe68/revisions/r_365a891fc8b34f9cb7288180dbc2d67d/source.kiln.js), [GLB](../authoring/assets/kiln/a_c8c326a77ad64596a791ee40c93afe68/revisions/r_365a891fc8b34f9cb7288180dbc2d67d/asset.glb), [exact saved preview](../authoring/assets/kiln/a_c8c326a77ad64596a791ee40c93afe68/revisions/r_365a891fc8b34f9cb7288180dbc2d67d/preview.png), [construction sheet](../evidence/range-dressing-v1/empty-padded-rest-final2.png).
- **wall-sign**: `p_248e07013213`; collection `project`, asset `a_44c754a28a234689b9a9db5f49d9b7fb`, revision `r_c2795340677e4c1b92e760cb181aa26c`. [Saved source](../authoring/assets/kiln/a_44c754a28a234689b9a9db5f49d9b7fb/revisions/r_c2795340677e4c1b92e760cb181aa26c/source.kiln.js), [GLB](../authoring/assets/kiln/a_44c754a28a234689b9a9db5f49d9b7fb/revisions/r_c2795340677e4c1b92e760cb181aa26c/asset.glb), [exact saved preview](../authoring/assets/kiln/a_44c754a28a234689b9a9db5f49d9b7fb/revisions/r_c2795340677e4c1b92e760cb181aa26c/preview.png), [construction sheet](../evidence/range-dressing-v1/wall-sign-final.png).
- **service-bench**: `p_868abb0ae3e7`; collection `project`, asset `a_a90915e8e3bb45bbb0d191b7d0b44bcc`, revision `r_e8133fe19bbe4dc7a8933671fae80a48`. [Saved source](../authoring/assets/kiln/a_a90915e8e3bb45bbb0d191b7d0b44bcc/revisions/r_e8133fe19bbe4dc7a8933671fae80a48/source.kiln.js), [GLB](../authoring/assets/kiln/a_a90915e8e3bb45bbb0d191b7d0b44bcc/revisions/r_e8133fe19bbe4dc7a8933671fae80a48/asset.glb), [exact saved preview](../authoring/assets/kiln/a_a90915e8e3bb45bbb0d191b7d0b44bcc/revisions/r_e8133fe19bbe4dc7a8933671fae80a48/preview.png), [construction sheet](../evidence/range-dressing-v1/service-bench-final2.png).

Every final asset was reviewed in GPU front/rear/top/underside construction views and in its saved six-side preview. All saved preview manifests report `materialFaithful: true`, `exactArtifact: true`, no degradation and Dawn D3D12 on RTX 3070. The in-loop sheets are material-faithful build evidence, with `exactArtifact: false`; the saved previews provide the exact-artifact evidence. Saved attribution is `gpt-6-astra / codex`; high effort was requested by dispatch and is not a field in the save schema. The exporter is `three`, indexed, with optimization off; merging was authored explicitly. Hashes of saved GLB/source/preview were independently checked.

Ten requested exported surface measurements completed at zero distance: cap/frame, label/frame, door/hardware, sign face/recess, sign accent/backing, sign wood/backing, bench top/frame, mat/top and foot/frame groups. These are unsigned surface minima, not strength or every-joint guarantees. Merged-group scope is preserved in the raw inspection receipts. Rest support/contact was inspected visually. Cabinet hardware/door intersection observations are intentional mounting overlap, not an animation approval. All four saved exports have zero glTF validator errors/warnings; QA accepted is separate from owner acceptance and destination qualification.

## Placement, collision and replaceable content

- **Cabinet:** keep its 0.529 m total depth, including handles, inside service pockets. Static closed doors, no interior or motion. Use one conservative body collider. Do not animate the doors until grouped hardware is reassigned to them.
- **Empty rest:** origin is the foot contact plane on a host surface. Footprint is 0.72 × 0.28 m. It does not fit depthwise on the 0.52 m service bench; to stage it empty there, rotate 90° so its 0.72 m length uses the bench's 1.30 m width. No weapon placement or firearm-safety behavior was tested.
- **Wall sign:** rear mount lies at X=0. Blank face spans 0.414 m width × 0.68 m height; front anchor is [0.069, 0.445, 0]. Optional bottom mounting height 0.95 m puts the face centre near 1.395 m. This is an integration suggestion, not a placed sign. Use host-wall collision.
- **Bench:** worktop Y=0.88 m; mat top Y=0.889 m. Service furniture, not seating. Front storage opening is authored as 1.10 m wide and Y=0.23–0.78 m. Proposed collision is top, lower tray and two end-frame boxes.

Exact collider proposals and anchors are in the summary. No collider was baked or applied. Do not put the service furniture in the shared concourse or stair reservations without checking the current walkthrough. Sign and cabinet labels are blank replaceable content faces. Labels, icons, dates and interaction state remain runtime data. Their physical box UVs are not a final text atlas; use a face-aligned runtime plane/decal or controlled material remap.

## Remaining qualification

The warm wood is a dry-v3 veneer proxy; its grain is stronger than the restrained reference and is not a verified oak species/end-grain reconstruction. Surfaces read dark in the review rig; destination exposure and lighting need an actual comparison before changing palette values. No source albedo was darkened to compensate for lighting. Native import/reimport, player-height destination views, traversal/collision, near/far mip behavior, texture sharing and runtime interaction remain untested.

Both the hub and workstation were under load. No timing or FPS result is used, and **no performance verdict is made**. Counts, bytes and decoded image estimates are structural evidence only.

## Destination integration (27 October)

The four saved revisions above are placed unchanged as one service station on the outer (+z) side of the booth bank's end infill. It sits beside the plates lane, outside every lane and the shared concourse.

| Placement | Asset | Holodeck position (m) | Y rotation | Collider |
|---|---|---|---|---|
| `service-bench` | service-bench | [17.75, 0, 4.16] | -90° (front faces +z) | 4 boxes from `collisionIntent` |
| `service-rest` | empty-padded-rest | [17.75, 0.889, 4.16] | 0° (0.72 m length along the bench's 1.30 m width) | 1 low box |
| `service-cabinet` | service-cabinet | [18.95, 0, 4.15] | -90° | 1 body box |
| `service-sign` | wall-sign | [17.75, 0.95, 3.85] | -90° | none (the infill's full-height box covers it) |

- Footprint: x 17.10–19.40, z 3.90–4.43. That is 5 cm proud of the infill's outer face (z = 3.85) and clear of the canopy posts (z ≤ 3.88).
- The rest's feet sit on the bench mat top.
- The sign's back plate sits on the infill's steel mounting-tab plane. Its bottom is at the suggested 0.95 m, above the 0.889 m bench top. Above about 1 m the infill is an open mullion screen, so the booths behind are visible through it; that is the infill's design.
- No interaction, labels or text: the replaceable faces stay blank.

### Holodeck

`pipeline/range-dressing-v1-place.mjs` is a guarded additive migration from revision 8 to 9, in the same plan/apply form as the v7 script:
- It copies the exact saved GLBs into `holodeck-range-slice/assets/imports/` and checks their hashes.
- The plan, request, before-state and manifest are in `evidence/range-dressing-v1-*.json`.

The first apply was rejected by the host before proposal ("Unknown or invalid collider fields"): a placement without a collider must carry `collider: null`, not omit the field. The world stayed at revision 8, and the rejected receipts are kept in `evidence/range-dressing-v1-rejected/`.

Revision 9 renders in WebGPU and forced WebGL2 with no console errors (`evidence/range-dressing-v1-holodeck/`). The rifle profile still starts a string and scores a hit there. Walker traversal into the furniture was not exercised in the browser; the colliders are the validated scene data.

### Unreal WeaponLab

- **Import and placement.** `pipeline/import_range_dressing_v1.py` imports the four rigid derivatives (unique node names, unchanged buffers and materials) into `/Game/Qualification/RangeDressingV1Generated`. It sets sRGB, normal-map and mask texture settings, backs up `WeaponLab.umap`, and adds one `RangeExpansionActor` per prop, tagged `RangeDressingV1`.
- **Rotation.** The actor rotation carries the yaw; the glTF-to-Unreal axis swap negates it, so -90° in Holodeck becomes 90° in Unreal.
- **Preservation.** All 659 other qualification content files, and every existing WeaponLab actor, are unchanged (`evidence/range-dressing-v1-native-result.json`). RangeSliceLab was not changed.
- **Runtime check.** The expansion runtime test gained an opt-in `-RangeDressingTest` path, run by `pipeline/run-range-dressing.ps1`. It requires four dressing actors, 19 mesh components and 6 collision boxes, a capsule sweep that stops on `service_bench_block_*`, and a `service` capture. The bench sweep runs before the paper probe, so the pawn ends where the v7 captures expect. Without the flag, the original nine-check v7 run is unchanged.
- **Editor game.** 13/13 checks with zero material fallbacks. The capsule stopped at x = 1686.8 cm, which is the bench edge minus the 22 cm capsule radius. The concourse route is still clear.
- **Standalone package** (`<package root>/WeaponLab`):
  - Dressing run: 13/13, zero material fallbacks; the `service` capture matches the editor.
  - Unflagged v7 expansion run: 9/9.
  - Regressions: rifle 41/41, pistol 34/34, range-session 56/56.
  - Summary: `evidence/range-dressing-v1-closeout.json`.

### Still open

- Owner art review.
- Labels, text and icons on the blank faces.
- Cabinet doors (static).
- Walker traversal in the browser.
- The same station in RangeSliceLab, if wanted.
- Texture sharing across the three wood-bearing props: each native import carries its own copy of the 1K wood maps.
- Performance (the PC is under concurrent load).
