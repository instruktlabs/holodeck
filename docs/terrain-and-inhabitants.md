# Terrain, ocean and possession

Schema 2 worlds can opt into a heightfield, a bounded ocean and the built-in maker
inhabitant. These are reusable runtime capabilities. The world agent authors their
records through `world_propose`; the user applies the proposal. Existing worlds
and installed workspace instructions are not rewritten. `world_read` returns the
current host's complete spatial contract and valid examples on every read.

## Enable the records

Keep `runtime.version: 1`. Add the matching module whenever its record is present,
and remove the module when removing that record. Preserve existing behavior modules.

| Record | Required module |
| --- | --- |
| `scene.terrain` | `terrain.heightfield@1` |
| `scene.water` | `water.ocean@1` |
| `scene.runtime.possession` | `inhabitant.maker@1` |
| `scene.scatters` | `scatter.seeded@1` (with `terrain.heightfield@1`) |

All v2 worlds retain `collision.boxes@1` and `camera.walk-orbit@1`. The maker also
depends on these modules. Terrain and water are separate from the origin layer;
hiding the cove does not hide the landscape or remove its support.

## Heightfield

This independent API example is a gentle raised area, not a saved scene:

```json
{
  "type": "heightfield",
  "bounds": [-20, 20, -20, 20],
  "segments": [64, 64],
  "baseHeight": 0,
  "stamps": [
    {
      "id": "gentle-rise",
      "center": [4, 0],
      "radius": [8, 10],
      "height": 1,
      "operation": "add",
      "plateau": 0.15,
      "falloff": 2
    }
  ],
  "appearance": {
    "sandColor": "#d8c49a",
    "wetSandColor": "#9f9173",
    "grassColor": "#738150",
    "rockColor": "#929087",
    "grassStart": 1.8,
    "grassEnd": 3.6,
    "rockSlope": 0.72,
    "textureScale": 1
  }
}
```

Bounds are `[xmin,xmax,zmin,zmax]`, with increasing limits. Coordinates,
`baseHeight` and each stamp's `height` are finite within -1000 to 1000. Segments are
integers from 1 to 256 on each axis. Up to 32 ordered stamps are supported. Each
stamp has a unique 1–64 character ID using letters, digits, hyphen or underscore;
its positive X/Z radii are at most 1000.

`add` is the default operation and adds a height delta. `flatten` blends toward an
absolute height. The default plateau is 0; its range is 0–0.999 of the elliptical
radius. The default falloff is 2, with range 1–8. Beyond the plateau, normalized
radius `t` contributes weight `(1-t*t)^falloff`; outside the outer radius it
contributes nothing. Stamps act on the result of earlier stamps. Heights can add
together, so the bounds on individual authored values are not a final elevation cap.

Appearance is optional, and the example shows its defaults. Colors use `#rrggbb`.
Grass thresholds are world elevations from -1000 to 1000; supply both with start
less than end. Rock slope is radians from 0 to PI/2. Texture scale is greater than
zero and at most 100. Grass blends by elevation and slope, while shoreline sand
darkens with water contact. Grain and ripple detail are shading, not collision.

### Texture layers

`appearance.layers` holds up to four layers drawn over the base blend in order.
Each names PNG maps inside `assets/imports`: an sRGB albedo, a tangent-space
normal map (OpenGL convention, green up) and an optional roughness map read from
its red channel. All layer maps share one square power-of-two size up to 2048.
The host pins each PNG by hash in the revision receipt, as it does GLBs, so
replacing a file creates a new revision and history keeps the old bytes.
Terrain PNGs total at most 32 MiB, inside the 128 MiB world asset budget.

```json
{
  "id": "leaf-litter",
  "maps": {
    "albedo": "assets/imports/terrain/litter-albedo.png",
    "normal": "assets/imports/terrain/litter-normal.png",
    "roughness": "assets/imports/terrain/litter-roughness.png"
  },
  "scale": 3,
  "projection": "planar",
  "strength": 0.9,
  "mask": {
    "height": [0.4, 9, 0.3],
    "slope": [0, 28, 4],
    "near": {"scatters": ["grove-palms"], "radius": 4, "fade": 2}
  }
}
```

`scale` is metres per texture repeat (default 4). `planar` projects from above;
`triplanar` blends three axes for steep rock, with normal detail from the top
projection only. `strength` scales the layer and `tint` multiplies its albedo.
Masks multiply. `height`, `slope` (degrees) and `water` (metres above
`water.level`) are `[min,max,fade]` bands: 1 inside the range, fading smoothly
to 0 over `fade` beyond each end. `near` is 1 within `radius` metres of
placements of the listed assets or scatters and fades over `fade`. `paint` is a
greyscale PNG stretched over the terrain bounds, columns along +x and rows
along +z, row 0 at `zmin`. The wet band stays on top of the layers and the
seabed takes them too.

Rendering stays one terrain draw. Layer maps pack into two texture arrays, with
roughness in the albedo alpha; `near` and `paint` masks are rasterized into one
512×512 texture over the bounds, updated when placements change.

The renderer and controller share the same Float32 lattice. Each cell has triangles
`[a,c,b]` and `[b,c,d]` for vertices `a,b / c,d`; support queries interpolate those
triangles. Smooth display normals do not change the face slope used for walking.
This surface has one height per X/Z point and cannot describe caves or overhangs.

## Ocean

```json
{
  "type": "ocean",
  "bounds": [-20, 20, -20, 20],
  "level": -2,
  "waves": [
    {"direction": [1, 0], "amplitude": 0.12, "wavelength": 6, "speed": 0.8, "phase": 0}
  ],
  "color": "#145a70",
  "shallowColor": "#68bcb2",
  "foamWidth": 1.2
}
```

Bounds and level are finite within -1000 to 1000. Zero to four waves are allowed.
Direction is an X/Z unit vector within 0.000001 tolerance. Amplitude is 0–10 metres,
wavelength 0.1–1000 metres, speed -30 to 30 metres/second, and optional phase is
-2PI to 2PI radians with default 0. Optional colors use `#rrggbb`. Foam width is
0.001–20, with default 1.2.

For each wave, `k = 2PI/wavelength` and
`y = level + sum(amplitude * sin(k * (dot(direction,[x,z]) - speed*time) + phase))`.
The CPU water query, GPU displacement and swimmer support use this equation and
the same runtime activity clock. Pausing activity freezes it; reset returns it to
zero. Detail normals and foam do not add hidden physics waves. Water exists only
inside its bounds. There are no currents, boat dynamics or rigid-body buoyancy.

The ocean has a bounded grid with at most 256 cells per axis. Terrain and ocean
each have at most 131,072 triangles. Together with the analytic sky these are three
surface draws before shadow and renderer passes. Large water extents with very
short waves can exceed the available geometric sampling detail; use appropriate
wavelengths and inspect motion. Analytic sky/sun reflection and terrain depth tint
avoid an extra reflection/refraction render pass. This does not reflect nearby
objects or simulate refraction.

### Underwater tint on placed objects

Submerged terrain and placed objects share one water column
(`waterColumn` in `src/world/landscape.jsx`, mirrored on the CPU by
`underwaterColor` in `src/world/water-optics.mjs`). It applies two-way
Beer–Lambert transmission, `exp(-2 × depth × (0.9, 0.16, 0.11))`, so red is
absorbed first. It adds scatter from `shallowColor` to `color` over 1.5–9 m,
and caustics within 55 m of the camera. Depth is measured at each fragment
against the analytic wave height, so a coral head and the seabed beside it get
the same tint at the same depth, and the waterline moves on rocks and posts.

The tint is automatic. At load, an asset is tinted when any of its placements,
scatter instances included, can reach below the highest wave crest: its
bounding box under the placement transform against `level` + the sum of wave
amplitudes + 0.15 m. Its materials are converted once to node materials whose
diffuse colour passes through the water column. Assets that never reach the
water are untouched. Do not bake an underwater tint into GLB albedo; it would
be applied twice.

The ocean surface still sets its body colour and opacity from depth to the
terrain. Over an object it veils the object as if it lay on the seabed, the
same as the seabed beside it. Reading true depth would need a scene-depth
texture, which the ocean avoids for WebGL2 stability.

### Surf

```json
{"surf": {"breakDepth": 1.2, "intensity": 0.8, "whitewater": 18, "runUp": 0.35,
  "period": 12.6, "direction": [-0.15, -0.989]}}
```

`water.surf` is optional and visual only: `sampleWater`, floating, wading and
`world_sample` are unchanged.

- `breakDepth`: 0.1–10 m, default 1.2.
- `intensity`: 0–1, default 0.8.
- `whitewater`: 1–80 m, default 18.
- `runUp`: 0–3 m, default 0.35.
- `period`: 2–30 s. The default is the first wave's wavelength divided by its
  speed, else 9.
- `direction`: a unit [x, z]. The default is the first wave's travel
  direction.

`src/world/surf.mjs` builds a 512×512 map over the terrain bounds from the
heightfield. The swell is marched along its direction, and each texel
inherits from the one a step upstream:

- Where depth falls below `breakDepth`, the swell is cut to the depth-limited
  share. The energy lost per metre is the break strength, brightest at a steep
  rim.
- Whitewater distance counts from the last break.
- The swell that reaches a shore is the energy in the last water at least
  `breakDepth` deep. A lagoon beach therefore gets the lagoon's swell. Swell
  recovers slowly over deep water and dies within a few metres inland.

The ocean draws a set line at the break and whitewater that travels shoreward
with the swell phase. The terrain draws swash: a film rises to `level + runUp ×
swell` and drains each period (uprush a third of it), with lace foam at its
edge and damp sand below the highest reach. Surf needs `scene.terrain`. It
adds one texture and no draws.

## Inhabitant and cameras

```json
{
  "preset": "maker",
  "camera": "first",
  "walkSpeed": 2.6,
  "runSpeed": 4.5,
  "swimSpeed": 1.8,
  "thirdPerson": {"distance": 3.6, "height": 1.3}
}
```

This is `scene.runtime.possession`. `preset` and `camera` are required; camera is
`first` or `third`. All remaining fields are optional and the example shows their
defaults. Speeds are greater than zero and at most 12 metres/second. Follow
distance is 0.5–12 metres and height 0.2–4 metres. Both cameras and the procedural
body consume one actor feet position. Switching view does not respawn the actor.

On terrain, `runtime.spawn` X/Z selects the support point; eye height derives from
terrain height. Without terrain, spawn Y minus 1.72 is the actor's ground plane.
Without possession, the legacy walker keeps its fixed 1.72 metre eye-height rule;
enable the maker for terrain-following movement.

The standing actor has radius 0.22m, height 1.82m and eye height 1.72m. Movement is
bounded in small steps, allows slopes up to 45 degrees and an upward step of 0.35m,
and tests boxes at actual feet height. Water deeper than 0.08m starts wading at 70%
of walk/run speed. Depth at least 1.25m enters swimming; depth at most 0.9m exits it.
Swimming feet follow water height minus 1m, with height 1.35m and eye height 1.25m.
Space jumps when grounded, with a 5.4m/s impulse and 18m/s² gravity. **V**
switches first and third person. The maker is an optional built-in procedural
body with a visual gait and basic foot IK. Arbitrary imported rigs, ragdolls,
moving-body push response and a general physics solver are not implemented by
these records.

## Bounded waypoint activity

An entity can use `motion.patrol@1`, which requires `collision.boxes@1`, with this
independent behavior example:

```json
{
  "type": "patrol",
  "path": [[-3, 0], [3, 0]],
  "speed": 0.8,
  "waitSeconds": 2,
  "waterPolicy": "avoid",
  "heightOffset": 0,
  "radius": 0.25,
  "height": 1
}
```

Up to 16 entities may patrol, each along 2–16 world-space X/Z points within -1000
to 1000. Speed is greater than zero and at most 4m/s; wait is 0–30 seconds. Path,
speed, wait and water policy are required. Optional height offset is 0–3m, radius
0.05–2m and height 0.1–4m; their defaults are 0, 0.25 and 1 respectively.

The entity starts at its authored X/Z position, targets the first waypoint, and
loops the path with a pause at every arrival. Terrain supplies ground height plus
the offset; without terrain it retains authored Y. Local +X faces travel and the
authored yaw can correct a model's front direction. Avoid policy rejects water
deeper than 0.08m; wade allows up to 0.8m. Terrain bounds, 45 degree slopes, 0.35m
upward steps and explicit blockers can stop movement. A blocked patrol retries;
there is no detour search or pathfinding. E toggles activity, global pause freezes
it, and reset returns it to its authored start. Hidden origin-layer activity freezes.

Observations report current position, target index, wait remaining, blocker, mode,
actual speed and distance. A moving prop is still its authored visual asset or
shape; this behavior does not imply skeletal animation or general animal AI.

## Seeded scatter

`scene.scatters` (module `scatter.seeded@1`, which requires terrain) replaces
long placement lists for a family such as a grove, undergrowth or rocks. Each
record expands deterministically into ordinary static placements named
`<scatter id>#<n>`:

```json
{
  "id": "grove-palms",
  "seed": 1207,
  "variants": [{"asset": "palm-tall", "weight": 3}, {"asset": "palm-lean", "weight": 2}],
  "region": {"polygon": [[-18, -6], [-4, -8], [-2, 10], [-16, 12]]},
  "limits": {"slope": [0, 24], "waterDepth": [-99, -0.2]},
  "density": 6,
  "maxCount": 80,
  "minSpacing": 3,
  "jitter": {"scale": [0.85, 1.15], "yaw": [0, 6.283], "lean": [0, 0.12]},
  "conform": 0,
  "yOffset": 0,
  "keepOut": [{"path": [[-14, 0], [-4, 4]], "width": 3}, {"circle": [-10, 6, 3]}],
  "collider": null
}
```

A seeded generator throws candidates inside the region polygon until it reaches
`density` instances per 100 m² of polygon area, capped by `maxCount`. Each
candidate must keep `minSpacing` from earlier instances and from the placed
instances of any scatters named in `avoid`. It must lie outside every keep-out
path, circle and polygon, and inside the `height`, `slope` (degrees) and
`waterDepth` limits. `waterDepth` is `water.level` minus the terrain height, so
it is negative above water. Variants are chosen by weight. Y is the sampled
terrain height plus `yOffset`. `conform` from 0 to 1 tilts each instance toward
the terrain normal, and `lean` adds a random tilt. `removed` lists instance
indices to delete without moving any other instance. Changing another field may
reshuffle the expansion.

Expanded placements count against the 1200-placement and 2M-triangle limits
with listed objects, and errors name each scatter's count. They render through
the same static instancing and collide with an optional per-instance box using
each instance's heading. `world_sample`, `world_check` (whose inventory lists
target, placed and removed counts) and selection see them. Selecting an
instance selects its scatter record, and the proposal review lists changed
scatters with their before and after counts.

## Light, placement and verification

V2 environments keep `type: construct|meadow`, `clearPath`, `groundColor`,
`fogColor`, `sunColor` and `sunIntensity` (0–8). Optional `sunPosition` is a nonzero
three-vector with components within -1000 to 1000. It aligns sky, water glint and
directional light. Optional `fogNear` is at least zero; `fogFar` is at most 2000;
near must be less than far. Their defaults remain 28 and 85. Terrain/ocean enables
the sky automatically: the analytic daylight dome, unless `environment.sky` is
set.

```json
{"sky": {"zenithColor": "#3d7fc4", "horizonColor": "#d6e5ec", "curve": 0.45,
  "sunDisc": 1, "clouds": {"coverage": 0.35, "density": 0.5, "height": 0.5,
  "scale": 1, "drift": [0.6, 0.2]}}}
```

`environment.sky` (schema 2) replaces the analytic dome with a gradient sky on
the same single draw (`src/world/sky.mjs` and `landscape.jsx`).

- `zenithColor` is required.
- `horizonColor` defaults to `fogColor`, so distant fog meets the horizon.
- `curve` (0.1–2, default 0.45) is the exponent of elevation in the gradient.
- `sunDisc` (0–2, default 1) scales the disc and glow in `sunColor`.
- `clouds` is optional procedural cumulus, lit by `sunColor` with the
  gradient as ambient:
  - `coverage`, `density` and `height` are each 0–1;
  - `scale` is 0.25–4;
  - `drift` is [x, z] in m/s within ±5.

  The noise follows three.js `SkyMesh` (MIT) and runs on the runtime clock.

The water reflects the same gradient. Clouds are not reflected and cast no
shadows.

Use `world_sample` with up to 64 unique `{id,position:[x,y,z]}` records and `time`
as an explicit value from 0 to 1e9 or null. Null uses a current matching browser
activity time, otherwise zero. A browser observation is current for ten seconds.
Samples describe the accepted world unless `proposalId` names the staged
proposal; then they describe that proposal, at `time` or zero, without a
browser observation. `world_check` takes the same `proposalId`. X/Z projects onto
support, while the requested Y is retained as context. Results include supported
feet/eyes, height, normal, slope, water depth, mode, bounds, blockers and limits.
Outside terrain, the edge height is clamped and `inBounds:false` is explicit.

An object's authored Y is still its pivot. Add the asset's measured root/foot
offset to support height; the tool does not automatically place or anchor assets.
`world_check` samples up to eight routes with at most 65 points per route. Its
terrain/possession driver follows supported feet and preserves swim hysteresis
between samples; independent point samples start at the swim entry threshold.
Neither tool certifies continuous traversal or visual quality. Verify the accepted
revision by walking it, switching both cameras, crossing the waterline, and
checking WebGPU and forced WebGL2 with the displayed lighting and asset revisions.
