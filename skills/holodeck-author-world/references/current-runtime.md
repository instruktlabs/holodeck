# Current prototype boundary

Checked against Holodeck source on 2026-10-22. Inspect schemaVersion first.
Existing v1 worlds remain unchanged; newly scaffolded examples use v2.

## Facts to know before authoring

`world_read` returns the world in sections so no result exceeds an agent's tool
output limit. With no arguments it returns the overview: revision, scene
settings, objects grouped by asset with counts, scatter summaries and the bible.
Pass `section` (`objects`, optionally with `asset`; `scatters`, `assets`, `files`,
`references`, `capabilities`, `scene`, `bible`) and each page's `next` as
`cursor` until it is null. A design script that needs the whole scene reads
`world/world.json` in the world folder.

The `capabilities` section returns each of these; the key is in brackets
(`spatial.` keys are flattened, for example `spatial.foliage`).

- **Placement rotation** (`placements`): `rotation` is `[x,y,z]` in radians,
  applied in three.js Euler order XYZ. Kiln part rotation options are in
  degrees, so convert with `degrees*PI/180`.
- **Foliage wind** (`spatial.foliage`): `asset.foliage.nodes` binds exact glTF
  node names, each a single node carrying a single-primitive lit mesh. Kiln's
  `createPart(name)` names its mesh `Mesh_<name>`. Bind `Mesh_<name>`, or set
  the returned mesh's `.name` to the binding name in the program before saving.
  Wind also needs `TEXCOORD_0` with UV.y 0 at the attachment and 1 at the tip.
  Check the exported node names before proposing.
- **Terrain appearance** (`spatial.terrainAppearance`, `spatial.terrainRendering`):
  four colours, two grass heights, `rockSlope` and `textureScale` set the base
  blend. Its grain, patch contrast, wet band, roughness and seabed tint are
  fixed. Kiln materials and GLBs cannot reach the terrain.
- **Terrain layers** (`spatial.terrainLayers`): up to four
  `appearance.layers` draw PNG maps over the base: albedo, normal and optional
  roughness, all one square power-of-two size. Masks by height, slope, height
  above water, distance to placements or scatters (`near`), and a painted
  PNG. Textures a Kiln program saves arrive this way, as files under
  `assets/imports`. Use a litter or soil layer with a `near` mask for ground
  under a canopy.
- **Scatter** (`spatial.scatter`): `scene.scatters` records expand with a seed
  into placements inside a region polygon, with density, spacing, height,
  slope and water limits, keep-outs and jitter. Use them for groves,
  undergrowth, rocks and litter; list hero pieces as objects. Expanded
  instances count against the same budgets, and `world_check` reports each
  scatter's placed count.
- **Environment types** (`environmentTypes`): `type` only picks the ground when
  there is no terrain. `construct` is a gridded floor and `meadow` a soil plane.
  With terrain, both render the same terrain, ocean and analytic sky.
- **Lighting** (`spatial.lighting`): optional schema-v2 `environment.hemisphere`
  has `skyColor`, `groundColor` and `intensity` (0–8), defaulting to
  `#f1eee2`, `#95806d` and 1.8. It is global fill without shadows or indoor
  occlusion, independent of the visible sky. Optional `environment.exposure`
  (0.1–4, default 1.12) scales scene radiance before final ACES tone mapping,
  including the composed sky, emissions and bloom. Omitted settings keep the old appearance; accepted
  updates and static exports use the same values. Inspect both backends and
  indoor/outdoor materials before accepting a lighting change. These fields
  require an updated toolchain; bible prose alone does not apply them.
- **Water and sky** (`spatial.waterRendering`, `spatial.surf`, `spatial.sky`):
  water colour, shallow colour and foam width are the base look. Optional
  `water.surf` adds reef-break foam and beach swash over the terrain (visual
  only). Optional `environment.sky` gives a zenith/horizon gradient (the
  horizon defaults to `fogColor`), a sun disc and procedural clouds; without it
  the analytic sky has no clouds. Its `curve` is the exponent on elevation:
  lower is bluer overhead, higher carries the horizon haze further up. Placed
  objects under the water are tinted
  automatically like the seabed at their depth; do not bake underwater tint
  into GLB albedo. Only `water.bounds` holds water: below the level outside
  it, terrain and placements stay dry.
- **Sky light and cloud deck** (`spatial.sky`): optional `sky.light` captures
  the world from one probe point (default the spawn) into an environment map
  that lit materials reflect and are lit by, in place of the fixed hemisphere
  fill: mirrors, metal and polished stone then show the sky and the
  architecture around the probe. Author mirrors as metallic 1 with roughness
  near 0. Optional `sky.cloudSea` puts a sunlit deck of cloud below the
  horizon at a world height, so a world can float with nothing below; anything
  that dips below the deck fades into it. Billows are about 85 m times `scale`
  across: a deck just below the rim reads as a flat floor, while one 50–120 m
  down at scale 0.5–0.8 reads as a sea of cloud. `contrast` (0.5) sets how far
  the shaded sides of the billows fall from their sunlit crowns: toward 1 they
  keep only the cool sky light. `haze` (0.3) is the downward ray slope below
  which the deck dissolves into the horizon haze: lower keeps billows visible
  nearer the horizon. `cloudSea.model: "cumulus"` builds the deck from rounded lobes
  at three scales instead of noise billows that read as dunes, lights it
  through its own depth toward the sun, opens its gaps onto a darker, bluer
  layer below and hazes it with clear-air distance haze (`environment.aerial`
  when set), so it keeps its own colour almost to the horizon; `haze` then
  sets only the thin horizon band. `towers` (0–1) raises a few sparse taller
  domes that shadow and hide the deck behind them. Optional `asset.reflection:
  "sky"` makes floating mirrors reflect the sky dome alone rather than the
  probe's view of the world; `asset.reflection: {probe: [x, y, z]}` gives an
  asset a world capture of its own from a point in open air among its
  placements, so mirrors above the courts reflect the architecture.
  Optional `sky.cumulus {toward: [x, z], spread, height}` raises a bank of
  towering cumulus on part of the horizon, in front of the sky: a far
  destination for an axis or a gateway (20–30° fills a tall opening). A list
  of up to six banks stands towers on several parts of the horizon, such as
  a ring of cumulus heads rising from a cloud deck.
  Clouds of every layer are lit in `sky.cloudLight` (default `sunColor`): a
  whiter `cloudLight` keeps a golden sun on the stone and off the clouds.
  `sky.radiance: "sun"` lights the whole sky with the sun: the gradient,
  clouds, cumulus, cloud deck, sun disc and glow, the fog and haze and the
  water's sky take `sunIntensity / π` times their colours. A `#ffffff` sky is
  then as bright as white stone facing the sun and sunlit cloud tops a little
  brighter, so openings onto lit cloud can outshine the stone around them and
  bloom can fire; raising `sunIntensity` raises sky and stone together. The
  sky light's capture brightens with it, so lower `sky.light.intensity`. The
  default `"display"` draws the colours as they are, near a linear 1 however
  strong the sun.
- **Haze** (`lighting`): the fog is a smoothstep between `fogNear` and
  `fogFar`, not linear. From 0 to 1300 m it hazes about 1% at 80 m, 4% at
  165 m, 23% at 400 m, half at 650 m and 86% at 1 km, so it barely touches a
  court and nearly hides forms a kilometre out. Optional
  `environment.fogSky` (0–1, needs `environment.sky`) gives the haze the
  colour of the sky behind each surface instead of `fogColor`: a far form
  seen against the zenith fades toward blue, one at the horizon into the
  horizon haze and one below it into the cloud deck. 1 is the sky's colour;
  between, it mixes with `fogColor`.
  Optional `environment.aerial {visibility, base, falloff, blue, glow}`
  (needs `environment.sky`) replaces the smoothstep with clear-air haze that
  never reaches full opacity: light from a surface is attenuated per colour
  channel by `exp(-depth)` and the air adds its own light (`fogColor`, or the
  sky behind with `fogSky`) plus a glow toward the sun. `visibility` (metres)
  is the distance over which contrast falls to 2% in level air at `base`; the
  air thins by e every `falloff` metres above `base`. `blue` (0–1) makes blue
  scatter more than red, so distant shade lifts toward the blue air while lit
  faces stay warm. At visibility 20000 a level form 4 km out keeps about 45%
  of its contrast and one 1 km out about 82%, shading intact. `fogNear` and
  `fogFar` are ignored when `aerial` is set.
- **Grade** (`lighting`): optional `environment.grade` picks ACES (default),
  Neutral or AgX tone mapping and the exposure. Neutral keeps hue and
  saturation and lets sunlit white reach white; retune warm colours after
  switching.
  With Neutral, `grade.highlights` (0–3, default 0.15, the Khronos value)
  sets how strongly the curve desaturates what it compresses. At 0.15 warm
  sunlit stone keeps its hue all the way up and reaches L* 99 only near 38
  times its mid-tone input; at 1 it rolls to white near 8.6 times (L* 97
  near 3), with mid-tones unchanged.
- **Shadow reach** (`lighting`): sun shadows cover 24 m either side of the
  walker or view; optional `environment.shadow.extent` (12–120) widens the box
  for long axial views, with softer shadows and more casters. A placement with
  `castShadow: false` stays out of the shadow map: use it for floating or far
  pieces that should not shade the walkable court below them.
- **Probe grid** (`spatial.sky`): optional `sky.light.grid {min, max,
  spacing, bounces, intensity}` bakes a box of light probes over the courts
  after the sky light's captures, with bounces between surfaces. Lit surfaces
  inside it take their diffuse fill from the probes around them, so shade
  facing sunlit stone is lit warm and recesses darken; the sky light's capture
  then serves reflections only. Its `intensity` is relative to the sky
  light's: 1 fills shade as brightly as the capture did. At most 1200 probes (one every `spacing`
  metres); the bake runs a few probes a frame before the view counts as ready.
  Lower or drop `bounce` with a grid, since it adds to it.
- **Bounce light** (`spatial.sky`): optional `sky.light.bounce` adds unshadowed
  light rising from the ground in one colour, so shade on warm sunlit stone
  reads warm. Keep it modest (about 0.2–0.6).
- **Mirror water** (`spatial.waterRendering`): optional `water.reflection:
  "planar"` mirrors the world itself in the water plane at half resolution,
  so pools reflect the architecture crisply and in place. It roughly doubles
  the draws of every view that shows the water; use it where mirror water is
  the point.
- **Screen-space effects** (`lighting`): optional `environment.effects` adds
  `occlusion` (ambient occlusion: contact, creases and recesses darken; it
  turns on `temporalAA`), `temporalAA` (settles shimmering bevels, inlays and
  stair edges, slightly softer) and `sunShafts` (light shafts from the sun's
  shadow map; beyond the shadow box they veil distant architecture, so use a
  low intensity or none in long open views), and `bloom` tunes the glow every
  world has (a lower `threshold` lets sunlit marble glow). Check both renderer
  backends after enabling them.
- **Flowing water** (`spatial.flow`): optional `asset.flow` scrolls the maps of
  named mesh nodes along their UVs, for waterfalls, overflowing lips and
  streams. Author UV.v along the fall and a texture that tiles along it.
- **Proposal size** (`proposals`): the scene is always sent whole, capped at
  4 MiB. Inline `sceneJson` travels in one tool call, so your own output limit
  binds first. For more than a small change, write the complete scene to a JSON
  file under `assets/source` and pass `sceneFile`. Measure the staged proposal
  with `world_sample` and `world_check` using its `proposalId` before the user
  applies it.
- **Budget strategy** (`budgetStrategy`): the 64-asset cap usually binds first.
  Use two or three shaped variants per family, and vary placements by yaw,
  scale and lean. A scatter record does that variation for a whole family.
- **Kiln skills**: Holodeck owns terrain, water and scene composition. If Kiln's
  `kiln-compose-scene` skill is installed, do not use its terrain or scene
  composition for a Holodeck world. Keep Kiln's progress log at
  `assets/source/KILN_PROGRESS.md`, not at the world root.

`world_check` supplies an advisory report with observation freshness and bounded
spatial probes where supported. It does not block or accept edits. Optional
routesJson contains up to eight {id,from:[x,y,z],to:[x,y,z]} routes. The terrain
driver samples supported feet, slope and water; only the legacy ground-plane
driver requires eye Y=1.72. `world_sample` reads up to64 accepted-world support
points with terrain height/normal/slope, water height/depth and blockers. Its y is
an eye height: over a walkable deck, pass the deck top + 1.72 to stand on it or the
seabed + 1.72 to stand under it; `supportSource`, `supportId` and `levels` show
which you got. Pass a
staged `proposalId` to `world_sample` or `world_check` to measure the proposal
instead, before the user applies it. Findings describe samples and uncertainty,
not a verdict on the intended world.

## Version 2 example worlds

Read scene.runtime for enabled, versioned built-ins. Available modules are
collision.boxes@1, camera.walk-orbit@1, interaction.hinge@1 and motion.spin@1.
Optional terrain.heightfield@1, water.ocean@1 and inhabitant.maker@1 add terrain,
ocean and first/third-person possession. Use the `world_read` capabilities section (`spatial.*`)
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
A collider box with `walkable: true` (per box in a compound) also supports the
walker and patrols: a jetty deck, floor, bridge or stair tread. Put its top at the
walking surface and keep posts and rails as separate non-walkable boxes. They step
up at most 0.35m, treads 0.35m apart or less climb as stairs, the footprint grows
0.1m to bridge seams, and edges fall. Walkable boxes are refused with a behavior,
and scatter colliders are never walkable; the `world_read` capabilities text
(`spatial.colliders`) has the water and swimming rules. Do not fake a deck with
hidden terrain ramps.
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
reads accepted content unless you pass the staged proposalId. After applying a proposal, check the loaded revision,
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
  Each set of one asset (and one castShadow choice) is one draw per mesh part; a
  set of more than 32 placements spread beyond 96 m splits into 96 m cells only
  when it carries more than 200,000 triangles in all. Each draw is drawn again by
  the water mirror and the sun shadow, and costs the CPU far more than the GPU's
  extra vertex work, so fewer, larger sets are cheaper than many small ones.
  Static parts of different assets whose materials are identical (the same
  parameters and byte-identical texture images) bake into one mesh per material,
  one draw per pass for the whole kit, so a kit that reuses one saved material
  across its pieces draws far less than one with a variant per piece. Foliage,
  flow and reflection nodes, transparent materials and instance colours keep
  their own draws.
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
