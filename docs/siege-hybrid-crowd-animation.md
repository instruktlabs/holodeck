# Siege hybrid crowd animation contract

## Gameplay blueprint extension

The [hybrid-defense-v1 design package](../../castle-design/blueprints/hybrid-defense-v1/gameplay-design.md)
maps tactical control, first/third-person inhabitation and station operation onto
the same actor and resource simulation. It retains the GPU-bone-first proposal
below, with VAT optional for appropriate distant effects. Possession, melee,
runtime IK and GPU crowds remain implementation gaps. Its spatial overlays use
the staged measured reconstruction and label new routes/camera budgets as design
hypotheses. The version table below records the earlier research environment;
the example README now records the resolved Unity 6000.7.0b6 beta environment.

Research checked 2026-10-26. **Design proposal, not an implemented crowd renderer or combat system.** No packages were installed for this research. The latest owner direction is to inhabit a soldier and fight at close range while a larger siege continues around them.

## Recommendation for this asset

Keep a complete Unity skeleton, Animator and high-detail mesh for the possessed soldier and nearby combatants. Prototype **instanced GPU bone-animation playback** for distant soldiers before investing in per-vertex VAT. Retain vertex VAT as an optional distant-effect path for deformation that cannot be represented economically by this skeleton, such as a baked collapsing prop or cloth effect.

The current audited soldier is **22 bones, 10,086 exported vertices and 15,978 triangles**, not 15,000 vertices. These counts come from `castle-evidence/production-rig/pass07-underarm/final/rig-audit.json`; subsequent LOD/palette derivatives must report their own counts. Idle, Walk and LookAround exist. Weapon attacks, blocks, hit reactions, locomotion transitions and runtime IK are not already supplied by those clips.

The small skeleton makes shared bone clips inexpensive compared with storing every vertex every frame. Bone playback also preserves useful attachment transforms for interchangeable helmets, beards and weapons. It does not automatically make combat, collision, IK or animation blending free. NVIDIA's original skinned-instancing description establishes the bone-palette technique; its historical performance figures are **not** predictions for this Unity project. [NVIDIA: Animated Crowd Rendering](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-2-animated-crowd-rendering)

## Installed version and support boundary

| Component | Verified local version | What this plan assumes |
| --- | --- | --- |
| Unity Editor | 6000.2.3f1 | Existing qualified PC project; no upgrade folded into this prototype |
| URP | 17.2.0 | Custom instanced shader must implement every required rendering pass |
| glTFast | 6.20.0 | Existing import path remains the source of meshes, weights and clips |
| Animation Rigging | 1.4.1 | Available for a separately qualified near-character IK layer |
| AI Navigation | 2.0.16 | Installed capability, not evidence of functioning crowd navigation |
| Input System | 1.20.1 | Available for possession controls, not an implemented combat controller |
| Custom GPU animation / VAT | Not implemented or installed | New prototype code and evidence required |

These are installed-version facts, not a claim that 6000.2.3f1 is the latest or currently maintained Unity release. Research uses the versioned Unity 6.2 API/manual rather than treating later-version capabilities as available here.

**Do not assume GPU Resident Drawer batches the existing SkinnedMeshRenderers.** The 6.2 URP documentation requires Mesh Renderer components and Forward+, among other requirements. Merely enabling GRD does not supply this custom animation path. [Unity 6.2 GRD requirements](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/gpu-resident-drawer.html)

Use `Graphics.RenderMeshInstanced` for an initial small correctness fixture if useful, then `Graphics.RenderMeshIndirect` for explicit per-instance animation buffers and culling. The latter requires compute-capable platforms, uses `GraphicsBuffer.IndirectDrawIndexedArgs`, and treats submitted world bounds as a group; it does not automatically provide per-soldier visibility decisions. Qualify Windows D3D12 and the hub's Vulkan separately. [Unity 6.2 indirect API](https://docs.unity3d.com/6000.2/Documentation/ScriptReference/Graphics.RenderMeshIndirect.html)

The direct instancing API has data-dependent batch limits, at most 1,023 and ordinarily 511 when both transform matrices are supplied. Arbitrary extra struct fields are not automatically an animation-data binding scheme: explicitly bind/index a graphics buffer. Neither API replaces a skeletal animation implementation. [Unity 6.2 instanced API](https://docs.unity3d.com/6000.2/Documentation/ScriptReference/Graphics.RenderMeshInstanced.html)

## Concrete storage comparison

Illustrative **one two-second clip sampled at 30 Hz = 60 samples**, excluding duplicated endpoint, padding, alignment, mesh storage, mipmaps and metadata. These are calculated formats, not measured runtime allocations or the duration of every existing clip.

| Shared clip representation | Formula | Size per example clip |
| --- | --- | ---: |
| Bone matrices, 3x4 FP16 | 22 bones × 60 samples × 24 bytes | 30.94 KiB |
| Bone matrices, 3x4 FP32 | 22 × 60 × 48 bytes | 61.88 KiB |
| Vertex VAT, position RGBA16F + normal RGBA16F | 10,086 vertices × 60 × 16 bytes | 9.23 MiB |
| Same VAT without separate normal texture | 10,086 × 60 × 8 bytes | 4.62 MiB, with a different normal encoding/quality contract |

The explicit two-texture VAT layout is about **306 times** the FP16 bone-matrix clip size here. Ten such clips are roughly 92.34 MiB versus 0.302 MiB. Clips are shared across instances; do not multiply that static atlas cost by 500 soldiers. Each instance still needs transform, clip/phase/blend and previous-frame state. A hypothetical 128-byte record is 62.5 KiB for 500 units, before buffers, culling, attachments and double buffering. Validate FP16 precision against the FP32 reference before choosing it.

Bone animation costs weighted skinning and pose sampling per visible vertex/pass. VAT trades that arithmetic for substantial texture fetches and bandwidth. Neither removes triangles, shadow passes or overdraw. Bone clips can be reused across mesh LODs sharing the skeleton; VAT normally needs a compatible bake for each changed vertex topology/order. Matrix interpolation is an approximation: test joint volume and foot paths. A later local-TRS pose interpolation stage can improve fidelity but adds implementation cost.

VAT remains useful for complex non-skeletal baked deformation. SideFX documents both its low CPU-animation cost and limits around texture memory, animated collision and interactive control. No Houdini dependency is needed to test a simple Blender/Python VAT export, and no claim is made that a current SideFX Unity shader is already compatible with this installed URP. [SideFX VAT 3.0](https://www.sidefx.com/docs/houdini/nodes/out/labs--vertex_animation_textures-3.0.html)

## Representation contract

| Tier | Animation/rendering | Gameplay policy |
| --- | --- | --- |
| Possessed and immediate combat | Full skeleton, LOD0, Animator/Playable graph, eligible IK and attachments | Always promoted regardless of distance; precise action timing and collision |
| Nearby actors | Full skeleton with qualified mesh LOD; bounded count | Promote before entering weapon/contact range, being inspected or targeted for possession |
| Distant active crowd | Shared GPU bone clips, per-instance phase/blend, LOD1/2 | Persistent authoritative entity; coarse simulation schedule independent of render tier |
| Very distant spectacle | GPU bones by default; VAT only if measured better for the particular effect | No visual texture interpreted as a hitbox or combat authority |

Start with distance plus screen size and interaction priority, not distance alone. Proposed first thresholds are promotion inside 12 m, demotion beyond 16 m with a 0.5 s hold, and a 0.15 s visual blend. These are tuning hypotheses. Possession, melee targets and active ragdolls override the budget. If too many actors require promotion, reduce distant visual work first; never silently downgrade the possessed character's hit detection.

One entity record owns stable ID, world transform, velocity, health, team, target, equipment IDs, action ID, action start tick, phase and event cursor. Rendering consumes it. Navigation, collision, combat outcome and replication do not read GPU animation pixels. Distant simulation may run at a lower scheduled frequency, but action decisions remain explicit and deterministic enough for the chosen game model. The earlier render-plus-Animator benchmark does not measure these systems.

## Bake and handoff contract

1. Freeze source GLB hash, skeleton hierarchy/bind matrices, axes (+X forward, +Y up, +Z anatomical right), unit scale, material/LOD hashes and clip metadata. Validate every mesh's bone remap. Keep approved LOD0 face and appearance unchanged.
2. Bake sampled root-relative bone transforms with explicit sample rate, duration, loop endpoint policy and bounds. Store the root-motion track separately. Exactly one movement authority consumes it; do not apply root movement in both the shader and the character controller.
3. Record bind-correct skin matrices for deformation and skeleton-space transforms for weapon sockets. A skin matrix already includes inverse bind; it cannot directly be used as a world socket transform. Preserve both contracts or reconstruct sockets correctly.
4. GPU records carry current/previous world transform, clip A/B, normalized times, blend weight, equipment variant, LOD and stable ID. Sample between adjacent frames; wrap looping clips without sampling an unrelated atlas row. Prototype two-clip blending only, with recorded error limits.
5. On promotion, obtain a pooled skeleton, set transform and exact action/phase/blend, evaluate its pose before display, attach the selected equipment, then enable IK gradually. Transfer the event cursor so a strike or footstep is not triggered twice. Preserve health, target and input ownership.
6. On demotion, snapshot the same semantic action/phase rather than restarting an Idle loop. Defer during a nonrepresentable layered action, active ragdoll or urgent interaction. Cross-fade appearance without duplicate shadow casters; maintain previous-frame history or deliberately reset it for one frame to prevent velocity streaks.

GPU-to-CPU pose readback is not part of normal promotion. The CPU already owns clip time/state and can evaluate those same clips. Do not stall possession waiting for a GPU readback. Transition acceptance must include no double actor, no teleport, no lost equipment and no duplicate damage event.

## Close fighting and equipment

Possession first needs movement, camera framing and collision. A later bounded combat slice should add one weapon, one attack, one block and one reaction, with clearly authored hit windows; it is not included in this rendering prototype. The current baked LookAround clip does not demonstrate aiming, weapon handling or fighting.

Use full skeleton bone attachments for the near weapon and shield. Add grip alignment, shoulder clearance and optional two-bone hand/foot IK only on that tier; define reach limits and a non-IK fallback. The installed constraint supports a root/mid/tip chain with target and optional hint, but installation alone does not establish a working foot-placement system. [Animation Rigging 1.4.1 Two Bone IK](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/constraints/TwoBoneIKConstraint.html)

Distant equipment should be separately instanced and driven by the sampled socket transform, or deliberately merged into an equipment-specific LOD if the draw-cost tradeoff wins. Do not bake every beard/helmet/weapon combination into a separate full-body VAT unless its memory and authoring multiplication is justified. Hit colliders remain CPU/gameplay objects; far visual attachment accuracy is not evidence of accurate melee collision.

## Shader, shadows and LOD requirements

The custom GPU skinning function must be shared by forward lighting, shadow caster, depth and depth-normal passes. Preserve palette COLOR_0, texture UVs, roughness/metallic response and per-instance identity. Animate bounds conservatively for all clips; batch into spatial cells so one huge group is not always visible. Shadow culling must include off-camera casters that affect visible receivers.

Keep the newly qualified **four cascades, 50 m distance, 2048 main shadow atlas** policy in both baseline and candidate tests. Its close mantle contact shadow is materially better than the earlier coarse projection; fine aliasing remains. Do not claim a faster crowd by silently removing shadows or making their range 5 m. Record actual cascade splits and transitions in the eventual gameplay camera review.

Motion vectors require previous animation phase/blend and previous object transform, not just the current skinned position. Unity explicitly requires custom motion-vector passes to match vertex deformation; a static fallback does not qualify custom bone/VAT motion. If unavailable in milestone one, disable temporal effects in that milestone and mark motion-vector support pending. [Unity 6.2 custom motion vectors](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/features/motion-vectors-custom-shader.html)

Test LOD transitions while walking and turning. Validate silhouette, head/helmet retention, mail-to-torso clearance, cuffs, skirt and weapon placement at each actual transition distance. Current root-owned LOD repairs take precedence over a triangle-count target. Far simplification must not reintroduce holes or layer intersections.

## Bounded prototype and gates

**P0 — Freeze evidence:** complete current corrected skeleton/material/LOD baseline and hash all inputs. Preserve both earlier slow/fast timing runs. No new dependency is required for this step.

**P1 — One actor:** bake the existing three clips into FP32 bone samples using a small editor/Python exporter. Reproduce 12 fixed phases per clip and loop boundaries against the full skeleton; proposed gate is maximum sampled-vertex error below 2 mm at LOD0 and no visible foot/face discontinuity. Measure rather than assume FP16 suitability. No fighting logic yet.

**P2 — Instanced grid:** render 25/100/250/500 units with seeded mixed clips, equivalent materials, four-cascade shadows and the same camera. Add animation buffers and spatially bounded groups. Prove representative units animate independently, not merely one unit. Keep the full-skeleton path as a runtime fallback.

**P3 — Handoff:** possess one soldier, approach/recede through thresholds, select a new target and switch equipment using a placeholder socket prop. Repeat 100 transitions and verify stable entity IDs, pose/phase continuity, event cursors and no allocations/spikes from unpooled skeleton creation. Close fighting remains a subsequent slice, not implied by this demo.

**P4 — Honest comparison:** run skeleton/LOD versus GPU-bone/LOD on the same exact build with at least three alternating-order runs, 10 s warmup and 30 s samples per population on each machine. Record frame p50/p95/p99, available CPU/GPU timing, draw counts, triangles, upload bandwidth, texture/buffer memory, visible counts and active simulation cost. Null GPU timings stay null. Report development machine contention rather than assign an unmeasured cause. Set a shipping capacity only after the actual siege scene and interaction costs are included.

Only if GPU bone playback fails its measured budget or a non-skeletal effect warrants it, bake one LOD2 VAT clip as an A/B. Compare total texture memory, bandwidth, deformation error, shadows and transition quality under the same conditions. Avoid a second complete renderer before the first bounded result.

**Acceptance remains separate:** artifact correctness, animated appearance, possession continuity, combat behavior and performance each require their own measured evidence. This document records the implementation contract; the prototype stages remain to be built and qualified.
