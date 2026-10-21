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
The maker is an optional built-in procedural body. Arbitrary imported rigs, IK,
ragdolls, jumping, moving-body push response and a general physics solver are not
implemented by these records.

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

## Light, placement and verification

V2 environments keep `type: construct|meadow`, `clearPath`, `groundColor`,
`fogColor`, `sunColor` and `sunIntensity` (0–8). Optional `sunPosition` is a nonzero
three-vector with components within -1000 to 1000. It aligns sky, water glint and
directional light. Optional `fogNear` is at least zero; `fogFar` is at most 2000;
near must be less than far. Their defaults remain 28 and 85. Terrain/ocean enables
the sky automatically; arbitrary sky fields are not part of the schema.

Use `world_sample` with up to 64 unique `{id,position:[x,y,z]}` records and `time`
as an explicit value from 0 to 1e9 or null. Null uses a current matching browser
activity time, otherwise zero. A browser observation is current for ten seconds.
Samples describe the accepted world, not an unapplied proposal. X/Z projects onto
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
