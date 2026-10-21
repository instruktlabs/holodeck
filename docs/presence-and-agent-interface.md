# Presence and the agent interface

Proposal following the owner's 2026-10-21 clarification. This refines the intended
experience; it does not authorize implementing orchestration or new controllers
during the compatibility and visual milestone.

## Be present while creating

The creator is a first-person observer with freedom to move around, inspect
objects, and see construction in context. They can fly or reposition without
being bound to a character's collision rules. This freedom is a view/control
mode, not a license for the agent to ignore scene budgets or loading rules.

Typing or speaking does not pull the creator out of the world. Opening input
releases pointer lock and suspends movement shortcuts while the field is focused.
Capture camera pose, selected object, pointed-at location, and active reference
at submission so that "put that here" has explicit context. Moving afterward
does not silently change the target of the submitted instruction.

Keep an always-available stop action, selection breadcrumb, and return-to-cove
command. The agent may suggest a viewpoint, but does not move the user's camera
without an explicit focus action. Proposed edits are visible in a preview layer;
the user can keep looking around while the builder works.

## Create and inhabit modes

| Mode | Camera and control | Relationship to the world |
| --- | --- | --- |
| Create | First-person free movement, inspect/focus controls | Observe and edit; ignore character collision while keeping spatial context |
| Inhabit | Selected actor/controller and its first- or third-person camera | Experience declared movement, collision, gravity, and interactions |

World state, conversation, and references persist across mode changes. Preserve
the creator pose separately from the actor pose. Entering an actor validates its
spawn, collider, and required behavior modules. Returning to create mode restores
the previous observer pose or a safe viewpoint. The creation platform may be
hidden independently; inhabiting does not require deleting the authoring space.

For the first full-loop prototype, propose free-moving create mode and one
simple walking inhabit controller. First/third-person switching, custom avatars,
vehicles, and alternate physics are subsequent extensions. The owner has not
yet accepted this revised controller scope.

## One conversation with useful blocks

Maintain one visible orchestrator session. It interprets intent, asks for actual
decisions, consults the world bible, and delegates bounded build tasks when its
agent adapter supports delegation. The builder modifies a scoped workspace and
returns candidate changes and evidence. It does not directly own the live scene.

The experience must still work with an agent that cannot spawn a child session:
the same agent performs the build task using the same proposal/apply contract.
Do not simulate a second agent or claim a delegation that did not occur.

Raw token streaming is available in a collapsible transcript, not the primary
spatial presentation. The orchestrator can narrate progress briefly, but the host
also receives structured events about tools and actual scene state. These events
are the authority for completion/failure, not model-written claims of success.

| Conversation block | What appears | Useful actions |
| --- | --- | --- |
| Intent | A short interpretation of the requested change | Correct, continue |
| Reference | Images, crops, or material samples with source/revision | Compare, pin, associate |
| Decision | A proposed bible rule and its consequences | Accept, revise, leave open |
| Build task | Plain-language task and actual queued/running/failed state | Stop, inspect details |
| Scene proposal | Changed objects/region and a before/after preview | Focus, apply, discard |
| Evidence | Actual capture, traversal result, or measured budget | Inspect, request correction |
| Question/error | The missing input or actionable failure | Answer, retry, keep current world |
| Applied change | Exact scene revision and a concise description | Undo, inspect diff |

All blocks have an ID, kind, originating turn/task, status, scene base revision,
related object/reference IDs, and optional local artifact references. Actions are
typed host commands. An agent cannot supply arbitrary executable HTML, scripts,
or shell commands as UI actions. Markdown is sanitized; artifact links resolve
through the workspace boundary. Invalid blocks fall back to readable text and a
diagnostic rather than breaking the conversation.

Update an existing task/proposal block as its state changes instead of appending
one card per token or tool event. Keep the current decision or selected-object
thread visible; fold completed background work into history. Never hide a failed
apply, pending permission request, or unresolved blocking question in a summary.

The interface can explain actions and evidence without exposing private model
reasoning. What matters is what is being changed, why the change is proposed,
what the system observed, and what decision the user needs to make.

## Relevance follows explicit context

Begin with deterministic relevance rather than a separate ranking model:

1. Current selected object/region or pinned reference.
2. The active user request and its outstanding decision.
3. The task/proposal currently changing that scope.
4. Relevant failures, permissions, or budget violations.
5. Recent completed changes; older detail stays in searchable history.

Show why a block is present, for example "For the selected bridge" or "Needed
before entering this actor." Allow the user to pin any block. A world marker can
link to a discussion without filling the landscape with permanent windows.
Keep a small conversation tray and summon fuller references/journal views near
the cove or where the creator deliberately places them.

## World variety through declared capabilities

Keep landscape representation, terrain queries, physics, controller, camera,
and interaction modules separate. A world declares which modules and versions
it uses and how their capabilities fit. A controller may require ground queries,
collision queries, or rigid-body simulation; a camera may require an actor anchor
and obstruction tests. Missing requirements prevent activation with a clear reason.

Examples include static mesh landscapes, heightfield terrain, free-flight worlds,
walkable environments, and later vehicle/character simulations. These are possible
module combinations, not all first-release features. Avoid one terrain system or
physics library becoming an unstated requirement of every world.

Modules need bounded resource use, inspectable configuration, serialization,
versioning, cancellation, and disposal. Unknown project-local code does not become
safe merely by having a manifest. Changing physics/controller modules requires a
staged rebuild and a valid state-transfer or reset policy; it is not an unchecked
live script replacement.

## Orchestration and scene writes

One host serializes revision commits. An orchestrator can grant a builder a task
scope, base revision, reference pins, bible snapshot, budgets, and expected output.
The builder returns a candidate revision plus observations. The host validates
resources and applies only against a compatible base revision. A conflicting
direct edit returns the proposal for reconciliation, not an automatic overwrite.

Stop cancels outstanding build/prepare work and leaves the active scene intact.
Permissions remain real agent permission requests. Failed work and pending
decisions survive reconnect alongside the last accepted scene.

## Next visual review

Review one first-person view from inside the cove, one freely positioned creator
view with a selected object and proposal block, and one inhabited view with the
cove hidden. These are follow-up studies after the platform identity is chosen;
they should prove the conversation stays useful without becoming a wall of text.
