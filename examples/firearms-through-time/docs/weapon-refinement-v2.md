# Weapon presentation refinement, 2026-10-26

This pass improves the existing playable fixture. It is still prototype art, not
AAA acceptance or a dimensionally accurate firearm model. The reference space,
range interactions, attachment compatibility and ammunition rules are retained.

## Delivered changes

The hands now use different left/right grip shapes, tapered fingers, knuckle
forms, dorsal cloth panels, leather palms, cuffs and stitches. One 1K atlas feeds
albedo, tangent normal and packed metallic/roughness maps. The skin still uses
one mesh and the same 33 named bones; it now has 25,568 triangles. Sleeve weights
blend from the common root to the wrist. The first version rigidly weighted the
whole forearm to the wrist and exposed the cut end during reload; the final
weighting keeps that end below the view while the wrist moves.

The 4,080-triangle pistol retains its geometry, 72 meshes, moving-part hierarchy
and attachment anchors. Physical-scale projected UVs carry original procedural
steel and walnut maps at 512px. Fine brushing and roughness variation separate
steel from polished edges; walnut has grain and a checkered normal response.
Thirty checkering pieces now share the wood material with the two grip panels,
so both runtimes update 32 material bindings when changing grip appearance.
The charcoal option is a stained/tinted appearance of the same textured grip,
not a claim of a separate polymer asset.

Reload takes 2.6 seconds with distinct reach, grasp, withdrawal, exchange,
insertion, seat and regrip stages. Quintic interpolation eases each transition.
`game/reload-v2.json` is the shared source; the browser samples it directly and
`pipeline/generate-presentation-header.mjs` emits the native C++ pose table and
source hash. Aim transitions also ease instead of snapping. Ammunition commits
once when the gameplay timer completes, independently of render events.

The exchange is staged below the view. There is no separately simulated dropped
magazine, spare magazine inventory, mocap, baked clip or hand IK in this pass.
The animator still needs to refine finger contact, thumb position, elbow arcs,
seating emphasis and full-body connection. These are not solved by more texels.

## Exact current sources

| Asset | Program | Saved revision | GLB SHA-256 |
|---|---|---|---|
| Hands | `p_a6a2daa71847` | `r_12a60773ae9345229bc0ac89a1f450bb` | `9593216d12ff390e9e0b12af11b63c01328d926b74f85af37cb1391a51ac4ee6` |
| Pistol | `p_bdbee4d83453` | `r_0e602cd8bcb649329b7aca7e65d848bd` | `44fc6cf4025e08a7c5cb88dd85f84b7c109eff3c12abd871d07fa1aadd5e0046` |

`game/asset-pins.json` is the consumer manifest. Canonical sources and GLBs are
`authoring/first-hands.*` and `authoring/first-pistol.*`; the qualified v2 source
copies have the same content. Earlier immutable parents remain in Kiln, and
`evidence/weapon-refinement-baseline` retains the prior delivery/runtime files.
The hand refinement has an intermediate saved revision before the sleeve fix.
`pipeline/refine-weapon-assets.mjs` and `hands-v2-template.js.txt` are historical
initial-pass inputs, not the final source. Start further edits from the current
program refs and exact material pins rather than rerunning those drafts.

All nine texture images are embedded in the delivered GLBs. The three material
records and full editable resources are in `materials/weapon-v2`; the deterministic
recipe is `pipeline/bake-weapon-materials.mjs`. They are original procedural
materials, not redistributed Megascans maps. This private study has not changed
their publication/license status. The file called ORM uses G for roughness and B
for metalness; its R channel is neutral and no occlusion texture is bound.

## Obstacles and tested adapter behavior

1. Custom tube triangles initially faced inward. GPU side views caught it; the
   winding was corrected before delivery. Texture atlas V coordinates were also
   reversed relative to the authored regions, making leather use the stitch
   color. Region offsets were corrected. Do not certify topology from a front
   thumbnail alone.
2. Small stitch spheres initially cost too much geometry. Reducing only their
   tessellation brought the glove from 74,208 triangles to 25,568 without removing
   its recognizable features. This is an asset budget improvement, not a measured
   frame-rate claim.
3. Some rounded pistol pieces lacked UV attributes. The projector now creates
   them before writing UVs. Source geometry and anchors stayed identical; UVs and
   material assignments deliberately changed.
4. Unreal Interchange created all textures but retained old material settings
   on reimport. Even explicit material reimports did not make this fixture's
   new texture bindings effective. `bind_weapon_materials.py` reconciles only
   generated instances with the pinned GLB: factors, texture references and the
   three `bHas*Texture` static switches. It leaves destination-owned overlays
   outside that namespace. This adapter currently rejects transformed UVs and
   nonzero texture coordinate sets rather than guessing.
5. In installed UE 5.8.4, MaterialEditingLibrary setters initialize `bResult` to
   false and never set it true, even after applying the value. The static-switch
   setter at `MaterialEditingLibrary.cpp:1596` demonstrates this. Call the setter,
   then verify effective readback, save and reload; do not assert on that boolean.
   Initial white/gray engine captures record the failed configuration. They are
   not the final textured result.
6. Native albedo is sRGB; normal and packed data maps are linear. Normal uses
   normal-map compression, ORM uses masks, and textures use trilinear filtering.
   Green flipping is disabled under this project's previously tested GLTF normal
   profile. This is a scoped importer profile, not a universal Unreal rule.
7. The browser disposes shared geometry, skeletons, materials and textures on
   unload; completed loads after cancellation are disposed too. Full lifecycle
   fault injection and memory profiling remain extension-release work.

## Verification and visual limits

Ten Node tests cover rules, staged timing, dense finite pose samples, exact GLB
hashes, embedded texture delivery, stable bone names and the gun hierarchy.
Native runs use the real controller and renderer with 22 assertions, including
grasp before withdrawal, no early ammunition commit, insertion and regrip,
compatible/incompatible attachments and preserved grip selection.

The final run receipts and screenshots are linked by
`evidence/weapon-refinement-v2-summary.json`. Read that file for completed build
and browser qualification rather than treating this description as a passed gate.
Intermediate editor runs passed behavior before material switches were corrected;
their white/gray pictures are intentionally retained as failure evidence.
The browser fallback query is `?backend=webgl`, not `webgl2`. Early files named
`weapon-v2-webgl2-*` used the ignored query and are not fallback proof. The final
`weapon-v2-final-webgl2-*` receipts explicitly read **WebGL2** in Observe before
running the actions. A requested backend is not evidence of the active renderer.

Observed materials now show cloth weave, leather response, grain/checkering and
brushed steel. Dark metallic faces remain sensitive to environment lighting.
The two environments, cameras and antialiasing are not identical; no pixel-level
lighting parity or colorimetric claim is made. Browser mouse lock is unavailable
in this embedded preview, so buttons and keyboard/arrows are the tested input
path. No GPU timing or production LOD/streaming qualification was performed.

## Candidates for the optional Kiln extension

Keep these capabilities opt-in and scoped to an engine workspace:

- A portable material recipe/atlas baker with explicit color/data semantics,
  immutable material pins and an importer reconciliation report.
- A semantic rig/anchor contract validator that checks names, skin weights,
  moving groups and consumer support before importing.
- A renderer-independent pose timeline plus generated destination adapters,
  separate from game rules and ammunition state.
- A staged animation capture runner and saved-source comparison, including
  override survival and the difference between functional and visual acceptance.
- A native material verifier that checks inherited effective values, switches
  and fresh-process rendering, not just texture-file existence.

Do not put firearm gameplay policy into Kiln core or assume a skinned delivery
belongs in Holodeck's static-rigid asset store. This fixture still uses a local
project extension and a hash-checked GLTF loader for first-person animation.
The generic Holodeck default remains a no-op extension. Nothing was published.

The next art step is a deliberate hero-asset pass: sculpted/retopologized hand
anatomy, convincing overlapping grip contacts, refined pistol silhouette and
bevels, authored reload/inspect clips with IK, then sound/VFX and multi-light
review. Preserve this small end-to-end fixture as the regression test while
raising visual quality.
The 72 editable pistol parts also need a measured delivery-batching experiment:
merge within shared moving-group/material boundaries while retaining semantic
anchors. Do not merge across the slide or magazine just to reduce draw counts.
