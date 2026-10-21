# Milestone 1 findings

2026-10-21. Compatibility evaluation and visual candidates are available. The
visual identity is under review; full agent orchestration and production cove
assets have not started. See the [current platform direction](creation-platform.md)
and [presence/interface proposal](presence-and-agent-interface.md).

## Dependency decision

| Dependency | Evaluated version | Result |
| --- | --- | --- |
| React / React DOM | 19.2.9 | Compatible peer range; lab runs |
| React Three Fiber | 9.8.2 | Both rendering backends exercised |
| Three.js | 0.186.1 | WebGPURenderer on native WebGPU and forced WebGL2 |
| Glyph | 0.1.0 | Text renders; retain behind an adapter pending lifecycle follow-up |
| React Three UIKit | 1.0.77 | Tested panel visually incorrect; excluded from default fixture |
| Kiln | 1.3.1 | Installed; CLI help and offline discovery verified |
| Transformers.js | 4.3.1 | Local Whisper CPU inference verified |
| Vite | 8.3.5 | Development and production builds work |
| Playwright | 1.64.1 | Chrome-based probes |

Pins live in package.json and package-lock.json. npm reported no dependency peer
conflicts and zero audit vulnerabilities at installation. The tested host uses
Node 24.20.0 and npm 11.19.0. Optional native install scripts for onnxruntime-node,
webgpu, and protobufjs were not enabled; browser inference and CLI discovery do
not establish that those optional native paths work.

React's latest registry release was 19.3.1, outside Glyph 0.1.0's declared peer
range. The GitHub README also describes a newer API generation than the published
version. Use installed types/source and exact pins, not a mixture of main-branch
examples and the published package.

## Rendering evidence

Host: Windows, Ryzen 7 3700X, RTX 3070, NVIDIA driver 32.0.16.1742. Chrome
155.0.8059.85 ran headless at a 1920 x 1080 browser viewport, DPR 1. The canvas
occupies the page's inset viewport, not the entire 1080p screen. WebGPU adapter
identifies NVIDIA/Ampere. No mobile or headset claim follows from these results.

The later Glyph-only probe is in [glyph-isolation.json](../evidence/glyph-isolation.json).
It exercised a label, dynamic wrapped/clipped caption, image plane, and actual
raycast selection of the origin mesh, then twenty unmount/remount cycles and a
missing-font/recovery sequence on each backend.

| Measurement | WebGPU | Forced WebGL2 |
| --- | --- | --- |
| Warm static observation | 60 seconds | 60 seconds |
| p95 frame interval | 7.1 ms | 7.1 ms |
| Frames above 50 ms in warm window | 0 | 0 |
| Fixture draw calls | 36 | 36 |
| Fixture triangles | 1,059 | 1,059 |
| Caption replacement / clipping | Rendered and measured | Rendered and measured |
| Object click selection | Observed | Observed |
| Font recovery | Recovered with a new mounted font instance | Recovered with a new mounted font instance |

This is a tiny static compatibility fixture, not a traversal or world benchmark.
Frame intervals include browser scheduling; they are not GPU execution timings.
Measured text bounds and screenshots are retained. The font failure deliberately
feeds a missing/invalid resource and produces the expected GlyphFontError. An
earlier development run also emitted a conditional React use() warning; the
later isolated run recovered without that warning.

**Open lifecycle issue:** on WebGPU, reported storage attributes rose from 12
to 31 over twenty remounts, with roughly 128 additional reported bytes per cycle.
The increase persists with UIKit disabled. This does not pass the no-accumulation
gate. It is an observed retained-resource symptom in this integration, not yet
an attributed upstream bug. Forced WebGL2 reported zero storage attributes;
that alone is not proof of complete GPU resource reclamation.

## Glyph font preparation

The initial Inter variable font failed baking with `unsupported table fvar`.
FontTools 4.59.0 produced a static weight-400/optical-size-14 instance. Baking
that font succeeded after running from the output directory with a basename;
the nested relative output form produced an invalid Windows temporary path.

Reproduce from `public/fonts`:

```powershell
python -m fontTools.varLib.instancer Inter.ttf wght=400 opsz=14 --output Inter-Regular.ttf
node ../../node_modules/@pmndrs/glyph/bin/glyph.js bake --input Inter-Regular.ttf --output inter.font.glb --unicodes U+0020-007E --msdf --json
```

The baked ASCII test font is 2,115,880 bytes. The original font and OFL license
are retained. The limited glyph range is a test fixture, not multilingual product
support. Font fallback and locale coverage need a separate production decision.

## UIKit result

The expected colored, rounded, clipped panel instead appeared as an unstyled
white plane. Inspection found `onBeforeCompile` GLSL modifications in UIKit's
panel/text materials; they cannot be assumed to transfer to this renderer path.
Both backends here use WebGPURenderer, not classic WebGLRenderer.

Keep UIKit opt-in with `?uikit` for reproduction. Use native DOM editing and
simple supported scene surfaces during prototyping. Do not switch the entire
renderer or write a custom UI framework merely to retain this candidate.

The [original probe](../evidence/browser-probe.json) includes UIKit and earlier
timing/lifecycle instrumentation. The later isolated report supersedes its
incomplete per-frame draw metrics and establishes recovery with a new mount.

## Local speech result

Selected candidate: Whisper tiny.en, quantized, executed through Transformers.js
in a browser worker using CPU/WASM. Model revision is
`79fb389fc764e7c395bd330e9531d9d32ada7049`. First use downloads public model files;
the ONNX runtime files are served locally from installed dependencies. Some
library metadata discovery requests still address main; the configured model
revision and observed resolved revision are recorded in network evidence.

[Speech evidence](../evidence/speech-probe.json) used a locally synthesized
2.579-second WAV: "Keep the path open to the trees."

- Recognized the phrase correctly; observed initial model setup was 1.95 s
  and inference 2.23 s. These are this run's observations, not a cold-network SLA.
- A second inference with all remote requests blocked succeeded in 1.54 s.
  This proves warm in-session operation, not offline reopening on a fresh machine.
- Browser-enforced microphone denial returned NotAllowedError and preserved the
  editable text field. No audio upload or POST request was observed.
- The [capture-path probe](../evidence/microphone-probe.json) fed the same fixture
  through Chromium's simulated microphone. Start/stop recording, decoding,
  recognition, editable output, and return to idle worked. The repeated phrase
  in its output reflects the looping synthetic input.

The pinned encoder/decoder weights total 40,852,295 bytes (about 39 MiB), per
[model file metadata](../evidence/speech-model-sizes.json), plus tokenizer/config
files. The local WASM runtime is about 26.9 MB. Vite also emits a runtime copy
through dependency bundling; consolidate that duplicate before packaging.

No physical microphone was used by the automated probes. Natural speech,
background noise, interruptions, and a user's microphone remain human trial
items. Inference shares CPU resources with the app and must be profiled during
actual world editing. Resident ML memory remains to be measured before
distribution; this browser spike does not claim negligible cost.

## Prototype resource envelope

Use these conservative starting caps for the eventual single-world prototype;
they are policy proposals to enforce and challenge with the authored kit, not
performance guarantees derived from this tiny fixture:

| Resource | Proposed cap |
| --- | --- |
| Placed objects | 50, across up to six reusable asset families |
| Visible geometry | 100,000 triangles |
| Scene and spatial UI draws | 100 per frame |
| Resident decoded asset textures | 128 MiB estimated |
| Resident geometry buffers | 32 MiB estimated |
| Individual GLB delivery | 16 MiB encoded |
| Texture edge | 2048 px; exceptions require explicit budget review |
| Reference images | 12 pinned/local entries; thumbnails first, two full-resolution views active |
| Asset decode concurrency | 2 |
| Speech | One worker, one inference at a time; measure separately from GPU asset budget |

The fixture's renderer-reported memory is about 22 MiB, including its canvas
resources. That number is not total browser/GPU memory. Retain the original 60 fps
world target and remeasure using the actual Kiln-authored cove and a dense world
fixture before claiming the caps are practical.

## Visual handoff and next boundary

The first cabin/UI board was rejected. The revised cove kit introduced original
reusable asset identities; the current candidate places that kit on a bounded
platform in the empty construct. See [creation-platform-v3.png](../design/creation-platform-v3.png).
Prompts for all generated revisions are in `design/`. Images use the built-in
Image Generator and are concept art, not claims of runtime or asset completion.

The owner's newer presence proposal adds a free-moving creator view, optional
character inhabitation, and structured conversation blocks. It is documented
separately rather than silently expanding the lab into an agent product.

Next: review the platform/cove/Kiln identity, resolve the Glyph lifecycle strategy,
and conduct a natural-speech trial. Only then start detailed UI and Kiln asset
production within the agreed scope. No full loop, remote repository, commits,
publication, or deployment has been created.

## Sources

- [Glyph upstream](https://github.com/pmndrs/glyph), compared with installed 0.1.0 source/types.
- [Three.js renderer](https://threejs.org/docs/pages/WebGPURenderer.html), compared with installed Info.js.
- [Transformers.js pipeline](https://huggingface.co/docs/transformers.js/en/pipelines), compared with installed pipeline options.
- [Model repository](https://huggingface.co/Xenova/whisper-tiny.en).
- [Inter source and license](https://github.com/google/fonts/tree/main/ofl/inter).
