# Directing and rendering *Kiln: How It's Made*

This is the plan for the film's renders, written 2026-10-25, along with the research behind it. "Tomorrow" means 2026-10-26. The tooling it describes is in `holodeck-hub-tools/cinema` beside the Holodeck checkout; see [tooling.md](tooling.md). The stack is pinned: three 0.186.1 with WebGPURenderer and TSL, R3F 9.8.2, Playwright 1.64.1 and ffmpeg 7.1. Nothing here needs an upgrade.

Facts were checked in two ways:
- **local**: read from the pinned `node_modules` or measured on this PC tonight, CPU only.
- **web**: taken from the cited page, with that page's date.

## 1. Decisions in one screen

| Shot type | Route | Why |
|---|---|---|
| Mood-board push-in (cove, authoring app) | **Deterministic WebGPU frames** from the app source (`shots/cove-board.json`). Add a DOF focus pull once the hook lands. | A slow push with nothing moving in the world. Frame-exact output matters more than a live feel. |
| Kiln parts lineup (`kit-parts`) | **Deterministic**, `--shutter 2`, long lens (85 mm) | The turning parts need only light blur. A long lens flattens the row like a product shot. |
| LEGO build-up (`assembly`), the hero | **Deterministic**, `--shutter 4 --jitter` (180°) | Flying and dropping pieces need real motion blur. Post-process blur cannot provide it here: merged meshes are animated by rewriting vertices, so they have no velocity, and a newly spawned instance has no history. Accumulating sub-frames blurs every kind of motion and also anti-aliases. |
| Finished-world flythroughs | **Deterministic**: `full` for high and slow moves; `full60 --shutter 2` for low glides that `tools/grammar.mjs` flags for ground flow | Low glides make the ground strobe at 30 fps. |
| Maker walking (follow rig) | **Deterministic** for the hero walks | The emote wheel is not in the static exports, so render emotes from the app source. |
| "It's live and editable" B-roll | **Real-time capture** with OBS and NVENC of the authoring app in a headed browser at 60 fps | This shows dragging a placement, swapping a part, hot-loading a Kiln asset and the maker emoting live. Frame stepping cannot capture a person using the UI. |
| Offline hero (Blender or path tracing) | **Not for tomorrow** | See §2.5. It would mean rebuilding the materials for no gain in what the film says. A Cycles turntable of the Kiln parts is a possible later extra. |

All of these, including the CPU-only steps, are validated first with the animatics and the grammar check (§4).

## 2. Research findings

Each item lists which shots it helps, its cost and risk on our stack, and whether it needs the GPU.

### 2.1 Camera tooling for three.js and R3F

- **Theatre.js: avoid.**
  - `@theatre/r3f@0.7.2` peer-depends on `@react-three/fiber ^8.13.6`, so it does not support R3F 9 ([npm](https://registry.npmjs.org/@theatre/r3f/latest), undated).
  - The last public release was 0.7.0 on 2023-08-10 ([releases](https://www.theatrejs.com/docs/latest/releases)), and development moved to a private repo ([GitHub](https://github.com/theatre-js/theatre), undated).
  - Risk: high. GPU: no.
- **camera-controls: optional.** v3.1.0 (2025-07-13) and v3.1.2 (2025-11-17) are maintained ([releases](https://github.com/yomotsu/camera-controls/releases)).
  - `lerp` and `lerpLookAt` are pure functions of t.
  - `setLookAt(..., true)` transitions use SmoothDamp over a frame delta, so they are deterministic only with a fixed delta.
  - Use: `fitToBox` framing math only. Not needed tomorrow.
- **drei MotionPathControls: avoid.** It exists in drei 10.7.9 (peer R3F ^9) ([docs](https://drei.docs.pmnd.rs/controls/motion-path-controls), undated), but it damps with `easing.damp(..., delta)` ([source](https://raw.githubusercontent.com/pmndrs/drei/master/src/core/MotionPathControls.tsx), undated), so its pose depends on the frame history.
  - **CameraShake** noise samples elapsed time, so it is deterministic under our clock, but its decay uses delta.
  - We already have deterministic shake in `camera.js`.
- **GSAP: avoid in the engine.** It is free since 2025 ([Webflow](https://webflow.com/updates/gsap-becomes-free), 2025), but the licence forbids use in no-code visual animation builders that compete with Webflow ([licence](https://gsap.com/community/standard-license/), effective 2025-04-30). Holodeck is arguably such a tool, and the licence is not OSI-approved.
- **Remotion `<ThreeWebGPUCanvas>`: not worth a rewrite.** It renders R3F with WebGPURenderer and TSL from `useCurrentFrame()` ([docs](https://www.remotion.dev/docs/three-webgpu-canvas), undated, since 4.0.503). That is the same "frame as pure input" model as ours, so adopting it would rewrite the pipeline for no gain.
  - Licence: free for individuals and companies of up to 3 people ([LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), current).
- **Our choice: keep it in-house and pure.** We now have:
  - centripetal Catmull-Rom with arc-length parameterisation, plus cubic Bezier (`lib/paths.js`);
  - speed ramps, Gaussian look-at smoothing, dolly zoom, lens in millimetres, and roll.
  - All of these are pure functions of shot time, so warm passes, sub-frames and re-renders agree. Building them cost no GPU.

### 2.2 TSL post-processing in r186 (local: `node_modules/three/examples/jsm/tsl/display/`)

The engine already uses `RenderPipeline`, the r183 rename of `PostProcessing`. Its pass is `pass(scene, camera)` plus a half-resolution `bloom()` (`src/world/effects.jsx`). The nodes available in r186 are listed below. Signatures are local, and usage follows the official examples (dev branch, undated: [DOF](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgpu_postprocessing_dof.html), [motion blur](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgpu_postprocessing_motion_blur.html), [TRAA](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgpu_postprocessing_traa.html)).

- **`dof(color, scenePass.getViewZNode(), focusDistance, focalLength, bokehScale)`: use it.**
  - It computes the circle of confusion at full resolution and the bokeh at half resolution, with separate near and far fields ([r186 source](https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/jsm/tsl/display/DepthOfFieldNode.js)).
  - Its units are world units: `focalLength` is the falloff range, not lens millimetres.
  - Use: the mood-board focus pull and the parts lineup. Cost: low to medium. GPU: yes. It needs the engine hook (§6).
- **`motionBlur(input, velocity, samples)` with an MRT velocity (`mrt({output, velocity})`): not for build-ups.**
  - `VelocityNode` tracks previous matrices per object. `Instance.js` and `Skinning.js` keep previous instance and bone matrices ([r186](https://raw.githubusercontent.com/mrdoob/three.js/r186/src/nodes/accessors/VelocityNode.js)).
  - Our build-up animates merged meshes by rewriting their vertices, so it produces no velocity. Spawned or teleported pieces have no history either.
  - Use only for walk B-roll if accumulation proves too slow.
- **`traa(beauty, depth, velocity, camera)`: avoid.**
  - It jitters through `setViewOffset` with 32 Halton steps and needs about 32 frames to converge.
  - It has **no reset**, so history leaks across cuts wherever depth does not disocclude ([r186 source](https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/jsm/tsl/display/TRAANode.js)).
  - The same jitter idea works offline through our new `--jitter` sub-frames, with no history at all.
- **`film`, `chromaticAberration`, `lensflare`, `lut3D`, `godrays`: grain and LUT are better done in ffmpeg on the CPU** (§5). The CPU route is cheap to change after the render and can be tested tonight.
  - Lens flare and godrays are possible stylistic extras for Meridian's sun, through the hook. They are not needed.

### 2.3 Deterministic capture

- **Keep the CDP screenshots.** The current pipeline (virtual clock, then `Page.captureScreenshot`) is right for WebGPU.
  - `Page.startScreencast` is not frame-exact: it sends compositor frames with ack-gated `maxFramesInFlight` ([protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Page.pdl), tip of tree).
  - `HeadlessExperimental.beginFrame` works only in chrome-headless-shell with `--enable-begin-frame-control` ([protocol](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/HeadlessExperimental.pdl); [puppeteer-capture](https://cdn.jsdelivr.net/npm/puppeteer-capture@1.58.0/README.md)), not with the real Chrome we use for WebGPU.
- **In-page WebCodecs: later, maybe.**
  - mp4-muxer is deprecated in favour of Mediabunny ([migration guide](https://raw.githubusercontent.com/Vanilagy/mp4-muxer/HEAD/MIGRATION-GUIDE.md), undated).
  - Mediabunny's `CanvasSource.add(t, d)` captures the canvas at call time ([docs](https://mediabunny.dev/api/CanvasSource), undated).
  - A WebGPU canvas can read back as transparent black ([agent-browser](https://agent-browser.dev/webgpu), undated, third party).
  - It would save roughly the PNG round trip, but it is a pipeline change. Measure first.
- **CCapture.js 2.0.0 (2026-07-27)** is revived, with TimeWarp, FrameWrap and WebCodecs ([changelog](https://raw.githubusercontent.com/spite/ccapture.js/master/CHANGELOG.md)). It does not mention WebGPU, and our page clock already does what TimeWarp does.
- **`requestVideoFrameCallback`** applies to `<video>` elements only ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback), 2025-09-11).
- **Check the GPU flags.** Headless Chrome can silently fall back to SwiftShader, so confirm "WebGPU: Hardware accelerated" ([Chrome troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips), 2025-10-17). `report.json` already records the backend the page initialised.

### 2.4 Real-time capture

- **obs-websocket v5** is built into OBS and has `StartRecord`/`StopRecord`, the latter returning the output path, plus `SetVideoSettings` ([protocol](https://raw.githubusercontent.com/obsproject/obs-websocket/refs/heads/master/docs/generated/protocol.md), undated). Its authentication is a password the user enters; this toolchain never reads it.
- **The RTX 3070 (Ampere) encodes H.264 and HEVC with NVENC, but not AV1** ([NVIDIA matrix](https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new), undated).
  - Settings: CQP 16–20, preset P5, MKV or hybrid MP4 ([guide](https://obs-versions.com/blog/obs-recording-settings-guide), 2026-10-08).
- **Real time will not lock to the virtual clock.** Use it only for UI and interaction B-roll, recorded at 60 fps and conformed to 30 or 60 in the cut.
- GPU: yes, both the render and NVENC. It needs a quiet GPU and a free desktop.

### 2.5 Offline and "simulated" routes

- **three-gpu-pathtracer** now has `WebGPUPathTracer`, from v0.0.25 (2026-09-28): minimum three is r185, three-mesh-bvh ≥0.9.15, and `WebGLPathTracer` is deprecated ([changelog](https://raw.githubusercontent.com/gkjohnson/three-gpu-pathtracer/main/CHANGELOG.md)).
  - It is compatible with r186 on paper, but it supports only `MeshStandardMaterial` and `MeshPhysicalMaterial` ([README](https://github.com/gkjohnson/three-gpu-pathtracer), undated). Our water, terrain splat and sky are TSL node materials.
  - Its BVH would also need rebuilding for animated build-ups.
  - Verdict: possibly an experiment later for a still of a Kiln kit (GLB, standard materials), not tomorrow. Heavy GPU.
- **Blender 5.2 LTS** (released 2026-07-14, supported to 2028-07; [release](https://www.blender.org/releases/5-2/)).
  - The glTF importer turns `EXT_mesh_gpu_instancing` into linked duplicates ([manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html), 2026).
  - EEVEE needs a display or desktop session when headless ([iRendering](https://irendering.net/eevee-next-headless-dilemma-cloud-render-farm-guide/), 2026-10-09, vendor). Cycles works headless.
  - Custom shaders "can't be just exported to glTF" ([three.js forum](https://discourse.threejs.org/t/exporting-a-mesh-that-uses-a-custom-shadermaterial-a-time-uniform-to-gltf/21884), undated). Water, terrain and sky would have to be rebuilt by hand and would then not match the in-app look. That defeats a film whose point is "this is the tool".
  - Verdict: no for worlds. A Cycles turntable of the Kiln parts is an option for a later edit. GPU: yes.
- **MCP servers.**
  - [blender-mcp](https://github.com/ahujasid/blender-mcp) (undated) runs arbitrary code over an unauthenticated socket; there is a `BLENDER_MCP_SAFE_MODE` opt-in.
  - The official [Blender Lab MCP server](https://www.blender.org/lab/mcp-server/) (Blender 5.1+, undated) runs generated code "without any safeguards".
  - Neither is needed. Holodeck already has its own agent channel, and this pipeline is data in, frames out.

### 2.6 Agentic cinematography patterns

Recent research converges on four steps: an LLM decomposes a brief into typed atomic moves, those moves are validated against constraints, they are rendered as previz, and a vision model critiques the stills before the final render.
- [SceneCraft](https://proceedings.mlr.press/v235/hu24g.html) (ICML 2024): critique loop on renders.
- [ChatCam](https://arxiv.org/html/2409.17331v1) (NeurIPS 2024): camera trajectories from conversation.
- [CineMaster](https://arxiv.org/abs/2502.08639) (Feb 2025).
- [Cutscene Agent](https://arxiv.org/abs/2604.25318) (2026-04-28): director plus cinematography sub-agent, an engine toolkit over MCP, and visual feedback.
- [CinemaTraj](https://arxiv.org/abs/2607.26910) (2026-07-29): atomic moves (dolly, orbit, crane, pan, tilt, zoom, arc) with collision optimisation.

Our pipeline now has every step except the vision critique. That critique is §4 step 5, done by me on the contact sheets and stills.

### 2.7 Shot grammar sources

- **Pan speed:** at most one image width per 7 s at 24 fps with a 180° shutter, "a starting point"; longer lenses must pan slower ([RED](https://www.reddigitalcinema.com/red-101/camera-panning-speed), undated, ©2026). Converted, that is horizontal FOV ÷ 7 degrees per second. `lib/grammar.mjs` uses exactly this.
- **Move vocabulary:** push-in for intimacy, pull-out to reveal, crane for scale, arc for energy, whip pan to link two subjects, dolly zoom only when motivated ([StudioBinder](https://www.studiobinder.com/blog/different-types-of-camera-movements-in-film), 2025-02-02).
- **Focal lengths:** 14–28 mm establishing, 50 mm at human scale, 85 mm details, 200 mm compression ([Wolfcrow](https://wolfcrow.com/the-most-used-focal-lengths-in-filmmaking-a-practical-look/), 2025-12-23).
- **Speed ramps** keep the shot continuous; gradual ramps read smooth and abrupt ones read punchy ([FilmDaft](https://filmdaft.com/what-is-speed-ramping-and-how-to-create-it/), 2025-08).
- **Stagger:** start each piece 0.1–0.2 s before the last one lands ([Webflow University](https://university.webflow.com/course-lesson/interactions-animations-sequencing-timing), undated). An eased stagger turns a list into a cascade ([Framer stagger](https://www.framer.com/motion/stagger/), undated).
- **Beat cutting:** frames per beat = 60 / BPM × fps, so 120 BPM at 30 fps is 15 frames. Cut on 2, 4 or 8-beat phrases and land the biggest moment on the drop ([Splice](https://spliceapp.com/blog/what-is-good-for-beat-synced-edits), 2026-02-10).

### 2.8 Editing, grading, delivery

- **xfade (local, ffmpeg 7.1):** 57 named transitions plus `custom`, all catalogued in `lib/transitions.mjs`. A test checks the list against this build.
  - xfade requires inputs with matching size, fps and **timebase** ([7.1 source](https://raw.githubusercontent.com/FFmpeg/FFmpeg/release/7.1/libavfilter/vf_xfade.c)).
  - For documentary taste, use fade and its eased variant, dip to black, slow fade, the occasional hblur whip, and directional soft wipes only when they match the motion.
- **`tmix` + select:** turns N sub-frames into one blurred frame ([ffmpeg filters](https://ayosec.github.io/ffmpeg-filters-docs/7.1/Filters/Video/tmix.html), 7.1). Measured locally on synthetic frames.
- **Grain:** add it last, at the delivery resolution, or the encode quantises it away ([Fora Soft](https://www.forasoft.com/learn/video-quality/articles-vqm/banding-gradient-steps), 2026-06-24).
- **YouTube:** H.264 High, closed GOP of half the frame rate, 2 B-frames, BT.709, moov atom at the front. 2160p SDR uploads should run 35–45 Mbps at 30 fps and 53–68 Mbps at 60 fps ([YouTube help](https://support.google.com/youtube/answer/1722171?hl=en), ©2026).
  - Upload 2160p even from a 1080p master to get the better VP9/AV1 ladder ([ProVideo Coalition](https://www.provideocoalition.com/uploading-to-youtube-is-4k-worth-it/), 2021, older).
- **X:** API uploads of up to 20 min / 8 GB since 2026-09-01 ([X changelog](https://docs.x.com/changelog)). Resolution caps are secondary-sourced (1920×1200, 60 fps via the API: [swat.io](https://help.swat.io/en/articles/11995649-x-video-format-requirements), 2026-01-02). Deliver 1080p with a capped bitrate and verify 60 fps with a test upload.

## 3. Cinematography guide (the agent follows this)

All values are written into shot JSON. `tools/grammar.mjs` enforces the measurable ones.

**Lenses.** Use full-frame equivalents. `"lens": mm` sets the FOV, and `fovToLens` reports the lens for existing FOV values.

| Shot | Lens | Notes |
|---|---|---|
| Establishing aerial, world reveal | 24–28 mm | Wide, high, slow. |
| Build-up orbit (hero) | 24–35 mm | Whole world in frame. The current orbits use FOV 50 (about 22 mm). Going longer means a larger radius, but it gives less stretch at the frame edges, which matters for pieces flying in there. |
| Follow and walk | 35 mm close, 50 mm medium | Human scale. Never wider than 28 mm near the maker. |
| Mood board, kit details, parts lineup | 85 mm | Flat product look. Pair with DOF once the hook lands. |
| Floating statues, sky pans | 85–135 mm | Long-lens compression; pan slower (the cap scales with FOV). |
| Push-ins through architecture | 28–35 mm | Depth and parallax come from the dolly, not from zoom. |

**Motion.**
- Default ease: `glide`. Use `inOutSine` for orbits.
- Set `"speed": "constant"` on any multi-key path. It removes surges between unevenly spaced keys, and `grammar` flags them as `speed-pop`.
- Use `"ramp"` instead of an ease for speed ramps, for example a fast approach that slows into the reveal: `[[0,1.6],[0.6,1.2],[0.8,0.35],[1,0.3]]`.
- Pan or tilt at no more than the cap of one frame width per 7 s. That is about 9–13°/s at 35–50 mm and about 4°/s at 135 mm. Whips (`grammar.whip`) are the only exception, and each needs a matched `whip` transition.
- Parallax rule: every move has a foreground layer within 3–10 m (a column, a palm, the jetty), or it is an orbit or crane with a clear axis. A move with nothing near the lens reads as a zoom.
- Keep the horizon level. Roll is 0 unless the shot sets `grammar.maxRoll`. No Dutch angles in this film.
- Follow rigs need `lag` ≥ 0.6 at route corners. Round sharp corners with an extra route point, because yaw snaps at corners are what make `maker-arrival` and `maker-trail` exceed the cap.
- Use `lookSmooth` of 0.3–0.6 on any path whose look keys kink.

**Holds and cut points.**
- Hero reveals hold 1.0–1.5 s at the end (`grammar.holds.tail`). The glide ease lands softly, but a held frame lets a reveal read.
- Cut on motion between moving shots: trim `in` and `out` inside the moving part, not on the eased stops.
- Cut on a landed beat in build-ups: out points just after a piece settles, never mid-flight.
- Hard rules:
  - No cut between two shots of the same scene that are less than 30° apart and similar in size (`jump-cut`).
  - No pan reversal across a hard cut unless it is intentional (`direction`). Two are flagged in the compilation, at segments 16 and 17.

**Match cuts between scenes.**
- **Kit to world:** the parts lineup's last frame centres a piece; the next shot opens on the same asset in place, same screen position, 85 mm to 35 mm.
- **Build-up to build-up (compilation):** match the orbit's angular direction and the screen position of the world's centre, so each cut reads as the same camera arriving at a new world. Every assembly orbit already turns counter-clockwise.
- **Board to world:** a reference image's horizon becomes the world's horizon (`grays` transition, 0.8 s).
- **Maker to maker:** cut on the maker's footfall at the same screen x.

**Build-up pacing.**
1. Bare land first.
2. Each act starts sparse and readable, then cascades. The default power cadence is 0.62; the act windows in `lib/assembly.js` scale with piece count.
3. One hero piece first, with a held beat before the rest of the vegetation.
4. Use `buildup.pacing: "swell"` for an act that should crescendo and settle before the next one.
5. Use `buildup.bpm` (and `beatDiv`) to land pieces on a beat grid, for example 120 BPM with `beatDiv` 2 gives 0.25 s. This leaves a cut ready for music later.
6. Use `buildup.ramp` for slow motion on the hero landing, for example `[[0,1],[0.55,1],[0.62,0.35],[0.7,0.35],[0.78,1],[1,1]]`. The mean speed is 1, so the build still finishes with the shot.
7. Life and the maker arrive last, after a 0.5 s held beat on the complete world.

**Pacing of the cuts.**
- Compilation: 75 s, average 3.5 s per segment, shorter in the montage (2.3–3 s) and longer for the Meridian hero (6–10 s).
- Long cut: about 5:21 by `--check` (the README said 5:18), with episodes of 50–65 s.
- Never go under 0.8 s; `grammar` flags `segment`.

## 4. What the tooling now does (CPU only, tested)

`node --test` runs 40 tests, all passing, in about 3.4 s. The ffmpeg checks run on 16×16 and 32×18 synthetic frames.

- `lib/paths.js` and `lib/camera.js`:
  - centripetal Catmull-Rom and Bezier with arc-length tables (`speed: "constant"`, `interp: "bezier"`);
  - `ramp`, `lookSmooth`, `dollyZoom`, `lens`, `roll`.
  - Legacy cameras evaluate bit-for-bit as before (fixture test; all 33 path and orbit shots compared tonight).
- `lib/assembly.js`: `pacing` (power | swell | linear), `bpm`/`beat` grid, `ramp` time warp. The default plan is unchanged.
- `lib/director.js`:
  - `step(frame, ms, jitter)` for sub-frames, with the steering and rig-smoothing `dt` following the sub-frame;
  - roll after `lookAt`;
  - `setViewOffset` jitter;
  - the build-up time warp.
  - Tested in a VM with a fake page.
- `render.mjs`:
  - `--shutter N [--shutter-angle 180] [--jitter]` renders N sub-frames per frame across the open shutter, and the encoder folds them with `tmix`;
  - `--quality full4k`.
- `lib/grammar.mjs` and `tools/grammar.mjs`:
  - pan cap, speed and turn pops, zoom, horizon and pitch, ground flow, holds, duration;
  - edit checks for segment length, jump cuts, direction reversals, transitions and total;
  - follow shots use the engine's own maker simulation and the director's lag smoothing.
- `lib/transitions.mjs`: house presets plus all 57 xfade names and custom expressions. `cut.mjs --transitions` lists them.
- `lib/post.mjs`, `tools/make-lut.mjs` and `tools/deliver.mjs`: LUT, eq, curves, vignette and deband grade; seeded temporal grain last; YouTube 4K, YouTube 1080, X and master presets. `luts/holodeck-{warm,cool}.cube` are original procedural looks.
- `tools/animatic.mjs` writes `out/animatic/*.html`, with no GPU and no scripts. For each shot it draws:
  - a top-down plan with placements coloured by build-up act;
  - the camera path over time, start, middle and end frustums, and look rays;
  - the maker's simulated walk;
  - an elevation, a speed and turn graph against the cap, the act timeline and the grammar issues.
  - The two cuts are drawn as timelines with each segment's in–out plan.

**Two bugs fixed in the cut assembler.** Both were found by the new ffmpeg tests and would have hit tomorrow:
1. A `fade` straight after a `cut` failed. concat outputs AV_TIME_BASE, and xfade refuses mismatched timebases. The compilation has this at segment 5. Fix: every input now gets `settb=AVTB` first.
2. Normalising a segment with `scale,…,fps` dropped its last frame (59 of 60, measured). That would have made the long cut about 1.6 s short, with every offset one frame early. Fix: `fps` now comes first.

Also: `dissolve` now means the classic cross-dissolve. xfade's noisy dissolve is still available as `pixel-dissolve`; no edit list used it.

**Grammar findings on the current shot lists.** These are fixes for tomorrow morning, all CPU.

| Shot | Finding | Suggested fix |
|---|---|---|
| tidemark `cove-terns` | Tilt-up at 48°/s, 4× the cap | Lengthen to 12 s, or lift the first look key so the tilt covers 40° instead of about 75°. |
| meridian `maker-arrival` | Rig swings 34°/s at 7.6 s (route corner) | Add a corner point, `lag: 0.8`, end the angle sweep earlier. |
| winter `maker-trail` | 35°/s at 3.1 s, turn kink at 9.8 s | Same as `maker-arrival`. |
| cove-board `board-to-world` | Pan 19°/s (1.6×) | 10 s duration, or `lens: 35`. |
| courtyard `fountain-orbit` | 1.4× the cap | Radius +20% or duration +3 s. |
| courtyard `statue-pullback` | 1.4× the cap | Radius +20% or duration +3 s. |
| tidemark `maker-shore` | Speed and turn pops at 4.4 s (route corner) | Add a corner point. |
| meridian `terraces-to-gate` | Turn kink at 5.2 s | `speed: "constant"`, `lookSmooth: 0.4`. |
| meridian `pool-glide`, crescent `maker-beach`, tidemark `maker-shore` | Ground flow 3.6–5.9× | Render these at `full60 --shutter 2`. |

## 5. Transition and post plan

**Transitions** (edit lists, `transition.type`):

| Where | Transition |
|---|---|
| Between beats inside an episode | `cut` (on motion or on a landed beat) |
| Scene to scene inside the compilation's build-up montage | `cut` on matched orbit direction, so it reads as one camera visiting five worlds |
| Board to world | `grays` 0.8 s |
| Kit to world | `fade` 0.4 s, or a match cut |
| Episode to episode | `dip` 0.8 s around the episode cards |
| Life arriving | once, `flash` 0.3 s (optional) |
| End of the film | `slowfade` 1.0 s into the end card |
| Quiet moments | `smoothfade` 0.7 s, eased |
| Whips | `whip` 0.25 s, only between two shots that both whip in the same direction |

**Post** (CPU, ffmpeg):
1. **In the render:** motion blur and anti-aliasing come from shutter sub-frames (GPU time ×N), with the shutter at 180°. DOF and bloom are in-engine; DOF needs the hook.
2. **In the cut:** `"post": {"lut": "luts/holodeck-warm.cube", "eq": {"contrast": 1.02}, "vignette": 0.18, "deband": true}` in both edit lists. Use `holodeck-cool` for the winter episode by grading its segments in a separate pass, or keep one look for consistency. Decide this on the stills.
3. **At delivery:**
   - YouTube: `node tools/deliver.mjs out/full/cuts/<cut>.mp4 --preset youtube-4k --grain 5` (lanczos to 2160p, then grain).
   - X: `--preset x --grain 4`.
   - Archive: `--preset master`.
4. No audio. The edit lists' `music.note` marks where a licensed bed would sit. If a bed is added later, re-cut on the beat grid (`buildup.bpm`).

## 6. Engine hook (`patches/cinema-hook.patch`)

The patch still applies to `meridian-integration` HEAD and is unbuilt. **Recommendation: land it as a Holodeck PR after tomorrow's renders, not before them.** Tomorrow renders with the hook-free pipeline, already working, so the film does not wait on an engine review. The PR needs the user's authorisation (AGENTS.md).

It should grow to support:
1. **Post nodes in cinema mode:**
   - `holodeckCinema.post({dof: {focus, range, bokeh}, bloom, lensflare})` builds `dof()` on `scenePass.getViewZNode()` inside `CoveEffects`'s `RenderPipeline`, with the parameters as uniforms so focus pulls animate without recompiling;
   - motion blur as accumulation, so the hook exposes `jitter(x, y)` (through `setViewOffset`) and a step of any length, not a velocity pass.
2. **Per-placement animation without vertex rewrites:** `staticMerge={false}` in cinema mode, as the patch already does, so every placement is an instance or an Entity. Add `transforms(batch)` to set many placements per frame in one call.
3. **Reflections during build-ups:**
   - `reflections('live')` switches probe mirrors to the live CubeCamera path (`src/world/live-reflection.mjs` already captures one face a frame);
   - `refreshReflections({faces: 6})` captures every live cube now, for frozen-time warm passes;
   - optionally `captureSkyLight()` re-run at act boundaries. It is expensive: the probe grid reached 41% in three minutes, measured, in the engine's own comments. So call it once for the empty world and crossfade the environment at life.
4. **Readiness:** `ready()` reports sky-light, probe-grid and compile state separately, so the renderer can wait for exactly what a shot needs. The smoke test timed out on `renderReady` while the sky light was still capturing.
5. **Emotes and maker input:** `drive({emote})` in place of Digit keys, and an export rebuilt from a checkout that has the emote wheel.
6. **A protocol version** (`holodeck-cinema-v1`) that `report.json` records. The director's fiber discovery stays as the fallback for older exports.

## 7. Tomorrow's run order

GPU = needs a quiet GPU (no game). Estimates are the README's figures (RTX 3070, ±50%), scaled for sub-frames; the new options have not been measured on the GPU yet.

| # | Step | GPU | Time |
|---|---|---|---|
| 0 | `node --test`, `node tools/validate.mjs`, `node tools/grammar.mjs --edit edits/compilation-75.json`, `node tools/animatic.mjs --edit edits/compilation-75.json --edit edits/long-cut.json` | no | 2 min |
| 1 | Apply the §4 shot fixes; re-run grammar and animatics; review the animatic pages and the cut timelines | no | 30 min |
| 2 | Add `"post"` to both edit lists; `node cut.mjs edits/compilation-75.json --check` | no | 5 min |
| 3 | **Smoke test (old path):** `node render.mjs --scene meridian-sanctuary --shots assembly --quality draft --max-seconds 6 --ready-timeout 300 --no-reel`. Check `report.json`: build `matched`/`planned` (the unverified lookup fix), hitch frames, sky-light state | **yes** | 4 min |
| 4 | **Smoke test (new options):** the same with `--shutter 4 --jitter --max-seconds 2`. Check the blur on flying pieces, no double images, and that the maker drop and rig still behave (sub-frame `dt`) | **yes** | 3 min |
| 5 | **Previews:** `node render.mjs --all --quality preview`, then review the contact sheets and stills (agent critique pass) and fix framing | **yes** | 35 min, plus 20 min review |
| 6 | **Mood board:** start the app (`node bin/holodeck.mjs dev …worlds/cove-starter --port 4186`), then `node render.mjs --scene cove-board --quality full` | **yes** | 10 min |
| 7 | **Hero build-ups:** `node render.mjs --all --shots assembly --quality full --shutter 4 --jitter` (5 shots, about 120 s, 3,600 frames, 14,400 captures) | **yes** | ≈ 60–75 min |
| 8 | **Kit parts:** `node render.mjs --all --shots kit-parts --quality full --shutter 2` | **yes** | ≈ 15 min |
| 9 | **World shots:** `node render.mjs --all --quality full --shots <the rest>`; low glides again with `--quality full60 --shutter 2` | **yes** | ≈ 60 min |
| 10 | **Real-time B-roll:** OBS and NVENC of the authoring app: drag a placement, swap a Kiln part, hot-load, maker emotes. 60 fps, CQP 18, P5. The user drives, or the agent drives through the app's own agent channel | **yes** | 30 min |
| 11 | **Cuts:** `node cut.mjs edits/compilation-75.json --quality full` and the long cut (CPU; Chrome renders the cards only, no WebGL) | no | 10–15 min |
| 12 | **Delivery:** `node tools/deliver.mjs … --preset youtube-4k --grain 5` and `--preset x` (CPU; the 4K slow encode of 5:21 is long, so start it last or overnight) | no | 20–60 min |
| 13 | Optional: land the engine hook as a PR (with authorisation), then re-render the mood board with a DOF focus pull and the build-ups with live mirrors | **yes** for renders | later |

GPU total: about 3.5–4.5 h. The steps are ordered so the hero shots (7) land early, and the compilation can be cut from steps 6–8 alone if time runs short.
