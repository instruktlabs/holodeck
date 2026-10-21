---
name: holodeck-integrate-asset
description: Integrate or replace a Kiln asset in a Holodeck world, preserving authoring identity while checking placement, runtime compatibility, and rendering cost. Use alongside the installed Kiln skills for asset creation or refinement.
---

# Integrate an asset into a world

Read the world, destination selection and relevant bible/reference items first.
Read `.kiln/AGENTS.md` and the installed Kiln author/refine/QA skill for actual
asset work. Use the world workspace's `kiln_workspace` server; never author in
the Kiln engine checkout. If the workspace is missing, follow Kiln setup rather
than improvising a global connection.

Separate asset identity from its placements. Retain the exact saved collection,
asset revision and editable source. Export a supported runtime artifact; do not
claim a modified derivative is the unchanged saved revision. Stage placement
changes through Holodeck's world tools.

Check units, axes, pivot, bounds, materials, semantic roles/anchors and required
extensions against the actual consumer. Convert geometry, anchors and colliders
through the same frame. Preserve authored UV/material meaning unless a declared
destination adapter intentionally replaces it. Missing metadata is not permission
to infer collision, rig actions or surface semantics from appearance.

The current Holodeck importer accepts static GLBs, including rigid parts under
named joint groups, and rejects embedded animation clips. For procedural gait or
wing motion, deliver the named hierarchy in its authored rest pose; the supported
runtime behavior drives those joints. A Kiln animated QA study may be a separate
review derivative. Do not deliver that study's animation clips as the runtime
GLB or remove the joint hierarchy to make an import pass. Verify the exact
delivered GLB after exporting the static rest pose.

Keep independently editable or moving modules separate in the authored model.
Runtime instancing or merging may combine compatible geometry/materials while
preserving mappings to source parts and scene IDs. Do not weld an operable gate,
door or moving lamp irreversibly into the architecture. Rendering optimization
does not establish physical fit or interaction behavior.

Verify the destination: supports, overlaps, passage clearances, collision, picking
identity, lights and visibility/lifetime. Match collision to the current controller
and scene layout. Record source QA separately from runtime-loaded and in-scene
evidence. A lower source mesh count is not necessarily fewer GPU draw submissions.
For repeated scenery, check source primitive/material and shadow cost as well as
placement count. Use the [render-cost check](../holodeck-verify-world/references/render-cost.md)
for spatial batching tradeoffs and the current loader's lack of distance LOD.

Current limitations are in
[current-runtime.md](../holodeck-author-world/references/current-runtime.md).
Use `holodeck-verify-world` for a meaningful destination check. Report unsupported
animation/physics honestly rather than dropping it silently during import.
