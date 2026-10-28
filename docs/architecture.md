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
box collision, hinge and spin interactions, heightfield and heightmap terrain and ocean, maker
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
supports yaw and scale; pitch/roll collision is rejected. New worlds and bundled
examples walk as the maker; a world without possession falls back to the legacy
fixed-height ground-plane walk. Optional terrain (heightfield or heightmap), ocean and maker possession share terrain
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

Current render readiness is separate from loaded-world/frame identity. After each
completed scene-and-bloom render, three consecutive frames with no pending shader
links mark the view settled. New links clear that state. Static-player status and
diagnostics expose the state and pending count; applying a diagnostic camera resets
settling, and compilation during a recording invalidates that evidence. This does
not prewarm unseen views or certify visual completeness or performance. A later
settled recording can retry; the prior failed result retains its raw evidence.

## Asset budget

A schema-v2 scene admits `MAX_ASSETS` (128) unique assets, set in
`src/world/asset-budget.mjs`; schema-v1 scenes keep 64. The earlier 64 had no
measured basis. These are hub browser results (GTX 1660 Ti Max-Q laptop GPU,
driver 615.78.08, headed Chrome through Playwright, 1600×900, nice 10), not PC,
Windows or Unity results.

**Harness.** Synthetic schema-v2 worlds on the starter cove: N unique assets in
total (N−8 small GLBs of 1–3 mesh parts, each part its own material, about
1,000 triangles), always 639 extra placements (646 in all) and about 630k placed
synthetic triangles, so asset count is the variable. The camera orbits the
whole field (radius 62 m, height 22 m) for 20 s after a 10 s warm-up orbit, so
nearly every asset is in view. This is the worst case for draws: no two assets
share a material, and most pieces are placed once, so nothing merges. Medians of
two runs; frame times are rAF intervals, paced by the 120 Hz display unless
uncapped (`--disable-gpu-vsync --disable-frame-rate-limit`).

| N | Draws | WebGL2 p95 | WebGL2 p95 uncapped | WebGPU p95 | Ready, WebGL2 | `world_read`, all pages |
|---:|---:|---:|---:|---:|---:|---:|
| 64 | 305 | 16.7 ms | 12.4 ms | 12.6 ms | 7.0 s | 119 KB |
| 128 | 563 | 25.0 ms | 19.6 ms | 24.9 ms | 9.8 s | 138 KB |
| 256 | 1,073 | 41.8 ms | 44.4 ms | 41.6 ms | 15.7 s | 172 KB |
| 512 | 1,527 | 83.2 ms | 82.2 ms | 75.0 ms | 11.5 s | 247 KB |

- Frame time follows draws: about 20–30 µs per draw on WebGL2 here. The same
  series at about 430 triangles per asset gives about the same p95 (16.6,
  25.0, 50.0 and 95.8 ms), so draw submission, not triangles, dominates.
- Planar water and a 120 m sun shadow raise the draws by half to double (469
  at N=64, 2,973 at N=512); WebGL2 p95 is then 25 ms at 64 and 150 ms at 512.
- The same 512 pieces in one shared palette of three materials draw 996 times,
  not 1,527, and their uncapped WebGL2 p95 falls from 82 to 31 ms. They do not
  bake into one mesh: static merging covers only assets placed more than once.
- JS heap stayed between 110 and 510 MiB and GPU memory at 334–402 MiB at every
  N. Load time grew with N but not monotonically.
- Bundled examples on the same path family: Crescent Cove (49 assets, 154
  draws) p95 8.4 ms; Winter Mountainside Cabin (56, 313) 16.7 ms; Meridian
  Sanctuary (53, about 300) 33 ms, where effects rather than draws bind.

**Rule.** Strictly, no N above 64 keeps this worst case inside the 64-asset
WebGL2 budget (p95 16.7 ms, every other 120 Hz frame): 128 adds one refresh
interval. Real modular content is not that worst case: a 70-asset modular world
with shared kit materials and repeats measured 16.7 ms WebGL2 p95 at 650 draws
on the same hub. The cap is therefore the largest N whose worst case stays at
or under 33.3 ms WebGL2 p95 (30 fps, twice the 64-asset budget) at both
triangle loads. That is 128; 256 misses it at 42–50 ms.

The asset cap does not bound frame time on its own. A world under it can still
draw thousands of times through parts, behaviours, water and shadows, so check
`world_observe` draws and frame p95 after large edits. At 128 assets the
`world_read` overview can outgrow its 24,000-character page; it then keeps the
most-placed asset groups and reports the rest in `objectsByAssetOmitted`.

## Terrain sources

`scene.terrain` has two sources over one lattice: a `heightfield` (a base height
and elliptical stamps) and a `heightmap` (sampled heights from a pinned
little-endian float32 `.r32` file, named in the record by its SHA-256). Both
take the same ordered stamps and appearance, and both require
`terrain.heightfield@1`. `createTerrain` in `src/world/terrain.mjs` builds one
Float32 lattice from either source, and the renderer, walker, aim, scatter,
floor clearance, terrain layers, surf, ocean depth and the `world_sample` and
`world_check` probes all read it. A heightmap's default lattice puts one vertex on
each sample, so the drawn vertices are the samples; an explicit `segments`
resamples them, and every consumer still reads that same resampled lattice. The
runtime's terrain signature includes the height hash, so new samples rebuild the
terrain while an appearance-only edit does not.

Samples live in a registry keyed by SHA-256, and `createTerrain` refuses a
heightmap whose samples are not loaded. Each reader loads and verifies them
before it validates a world, because counting scatter placements builds the
terrain. On the Node side that is the world store (accepted world and every
proposal), history listing, restore and remix, static export, example bundles,
and `holodeck check` and `launch`. In the browser it is the asset bundle loader
and the static viewer, which fetch the pinned bytes by hash and check them where
the page can compute SHA-256. The accepted world, a staged proposal and a loaded
browser bundle retain their samples; up to eight other sample sets stay cached.
The host pins the file as `.holodeck/blobs/<sha256>.r32`, counts it in the
128 MiB world budget, records it in the revision receipt's `height` entry and
serves it at `/api/heights/<sha256>.r32`. Writing over the pinned file never
changes an accepted revision. See
[terrain and inhabitants](terrain-and-inhabitants.md#heightmap) for the record.

**Cost.** A heightmap's default lattice can carry sixteen times the triangles of
the largest heightfield: 2,097,152 against 131,072. These are hub browser results
(GTX 1660 Ti Max-Q laptop GPU, driver 615.78.08, headed Chrome through
Playwright, 1600×900, nice 10, uncapped frame rate), not PC, Windows or Unity
results. Terrain triangles cost far less than draws. A 690-draw modular world
measured the same p95 with a 43,500-triangle stamped heightfield, a
524,288-triangle heightmap and that heightmap resampled to 131,072 triangles
(WebGPU 11.2–11.8 ms, WebGL2 10.0–10.4 ms). On a 94-draw world the largest
lattice left WebGPU p95 unchanged; on WebGL2 it added about 2 ms at p95, and at
least 1% of frames took over 70 ms. Building the lattice is main-thread CPU work,
done once per change of shape: 0.11–0.14 s and 52 MiB of buffers at
1024 × 1024 in Node on a desktop CPU. Walker support matched the drawn triangles
within 7.1 × 10⁻¹⁵ m in every run. [Choosing segments](terrain-and-inhabitants.md#choosing-segments)
has the table, the resampling error and the guidance.

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
Core skills are installed in every world. Optional skills, listed only in
`src/world/optional-skills.mjs`, install in a schema v2 world whose
`scene.destinations` names their destination (`unity` installs
`holodeck-export-unity`); an unknown destination fails validation. The host
syncs them when a world is created, on each agent connection and when an accepted
revision changes the list, and removes a skill whose destination was dropped; the
Claude Code session plugin leaves out undeclared ones. Destinations change no
scene, runtime or static export behavior. The Unity skill describes a
project-owned adapter; Holodeck ships no Unity exporter.

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
