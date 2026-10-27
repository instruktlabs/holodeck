---
name: kiln-unity-pipeline
description: "Transfer saved Kiln assets and Holodeck placements into this Unity example, diagnose visual mismatches, and qualify local or remote builds with traceable evidence."
---

# Kiln Unity Pipeline

Use this project's `unity-cli` skill for supported CLI commands. Author geometry
in the separate Kiln world workspace using its installed author/QA skills.

## Preserve the contract

Treat the saved Kiln asset/revision and exact GLB hash as the source identity.
Export those bytes and retain editable source. Describe optimized, skinned, or
material-replaced output as a derivative with its own hash and source linkage.
The example importer reflects X to match glTFast; placements, anchors and
colliders must use that same basis exactly once. Check an asymmetric fixture.
Source design dimensions can drift: measure the built mating planes and review
the composed join before repeating modules. A module QA pass cannot prove a join.
Read destination collider limits before freezing module boundaries. This Holodeck
version permits 16 boxes per object; subdivide visual modules at meaningful joins
when exact collision exceeds that limit. Do not replace stairs with a solid box
or silently drop guard collisions to satisfy a schema.
Before finishing a castle or other connected kit, draw the site, route network,
floor levels and sections. Define occupied clearance envelopes for stairs,
landings, doors, vehicles and turning space; the empty landing is part of the
module's interface. Test a complete approach and departure against neighboring
placements, not only the isolated assembly. Use actual controller movement and
body sweeps in both directions; downward support rays cannot expose every blocked
entrance. Keep diagram sweeps, controller simulation and browser traversal distinct.
Prove reachability before refining stairs: build an adjacency graph of walkable
collider tops from every placement (step height, gaps wider than the capsule,
rails and guards) and confirm a path from spawn to every station. A gatehouse
design passed rise/run, headroom and lintel arithmetic while its entire gallery,
crown and tower circuit was an unreachable island behind a guard rail.
Check that each visual walking surface has collision at the same height.
Draw terrain support, bridge abutments and foundations before dressing. Derive
vegetation exclusions from circulation and sightlines. A local placement repair
does not establish a functioning defensive circuit or complete scene layout.

For parallel authoring, assign disjoint source/evidence folders. Collect exact
program references, renders, dimensions and interfaces. Serialize shared collection
saves and scene application unless the installed store explicitly supports concurrency.
Use Holodeck proposals for world changes and preserve unrelated cove/reference data.
When available, `kiln review save` can persist an exact completed observation
without evaluating the source again. Verify its expected revision, source hash,
GLB hash and capture first; verify the saved export afterward. Geometry-only
operations have no capture. A CPU geometry thumbnail can accompany a draft while
a separately matched GPU study carries the material review; label that distinction.
Keep comparison-display offsets separate from runtime transforms when checking
component identity. Sort semantic attribute keys before hashing; object-key order
alone is not a geometry difference. Compare decoded data rather than buffer IDs.

## Qualify the transfer

When extending a preview into a playable example, read
[playable-slice.md](references/playable-slice.md) for the demonstrated input,
serializer and smoke-test boundaries. A compiled preview is not a playable gate.

Read `Tools/validate_bundle.py`, `Assets/Editor/SiegeBridge.cs` and the project
README for the implemented contract. Validate exact hashes before import.
`SiegeBridge.RunChecks` tests unchanged reimport, scene identity, bad-hash rejection
and route rays. It does not test changed/deleted assets, gameplay override
preservation, capsule traversal or visual parity. Generated scenes are importer-owned.

Run `SiegeMaterialAudit.Run` when materials differ. Compare GLB linear base-color,
metallic and roughness factors with imported shader properties and texture slots;
account for Unity's color-property conversion instead of comparing raw numbers
blindly. Check active render pipeline, color space, light intensity, environment,
exposure and shader support before replacing materials or darkening source albedo.
The initial kit has flat PBR factors and no texture maps: that is not lost texture data.
Linear lighting is the current bridge baseline; retain before/after captures when
changing it. More complex Kiln procedural shaders still need explicit export checks.
Isolate apparent geometry artifacts with matched shadow-on/off captures before
editing the source. Record effective URP shadow settings, not only the Light's
stored bias: `usePipelineSettings` can make those Light values inactive. Increased
bias can erase contact shadows without fixing the original defect. Preserve that
tradeoff and do not turn shadows off silently to declare the asset corrected.
Bound diagnostic shader variants. Temporarily disabling all unused-variant
stripping caused a large optional cascade build; an interrupted Editor persisted
the override despite its script's finally block. Keep the original value in the
outer runner, explicitly restore and verify it after interruption, and prefer
the smallest diagnostic that exercises the required feature.
To identify a bad cast band, isolate the suspect material's caster pass while
keeping it visible and receiving shadows. This is a diagnostic, not a final
no-shadow workaround. Check world-space shadow texel size as well as resolution:
URP scales depth and normal bias by the shadow projection's texel footprint.
In the soldier fixture, a 50 m single cascade produced large mantle serrations;
four cascades retained the 50 m range and removed the coarse band. Enable the
needed cascade policy in the pipeline asset before building with normal stripping,
then restore and verify the source asset. No blanket variant-retention switch
was needed. Review full-body cuffs and close contact shadows and retain residual
fine edge aliasing as a separate quality limit.

Use an actual rendered player capture and read it. A running frame counter or
successful build is insufficient: hidden Windows player windows produced a black
capture while their simulation kept advancing. Render to a texture or use a normal
review window. Never grade performance from a suppressed/blank render or from one
startup frame sample. Keep visual, traversal, build and performance gates separate.
For controlled pose captures, verify both the requested animation state/phase
and the visible pose. This fixture reported the new Idle state while its first
readback still showed the previous Walk pose. Waiting for three completed camera
render callbacks before readback resolved that case; record the callback count
and inspect the pixels rather than treating a fixed delay or state hash as proof.
Keep texture readback, image encoding and diagnostic logging outside performance
intervals. Use a clean process without preview sequences for the population test.
Run player binaries and timing outputs from the normal local execution workspace,
then copy hash-verified evidence into synchronized storage after completion.
Changing directories alone does not prove a performance improvement. Preserve
repeat variability and all allocator warnings; a completed sweep or exit code
zero does not establish clean memory behavior. Mark warnings that occur during
timing, and keep diagnostic flags separate from measured performance runs.
When an allocator warning depends on player presentation, isolate camera lifecycle
and graphics backend with the same source and built player. In this fixture,
hidden manual D3D12 reproduced JobTempAlloc, while two hidden manual D3D11 runs
and one approved visible normal-camera D3D12 run were clean. Keep that bounded
qualification and the full logs; it does not establish a general Unity fix.
An enabled camera in a hidden or graphics-batch Windows window can still have
no callbacks. Fail that run before sampling. An advancing simulation is not proof
of rendered work. The same shadow defect surviving both camera modes and a
material shader replacement is evidence against those specific causes.

For characters, review face/shoulder closeups as well as tactical distance before
declaring visual readiness. Count unique meshes, instantiated primitives, materials,
skins and clips separately. Named pivots or sockets do not establish a deformation
rig. Require actual weighted pose tests before multiplying a static study into a
crowd. Profile the runtime derivative and preserve editable source; source triangle
counts alone cannot establish draw cost or crowd capacity.
For a material palette derivative, compare decoded linear vertex colors and
texture channels, then destination pixels. Preserve source geometry/skin hashes
separately from the derivative hash. Reject unsupported shader features instead
of silently dropping them. Bind simplifier indices to the exact input GLB hash.
Small simplification error does not protect thin closed wraps: initial cuff and
helmet LODs folded across their thickness. Audit new triangle orientation against
retained normals, protect affected original connected surfaces, and rerender the
failed pose. Preserve original smoothing exceptions only for exact source faces.
Accept a larger LOD when needed to retain visible form. Share the canonical bones
and one Animator between LOD renderers; record actual draw counters separately
from the sum of configured meshes.
Normal-orientation checks do not establish clearance between independently
simplified layers. Actual PBR views exposed tunic/mail intersections and beard
gaps after gray previews passed. Preserve mating layered surfaces together or
validate an explicit clearance-aware simplification. Compare all resident LOD
skinning costs with a one-renderer control: fewer submissions can coexist with
slower frames when inactive meshes still update. Test renderer update/culling
policy explicitly and prove the same actors remain rendered before crediting a
performance improvement.
Crowd tests need explicit animation workloads. Repeating clip assignment by grid
index makes visible stripes even when phases differ. Shuffle clip assignments
with a saved seed and vary phase and speed independently. Include an all-walk
workload so idle actors do not conceal animation cost. Inspect actual multi-unit
motion and record runtime state/phase/speed for spatially spread units. Reset
controlled single-unit capture poses to their assigned crowd states before
warmup; save preview readback/encoding outside timing intervals.
The opt-in `SoldierGltfImport.Run` smoke checks Mecanim bindings and measured
skinned-vertex motion through direct GLB import. It also audits a separate
vertex-color/textured static fixture. Those two fixture passes do not qualify a
combined production character or its rendered appearance. Resolve the controller
root from actual clip paths, verify weighted mesh movement, and inspect texture
slots and vertex-color data before assuming an FBX scalar palette preserves art.
Establish the reference-matched close-view character before enforcing a low
triangle budget. Derive crowd LODs from that visual baseline. A technically
cleaner mesh can still lose the approved silhouette, clothing and face. Use
fixed-camera material-faithful revisions and independent anchored art reviews;
do not average serious face/anatomy failures into an overall passing score.
Define the target art style before scoring. A rigorous production review can
serve stylized characters: judge personality, intentional planes, readable
features and consistency rather than imposing photographic skin or anatomy.
Carry explicit part roles, anatomical sides, joint centers and indexed garment
regions out of Kiln. Require exactly one matching skin rule for every imported
mesh; an unknown face component must fail instead of falling back to a torso
bone. Make shared Blender mesh datablocks single-user before applying instance
transforms or vertex groups, then compare each part's world-space vertices.
Use authored sleeve rings for shoulder/arm blends when available. A purely
spatial shoulder heuristic can move the waist or leave an inner cuff on the
torso. Keep rigid straps and armor assigned to their intended bone. Recheck
fitted equipment against the source surface before blaming weights for overlap.
For an indexed seam, inspect shared vertex indices and two-sided edge adjacency.
Duplicate-position seam pairs can legitimately be absent. Measure local edge
strain as well as seam gaps: a connected garment can still deform badly.
An ordinal sleeve-ring blend can jump sharply across two nearly adjacent rings.
Use distance along the actual authored surface to build a continuous blend and
measure the shortest transition edges in extreme poses. Compare bind positions,
normals and weights per part to prove a local rig fix did not move the waist or
alter an approved head. A lower maximum strain still needs a visible pose review.
Check winding with backface culling enabled before rig acceptance. Workbench's
two-sided appearance can conceal a completely inward-wound trouser leg. A tube
builder with fixed winding must account for its authored ring direction; an
ascending boot and descending leg cannot blindly share the same triangle order.
For a known tube, compare triangle normals with the intended radial direction;
for a thick cuff, distinguish its outer surface from its deliberately inward
inner wall. Preserve vertex IDs when correcting face winding so skin mappings
remain stable. Do not hide an orientation error with blanket double-sided
materials. Inspect the actual Unity front and rear views afterward.
Compare intended poses with baked actions, then import the exported GLB in a
fresh process and compare sampled clip geometry again. Preserve the source FPS;
exclude only explicitly identified bone-display helpers from geometry checks.
Nearest-vertex comparison can accommodate UV/material splits but is not a
collision, appearance or anatomical-quality test. Ground-height correction is
not foot locking or contact IK, and a procedural walk is not a qualified combat
animation set. Label these limits in the handoff.
Treat owner approval as a component boundary when subsequent feedback targets
another part. Preserve the approved component and record which reviewer
recommendations are superseded. For equipment-only revisions, compare decoded
geometry, material values and complete transform ancestry; a whole-file hash
must change when equipment changes and cannot prove component preservation.
Show the revised equipment from the side, rear and underneath as well as front.
Build fitted hair or garment overlays from the actual target surface, including
its deformations. Selecting whole triangles by centroid can leave a sawtooth
boundary; clip crossing triangles at the intended boundary and weld new vertices.
Probe equipment cavities before expensive multi-view renders. An interpolated
cross-section test over vertices can reject obvious penetration cheaply, but it
does not prove triangle-level clearance, posed clearance or visible quality.
When an external anatomical base materially improves the result, retain its
license, original source, hash and transformation receipt, and identify it as
an input to the editable Kiln asset. Source reuse does not qualify its rig or art.
Measure the actual anatomical landmarks when fitting a sourced mesh: the full
head-and-neck bounding box may include a bust and is not the ear-to-ear width.
Check head/neck embedding, helmet seating and the eye line in front and profile.
Qualify source byte size before a large literal-buffer edit. This installed
Kiln evaluator caps source at 512 KiB while the program store accepts 1 MiB;
edit/validate accepted an oversized input whose render later reported a
misleading protocol error (instruktlabs/kiln#299). Preserve the original
data and use declared precision reduction or a supported resource binding.
Do not alter the installed evaluator or silently decimate to hide this limit.
For custom eye apertures, lip ribbons and other surfaces collapsing to a point,
weld coincident tips, remove degenerate triangles and compact unused vertices
before calculating normals. Finite coordinates alone are insufficient: referenced
normals must also have nonzero length. Keep the actual exporter exception when
the CLI surfaces a generic execution error; do not infer a helper/API failure
from that generic message alone.

## Execution and learning

A project job lock serializes this workspace, not every workload on the machine.
Record concurrent agent/game work and the owner's load reports beside timing
data. Without per-run utilization or a controlled quiet window, a sequential
same-build timing difference does not isolate a causal optimization gain. Keep
geometry, material, draw-count and rendered-motion evidence separate from that
performance uncertainty. Do not stop unrelated jobs or keep repeating expensive
sweeps to chase a favorable result. Use a coordinated quiet window and alternating
trial order for capacity work.

Use a normal local execution directory when synchronized-path imports fail. Copy
source, packages, settings and exact inputs explicitly; preserve .meta GUIDs.
Do not transfer Library caches or live Editor locks between machines.
Commit every bundle asset `.meta` with the generated scene that references it.
A checkpoint once held the GLBs, bundle JSON and scene but none of the 17 bundle
metas; a second project copy had imported the same bytes and minted different
GUIDs for every file. The build host's set was authoritative because its hashes
matched the build input receipt. Recover metas from that receipt-matched source;
never re-import to regenerate them. Before a cross-host build, check that every
GUID a generated scene references resolves to a committed `.meta`.
`validate_render_settings.py` covers render assets only, not bundle metas.

Fail closed on a missing terrain appearance contract. To rebuild a pre-contract
bundle for regression, write a separately named bundle with an explicit legacy
contract and the colour's actual source (it was a constant in the earlier
destination builder, not world data), and record the contract in the scene
receipt. Compare an exported palette with the accepted world revision's stored
appearance; a reconstruction script once typed a different palette inline.
A new bundle identity needs its own smoke run, never the old receipt.

Reconcile module dimensions to one source before authoring. The asset inventory
drifted from later blueprints (gate opening, bridge width and pitch, stair rise
and width, wall height), so the same module had two specifications.
Hash review images and bind them to the asset revision they show. One review
folder held a byte-identical copy of another asset's capture under a new name.
For the hub, pin the matching Editor and platform module, check memory, serialize
heavy jobs and save input hashes, exit code, logs and output checksums. Linux checks
do not establish Windows player performance. CachyOS is a compatibility target;
record dependency fixes and smoke tests instead of claiming Ubuntu support.

Verify account and license status separately, including a fresh SSH session after
login. License activation requires the owner's chosen license and any required
terms acceptance. Do not copy credentials or print authenticated command lines.
An inconsistent CLI auth result is a finding to investigate, not a reason to
repeatedly ask the owner to sign in or weaken credential protections.

Record each workflow finding in the private workspace journal: observation,
evidence revision/hash, cause confidence, implemented change, check and remaining
limitation. Promote demonstrated reusable lessons into this skill or a focused
tool test; keep guesses and example-specific art choices in the project notes.
Do not patch installed Kiln/Holodeck packages as a shortcut to improving this bridge.
