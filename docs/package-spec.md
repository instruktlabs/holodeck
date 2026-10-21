# Holodeck package specification

Date: 2026-10-21. This document preserves the broader product proposal.
Current implemented contracts and limitations are in [architecture](architecture.md),
[example worlds](example-worlds.md) and [advisory coherence](coherence-protocol.md).
Persistent authoring and the first data-driven example milestone are implemented;
later capabilities in this proposal remain separately scoped.

The [creation-platform clarification](creation-platform.md) defines the current
starting state: a Kiln-authored cove kit on a bounded platform in an empty grid
construct. It supersedes the earlier generic shelter/landscape presentation.
The [presence and agent-interface proposal](presence-and-agent-interface.md)
adds create/inhabit modes and structured conversation blocks for review.

Holodeck is a locally run browser workspace for discussing, authoring, entering,
and revising 3D worlds with the user's own coding agent. The conversation,
references, world bible, and live scene share one project. A cozy, primitive
starting space provides a place to create; a persistent origin can be hidden
and summoned after the surrounding world takes shape.

This specifies a separate package and repository. The package
name `@instruktlabs/holodeck` and command examples below are proposals, not
published interfaces. A compatibility lab, image studies and a walkable prototype
with mocked agent responses now exist. The researched
[local-agent and live-world proposal](local-agent-world-authoring.md) defines
the next implementation slice and current subscription integration options.

## Product boundaries

- The user installs and runs Holodeck locally, opens a browser, and connects a
  compatible agent in a chosen writable folder. No operator-hosted service is required.
- Agent inference may use the user's provider. Local operation does not imply
  offline inference or that provider requests stay on the device.
- Holodeck supplies scene-authoring skills, project scaffolding, a browser
  runtime, agent adapters, and observation tools. The agent drives the work.
- Kiln is the asset-authoring dependency on the local Node side. Browser code
  uses supported browser contracts and delivered assets, not Kiln's Node root SDK.
- Imported GLBs and existing references remain useful without an active agent.
- Runtime constraints enforce what can load. Skill instructions explain how to
  build within those constraints; prose alone is not enforcement.
- Desktop is the first complete experience. XR uses the same world and action
  model, with device-specific presentation and input added after qualification.

## The creation experience

1. Start in the chosen shelter with the origin stone and a quiet conversation entry.
2. Describe a world by text or voice. Import or generate reference candidates.
3. Compare images, point at details, and agree on appearance and reality rules.
4. Capture decisions in the world bible, with exact reference revisions.
5. Preview a rough layout, walk through it, and adjust scale and interaction.
6. Replace rough forms with authored assets as completed revisions arrive.
7. Inspect visual and runtime feedback, then revise in place.
8. Hide the starter space and authoring surfaces; summon them when needed.
9. Save and reopen the world, references, decisions, and conversation linkage.

Routine reversible edits within agreed rules can apply automatically. A proposed
change to an agreed rule is shown as a decision to accept, revise, or discard.
Discussing a possibility does not silently make it an accepted world rule.

## Package and project ownership

Keep the initial release as one installable package with internal boundaries,
rather than publishing a collection of small packages prematurely:

| Boundary | Responsibility |
| --- | --- |
| Local host and CLI | Serve browser assets, manage project files, supervise agent connection |
| Browser runtime | R3F scene, loading, interaction, collision, resource lifecycle |
| Contracts | Versioned world, reference, bible, action, event, and capability schemas |
| Agent adapters | Conversation transport, permissions, cancellation, resume |
| Skills and templates | Scene workflow, feedback loop, initial writable project |
| UI | Shared commands and state, desktop surfaces, spatial surfaces |

Proposed developer flow: install the package, run `holodeck init <folder>`, then
`holodeck dev <folder>`. Scaffolding creates user-owned files outside the installed
package. Reinitializing must preserve user customizations and show migration diffs.

```text
my-world/
  holodeck.json             # schema version, capabilities, provider choices, budgets
  AGENTS.md                # project guidance and installed skill references
  world/scene.json         # authoritative scene document
  world/bible.json         # authoritative structured decisions and prose fields
  world/bible.md           # generated readable view of bible.json
  references/manifest.json # stable IDs, revisions, sources, annotations
  references/files/        # local immutable reference revisions
  assets/                  # editable source and pinned runtime deliveries
  behaviors/               # project-local behavior modules
  extensions/              # explicitly enabled project extensions
  reviews/                 # captures and measurements tied to scene revisions
  .holodeck/               # local sessions, pending changes, cache; credentials excluded
```

The UI and agent write the same structured contracts through validated updates.
The Markdown bible is derived, avoiding two competing sources of truth. Direct
file edits are watched and validated; partially written files never become live state.

## Local agent connection

```text
Browser text, voice transcript, selection, approvals
                     |
              local host / session broker
                     |
             agent adapter (Codex first)
                     |
        agent session in the project folder
                     |
          Holodeck scene tools + Kiln tools
                     |
       staged project changes and scene feedback
                     |
              live browser runtime
```

Conversation transport and tool transport are distinct. MCP provides scene
inspection and authoring tools; it does not itself deliver browser chat to an agent.

The first Codex adapter uses app-server over stdio behind the local host. Support
initialization, starting/resuming a thread, streaming output, interruption, and
permission requests. Preserve a project-to-thread mapping. The browser displays
real agent permission requests and cannot auto-approve them. These operations are
documented in [Codex app-server](https://learn.chatgpt.com/docs/app-server).

For the local prototype, use the user's supported Codex login. For distribution,
evaluate the documented [Sign in with ChatGPT integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).
Do not extract login tokens from Codex credential files. App-server's documented
authentication allowance for local/open-source applications is not authorization
for commercial or hosted services; revisit the applicable route before either.

Adapters expose capabilities such as image input, streaming, approvals, resume,
and cancellation. Additional agents require independent compatibility and terms
review; subprocess availability alone does not establish supported integration.

Bind the host to loopback, validate browser origins, authenticate its session,
and restrict file serving to the selected workspace with canonical-path checks.
Workspace selection is not an OS sandbox: use the agent's real permission controls.
Treat imported references as data, not authority to change agent instructions.

## Text, voice, and image capabilities

Text and voice submit to the same conversation. Push-to-talk shows recording
state, creates an editable transcript, and sends that transcript when the user
submits. Capture the selected object and reference context at submission.

The prototype requires one functioning local transcription adapter. Choose its
implementation during the initial compatibility evaluation. Missing capability
must be visible; text continues to work. Full duplex speech and spoken replies
are later capabilities, not implied by text streaming.

Image generation is an optional provider adapter with progress, cancellation,
output provenance, and a completed-file import contract. Existing mockups can
arrive through the watched reference folder, including outputs created in the
Codex app. That workflow does not require Holodeck to control the Codex desktop UI.

The current ChatGPT plan-usage integration excludes hosted image generation and
audio/transcription inputs. Provider capabilities and any separate billing must
be explicit; subscription text access does not supply those capabilities.
See [OpenAI preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## Live references and the world bible

Each reference has a stable ID, immutable revision/hash, local media path, source
or attribution, type (concept, source reference, runtime capture), annotations,
and links to affected decisions or objects. Thumbnails load first; full images
load on demand. Changes appear without a browser refresh. Broken files retain
the last valid revision and show an actionable error.

Pinning an accepted reference preserves its exact revision even when a newer
candidate arrives. Crops and annotations identify what matters: lighting, shape,
palette, composition, construction, or behavior. Generated imagery is visual
direction, not proof of geometry, collision, or feasible performance.

The bible contains:

| Section | Examples |
| --- | --- |
| Intent | Mood, purpose, what the visitor should experience |
| Appearance | Palette, silhouettes, materials, lighting, density, interface style |
| Reality rules | Scale, gravity, traversal, collisions, interactions, time/weather |
| Runtime envelope | Device tier, renderer, resident resources, loading and extension limits |
| Decisions | Proposed/accepted/superseded state, rationale, reference revision, author |
| Evidence | Actual camera captures, traversal checks, budget measurements, unresolved issues |

Give machine-enforceable rules explicit fields and checks. Keep qualitative rules
as review criteria. Never report a visual preference as a passing automated test.

For each agent turn, assemble a bounded context packet: scene/bible revisions,
selected IDs, relevant reference revisions, camera pose, requested screenshot,
and recent diagnostics. Send only relevant images within provider limits, not
every reference or a continuous screen recording. Report when observations have
become stale before applying dependent changes.

## Scene authority and real-time updates

Use a versioned scene document with stable object IDs, pinned asset revisions,
transforms, terrain, lighting, collider references, behavior bindings, and budgets.
Evaluate reuse of Kiln's existing world contracts before introducing a forked
format. Their static-explore capabilities do not imply a general simulation engine.

All writes carry a base revision and operation ID. The host serializes commits;
stale edits return a conflict instead of overwriting direct user manipulation.
Undo produces a new revision. Conversation completion and scene acceptance are
separate events.

Changes follow `proposed -> preparing -> validated -> applied` or
`rejected/cancelled`. Preparation loads, decodes, validates bounds and colliders,
and warms required GPU resources while the previous scene remains usable. Apply
a coherent revision at a safe boundary, then release replaced resources.

Small placement and lighting edits can preview immediately. Asset generation is
asynchronous. Show meaningful preparation state and optional rough proxies; never
present incomplete streamed files as finished assets. Cancellation discards staged
work without deleting the active revision. Failed updates preserve the active world.

Keep the persistent origin, starter-space presentation, and authored world
independent. Hiding the starter removes its colliders, lights, sound, and interaction
targets as well as geometry. Restore only at a safe placement; preserve an always
available return command. XR tracking origin is separate from the saved world origin.

## Scene feedback and extensibility

Proposed tool groups cover scene inspection, references, bible proposals, staged
patches, captures, runtime measurements, and revision history. Define their schemas
once and share them across UI commands and agent tools. Tools return scene revision,
camera/backend identity, and structured errors alongside evidence.

The authoring skill guides: understand intent -> gather references -> agree rules
-> lay out rough forms -> author assets -> inspect in scene -> measure -> revise.
Bound automatic repair attempts and surface unresolved failures.

Track geometry, draws, resident texture/geometry estimates, loading time, frame
timing, and resource disposal separately. Measurements identify device, viewport,
backend, and scene revision. Browser memory estimates are not complete GPU telemetry.
Use instancing, shared materials, LOD, and culling where the measured scene benefits.

Future behavior extensions declare identity/version, dependencies, capabilities,
serialization, and lifecycle hooks for loading, ticking, inspection, and disposal.
Project code is trusted executable code once enabled. Do not imply that a manifest
sandboxes arbitrary JavaScript. The prototype uses a small built-in behavior set.

## Zen interface

The default view gives the world most of the screen. Use warm ivory, charcoal,
stone, a restrained amber accent, generous spacing, and quiet motion. Digital
character comes from precise alignment, gentle state changes, and unfinished
construction cues around the origin. Avoid decorating every object with emissive UI.

| Component | Interaction |
| --- | --- |
| Origin stone | Summon or dismiss authoring surfaces; return to safe start |
| Conversation surface | Text, push-to-talk, transcript, agent status, stop action |
| Reference board | Compare, pin, annotate, and associate images with scene objects |
| Context card | Inspect selection; place, rotate, revise, or undo |
| World journal | Read and resolve bible decisions and runtime issues |
| Progress indicator | Listening, agent working, preparing scene, or action needed |

Mouse, keyboard, touch, voice, and eventual XR invoke shared semantic commands.
Desktop retains native DOM text editing, focus behavior, copy/paste, and accessible
controls. Spatial surfaces represent the same state with suitable depth and size.
Support keyboard access, reduced motion, visible focus, and sufficient contrast.
Panels stay anchored intentionally and do not continually chase the user's head.

### Glyph evaluation

[Glyph](https://github.com/pmndrs/glyph) is a typography engine, not a complete UI
system. Its README documents font baking, shaping, layout, batching, R3F integration,
and WebGPU/WebGL2 support through `WebGPURenderer`; classic `WebGLRenderer` is
unsupported. It is prerelease and MIT licensed.

Evaluate Glyph for labels, reference captions, and spatial journal text behind a
replaceable text component. Prefer pre-baked fonts and the documented TSL route.
Check dynamic text, clipping, disposal, readability, and both renderer backends.
Text input, accessibility, and UI layout remain separate responsibilities. UIKit
composition and XR rendering need integration proof, not an assumed drop-in fit.

Use [UIKit](https://pmndrs.github.io/uikit/docs/getting-started/introduction) and
[React Three XR](https://pmndrs.github.io/xr/docs/getting-started/introduction) as
candidate spatial UI and input layers. Pin one qualified dependency matrix;
do not make automatic adoption of latest releases a runtime feature.

## Prototype and later work

The bounded scope, milestones, and acceptance checks are in the
[first prototype plan](first-prototype.md).

Later work includes the other starter presets, full XR authoring, continuous
speech, integrated image-generation providers, richer physics and behaviors,
large-world streaming, more agent adapters, and collaboration. These capabilities
must not expand the first prototype implicitly.

## Design lineage and evidence

Public guidance captures general requirements for spatial composition, semantic
identity, runtime ownership and destination verification. Private research and
source mappings are maintained outside this repository. Public examples are
independent Holodeck fixtures. See [architecture](architecture.md) and
[distribution](distribution.md).
