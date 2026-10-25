# Dogfood: marble sanctuary through the interface

This records the second end-to-end authoring pass, started 2026-10-23: a new
scene built only through the Holodeck browser interface and a connected local
agent, from a six-image reference pack and a short brief. Like the
[tropical island pass](dogfood-tropical-island.md), it turns friction into
fixes and follow-up work for Holodeck and Kiln. It is a working log, not a
qualification of art, routes or performance.

## Setup

- World: a fresh construct world at `holodeck-worlds/marble-sanctuary`,
  created with `holodeck init` and served with `holodeck dev` on port 4191.
  The host runs from an isolated copy of the dogfood branch, so edits to the
  branch never restart a running agent turn; the copy is synced between turns.
- Agent: **Connect → Claude Code** on the user's Claude subscription, exact
  model `claude-opus-5-5` (listed under exact model IDs) with reasoning effort
  `max`.
- Input: a dogfood input pack (`input-manifest.json`, format
  `holodeck-dogfood-input-proposal/v1`) with a brief and six images: a
  user-provided hero and five AI-generated concepts (eye level, modular kit,
  asset kit, materials, layout). They are inspiration, not engine renders,
  measured plans or texture maps.
- Brief, in short: the bright, sunlit marble world of the hero, not a dark or
  neon backrooms reading. Ivory arches, a central axial gateway, turquoise
  reflective pools, greenery and golden light; floating cubes and inverted
  overhead architecture as a visual gravity illusion over an understandable
  route of terraces and pool edges at human scale. No working portals or
  gravity changes in the first version.
- Bible: written through the Bible sheet from the brief, with creative licence
  the user granted: the sanctuary floats over a sea of cloud with no ground
  below, an inverted twin hangs overhead, cubes drift at every scale, and every
  main view holds at least three readable scales. 16 rules; the hero image is
  pinned.
- Machine: the hub itself (GTX 1660 Ti with Max-Q Design, driver 615.71.09,
  Node 22.23.3, npm 12.2.0, Claude Code 2.1.269). The in-app browser pane is
  about 1024×768 CSS pixels and runs WebGL2 only (no WebGPU adapter); WebGPU
  and renderer evidence come from headed Chrome 150 on the hub.

## Fixed during this pass

| Issue | Change | Evidence |
| --- | --- | --- |
| H47: the pack importer read only `manifest.json`, so this pack's `input-manifest.json` (titles, categories, notes, provenance, hashes) was ignored and the manifest itself would have become a JSON card. | `src/world/reference-pack.mjs` also reads `input-manifest.json` and its `images` list. Each image keeps its `provenance` in the card notes (a user photo apart from generated concepts), a file whose `sha256` differs is skipped with a reason, `userBriefFile` lands as an approved **Brief** card, and a category differing from a default only in case joins it (`scene` → Scene). | `src/world/reference-pack.test.mjs` (a dogfood pack with a tampered image). The real pack planned 7 cards with all six hashes verified; imported through **Import pack**: "Imported 7 from abstract-marble-references.zip with its manifest." |
| After **Save board**, the import report still said "Save the board to keep them." | Saving the board clears the report. | Browser check. |
| H48: the first turn failed with "Failed to authenticate: OAuth session expired and could not be refreshed", and the dock still said "Claude · ready". The host had been started by an agent in the Claude desktop app and handed that session's variables to the CLI, among them `CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH=1`, which tells the CLI its host refreshes the sign-in. | `claudeEnv` in `server/claude.mjs` drops an enclosing Claude Code session's variables (`CLAUDECODE`, `CLAUDE_CODE_*`, `CLAUDE_AGENT_SDK_*`, `CLAUDE_PID`, `CLAUDE_EFFORT`, the OAuth endpoint switches and the desktop MCP tuning) when `CLAUDECODE` is set; a user's own `CLAUDE_CODE_*` settings pass when it is not. A turn that fails to authenticate now ends disconnected, with the remedy in the dock (sign in with `claude` in a terminal, then connect; the session resumes). | `server/claude.test.mjs` (26 tests). The session's sign-in had lapsed meanwhile (`claude auth status`: `loggedIn: false`, with or without those variables), so the user signs in again; Holodeck never handles Claude credentials. |
| Before any provider connected, the composer was labelled "Message Codex". | It reads "Message your agent" until a provider connects. | `scripts/world-probe.mjs` finds the composer by its `Message` prefix. |
| H49: a pool needs reflections of the sky and the architecture, and mirrors and polished marble had nothing to reflect: lighting was the sun and a fixed hemisphere light, with no environment map, so a metallic mirror cube or orb rendered black. | Optional `environment.sky.light` `{intensity?, probe?}` (`src/world/landscape.jsx`, `SkyLight`). The dome alone (without its sun disc, which the sun light already supplies) is captured first and bound as the environment, then the world is captured twice from the probe point (default the spawn), each lit by the last, without the cove, the maker or proposal ghosts. A capture renders to a scratch target and a quad draws it into the bound target, because a new environment texture rebuilds every lit program (on WebGL2 that looped captures and recompiles). It replaces the hemisphere fill. With a sky light the ocean reflects the probe instead of the analytic gradient and composites reflection exactly (`R·reflection + (1−R)(a·body + (1−a)·behind)`), so still water mirrors at grazing angles even when shallow. | `src/world/sky.test.mjs`. Lab world on the hub GPU (`holodeck-hub/marble-lab`): without the sky light the mirror cube, brass cube and mirror orb are black; with it they reflect the sky, the clouds, the floor, the pool and the other probes. WebGPU and WebGL2 agree within 1–2 levels on the orb, brass and ground; one mirror face reflecting a reflection differs by about 15 levels, because WebGL2 takes one more capture while programs link. The page probe reports `skyLight.captures`. |
| A single probe overfills: at intensity 1 the sunlit floor under the probe lights walls and undersides more than the sky lights tops, and a pale world reads milky. | The default intensity is 0.6, and the capability text says to lower it when a world reads flat and raise it for brighter mirrors. | Lab captures at 1.0 and 0.6. |
| H50: a floating world had nothing below the horizon but the fog colour. | Optional `environment.sky.cloudSea` `{height, coverage?, scale?, drift?}`: from above that height the dome below the horizon becomes a sunlit deck of cumulus tops (billow heads of a few hundred metres carrying billows of about 85 m, thinned in broad regions, lit and shaded toward the sun), dissolving into the horizon haze. The deck is drawn at infinity, so a scene fog node fades anything below its height into the deck's colour over about 12 m: a cliff, foundation or waterfall that drops through it disappears into the cloud. | `src/world/sky.test.mjs` (`cloudSeaReach`). Lab overlook: a mesa floating over the deck, its cliffs sinking into it, on both backends. |
| H51: the seabed tint, caustics and wet band applied to any terrain below `water.level`, and placements were tinted when they reached below the level anywhere, although the walker's water samples already stop at `water.bounds`. A raised pool turned the cliffs under it turquoise. | `waterColumn` and the wet band in `src/world/landscape.jsx` are masked to `water.bounds`; `underwaterAssets` in `src/world/water-optics.mjs` requires a placement's world extent (now `placedExtent`, full rotation) to overlap the bounds. | `src/world/water-optics.test.mjs`. Lab overlook: the mesa cliffs below the pool level are stone, not turquoise. |
| Still water could not be still: the ocean's detail ripples had a fixed strength, so a pool with millimetre waves still scattered its reflection. | Ripple detail scales with the summed wave amplitude below 10 cm (to at least 6%); seas of 10 cm and more, including Crescent Cove (13.5 cm) and Tidemark (19.5 cm), are unchanged. | Lab pool views before and after. |
| H55: the brief's waterfalls and overflowing pool lips had no way to move; a static sheet reads as glass. | Optional `asset.flow` `{nodes, speed:[u,v]}` (`src/world/flow-contract.mjs`, `src/world/asset-flow.mjs`), modelled on the foliage contract: the named mesh nodes get one shared copy of their material per speed whose material-wide UV context moves every map (colour, normal, emissive, alpha, roughness) by `speed` UV units per second, wrapped to [0,1). Shadow and environment lookups keep their own coordinates. Admission requires one mesh node with TEXCOORD_0 per name and no overlap with foliage; the contract, store, history, example bundles and static export carry the field. | `src/world/flow.test.mjs` (5 tests). Lab: a translucent 2 × 6 m sheet with UV.v down the fall changes by a mean 1.12 levels between frames 0.5 s apart while sky and ground change by 0.01 and 0.00, the same on WebGPU and WebGL2. |
| H56: the bible's floating cubes "drift or turn slowly", but moving behaviors were yaw-only (`spin`), so a tilted cube could not turn and nothing could bob. | Behavior `drift` (module `motion.drift@1`) in `src/world/runtime.mjs`: a slow bob of ±`bob` metres over `period`, an optional `spin` and a gentle two-axis `sway`, each placement out of step by a phase from its ID, at any authored rotation (inverted pieces may drift), with no collider. Its clock stops with E and runs with the activity clock; the render pose reads the leftover tick time, so motion stays smooth between fixed steps. Spin stays yaw-only. | `src/world/runtime.test.mjs` (bounds, phases, stop, validation). Lab: a tilted probe set drifting overhead changes between frames on WebGPU and WebGL2. |
| H57: the camera's far plane came only from terrain and water bounds (at least 160 m), so a compact sanctuary would clip the bible's colossal forms far away instead of fogging them. | `viewFar` in `src/world/runtime.mjs` adds every explicit placement (with a margin of eight metres per unit of scale) to that extent. Worlds whose landscape is the widest extent, such as Crescent Cove, keep their far plane. | `src/world/runtime.test.mjs`. |
| H58: with terrain present, a walkable top outside the terrain bounds inherited the terrain's out-of-bounds result, so the walker and patrols refused to move onto it. The turn 1 plan keeps terrain only under the pools and every terrace on walkable colliders, which this would have blocked. | `supportAt` in `src/world/inhabitant.mjs` and the patrol support in `src/world/runtime.mjs` treat a walkable top as in-bounds support anywhere. Where there is neither terrain nor a walkable top they still stop, so the open edge of a deck beyond the terrain is the edge of the world. The colliders capability text says so. | `src/world/walkable.test.mjs`: a walker crosses from a terrain-backed pool edge onto a deck beyond the terrain and stops at its far edge. |
| H61: the capability text never mentioned the bloom pass, and after the ocean learned to reflect the sky light probe its text still said "the ocean keeps its analytic sky reflection". The turn 1 agent ranked mirror pools and glow as its first and third gaps on that basis, and said the text contradicted the user's note. | `capabilities.lighting` states the bloom (half resolution, threshold 1.8 in linear HDR, strength .13, radius .25, ACES at exposure 1.12) and what emissive strength glows, placement light costs, and the far plane; `waterRendering`, `sky` and `limits` describe the probe reflection, the exact Fresnel compositing and the calm ripple rule. | `server/world-tools.test.mjs`. The agent read the corrected text in turn 2. |
| H64: the H40 script grant accepted an output trim written `head -n 40` but not the classic `head -40`, so a design-script run piped to `head -40` asked again. | `SCRIPT_RUN` in `server/claude.mjs` accepts `head` or `tail` with `-n N` or `-N`; a redirect after the trim still never qualifies. | `server/claude.test.mjs`. |
| H68: with the planting, a cold WebGPU load of revision 9 drew 3 frames in the 10 s after it reported ready (p50 2.6–6.1 s) and froze the first hub capture past its 180 s wait. three r186 creates WebGPU pipelines with the synchronous `createRenderPipeline`, and the GPU process compiles each one in turn before the work that uses it; Holodeck's background compile (`parallel-compile.js`) covered only WebGL2. | `enableParallelCompile` also routes WebGPU's new pipelines through three's own compileAsync path (`createRenderPipelineAsync`). Dawn compiles them in parallel, the page keeps animating, and three skips each object until its pipeline is ready, as with WebGL2's parallel links. | `src/world/parallel-compile.test.mjs`. On the hub, same export and same hour: a cold WebGPU pass drew 101 frames in 10 s (p50 33 ms) against 3. Warm passes, alternated: 293–394 frames in 8 s against 74–98, at the same steady p50 (25 ms, then 16.7 ms as load shifted). |
| H69: the static viewer and the hub harness treated a world as ready when the cove kit mounted. That can come before the world draws anything (12 s into a load, 0 draws), so benchmarks timed shader compilation and shots could catch the sky light half built. Separately, with background compiles a sky light capture skips every object whose pipeline for the probe's targets is still compiling, and that capture was drawn into the bound environment: for a few seconds, stone in shade rendered black and pools flat teal. | The runtime scene owns readiness: the cove sets `ready` only on the cove-only page. `ready` waits for three frames with nothing compiling and for the sky light. A capture is drawn into the bound target only if nothing was left compiling, otherwise it is taken again; the dome-only capture goes through the same loop; `skyLight.pending` reports progress. | Timeline on the hub (revision 9): `ready` at 21.7 s on WebGPU and 23.8 s on WebGL2, after compiles settle and both captures land, where it was 12.2 s with 0 draws before. The first frame after ready matches later frames instead of being black. Runtime, world and prototype suites pass. |
| H71: static batches split any set of placements wider than 96 m into 96 m cells for culling, so the sparse sky layer in revision 10 multiplied its draws. Seventeen marble cubes became 10 draws, seven mirror cubes 7 and nine isle bases 6. On the hub a draw costs about 50 µs a pass (H62), while a few dozen extra instances cost almost nothing. | `planStaticBatches` splits only sets of more than 32 placements (`SPLIT_ABOVE`), so a sparse set stays one instanced draw however far it spreads, and large sets still cull by cell. | `src/world/static-batches.test.mjs`. With H72 on revision 10 at the arrival: 252 → 203 draws; unpaced p50 19.5/19.1 → 16.1/15.6 ms on WebGPU and 23.4 → 18.9/21.4 ms on WebGL2, alternated in the same window. |
| H72: a double-sided transparent mesh draws twice in three.js (back faces, then front faces), so each falls or spill placement, a scrolling sheet plus a mist card, cost 4 draws. Removing the 15 flow placements from revision 10 saved 60 draws and 2–7 ms. | Flow materials set `forceSinglePass`: a thin water sheet looks the same and costs one draw. The capability text asks for single-sided mist cards. | `src/world/flow.test.mjs`; measured with H71 above. |
| H73: one sky light probe sits low over the pools so that they mirror the court, so mirrors far from it show the probe's view. Cubes over the clouds reflected planting, shaded undersides or a flat patch of zenith blue, and drifting cubes looked different from shot to shot and between backends. All four critics flagged them. | Optional `asset.reflection: "sky"`: SkyLight keeps the dome-only capture in its own target and publishes it, and lit materials of such assets get a shared copy whose `envNode` is that capture, so they reflect the sky gradient, the clouds and the deck from anywhere. It needs a sky light; not with foliage, flow, the cove style or flocks. | `src/world/reflection.test.mjs`. Lab, revision 10 with the mirror cubes marked: cubes and the h5 slab show sky and cloud instead of black, green or flat blue, the same on WebGPU and WebGL2. |
| H74: the cloud deck read as a flat neutral-grey floor meeting the sky at a hard line (critics measured RGB about 203–207, darker than the sky above it). | Brighter, warmer billow tops and lighter gaps in `cloudSeaPalette`, and `CLOUD_SEA_HAZE` widened from 0.16 to 0.3, so the deck dissolves into the horizon haze. The capability text says how far below the rim a deck should sit: at scale 1 a billow is about 85 m across, so a deck 17 m below the rim (this world) shows a fraction of one billow and still reads flat. | Lab, revision 10: the deck is brighter, and the h4 horizon is a haze band rather than a line. The flat h5 view is left to the world (lower the deck, smaller scale). |
| H75: sun shadows cover 24 m either side of the walker or view, so in the sanctuary's long axial views nothing past about 20 m casts (critic C: no shadows in the aerial, pop-in as you walk). | Optional `environment.shadow.extent` (12–120 m). The whole shadow volume scales with it (depth range, bias, edge fade) on the same 2048 map, and the box is centred half an extent ahead of the view. The default leaves every other world unchanged. | `src/world/sun-shadow.test.mjs`. Lab, revision 10 at extent 60: cypress, arcade and pier shadows across the courts in the aerial. It costs 61 more draws at the arrival (203 → 264), so it stays the world's choice. |
| H76: the critics measured shade on warm stone as violet (R−B −10 to −13 against the hero's +39). With a sky light, the fill is the probe's capture, and this probe sits low over the pools, so below the horizon it sees turquoise water rather than sunlit marble. The agent calibrated its colour model against the critics' measurements, worked out that no world setting could warm the shade, and asked for an engine control. | Optional `sky.light.bounce {color, intensity 0–2}`: a hemisphere light with no sky term and the given ground colour, so light rises from the ground, full on undersides and half on walls. It is unshadowed, and the capability text suggests 0.2–0.6. | `src/world/sky.test.mjs`. |
| H77: every world rendered with ACES at exposure 1.12. In round 2, three critics measured the top of a bright frame at about 0.87 luma (0.99 in the hero), sunlit ivory shifted to a pinkish hue (8–11° against the hero's 28°), pools at saturation 0.12–0.2 and sky at 0.21, and called it "pastel overcast". No world setting reaches past the curve. | Optional `environment.grade {toneMapping: aces\|neutral\|agx, exposure 0.5–2}`, applied while the world is shown and restored after. three's render pipeline rebuilds its output transform when the renderer's tone mapping changes. The default is unchanged, and the capability text warns that colours tuned under ACES look warmer under Neutral. | `src/world/sky.test.mjs` (validation and defaults). Lab, revision 11 at the arrival: Neutral raises mean saturation from 0.177 to 0.29, with a deep blue sky and turquoise water, and shows the agent's ACES-tuned sun as orange-peach; AgX at 1.2 reads greyer (0.153). |
| H78: a 4 px walk reticle sat at the centre of every benchmark capture, and a critic asked for UI overlays to be hidden in grading shots. | The viewer hides the reticle and aim label in benchmark mode. | Visual; captures from revision 12 on. |
| H79: every placement cast sun shadows, so the agent kept the inverted courts high and out to the sides: hung lower over the side courts, their shadows would cross the terraces. From the route they then sat mostly above the frame, and two critic rounds said the gravity illusion never lands from the walk. Critic C also asked for sky pieces to stay out of the shadow pass for cost. | Optional placement `castShadow: false` (schema 2): the placement, shape or batch stays out of the sun shadow map. Such placements batch apart from casting placements of the same asset. | `src/world/static-batches.test.mjs` (separate groups, non-casting instanced meshes), `src/world/reflection.test.mjs` (contract). |
| H80: every static export logged a 404 on first load: the viewer page links no icon, so the browser requests `/favicon.ico`. | The viewer page carries `<link rel="icon" href="data:,">`, as the authoring page already did. | Walk test on revision 12: the only console error on WebGPU was this 404. |
| H81: every critic round called the cloud deck a flat textured plane (luminance spread about 5/255 from rim to horizon, "no lit tops or shaded valleys"), and the sublime lens counted it a blocker. The deck was shaded on a plane: billows were a painted pattern, and at grazing angles their relief faded to the average. Keeping only the larger billow heads further out changed almost nothing (spread 4.97 → 5.01), and a first heightfield of the heads alone came out smoother than the plane. | Near the camera the deck is now a heightfield of the full billow field, up to 0.8 billow-widths tall. The view ray is marched through that layer in 16 steps, and the hit is shaded by its slope (crowns toward the sun, valleys in shade, nearer billows hiding farther ones). It blends back to the plane shading between 6 and 15 billow widths, where relief no longer shows. | Lab, revision 12 on both backends without errors: from the rim the near deck reads as rolling lit billows instead of a flat pattern; from the aerial as rolling forms, a little dune-like. Cost is ALU only, about 180 noise evaluations per deck pixel. |
| H82: the hero's pools are crisp mirrors of the architecture. Ours reflected the sky light probe: one 256 px cube seen from a single point, so pool reflections were soft and slightly misplaced, which critics read as "pale mint, milky". | Optional `water.reflection: "planar"`: the ocean material samples three's `reflector()`, a second view of the scene mirrored in the water plane at half resolution, updated once per frame and hidden from its own pass, with its lookup nudged by the ripple normals. It replaces the probe as the water's reflection, while the probe still lights everything else and the analytic sun glint stays. | `src/world/terrain.test.mjs`. Lab, revision 12 on WebGPU and WebGL2 with no errors: piers, arches, the gateway's lit slots and the orb reflect sharp and in place, and the backends match. Draws at the arrival roughly double (220 → 425), so it stays opt-in. |
| H83: the post pipeline had only bloom. Critics flagged missing contact shading ("placed on the floor rather than resting on it") and sub-pixel crawl on bevels, brass inlays and stair edges. The user asked for the professional techniques the pinned three (0.186.1, the latest release) already ships. | Optional `environment.effects` in the shared pipeline: `occlusion` (GTAO at half resolution from the scene's normals and depth, applied to the lit frame), `temporalAA` (TRAA from a velocity output, with multisampling off), and `sunShafts` (three's godrays through the sun's shadow map, bilateral-blurred and blended depth-aware, kept off the sky). GTAO read through a multisampled depth target finds almost nothing (about 1 level at a 6 m radius), the reason the first attempt was reverted; with a single-sampled pass it gives about 6 levels of real contact darkening. So `occlusion` brings `temporalAA` with it. | `src/world/effects.test.mjs`. Lab, revision 13 on WebGPU and WebGL2 without errors: AO grounds wall bases, risers and planters, though it slightly greyed the foot of the transparent falls (fixed in H90). Sun shafts first came out black, because `depthAwareBlend` samples texture nodes and was given a blur node; fixed. Beyond the shadow box they lay a milky veil over the architecture, so the capability text advises a low value or none in long open views. |
| H84: three renders a light's shadow map once per camera per frame. Planar water (H82) renders the scene through a second, mirrored camera, so the sun's shadow pass ran twice a frame for one box that follows the walker or the view, not the camera. Each face of a sky light capture repeated it too. I also tried cascaded shadow maps (three's `CSMShadowNode`, bound to the view camera, 3 cascades to 200 m) for long views. | The sun's shadow map now renders once a frame, whichever camera renders first. Cascades were not adopted: on revision 13 they changed nothing visible in the four long views (box and cascades near-identical: the far faces seen from the route face south, away from the north-west sun, so they sit in their own shade with or without cast shadows), cost 2.2× the draws (222 → 484 at 01-arrival), and three picks the cascade from the depth of whichever camera renders. The sky light's cube faces then miss most shadows and the brighter capture lifts shade by 12 levels (152 → 164 at 03-head-f1), against the critics' call for deeper shade. Cascades would need a camera-independent lookup before they are worth offering. | `src/world/sun-shadow.test.mjs`. Lab A/B on revision 13 with `water.reflection: "planar"`, 01-arrival: 429 draws with per-camera shadows, 302 with once a frame, on WebGPU and WebGL2 alike, with no errors. Without planar water the box mode matches the hub's revision 13 shots, with shade within 0.2 levels. Cascade comparison in the lab run `*-csm`. |
| H85: the sublime critic's round 3 report said the mirror cubes don't read as mirrors. With `asset.reflection: "sky"` (H73) each face reflects the dome alone, so it is a flat fill of blue or beige-grey, and the cubes read as glass display boxes or lanterns. The alternative, the sky light's single probe low over the pools, shows cubes high in the air the court's planting and shaded undersides. | `asset.reflection: {probe: [x, y, z]}`: the sky light captures the world once more from each distinct point, after its own captures and lit by them, and binds that capture to the asset's lit materials. Each point's target starts as the dome and is filled before the page reports ready, and placements of one asset still batch as one draw. The agent can give mirror groups their own variant and point, keeping far monoliths on `"sky"`. The capability text says a flat face shows a slice of the capture, not a parallax-exact view. | `src/world/reflection.test.mjs` (points, store, binding, validation). Lab on revision 13 with `cube-mirror` reflecting a point 20 m over the court, h1, h4, h6 and h7 on WebGPU and WebGL2: one more capture (3 against 2), the same draws, no errors, and backends within 1.6/255. In h6 the faces show stone, the undersides of the hanging courts and the sky, where before they were flat beige and blue. |
| H86: a regression from H81, found in revision 13's rim view (h5): a grainy patch of blue-grey dots on the deck, a different density on each backend, drifting with the clouds. Isolated speckle in the patch was 2.9 (WebGPU) and 2.3 (WebGL2) against 0.2 in revision 12. Removing the rim spill above it changed nothing. Where the billows clamp to zero, the valley floor lies exactly at the bottom of the relief layer, where the march's last sample lands, so rounding decided hit or miss per pixel. A hit shades as a near valley floor, a miss as the far plane. | A ray that reaches the floor of the layer within the near band meets it there, so floors shade on from the billow bases around them. | Lab on revision 13, h5, h4 and h3 on WebGPU and WebGL2: speckle in the patch 3.55% → 0.02%, the rest of each frame within 1.7/255 of the hub's revision 13 shots, the same draws and no errors. The h3 backend difference (2.5/255) is cloud and cube drift between the two shots. |
| H87: the glow in the shared pipeline was fixed (strength 0.13, radius 0.25, from linear brightness 1.8). The sublime critic measured no radiance: under 1% of eye-level pixels above 0.92 and no warm sun glow. The art and brief critics asked for a sun glow or bloom, and the agent had no way to give sunlit stone or cloud tops a glow. | Optional `environment.effects.bloom {strength, radius, threshold}`, defaults unchanged, validated like the other effects. The capability text says the threshold is linear brightness before tone mapping, that lowering it toward 1 lets the brightest sunlit marble and cloud tops glow, to check the frames, and that strength washes contrast. | `src/world/effects.test.mjs` (defaults unchanged, partial settings keep the rest, out-of-range values rejected). |
| H88: every page load logged "PCFSoftShadowMap has been removed. Using PCFShadowMap instead." r3f's `shadows` asks for PCFSoftShadowMap, which three 0.186 has dropped. | The editor, cove and viewer canvases ask for `shadows="percentage"` (PCFShadowMap), what three already used. The map and filter are unchanged. | `npm run build`. The warning no longer appears on load (host log after the deploy). |
| H89: the technical critic said the rim overflow sheet receives crisp, opaque cast shadows (h4) and reads as streaked plaster, and asked that the water sheet not receive shadows or receive them softened. glTF carries no receive-shadow setting, so the agent could not change this from the asset. | Flow nodes take the sun shadow at half strength through three's `receivedShadowNode` (the ground and walls keep theirs), noted in the flow capability text. | `src/world/flow.test.mjs`. Lab on revision 13, h4 and 02 on WebGPU and WebGL2: the same draws, no errors, and the streaks crossing the tower's shadow lighten. The effect is small: most of the dark band is the wall's own shadow seen through a very thin sheet, so the plaster read is the sheet's opacity and foam, which the agent is reworking in revision 14. |
| H90: with H83's temporal AA (which occlusion turns on), the falls' streaks lost 22% of their sharpness and 40% of their visible motion. They move by scrolling texture with no motion vectors, so history smeared them. Occlusion, computed from the wall and pool behind the transparent sheets and mist, also greyed the foot of the falls. three's TRAA has no reactive mask. A first attempt marked flow materials with a per-material MRT output, and the falls vanished whenever effects were off: with no pass MRT, three draws such a material with that output alone. Sky light captures and the water's mirror view would have lost them too. | The scene pass writes per-material marks (`reactive.mjs`) read through a material reference the pass evaluates for each draw. Flowing water is reactive, so temporal AA takes the current frame there. Every transparent material is translucent, so occlusion leaves those pixels alone. The marks blend with each surface's alpha, so soft sheet and mist edges fade in. Renders outside the pass are unaffected. | `src/world/flow.test.mjs` (marks, no per-material MRT). Lab on revision 13, 03-head-f1, 8-frame WebGPU sequences plus stills on both backends, against no effects: falls sharpness 77% → 92% and motion back to full (frame-to-frame change 2.2 against 2.0); the mist dims 1.9% where it was greyed; the pool at the falls' foot keeps its brightness; the stairs keep their occlusion. Three more draws, no errors. With effects off the falls match the original frames exactly. |
| H91: in turn 10 the agent re-ran its design script a dozen times as `node <script> > /dev/null; grep -E -e … <report> \| sed -e 's/; /\n    /g' \| grep -v -e … \| cut -c1-300`, and each run needed approval. H70 allows grep and `sed -n` only as filters on a script's own output. | A Bash script run may discard its own output (`> /dev/null`) and be followed by one grep, with letter flags and `-e` patterns, of a single file under `assets/source`; the resolved path must stay inside. The filters also take grep with `-e` patterns, `cut -c` ranges, and sed substitutions (`s/…/…/` with only the `g` flag, several joined by `;`, with or without `-E` and `-e`); the agent's revision 15 turn used the plain and joined forms, and its revision 16 turn a leading `time` and `grep -A 20`, which also qualify (grep takes -A/-B/-C/-m counts). In Bash a script may also take any single-quoted argument without a quote in it, such as a regular expression `'^(parapet|planter)'`, which bash and zsh never expand. PowerShell keeps the plain-word arguments, since its curly quotes can end a string. GNU sed's `w` and `e` commands write files and run commands, so no other sed form qualifies. PowerShell keeps only the tail forms. | `server/claude.test.mjs`: the agent's turn 10 forms qualify. Reads outside `assets/source` or climbing out of it, recursive or two-file greps, `-f`, chained commands, redirects to files, sed `w`, `e`, `d`, `-i`, other delimiters and file arguments, cut with a file or fields, and command substitution do not. |
| H92: the sublime critic's round 3 report said the gateway frames nothing: its opening shows pale sky with a couple of thin wisps, where the hero shows a glowing cloudscape that pulls you up the axis. It asked for a sunlit cumulus bank in the opening. The agent reported that tall cumulus is beyond the sky's settings: the flat cloud layer smears near the horizon, and the deck's relief stays below it. | Optional `sky.cumulus {toward: [x, z], spread, height, scale}`: a bank of towering cumulus drawn in the dome along part of the horizon. Towers of varied height rise from the horizon or the deck, tallest near the middle, their outlines broken by billows. They stand in front of the sky, the sun and the higher clouds, and since they are part of the dome, sky light captures, sky-reflecting cubes and planar pools show them. The density field's slope gives each pixel a normal turned toward the viewer, with light wrapped for scattering inside the cloud. Crowns facing the sun are brightest and bases greyer, a backlit bank's edges silver, and the bank sits in the horizon haze, more so at its base. | `src/world/sky.test.mjs` (contract and defaults). Lab on revision 14 with a bank toward −z, 01, 04 and h7 on WebGPU and WebGL2: no errors and no change in draws. At 26° the bank fills half of the gateway opening behind the orb from 04 and rises behind the colonnades from 01. Seven lab passes: the first was pale and striped by the flat cloud layer's horizon smear drawn over it; direct light alone left backlit faces blue and blotchy (passes 2–3); normals smoothed to the tower scale lost the form (passes 4–6); the kept pass wraps the light over billow-scale normals. |
| H93: with the hub quiet (Crescent Cove held p50 8.4 ms on both backends, warm, in the same window), revision 15 measured p50 58 ms on WebGPU and 33 ms on WebGL2 at the arrival. That fails criterion 3 outright and is not load. An unpaced feature A/B on WebGPU put about 40 ms of the 60 ms on the cloud deck. Its shader (mine, H81) computed the deck, including the 16-step relief march, for every pixel of the dome, then discarded it above the horizon. It did so in the main view and again in the planar mirror view. | The deck is computed only where a pixel can see it (below the horizon, camera above the deck), and the relief march only where the ray reaches the layer within the near band. Elsewhere the dome takes the haze it would have blended to. `fwidth` stays before the branches, since WGSL rejects derivatives in non-uniform control flow. | Unpaced, arrival, revision 15 on WebGPU: 59.5 → 15.4 ms p50. The deck now costs about 1.2 ms (no deck: 14.2 ms), effects about 2.2 ms (13.2 ms without), planar water about 4.6 ms (10.8 ms without, which also takes p95 from 33.5 to 15.2). WebGL2 barely moved (23.7 → 22.8 ms, p95 132 ms): its compiler can run both sides of a branch, so the deck still cost about 6 ms there. With a cloud deck the dome is now two half spheres, and the deck shader rasterizes only below the horizon. WebGL2 22.8 → 18.4 ms (p95 132 → 33.6), WebGPU 15.4 → 14.9 ms, two more draws. Without planar water both backends sit near 12.3 ms, so the mirror pass costs about 2.7 ms on WebGPU and 6 ms on WebGL2. `npm run build`, runtime suite. |
| H94: after H93, revision 15 on WebGPU was CPU-bound. Without planar water it stayed near 9.6 ms whether or not occlusion or shadows ran, as draws fell from 218 to 140. A CPU profile of 4 s at the arrival had the main thread busy throughout. Three's per-object node updates took about 25% and matrix updates 11%: each render of the scene (main pass, water mirror, sun shadow) walked all 527 nodes again. The aim pick called `scene.updateMatrixWorld(true)` every frame, forcing every world matrix a second time, then walked and raycast the scene. | The aim pick runs when the view moves, and every 100 ms for things that drift under a still reticle. It updates matrices without forcing, so moving objects still update and static ones are not recomputed. With the effects pipeline rendering, the scene's matrices update once a frame, after everything that moves has moved, and its passes reuse them (`matrixWorldAutoUpdate` off while it is mounted). | `src/world/aim.test.mjs` (9), runtime and server suites. CPU profile: the per-frame raycast leaves the top list, and matrix updates fall from 11% to 2.8% of the main thread. Unpaced WebGPU at the arrival: 14.9 → 13.1 ms p50. WebGL2, three interleaved pairs in one window: 16.6–16.8 ms against 16.9–17.1 ms before (an earlier single 23 ms reading was run-to-run noise). The route walk on this build passes on both backends (14 of 14 legs, floors right, no errors). |
| H70: the agent filters its own scripts' output with `grep` and `sed -n` far more often than it trims it, so a granted design or audit script still asked whenever it was filtered: three of six approvals in turn 6. | In the Bash tool, the H40 grant also takes up to three read-only filters after the script: `grep` with letter flags (`vEiFnwxco`) and one quoted pattern, or `sed -n` printing only line, `$` and `/regex/` ranges. A single-quoted pattern is inert in sh, bash and zsh; a double-quoted one may hold no `$`, backtick, backslash or `!`. PowerShell keeps only the trim forms, because its curly quotes can end a string early. | `server/claude.test.mjs`: the agent's three filtered commands qualify. These still ask: sed's `w`, `e` and `I` forms, sed without `-n` or with a file, `grep -f` and `-r`, command substitution, an escaped quote that would end a pattern early, a redirect, `xargs`, a fourth filter, and a chained command. |
| H67: colours travel as quoted words (`'#f3e5cc'`), but the H40 script grant took only bare words, so every run of the agent's colour script with new colours asked again and offered no script grant. | `SCRIPT_RUN` in `server/claude.mjs` also takes a single- or double-quoted word made only of ASCII letters, digits, path characters, `#` and spaces. That leaves nothing for any shell to expand, and no character, smart quotes included, that could end the quote early. Anything else still asks. | `server/claude.test.mjs`: quoted colours and phrases qualify; `"$(…)"`, backticks, `$env:`, a quote closed early, PowerShell's curly quotes, an escaped quote and a bare `#` do not. |
| H66: the sky capability said `curve` sets "how fast the gradient leaves the horizon" without saying which way. The shader blends horizon to zenith by elevation raised to `curve`, so a higher value carries the horizon haze further up. In turn 5 the agent raised it from 0.5 to 0.9 for a bluer zenith, said the docs left the direction open, and asked to be told whether the sky became hazier. | `capabilities.sky` and the authoring skill's runtime notes say `curve` is the exponent on elevation: lower is bluer overhead, higher hazier. | `server/world-tools.test.mjs`; the revision 8 captures show the result of 0.9. |
| `npm run check:distribution` failed under npm 12, whose `pack --json` prints an object keyed by package name rather than an array. | `scripts/check-distribution.mjs` accepts both shapes. | Passes on npm 12.2.0. |

## Holodeck findings

| # | Area | Finding | Severity | Suggested change |
| --- | --- | --- | --- | --- |
| H52 | Measurement | The hub harness launches Chrome with `--enable-features=Vulkan`. On Chrome 150.0.7871.128 that drops WebGL2 canvas output from screenshots (a canvas cleared to red captures white), while WebGPU works with or without the flag. Every forced-WebGL2 screenshot from the harness is blank, and WebGL2 frame timing under it is suspect. | High | Launch WebGL2 runs without `--enable-features=Vulkan` (the lab uses a copy of `hero.mjs` without it). The harness lives with the user's local tools, so it is reported, not changed. |
| H53 | Agent connection | Connect checks `claude auth status`, but nothing re-checks before a turn, so a sign-in that lapses between connect and the first message only shows as a failed turn. | Low | Fixed for the failure path above; a re-check at turn start would need one more process per turn. |
| H59 | Agent connection | The installed Claude Code CLI (2.1.269) refused `claude-opus-5-5` ("version 2.1.280 or newer is required"), which surfaced only as a failed turn. The connect check reads `auth status` but not whether the CLI supports the chosen model. | Medium | Updated with `claude update` to 2.1.310. Holodeck could read `claude --version` at connect and name the minimum for exact model IDs it lists. |
| H60 | Agent | At max effort, Opus produced more than one response's output cap in the planning turn ("Output token limit hit"); Claude Code resumed it automatically, but the dock showed a stale tool name for about 20 minutes. | Low | Show elapsed time since the last event, or the CLI's continuation, in the presence line. |
| H62 | Rendering | Shape placements never batch: each is its own object with its own geometry and material. The 273-shape blockout drew 394 draws at the arrival; without the shapes the export drew 56 and kept refresh, so each unbatched object cost about 50 µs per pass on the hub. Blockouts are where agents use shapes most. | Medium | Batch static shapes that share type, surface and colour into instanced meshes, as repeated GLB placements already are. |
| H63 | Measurement | During this pass the hub GPU was shared with another desktop app's live renderer (about 30–38% utilization at idle, 84–85 °C, clocks throttled to about 1,620–1,740 of 2,100 MHz), so frame timings of the same export moved between 8.4 and 16.7 ms p50 from run to run. | Medium | Measure in a quiet window, repeat runs, and record the GPU load and clock with each run. |
| H65 | Agent shell | Claude Code's Bash tool runs in the user's login shell, here zsh, where `set -- $spec` does not split words. The agent's first batch export loop failed for that reason and it rewrapped the loop in `bash -c`, which cost a second approval. | Low | Give `holodeck-integrate-asset` a batch export form (several revisions in one `kiln.mjs export` call or a small node script), or say which shell runs commands. |
| H54 | Interface | The in-app browser cannot drive an OS file picker, so **Import pack** was fed the zip through its own input's change event. A hidden browser pane renders no frames, so the 3D canvas never starts there while the pane is hidden. | Low | Harness limits, not product defects; recorded so later passes do not chase them. |

## Agent turns

1. Planning: applied as revision 4. After the sign-in and CLI update
   (H48, H59), the agent read the bible, the brief, all six references,
   `world_read` capabilities and the Kiln helper catalogue, then wrote
   `assets/source/plan.md` (28.7 KB) and linked it on the board.
   - **Layout:** one axis at x = 14, 136 m rim to rim. An open south court
     with infinity-edge pools spilling into the cloud deck and an arcaded north
     court, then three 2.4 m terraces (flights of 15 risers of 0.16 m with a
     landing after the eighth) to a 22 × 10 × 52 m gateway with a 4.5 m
     floating mirror orb. The cove stays at the origin with a measured
     sightline to the orb.
   - **Build:** terrain only as the pool floor (the ocean measures depth to
     terrain), one still ocean at -0.10 for everything wadeable, walkable
     colliders for every deck and tread, a deterministic design script that
     writes the scene file.
   - **Catalogue:** 39 new assets, about 830 placements and about 1.0M placed
     triangles, holding 17 asset slots back.
   - **Gaps:** mirror pools and glow ranked first and third because the
     capability text was stale (H61), then water at one level, one
     reflection probe, and per-placement draws for drift and flow sheets.
   - **Bible:** rules 2–7, 10–12, 14 and 16 sharpened into checks (named
     check views, at most 12 risers between landings, floating pieces at least
     1.5 m from anything walkable, a sun 35–50° up, slow drift limits, budget
     margins); the visual direction is unchanged.
   - **Approvals:** two: all Kiln workspace tools, and edits in
     `assets/source`, both for the session.
   - **Friction:** one response hit the output cap and resumed (H60).
2. Blockout: applied as revision 5. 273 shapes plus the cove's 7 pieces: every
   deck, coping, tread, landing, wall, parapet, arcade, tower and the gateway
   as boxes with their real colliders (154 walkable), the orb as a drifting
   sphere. The terrain is a plate at -1.00 under the pools only; one ocean at
   -0.10 with 3 mm waves; the sky light probe at (14, 0.6, -38); the cloud deck
   at -16; sun at (-87, 78, -49); fog 90–1,100 m.
   - **Checks on the staged proposal:** all 24 `world_check` routes clear
     (every flight up and down, both side loops, wading out of a pool across
     the submerged exit steps); the design script's ray test keeps the orb and
     arch in view from all six check views.
   - **Approvals:** one, the design script, granted with any arguments until
     its code changes (H40).
   - **Hub, arrival, 1280×720:** 394 draws, 106,643 triangles; WebGPU p50
     25 ms and p95 42 ms; WebGL2 p50 33 ms and p95 50–58 ms. Not
     refresh-paced: the shapes do not batch (H62), and the GPU was shared
     (H63). A/B on the export: the sky light, cloud deck and clouds change
     nothing measurable; removing the shapes leaves 56 draws.
   - **Looks:** the arrival already reads like the hero's composition, and
     the pools mirror the arcade piers through the probe.
3. Stone kit: applied as revision 6. Ten Kiln pieces, judged in Kiln's GPU
   material-faithful renders and exported to `assets/imports`: an 8 m terrace
   block, 4 m and 6 m deck slabs, a stepping slab, a pool coping, submerged
   pool steps, the 8 m and 4 m flights, a parapet and a foundation face. Each
   is one mesh with one atlas material (white veined marble with 4 mm bevels,
   warm pitted travertine courses, brass only in inlays, nosings and caps),
   110–2,372 triangles, so each batches into one instanced draw. A tiling
   white-marble pool floor, generated by the design script as terrain layer
   maps, sits under the water.
   - **Layout fitted to the 8 m blocks:** 8 m flights with 0.40 m treads and a
     2.8 m landing, an 8 m gateway stair, 12.2 m pools.
   - **Checks:** all 28 routes clear on the staged proposal, including both
     pool exits and the step into and out of the upper basins; the orb and
     arch stay in view from all six check views.
   - **Approvals:** five. Two runs of the export loop (H65), and three of the
     design script: two chained with `&&`, which the script grant never
     covers, and one piped to `head -40` (H64).
   - **Hub, arrival:** 169 draws (was 394) and 526,165 triangles. Warm,
     WebGL2 p50 8.4 ms and p95 16.7 ms; WebGPU p50 16.7 ms and p95 25 ms, on a
     GPU 53% busy before the run (H63).
   - **Looks:** the decks' soft veining and the travertine courses read well;
     the remaining shapes (arcades, towers, gateway) and the shape basin
     water are placeholders until the next turns. Shadows on the white decks
     read a strong blue-violet.
4. Architecture: applied as revision 7. Eight Kiln assets replace the
   remaining shapes, each one mesh with one atlas material: 40 round-arch
   spans with a stepped order, voussoirs, keystone, cornice and ivy trough; 32
   piers (16 slotted); 10 slotted pylons whose shafts continue down into the
   cloud deck; 6 rim towers with tall glowing slots; 4 cascade towers; the
   gateway (three stepped marble orders around an 8 m passage under a glowing
   ribbed vault, slotted piers, a recessed upper bay, ivy ledges, planted twin
   tops at 55.2 m); and the mirror orb (metallic 1, roughness 0.02), drifting.
   Slots and vault use emissive strength 4, above the bloom threshold; one
   warm point light sits low in the passage.
   - **Checks:** all `world_check` routes clear, including through and beside
     the gateway and into an arcade bay; the design script's 29 routes clear;
     the arch and orb in view from all six check views.
   - **Budget:** 26 assets, 461 placements, about 529k placed triangles,
     19.8 MB of files.
   - **Approvals:** four: two export loops, one read-only `node -e` look at
     `world.json`, and the design script chained with a determinism check.
   - **Hub, arrival:** 105 draws (was 169) and 868,079 triangles. Warm, WebGL2
     p50 8.4 ms and p95 16.7 ms; WebGPU p50 16.6 ms and p95 16.9 ms. Control
     in the same hour: Crescent Cove revision 15 at its arrival measures p50
     16.7 ms on both backends, against 8.4 ms when it shipped, so the hub was
     degraded (H63) and this revision is at or better than the reference.
   - **Looks:** the arrival reads as the sanctuary; the forecourt's stepped
     orders, ribbed vault and orb are the strongest view. Gaps to the hero:
     the frame is milky and low in contrast, with everything past about 60 m
     fading (fog starts at 90 m); the slots read cold white; the zenith is
     pale; and from the air the composition is a narrow strip until the
     floating world arrives.
5. Water: applied as revision 8. Four Kiln flow assets, alpha-blended sheets
   whose UV.v is the water's travel time, so `asset.flow` at `[0, 1]` moves
   each pattern at the water's own speed: falls from the four cascade spouts
   (3.4 m), two overflow weirs on the T1 front wall (3.9 m), spills over both
   24 m infinity lips 30 m down into the cloud deck, and still basin sheets
   in the T1 basins drifting at `[0.006, 0.011]`. The ocean became a deeper,
   clearer turquoise.
   - **Art notes from revision 7, applied:** fog 250–1,600 m, the probe at
     0.5, a deeper zenith. For the glow, the agent computed the ACES display
     colour itself: the suggested `#ffe3b8` would have shown as `#fbf8f4` at
     bloom brightness. It used deeper amber emission at strength 3.5 instead,
     through child revisions of four lit pieces. It also raised the sky
     `curve` from 0.5 to 0.9, the wrong way (H66).
   - **Checks:** all eight staged routes clear, including wading the west pool
     and the pool exit; 0.90 m of water under every sheet; the flow records
     validated; the arch and orb sightlines unchanged.
   - **Approvals:** seven, all run once:
     - the agent's ACES table script, and two inline `node -e` colour
       calculations;
     - a shell `grep` over the plugin's runtime notes, which the Grep tool
       would have read without asking;
     - the export loop for eight revisions;
     - the design script chained with its determinism check;
     - a read-only `sed | sha256sum` check that the kit sources match the
       saved revisions.
   - **Hub, arrival:** 127 draws (was 105) and 868,707 triangles. p50 16.7 ms
     on both backends; p95 33.3 ms on WebGPU and 25 ms on WebGL2. The GPU was
     36% busy before the run, with the ChatGPT app's GPU process at about
     120% CPU (H63).
   - **Looks:** the pools read as clear turquoise, with the marble floor and
     caustics showing and the arcade piers mirrored. Gaps to the hero:
     - the sky is lavender-grey up to about 60° (H66);
     - towers and piers read tan rather than ivory;
     - the rim spills read as a pale opaque wall;
     - the cascades barely show from the arrival.
6. Planting: applied as revision 9, with revision 8's art notes.
   - **Sky:** `curve` 0.25 once the corrected capability text named the
     direction (H66), a cerulean zenith, a whiter horizon with the fog matched
     to it, and fuller cumulus.
   - **Stone:** the travertine in all 14 pieces that use it re-saved as pale
     ivory, through child revisions with unchanged geometry.
   - **Water:** whiter spills and falls with froth and mist.
   - **Planting:** eight foliage assets with wind. Sixteen cypresses in pairs of
     differing scale in marble planters, shrubs and flowering shrubs, and 48
     ivy curtains up to 6.5 m.
   - **Layout:** the agent moved the T2 cypress avenue out to |dx| 9.5, after
     its design script found that trees at 7 would cut the cove's view of the
     arch jamb (rule 2). The script now tests both jambs.
   - **Delivery:** the agent wrote `assets/source/design/export.mjs`, which
     exports every scene asset still missing from `assets/imports` in one
     run: its own answer to H65.
   - **Checks:** all 31 design routes and 8 `world_check` routes clear.
   - **Approvals:** six, five run once and one script grant:
     - two runs of the colour script with quoted colours, before H67;
     - the design script with the batch export, after reading `export.mjs`;
     - the design script with the GLB audit;
     - the design script filtered through `sed` and `grep`;
     - the design script grant.
   - **Hub, arrival, after H68 and H69:** 166 draws (was 127) and 1,188,207
     triangles. p50 16.7 ms and p95 25 ms on both backends, cold and warm,
     with the GPU about a third busy (H63). Ready in 19–29 s, of which about
     11 s is loading.
   - **Looks:** the sky is now the hero's cerulean with bright cumulus, the
     stone reads ivory, and the cascades read as white ribbons with froth
     fans; in motion their streaks travel down. Gaps:
     - ivy on faces in shade renders as near-black, blue-tinted rectangles,
       from a dark, glossy leaf albedo with little light in shade;
     - the cypresses are dark and faceted up close;
     - joints between gateway wall modules leak light.
7. Sky dream: applied as revision 10, with revision 9's fixes.
   - **Ivy:** rebuilt yellow-green, matte (roughness 0.85) and more
     translucent, with leaves angled to the sky, and hung as 26 sparser
     curtains.
   - **Cypresses:** 22-sided.
   - **The dream:**
     - inverted isles with arcades, towers, upward cascades and hanging
       cypresses;
     - upright isles with spills;
     - two flying stairs;
     - 24 drifting and 23 static cubes and monoliths;
     - a far gateway echo.
   - **Checks:**
     - the design script checks rule 5 (no sky piece over walkable ground,
       nearest 3.0 m);
     - rays from the six check views clear the gateway outline;
     - drift within rule 11;
     - seven of eight test routes clear.
   - **Approvals:** fourteen, all run once:
     - two Python heredocs editing the agent's own design script (the Edit
       tool would not have asked);
     - three runs of the new read-only `draws.mjs` estimator;
     - read-only scene queries;
     - the batch export (H65 resolved by the agent's `export.mjs`);
     - a determinism check writing its hash list to `/tmp`, which I asked to
       move into `assets/source`.
   - **Hub, arrival:** 252 draws, 1.30M triangles, p50 25 ms (WebGPU) and
     25–33 ms (WebGL2), against the control's 16.7 ms. Unpaced A/Bs on the
     export put the cost in the sky layer (88 draws, about 5 ms) and the flow
     sheets (60 draws, 2–7 ms), which led to H71 and H72.
   - **First adversarial round** (four independent critics, one lens each,
     evidence packet only): art direction 5.0, brief and bible 5.0, technical
     4.8, the sublime 4.0, all revise. They agreed on:
     - a gateway too small to anchor and reading as a castle keep;
     - inverted fragments reading as ziggurat roofs over the towers;
     - no far rung of scale;
     - pastel-overcast light with violet shade;
     - a flat grey cloud deck;
     - mirror cubes reflecting the wrong world (H73);
     - rule 4 (14 risers seen without a landing);
     - frame time.
     Their reports went to the agent in the world folder, and H73–H75 came
     from them.
8. Refinement: applied as revision 11, from the round 1 reports.
   - **Gateway:** rebuilt on the hero's silhouette, 98.6 m tall with three
     stacked arches and a glowing vault, soffit and lantern; a 7 m orb at 58%
     of the arch. The agent traced the see-through string courses to a bug in
     its shared course builder.
   - **Inverted courts:** two, built from kit pieces so they batch.
   - **Far rung:** five forms 96–130 m tall, 700–950 m out.
   - **Light:** a warmer, stronger sun just above the top left of the axis
     views; low cloud banks.
   - **Mirror cubes:** brass-framed mirrors.
   - **Planting:** slender cypresses and flowering shrubs.
   - **Other:** solid stair soffits, single-sided mist cards, brass inlays
     along the causeway and copings.
   - **Rule 4:** the agent showed that flights 2 and 3 already had an 8 + 7
     landing, hidden from the head of the flight below, and marked both ends
     with planters.
   - **Its own model:** it calibrated its colour model against the critics'
     measured colours, and corrected its draw model to the hub's arrival
     camera (within 6 draws of revisions 7–10).
   - **Engine finding:** shade cannot be warmed from the world side (H76).
   - **Approvals:** about twenty-two, all read-only calculations, filters
     and determinism checks, mostly chained or filtered forms that H67 and
     H70 now cover.
   - **Hub, arrival, with H71–H75:** 187 draws, 1.95M triangles, p50 16.7 ms
     and p95 25.1 ms on both backends, cold and warm. That is level with the
     Crescent Cove control under the same load.
   - **Second adversarial round:** art 5.0, brief and bible 5.5, technical
     6.0 (no blockers), sublime 4.0. All four said grade and light (ACES
     capped highlights; pink shift, which led to H77), the gravity illusion
     from the route, the far rung and the planting assets.
9. Applied as revision 12: the H73–H76 options adopted.
   - **Sky and light:** sky-reflecting cubes, a warm bounce at 0.35, a 40 m
     shadow box, and the cloud deck at −80 with scale 0.6.
   - **Inverted courts:** brought into view at 17–32° from the arrival, kept
     clear of grounded tops and the gateway outline.
   - **Planting:** a rebuilt Kiln cypress (6:1 on a trunk) and ivy (leaf
     cards on tapering strands).
   - **Third round:** art 5.0, brief and bible 5.5, technical 5.5, sublime
     4.5. Technical gained two blockers, a cove floor z-fight and sky through
     the gateway's cornice joints.
10. Applied as revision 13: Neutral at 1.05, with sun, haze, sky, bounce and
    water retuned with the agent's own tone model.
    - **Cove flicker:** the belvedere drops one riser.
    - **Far rung:** stone monoliths about 800 m out on both flanks, so the
      route views show 3–5 far forms.
    - **Stone and glow:** brass-lipped copings, whiter veined floors, banded
      travertine and closed joints; wider warm niches in place of the
      LED-like slots.
    - **Foreground:** planted islands framing the arrival.
11. Applied as revision 14 (the agent's turn 10, from the round 3 reviews):
    - **Gateway cracks:** the agent wrote its own ray-cast crack test, which
      reproduced the critics' slits on revision 12 to the pixel. All 23 kit
      pieces were re-saved with sealed joints: cracks fell from 1,069–2,563 px
      per view to 59–74 scattered dots, and sun leaks through the arches from
      1,643 to about 100 cm².
    - **Gravity illusion:** the inverted courts were rebuilt lower and nearer
      (40–78 m), with marble lids on the hanging planters. Every sky piece has
      `castShadow: false` (187 placements, H79). The 03 and 04 views still show
      them only at the top edges.
    - **Water:** planar pools (H82), foam rings in place of the falls' spray
      cards, and new falls from the rim towers' cornices into the cloud sea.
    - **Hub capture with H83–H91 deployed:** all 28 shots error-free, with draws
      equal across backends (h6 differs by 4, drifting cubes). Views that show
      the pools draw 79–129 more with planar water (01 222 → 301, h2 221 → 300,
      h8 219 → 348), and views past the pools draw slightly fewer (05 130 → 117,
      h7 133 → 123). The pools now
      mirror the gateway tower, cypresses, windows and orb in place, and keep
      their turquoise near the viewer, so no reflectance setting is needed.
12. Applied as revision 15 (the agent's turn 11): occlusion at its defaults, a
    glow from linear brightness 0.95 (chosen by simulating it on revision 14's
    hub frames), and a court mirror-cube variant reflecting a capture 20 m over
    the cross-walk. The route walk passes on both backends.
    - **Fourth round (revision 15):** art 5.0 → 5.5, brief and bible 5.5,
      technical 5.5 → 4.5, sublime 4.5. All four name the missing golden
      light: the route looks into a north-west sun, so walker views see marble
      lit by blue sky fill (lit marble R−B −9 to +7 against +16 to +52 in the
      hero). Art, brief and sublime also ask for colossal far forms on the
      skyline, overhead courts that read as an upside-down sanctuary, mirror
      cubes that read as mirrors, and finer planting. Technical marks the frame
      rate a blocker (p50 58 ms on WebGPU against Crescent Cove's 8.4 ms in the
      same quiet window), which led to H93. It also flags a z-fight at the
      cove rim, stretched travertine, and the orb reflecting the court's capture
      rather than its own surroundings.
- **Functional testing (the user asked for it over hub timings, which other
  agents and apps share):**
  - **World and prototype probes:** pass on WebGPU and WebGL2 with no page
    errors, 8 of 8 checks each, run as headed copies. Headless Chrome on this
    Linux laptop has no WebGPU, so the repo's headless probes cannot cover it;
    their "World name" locator is also ambiguous against the closed new-world
    dialog, on main too.
  - **Crossing probe:** passes with permission prompts denied.
  - **Build and distribution check:** pass.
  - **Route walk:** a keyboard-driven walk of the main route in the static
    viewer (arrow keys steer, W walks, Shift runs) reaches all 14 waypoints
    at the right floor heights on both backends, revision 12 onward.
  - **After H83–H90:** the world, prototype and crossing probes pass again on
    both backends with no page errors. Suites pass: server 171, runtime 249,
    prototype 3. Build and distribution check pass. Each H row's own lab
    evidence also compares stills on both backends.
