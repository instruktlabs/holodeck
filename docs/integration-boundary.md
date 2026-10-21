# Kiln and Holodeck integration boundary

The agreed split keeps reusable asset authoring, export and asset QA in Kiln,
and world composition, runtime behavior, UI and agent orchestration in Holodeck.
Holodeck owns the adapter between an asset delivery and its current runtime.
Neither package's successful validation substitutes for review in the other.

Holodeck currently pins `@instruktlabs/kiln` **1.3.1**. Keep that exact dependency
until a separately scoped change has a reproduced need and compatibility evidence.
The installed package and its live tool contracts are authoritative; a feature
in a development checkout or a proposal is not an installed capability.

The product is **Holodeck powered by Kiln**, published as source at
`instruktlabs/holodeck`. The npm package `@instruktlabs/holodeck` remains private.
See [licensing](../LICENSING.md) for MIT code and CC0 bundled content.

## Ownership

| Concern | Owner | Boundary |
| --- | --- | --- |
| Reusable geometry, materials, dimensions, pivots, semantic metadata and editable source | Kiln and the asset workspace | Author and save independent asset revisions. Destination constraints come from the brief; world-specific dimensions and controllers do not become universal asset requirements. |
| Asset rendering, structural QA, animation studies, export profiles and delivery facts | Kiln | Inspect the exact asset and state the scope of each result. Source QA, material fidelity, import compatibility and owner acceptance remain distinct. |
| World bible, references, placements, routes, terrain, water, colliders and runtime modules | Holodeck | Compose supported records around exact asset deliveries. A prose rule does not activate a capability. |
| GLB admission, bindings, loading, render derivatives and compatibility feedback | Holodeck adapter | Check the consumer's actual decoder, material, joint and extension support. Preserve source identity through batching and disposal. |
| Camera/input ownership, inhabitants, patrols, procedural gait and flocks | Holodeck runtime | Own simulation state, clocks and transitions. Asset joints provide articulated parts; they do not supply navigation, collision or AI by themselves. |
| Agent sessions, proposals, approvals, history, world library and exports | Holodeck host/UI | Stage changes against the current world context and revision. Preserve native agent authentication and permission boundaries. |
| Destination appearance, traversal and performance | Consuming world, with user review | Bind evidence to the loaded world/assets, camera, backend and measured workload. Generic asset QA cannot certify the whole experience. |

Kiln runs on the local Node side. The browser loads the admitted GLB and uses
Holodeck's renderer; it does not import Kiln's root SDK. Asset authoring stays in
a separate configured workspace. Package maintenance does not authorize silently
rewriting existing authors' installed skills or source files.

## Versioned delivery profile and existing admission

Implemented today: versioned world schema/runtime modules, strict schema and GLB
admission, exact accepted asset hashes, explicit foliage bindings, runtime joint
diagnostics, loaded-revision observations, and proposal/apply revision checks.
`world_read` exposes the current host's supported records so older scaffolded
workspaces can learn capabilities without an instruction overwrite. The current
dynamic tool session contract is version 4; the world runtime remains version 1.

`world_read.capabilities.assetDelivery` exposes the shared
`ASSET_DELIVERY_PROFILE`: `id: 'static-rigid-v1'`, `version: 1`, GLB/glTF 2.0 and
self-contained resources. `supportedRequiredExtensions` is the same allowlist
the validator uses. `embeddedClips`, `skinning` and `automaticLOD` are false;
`hostGait` names `motion.gait@1`, `named-rest-joints` and schema version 2.
The record describes current admission; it neither expands the extension set
nor adds a new preflight tool, decoder or automatic LOD adapter.

Validation reports clip, skin and unsupported-extension mismatches separately.
Keeping the profile and errors together helps agents choose a compatible delivery
before proposing it. A general caller-facing preflight API is **not implemented**.
If a concrete need justifies one later, specify its interface first and reuse
existing admission and Kiln delivery facts to explain:

- which exact file and source revision are being consumed;
- required versus available decoders/extensions, native clips and skinning;
- whether LOD is actually consumed or the loader uses the default level;
- required named nodes, local pivots and shader-channel bindings;
- hard admission failures versus advisory evidence still needed in the browser.

Do not turn advisory information into an unsupported acceptance badge. Preflight
must not imply that a compatible file looks right, moves correctly or meets a
frame budget. An absent optional capability must be reported rather than silently
claimed as enabled. Changes to public adapter contracts need versioning and a
regression demonstrating the original mismatch.

## Current delivery decisions

**Rigid gait and QA clips.** Holodeck currently admits static GLBs with named
rest-pose joint hierarchies and rejects embedded animation clips and skins.
Its gait rotates uniquely resolved child joints. Missing or ambiguous bindings
disable the gait with diagnostics. Animated asset QA studies can remain separate
derivatives; they are not the static runtime delivery. Preserve joints and local
transforms instead of flattening the rig to pass import. This consumer limit is
not a requirement for other Kiln destinations. See [articulated gait](articulated-gait.md).

**Foliage.** Shading and wind bind explicit unique leaf meshes through
`asset.foliage`. Wind uses the declared UV channel with continuous weight from
attachment to tip. Structural validation can verify the channel and node shape,
but cannot infer the artist's intended gradient. Shader movement does not deform
CPU collision or triangle picking. Do not infer leaves from names, modify trunks
implicitly, or treat shading as a repair for an inadequate silhouette.

**LOD and cost.** Kiln can author and export declared LOD chains. Holodeck's
current loader does not select their levels; that is a consumer limitation, not
a demonstrated Kiln export defect. Compatible repeated static objects use
96-metre spatial batches, retaining semantic IDs and collision. Instancing does
not remove source triangles, material work or shadow passes. Compare close and
overview views before claiming improvement. See [world architecture](architecture.md).

**World and asset identity.** A proposal, accepted world, browser-loaded bundle,
runtime observation and owner review are different states. Require the correct
world identity, activation and revision at each crossing. Persist exact GLB hashes;
never treat an asset name, reused path or equal revision number in a different
world as the same content. See [history](world-history-and-export.md) and
[coherence evidence](coherence-protocol.md).

**Portable examples.** Scene editing can use the world document and exact GLBs
without the original procedural programs. Exact provenance IDs do not grant
access to another author's asset library. Public source refinement would require
a separate authorized source-delivery contract. Examples and static sites exclude
private sessions, references and workspace contents. See
[example bundles](example-world-bundles.md), [static export](static-export.md) and
[distribution](distribution.md). Publishing a user world remains an explicit
owner action; these interfaces do not change its license.

The [workflow knowledge ledger](workflow-knowledge-ledger.md) records demonstrated
fixes, current limits and follow-up ownership. The approved sequence keeps Kiln
1.3.1 pinned while finishing Holodeck delivery guidance, profile diagnostics and
bounded shadow work, then establishes a matched reference-machine performance
baseline before engine changes. A later Kiln task needs a bounded reproduction
that identifies a reusable asset/export/QA problem. Do not promise an upgrade or
core fix merely because a consumer feature is absent.
