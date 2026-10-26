# Holodeck cinema

Directing plan, research and the render run order: [plan.md](plan.md).

The tooling itself lives outside this repository, in a `holodeck-hub-tools/cinema` folder beside the Holodeck checkout. Paths below are relative to that folder unless they start with `bin/`, which run from the Holodeck checkout.

Scripted, deterministic promotional footage of Holodeck scenes: per-scene shot lists, a frame-stepped renderer (Playwright and system Chrome, WebGPU) and an edit-list assembler for the two cuts of *Kiln: How It's Made*. Everything here lives outside the engine checkout. The engine is used read-only: Playwright and the runtime modules are loaded from it for the CPU route check, and the Inter font comes from its bundled files.

## Commands

All commands run from this folder:

```powershell
cd ..\holodeck-hub-tools\cinema   # from the Holodeck checkout

# 1. CPU-only checks (no browser, no GPU): camera clearance and colliders, maker routes, build-up plans
node tools/validate.mjs
node render.mjs --all --quality full --dry-run        # frame counts per shot
node --test                                            # unit tests (camera math, grammar, transitions, post, animatic, director hooks)
node tools/grammar.mjs [scene ...] --edit edits/compilation-75.json   # shot grammar: pan cap, pops, zoom, horizon, holds, cut checks
node tools/animatic.mjs --edit edits/compilation-75.json --edit edits/long-cut.json   # out/animatic/*.html top-down previz

# 2. Smoke test (about 3 minutes, 480x270): one build-up shot, first 6 s
node render.mjs --scene meridian-sanctuary --shots assembly --quality draft --max-seconds 6 --ready-timeout 120 --no-reel

# 3. Previews: every shot at 640x360, with contact sheets
node render.mjs --all --quality preview

# 4. FULL RUN: every static scene, 1920x1080 at 30 fps, PNG frames piped to x264 (CRF 14, slow)
node render.mjs --all --quality full

# 5. Cuts (after step 4; use --quality preview to cut the previews instead)
node cut.mjs edits/compilation-75.json --quality full
node cut.mjs edits/long-cut.json --quality full
node cut.mjs edits/long-cut.json --check               # timing table and missing shots only
node cut.mjs x --transitions                           # the transition catalogue

# 6. Delivery (CPU, after the cuts): grade if asked, scale, grain last, H.264 per platform
node tools/make-lut.mjs                                # luts/holodeck-warm.cube, holodeck-cool.cube, identity.cube
node tools/deliver.mjs out/full/cuts/compilation-75.mp4 --preset youtube-4k --grain 5   # also youtube-1080, x, master; --dry-run prints the command
```

Other options: `--scene a,b`, `--shots id,id`, `--quality draft|preview|full|full60|full4k`, `--shutter N [--shutter-angle 180] [--jitter]` (N sub-frames per frame across the open shutter, averaged by the encoder into real motion blur; `--jitter` adds sub-pixel Halton offsets for anti-aliasing; N times the render time), `--width/--height/--fps`, `--max-seconds N`, `--headed`, `--backend webgl` (forces WebGL2), `--keep-frames`, `--no-reel`, `--no-sheet`, `--buildup stepped [--stages N]`, `--with-app` (adds app-source scenes to `--all`), `--ready-timeout S` (default 300) and `--port` (default 4700; the renderer serves each export on a free port from there and stops the server when it finishes).

Use 30 or 60 fps. The runtime steps in fixed 1/60 s ticks, so 24 fps would alternate two and three ticks per frame and make the world's own motion judder.

## Outputs (`out/`, ignored)

```
out/<quality>/<scene>/shots/<shot>.mp4     H.264 high, yuv420p, +faststart
out/<quality>/<scene>/reel.mp4             all shots of the scene, 0.5 s dissolves
out/<quality>/<scene>/stills/<shot>@<t>s.png   hero stills (the shot's "stills" times)
out/<quality>/<scene>/contact-sheet.jpg    4 frames per shot, notes, ms/frame, hitches
out/<quality>/<scene>/report.json          load, hooks found, build plan, per-shot timing, hitch frames, page errors
out/<quality>/summary.json
out/<quality>/cuts/<edit>.mp4 and <edit>.txt   timecoded segment list
out/animatic/<scene>.html, <edit>.html     top-down previz: plans, frustums, maker walk, speed/turn graphs, acts, grammar issues
```

If ffmpeg is missing, frames are kept under `out/<quality>/<scene>/frames/<shot>/` and each shot's exact encode command is written to `report.json`. ffmpeg 7.1 is installed here.

## How frames are timed (determinism)

`lib/page-clock.js` is injected before the viewer loads. During loading the page runs in real time, so assets load, shaders compile and the sky light is captured normally. After that the renderer *engages* a virtual clock: `performance.now()`, `Date.now()` and `requestAnimationFrame` become virtual, and nothing advances until the renderer calls `tick(1000/fps)`. That advances time by exactly one frame and runs R3F's loop and three's renderer loop once. R3F's delta is exactly 1/fps, the runtime takes exactly two 1/60 s steps at 30 fps, and maker steering, follow-camera smoothing and build-up animation are all functions of the frame index. `Math.random` is seeded. Each shot starts from `runtime.reset()` (through the benchmark scenario API, which also sets the cove), so world time restarts at 0.

Before a shot records, it is *warmed*: time stays frozen while the renderer visits 8–12 poses along the shot until shader compiles finish. If a compile still arrives mid-shot, that frame is redrawn with time frozen until the compile completes (up to 8 s), so a compile never shows up as a pop or a skipped frame. `report.json` counts these as `hitchFrames`. The frame is captured with a CDP screenshot after two real animation frames have presented it.

What it drives, with no engine edits:

| Need | Existing hook used |
|---|---|
| Camera pose per frame | R3F's own frame subscription (`store.internal.subscribe`, the mechanism behind `useFrame`), at priority -0.35, which runs after the view controller (-0.5) and the benchmark pose (-0.4) and before the sun shadow (-0.25) and render (1) |
| R3F store, runtime, view-controller refs | a minimal React DevTools hook (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) that only collects committed fiber roots |
| Cove on/off, runtime reset, UI hidden | `?benchmark=1` and `holodeckBenchmark.scenario()` (static exports) |
| Maker walking | G (free/walk) and V (first/third) keys; the walk ref's yaw and held W/Shift are set per frame at -0.6 |
| Emotes | Digit1–9 on builds that have the emote wheel. Current exports have none; the director logs `supported:false` |
| Build-up and parts | the renderables the scene already built: InstancedMesh instance matrices (static batches), vertex ranges of merged shared-material meshes (rewritten in world space), and Entity groups |

## Shot lists (`shots/<scene>.json`)

```jsonc
{ "scene": "tidemark", "title": "Tidemark Island",
  "source": {"type": "static", "dir": "exports/tidemark"},   // or {"type": "app", "url": ...}
  "fps": 30,
  "shots": [{
    "id": "hut-pushin", "duration": 8, "cove": false, "stills": [7.5], "note": "...",
    "kind": "move",            // move (default) | buildup | parts
    "camera": {
      "type": "path",          // path | orbit | follow
      "ease": "glide",         // glide, inOutSine, inOutCubic, outCubic, smootherstep, linear, ...
      "keys": [{"pos": [x,y,z], "look": [x,y,z], "fov": 55, "at": 0.0}],  // "at" optional; else spaced by travel
      "shake": {"amp": 0.02, "freq": 0.3},               // optional deterministic handheld drift
      "speed": "constant",     // optional: arc-length parameterised path (no surges between uneven keys; ignores "at")
      "interp": "bezier",      // optional: cubic Bezier through the keys; key "in"/"out" handles, else automatic
      "ramp": [[0, 1.6], [0.8, 0.35], [1, 0.3]],        // optional speed ramp [u, relative speed]; replaces the ease
      "lens": 35,              // optional: full-frame mm instead of fov (also per key, and on orbit/follow)
      "lookSmooth": 0.4,       // optional: Gaussian smoothing of the look target (seconds; path/orbit)
      "dollyZoom": {"subject": [x,y,z], "lens": 50},   // optional: subject keeps its size; look locks to it
      "roll": [0, 4],          // optional: degrees (needs "grammar": {"maxRoll": ...} to pass the check)
      "aim": {"weight": 0.85, "offset": [0,1,0]}         // optional: pull the look toward the maker
    },
    "grammar": {"panSeconds": 7, "whip": false, "allowZoom": false, "maxRoll": 0, "holds": {"head": 0, "tail": 1.2}},  // optional rule tuning
    "maker": {"route": [[x,z], ...], "start": [x,z] | [x,y,z], "startAt": 0.4, "run": false,
              "turnRate": 100, "emotes": [{"id": "wave", "slot": 1, "at": 6}], "mustFinish": false}
  }]}
```

- **orbit:** `center`, `radius`, `height`, `from`/`to` in degrees (0 puts the camera on +z of the centre, and angles turn counter-clockwise seen from above), `lookHeight`, `fov`. Any number can be a `[from, to]` pair.
- **follow:** a rig around the maker. `angle` (0 = behind, 90 = right side, 180 = in front), `distance`, `height`, `side`, `lead`, `lookHeight`, `lag` (smoothing seconds) and `fov`.
- **buildup** (the hero shot): the world assembles from bare terrain, water and the empty cove. Placements are classified by layer, behaviour and asset id into acts: landforms → cove → foundations (bottom-up from the cove) → architecture (flies in, turning to its yaw) → water features → vegetation (one hero piece first, then the rest spreading out from it) → props → sky and art (statues and orbs swoop in from 40 m) → life. At life, world time starts, flocks appear and the maker drops in. Each act's share of the timeline grows with its piece count. `buildup.edits: "auto"` adds a swap (a vegetation piece leaves and a sibling variant flies onto its placement, holds, then returns) and a tweak (a scale bump on an architecture piece). Explicit edits look like `{"type": "swap", "piece": id, "donor": id, "at": s}` or `{"type": "tweak", "kind": "scale" | "spin" | "nudge", "piece": id, "at": s}`. A shot can override act patterns and timing with `buildup.acts.<name>`, plus `lead`, `tail`, `cadence`, `speed`, `heroNear` and `skip`. Pacing: `pacing: "power"` (default, sparse then cascading), `"swell"` (dense in the middle of each act) or `"linear"`; `bpm` (with `beatDiv`) or `beat` (seconds) lands piece starts on a rhythm grid; `ramp` (as camera ramps) time-warps the build, for slow motion on a hero landing, and keeps its end time.
- **parts:** the kit as individual parts. One piece per asset (kit families first) is lifted onto a row at `parts.at`, normalised to `size`, and turned at `spin` degrees per second. Everything else is hidden.
- **Stepped fallback:** `--buildup stepped --stages 12` renders the same plan as stop-motion. It makes one page load per stage, with the scene filtered by the renderer's own server, and needs only the documented benchmark hooks. Each stage costs one page load plus the readiness wait, about 2–5 min per stage.

To add a shot, append it to the scene's list, then run `node tools/validate.mjs <scene>` (clearance, colliders and route completion, all on the CPU). After that, `node render.mjs --scene <scene> --shots <id> --quality draft` renders it. `tools/height-grid.mjs <scene> x0 x1 dx z0 z1 dz` prints ground heights for placing cameras. `tools/scene-summary.mjs <export dir>` lists landmarks by asset.

## The film: *Kiln: How It's Made*

Each scene follows this arc: references on the cove board, then the parts (`kit-parts`), then the world assembling (`assembly`), then the finished world with the maker walking it.

- `edits/compilation-75.json` runs 75.1 s. It is fast and cuts across scenes: title, board, parts, five assemblies, finished-world montage, end card.
- `edits/long-cut.json` runs about 5:21 (321 s by `--check`), with an episode per scene: episode card, the optional per-scene board, the parts card, the full parts and assembly shots, then 4–6 world shots, plus an intro and an outro.
- **Segments:** `{scene, shot, in, out}`, `{card: {kicker, title, subtitle, theme: clay|linen|night}, duration}` or `{board: {title, images, captions}, duration}`. Transitions: `cut`, house presets with default lengths (`fade`, `dissolve` = the classic cross-dissolve, `smoothfade` eased, `dip` to black, `flash`, `slowfade`, `fastfade`, `grays`, `whip`, `push`, `wipe-left`/`wipe-right`, `pixel-dissolve`), any of ffmpeg 7.1's 57 xfade names, or `{"type": "custom", "expr": ...}` (`lib/transitions.mjs`; `node cut.mjs x --transitions`). An edit list may carry `"post": {"lut", "lutStrength", "eq", "curves", "vignette", "deband"}` (`lib/post.mjs`), applied to the whole cut; `--no-post` skips it. Grain belongs to `tools/deliver.mjs`, after the scale (or `"grainInCut": true`). `alt` lists fallbacks, and `optional` segments are skipped if they are not available.
- **Cards:** plain HTML with Holodeck's bundled Inter (OFL), rendered by Chrome. There are no external fonts or assets.
- **Music:** there is no licensed music, so the cuts are video only. Each edit list has a `music.note` that says where a bed would sit.
- **Mood board:** static exports exclude the board by design. The opener uses the cove's starter-board concept images (Holodeck's bundled CC0 `public/design/first-person/*.png`, captioned as concepts). To use a real 3D board shot instead (`shots/cove-board.json`, which the edit lists pick up automatically through `alt`), start the authoring app on a world whose board shows the references you want. `worlds/cove-starter` was created with `holodeck init`. Then render:
  ```powershell
  # terminal 1 (from the Holodeck checkout you want to film; vite writes its cache under that checkout's node_modules)
  node bin/holodeck.mjs dev ..\holodeck-hub-tools\cinema\worlds\cove-starter --port 4186
  # terminal 2
  node render.mjs --scene cove-board --quality full
  ```
  For per-scene reference boards in the long cut, drop `1.jpg`, `2.jpg` and `3.jpg` into `refs/<scene>/`. The app-source path is untested; it uses the same hooks, plus canvas isolation for the authoring panels.

## Measured cost and estimates

The smoke test ran on this PC (RTX 3070, shared at about 40% load by other work at the time) with Meridian `assembly`, 180 frames at 480x270:

- Page load: 12.9 s. A real-time settle followed and timed out at 120 s with `renderReady` still false; the sky light was still capturing, then compiles settled in 5 s.
- Mode switch, plan and warm: about 20 s.
- Recording: **64.7 ms/frame** mean, about 4 s for frame 0, which absorbs compiles.
- x264 encoding: 31 ms after the last frame (it runs in parallel through the pipe).
- Whole command: 169 s.

A CDP capture of a 1080p frame costs about 40 ms for a simple page, more for a real frame. Full-run figures are extrapolated, not measured: about 0.2–0.3 s per 1080p frame (render, 2 presented frames, PNG capture, x264 slow in parallel), plus about 5–8 min per scene for loading, sky settling (up to 300 s) and warming.

| Command | Frames | Estimate |
|---|---|---|
| `render.mjs --all --quality full` | 11,700 (390 s of shots) | **≈ 1.5 h** (±50%) |
| per scene, full: Meridian / Cove / Tidemark / Winter / Courtyard | 2760 / 2310 / 2310 / 2340 / 1980 | ≈ 20 / 17 / 17 / 17 / 15 min |
| `render.mjs --all --quality preview` | 11,700 at 640x360 | ≈ 35 min |
| `render.mjs --scene cove-board --quality full` | 480 | ≈ 5 min, plus the app start |
| `cut.mjs edits/compilation-75.json --quality full` | 20 segments | ≈ 2–3 min (CPU) |
| `cut.mjs edits/long-cut.json --quality full` | 48 segments | ≈ 8–12 min (CPU) |

`out/<quality>/summary.json` records real figures after each run.

## Engine hook (recommended, not applied)

`patches/cinema-hook.patch` applies cleanly to `meridian-integration` HEAD but has not been built or run. It conflicts with nothing in HEAD; the uncommitted work in progress also touches `main.jsx` and `runtime-scene.jsx`, so re-check after that lands. It adds an opt-in `?benchmark=1&cinema=1` mode:

- **`src/viewer/cinema.jsx`:** `window.holodeckCinema` with `step(seconds)`, using R3F `frameloop: 'never'` plus `advance`, so no clock patching is needed. Also `pose()`, `cove()`, `mode()`, `reset()`, `pause()`, maker `place()` and `drive()`, and `placements()` and `transform(id, matrix | 'hidden' | null)`.
- **`viewer/main.jsx`:** mounts it, and in cinema mode passes `staticMerge={false}`, so every placement is an InstancedMesh instance or an Entity. The merged-mesh vertex rewrite goes away.
- **`runtime-scene.jsx`:** scripted maker input (`actor.cinemaInput`) in place of keys.

Why: the current pipeline works through the DevTools fiber hook, private refs and vertex rewrites. These are fragile across engine changes: a renamed prop or reordered hook breaks discovery, and `report.json` says which lookup failed. The patch turns them into a small, testable protocol and makes per-placement animation exact and cheap.

## Tooling layout and tests

- `lib/paths.js` (curves, arc length, ramps, smoothing, lenses, dolly zoom) loads before `lib/camera.js` in the page and in Node. Existing shot cameras evaluate exactly as before (`test/fixtures/legacy-poses.json`).
- `lib/grammar.mjs` plus `tools/grammar.mjs`: shot and edit checks. Follow shots use the engine's own maker walk (`lib/sim.mjs`, read-only engine import), smoothed with the rig's lag as on the page.
- `lib/animatic.mjs` plus `tools/animatic.mjs`: static SVG/HTML previz from world data. There are no scripts and no WebGL.
- `lib/transitions.mjs`, `lib/post.mjs`, `tools/make-lut.mjs` and `tools/deliver.mjs`: the edit and finishing chain.
- `node --test` runs `test/*.test.mjs` on the CPU in a few seconds. The ffmpeg tests use 16x16 and 32x18 synthetic frames.
- Fixed in `lib/ffmpeg.mjs` (found by the tests):
  - A fade straight after a cut failed (xfade timebase mismatch after concat).
  - Each normalised segment lost its last frame (`fps` after `scale`).
  - Neither had been hit before, because no cut had been assembled yet.

## Notes

- `exports/` holds copies of the five static exports this was built against, from the scratchpad builds. Meridian is revision 27.
- Static exports have no emote wheel. Emote directives become no-ops until exports are rebuilt from a checkout that has it.
- Courtyard has no maker. Shots without a `maker` park the maker at its spawn.
- The build-up's mirror and probe reflections were captured with the complete world at load, so mirrored surfaces can show unbuilt pieces early in an assembly. Planar water reflections are live and correct.
- Treat shot framing as a starting point until previews are reviewed. Only Meridian's opening seconds of `assembly` have been seen rendered.
