# Dogfood upgrade plan

An implementation plan for the Holodeck findings in
[dogfood-tropical-island.md](dogfood-tropical-island.md). It is written so an
agent can take it from the top and finish it. IDs (H1–H33) refer to that
document; read each finding before starting its item. Kiln-side work is
tracked in the Kiln repository, not here.

## Ground rules

- Read `AGENTS.md`, `README.md`, `docs/architecture.md` and
  `docs/distribution.md` first.
- Do not commit, push or publish without the user's authorization. Keep
  exact dependency pins.
- Keep Kiln on the Node side. Never import its root SDK into browser bundles.
- Keep public examples independent. Keep private captures and analysis out of
  the repository.
- Editing a `server/` module restarts the Vite host and disconnects any
  connected agent. Batch server changes, and say so before a restart if a
  user's agent turn is running.
- Each item lists its acceptance checks. In addition, every phase ends with:
  - `npm run test:runtime`, `npm run test:world` and `npm run build` passing;
  - a browser check on WebGPU and on `?backend=webgl`, with draws, rendered
    triangles and frame interval p95 recorded (pane visible, see H27 and
    H33);
  - the dogfood document updated: move fixed findings to "Fixed during this
    pass" with their evidence.

## Phase 1: agent context and setup

Cheapest work with the largest effect on agent quality. Most of it is text in
`server/world-tools.mjs` (the contract strings `world_read` returns), the
Holodeck skills in `skills/`, the world scaffold (`server/scaffold.mjs`,
`server/world-store.mjs`) and the adapter instructions (`server/claude.mjs`,
`server/codex.mjs`, `server/cursor.mjs`).

1. **Contract facts the agent had to discover.** Add to the contract text and
   `skills/holodeck-author-world/references/current-runtime.md`:
   - **Placement rotation:** XYZ Euler order in radians (H29), and that Kiln
     part rotation is in degrees.
   - **Foliage wind contract:** state it in full, including that Kiln's
     `createPart` names meshes `Mesh_<name>`, and how to bind those names.
   - **Terrain appearance:** list the seven settings, say what is fixed, and
     say that Kiln materials cannot reach the terrain (H30, until Phase 3
     lands).
   - **Environment types:** what each one renders (H24).
   - **Proposal size:** the current limits, and how to stage large scenes
     (H28; update when Phase 2 lands).
   - **Budget strategy:** the 64-asset cap usually binds first, so use two or
     three shaped variants per family and vary placements by yaw, scale and
     lean (H21).

   Acceptance: a test asserts that each fact appears in the `world_read`
   contract output.
2. **Export delivery recipe.** In `skills/holodeck-integrate-asset/SKILL.md`,
   give the exact Kiln route from a saved revision to `assets/imports`: the
   CLI `export --out` command and profile, or a copy from the Kiln store with
   a hash check, as the turn 4 agent did. Name the expected file naming.
   Acceptance: the skill names one command and one destination.
3. **Harness-aware Kiln workspace (H15).** `server/kiln-workspace.mjs`
   hard-codes `--harness codex`. Pass the connecting provider's harness
   (Kiln supports `claude`, which writes `.claude/skills`), or install for
   every supported harness. Decide whether the compose skill
   (`--skills compose`) belongs in a Holodeck world: it describes Kiln's own
   terrain composition, which misleads here. Update
   `server/kiln-workspace.test.mjs`. Acceptance: a Claude Code connection
   finds the Kiln skills without reading them by path.
4. **Provider-neutral scaffold (H17).** Fix the Codex-only wording in
   `server/scaffold.mjs`, `server/world-store.mjs`, `server/history.mjs` and
   `server/example-bundle.mjs`. Check whether the world `CLAUDE.md` loads
   under `--setting-sources user`; if not, put what it carries into the
   adapter instructions. Acceptance: scaffold tests cover the text.
5. **Progress log location (H26).** Until Kiln makes the log path
   configurable, say in the adapter instructions that the Kiln progress log
   lives at `assets/source/KILN_PROGRESS.md`. Acceptance: covered by the
   instructions test.
6. **Engine contract pointers (H32).** Return the terrain, wave and
   environment details the agent read from `docs/terrain-and-inhabitants.md`
   and `src/world/landscape.jsx` through `world_read`, so it never needs engine
   sources. Acceptance: no engine-file read is needed to answer "what can I set
   for terrain, water and sky?".

## Phase 2: proposal pipeline

Turns are already at about 135 KB of scene and growing. These items unblock
larger turns and let the agent check its own work.

1. **Stage from a file (H28, High).** Let `world_propose` take a
   world-relative `sceneFile` under `assets/source` as an alternative to inline
   `sceneJson`. Read it with the same validation, bounds and size cap, and
   refuse anything outside the world. Alternatively, accept batches that
   append to one draft proposal; pick one and document why. Acceptance:
   - tests for path escape, oversize and malformed files;
   - an 800-placement scene stages without inline JSON.
2. **Measure a staged proposal (H19, High).** Let `world_sample` and
   `world_check` take a `proposalId` and evaluate the staged world without
   applying it. Add an overhead preview render of a proposal if the host can
   produce one cheaply. Acceptance: sampling a proposal that changes terrain
   returns the proposal's heights, and the accepted world is unchanged.
3. **Readable proposal review (H13).** Replace the raw JSON dump on the review
   card with a diff:
   - bible fields side by side;
   - board cards moved or changed;
   - scene objects added, removed or changed, grouped by asset with counts.

   Acceptance: the turn 4 proposal (28 assets, 394 placements) reads as a
   short grouped summary with an expandable detail.

## Phase 3: authoring primitives

The largest visual gains against the references.

1. **Terrain material layers (H30, High).** Extend terrain appearance with
   layers:
   - each layer has a texture set: albedo, normal and roughness, with
     triplanar mapping on slopes;
   - masks by height, slope, distance to water and painted regions;
   - include a leaf-litter or soil layer for ground under canopy.

   Keep the WebGL2 fallback. Accept Kiln-authored textures delivered as
   files. Acceptance:
   - the sand shows grain, and the ground under the grove can differ from the
     beach;
   - draws, triangles and p95 are recorded on both backends.
2. **Seeded scatter component (H21, High).** A scene component that holds:
   - asset variants;
   - a region polygon or terrain mask;
   - density, slope and height limits;
   - minimum spacing;
   - scale, yaw and lean jitter;
   - keep-out shapes for routes and sightlines;
   - a seed.

   It expands deterministically into instanced placements that count against
   the same budgets, with ground-conforming tilt. Acceptance:
   - tests for determinism, budget counting and keep-outs;
   - the turn 3 and turn 4 planners' outputs can be expressed as a few
     scatter components.
3. **Shared texture store (H31).** Content-address images inside admitted
   GLBs, so identical textures are stored and served once. Acceptance: the
   tropical world's 40 assets drop well below their current 22.7 MB transfer
   size, with byte-identical rendering.

### Design note: terrain material layers (3.1, approved)

**Schema.** An optional `terrain.appearance.layers` list, up to four entries.
The eight existing settings stay as the base. Each layer is drawn over the
result so far:

```json
{"id":"leaf-litter","maps":{"albedo":"assets/imports/terrain/litter-albedo.png",
 "normal":"assets/imports/terrain/litter-normal.png","roughness":"assets/imports/terrain/litter-rough.png"},
 "scale":2.5,"projection":"planar","strength":1,
 "mask":{"height":[0.4,9,0.3],"slope":[0,28,4],"water":[1.5,999,1],
  "near":{"assets":["palm-tall","palm-lean","palm-arch"],"radius":5,"fade":2},
  "paint":"assets/imports/terrain/grove-mask.png"}}
```

- **Maps:**
  - PNG files under `assets/imports`, pinned by hash like GLBs. Kiln-authored
    textures arrive as files.
  - All layers use one power-of-two size, up to 2048. Albedo and normal are
    required; roughness is optional.
  - A shared terrain texture budget applies, 32 MiB of PNG.
- **Masks:** multiplied together, each fading in over the given width.
  - `height`: world elevation [min, max, fade], in metres.
  - `slope`: [min, max, fade], in degrees.
  - `water`: distance above the water level [min, max, fade], in metres.
  - `near`: distance to placements of the listed assets. This gives leaf
    litter under canopy without painting.
  - `paint`: an optional greyscale PNG stretched over the terrain bounds.
- **Projection:** `planar` (XZ) by default. `triplanar` is for steep rock and
  costs three samples per map.
- **Order:** the wet band, seabed absorption and caustics still apply after
  the layers, so the shoreline reads the same.

**Rendering.** Each map type is packed into one texture array: albedo, normal
and roughness arrays. The `near` masks are rasterized in the browser into one
256×256 mask texture, recomputed when placements change. That is four extra
samplers in total, plus the existing detail, normal and height textures. This
fits WebGL2's 16 units with shadows. TSL compiles the same graph for WebGPU
and forced WebGL2, so there is no separate fallback path. Terrain stays one
draw. Fragment cost grows by about three samples per planar layer.

**Checks.**
- Validation tests: paths, sizes, layer count, mask ranges, budget.
- CPU-side tests of the mask functions, mirrored in TSL.
- A sand layer with grain and a litter layer under the grove on the tropical
  copy.
- Hub captures and numbers on both backends.
- Kiln stays on the Node side; the host only reads PNG headers.

**Decisions (approved with the defaults):**
- Four layers.
- `near` takes asset IDs, and also scatter IDs now that scatter exists.
- Terrain textures count inside the 128 MiB world asset budget, with 32 MiB
  as the terrain sub-limit.

**As built.** Roughness is packed into the albedo array's alpha, so layers
add two array samplers and one mask texture. The mask is 512×512 rather than
256×256, because near masks need sub-metre texels on a 280 m island.
Triplanar layers take albedo and roughness from three axes; their normal
detail comes from the top projection only and fades on steep faces. Paint
masks map image rows along +z, row 0 at the `zmin` edge. History, undo,
remix and static export carry the pinned PNGs; example bundles do not yet,
so building one from a world with layers is refused with that reason.

### Design note: seeded scatter component (3.2, approved)

**Schema.** An optional `scene.scatters` list behind a new runtime module,
`scatter.seeded@1`:

```json
{"id":"grove-palms","layer":"world","seed":1207,
 "variants":[{"asset":"palm-tall","weight":3},{"asset":"palm-lean","weight":2},{"asset":"palm-arch","weight":1}],
 "region":{"polygon":[[-40,10],[-12,4],[-8,30],[-36,34]]},
 "limits":{"height":[0.6,12],"slope":[0,24],"waterDepth":[-99,0]},
 "density":0.9,"maxCount":80,"minSpacing":4.5,
 "jitter":{"scale":[0.85,1.15],"yaw":[0,6.283],"lean":[0,0.12]},
 "conform":0,"yOffset":0,
 "keepOut":[{"path":[[-30,12],[-18,26]],"width":3},{"circle":[-22,18,6]},{"polygon":[[-14,8],[-10,8],[-10,14]]}],
 "removed":[17,42]}
```

- `density` is instances per 100 m² of region, capped by `maxCount`.
- `conform` is 0..1: how far an instance tilts toward the terrain normal.
- `removed` deletes single instances without reseeding the rest.
- Placements otherwise keep their current fields; `collider` is null or one
  box applied to every instance.

**Expansion.** One shared, pure module, `src/world/scatter.mjs`, used by the
host, the browser and the world tools.
- A seeded PRNG drives dart throwing on a spacing grid with bounded attempts.
- Each candidate is tested against the region, keep-outs and minimum spacing,
  then against height, slope and water limits using the shared terrain and
  water samplers.
- Output is ordinary static placements with IDs `<scatter id>#<n>`.
  - Y is the sampled support plus `yOffset`.
  - Tilt blends toward the support normal by `conform`, plus lean jitter.
- The same record and seed always give the same placements. Changing any
  parameter may reshuffle; `removed` does not.

**Budgets and rendering.** Host validation expands every scatter and counts
the results against the 1200-placement and 2M-triangle limits. Errors name
the scatter and its expanded count. Expanded placements go through the
existing static batching, so a scatter costs one instanced draw per variant
per cell. `world_sample`, `world_check`, picking and the review diff all see
the expanded placements. Selecting one selects its scatter.

**Checks.**
- Tests for determinism (repeat runs and a fixed snapshot), budget counting,
  keep-outs, limits, spacing and `removed`.
- A test that expresses turn 3's grove (103 hand-listed palms) and turn 4's
  undergrowth as a few scatters, with the same keep-outs: routes, shelter,
  jetty, cove and sightlines.

**Decisions (approved with the defaults):**
- `density` is primary, with `maxCount` as the hard cap. Density is counted
  over the whole region polygon, so limits and keep-outs concentrate the same
  count into the area that remains.
- `avoid` lists earlier scatter IDs; candidates keep `minSpacing` from their
  placed instances.
- Terrain `near` masks accept scatter IDs.

**As built.** Expanded instances also carry `scatter` (their record ID) and
`yaw` (the collision heading before tilt). Colliders use that yaw; tilt is
ignored for collision. Scatter IDs share the placement ID namespace, so
selection can name a record. A scatter requires `terrain.heightfield@1`.

## Phase 4: permissions

These remove per-call clicks without widening what the agent can touch.

1. **Exact-command session grant (H20).** Offer "Allow this exact command for
   the session" for shell calls, matched on the full command string and
   working directory. Never prefix-match. Acceptance: adapter tests for exact
   match, different arguments and a different directory.
2. **All Kiln workspace tools (H10).** Offer "Allow all Kiln workspace tools
   for this session" alongside per-tool grants. Kiln's MCP export writes no
   files, so read-only hints are trustworthy there. Acceptance: tests cover
   the grant and reconnect persistence.
3. **Read-only engine docs (H32).** If Phase 1.6 is not enough, add a
   read-only grant for the engine `docs/` folder. Never extend it to the
   user's home or config folders. The turn 4 agent asked to search
   `~/.claude`, and that must keep asking.

**As built.** Claude Code (`server/claude.mjs`): Bash and PowerShell cards
offer **Allow this exact command for the session**. The grant is
`shell:[tool, world folder, command]`, compared as one string, so different
arguments, a trailing space, the other shell or another folder ask again;
commands over 8,000 characters are allowed once at most. Measured on 2.1.300,
each shell call starts in the world folder whatever an earlier call did with
`cd`, so the world folder is the working directory; the adapter also sets
`CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1`. Kiln cards add **Allow all Kiln
workspace tools for this session** (`mcp__kiln_workspace__*`) beside the
per-tool grant. Grants persist in `.holodeck/session/claude.json`; on reconnect,
shell grants for another folder and malformed entries are dropped. Granting
also answers any waiting card the grant now covers. Codex (`server/codex.mjs`):
command approvals with a `cwd` inside the world offer the same exact-command
grant, keyed on `[cwd, command]`, answered with `accept`, persisted with the
thread and cleared when a new thread starts. Cursor keeps its native ACP
options. Tests: `server/claude.test.mjs` (exact match, other arguments, other
tool, other folder, reconnect, all-Kiln grant and reconnect) and
`server/codex.test.mjs` (exact match, waiting card, other arguments, other
folder, outside folder, file changes, reconnect, new thread).

**H32 not added.** Phase 1.6 answers terrain, water and sky questions through
`world_read` (covered by its test), and both adapters tell the agent not to read
engine sources. A read grant would also need the engine install path, which is
outside the world folder. Read, Grep, Glob and web tools have no session grant,
so a request to read engine docs or `~/.claude` asks every time; a test pins
that.

## Phase 5: interface

**Status:** done in the interface design pass (direction B, one dock), merged
into `main` as `ade4b53`. The evidence for each item is in the
[tropical island log](dogfood-tropical-island.md#fixed-during-this-pass).

1. **World panel at scale (H25).** Group placements by asset with counts,
   collapse groups, add a filter, and select by clicking in the viewport.
   Acceptance: 504 placements fit on one screen when collapsed.
2. **Reference pack import (H1, H4).** Accept a dropped folder or zip with an
   optional manifest (title, category, notes, status). Keep hashes and
   provenance. Offer a stable default category set. Acceptance: the tropical
   reference zip imports in one step with titles and categories.
3. **Reconnect (H16).** Remember the last provider, model and effort per
   world, and offer one-click reconnect after a host restart.
4. **Conversation (H11, H12).** Collapse long user messages, and pin request
   cards to the bottom of the column. Keep action buttons in stable positions
   after a card resolves.
5. **Board polish (H3 remainder, H9).** Keep **Link a workspace file**
   reachable while a card is selected. Fix toolbar clipping at narrow widths.
6. **Model IDs (H6).** Offer exact model IDs alongside aliases.
7. **Honest timing (H27, H33).** Show when the page is hidden and pause
   frame-interval collection, and log time to first frame from the host.
8. **Log noise (H8).** Filter the `@pmndrs/glyph` source-map warnings.

## Phase 6: runtime look

1. **Surf and run-up (H22).** Reef-break foam from the depth gradient, and
   swash on the beach slope.
2. **Sky (H23).** A procedural cloud layer and a sky colour gradient in
   `environment`, so the overlook sky does not read flat grey.
3. **Underwater tint on placed objects (H34).** Share the water column
   absorption and scatter with GLB materials below the water level.
4. **Sectioned `world_read` (H35).** Return the world in sections under the
   agent tool output limit, with paging for objects.
5. **Walkable colliders (H36).** Let marked collider tops support the walker,
   so a jetty, deck, bridge, stair or raised floor can be walked on. Added
   after 6.3 and 6.4; see the design note below.

Acceptance for both: before and after captures from the arrival and overlook
views on both backends. Captures stay outside the repository; record the
numbers in the dogfood document.

### Design note: surf and run-up (6.1, approved)

**What the island needs.** Revision 6 has three displacement waves with a
combined height of about 0.27 m and a 0.6 m shoreline foam band. Real swell
that small would not break, so surf cannot come from the physical wave
heights. It needs its own visual settings. `sampleWater` and the vertex
displacement stay exactly as they are, so floating, wading and `world_sample`
answers do not change.

**Schema.** An optional `water.surf` record. Without it, a world renders
exactly as it does today, which keeps the cove, Tidemark and kinetic examples
unchanged.

```json
{"surf":{"breakDepth":1.2,"intensity":0.8,"whitewater":18,"runUp":0.35,
 "period":12.6,"direction":[-0.15,-0.989]}}
```

- `breakDepth` (0.1–10 m, default 1.2): the swell breaks where the water depth
  first falls below this along its direction of travel.
- `intensity` (0–1, default 0.8): the foam amount at the break line.
- `whitewater` (1–80 m, default 18): how far broken foam carries shoreward
  before it fades.
- `runUp` (0–3 m, default 0.35): the vertical height swash climbs above the
  water level on open beaches. Its horizontal reach follows from the slope, so
  rock gets a short reach and gentle sand a long one.
- `period` (2–30 s): the time between sets. The default is the first wave's
  wavelength divided by its speed (12.6 s on the island), else 9 s.
- `direction` (unit vector): the default is the first wave's direction.

**Surf map.** A pure module, `src/world/surf.mjs`, builds a 512×512 RGBA map
over the terrain bounds from the CPU heightfield. It is computed once per
terrain, water and surf change, the same way the layer mask is. The swell is
marched along `direction` from the offshore edge:

- R is break strength. It peaks where the depth first crosses `breakDepth`,
  rising faster where the seabed climbs steeply, as at a reef rim.
- G is the distance shoreward since the last break, used to fade whitewater
  over `whitewater` metres.
- B is the swell energy that remains. It is 1 offshore, drops behind a break,
  and only recovers gradually over deep water. A lagoon behind the reef
  therefore gets small swash, and an exposed beach gets full swash.
- Terrain outside its bounds counts as deep (the base height), so the map edge
  never breaks.

The module is shared by tests and the browser. Its order-dependent sweep
visits each texel once, in order along the swell direction, at about 0.26 M
texels.

**Rendering.** No new draws and no new render passes; one data texture is
added to each of the two materials.

- **Ocean shader (reef-break foam).**
  - A breaker pulse travels with `period` across the break line.
  - Whitewater trails behind it, advected by the same phase and faded by G.
  - It is broken up by the existing ocean detail foam channel.
  - It uses the same foam colour and alpha path as the shoreline foam, which
    stays as it is.
- **Terrain shader (swash).**
  - Above the water level, a swash front rises to `level + runUp × B` and
    falls back each period. Uprush takes about a third of the period and the
    backwash the rest. The front is offset along the beach by the detail
    noise, so it does not climb as one straight line.
  - The front carries a thin lace of foam.
  - Sand below the front darkens and turns glossy, using the wet-sand colour
    and low roughness. It dries over about one period after the backwash.
  - The existing wet band stays as the lower bound.

**Checks.**
- `surf.mjs` tests on a synthetic profile (deep, reef rim, lagoon, beach):
  - the break line sits at the reef rim;
  - the lagoon keeps low energy;
  - the beach gets reduced swash;
  - no break at the map edge;
  - deterministic output;
  - the direction rotates the result.
- Validation and `world_read` text tests: `capabilities.waterRendering` stops
  saying there is no reef-break surf or beach swash, and an example is added.
- Hub captures from the arrival, overlook and a beach close-up on both
  backends:
  - before is the revision 6 copy, after is the same copy with `water.surf`;
  - draws and triangles should match the baseline, with p95 at refresh.

### Design note: sky gradient and clouds (6.2, approved)

**What the island needs.** The sky is three.js's analytic `SkyMesh` with fixed
turbidity and scattering, and its built-in clouds are turned off. The distance
fog and the clear colour use `fogColor`. The water reflects a separate
hard-coded gradient: `fogColor` toward `#9cc9e6` at the horizon, and `#3f7fbf`
overhead. Three different horizons meet in the overlook view, which is why it
reads flat grey.

**Schema.** An optional `environment.sky` record. Without it, the current
analytic sky stays exactly as it is, so existing worlds and examples do not
change.

```json
{"sky":{"zenithColor":"#3d7fc4","horizonColor":"#d6e5ec","curve":0.45,
 "sunDisc":1,"clouds":{"coverage":0.35,"density":0.5,"height":0.5,
 "scale":1,"drift":[0.6,0.2]}}}
```

- `zenithColor` and `horizonColor` (hex): the two ends of the gradient.
  `horizonColor` defaults to `fogColor`, so the distant fog and the horizon
  match unless the author sets them apart.
- `curve` (0.1–2, default 0.45): how quickly the gradient moves from horizon to
  zenith, as an exponent of elevation.
- `sunDisc` (0–2, default 1): the brightness of the sun disc and its glow,
  tinted by `sunColor` at `sunPosition`.
- `clouds` (optional):
  - `coverage` (0–1, default 0.35);
  - `density` (0–1, default 0.5);
  - `height` (0–1, default 0.5): low clouds sit closer to the horizon;
  - `scale` (0.25–4, default 1);
  - `drift` (m/s, each component within ±5, default [0.6, 0.2]).

  Clouds are lit by `sunColor` from `sunPosition`, with the gradient as
  ambient light.

**Rendering.** When `environment.sky` is present, a Holodeck sky material
replaces `SkyMesh` on the same dome, so it is still one draw:

- the gradient by elevation;
- the sun disc and glow;
- procedural cumulus.

The cloud noise follows the `SkyMesh` approach in three 0.186.1: a sine-free
hash, fbm and Beer's-law opacity, faded at the horizon. It is ported into our
own TSL with its MIT notice kept, so lighting can use the authored colours.

The ocean shader reflects the same gradient function in place of its
hard-coded colours, so the water, fog and sky agree. Clouds are not reflected
in the water. That limitation will be stated in `world_read`.

Both backends compile the same TSL graph.

**Checks.**
- Validation tests: colours, ranges, unknown keys, and that a world without
  `sky` keeps the analytic path.
- A CPU mirror of the gradient and the horizon default, with a test that
  `horizonColor` falls back to `fogColor`.
- `world_read` `sky` and `lighting` text and an example; this part of the
  agent context is currently "no clouds and no colour or gradient fields".
- Hub captures from the arrival and overlook views on both backends, against
  the same revision 6 copy:
  - one copy with only `sky.zenithColor` set and the horizon defaulting to the
    fog colour;
  - one copy with clouds;
  - draws unchanged, p95 recorded.

**Decisions to confirm:**
- Surf and sky are opt-in records (`water.surf`, `environment.sky`). Existing
  worlds and examples render unchanged. The alternative is to turn them on by
  default and re-baseline every example capture.
- The sky becomes a Holodeck gradient material when `sky` is set, rather than
  exposing `SkyMesh`'s physical turbidity, Rayleigh and Mie parameters and its
  own clouds. Colours are what agents and authors name. The physical
  parameters make the horizon and fog hard to match, and the water reflection
  could not follow them.
- Surf is visual only. Waves in the lagoon are not damped, and `sampleWater`
  is unchanged. Damping would change the shared CPU and GPU wave equation and
  the actor physics, and is left for later.
- Clouds are not reflected in the water, and do not cast shadows.

### Design note: underwater tint on placed objects (6.3, H34, approved)

**What the island shows.** The water colour of submerged ground comes from
`makeTerrainMaterial` in `src/world/landscape.jsx`:

- two-way Beer–Lambert transmission, `exp(-2 × depth × (0.9, 0.16, 0.11))`;
- scatter from `shallowColor` to `color` over 1.5–9 m;
- caustics from two drifting detail samples.

Here depth is the wave height minus the fragment's height. Placed GLBs keep
their own materials, so a coral head two metres down renders as if it were
dry. The turn 6 agent baked a tint into each coral group's albedo at its
median depth, so the shallow brain-head domes still read pale at the surface.

At revision 8, 101 placements of 11 assets sit below or at the water line:

- coral: brain heads, rubble, staghorn and table;
- rocks: beach, cliff and reef.

**Shared node.** A new browser-only module, `src/world/underwater.js`, holds
one TSL function:

```js
underwater(albedo, {water, clock, detail, environment})
// -> albedo carried through the water column at this fragment
```

- It takes depth from the fragment's own world position and the analytic
  wave height at that point, the same `waveNodes` the ocean and terrain use.
  The waterline therefore moves on posts and rocks as the waves pass.
- The terrain material calls it in place of its inline terms, so the seabed is
  unchanged. Hub numbers and captures confirm that.
- Placed objects call it on their diffuse colour. An object and the seabed
  under it get the same tint at the same depth, so coral reads as part of the
  reef rather than pasted on.
- The shallow-water colour default differs today: `#4fd2cf` for the seabed
  scatter and `#68bcb2` for the ocean body. Each keeps its own default; only
  the code is shared.

**Which materials.** At load, an asset's materials are converted when any
placement of it can reach below the highest wave crest. This includes scatter
instances and is judged from each placement's world bounding box (GLB bounds
× transform) against `water.level` + the sum of wave amplitudes + 0.15 m.

- Each such material is converted to its node equivalent with the same
  properties.
- Its colour node becomes `underwater(map × colour × vertex colour)`. The
  material's own vertex-colour multiply is turned off, so the scatter term is
  added after it.
- Converted materials are shared by every placement of that asset, above or
  below the water, like the existing instanced batches. Above the waterline
  the node blends to the original colour, so dry instances look the same.
- Assets that never reach the water are untouched. That keeps the extra
  shader cost and compile time to the materials that need it.
- Shadows are unaffected, since the colour node does not run in the shadow
  pass.

**Interaction with the ocean surface.**
- The surface keeps setting its body colour and opacity from depth to the
  terrain: translucent in the shallows, opaque past about 6 m.
- Over an object, the surface therefore veils it as if it lay on the seabed.
  The object pixel and the seabed pixel beside it get the same veil, so they
  stay consistent. The object's own absorption carries the depth difference.
- The cost: a coral top 0.5 m down on a 4 m seabed is veiled as if 4 m deep.
  Its own absorption is light (0.5 m), and the surface layer stays the same as
  around it.
- Reading the true depth would mean a scene-depth texture on both backends.
  That is the pass the ocean was built to avoid for WebGL2 stability, so it is
  left as a measured follow-up, not part of this change.

**Cost.** Only for converted materials, per fragment:

- the wave height, a sum of up to four sines;
- one `vec3` exponential and two mixes;
- for caustics within 55 m of the camera, two detail-texture samples, using
  the terrain's existing texture.

Draws and triangles do not change. Converting 11 assets adds their node
programs; they replace the classic-material conversions the renderer already
does, so the program count stays about the same. Ready time is recorded on
both backends, because pipeline compile time is where a cost would show.

**Contract.**
- `world_read` `waterRendering` says placed objects below the water are tinted
  automatically.
- The integrate-asset skill says not to bake underwater tint into albedo.
- No schema change.

**Checks.**
- A CPU mirror of transmission and scatter, `underwaterColor(albedo, depth,
  water)` in `src/world/water-optics.mjs`, with tests:
  - zero tint above the water;
  - red absorbed first;
  - the seabed and an object at equal depth get equal colour;
  - the conversion predicate from bounds.
- The terrain refactor checked against the baseline captures on the revision 8
  copy.
- Hub captures of revision 8 from the arrival view, the reef close-up and the
  overlook, before and after, on both backends.
- The same revision 8 copy with the coral's baked tint left as it is, since
  removing it is the agent's call. A note records how much the bake now
  double-darkens.

### Design note: sectioned world_read (6.4, H35, approved)

**What the island shows.**
- Rebuilding `world_read` from the revision 8 `world.json` with this branch's
  tools gives 188.5 KB. The dogfood figure of 182 KB came from the live host,
  before Phase 3's capability text.
- The world is 152 KB of that, and its 561 objects make up 121 KB, at about
  216 bytes each. Capabilities are 26.5 KB, of which `runtime` (3.4 KB)
  duplicates `scene.runtime`. The asset hash map is 6 KB and the file list
  3.4 KB.
- Claude Code saved the result to a file under `~/.claude`, so the agent asked
  to read the user's home folder to see its own world. Phase 4 keeps such
  reads asking every time, so this has to be fixed at the source.

**Shape.** `world_read` takes an optional `section`, plus `asset` and `cursor`
for objects. With no arguments it returns the overview, so "call `world_read`
first" still works. Each response states its section, the revision, and an
index of the other sections with their sizes.

- **`overview` (default):**
  - the scene settings without `objects`: environment, terrain, water,
    runtime, origin, bridge, mood board, the scene asset list and the scatter
    records;
  - objects grouped by asset: count, layers, position bounds, and how many
    have behaviours or colliders;
  - the bible and the reference metadata;
  - capability headings.

  About 37 KB at revision 8. Objects make up the growth, and the grouping
  grows with the number of assets, not placements.
- **`capabilities`:** the Phase 1.6 contract, word for word. The duplicate
  `runtime` is dropped because the overview carries it. About 23 KB.
- **`objects`:** placements in scene order, optionally filtered by `asset`.
  Pages are capped at 32 KB with a `cursor` for the next page: about 150
  objects per page, so four pages at revision 8. Scatter expansions are not
  listed; the records are in the overview, and `world_sample` resolves single
  instances.
- **`files`:** the importable files and the hash of each scene asset, about
  9.5 KB.

**Size cap.** Every section response is held under one byte cap, by design
and by a test. The cap is set from a measurement: at build time, a probe MCP
tool returning 16–128 KB is run through Claude Code 2.1.300 to find the size
at which it saves the result to a file instead of returning it. The cap is
then set at half of that, or 40 KB if the measurement is higher. Codex and
Cursor get the same sections, since they share `callWorldTool`.

**Compatibility.**
- `world_propose` and `sceneFile` staging are unchanged.
- An agent rebuilding a whole scene reads the objects pages, or reads
  `world/world.json` in its own world folder from a design script. That stays
  inside the folder, and the Phase 4 exact-command grant covers reruns.
- The adapter instructions and `holodeck-author-world` say so.
- Phase 1.6's contract answers keep their test, which now reads the
  `capabilities` section.

**Checks.**
- `server/world-tools.test.mjs`:
  - a synthetic 2,000-object, 64-asset world keeps every section under the
    cap;
  - paging returns every object exactly once, in order;
  - an asset filter, and an unknown section, asset or stale cursor give a
    clear error;
  - the overview has no `objects` field and its summary counts match;
  - the existing Phase 1.6 capability assertions pass against the
    `capabilities` section.
- The revision 8 sizes per section are recorded in the dogfood document.
- No rendering change, so the hub run is the usual check.

**Decisions to confirm:**
- The tint applies automatically to assets that reach the water. There is no
  opt-in, because H34 is a correctness gap, and example worlds with submerged
  placements change accordingly.
- The ocean surface keeps depth-to-terrain. Real depth through a depth texture
  is a separate, measured follow-up.
- `world_read` with no arguments returns the overview. The full scene
  inline is gone; objects come by page.
- The cap is set from the measured Claude Code limit, at half of it and at
  most 40 KB.

**Phase 6 decisions (approved with the defaults):** surf and sky are opt-in;
the underwater tint is automatic; `world_read` returns an overview with paged
sections; build order 6.4, 6.3, 6.1, 6.2.

**As built, 6.4.**
- **Limit.** Measured with a probe MCP tool through Claude Code 2.1.300 and
  world-like JSON: 16, 40 and 48.5 KB arrived inline; 56, 64, 96 and 128 KB
  were saved to a file under `~/.claude`. So the limit falls between 48.5 and
  56 KB, about 25k tokens. The cap is half of that: 24,000 characters per
  response (`WORLD_READ_LIMIT` in `server/world-read.mjs`).
- **The overview** is 20 KB at revision 8. It has no `assets` list (12 KB
  there), so the sections are: `overview`, `scene`, `bible`, `objects`
  (optional `asset`), `scatters`, `assets` (with pinned hashes and terrain
  textures), `files`, `references` and `capabilities` (`spatial.` keys
  flattened).
- **Paging.** Every list pages by bytes, with a cursor `r<revision>:<index>`
  that is refused once the world changes. An oversized bible, then the scene
  settings, move out of the overview rather than break the cap.
- **Revision 8 sizes:** objects in 6 pages (largest 23 KB), capabilities in 2
  (22.9 KB).
- **Tool contract.** The Codex dynamic tool contract moved to version 5, so
  saved threads restart with the new `world_read` schema. Phase 2's
  `proposalId` additions had not bumped it.

**As built, 6.3.**
- The shared function is `waterColumn` in `landscape.jsx` rather than a
  separate module. It sits beside `waveNodes`, which it needs.
  `createUnderwaterTint` converts materials there too.
- The CPU mirror and the bounds test are in `src/world/water-optics.mjs`.
- `RuntimeScene` builds tinted copies of the assets that reach the water;
  the loader's cached models stay untouched.
- Vertex and instance colours still multiply after the tint, as in any node
  material.

**As built, 6.1.**
- The surf map's swash channel is the swell in the last water at least
  `breakDepth` deep. With raw energy, a sheltered and an exposed beach both
  reached the same depth-limited value at the waterline, which a test caught.
- Breaking cuts the swell to `depth / breakDepth`.
- **Break strength.** It was first the loss per metre alone. On the island
  that left 89% of breaking texels under 0.2, and the rim (5 m shoaling to
  0.9 m over about 12 m) barely showed. Strength is now the arriving swell ×
  min(1, 0.6 + loss per metre × 2.5) wherever the swell is actively breaking,
  and the ocean foam weights were raised.
- **Result.** From the overlook, whitewater now reads across the lagoon
  shallows and along the beach. The outer rim is still a subtle pale ring,
  because its break zone is a few metres wide at 250 m. The map builds in
  134 ms on the PC.

**As built, 6.2.**
- An authored sky is a 48×24 sphere at 10 km with its own node material. It
  replaces `SkyMesh` only when `environment.sky` is set.
- The cloud noise is ported from `SkyMesh`, with the plane, drift and scale
  in metres. Its fbm is unrolled in JavaScript.
- **First hub captures showed no sky on either backend.** The dome sat at
  10 km, beyond the camera's far plane of 160–600 m. It now pins its vertices
  to the far plane (`z = w`), as `SkyMesh` does.
- **Cloud size.** The first clouds read as fine speckle, so the base cell grew
  from 500 m to 1,500 m (5,000 m for coverage regions).

### Design note: walkable colliders (6.5, H36, approved)

**What the island shows.**
- In turn 7 the jetty's three decks, platform and stair all have box
  colliders, but you cannot walk out on the jetty: the colliders only stop you
  wading through the posts.
- The agent declined to fake it with hidden terrain ramps. The shelter works
  only because its floor is level with the sand.
- The cause is in `supportAt` (`src/world/inhabitant.mjs`), which takes
  footing from the terrain sample alone. Placed colliders only block, through
  `WorldRuntime.collisionAt`.

**The test case: the revision 9 jetty.** It runs from about (−54, 39) to
(−45, 47). Every piece has yaw −0.733 and scale 1, and the water level is
−2.5.

| Piece | Walkable box | Top | Under it |
| --- | --- | ---: | --- |
| `jetty-deck-001` | 3 × 0.3 × 1.86 | −1.85 | sand at the shore end, wet sand at the far end |
| `jetty-deck-002` | same | −1.85 | 0–0.28 m of water |
| `jetty-deck-003` | same | −1.85 | 0.28–0.5 m of water |
| `jetty-platform-001` | 3 × 0.3 × 3.06 | −1.85 | 0.5 m of water |
| `jetty-stair-001` | three 0.3 m treads | −2.14, −2.42, −2.71 | 0.5 m of water |

- The deck tops are 0.65 m above the water. Their undersides are at −2.15.
- The treads are 0.29 m apart, inside `MAX_STEP` (0.35 m).
- The posts and platform rails are separate boxes in the same compound
  colliders. Their tops are 0.42–0.46 m above the deck, so they stay walls.

**Proposed shape.** A collider box takes an optional `walkable: true`. On a
compound collider the flag goes on each box, so a deck box can be walkable
while its posts are not.

- **Support.** The walker's support at (x, z) is the highest of:
  - the terrain;
  - every walkable box top whose footprint contains (x, z) and which is no
    higher than the current feet plus `MAX_STEP`. While airborne, only tops
    at or below the current feet count, so you land only on a surface you
    cross.
  - A box top has normal (0, 1, 0) and slope 0.
- **Footprint margin.** The footprint is the box's top rectangle grown by
  0.1 m. This bridges seams between pieces. In the prototype, without the
  margin, the walker fell through the 2 cm gap between the platform and the
  stair.
- **Step-up and step-down.** These use the existing limits: you climb a top
  within `MAX_STEP` and refuse anything higher.
- **Treads are not walls.** A walkable box whose top is within `MAX_STEP` of
  the candidate feet does not block. Otherwise the walker's 0.22 m radius
  meets the next tread before its centre reaches the tread's footprint, and
  stairs never climb. Every other box blocks exactly as today.
- **Falling off edges.** Walking off a deck side finds the seabed or sand more
  than `MAX_STEP` below, so the existing fall rule makes the walker airborne,
  and it lands on whatever is under it.
- **Water depth** is measured from the chosen support. On a deck it is 0, so
  you are dry and grounded 0.65 m above the water. Beside the jetty it is the
  seabed depth, as now.
- **Wading and swimming beside and under a deck.**
  - Under a deck, the existing vertical overlap test applies to the body
    height. A wader (1.82 m) under any revision 9 deck is blocked by the deck
    box, because the seabed is at most 0.85 m below the underside.
  - A swimmer's body is 1.35 m tall with its feet 1 m below the surface. It
    passes under a deck only where the underside is more than 0.35 m above
    the surface. The revision 9 decks are at exactly 0.35, and their water is
    wading depth anyway.
  - You cannot climb from the water onto a deck 1.15 m up, and a jump (apex
    0.81 m) does not reach it. You leave the water by the stair. The bottom
    tread is 0.29 m above the seabed.
- **Rotated boxes.** Yaw only, as `collisionAt` does today, in the same local
  frame with offset and scale.
  - Validation will refuse `walkable` on a placement with pitch or roll,
    because the collider ignores those and the top would not match the mesh.
  - It will also refuse `walkable` on a placement with a behavior. Carrying
    the walker on a moving or rotating object is a separate item.
  - Sloped walkways stay out of scope; author them as stairs or terrain.
- **Where it lives.**
  - `WorldRuntime` keeps a list of walkable boxes, rebuilt on reconcile, and
    answers `walkableAt(x, z, maxTop)` → `{height, id}` or null.
  - `supportAt` takes it through the context it already receives from
    `runtime-scene.jsx` and `server/coherence.mjs`.
  - Patrols use the same query, so a patrol route can run along a deck.
- **`world_sample` and `world_check`.**
  - A sample reports `supportSource: 'collider'` with `supportId` when a
    box top is the footing.
  - It lists every level at that point in `levels`, for example the deck
    at −1.85 and the seabed at −3.0, each with its source and ID.
  - The requested y picks the level: the highest at or below y +
    `MAX_STEP`. That gives a meaning to the y the tool now only "retains for
    context".
  - Route samples carry the previous sample's feet, as they already carry the
    swim mode, so a route along the jetty stays on the deck. A step down of
    more than `MAX_STEP` is reported as a drop.
  - The sentence in the limits about placed meshes not being support changes
    to name walkable colliders.
- **Agent guidance.** The `world_read` capability text, the author-world
  skill and `docs/terrain-and-inhabitants.md` describe the flag, the margin,
  the step rule and the swim clearance.
  - Setting the flag on the island's jetty is a world edit, so it is the
    island agent's call. This branch changes no world.

**Prototype (scratch only, not in the repository).** I ran a patched copy of
`inhabitant.mjs` against revision 9 in Node, with the jetty's deck boxes and
three treads marked walkable:
- From the sand, the walker crosses all three decks and the platform at
  −1.85 and stays grounded and dry.
- It steps down the treads to −2.14, −2.42 and −2.71 (wading at 0.25 m), then
  onto the seabed at −3.0 (0.54 m).
- The reverse walk climbs the stair and returns to the sand.
- Walking off the side of deck 2 falls and lands wading at 0.11 m.
- A jump on the deck lands back on it.
- Wading at deck 3 from the side is blocked at its edge.

**Cost per frame.**
- **CPU.** At 60 fps a walker takes one or two sub-steps a frame. That is at
  most 5 support queries and 4 collision queries. At the 0.1 s frame cap it is
  17 and 16.
  - Measured on the PC (Node 24) at revision 9: a full collider scan
    (`collisionAt`, 294 boxes on 567 placements) costs 24.5 µs per miss. The
    support query over the 7 walkable boxes costs 0.29 µs.
  - The flag adds under 2 µs a frame (5 µs at the cap).
  - Treating every collider top as support with no index would add a full
    scan per support query: about 125 µs a frame, or 425 µs at the cap, on the
    PC.
  - The existing collision queries already cost about 100 µs a frame. A
    spatial grid for them is not part of this item, unless the hub shows
    frame time moving.
- **GPU.** None. Nothing renders differently; draws and triangles stay the
  same.

**Tests and acceptance.**
- An independent jetty fixture in `src/world` tests: decks, a stair and a
  post. Tests cover:
  - stepping up and down treads;
  - the seam margin;
  - falling off a side;
  - landing from a jump;
  - wading blocked under a deck;
  - a swimmer passing under a high deck and blocked under a low one;
  - a post that stays a wall;
  - validation refusing pitch, roll and behaviors;
  - `world_sample` levels and route feet.
- Existing worlds have no flag, so their samples stay identical. A coherence
  test on the cove proves it.
- **On the hub:**
  - a scratch copy of revision 9 with the jetty flagged and the spawn on deck
    2, on WebGPU and WebGL2. The arrival view should stand on the deck.
  - the unflagged copy should render pixel-identical to the last Phase 6
    capture, with draws, triangles and p95 unchanged.

**Decisions for the user.**
1. **An explicit `walkable` flag (recommended) or every collider top.**
   - The flag keeps existing worlds identical and keeps rock and crate
     bounding boxes from becoming plinths. It also makes the support query
     cheap.
   - Every top needs no authoring, but it changes how current worlds walk.
     Any box within 0.35 m of the feet becomes a step, and it needs an index
     to stay cheap.
2. **Patrols use the same support (recommended) or stay terrain-only.**
3. **Refuse `walkable` on moving objects (recommended)**, or allow it without
   carrying the walker.

**6.5 decisions (approved with the defaults):** an explicit per-box `walkable`
flag; patrols use the same support; `walkable` is refused on placements with a
behavior, as well as with pitch or roll.

**As built, 6.5.**
- **Runtime.** `WorldRuntime` (`src/world/runtime.mjs`) keeps the walkable
  boxes in a list built at reconcile, with `WALKABLE_MARGIN` = 0.1 m. It answers
  `walkableAt(x, z, maxTop)` and `walkableLevels(x, z)`. `collisionAt` and
  `blocked` take an optional `stepUp`: a walkable box whose top is within
  `stepUp` of the feet is skipped. The default of 0 keeps every other caller,
  including the camera probes, as before.
- **Walker.** `supportAt` (`src/world/inhabitant.mjs`) takes `walkable` from
  its context and an optional `maxTop`. The default is the feet plus
  `MAX_STEP`, or the feet themselves while airborne.
  - Moves pass `stepUp` = `MAX_STEP` on foot and 0 in the air or when falling.
    Without that, an airborne walker could slip into a deck's side.
  - `inhabitantContext(runtime, radius)` builds the context, so the two call
    sites in `runtime-scene.jsx` share it.
- **Patrols** take support from the same query, starting from their authored
  feet. Their signature includes the walkable list, so adding a deck under a
  patrol restarts it.
- **Validation.** Every collider was already yaw-only. Validation adds:
  - boolean `walkable` on schema 2 colliders and compound boxes;
  - a refusal on placements with a behavior.
  - Scatter colliders keep their strict keys, so they cannot be walkable.
- **Probes.** `world_sample` and spawn read y as an eye height, as routes
  already did.
  - `supportId`, `supportHeight` and `levels` appear only where walkable tops
    exist, so unflagged worlds sample exactly as before.
  - `terrainHeight` is now always the terrain, and the feet give the support.
  - Routes carry the previous feet and report `drop`.
- **Agent text.** It is in the `spatial.colliders`, patrol and `world_sample`
  descriptions, `docs/terrain-and-inhabitants.md` and the author-world runtime
  reference. The Codex tool contract stays at version 5: only descriptions
  changed, not schemas.
- **Cost.** Measured in Node on revision 9 with the jetty flagged:
  - a walkable query takes 0.1 µs;
  - a full collider miss takes about 29 µs before and after;
  - one walker frame takes a median of 114 µs while walking the jetty into the
    water.
- **Not done.** No browser walk on the hub. A walk script that served its own
  world under the GPU lock was refused by the permission check, so the hub
  evidence is the arrival view (the walker's eye at spawn), and traversal is
  covered by the Node tests and the revision 9 walk.

## Order and handoff

Do the phases in order. Within a phase, items are independent unless noted.
After each phase:
- report what changed, the test counts and the browser numbers;
- report what was skipped and why;
- stop for the user's review before committing.
