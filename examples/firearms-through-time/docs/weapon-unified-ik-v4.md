# Unified gloves and forearm IK

Local qualification, 2026-10-26. This pass replaces disconnected palm/finger
pieces with continuous glove surfaces and replaces stretching forearms with
fixed-length shoulder–elbow–wrist chains. It remains prototype art.

## Delivered asset

Hands asset `a_42eb15873bde4c8fad62f46d032f42d8`, revision
`r_26582e5e86cb4dc2a449201ebdde43cb`, child of
`r_c7423075cc8c406583c13e8ba9db6698`, program `p_ba3d707fd6a1`.
The canonical editable source is `authoring/first-hands.kiln.js`, also exported
to the unique `authoring/first-hands-v4-exact.kiln.js`. GLB SHA-256:
`bfbb5f5a6e326f39916fbb1bb8e23ad543b2f1a6413001f931b958d89b2e2d94`.
Source SHA-256:
`ba3d707fd6a1a4531902b1a897c6e0acfef6ab70645b32dc8e88986dd9b9ad54`.
`game/asset-pins.json` and the saved-revision receipt are authoritative.

The 58,726-triangle asset has two skinned meshes sharing one 37-bone skin:

- `Mesh_Gloves`: 54,806 triangles, two closed connected surfaces, one per hand.
  Palms, thumb bases, finger webs and fingers are joined geometrically.
- `Mesh_Sleeves`: 3,920 triangles, two closed connected arm surfaces.
- Three embedded 1K PBR maps and the existing `WovenGlove` material identity.
  All pistol bytes, 72 part identities and 32 grip bindings remain unchanged.

The continuity test welds coincident UV-seam vertices at 1 micrometre before
counting components and edge incidence. Both meshes have zero open edges,
non-manifold edges or degenerate faces under that test. This is triangulated
implicit-surface geometry, not production quad retopology. The glove field uses
2.7 mm sampling; that is a generation setting, not a certified surface-error bound.

## Rig and animation boundary

`game/arm-rig-v4.json` is rig schema **2**: metres, +X forward, +Y up, +Z right.
Each arm has a 0.29 m upper segment and a 0.27 m forearm. Shoulder anchors and
elbow poles are viewmodel parameters. All 33 previous bone names survive; four
shoulder/elbow joints are added, and wrist parentage changes. A consumer must
treat this as a rig migration, not a compatible skeleton overwrite.

`game/animation-v3.json` still owns the timing and pose goals. Ready, Reload
(3.2 s), Inspect (3.6 s), and Fire (0.22 s) travel as actual GLB clips. Each now
contains 37 rotation tracks with constant local bone positions. Baked IK makes
the clips portable; live IK allows targets to move independently of those keys.
Game rules still own ammo, action gates, hits and attachment compatibility.

The engine-neutral `game/arm-ik.mjs` uses an analytic two-bone solve, a projected
elbow pole, a fallback for collinear poles, and reach clamping without stretch.
The Holodeck adapter in `game/arm-ik-three.mjs` runs after AnimationMixer. It
solves in asset space and preserves the animated wrist orientation. Both sides
can receive independent target offsets. The explicitly enabled
`weapon-extension.jsx` remains separate from generic world asset admission.

Unreal uses **Epic's native `FAnimNode_TwoBoneIK`**, driven by
`UWeaponHandAnimInstance`. Its proxy evaluates the imported sequence at the
game-owned time, converts to component space, solves both arms, and converts
back. Game-thread frame data is copied into the proxy before evaluation.
Stretching is disabled. `WeaponArmRigData.h` converts the shared rig to Unreal
centimetres and +Z up; the source hash is embedded in the generated header.
`pipeline/generate-arm-rig-header.mjs --check` verifies that header without
rewriting it. Omit `--check` to regenerate after intentionally changing the rig.
The earlier `configure-native-ik-v4.mjs` was a one-time migration, not a generator
to rerun against the current C++ files.

## Qualification

- All **18** Node delivery/gameplay/geometry tests pass. Delivered GLB forward
  kinematics across all clips tracks wrist goals within **0.210 mm**, with no
  measured segment-length change beyond floating-point error.
- A separate test runs the exact browser adapter with Holodeck's Three revision
  186 on 84 poses, both arms, translated/rotated/scaled roots, and off-clip target
  offsets. Position/length error stays below 1e-6 m; wrist orientation is retained.
- Unreal editor game: **32/32** checks, including a deliberate 2 cm off-clip
  target, fixed segment lengths, reload wrist tracking, finger motion, inspect
  views, ammo gates, and preserved native grip overrides.
- Holodeck **WebGPU and WebGL2** were rendered and exercised through inspect and
  reload. Both return to ready with ammo 7, reserve 27, one shot/hit, and charcoal
  still selected. Both also visibly reject firing during inspect.
- The freshly built standalone Unreal package also passed **32/32** checks.
  Its executable SHA-256 is
  `3C018D7B4382032B6123A21CC828B8831A0A2AD727D9E565C08957371C280412`.
  Exact container hashes are in `evidence/weapon-unified-ik-v4-summary.json`.
  Editor and packaged rendering were observed separately.

Screenshots show continuous finger/palm silhouettes and bending arms, rather than
the previous segmented pads and stretched sleeve. The two lighting environments
still differ. These captures do not establish matching BRDFs, frame-time budgets,
collision-free contact, or AAA visual quality.

Primary evidence: `hands-v4-geometry-ik.json`, `weapon-v4-browser-ik-test.json`,
`weapon-v4-native-import.json`, `weapon-v4-native-material-bindings.json`,
`weapon-v4-editor-result.json`, `weapon-v4-packaged-result.json`,
`weapon-v4-webgpu-*.json/.png/.txt`, `weapon-v4-webgl2-*.json/.png/.txt` under
`evidence/`. The GPU animation sheet is `hands-v4-reload.png`; animation-sheet
derivatives are pose-review evidence, not exact exported-byte screenshots.

## Obstacles and reusable fixes

**Field evaluation timeout.** An initial field allocated arrays inside every
primitive-distance query and exceeded the evaluator deadline. Scalar capsule
and ellipsoid calculations, bounded grid resolution, and iterative buffer
assembly made the complete build succeed. Avoid maps/reduces in dense field
inner loops and large spread arguments. Keep a draft failure receipt, then save
only the reviewed successful child revision.

**UE import split gloves and sleeves.** The GLTF pipeline asset imported each
mesh separately despite both sharing a skin. Explicitly setting
`mesh_pipeline.combine_skeletal_meshes_behavior = BY_SKELETON` produced one
skeletal mesh. The successful namespace is
`/Game/Qualification/WeaponGenerated/first-hands-v4-combined`; the initial split
attempt is retained separately and is not the map's bound mesh. Enumerate actual
imported assets, assert exactly one skeletal mesh and 37 bones, then bind clips.
Old v3 content and the pre-migration map backup remain available.

**Topology changes need versioned consumers.** Never reuse the v3 Skeleton for
the new wrist parents. Import into a new namespace, reconcile generated PBR
parameters and texture enable switches there, preserve destination overlays,
and validate actual posed bones after loading the saved map.

**A baked clip alone cannot prove live IK.** Both consumers are tested with a
wrist target absent from the clip. Check wrist location, both segment lengths,
and wrist orientation. Test the adapter under non-identity root transforms too.

**glTF warnings remain visible.** The reviewed export reports two non-root
skinned-node warnings and 997 zero-weight joint-index warnings. The source root
is identity and both consumers were rendered successfully. Zero-weight slots do
not contribute to deformation. These warnings are retained in the receipt;
this pass does not certify every possible consumer or self-intersection case.

## Reuse in the optional Kiln extension

Keep the core rig/contact schema, surface recipe, baked-clip manifest, pure IK
solver and delivery checks engine-neutral. Load the Three adapter only for
Holodeck and the native AnimInstance/import adapter only for Unreal workspaces.
Neither should install global skills or change generic Kiln defaults.

Candidate tools: validate a versioned rig profile; build and measure a continuous
skinned surface; bake portable clips from game goals; migrate a skeleton into a
versioned destination; reconcile generated materials while preserving overlays;
qualify live IK with off-clip probes and assembled screenshots. Document explicit
input/output units, coordinate systems, semantic names, clamps and ownership.
The present scripts are a local qualification fixture, not a published extension.

For refinement, start from the **saved program reference** or the exact export,
not `hands-v4-build.txt` or the initial authoring script; those are draft history.
The reusable output of this pass is the exact source plus measured contracts.

## Repeat and continue

Run `node --test game/*.test.mjs`, `node pipeline/check-hands-v4.mjs`, and
`node pipeline/test-browser-arm-ik.mjs` from this workspace. The last command
uses this workspace's Holodeck installation to resolve the consumer's Three build.
`pipeline/promote-hands-v4.mjs` checks the saved source and GLB hashes before
promoting this exact revision; do not use it to promote a different revision.

Native steps, sequentially: build Editor, run `reimport_weapon_v4.py`, run
`run-weapon-lab.ps1 -Label v4-editor`, build Package for WeaponLab, then run
`run-weapon-lab.ps1 -Packaged -Label v4-packaged`. Preserve prior receipts before
using the same label. `play-weapon-lab.ps1` launches the packaged result on D:.
The existing Holodeck extension remains available on port 4202.

Next art work: refine the thumb saddle and finger-pad contact against the grip
and magazine, design UV seams/material transitions, add a forearm twist joint
and authored wrist roll, then controlled clip transitions. Shoulder anchors are
currently camera-relative viewmodel anchors, not a Maker/full-body skeleton.
The reload exchange remains below frame and has no separately tracked spare or
dropped magazine. Finger contact uses authored curls, not a collision solver.
Production retopology/LODs, material detail, sound/VFX and performance budgets
still need qualification before calling this production character art.
