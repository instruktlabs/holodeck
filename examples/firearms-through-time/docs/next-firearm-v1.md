# Next firearm v1: Model 1866 sporting exterior

Recorded 2026-10-26 (local). Local authoring candidate, saved and visually reviewed. No runtime import, catalog activation, owner acceptance or publication occurred.

The supplied PC handoff refers to a 60-entry source catalog but omits the named catalog and original source pack. Bounded searches of the supplied design, game and documentation files did not recover it. This pass therefore establishes `winchester-1866-sporting-authored-01` as a new authoring selection, following the coordinating agent's explicit direction. It is not represented as an existing approved collection entry.

The current style authority is `handoff/design/firearms-through-time/STYLE-GUIDE.md` and concept `04-shared-concourse-direction.png`, which was inspected. `01-museum-study-superseded.png` is superseded. Generated guns in the concept were not used as historical identity evidence.

## Reference facts and interpretation

| Primary reference | Verified use | Boundary |
|---|---|---|
| [National Cowboy & Western Heritage Museum, object 2001.35](https://nationalcowboymuseum.org/collections/objects/winchester-model-1866-sporting-rifle-winchester-repeating-arms-company-new-haven-connecticut-caliber-44-henry-flat-rimfire/) | Catalog identifies a Winchester Model 1866 Sporting rifle, with a displayed date range of 1866–1898. Its image was inspected for the dropped comb, slim wrist, crescent buttplate, shaped receiver, octagonal upper exterior, lower tube, wood foreend, cap, handed gate and lever outline. | The photographed specimen is engraved; those decorations and its sling fittings are omitted. The image crops the muzzle. The displayed range is not an exact date assigned to this game asset. |
| [Metropolitan Museum of Art, object L.2023.33.1a, b](https://www.metmuseum.org/art/collection/search/904559) | Identifies a Model 1866 rifle dated 1870; its catalog lists an overall length of 110.8 cm and walnut, steel and brass among the materials. Overall scale sanity check. | Different decorated presentation specimen. No engraving, serial number or identity copied. Its image download is restricted; no Met image was downloaded. |
| [Royal Armouries, XII.1492](https://royalarmouries.org/objects-and-stories/stories/gendering-the-armouries) | Identifies Model 1866, 1870. Inspected opposite-side receiver, curved hammer and lever image to cross-check those exterior cues. | Its full-stock configuration differs from the selected sporting form. Foreend, bands and inscriptions were not copied. |

This asset is original plain sporting-form game art, not a reconstruction of one museum specimen. Geometry cross-sections, finish, directional walnut grain, bevels, small sights and anchor coordinates are authored approximations. The age treatment is an appearance option, not a separate historical factory configuration. The historical model year is 1866; exact specimen year is unspecified.

The two downloaded museum photographs are explicitly named `next-firearm-v1-reference-*-private-study.jpg` in evidence. Their redistribution rights have not been verified. They are not embedded in the GLBs, textures, source or saved asset collection. All delivered texture pixels are deterministic original procedural artwork. Full URLs, roles and limits are retained in [the summary](../evidence/next-firearm-v1-summary.json).

## Saved delivery

Use [the exact pins](../authoring/next-firearm-v1-pins.json), never the collection's newest revision. All three variants share asset `a_a8c8a92ae979442dbcf5836c8e72ee2e` in the isolated `assets/next-firearm-v1` collection. Aged and display LOD1 are immutable children of satin.

| Variant | Saved revision | Triangles | Estimated draws | Materials | GLB bytes | Texture memory with mipmaps |
|---|---|---:|---:|---:|---:|---:|
| Satin brass, walnut, LOD0 | `r_cbbfbbc333fe461e939e10361c3453f6` | 9,776 | 14 | 5 | 549,880 | 1,485,484 B |
| Aged brass, darker walnut, LOD0 | `r_9e0d738172e64ea7ae6eb43a34384117` | 9,776 | 14 | 5 | 543,920 | 1,485,484 B |
| Satin display LOD1 | `r_fcb53858660245c093ca1a9939fe2865` | 3,024 | 5 | 5 | 170,204 | 371,372 B |

LOD0 uses a 512² walnut albedo and 128² packed brass micro-roughness texture. LOD1 uses 256² and 64². Estimates assume decoded RGBA8 plus mipmaps, not compressed resident GPU allocations. The GLB triangle and primitive counts were independently recomputed from the saved files. Source, GLB and preview SHA-256 checks passed; [finalizer](../evidence/next-firearm-v1-finalize.mjs) reproduces these checks.

The display version removes fine slots and seam detail, reduces curve and circular tessellation, and batches static pieces into five material meshes. Its broad silhouette and all eleven anchors are retained. It reduces triangle count by 69.1%, estimated draws by 64.3%, and estimated texture memory by 75.0%. It is a separate static artifact for an adapter to select; no automatic LOD chain or switch distance is claimed. Preserve LOD0 for close inspection and future lever/hammer presentation because the LOD1 batches remove those separate mesh identities.

Exact editable source exports are `authoring/next-firearm-v1-satin-qualified.kiln.js`, `next-firearm-v1-aged-qualified.kiln.js`, and `next-firearm-v1-lod1-qualified.kiln.js`. The unsuffixed source and `draft`/`refined` files are development history. Saved collection files are delivery authority. No external material resource pins are required: these textures are source-generated and embedded. Saved manifests record model `gpt-6-astra`, harness `codex`; high reasoning was requested for this lane, while saved attribution does not itself prove reasoning effort.

## Asset contract

Metres, +X toward the muzzle, +Y up, +Z right. Origin is an authored receiver reference frame, not ground contact. The full-detail measured envelope is approximately 1.11390 × 0.28145 × 0.04877 m. That is roughly 0.5% longer than the Met specimen's catalog overall length; it is deliberately reported as an authored envelope rather than an exact museum reconstruction. Placement should use the bounds and mounting anchors, not force minimum Y to zero.

Named visual anchors are exported as empty nodes with identity quaternion. All use the same asset frame. These coordinates are game-art interaction targets and contain no real-world operating or manufacturing contract.

| Node | Position (m) | Purpose |
|---|---|---|
| `anchor_hand_right` | [-0.147, 0.089, 0.019] | Right-hand presentation target |
| `anchor_hand_left` | [0.215, 0.106, -0.020] | Support-hand presentation target |
| `anchor_grip_primary` | [-0.147, 0.084, 0] | Primary grip reference |
| `anchor_grip_support` | [0.215, 0.115, 0] | Foreend grip reference |
| `anchor_sight_rear` | [0.110, 0.200, 0] | Visual sight alignment |
| `anchor_sight_front` | [0.568, 0.200, 0] | Visual sight alignment |
| `anchor_vfx_muzzle` | [0.601, 0.173, 0] | Presentation-only VFX origin |
| `anchor_interaction_select` | [-0.005, 0.140, 0.030] | Selection affordance target |
| `anchor_interaction_loading_gate` | [0.024, 0.130, 0.024] | Visual interaction target |
| `anchor_interaction_lever` | [-0.142, 0.026, 0] | Visual interaction target |
| `anchor_support_butt` | [-0.503, 0.005, 0] | Display/shoulder reference |

All exported names and transforms match exactly across the three variants. No skin, animation clip, gameplay state, ammunition behavior or ballistic data is included. The barrel and receiver are sealed nonfunctional exterior forms. **The current muzzle is not hollow or geometrically recessed.** Reinspection of lines 69–76 in all three exact saved `source.kiln.js` files found an octagonal cylinder with two short black cylinders placed at and forward of its end face. There is no cut opening or interior side wall. `Muzzle_Recess` and the source comment describe the intended appearance, not the actual geometry: this is a stepped dark-cylinder placeholder. The earlier description as a “shallow blind visual recess” overstated the implementation and is corrected here.

The user's close-up realism requirement now explicitly calls for an open visible mouth, a shaped rim and actual interior setback with readable depth. All three v1 revisions remain pending against that requirement; their saved previews and structural checks did not qualify muzzle depth. The next art pass must follow [hero-firearm geometry requirements](hero-firearm-geometry-requirements.md), save a new immutable revision and review oblique and side-lit views. This documentation correction changes no source, GLB, anchor, pin or engine code.

Collision intent is separate from rendering: adapters should supply simple selection hulls using body and long upper-form bounds. Render mesh collision is not requested. Hands, contact offsets, active-item collision and animations require destination review. Do not infer real hand fit from anchor existence.

## Compatibility and integration boundary

`catalogId = winchester-1866-sporting-authored-01`; `family = winchester-model-1866`; `configuration = sporting-exterior-interpretation-v1`; `anchorContract = next-firearm-v1`.

Allowed cosmetic IDs are exactly `satin-brass` and `aged-brass`. No accessory mounting interface is exposed. Explicit rejected IDs include `picatinny-optic`, `suppressor`, `laser`, `modern-foregrip`, `detachable-magazine` and `1911-grip`. The metadata uses an empty attachment allowlist; a future adapter must reject every attachment ID unless a separate reference-qualified configuration is introduced. Era alone is not compatibility. This is a declared asset contract, not a runtime rejection test.

Save/load should store catalog/configuration/cosmetic IDs, not mesh paths. The adapter owns configuration validation, animation and game state. Existing first-pistol and hands assets, runtime code, native maps, world files and canonical pins were not changed by this lane.

## Review and limits

Actual GPU images were read for the first draft, the sculpted-furniture refinement, satin close-ups, aged six-side views, final LOD1 six-side views, and every exact saved preview. Saved manifests report `materialFaithful: true`, `exactArtifact: true`, with the exact saved GLB hashes on the D3D12 RTX 3070 route. In-loop views were material faithful but reported `exactArtifact: false / IN_LOOP_BUILD_NOT_PERSISTED`; the saved previews supply the artifact-level evidence.

The first pass's flat stock was replaced with rounded longitudinal sections. The close-up pass reduced overly regular grain striping, rounded the hammer silhouette and added modest material roughness variation. Four intended interfaces were numerically checked: stock/receiver, foreend/receiver, upper body/receiver and butt trim/stock. All completed with zero unsigned surface distance on the geometry revision preceding the final material/hammer change. Zero can mean touching or intersecting; it does not prove a tight manufactured fit. Structural QA overlap observations include intentional embedded surface details and joining shells. They are not a motion-clearance certificate.

This is a more developed reference-informed game asset candidate, not AAA acceptance. Surface detail remains simple; it lacks a unique normal bake, sculpted wear, historic markings and exact hidden-side reference reconstruction. Sights are visual approximations. Hand fit, lever travel, load animation, native material mapping, loaded-scene appearance and runtime LOD choice remain integration work.

Performance status is **DIRTY**: both PC and hub were under load, as reported by the user. Only structural counts and file/texture costs are qualified. No clean FPS, timing, large-catalog residency or destination performance claim is made.

Review images: [satin close-up](../evidence/next-firearm-v1-satin-close.png), [aged views](../evidence/next-firearm-v1-aged.png), [display LOD1 views](../evidence/next-firearm-v1-lod1-final.png). Each exact saved preview is linked in the pins file.
