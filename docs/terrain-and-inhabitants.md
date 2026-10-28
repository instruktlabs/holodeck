# Terrain, ocean and possession

Schema 2 worlds can opt into terrain (a stamped heightfield or a sampled
heightmap), a bounded ocean and the built-in maker inhabitant. New worlds and every bundled example start with the maker. These are reusable runtime capabilities. The world agent authors their
records through `world_propose`; the user applies the proposal. Existing worlds
and installed workspace instructions are not rewritten. `world_read` returns the
current host's complete spatial contract and valid examples on every read.

## Enable the records

Keep `runtime.version: 1`. Add the matching module whenever its record is present,
and remove the module when removing that record. Preserve existing behavior modules.

| Record | Required module |
| --- | --- |
| `scene.terrain` (heightfield or heightmap) | `terrain.heightfield@1` |
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

## Heightmap

A heightmap is sampled terrain, for landforms that elliptical stamps cannot
express: eroded gullies, angled ridges, talus and benches. It uses the same
`terrain.heightfield@1` module, stamps, appearance, layers and support as a
heightfield. This independent API example is not a saved scene:

```json
{
  "type": "heightmap",
  "bounds": [-32, 32, -32, 32],
  "size": [129, 129],
  "height": {
    "file": "assets/imports/terrain/site-height-v1.r32",
    "sha256": "<lowercase hex SHA-256 of that file>",
    "format": "r32"
  },
  "stamps": [
    {"id": "build-pad", "operation": "flatten", "center": [4, -6], "radius": [7, 5],
     "height": 2.5, "plateau": 0.75, "falloff": 2}
  ],
  "appearance": {"rockSlope": 0.62}
}
```

`size` is the sample count per axis, `[nx, nz]`, integers from 2 to 1025. The
height file holds `nx × nz` little-endian float32 values, row-major: row 0 at
`zmin`, rows increasing toward +z, column 0 at `xmin`. The outermost samples lie
exactly on the bounds, so the spacing is `(xmax − xmin)/(nx − 1)`. `height.file`
is an `.r32` file inside `assets/imports`, and `format` is always `"r32"`. A
NumPy array of shape `(nz, nx)` with row 0 at `zmin` writes one directly:

```python
import hashlib, numpy as np
samples = np.asarray(heights, dtype="<f4")  # shape (nz, nx), row 0 at zmin
samples.tofile("assets/imports/terrain/site-height-v1.r32")
print(hashlib.sha256(samples.tobytes()).hexdigest())  # height.sha256
```

A sample `s` stands at `s × scale + offset` metres. `scale` is greater than 0 and
at most 1000 (default 1), `offset` is within ±1000 (default 0), and every
resulting height must stay within ±1000. Optional `segments`, 1 to 1024 per
axis, sets the lattice. It defaults to `[nx − 1, nz − 1]`, so the lattice
vertices are the samples themselves; other values resample the samples
bilinearly onto that lattice. Either way there is one surface: the renderer,
walker, aim, scatter placement, floor clearance, terrain layers, surf, the
ocean's depth, `world_sample` and `world_check` all read the same lattice
triangles described above. Up to 32 stamps apply over the sampled base in order,
exactly as on a heightfield, so `flatten` holds a build pad at its target height.

The host checks the file before it accepts a revision: the byte count must be
`nx × nz × 4`, its SHA-256 must equal `height.sha256`, and every sample must be
finite. It then pins the bytes by hash, as `.holodeck/blobs/<sha256>.r32`
beside the GLBs and terrain PNGs. The file counts inside the 128 MiB world asset
budget; the largest, 1025 × 1025, is 4.2 MB. History, undo, restore, remix,
static export and example bundles carry the pinned bytes, never a re-derivation.

Because the record names a hash, its samples never change under it. To change
the landform, write new samples under a new file name and propose that file and
its sha256. Overwriting the pinned file in place does not change the accepted
world: the host reports that the file no longer matches the record, and the
accepted revision keeps its pinned samples until a proposal names new ones.
Proposal review shows the heightmap's hash, sample size, bounds and lattice, and
which of them changed; it never lists samples.

Beyond its bounds a heightmap has no surface. As in a world without terrain,
the ocean shades the floor there at 12 m below `water.level`.

### Choosing segments

The default lattice puts one vertex on each sample, so it has
`(nx − 1) × (nz − 1) × 2` triangles: 524,288 for 513 × 513 samples and
2,097,152 for the largest, 1025 × 1025, against at most 131,072 for a
heightfield. The terrain is one draw. It receives shadows but casts none, so the
shadow pass does not draw it; a pass that renders the world again, such as a
planar water reflection, can.

The lattice is built on the main thread whenever the terrain's shape changes,
and scatter counting and the runtime share that one build. In Node 24.20.0 on a
desktop CPU (Ryzen 7 3700X), 512 × 512 cells took about 30 ms and 13 MiB of
buffers, and 1024 × 1024 0.11–0.14 s and 52 MiB. Hashing and decoding the
largest file took about 15 ms.

Fewer `segments` than sample intervals resample the base, which changes the
landform as well as its cost. Every consumer reads the resampled lattice, so the
walker still stands on the drawn ground; what moves is the ground itself. For a
513 × 513 test terrain over 256 m with cliffs, the resampled surface differed
from the full lattice inside the walkable bounds by:

| Lattice cells | Triangles | Mean | p99 | Max |
|---|---:|---:|---:|---:|
| 384 × 384 | 294,912 | 0.03 m | 0.40 m | 4.42 m |
| 256 × 256 | 131,072 | 0.04 m | 0.68 m | 4.97 m |
| 128 × 128 | 32,768 | 0.15 m | 1.55 m | 7.47 m |

The largest differences are at cliff edges, where a coarser cell cuts the corner.

Frame cost was measured in the browser. These are hub browser results (GTX 1660
Ti Max-Q laptop GPU, driver 615.78.08, headed Chrome 150 through Playwright,
1600×900, nice 10), not PC, Windows or Unity results. The camera orbited for
20 s after a 10 s warm-up revolution with the frame rate uncapped
(`--disable-gpu-vsync --disable-frame-rate-limit`). Frame times are medians of
two runs, p50 / p95 in ms. The modular rows are a scratch copy of a modular test
world of about 690 draws, on its own stamped heightfield and on a 513 × 513
heightmap of the same site. The largest rows are the starter world with water,
scatter and a generated 1025 × 1025 heightmap over 256 m, at 94 draws.

| Terrain | Lattice cells | Terrain triangles | WebGPU | WebGL2 |
|---|---:|---:|---:|---:|
| Modular, stamped heightfield | 150 × 145 | 43,500 | 7.2 / 11.2 | 7.6 / 10.4 |
| Modular, heightmap, default | 512 × 512 | 524,288 | 7.7 / 11.8 | 7.3 / 10.0 |
| Modular, heightmap, `segments: [256, 256]` | 256 × 256 | 131,072 | 7.3 / 11.3 | 7.3 / 10.0 |
| Largest heightmap, default | 1024 × 1024 | 2,097,152 | 3.3 / 5.2 | 3.4 / 7.3 |
| Largest heightmap, `segments: [256, 256]` | 256 × 256 | 131,072 | 3.7 / 5.6 | 3.5 / 5.1 |

- On the modular world, twelve times the terrain triangles left frame time
  within the spread of repeated runs: draws, not terrain triangles, set that
  frame. Paced by the 120 Hz display, every variant there ran at p50 8.3 ms on
  both backends, and single-run p95 moved between 8.5 and 16.7 ms whatever the
  terrain.
- The largest lattice left WebGPU unchanged. On WebGL2 it added about 2 ms at
  p95, and in both runs at least 1% of frames took over 70 ms (p99 72 and
  88 ms), where 256 × 256 kept p99 at 7.5 ms. In those runs it also became
  ready about 0.6 s (WebGPU) and 1.3 s (WebGL2) later.
- Walker support and the drawn triangles agreed within 7.1 × 10⁻¹⁵ m in every
  run: about 221,000 grounded walker frames and 123,000 random points, checked
  against the index and position buffers of the live terrain mesh.
- No run had a page error.

Up to 513 × 513 samples, keep the default lattice, whose vertices are the
samples themselves. For larger heightmaps, profile the displayed world on WebGL2
before keeping 1024 × 1024 cells. If you lower `segments`, use `world_sample`
to check the pads, paths and cliff edges you depend on, because the walker will
use the resampled ground. These figures come from one laptop GPU and one CPU.

### Engine destinations

Destination exporters, such as the Unity transfer, live outside this
repository and have not been updated for heightmaps. To carry one faithfully,
an exporter needs:

- The record (`bounds`, `size`, `scale`, `offset`, `segments`, `stamps`) and
  the pinned bytes from the accepted receipt or a static export, with their
  SHA-256 checked before import. Reject a mismatch; never re-sample the source
  file the record once named.
- The lattice, not only the samples: stamps and any resampling to `segments`
  are part of the surface. Building the lattice with Holodeck's own
  `createTerrain` on the Node side and exporting its vertex heights avoids a
  second implementation of the stamp and resampling rules.
- The frame conversion applied once. Unity's glTF import reflects X, which
  reverses the column order; row 0 stays at `zmin`.
- A statement of how the destination surface differs. Unity's Terrain needs a
  square `2^n + 1` height resolution, stores normalized 16-bit heights and
  triangulates and simplifies by its own rules, so it can match this lattice
  only at the samples. Where walking parity matters, compare the destination's
  collision surface with the lattice triangles, or build a mesh collider from
  those triangles.

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

The ocean has a bounded grid with at most 256 cells per axis. A heightfield and
the ocean each have at most 131,072 triangles; a heightmap's lattice can reach
2,097,152 (see [choosing segments](#choosing-segments)). Together with the analytic sky these are three
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
terrain lattice. The swell is marched along its direction, and each texel
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
### The maker by default, the legacy walk as fallback

Possession stays an explicit, versioned record in each world; the engine never
injects it. `holodeck init`, a new library world and the agent's capability
examples all start with `{"preset":"maker","camera":"first"}` and
`inhabitant.maker@1`, so their exports and history say the world runs the maker.
The bundled courtyard, Cove and kinetic examples gained it as a new revision.

A world without possession keeps the legacy walk: a bodyless camera with a fixed
1.72 metre eye height on flat ground, no jumping, swimming or walkable tops. It
remains the fallback for worlds that opt out. Existing user worlds are never
migrated. For them `world_check` (and **Check world** in Observe) reports an
`inhabitant-upgrade` suggestion carrying the record to add; the agent can
propose it, or **Add the maker** saves it as a new revision that undo reverts.
Walk the spawn, routes and any walkable tops again afterwards: the maker is 1.82m
tall rather than 1.72m, so a beam between those heights now blocks it.

The standing actor has radius 0.22m, height 1.82m and eye height 1.72m. Movement is
bounded in small steps, allows slopes up to 45 degrees and an upward step of 0.35m,
and tests boxes at actual feet height. Water deeper than 0.08m starts wading at 70%
of walk/run speed. Depth at least 1.25m enters swimming; depth at most 0.9m exits it.
Swimming feet follow water height minus 1m, with height 1.35m and eye height 1.25m.
Space jumps when grounded, with a 5.4m/s impulse and 18m/s² gravity. **V**
switches first and third person, and **T** or **1–9** play an
[emote](#emotes). The maker is an optional built-in procedural
body; its motion is described below. Arbitrary imported rigs, ragdolls,
moving-body push response and a general physics solver are not implemented by
these records.

### The maker's body and motion

The maker is one 49-bone skeleton driving a skinned mesh per material, about a
dozen draws in all. Its enamel shells stay rigid on their bones; the waist, neck,
shawl and sash blend between bones. The pose is visual only: it reads the actor
record each frame and never moves collision or the gameplay support anchor.
The third-person boom reads the pose's smoothed eye, so the view and the body
share one vertical motion; it does not follow the gait bob.

- **Gait.** Below about 1.9m/s the maker walks, above 2.5m/s it runs, blending
  between. Default walking speed (2.6m/s) is a jog; sprint is a run, and a
  partly tilted touch stick walks. Stride and cadence follow speed, and the gait
  phase advances with distance actually travelled. The hip bounce stays a
  shallow walk at the default jog and deepens only as the speed becomes a sprint.
- **Feet.** Each foot is planted in world space for its stance, rolls from heel
  strike to toe-off about its heel and ball, and swings on a path that leaves
  and lands at zero ground speed. Two-bone IK places each ankle on the terrain or
  a walkable collider top, eases the last few percent of reach so knees never
  snap straight, and lowers the pelvis only as far as a supporting sole needs.
  Swing clearance and the heel-to-toe roll do not lift the hips. The visible
  body eases over heightfield creases and treads, follows a settled slope, and
  does not keep rising after a crest. The third-person boom uses that same eye.
- **Starts, stops and turns.** A stop finishes the step in flight, then settles
  any foot that strayed from a comfortable stance, one at a time. Turning on the
  spot in first person shuffles the feet; a turn past 90 degrees re-plants both.
- **Jumps.** A standing jump tucks both knees; a running jump keeps the stride's
  lead leg. Landing sinks the pelvis in proportion to the fall, then springs back.
- **Water.** Wading lifts the knees higher and raises the arms with depth.
  Swimming at rest treads water with an eggbeater kick and sculling hands, the
  head above the surface and the feet clear of a shallow bed. Under way it is a
  front crawl: alternating strokes with a high-elbow recovery, body roll toward
  the pulling arm, a breath to the side and a six-beat flutter kick.
- **Life.** At rest the maker breathes and shifts its weight. In third person
  its head turns toward where the camera looks, and lets go when the camera
  faces it. The eyes blink, the chest core pulses, and the shawl and sash swing
  on damped springs driven by travel, acceleration, turning and gravity.

First person hides the head and the shawl, which sit at the eye, while keeping
their shadows. For development, `maker-lab.html` on the dev server
(`npm run dev`) runs the same controller and pose on a small beach and lagoon;
`window.makerLab` drives scripted input and fixed review cameras.

### Emotes

The maker has nine emotes, in wheel and number-key order: wave, dance, clap,
bow, point, shrug, cheer (both arms up), sit and lie down. Hold **T** for the
wheel, or press **1–9**; on touch, the Emote button beside Jump opens it.

- **Timing.** One-shots play once and return to idle. Dance, sit and lie down
  hold until you move, jump or pick another emote; picking the running loop
  again stops it. A new pick lets the current emote finish ending first.
- **Cancelling.** Any movement input or a jump ends an emote and the body blends
  back into walking. A sitter or lier stands up first (about 0.55s and 1.3s),
  holding movement until it is up. Falling or swimming drops an emote at once;
  sitting and lying need firm ground, and the rest also play while wading. A
  pick made while a movement key or the stick is held is ignored.
- **Seats.** Sit chooses the nearest collider box top 0.25–0.7m above the feet
  within 0.8m: a bench, chair seat, log or step. The maker backs onto the nearest
  edge, sits 0.2m inside it facing out, and places its feet on the ground ahead
  by IK at whatever height the seat is. With no seat in reach it sits on the
  ground with its knees up. Moving objects (a door, a mechanism) are never seats.
- **Lying down** sits first, then lies back along the ground's fall line with the
  hands behind the head and one knee raised.
- **Cameras.** Emotes never move the camera: first or third person stays exactly
  as the player set it, and mouse look works as usual.
- **State.** An emote is transient activity on the actor, like a door swing. It
  is never saved into the world document or its revisions, and it does not move
  collision, support or the actor's position: sitting moves only the visible body.
  `actor.emote` is plain data (`id`, `loop`, `start` on the world clock, `seat`,
  elapsed `time` and `stage`), so a body can be played from replicated state.
  Point aims where you look, within about 60 degrees of the body's facing.

The emote layer (`src/world/maker-emotes.mjs`) runs after the locomotion pose and
slerps keyed rotations over it by the emote's weight. Upper-body emotes and the
dance re-solve the legs so both feet stay planted. Timing, cancelling and seat
choice are in `src/world/emotes.mjs`; the wheel's input is
`src/world/emote-wheel.mjs`. In `maker-lab.html`, `makerLab.emote(id,{seat})`
plays one.

### Walkable colliders

A collider box marked `walkable` also supports the walker and patrols, so a jetty
deck, raised floor, bridge or stair tread can be walked on. On a compound collider
the flag belongs to each box, so a deck can be walkable while its posts and rails
stay walls:

```json
{
  "type": "compound",
  "boxes": [
    {"size": [3, 0.3, 1.8], "offset": [0, -0.15, 0], "walkable": true},
    {"size": [0.26, 1.6, 0.26], "offset": [-1.5, -0.2, 1.03]}
  ]
}
```

- **Support.** The walker stands on the highest of the terrain and every walkable
  top over its position that is at most 0.35m (one step) above its feet. In the
  air it lands only on a top it falls past. A top has no slope.
- **Footprint.** Each top is the box's top rectangle grown by 0.1m, so pieces that
  meet within 0.1m walk as one surface.
- **Treads.** A walkable top within one step above the feet does not block, so
  treads 0.35m apart or less climb as stairs. Every other box face blocks as before.
- **Edges.** Walking off a top that is more than one step above the ground below
  falls, then lands on whatever is there.
- **Water.** Depth counts from the support, so a deck above the water is dry. A
  1.82m wader cannot pass under a deck whose underside is lower than that above the
  seabed. A swimmer (feet 1m below the surface, 1.35m tall) passes under only where
  the underside is more than 0.35m above the water.
- **Limits.** Walkable boxes are yaw-only, like every collider, and are refused on
  placements with a behavior: nothing carries the walker on a moving object. Scatter
  colliders are never walkable. Sloped walkways are not supported; author stairs or
  terrain.

`world_sample` reads its point's y as an eye height. Where walkable tops overlap the
point, it stands on the highest one at or below y − 1.72 + 0.35, as the walker does
at spawn. It then reports `supportSource: "collider"`, `supportId`, `supportHeight`
and `levels`, every walkable height there including the terrain. `world_check`
routes carry each sample's feet to the next, so a route along a deck stays on it,
and a step down of more than 0.35m is reported as a `drop`. Worlds without the flag
sample exactly as before.

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
the offset; without terrain it retains authored Y. Like the walker, a patrol also
stands on a walkable collider top up to 0.35m above its feet; its first feet are
its authored Y minus the offset, so a patrol authored on a deck walks along it. Local +X faces travel and the
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

Optional `environment.hemisphere` controls the global fill light independently
of the visible sky. Its optional `skyColor` and `groundColor` are `#rrggbb`
colors, defaulting to `#f1eee2` and `#95806d`; optional `intensity` is 0–8,
defaulting to 1.8. Zero disables its contribution. This light has no shadows or
indoor occlusion; changing `environment.sky` does not automatically relight it.

Optional `environment.exposure` is a finite number from 0.1 to 4, defaulting to
1.12. These are authoring limits. Exposure scales scene radiance before final
ACES tone mapping, after the scene and bloom are composed. It affects sky,
emissive surfaces and bloom appearance; it is not an
independent shadow/contrast control. The renderer updates it on accepted
revision changes and restores the default when omitted. Both options are
schema-v2 fields shared by the editor and static player. Old documents retain
their appearance without migration; documents using these fields need a
toolchain that supports them.

```json
{"hemisphere": {"skyColor": "#c9d9ed", "groundColor": "#777982", "intensity": 0.9},
 "exposure": 1.05}
```

Use `world_read` capabilities and a complete scene proposal, or the World
panel's Scene document editor, to author these settings. Bible rules describe
intent; they do not execute lighting changes. Check applied changes and their
static exports on WebGPU and forced WebGL2, including interior materials,
glass, foliage, sky/fog and practical lights. Numeric validation is not a
visual-quality verdict.

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
