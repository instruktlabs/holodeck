# Siege characters: production proposal

Research checked 26 October 2026. A rejected visual fixture has a Blender Python
22-bone Generic rig and three baked clips. Hub checks demonstrate FBX and direct
GLB import, clip bindings and weighted vertex movement; separate static fixtures
test vertex colors and textures. The current original character still needs a
combined art, rig, material and Windows player qualification. This describes an
independent implementation, not a copy of another game.

Ski Sim is one inspected example of a Kiln character, not the prescribed architecture
or an established performance benchmark. The user's interest is a general procedural
asset pipeline. Here, abstract means flexible authoring and varied geometry, not a
change to the approved grounded medieval aesthetic. The choices below remain
hypotheses to compare; the proposed human skeleton is not a universal asset contract.

## Recommended first character

One common adult infantry body, three equipment variants, one canonical skeleton.
Establish proportions, joint centers and rest pose numerically. Use the generated
turnaround for appearance only: it does not specify topology, skin weights or a
consistent bind pose. Start with the crossbow defender, then shield infantry and
sapper. The human face, clothing and hand quality are explicit visual gates.

Kiln authors body geometry where its result is suitable, and equipment, armor,
materials and sockets. Bend zones need sufficient continuous topology and sensible
loops. Independently overlapping cloth layers must receive compatible weights.
Helmets, shields and weapons are rigid attachments; cloth and exposed limbs deform.
Do not merge all equipment irreversibly into the body.

The selected face uses original stylized Kiln geometry. Preserve its anatomy
while varying cropped hair, helmet and facial hair as explicit modules. Initial
facial-hair options are heavy stubble, short boxed beard and fuller cropped beard.
Use one active option in each delivery artifact. Review lip clearance and the
helmet/neck/collar envelope; do not add noisy strands to imply realism. Keep the
source modules editable and consider shared materials and renderer consolidation
in a measured runtime derivative. Static head accessories can follow the head
joint; extra styles alone do not call for additional bones or runtime IK.

## Three different operations

- **Rigging and skinning, offline:** create skeleton, bind pose and vertex weights.
- **Motion generation/retargeting/baking, offline:** produce reusable motion clips
  on that skeleton. Constraints can be evaluated and baked into keys.
- **IK, runtime:** adapt selected end effectors to current ground or equipment
  targets. This adjusts an animation; it does not produce topology or skin weights.

Blender Python is the recommended integration layer. Run a pinned Blender
executable with versioned `bpy` scripts rather than an extra interactive bridge
for batch work. Keep editable `.blend` sources, a rig manifest and a baked delivery.
An example future invocation is `blender --background --python build_character.py
-- --manifest character.json`; this is a proposed project script, not an existing
command or an installation instruction.

Pipeline stages: validate geometry and units; construct the canonical armature;
assign and normalize weights; rigid-parent equipment to sockets; check deformation;
retarget or author clips; bake evaluated motion; export; import and validate in
Unity. Preserve original source artifacts and record all derivative hashes.

Compare explicit procedural weights for known generated topology. Blend around
elbows, knees, shoulders, hips, wrists and garment seams; cap exported influences
at four per vertex for the initial profile. Normalize, reject unweighted vertices,
and test extreme bends. Automatic heat weights are an independent comparison, not
proof of acceptable clothing deformation.

## Skeleton and animation contract

Use root, hips, spine, chest, neck, head; paired shoulder/upper-arm/forearm/hand;
paired upper-leg/lower-leg/foot/toes: 22 joints including root. Add twist or finger
joints only when contact/deformation quality requires them. This is a proposed
deformation skeleton; a valid Unity Humanoid Avatar still requires explicit mapping
and validation. Otherwise use Generic intentionally. Do not assume any 15-bone
procedural render rig automatically satisfies Humanoid retargeting.

Sockets: right grip, left support grip, shield grip, headwear, belt and back.
Socket transforms are authored in rest-local space and tested after basis conversion.
The weapon defines its two hand targets; a weapon switch blends targets rather
than teleporting wrists. Elbow/knee hints choose the bend direction and avoid flips.

First five baked clips: idle, walk, step-up, carry and interaction/reach. Then add
run, crossbow aim/fire/reload, spear attack, repair, hit and death. Validate reload
mechanics separately; generated pose sheets do not prove a functioning mechanism.
Store clip source/license, sample rate, duration, loop flag, event times and root
motion policy. Use in-place motion with gameplay-owned root movement initially.

Runtime IK: two-bone legs for foot contact plus limited pelvis adjustment; two-bone
arms for weapon/tool grip. Blend over baked animation. Disable incompatible IK
during deaths or any authoritative physical motion, and ramp weights at transitions.
Foot locking requires contact phases and ground queries, not merely pointing the
toe at a sampled height. Joint limits and maximum reach prevent rubber limbs.

[Unity Two Bone IK](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/constraints/TwoBoneIKConstraint.html),
[Unity retargeting](https://docs.unity3d.com/6000.0/Documentation/Manual/Retargeting.html),
[Blender Bake Action](https://docs.blender.org/manual/en/4.5/editors/nla/editing/strip.html).
The Blender reference explains the operation; pin and test the actual installed
version's Python operator arguments before automation.

## Learned tools: optional, offline

| Candidate | Current evidence | Decision |
| --- | --- | --- |
| MagicArticulate | Released skeleton inference; README reports 4.6 GB VRAM; code and main weights Apache-2.0; Michelangelo dependency weights LGPL-3.0 | Plausible local skeleton experiment on 8 GB, not yet tested; requires separate skin weighting |
| Puppeteer | Skeleton and skin prediction; component reports 4.6 / 4.2 GB, full preprocessing peak unmeasured | PartField dependency restricts use to noncommercial research/education; not an unrestricted production stack |
| SkinTokens / TokenRig | Skeleton and weights; existing-skeleton mode; code and weight card say MIT; Python 3.11+, CUDA 12.1+, NVIDIA GPU at least 14 GB | Larger-GPU comparison candidate, outside documented local capacity |
| UniRig | Skeleton/weight pipeline, MIT code and weight card; CUDA dependencies and checkpoint qualification required | Secondary comparison, not a required dependency |
| RigAnything | Research auto-rigging; Adobe noncommercial research license | Exclude from distributable baseline pending an appropriate license |
| HY-Motion 1.0 | Offline text-to-motion; documented 24 GB Lite / 26 GB full minimum under constrained settings; custom territorial license restrictions | Not a default dependency |
| MoMask | Motion/BVH research; code MIT, separate model/data rights require review; documented imperfect foot IK | Ideation comparison only |

Sources: [SkinTokens](https://github.com/VAST-AI-Research/SkinTokens),
[MagicArticulate](https://github.com/Seed3D/MagicArticulate),
[Puppeteer](https://github.com/Seed3D/Puppeteer),
[PartField license](https://github.com/nv-tlabs/PartField/blob/main/LICENSE),
[SkinTokens weights](https://huggingface.co/VAST-AI/SkinTokens),
[UniRig](https://github.com/VAST-AI-Research/UniRig),
[UniRig weights](https://huggingface.co/VAST-AI/UniRig),
[RigAnything license](https://github.com/Isabella98Liu/RigAnything/blob/main/LICENSE.md),
[HY-Motion requirements](https://github.com/Tencent-Hunyuan/HY-Motion-1.0),
[HY-Motion license](https://github.com/Tencent-Hunyuan/HY-Motion-1.0/blob/master/License.txt),
[MoMask](https://github.com/EricGuo5513/momask-codes).

Keep code, model-weight, dataset and motion-clip rights distinct. A permissive code
license is not a blanket license for every downloaded checkpoint or animation.
No neural packages or checkpoints were installed during this research.

SkinTokens supports `--use_skeleton --use_transfer`, so we can compare skin weights
without abandoning the canonical skeleton. Record exact model/code revisions and
seed. Compare identical meshes at identical poses against procedural weights.
Neural output still needs topology, penetration, joint-limit and contact review.
Do not infer quality from a research benchmark or a static rest-pose image.

## Implemented first humanoid derivative

The selected short-boxed-beard soldier now uses three reproducible tools:
`prepare_production_manifest.py`, `rig_production_soldier.py` and
`verify_production_rig.py` in the Unity example's `Tools` directory. The first
pins the exact Kiln GLB and authored part/joint manifest. The second assigns
explicit semantic weights, builds a 22-bone skeleton, bakes Idle, Walk and
LookAround, and exports a single skinned GLB. The third compares sampled exported
poses after a fresh Blender import. Blender Python orchestrates authored weights
and procedural motion; no neural checkpoint, Rigify control rig or runtime IK is
used by this baseline.

Source garment rings govern sleeve weights, while head accessories and rigid
equipment have explicit bone ownership. Shared mesh instances are detached before
transform baking and weight assignment. An unknown part or mismatched source hash
fails the build. Preserve the normalized manifest, optional hash-pinned overrides,
author snapshot, script hashes, blend file, GLB and pose audits as one handoff.

The Unity production importer is `SoldierProductionImport.ImportAndBuild`. It
requires `--soldier-glb`, `--expected-sha` and the expected clip set. It resolves
the actual Animator binding root, checks skinned vertex motion for each clip,
then builds the separate crowd fixture. The older smoke importer remains a
fixture test and does not stand in for production evidence.

## Delivery and scaling

Retain a shared identity across two products: Holodeck static named-joint preview
and Unity skinned/animated derivative. Holodeck currently rejects skins and clips;
Python rigging does not remove that runtime limitation. A richer Holodeck skeletal
controller would be separate engine development. The Unity artifact carries the
canonical skeleton, skin weights, clips, sockets and source/derivative provenance.

Pool actors, share mesh/material resources, keep per-actor pose state independent,
and bound corpses and effects. Benchmark 25/50/100/200 units before setting a cap.
Use full contact IK for selected/nearby characters; reduce distant pose evaluation
without changing authoritative movement, combat or capture. Standard skinned
renderers do not automatically become a single instanced crowd draw.

Proof gate: one infantry family, three equipment variants, five clips, working
two-hand grip, feet on a measured 0.18 m step and slope, no exploding weights,
correct restart/reimport, and measured Unity player frame times. Inspect the same
character at tactical distance and walking height before expanding the cast.

## Comparative study before selecting a binder

Blender Python is the orchestration layer, not itself a skinning algorithm. Keep
skeleton inference, weight assignment, control-rig construction, motion generation,
IK and baking as separate stages. Rigify constructs modular control rigs; it does
not skin the mesh. Its components cover humanoids and other articulated forms.
[Rigify documentation](https://docs.blender.org/manual/en/5.4/addons/rigify/introduction.html).

| Kiln fixture | Methods to compare | Review motions |
| --- | --- | --- |
| Human with separate tunic and armor | Authored weights, bone heat, surface geodesic, voxel bind on identical skeleton | Crouch, elbow bend, overhead reach, two-hand grip |
| Quadruped | Authored/Rigify versus inferred skeleton; then fixed-skeleton binder comparison | Leg extremes, shoulder bend, neck and tail sweep |
| Asymmetric creature | Custom hierarchy versus neural inference | Independent appendages, folded pose, twist |
| Rigid siege mechanism | Named-part transforms versus one bone per part | Full hinge/slider range and pivot accuracy |
| Thin banner or flexible appendage | Explicit chain weights versus geometric bind | Bend and twist; no cloth-simulation claim |

Compare weights on the same skeleton first. Evaluate free skeleton inference
separately. Include disconnected clothing, closely spaced limbs and proportion
variants. Preserve Kiln part IDs, pivots, local frames, intended joints and sockets
as authoring metadata: it may remove the need to infer information already known.
The manifest should allow arbitrary hierarchies rather than require 22 human joints.

Bone heat is a low-setup local comparison, but overlapping geometry can need manual
correction. Surface geodesics use mesh connectivity; disconnected garments need
special handling. Voxel approaches can bridge disconnected/intersecting geometry,
but resolution and narrow gaps affect results. Candidate implementations require
their own qualification; these method names do not guarantee equivalent behavior.

- [Auto Weight Pro](https://frankiepang.com/auto-weight-pro/): author documents
  surface-geodesic, proxy-heat and rigid-part modes, GPL-3.0. Listed Blender tests
  stop at 5.1; installed 5.2 needs qualification.
- [Adaptive Auto Skinning](https://jessyleite.dev/posts/autoskin/): author documents
  Blender 5.2/Windows, Python API and adaptive voxels; paid tool with GPL/core
  exception. No purchase, dependency audit or benchmark performed.
- [Blender automatic weights](https://docs.blender.org/manual/sl/3.6/animation/armatures/skinning/parenting.html)
  and [Autodesk geodesic voxel explanation](https://help.autodesk.com/cloudhelp/2015/ENU/MayaLT/files/GUID-5EFDB81B-E332-4D6C-B1BB-0B989AD2F2C7.htm)
  describe method behavior, not qualification of a Blender add-on.

Use two-bone IK for limbs and compare FABRIK for longer chains. Unity exposes chain
iterations and tolerance; solving the endpoint does not ensure joint-safe or
collision-free poses. [Unity Chain IK](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/constraints/ChainIKConstraint.html).

Bake evaluated Blender control constraints onto deform-bone animation tracks for
delivery. Recreate interactive ground/grip constraints in Unity. Skeletal clip
baking, physics/cloth caches and vertex-animation textures are different products;
do not substitute one silently. Neural motion generation is also separate from
neural rigging and must pass the same contact and retarget checks.

Record setup and repair time, unweighted vertices, normalization, unwanted cross-part
influence, visible deformation defects, peak RAM/VRAM, bake/export/import pose error,
and Unity player CPU/GPU frame time. Review at identical poses and camera distances.
Start with installed Blender and built-in methods; qualify optional tools only when
the comparison needs them. No winner or runtime unit cap is established yet.
