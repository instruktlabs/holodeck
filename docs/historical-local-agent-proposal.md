# Historical local-agent proposal

Pre-implementation research, not current product guidance. See [local agent authoring](local-agent-world-authoring.md).

## Earlier proposal retained for context

**Everything below is the earlier pre-implementation research.** Its statements
about what was connected then, provider/onboarding choices and future capabilities
are historical and may differ from the implementation described above. In
particular, its plan-token preview limitations must not be generalized to the
installed Codex managed-sign-in provider. Reverify onboarding before distribution.

Holodeck should own the playable scene and its loading rules. A connected coding
agent authors that scene within an explicit workspace and capability contract.
Kiln supplies reusable assets when the world needs them. The browser returns
observations so the agent can improve both the experience and its runtime cost.

## What exists today

| Capability | Current prototype | Next milestone |
| --- | --- | --- |
| Cove and movement | Saved Kiln GLB, first-person movement, simple blockers, hide/recall | Keep the origin layer independent of the authored world |
| Agent | Scripted intent matching and timed responses; no model | Local Codex app-server adapter and persistent thread |
| World | Hard-coded woodland and bridge components | Versioned scene document with stable object IDs |
| New asset loading | Manually export/copy a GLB and change its URL | Validated revision events, preloading and atomic replacement |
| World bible | Read-only session state, lost on refresh | Shared persistent document editable by the user and agent |
| Feedback | Developer browser probes and screenshots | Scoped observation tools and revision-bound measurements |
| Voice | Local Whisper transcription into editable text | Submit the same conversation turn as typed input |

Vite development reload is not a world revision pipeline. No model is selected
or routed today, and this Codex development chat is not connected to Holodeck.

## Codex and subscription use

Use a local Node host that supervises `codex app-server` over stdio. Holodeck is
a custom client of the Codex engine; it does not need to embed or automate the
desktop application. The protocol supplies initialization, threads, turns,
streaming events, approvals and cancellation. Preserve thread IDs across browser
reconnects. Use `turn/steer` for an active turn where supported and `turn/interrupt`
for Stop. Do not substitute a dropped browser connection for cancellation.
[Codex app-server documentation](https://learn.chatgpt.com/docs/app-server).

For a new distributed local/open-source package, prefer the documented **Sign in
with ChatGPT plan usage** route. It supports eligible Plus and Pro users, with
separate consent for plan usage; the docs distinguish open-source availability
from selected private clients and commercial trials. This repository is currently
private/unpublished, so onboarding eligibility remains to be verified, not assumed.
Persist one opaque host ID for the installation and perform the documented OAuth
flow. This does not import a user's ChatGPT conversations.
[Overview](https://developers.openai.com/siwc/token-sharing-open-source),
[eligibility and integration choices](https://developers.openai.com/siwc/quickstart).

The documented bridge passes Holodeck's authorized access token to its child
app-server process and configures the `openai_chatgpt_plan` Responses provider.
The local host owns token refresh and thread resumption after a process restart.
Keep credentials outside world files and browser state; never scrape Codex's
credential files. Discover model choices through `model/list`, record the selected
model and reasoning effort on the session, and show them in connection settings.
For this provider, the returned catalog is not proof of account entitlement;
actual authorized inference must complete successfully before reporting a working
connection. No particular model name is hard-coded in this spec.
[App-server plan integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).

App-server also documents managed ChatGPT sign-in for existing local/open-source
integrations, while recommending migration to Sign in with ChatGPT. Its native
authentication is not a commercial/hosted-service route. Choose and document one
onboarding route before implementation rather than mixing their credential flows.
[Authentication guidance](https://learn.chatgpt.com/docs/app-server).

The plan-usage preview supports local shell, MCP and child-agent tool execution,
but does not supply hosted image generation, audio/transcription or hosted
connectors. Retain local speech-to-text. Import generated mockups as references,
or add a separately configured image-generation capability later. Running inside
Codex's desktop app does not make all its tools available to this custom client.
[Current preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

The browser talks only to Holodeck's authenticated loopback session. The host
checks origin and session authorization, translates events, and keeps process
credentials off the wire. Agent inference still uses the selected provider;
local world files do not imply a locally running language model.

## Scene first, assets within it

An **asset** is reusable authored content: editable source, a pinned artifact,
bounds, materials, anchors, collider hints and optional runtime derivatives.
A **scene** arranges those assets and defines terrain, atmosphere, lighting,
controllers, collisions, interaction and loading. An **environment replacement**
is a transaction replacing the world layer, not a special kind of large GLB.

The agent interprets the request using the current selection, bible and scene,
then declares the operation and affected IDs. Proposed operation types are
`createAsset`, `refineAsset`, `placeAsset`, `updateScene`, `loadEnvironment` and
`updateBible`. These names are contract proposals, not installed tools. Do not
guess asset versus environment from file size or filename. Ask a short question
when the scope is genuinely ambiguous.

For example, “put a footbridge across this stream” selects an existing asset or
creates one through Kiln, pins its revision, places it using scene anchors, and
adds compatible collision. “Make this a flooded valley” changes terrain, water,
placements, spawn rules and traversal constraints as one proposed scene revision.

World documents contain stable IDs and typed components, not arbitrary executable
JavaScript. A capability registry defines supported terrain, controller, physics,
lighting and behavior components. Extensions can add capabilities explicitly;
unknown capabilities produce a useful validation error. Later custom behavior
modules need an explicit trusted-code boundary, rather than automatic execution
of whatever source appears in an asset folder.

Keep `origin`, `construct` and `world` layers independent. After an environment is
ready, replace the construct visually while retaining the summonable origin.
Hiding the cove removes its geometry, lights, blockers and placards together.
Preserve the user's camera and selection across ordinary edits. If a world change
makes their position invalid, find a validated nearby spawn and explain the move.

## Workspace and edit authority

The user chooses a world folder separate from the installed Holodeck package and
Kiln engine. Proposed scaffold:

```text
my-world/
  AGENTS.md                    # Installed authoring guidance plus user rules
  holodeck.json                 # Capabilities, budgets and project settings
  world/scene.json              # Accepted composition and component state
  world/bible.json              # Authoritative decisions and editable prose
  world/bible.md                # Generated readable view, not a second authority
  references/manifest.json      # IDs, captions, file hashes and provenance
  references/files/
  assets/source/               # Editable asset sources and Kiln provenance
  assets/runtime/<hash>.glb     # Immutable, pinned runtime artifacts
  reviews/                     # Captures and diagnostics tied to revisions
  .holodeck/staging/<job-id>/   # Proposed changes and validation receipts
  .holodeck/session/           # Thread linkage and token-free local state
```

Agent `cwd` points here. Enforce access using app-server's workspace-write sandbox
and explicit writable roots; `cwd` alone is not a permission boundary. Surface
approval requests in the interface and pause the affected operation until answered.
Do not give routine world authoring write access to installed package code or the
Kiln engine. Check effective sandbox support on the user's OS before claiming that
restriction is enforced. References outside the project require explicit access.
[Sandbox and approval configuration](https://learn.chatgpt.com/docs/app-server).

The local host is the single commit authority for accepted world state. Agent
proposals carry an operation ID and base scene/bible revision. It validates them,
rejects stale writes and commits coherent revisions. Direct user file edits go
through the same validation path. Invalid edits leave the last valid scene live.

## Live references and world bible

Provide a readable document panel with editable prose and structured fields for
visual direction, scale, reality rules, traversal, interaction and performance.
Users can edit it directly or ask the agent to propose a change. Both paths use
the same document, revision history and undo mechanism. Draft ideas remain drafts;
accepted rules are distinguished from suggestions and superseded decisions.

An agent can request a rule change, but must show its consequences for the existing
world before adopting it. Record reference IDs and hashes with accepted decisions.
Watch reference additions and revisions, show thumbnails immediately after valid
import, and include only relevant references in agent context. A changed image is
a new revision, not a silent replacement of the image used to approve a design.

The normal conversation shows decision, reference, proposed-change, progress,
preview and result blocks. Detailed logs remain inspectable. Moving collapses
nonessential cards; selection and Stop remain reachable. Stream useful progress
without putting raw tool output across the user's view.

## Hot loading as a transaction

```text
Text or local transcription
  -> local host -> Codex thread -> authoring tools and Kiln workspace
  -> staged scene/asset proposal -> schema and capability validation
  -> runtime compilation -> revision event -> browser preload
  -> atomic scene + collider + interaction swap -> observation feedback
```

Watch completed manifests, not partially written GLBs. Debounce file events and
use atomic writes, content hashes and revision IDs. Preload and decode every new
dependency before replacing the accepted scene. Keep the old revision interactive
while loading. On failure, retain it and return actionable diagnostics. Reject
late results from canceled jobs and acknowledge the exact revision the browser
actually displays. Preview/apply/undo reuse the same transaction machinery.

Track resource ownership and release replaced geometries, materials and textures
after their last consumer disappears. Three.js does not automatically dispose of
these resources when objects leave the scene.
[Resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).

## Real-time optimization and feedback

Optimization belongs to both the agent's design decisions and a deterministic
runtime compiler. Keep canonical editable assets separate from generated runtime
derivatives, with a mapping back to source asset revisions and scene object IDs.

- Reuse geometry and materials. Instance repeated objects within spatial cells;
  batch compatible static geometry without losing picking IDs or useful culling.
  Instancing can reduce draw calls but does not remove triangle, shading or shadow
  cost. [Three.js instancing](https://threejs.org/docs/pages/InstancedMesh.html).
- Add measured LOD and texture tiers. Configure and test required meshopt/KTX2
  decoders before accepting those compressed formats; compression alone does not
  establish frame-time performance. Preserve anchors, collision and animation
  contracts when deriving simplified assets.
  [GLTFLoader support](https://threejs.org/docs/pages/GLTFLoader.html).
- Bound active cells, lights, shadow casters, collider complexity and texture
  residency. Unload unused resources. Avoid merging the entire world into one
  object, which prevents useful culling and localized editing.
- Return browser captures, selected-object context, collision failures, load and
  decode timings, frame-time percentiles, draw calls, triangles and resource counts.
  Label estimates as estimates and CPU timings as CPU timings. Include scene
  revision, backend, resolution, device and camera route in every receipt.
- Give the agent a bounded improvement loop: observe a named failure, propose a
  targeted change, remeasure the same route and retain or undo it. Cap retries and
  model spend. Never describe “optimized” as a property inferred from export alone.

A desktop 60 fps target is a proposed budget, not a passed acceptance gate. Set
per-device thresholds before measuring; qualify WebGPU and WebGL2 separately.
XR needs its own interaction and frame-time qualification later.

## First real vertical slice

1. **Persistent world without an agent.** Add versioned bible/reference/scene
   documents, a bible editor, manifest loading and transactional hot replacement.
   Prove direct file edits and undo before allowing an agent to drive them.
2. **One connected agent.** Implement local sign-in, explicit model selection,
   persistent/resumable threads, permissions and structured conversation blocks.
   Supply bounded world-reading, proposal and observation tools. A separate
   orchestrator/builder pair can follow once one agent completes this loop reliably.
3. **One complete experience.** Ask for a woodland, place an existing bridge, then
   refine or create a bridge through the separate Kiln workspace. Load its exact
   revision, apply collision, walk across it, receive runtime feedback, revise and
   undo. Hiding and recalling the cove continues to work throughout.

Acceptance includes invalid/missing assets, decoder failures, stale proposals,
permission denial, cancellation, browser reconnect and process restart. Failed
loads preserve the previous world. Repeated asset swaps must release resources
and show a stable post-warm-up memory trend. No camera reset on ordinary updates.
Scene and collision revisions must agree. Test the same route on both renderers.

This proposal deliberately leaves full XR, arbitrary executable behaviors,
multi-agent orchestration and image-generation providers for later milestones.
The existing prototype remains usable without connecting or spending agent usage.
