---
name: holodeck-verify-world
description: Verify a Holodeck world or asset integration against its intended interaction, persistence, visual direction and runtime cost. Use after a meaningful scene or behavior change; distinguish validation, loaded state, play evidence and owner review.
---

# Verify the resulting experience

Bind the report to the accepted world revision, loaded runtime revision, asset
hashes/revisions, selected controller/camera and renderer backend. A saved file,
successful asset render or agent message is not evidence that the browser adopted
the change. Start with `world_read` and `world_observe`.

Use `world_check` for advisory feedback. It reports loaded-revision freshness,
inventory, spawn clearance and optional bounded route samples through the active
probe driver. Read evidence, IDs, limitations and next observations. An attention
finding may be an intentional constraint; compare it with the bible before editing.
A clear sample is not a passed traversal or visual review. Stale or missing browser
observations must not be described as current evidence. The tool neither blocks
edits nor approves the world. For supported terrain/possession worlds, also use
`world_sample` for accepted terrain height, normal, slope, water depth and actor
support at named points. Its requested Y is context, not an instruction to move
the ground. Independent points use the swim entry threshold; route probes retain
the previous mode between samples. Neither samples an unapplied proposal. Test
actual slope movement, waterline entry/exit, both possession cameras and origin
hide/recall separately from the advisory report.

Choose checks from the change's intended behavior, not its implementation shape.
For an architectural edit: reach the changed area, traverse intended passages,
test blockers and select the intended module. For controls/camera work: test focus
handoff, held-input release, possession/return and safe recovery. For references:
edit, save, reload, reopen the exact referenced content and verify bible pins.
Only claim behaviors that exist in the installed runtime.

Exercise failure/recovery when the change affects loading or persistence: invalid
candidate, stale revision, remove/undo, reload and retained last-good content.
An assertion should fail if the required behavior or content is absent; do not
silently skip a missing controller, asset or component and call the world complete.

Use actual browser/device observations for runtime cost. Name the camera, backend,
sample duration and whether counts include shadows/post passes. Separate source
triangles, visible triangles, draw submissions, CPU/frame timing, stalls and memory
estimates. Targets are not measured results. Do not infer VR/mobile readiness from
a desktop WebGPU pass or substitute WebGL2 results for WebGPU qualification.
For repeated scenery or optimization changes, use the
[render-cost check](references/render-cost.md). It distinguishes source cost,
per-frame counters and periodic observations, and checks close/overview culling
tradeoffs without assuming distance LOD or a frame-time improvement.

For simulation-heavy changes, distinguish frame work, authoritative tick work,
GPU durations, snapshot age and loading/publication stalls. These can overlap;
do not add them as independent costs. Include offscreen activity and nested query
counts when relevant. Historical game receipts inform test design, not current
world performance claims.

Review appearance in the destination lighting and at intended viewing distances.
Report composition/material/intersection issues separately from structural checks.
A screenshot can establish appearance, not collision or interaction correctness.

Write a short result with passed checks, observed failures and untested claims.
Definition of Done summarizes evidence; it does not enforce engine constraints.
Data-oriented design is an architectural option, not an acceptance badge. No ECS,
physics backend or universal performance cap is prescribed by this skill.
