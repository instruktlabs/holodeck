# Garrison soldier readiness

26 October 2026. The owner selected the original Kiln head with a short boxed
beard for the main soldier. Stubble and cropped beard remain accessory variants.
The selected head is integrated into a full body with continuous indexed sleeves,
fitted mail and cuffs, and a 22-bone Blender Python rig. The full-detail source
has 15,978 triangles, one skinned mesh, 16 material submeshes and at most three
observed influences per vertex. The current runtime derivative retains exact
LOD0 geometry and skinning with two materials. Idle, Walk and LookAround are
baked clips.

Nine sampled baked poses match the intended geometry exactly in Blender. A fresh
GLB import reproduces those samples within 0.003 mm. Independent full-body pose
review confirms the repaired waist, sleeve continuity and rigid boot straps;
the later continuous surface-distance weight repair reduces worst raised-arm
stretch from 3.932 to 1.858 while preserving bind geometry and all other part weights.
An angular raised-shoulder fold remains. The proof
does not establish contact IK, foot locking, weapon handling or combat animation.
The walk is procedural and in place. Runtime evidence is tracked separately from
these topology and delivery checks.

## Current crowd repair and optimization

Four shadow cascades at the same 50 m range and 2048 atlas remove the coarse diagonal
mail-shadow teeth. Contact shadows remain; fine pixel-edge aliasing still appears.
Single-cascade depth-bias increases had erased contact shadows without repairing
the projection. The needed shader variants compile with normal stripping.

The two-material palette matches nine fixed Unity poses within two 8-bit channel
levels. It reduces draw submissions by approximately 8x; that does not imply an 8x
frame-rate increase. Early multi-LOD tests with every resident skin updating did
not consistently improve frame time and remain in the private evidence.

Two lower LOD attempts were rejected: first for folded thin cuffs/rims, then for
mail/tunic intersections and beard gaps missed by gray previews. The accepted
fixed-view pair retains 12,550 / 11,504 triangles, preserving the tunic, mail, skin and
boxed beard together. It shares one Animator and 22 canonical bones across levels.
Automatic transition popping has not been reviewed in a moving gameplay camera.

On the hub GTX 1660 Ti Max-Q/Vulkan at 1280 x 720, a same-build all-walk comparison
with four cascades, Animator AlwaysAnimate and inactive-renderer skin updates
disabled measured:

| Units | Forced LOD0 median/p95 ms | Automatic LOD median/p95 ms |
| ---: | ---: | ---: |
| 100 | 9.24 / 9.43 | 7.57 / 7.74 |
| 250 | 30.02 / 30.25 | 23.45 / 23.61 |
| 500 | 42.33 / 42.60 | 32.40 / 32.54 |

The 500-unit median was 23.45% lower in this sequential trial. The owner reports
both hosts were under concurrent load, including two hub agents and work on
another game. Per-run background utilization was not measured. The observed
difference therefore does not isolate a causal or sustainable optimization gain.
All 500 actor bounds stayed
in the camera frustum; 500 of 1,500 resident renderers were observed visible. Both
runs had zero JobTempAlloc warnings. These eight-second samples isolate the
configured rendering/animation workload, not machine contention, sustained game
capacity or a CPU/GPU bottleneck.
Shadow range remains 50 m and does not cover every distant member of a widened grid.

The final Windows D3D11 manual-render player also completed with zero allocator
warnings and intact actual captures, but its contended high-count timings were
poor: 100 units median/p95 9.98/20.87 ms, 250 at 53.44/97.01 and 500 at
120.08/198.35. Retain these results. Neither machine is a quiet performance
baseline; do not infer hardware capacity or compare their frame times directly.
The separate 30-second single-soldier check and 60-frame Walk capture passed.
Eight obsolete ShaderUtil API warnings in the Editor audit helper were fixed
using current Shader APIs and a fresh hub compile/material audit. The hub still
logs a nonfatal account-token refresh message while its activated license permits
the Editor to run; runtime allocator and source compilation checks are separate.

Animation assignments are now shuffled with a saved seed, independent phases and
speed 0.92–1.08. Mixed mode deliberately includes Idle/LookAround; all-walk is a
separate workload and motion preview. Up to 16 spatially spread units have actual
clip/state/phase/speed advancement checks. Neither mode implements navigation.

The next rendering architecture is described in
[the hybrid crowd and possession contract](siege-hybrid-crowd-animation.md): full
skeletons for possessed/near combatants and a measured GPU bone-animation
prototype for distant actors. It is planned, not an implemented combat system.

## Historical first Unity baseline

The Windows release fixture on Unity 6000.2.3f1 imported all three clips with
resolved bindings and measured weighted-vertex movement. The source has one mail
texture and no vertex-color attribute; those counts carry through. Front/rear
player views exposed inward-wound trouser faces that two-sided Workbench previews
had hidden. Reversing only those faces, retaining the vertex order and all other
components, corrected actual single-sided Unity visibility.

The initial corrected-geometry baseline on an RTX 3070 and Ryzen 7 3700X, Direct3D
12, 1280 by 720 explicit URP render target, measured:

| Units | Median frame ms | 95th percentile ms |
| ---: | ---: | ---: |
| 1 | 0.75 | 1.17 |
| 25 | 2.41 | 3.18 |
| 100 | 6.31 | 7.21 |
| 250 | 16.93 | 20.79 |
| 500 | 27.40 | 32.04 |

Each stage warms for three seconds and samples for eight. All full-detail actors
use continuous Animator evaluation, mixing Idle, Walk and LookAround. Automatic
deformation proof samples the first unit; rendered crowd captures were inspected.
Shadows have a 50 m range, so not every distant unit has a visible shadow. Camera
framing widens with count. At 500 units the fixture has 7.989 million instantiated
triangles and 14,121 median draw calls. GPU frame timing is unavailable; it is not
estimated from wall time. These measurements exclude navigation, combat, contact
IK, the castle scene and normal-window presentation cost. They do not establish
a sustained game population cap. At 250 and 500 units, the baseline already
exceeds a 16.67 ms frame budget before those game systems.

The final delivery build repeated the sweep and was slower despite similar draw
counts and identical fixed-pose images: median/p95 was 8.72/16.68 ms at 100 units,
19.65/27.45 ms at 250, and 40.54/56.84 ms at 500. Both runs remain evidence. The
cause of the difference has not been isolated, so do not select only the faster
run or treat 100 units as a guaranteed 60 fps game budget.

A third sweep ran the exact delivery player outside OneDrive in the normal local
Unity workspace, copying evidence only after completion. It measured median/p95
8.62/22.17 ms at 100, 19.78/35.07 ms at 250, and 32.20/36.07 ms at 500. Moving
directories did not establish a causal speedup or remove variability. This run
also logged 16 JobTempAlloc warnings, including during 1- and 100-unit timing.
Earlier diagnostic and other runs lacked those warnings. Their cause and timing
impact remain unresolved; these are diagnostic samples, not clean performance
or memory qualification. Preserve all runs and warnings.

This baseline retains a separate shadow-rendering artifact below mail and cuffs.
Matched shadows-off, normal/depth bias and 4096-resolution comparisons isolated
its cast-shadow dependence but did not produce a clean fix. High bias removes
useful contact shadows and does not qualify as a correction. The default shadow
policy remains enabled. Do not replace source geometry or albedo to hide it.
The current repair section above supersedes these historical limitations where
explicitly qualified; preserve the original runs for comparison.

## Findings from the original rejected study

The rotated, capped sleeve tubes expose flat shoulder ends. The head uses separate
ellipsoids for facial features, with protruding black eyes and a separate beard
mass. Close inspection does not meet the approved grounded medieval direction.
The garment and limb sections are disconnected, with no deformation armature,
skin weights or animation. Hand/head sockets are useful equipment metadata but
are not a qualified rig.

The soldier has 12,512 instantiated triangles and 63 mesh primitives per unit,
using nine distinct materials. Those are source structure counts, not measured
Unity draw submissions. Its 29 unique meshes are reused within the hierarchy.
Hands alone consume 4,224 triangles; head/face pieces consume 3,532. These costs
are poorly distributed for a tactical crowd while the shoulder/body forms remain
underdeveloped. Adding the crossbow introduces another 17 primitive instances.

## Correction and qualification order

1. Establish continuous body and garment bend regions, rounded shoulder volume,
   and deliberate armpit, elbow, hip and knee loops. Preserve rigid equipment as
   separate attachable pieces. Review front, profile, back and close face views.
2. Preserve the selected original face and refine fitted hair, helmet and facial
   hair accessories in the same stylized shape language. Compare stubble, short
   boxed beard and fuller cropped beard on the same anatomy. Check the lip opening,
   jaw, collar and helmet fastenings from multiple views. Test at the actual tactical
   camera and nearest supported camera; close-camera quality is a separate gate.
3. Create one canonical skeleton and weighted delivery derivative. Validate bind
   pose, normalized weights, influence limit and rigid attachment transforms.
   Use the character pipeline proposal for the initial rig contract; do not
   substitute a list of named groups for a skeleton or skin.
4. Exercise raised arms, crossbow aim/reload, elbow bends, crouch, long stride,
   stairs and head turns. Inspect intermediate poses for collapsed shoulders,
   detached seams, clipping and sliding hands/feet. Export and test in Unity.
5. Produce a runtime derivative with shared materials and fewer renderers. Retain
   editable Kiln sources and source-to-derivative mapping. Use mitten/glove forms
   where fingers do not contribute at target distance; avoid indiscriminate mesh
   merging that destroys interchangeable equipment or joint behavior.
6. Compare 1, 25, 100, 250 and 500 units with identical camera and animation clips.
   Record CPU animation/simulation, GPU frame time, submissions, triangles,
   memory and quality. Include visible, partly occluded and offscreen conditions;
   test shadows and IK as separate variables. Counts are test cases, not promised
   supported populations or an established performance budget.

Qualify one good animated soldier before multiplying full-body variants or a crowd.
Bounded accessory comparisons can precede that gate. Export only the selected
facial-hair option per character. Keep authoring modules separate, then evaluate
merging compatible rigid head accessories in the runtime derivative. Extra hair
styles do not require extra bones; any deformation must follow the actual rig
contract. A shared material or low triangle count alone does not prove low cost.
Introduce LOD, animation-rate reduction or alternative crowd rendering only when
the measurements identify the cost and visual tradeoff. No neural rigging result
can by itself certify bad shoulder topology or facial quality.

Private raw evidence and adversarial reviewer reports remain in the task's
evidence workspace. This document records the reusable production correction,
not a final acceptance claim.
