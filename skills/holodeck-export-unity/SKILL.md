---
name: holodeck-export-unity
description: Move an accepted Holodeck world and its pinned Kiln GLBs into a Unity project through a project-owned adapter, and qualify the result with traceable evidence. Use when the world's scene.destinations includes unity and the task is a Unity import, scene generation, material or shadow mismatch, cross-host build, rendered capture or performance check. Not for authoring in Holodeck or Kiln.
license: MIT
compatibility: Optional Holodeck skill, installed only in schema v2 worlds whose scene.destinations includes "unity". Assumes a Unity project with glTFast import and URP; read the actual project for versions.
metadata:
  destination: unity
  opt-in: scene.destinations
---

# Export a Holodeck world to Unity

Holodeck does not ship a Unity exporter. Its only built-in export is the static
web scene. A Unity bridge is an example adapter that each Unity project owns:
its validator, importer, generated scenes and build scripts live in that
project, not in the world folder or an installed package. Read that project's
README and adapter code for the contract it actually implements, and do not
claim checks it does not run.

Holodeck owns the world: placements, terrain, water, colliders and the accepted
revision. Kiln owns asset geometry and saved revisions. The Unity project owns
import, materials, physics, input, builds and destination performance. Author
in the world through Holodeck proposals and in the separate Kiln workspace with
its own skills. Do not patch installed Holodeck or Kiln packages to make a
transfer pass.

## Preserve source identity

- The source of a transfer is the accepted world revision plus each asset's
  saved Kiln revision and exact GLB sha256. Record them in the bundle and check
  every hash before import; reject a mismatch instead of importing it.
- An optimized, skinned, re-materialed or LOD output is a derivative. Give it its
  own hash and record the source hash it came from. Do not label it the saved
  revision.
- Hash review images and bind each to the asset revision it shows. A capture
  copied under another asset's name is not evidence for that asset.
- A new bundle identity needs its own smoke run. An earlier bundle's receipt
  does not qualify it.

## Convert frames exactly once

glTFast reflects X to convert glTF into Unity's left-handed frame. Placements,
anchors and colliders must go through that same reflection exactly once, never
zero or two times. Holodeck rotations are radians in three.js Euler order XYZ.
Prove the conversion with an asymmetric fixture (an L-shaped marker or a
labelled corner) seen from above in both tools, not with a symmetric module.

## Carry collision faithfully

- Read the collider limits on both sides before freezing module boundaries.
  Current Holodeck allows 16 boxes per compound collider, yaw only. When exact
  collision needs more, split the visual module at a meaningful join.
- Do not replace stairs with a solid ramp box, and do not drop guard rails or
  blockers to satisfy a schema or a box budget.
- Every walkable top in Holodeck must land as a walk surface at the same height
  in Unity, and every visual walking surface needs collision at that height.
- Keep "no collider" explicit in the bundle (a tagged `none` record) and reject
  missing or unknown collider tags. Some Unity serializers turn a JSON null into
  an empty nested object, which would import as a zero-size collider. See
  [playable-slice.md](references/playable-slice.md).

## Fail closed on terrain appearance

Terrain geometry alone does not carry its look (holodeck#31). Export the
terrain's resolved appearance from the accepted world revision: base colours,
layer maps, height and slope rules, and normals. Never type a palette into an
export script; compare the exported values with the revision's stored
appearance. If the bundle has no terrain appearance contract, fail the import.
Matching terrain geometry is not material parity.

To rebuild an older bundle for regression, write a separately named bundle with
an explicitly named legacy contract, state where its colour actually came from
(for example a constant in the old destination builder, not world data), and
record that contract in the scene receipt.

Where terrain and paving share a footprint, keep one visible, walkable owner
(holodeck#30). Compare exported terrain triangles with the transformed floor
triangles; a triangle can cross a court whose vertices all lie outside it. Do
not hide coplanar overlap with shader bias.

## Close every GUID dependency

Unity binds by `.meta` GUID, not by path. Two hosts that import the same bytes
mint different GUIDs.

- Commit every bundle asset's `.meta` with the generated scene that references
  it (holodeck#32). Before a cross-host build, check that every GUID a generated
  scene references resolves to a committed `.meta`.
- If metas are missing, recover them from the host whose imported hashes match
  the build input receipt. Never re-import to regenerate them.
- Copy the render pipeline asset, renderer, global settings and default volume
  profile with their `.meta` files and `ProjectSettings` as one closure
  (holodeck#26). A matching path can hold a different GUID. Validate the closure
  before launching the Editor. A render-settings check does not cover bundle
  metas, and the reverse.

Read [project-transfer.md](references/project-transfer.md) for cross-host
copies, Editor locks and job serialization.

## Diagnose appearance before editing sources

Compare GLB linear base colour, metallic and roughness with the imported shader
properties and texture slots, allowing for Unity's colour-space conversion.
Check the active pipeline, colour space, lights, environment and exposure
before replacing materials or darkening albedo. A kit of flat PBR factors with
no texture maps has not lost texture data. Reject unsupported material features
rather than dropping them silently.

Isolate apparent geometry artifacts with matched shadow-on and shadow-off
captures before touching the source. Read
[rendering-and-performance.md](references/rendering-and-performance.md) for URP
shadow diagnosis, bounded shader variants, capture pitfalls and timing rules.

## Use rendered evidence

A successful build, a running frame counter or an advancing simulation is not a
rendered frame. Hidden or batch-mode player windows can produce black captures
while the simulation keeps running. Render to a texture or use a normal visible
window, then open and read the image. A RenderTexture capture excludes OnGUI
overlays, so judge the interface separately.

Keep rule tests, destination import, traversal, rendered appearance, build and
performance as separate gates with separate evidence. A compiled preview is not
a playable gate; read [playable-slice.md](references/playable-slice.md) before
extending one.

## Characters, skins and LODs

For a character, crowd, skinned derivative or LOD chain, read
[characters.md](references/characters.md). Named sockets are not a rig, source
triangle counts are not draw cost, and a passing grey preview is not a material
review.

## Performance honesty

Never grade performance from a blank or suppressed render or from one startup
sample. Keep readback, encoding and logging outside timed intervals. Record the
build, backend, camera, workload, repeats, variability and every allocator
warning. A job lock serializes this project, not the machine: record other load
on the host, and do not credit a sequential timing difference under shared load
to an optimization. Results on one OS or GPU do not establish another.

## Record and promote lessons

Keep findings, receipts, captures and host details in the Unity project's own
notes: observation, evidence hash, cause confidence, change, check and remaining
limit. Promote a lesson into this skill only when it is demonstrated and
reusable beyond one scene; keep art choices and scene-specific numbers in the
project. Lessons about world layout belong in `holodeck-author-world`, and
lessons about Kiln assets in the Kiln skills.
