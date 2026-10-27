# Unity bridge and agent tooling

Research date: 26 October 2026. Recommendations, not an installed/qualified stack.
Companion design: [medieval siege](medieval-siege-design.md).

## Decision

Use Unity's official standalone CLI and Pipeline package for a warm Editor, with
project-owned C# import/validation/build commands. Keep ordinary Editor batch mode
for clean reproducible builds and tests. Start with one glTF importer, glTFast,
and a versioned Holodeck scene manifest. Do not install overlapping control bridges
or both glTF importers by default.

There is no evidence here of a universal agent preference. This recommendation
follows current first-party capabilities, reproducibility and integration cost.

| Component | Candidate pin / current evidence | Purpose and caveat |
| --- | --- | --- |
| Unity Editor | 6000.3.27f1 LTS, released October 20 | Proposed long-term baseline; existing 6000.2.3f1 can run initial compatibility probes |
| Official Unity CLI | 1.0.0-beta.14, October 21 | Primary shell-capable agent interface; beta, needs qualification |
| Pipeline | com.unity.pipeline 0.9.1-exp.1, October 23 | Editor command server; registry declares Unity 6000.0 minimum; experimental |
| Unity agent plugin | Repository manifest 0.1.8-beta | Unity-specific skills; pin a reviewed commit before use; Unity Companion License |
| glTFast | com.unity.cloud.gltfast 6.20.0, August 27 | First import candidate; Apache-2.0; registry latest is experimental 7.0.0-exp.1 |
| URP | Select with Editor/template and lock resolved version | Recommended rendering baseline, not an installed package yet |
| Test Framework | 1.4.6 candidate | EditMode and PlayMode regression tests |
| Performance Testing | 3.6.0 candidate | Repeatable CPU/frame measurements alongside GPU profiling |
| Blender | Version to pin after local availability check | Body topology/rigging/weighting and animation qualification if required |

Do not upgrade the existing project version or install a second Editor merely
because a newer release exists. First select storage and qualify the minimum
bridge on a small project. Unity 6000.6.7f1 is a newer supported update, but this
scene has no demonstrated dependency on it. 6.3 LTS is the proposed stable branch.

Unity explicitly recommends direct `unity command` / `unity eval` for agents
that can use a shell. Its old MCP server inside `com.unity.ai.assistant` is
deprecated; `unity mcp` remains supported through the standalone CLI. This does
not deprecate third-party MCP packages. Use the installed CLI's help/discovery
for exact command shapes; do not infer flags from old tutorials.

Sources: [official migration guidance](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli),
[CLI releases](https://docs.unity.com/en-us/unity-cli/release-notes),
[Pipeline registry](https://packages.unity.com/com.unity.pipeline),
[agent plugin](https://github.com/Unity-Technologies/unity-agent-plugin),
[6.3.27 release](https://unity.com/releases/editor/whats-new/6000.3.27f1),
[Unity support policy](https://unity.com/releases/unity-6/support).

## Alternatives evaluated

CoplayDev/unity-mcp v10.3.0 (October 4, MIT) is an actively maintained MCP
alternative with Python/uv dependencies. IvanMurzak/Unity-MCP 1.5.0 (October 24,
Apache-2.0) provides extensible Editor/runtime tooling and a standalone CLI.
Both are candidates if the official route fails a required operation. Release
activity is not evidence that either performs better for this project.

UnityGLTF 2.24.0 (October 20) is the alternative importer for extension-heavy,
animation or export requirements. Test it against the same fixture if glTFast
fails. Choose one importer to own files and materials; competing importers make
reimport and reference stability harder to reason about.

Sources: [Coplay release](https://github.com/CoplayDev/unity-mcp/releases/tag/v10.3.0),
[Ivan release](https://github.com/IvanMurzak/Unity-MCP/releases/tag/1.5.0),
[glTFast](https://github.com/Unity-Technologies/com.unity.cloud.gltfast),
[glTFast registry](https://packages.unity.com/com.unity.cloud.gltfast),
[UnityGLTF comparison](https://github.com/KhronosGroup/UnityGLTF#unitygltf-and-gltfast),
[UnityGLTF release](https://github.com/KhronosGroup/UnityGLTF/releases/tag/release/2.24.0).

## What the bridge transfers

Kiln is the asset source of truth. Holodeck is the layout and spatial-review source
of truth. Unity is the gameplay source of truth. A one-way authored-content import
is the first milestone; arbitrary Unity edits do not write back into Holodeck.

An export bundle contains exact self-contained GLBs plus a versioned manifest:

- World revision and export schema version.
- Each asset's stable scene ID, Kiln asset ID, revision ID, collection, SHA-256,
  source artifact identity, delivery profile and license/provenance record.
- Each placement's stable ID, asset revision, parent, source transform and layer.
- Authored colliders, walkable tops, anchors and explicit unit/basis conventions.
- Required feature list and a machine-readable report of unsupported features.
- A separate gameplay overlay keyed by placement ID: station sockets, gate health,
  route nodes, evacuation/capture zones and encounter configuration.

The gameplay overlay is not inserted into Holodeck's strict scene schema. Preserve
it alongside the Unity project. Convert transforms, normals, winding, anchors,
routes and colliders consistently. Unity importers already convert glTF geometry
handedness: the bridge must account for that once, not mirror it a second time.
Use a documented matrix basis conversion with an asymmetric test asset; never
assume negating one Euler angle solves every placement. Kiln +X forward and Unity
gameplay +Z forward require a declared per-prefab orientation contract.

Materials: verify base color space, metallic/roughness channel interpretation,
normal tangent space, alpha cutouts, double-sided surfaces, UV tiling and texture
transforms. Engine-specific lighting, water, clouds, terrain blending and foliage
wind are not faithfully encoded by an ordinary GLB. Add explicit Unity adapters
or reject/report unsupported features. Begin with mesh ground and rocks to prove
the bridge; qualify a heightfield adapter before depending on Holodeck terrain.

The current source scene includes a cove and mood board. Keep them in the authored
world; omit origin-layer content from the standalone siege build by an explicit
export option. Report the omission, preserve it in the source, and test it.

## Reimport and source boundaries

Generated assets/prefabs/scenes live under a dedicated Generated subtree. Unity
gameplay wrappers, manually authored settings and overrides live outside it.
Reimport matches stable IDs, preserves Unity GUIDs where intended, updates changed
asset revisions and reports removed objects. Never silently discard overrides.
Validate the entire candidate before replacing a last-good generated scene.
Include dry-run differences, duplicate-ID errors, hash failures and a deterministic
import receipt. Importing the same bundle twice must not create duplicates.

Proposed C# commands (not implemented yet): `ValidateBundle`, `ImportBundle`,
`CompareImport`, `CaptureReview`, `BuildWindows`. Both the interactive CLI and
batch tests invoke the same project code. Treat asynchronous compile/import as
pending until its terminal result; require an exact project identity before edits.

## Character bridge

Holodeck's static-rigid-v1 profile rejects skinning and embedded clips. Deliver a
named-joint rigid preview for layout and equipment review, and a separately
qualified Unity skinned character. Record the transformation chain from authored
source to rigged derivative. Do not label a manually rigged derivative as the
unchanged saved Kiln revision.

glTFast can import skins and animations, but a functioning Humanoid Avatar and
Animator are additional work. Its feature documentation notes extra Mecanim setup
and no skinning/animation support in its experimental Entities importer. Therefore
neither glTF import nor Entities is a shortcut to an animated army.

Qualify one skeleton, hand/weapon sockets, skin weights, clip bindings, in-place
locomotion, aiming/reload, hit and death before expanding roles. Compare the
Holodeck preview's bounds and equipment placement to the Unity character.
Cloth, facial animation, dismemberment and ragdoll crowds are deferred.

Sources: [glTFast feature contract](https://github.com/Unity-Technologies/com.unity.cloud.gltfast/blob/main/Packages/com.unity.cloud.gltfast/Documentation~/features.md),
[Holodeck gait contract](articulated-gait.md),
[Unity instancing restrictions](https://docs.unity3d.com/6000.2/Documentation/Manual/gpu-instancing-enable.html).

## Qualification before scaling

1. Connect to the exact Unity project. Compile a trivial script, receive a terminal
   result, run tests, capture a real frame and produce a Windows x64 build.
2. Import an asymmetric gate with hinge, collision, a patterned material chart and
   a known 1 m reference. Inspect both sides, normals, shadows and human clearance.
3. Reimport unchanged and revised bundles; prove stable IDs and retained overrides.
4. Qualify the character profiles and animation transitions in the actual player.
5. Run a small siege with win, loss, restart, gate breach and fallback behavior.
6. Profile 25/50/100/200 attackers, repeated twice with the same seed and camera
   path. Record CPU/GPU percentiles separately, frame spikes, allocations, loading,
   memory, simulation backlog, visible character count and shadow settings.

Use a packaged development build for profiling and a release build for the final
smoke test. Record Editor/package pins, source commit or dirty-tree manifest,
asset hashes, importer version and executable hash. A build pass does not prove
visual parity or fun; screenshots do not prove collision or gameplay.

[Editor batch arguments](https://docs.unity3d.com/6000.2/Documentation/Manual/EditorCommandLineArguments.html),
[Test Framework CLI](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html),
[Performance Testing package](https://packages.unity.com/com.unity.test-framework.performance).

## Status

The existing Editor and Windows build module were found. The new CLI, Pipeline,
URP and glTFast stack has not been installed or smoke-tested for this example.
The older minimal scaffold does not represent the proposed production package
set. No game scene, character rig, importer or Windows build exists yet.
