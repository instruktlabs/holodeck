# Facility art v5

Saved 26 October 2026 local time. Three immutable child revisions are ready for integration review. This is a construction/detail pass on the current modules, not final hero-art approval. Nothing was published or applied to a world, native map or canonical game pin.

## Direction and references

`handoff/design/firearms-through-time/STYLE-GUIDE.md` v0.3 and `MOOD-BOARD.md` explicitly establish concept **04-shared-concourse-direction.png** as the preferred working direction. It was viewed directly. Its slim charcoal frames, restrained oak shelves, resolved lower exhibit cabinets and facing practice benches govern this pass. It is generated concept art, not factual firearm imagery or a dimensional blueprint. `01-museum-study-superseded.png` was excluded. Concept 02 is also superseded; 03 is only an earlier scale/material study.

The handoff manifest and current world were read. There is no separate facility reference manifest in the current handoff; the world's reference array currently contains only the cove-intention note. Exact local source hashes and source roles are recorded in [facility-v5-references.json](../evidence/facility-v5-references.json).

The [Action Target Defender stall](https://actiontarget.com/product/defender-stall/) supplies real construction context: distinct panel frames, a supported fixed worktop/apron and localized controls. Its manufacturer fixed-table image was downloaded for local reference and visually inspected. It remains outside the asset exports and has no redistribution clearance. The [fixed turning stand](https://actiontarget.com/product/fixed-turning-target-stand/) and [Triumph Pivotal Trainer](https://www.triumph-systems.com/products/pivotal-trainer) supply text references for a separate serviceable motor housing and replaceable target carrier. The authored target is an original fictional module, not a reconstruction or a claim of ballistic suitability. No manufacturer specifications or logos were copied into the assets.

## Delivered revisions

Use [facility-v5-pins.json](../authoring/facility-v5-pins.json). All three remain in the existing `project` collection and retain their asset IDs and exact named parents.

| Module | Child revision | Program | Parent revision |
|---|---|---|---|
| Collection bay | `r_c42f26530ab84bb8ba8366dd07f732f1` | `p_a8a9997a4a94` | `r_ea112dbac39645aca006ee570095fff1` |
| Booth console | `r_5ff8d00018224e7fa3ee926f0add1d6f` | `p_091f8b59b1db` | `r_d4556659887748e9ae05739b94d55255` |
| Turning target | `r_458c6011724a440d8db54686d99d02e5` | `p_960961a44e94` | `r_e73414bce8ac41528ee1c26a14205639` |

Exact sources are `authoring/facility-v5-{bay,console,target}-exact.kiln.js`; corresponding GLBs are `authoring/facility-v5-{bay,console,target}.glb`. Source and GLB hashes were independently checked against the saved manifests. Saved manifests declare `gpt-6-astra` / `Codex`; the delegated request was Astra/high, but reasoning effort is not a field independently recorded by Kiln.

The bay now has a recessed three-panel cabinet plinth, narrow finger pulls, shelf supports and an attached canopy with a cream diffuser. The original long cyan line is shortened to a small accent. The selection assembly, oak and empty historical-object mounting slot remain intact.

The booth has resolved partition edges, a bench apron and underside support, a small equipment mat, a ventilated service-frame border and a conduit attached to a counter leg. Its existing screen, controls and oak work surface remain exact. No UI text is baked into geometry.

The target has face-retaining clips, rear carrier rails and a motor service cover. Its thin target lines are now planar printed annuli rather than round tubes. The exact target pivot and replaceable cream face remain intact. It still represents the established simple turning-target module.

## Observed review and preservation

All three were reviewed in six-view GPU sheets and two additional perspective/detail views. Bay views cover its player-height face and mounts/canopy. Booth views cover the operator position and service vent/counter. Target views show the paper face and rear carrier. Saved preview manifests report **full-material, exactArtifact true**, using the RTX 3070 Dawn/D3D12 renderer on port 8010. Local detail renders report `IN_LOOP_BUILD_NOT_PERSISTED`; their input GLB hashes match the later saved artifacts.

![Collection bay](../evidence/facility-v5-bay-detail.png)

![Booth console](../evidence/facility-v5-console-detail.png)

![Turning target](../evidence/facility-v5-target-detail.png)

The first sheets exposed floating canopy fasteners and an unsupported conduit end. Exact anchored edits moved the fasteners into contact, attached the conduit along the leg and restored ventilation visibility. The final images were inspected after those corrections.

`kiln inspect compare` rebuilt both original and child under the requested `three` exporter. All overall min/max/size deltas are zero. No exported named nodes were added or removed. Material properties and material counts are unchanged. The bay's entire `Joint_Selection` subtree and oak, the booth's screen/teal controls/cream controls/oak, and the target's cream face/teal center/static teal indicator compare unchanged. The target pivot remains `[0,1.7,0]`, identity rotation, unit scale; its subtree bounds intentionally change with the new rear details. These receipts prove the named exported properties, not gameplay acceptance.

| Module | Measured X × Y × Z, m | Triangles before → after | Mesh draws | Distinct materials | GLB bytes |
|---|---|---:|---:|---:|---:|
| Bay | 0.525 × 2.440 × 2.500 | 1,640 → 2,752 | 8 | 6 | 3,870,580 |
| Booth | 1.450 × 2.220 × 1.860 | 2,840 → 4,564 | 7 | 7 | 3,988,512 |
| Target | 0.750 × 2.070 × 0.850 | 3,492 → 2,200 | 8 | 5 | 135,876 |
| Total | | 7,972 → 9,516 | 23 | Per asset above | 7,994,968 |

Per-parent/material batching keeps draw counts unchanged. Printed annuli remove 2,048 target triangles; added carrier/service details cost 756, for a net reduction of 1,292. Target vertices increase from 3,108 to 3,620 because the added hard-edge components need separate normals. The target GLB is also larger than its historical legacy-exported parent despite fewer triangles; this is not a file-size optimization claim. The bay and booth intentionally spend geometry on meaningful construction detail.

Bay and booth each retain three 2048 × 1024 wood images: albedo, normal and packed ORM. Kiln measures 25,165,824 decoded RGBA8 bytes and approximately 33,554,433 bytes with mips per asset. Exact image resources are shared, but destination GPU deduplication is unverified. The target embeds zero images. No new texture maps, transparency or LODs were introduced.

## Limits and next integration check

- **Timing/FPS data is DIRTY.** Both hub and PC are under concurrent load. This delivery makes no performance verdict; the figures above are structural costs.
- Kiln's neutral structural QA reports accepted with zero blockers/warnings and observation counts 7/7/4. This does not mean owner acceptance or final visual quality. Joined-detail overlaps remain observations.
- Parents were saved with the legacy exporter; the children use the requested `three` exporter. Current comparisons use `three` for both sides. Native import hierarchy/material binding must therefore be checked before adoption.
- Runtime target turning, reset, preserved selection/relay state, native overrides and collision are pending the parent's integration pass. No animation clip was authored merely to stand in for scene-owned joint behavior.
- Per-component contact distances are not numerically measured because the existing meshes batch components by material. Contact/support was visually reviewed, with limits above; this is not mechanical or collision certification.
- Thin printed rings need distant, grazing-angle and temporal review in the actual scene. No LOD was justified or tested, and no full mip/texture residency qualification is claimed.
- Blank labels, artwork and screen surfaces are intentional destination content slots. The current assets remain visibly simpler than the concept's final environment lighting and finish. This is a useful construction upgrade, not a claimed match to the concept's overall rendering quality.

The machine-readable [summary](../evidence/facility-v5-summary.json) contains exact asset/source hashes, comparison receipts, image fidelity, material pins, measured costs and limits. The parent integrator should stage these exact children, reimport once, exercise bay selection → console start/stop/reset, review both target orientations and retain the existing destination-owned UI/material overrides.
