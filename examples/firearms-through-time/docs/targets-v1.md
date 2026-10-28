# Targets v1: paper carrier and reactive plate rack

Recorded 26 October 2026 local. Two original fictional game assemblies are saved as editable immutable revisions in the workspace `project` collection. They are visual candidates for integration, not implemented activities or physical range designs. No gun/hand assets, canonical pins, gameplay, native maps or world files were changed.

Both follow the charcoal steel, warm off-white and restrained teal palette in the current style guide and inspected concept `04-shared-concourse-direction.png`. The paper assembly is suspended from a short docking rail, distinct from the existing floor turning target. The rack has five independently named plate pivots. Neither claims real-world structural, mechanical or ballistic safety properties.

## Exact delivery

Use [targets-v1-pins.json](../authoring/targets-v1-pins.json), not the collection's newest revision. Each entry includes saved source/GLB/preview paths, hashes, full anchor matrices, material and surface metadata, and saved-render fidelity. [The summary](../evidence/targets-v1-summary.json) records checks and limitations.

| Assembly | Asset / revision / program | Triangles | Estimated draws | Materials | GLB |
|---|---|---:|---:|---:|---:|
| Paper carrier and dock | `a_9cddb328290e4240b56374d95649e4ca` / `r_6bd698bfbc9540e4993d70544c89f6c7` / `p_fe87a8fe773b` | 2,164 | 9 | 6 | 72,408 B |
| Five plate rack | `a_ce363b39d8f144fd9893f445cc25731b` / `r_109f31045d71412fba9f6ca6f65852c3` / `p_01528070a92b` | 5,032 | 26 | 6 | 88,244 B |

There are no textures or texture allocations in either GLB. Prints are original thin geometry, not downloaded artwork. Editable source exports are [paper](../authoring/targets-v1-paper-qualified.kiln.js) and [rack](../authoring/targets-v1-rack-qualified.kiln.js). Unsuffixed sources and `targets-v1-build-sources.mjs` are draft history; the saved source and qualified exports are authoritative. Saved attribution is `gpt-6-astra` / `codex`; requested high reasoning is separate from the manifest's attribution evidence.

The measured paper envelope is approximately 0.900 × 1.427 × 0.680 m, spanning Y=0.983 to 2.410. Its origin is floor-referenced for placement, but it is intentionally suspended. The rack envelope is approximately 0.640 × 1.456 × 1.990 m with minimum Y=0. These are authored virtual dimensions and exported bounds, not physical construction specifications.

## Coordinate and surface contract

Units are metres. Root +X is the lane/travel direction, +Y is up, and +Z is target-right. Playable target fronts face **−X** toward the player. For every front scoring frame, right=`[0,0,1]`, up=`[0,1,0]`, normal=`[-1,0,0]`. The saved six-view sheets label the +X view “Front”; the playable target face therefore appears in their “Back” cell. The close-review cameras deliberately show the −X faces.

Do not use the incidental render UVs or a mesh-batch origin for scoring. The named surface anchor supplies the plane origin and basis. Transform a resolved world contact through its captured inverse surface transform, then derive `u=localZ/width+0.5`, `v=localY/height+0.5`; a plate uses diameter for width/height and rejects outside its disc. Never clamp an outside point into a score. These IDs and bounds describe candidate surface regions; scoring zones, boundary rules and mesh-edge tolerances still require versioned game definitions.

| Surface ID | Exact frame | Authored region | Material category |
|---|---|---|---|
| `paper.sheet.front` | `anchor_sheet_front`, under `pivot_replaceable_sheet` | Rectangle, 0.56 × 0.74 m; front only. Root-space center `[-0.016,1.425,0]`. | `paper` |
| `plate.01.front` … `plate.05.front` | `anchor_plate_01_face` … `anchor_plate_05_face`, each under its plate pivot | Disc radius 0.136 m; front only. Rest centers `[0.083,1.313,z]`, where z is −0.72, −0.36, 0, 0.36, 0.72. | `painted-metal` |

The paper face is a thin beveled sheet and the plates are tessellated discs. The adapter must reconcile the authored scoring mask with the actual nearest scene contact and intentional edge tolerance. Printed rings and numbers are visual identifiers; they contain no score values. The front paper anchor was corrected by +0.0001 m along X to coincide with the sheet's front plane; print geometry sits slightly in front to avoid z-fighting.

Material names are stable: `targets_v1_charcoal_steel`, `targets_v1_edge_alloy`, `targets_v1_warm_face`, `targets_v1_print`, `targets_v1_teal`, `targets_v1_soft_contact`. The warm-face material is shared by paper and plate paint. Select impact behavior from the surface metadata, never from shared color/material alone. Frame, backing, rollers and fasteners are non-scoring unless a future ruleset explicitly says otherwise.

## Paper ownership and integration

`pivot_carrier` is at `[0,2.25,0]` in root space and owns the carriage, hangers, frame, clips and replaceable sheet. `pivot_replaceable_sheet` is at `[-0.015,-0.825,0]` relative to the carrier. Replacing a sheet replaces its surface-instance identity; preserve the old string's history first.

| Named interface | Purpose |
|---|---|
| `anchor_dock_pose` | Rest carrier pose, matching the carrier pivot; not proof that a return command exists. |
| `anchor_travel_origin` | Root-space `[0,2.25,0]`, direction +X. The scene supplies the deploy endpoint and route extent. |
| `anchor_rail_join_start`, `anchor_rail_join_end` | Short rail interface endpoints; the delivered module is not a complete lane track. |
| `anchor_mount_A`, `anchor_mount_B` | Suspension placement sockets. Destination mounting geometry must be authored and checked. |
| `anchor_clip_contact_L`, `anchor_clip_contact_R` | Sheet/clip visual contacts; not a removal mechanism or clearance certificate. |
| `anchor_sheet_front`, `anchor_sheet_review` | Surface frame and review interest point that follow the sheet. The adapter chooses an unobstructed review camera. |
| `anchor_interaction_replace`, `anchor_interaction_return` | Interaction hints; no commands or state machine included. |

Move the carrier subtree, not the whole assembly, during future travel. Extend or substitute the short rail through a qualified scene assembly. Route, swept clearance, deployment, end-string interlock, return, dock detection, mark persistence and sheet replacement are still implementation work under [the target/shot review plan](range-targets-and-shot-review.md). Do not claim functional retrieval from the anchors.

## Plate ownership and integration

`pivot_plate_01` … `pivot_plate_05` have distinct rest transforms at `[0.1,0.976,z]`. Each owns its stem, backing, face and print. Their declared presentation axis is −Z, allowing an adapter-authored rearward swing into +X. This is an animation hint, not a tested physical hinge or a qualified motion range. No animation clips are included.

Each plate has a moving `anchor_plate_NN_face` and `anchor_plate_NN_reset`, plus a root-owned `anchor_plate_NN_rest` that records its rest pose. `pivot_reset_bar`, `anchor_reset_driver` and `anchor_interaction_reset` identify a separate reset-presentation element. The rear housing/bar are intentionally intersecting visual shells, not a mechanical reset design. The adapter owns activation IDs, reactions, timing, restoration and exactly-once score effects. Never rotate the entire rack when one plate is hit.

`anchor_ground_L/R` describe the supporting feet and `anchor_review_focus` provides a rack-level interest point. Render meshes carry no authored collision system. Add appropriate scene queries/selection proxies in the adapter, preserve per-plate surface identities and verify transformed contact normals. Follow [shot feedback fidelity](shot-feedback-fidelity.md) for accepted/resolved events; visual reactions cannot independently decide hits or scores.

## Review and optimization evidence

Actual draft six-side GPU sheets, final close views and both exact saved previews were opened and inspected. Close views show the paper clips and suspension and the rack's independent mounts, feet and face edge layers. Saved manifests report `materialFaithful: true`, `exactArtifact: true` on the D3D12 RTX 3070 route. In-loop close views report material fidelity but `exactArtifact: false / IN_LOOP_BUILD_NOT_PERSISTED`; their GLB hashes match the saved revisions. Source, GLB and preview hashes were checked against each saved manifest.

Thirty-one selected rest-pose surface-pair checks completed: paper frame/hangers/mounts, both clips, carriage rollers and rack support/mount/face interfaces. The initially detected roller/rail and fascia/backing gaps were corrected. The final selected intended joins return zero unsigned surface distance; the paper-to-backing gap is intentionally 0.022 m and adjacent plate backings are separated by 0.074 m. Zero means touching or intersecting, not strong attachment or valid motion. The representative first-plate checks do not qualify every moving pose or the full reset mechanism.

Static siblings were batched by material **within** their rigid owners, preserving separate scoring-face meshes, 14 paper anchors/pivots and 27 rack anchors/pivots. Draw estimates fell from 28 to 9 and 44 to 26; triangle counts stayed unchanged. [The verifier](../evidence/targets-v1-verify.mjs) independently compares transformed triangles, normals and material names at 1e-5 precision and checks the declared anchor correction. [Its receipt](../evidence/targets-v1-optimization-proof.json) passes for both assets. Batching removes the individual source support mesh names; `mergedPartNames` preserves their provenance. Contact receipts refer to the pre-batched geometry, whose world geometry matches the final version.

This batch contains one low-triangle tier per assembly, not automatic LOD chains. Structural QA reports export integrity passes; visual quality and prompt alignment are not independently certified by those checks. Destination imports, motion/clearance review, material parity, complete return/reset loops, hit placement and owner acceptance remain pending. The rigs are ready for adapter work, not a claim that those loops already function.

Both PC and hub are under load. Performance is **DIRTY**. The triangle/draw/material/file counts are structural evidence, not FPS or GPU-timing qualification.

Review: [paper close views](../evidence/targets-v1-paper-close.png), [rack close views](../evidence/targets-v1-rack-close.png). Exact saved preview links are in the pins.
