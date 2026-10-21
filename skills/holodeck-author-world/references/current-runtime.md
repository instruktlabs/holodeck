# Current prototype boundary

Checked against Holodeck source on 2026-10-21. Inspect schemaVersion first.
Existing v1 worlds remain unchanged; newly scaffolded examples use v2.

`world_check` supplies an advisory report with observation freshness and bounded
spatial probes where supported. It does not block or accept edits. Optional
routesJson contains up to eight {id,from:[x,y,z],to:[x,y,z]} routes. The terrain
driver samples supported feet, slope and water; only the legacy ground-plane
driver requires eye Y=1.72. `world_sample` reads up to64 accepted-world support
points with terrain height/normal/slope, water height/depth and blockers. Findings
describe samples and uncertainty, not a verdict on the intended world.

## Version 2 example worlds

Read scene.runtime for enabled, versioned built-ins. Available modules are
collision.boxes@1, camera.walk-orbit@1, interaction.hinge@1 and motion.spin@1.
Optional terrain.heightfield@1, water.ocean@1 and inhabitant.maker@1 add terrain,
ocean and first/third-person possession. Use `world_read.capabilities.spatial`
for the live host's full strict fields, valid examples, defaults and limits. This
response reaches existing workspaces even when their copied skills are older.
Each optional module requires its matching scene.terrain, scene.water or
runtime.possession record, and each record requires the module. Keep version1
runtime and existing dependency/behavior modules. Do not invent a biome or noise
record or place landscape records inside objects.
The module registry rejects unknown modules and missing dependencies.
Camera spawn/look/overview/target, bounds and origin blockers are authored data.
Placements can use an asset OR shape {type:box|cylinder|sphere|torus|tree,size,color,offset}.
Optional shape.surface is stone, wood, soil or water. Tree rendering groups trunk
and atlas canopy under one entity; wind and water shading do not supply physics.
Planting footprints, wall connections and collision still require authored data.
Optional behavior is {type:hinge,angle,speed} or {type:spin,speed}; it requires the
corresponding enabled module. Hinge needs a collider. Speeds are radians/second,
greater than zero and at most four. Colliders and moving modules support yaw only.
Optional motion.patrol@1 adds bounded terrain-following waypoint motion for up
to16 entities. Its behavior is {type:patrol,path:[[x,z],...],speed,waitSeconds,
waterPolicy:avoid|wade,heightOffset?,radius?,height?}. Paths have2..16 world-space
points, speed is >0..4 metres/second, wait is0..30 seconds. It starts from authored
position, loops waypoints, pauses at arrivals, and stops/retries blocked movement.
Local +X is forward; authored yaw can correct an asset's orientation. E starts or
stops the behavior. Use world_read for exact bounds/defaults. This supplies no
detour search, skeletal animation or general AI; shape type remains independently
authored. Place roots with the terrain support offset and test the actual route.
Optional motion.gait@1 adds explicit named-joint rotations to imported patrol
assets through behavior.gait={stride,channels:[{node,axis,amplitude,phase}]}. Use
world_read for exact limits and a complete independent example. Joint groups need
local pivots and attached child geometry; limbs merged by material cannot animate
independently. Keep semantic node names unique through GLB export. Phase follows
actual travel, blocked/waiting motion settles, and pause/hidden origin freeze it.
Missing, ambiguous or root targets disable the rig and report activity.gaitDiagnostics.
This supplies no skinning, IK, root motion or collider deformation. Inspect actual
motion rather than treating valid bindings as an animation quality verdict.
Optional motion.boids@1 adds a deterministic airborne flock to one imported
placement: behavior={type:flock,count,bounds:[xmin,xmax,ymin,ymax,zmin,zmax],speed,
neighborRadius,separationRadius,terrainClearance,seed,gait?}. All except gait are
required. Count1..48 per flock, maximum96 scene birds; bounds are world coordinates
for bird roots, not a placement-relative box. Use world_read for exact limits and
an example. Each bird faces +X and can use the same named wing-joint gait with
motion.gait@1; motion.patrol@1 is not required. Source assets support at most32
ordinary single-material mesh primitives, without skinning or nested instancing.
Mesh parts instance across birds; every bird still counts toward triangle budgets.
Provide wingspan and body margins inside the flight bounds and above terrain.
Separation, alignment and cohesion do not supply obstacle avoidance or pathfinding;
flock placements have collider:null. Incompatible terrain and node-binding issues
are advisory diagnostics in activity state. Verify actual motion on both backends.

Explicit asset.foliage supports named leaf meshes for backlighting and bounded
wind, only on ordinary imported placements. See world_read for its strict record.
Target exact unique single-primitive lit meshes and author continuous UV.y from0
at each blade attachment to1 at its tip. Do not infer foliage from names or change
trunks. This shading does not repair thin silhouettes or replace authored geometry.
The board has a local collider {size,offset} following its placement.

Stable IDs preserve transient activity across appearance and placement changes.
Changing behavior configuration resets its state; removal drops it. Pause/reset
does not save a revision. Legacy movement is ground-plane walking. The optional
maker follows shared terrain triangles, wades and swims with the shared water
clock; first and third person use the same actor feet anchor. Overview is an
observation camera. There is no rigid-body solver or moving-body push response.
Runtime proposals use the same world tools and revision checks as v1.
Use only construct/meadow environments in v2; the legacy woodland crossing is v1.
Do not add third-party module code or imply generic plugin support.

The user interacts with E and selects authoring references with click/F (Shift
adds). A turn may include up to sixteen selectedRefs with whole-entity or supported
part scopes. Treat this as conversation context, not an applied edit. The host
resolves accepted placements, colliders, behaviors and asset revisions at send time.
Tree parts are trunk/canopy; arbitrary imported GLB parts are not yet supported.
Use world_read to inspect the current document before proposing changes.

Terrain uses a finite heightfield of at most256x256 cells and up to32 ordered
elliptical add/flatten stamps; it cannot supply caves or overhangs. Ocean has up
to4 directional waves with bounded amplitude, wavelength and speed. Terrain,
water and sky remain present when the origin layer is hidden. Use world_sample
before positioning roots, entries and waterline details; object Y remains an
authored pivot and must include the asset's measured support offset. Sampling
reads accepted content only. After applying a proposal, check the loaded revision,
walk intended slopes and shoreline transitions, switch camera views and inspect
both WebGPU and forced WebGL2. Shader detail and foam do not supply physics.

## Version 1 and common persistence

- Persistence: `world/world.json`, schema version 1, monotonically advancing
  revisions; scene, bible and references form one coherent change.
- World tools: `world_read`, `world_observe`, `world_check`, `world_sample`, `world_propose`, `reference_read`,
  `reference_link`, `reference_import`. Use the live tool schemas for arguments.
- Scene: construct/meadow/woodland environment presets; static GLB assets;
  stable placement IDs and position/rotation/scale; origin/world layers; optional
  box or compound blockers and local lights; a supported movable mood-board frame.
- Movement: fixed first-person prototype, simple horizontal blocking. General
  rigid-body physics, swappable controllers/cameras, animated imported characters,
  arbitrary behavior modules and XR are not implemented.
- Imports: self-contained static GLBs under `assets/imports`, editable source under
  `assets/source`. Preserve source/revision provenance and supported extensions.
  Current admission caps include 32 MiB per asset, 128 MiB asset files per world,
  64 assets, 1200 placements and two million placed source triangles (including
  every bird in a flock). Repeated compatible opaque static GLBs are rendered
  through instanced batches while keeping placement IDs and collision data.
  Instancing reduces draw calls, not triangles or shader cost. These are
  admission limits, not performance guarantees or targets for every world.
- Bible: title, intent, rules, optional pinned reference IDs. Rules are text;
  writing a physics rule does not activate an implementation.
- References: image, note or file cards; groups, notes, direction, page and layout;
  immutable imported file snapshots. Text/image content is read on demand.
- Runtime observations report the displayed revision and browser measurements.
  No general automated gameplay-probe tool is installed yet.

The host validates before persistence and retains accepted assets when a watched
candidate fails. The browser loads candidate GLBs before adopting the bundle.
GPU pipeline prewarming is not guaranteed. Cove shell collision still has a
hard-coded portion. Do not describe this prototype as a fully data-defined engine.
