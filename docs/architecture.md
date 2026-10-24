# Data-driven worlds

Holodeck owns world composition, activity, inspection and live revision adoption.
Kiln provides asset authoring and saved revisions. The initial browser uses R3F
and Three; no ECS framework is required. The [integration boundary](integration-boundary.md)
records ownership, the pinned dependency and the versioned asset delivery profile.

## Presentation

React owns the application state and editor components. React Three Fiber renders
the Three.js world through WebGPU with a WebGL2 fallback. The world picker, the
bottom dock and the sheets it opens (conversation, bible, mood board, world,
observations, history, agent and proposal review) are React HTML/CSS over the
viewport; this supports normal text editing, focus, scrolling and file inputs.
Sheet visibility does not own selection, draft text or running activity. The physical
mood board in the world uses a canvas texture. These are complementary parts of
the same React application, not alternatives to R3F.

World-space interaction for XR would need a presentation layer over the same
world and conversation state. It is not implemented by the current editor.

## Persistent authoring and transient activity

The world document records the bible, references, stable entity IDs, placements,
asset revisions and enabled capabilities. Running activity owns movement, phase
and camera possession. Saving layout and resetting activity are separate actions.
Simulation checkpoints are not implemented.

Existing schema v1 worlds remain supported without automatic migration. New
examples use schema v2 and scene.runtime.version 1. Shape blockouts and pinned
Kiln GLBs share the placement model. The capability registry covers camera and
box collision, hinge and spin interactions, heightfields and ocean, maker
possession, patrols, articulated gait, airborne boid flocks and seeded scatter.
Terrain texture layers, surf and the gradient sky are optional fields of the
terrain, water and environment records. Optional schema-v2 hemisphere fill and
exposure use one shared renderer path for live revision adoption and static
exports; omitted values preserve the existing appearance. Dependencies and
bounded records are validated before accepting a revision. See
[terrain and inhabitants](terrain-and-inhabitants.md),
[gait](articulated-gait.md) and [flocks](flock-behavior.md).

Hinge and spin own transient yaw. State survives appearance and placement edits
to the same ID. Changing behavior configuration resets that entity; removal drops
its state. Reset activity does not save a world revision. Example kinds live in
data; runtime code never dispatches on a courtyard or exhibit identifier.

Use readable records for authoring. Introduce typed arrays, indexes and instancing
at measured hot paths while preserving semantic identity and source mappings.

## Spatial agreement and ownership

Define routes, destinations, support, clearance and sightlines before decoration.
Rendering, collision and interaction share placement frames. The current box query
supports yaw and scale; pitch/roll collision is rejected. Legacy walking uses a fixed-height
ground plane. Optional heightfield, ocean and maker possession share terrain
triangles, water time and one actor support anchor across first/third person.
Collider boxes marked `walkable` add their tops to that support, so the walker and
patrols can cross a jetty deck or climb stair treads; walkable boxes are static and
yaw-only. See [terrain and inhabitants](terrain-and-inhabitants.md) for their strict records.
Gate motion rotates its collider. A hinge waits before its swept collider reaches
the player's body, in either direction, and continues when the player moves clear.
The maker or legacy walking body remains protected in free camera and overview.
Moving objects do not push actors or simulate rigid-body forces. Interaction is
limited to nearby objects in walk mode.

Origin visibility controls the cove meshes, lights, blockers and activity together.
New worlds carry shell blockers in data. The v1 demo retains its legacy collision.
One active controller owns the camera across inhabiting, free camera and overview.
First/third-person views share the maker's support anchor. Mode and focus changes
release input. Free camera and overview preserve the inhabitant's position and do
not pause activity.

The demonstration activity clock runs at 60 Hz, admits at most six catch-up ticks,
and records excess elapsed time. Future modules declare their own clock, authority,
overload, state-transfer and cleanup policies. Count expensive nested operations,
not only outer jobs. Visibility and simulation relevance are different decisions.

## Rendering and culling

Compatible static imported placements, including expanded scatter instances,
share source geometry and materials. Large
asset/layer groups are partitioned into 96-metre X/Z cells; compact groups remain
together. Three culls each resulting mesh against the main and shadow cameras,
using actual source bounds plus foliage motion margins. Selection IDs and
collision continue to refer to the authored placements.

This reduces submitted instances when distant chunks leave a frustum, at the cost
of more draw calls when many chunks are visible. It does not simplify geometry.
There is no distance LOD, automatic source-GLB LOD selection, per-instance GPU
culling or occlusion culling. Terrain and ocean remain whole meshes; each flock
has a bound covering its authored flight volume. Performance claims need a
specific scene, viewpoint and renderer measurement.

## Local world activation

One local host activates one saved world at a time. Each activation has an
immutable workspace root and a fresh identity token alongside its stable world
ID. Requests and observations from an old activation are rejected, even when
two worlds have the same revision number. Switching closes the previous idle
agent/store context, while saved files and each world's history stay separate.
Browser drafts must be resolved before switching; another tab's stale drafts
remain readable until explicitly discarded. See [the world library](world-library.md).

## Revision lifecycle

The host validates before saving and keeps accepted asset revisions. The browser
loads candidate bundles before adoption and releases unused resources. GPU
prewarming, general resource scheduling, external plugins, arbitrary physics, XR
and simulation-state rollback remain future work. A module manifest is not a sandbox.

User edits and agent proposals share revision checks. Before Apply, a pending
proposal's added or moved placements (up to 120) draw as translucent ghosts that
aiming and selection ignore; they are not loaded or saved. An adopted revision
loads where the user stands. Bible prose and references
express intent; unsupported rules do not execute. Observations identify the loaded
revision, camera and activity state. Saved data, successful interactions, visual
review and performance evidence are distinct results.

Public skills contain general principles and independently written requirements.
Private research is not a package input. See [distribution](distribution.md).

Agent connections remain product-specific sessions. Codex uses the installed
app-server with native login. Cursor uses the installed `agent acp` process
with `cursor_login`, and its permission, question and plan requests use the
same request cards in the dock. Claude Code runs the installed CLI once per turn
in print mode with its own subscription sign-in; a local MCP bridge supplies world
tools and routes its permission prompts to the same cards. Image generation stays on
Codex. Adapters follow the
[provider policy research](agent-provider-policy.md), declare their billing and
execution scope, and preserve provider approvals. Subscription credentials are not
a universal model-routing substrate.
