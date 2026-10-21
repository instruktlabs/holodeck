# Scripted cove demo (historical prototype)

Open `/prototype.html?demo` for the original scripted interaction demo described
below. It has actual first-person movement and fixed scene changes; no coding
agent runs, no agent credentials are accessed, and conversation does not edit the
repository. The normal `/prototype.html` route now opens persistent local world
authoring with the optional native Codex connection. See
[local agent and live world authoring](local-agent-world-authoring.md) and
[the world library](world-library.md) for that current workflow.

## Try it

1. Click **Explore** for mouse look and pointer lock. WASD or arrows move;
   Shift moves faster. Right-drag also looks around without pointer lock.
2. Press **Enter** or **Tab** while exploring to release the mouse and focus
   the message field. Escape releases the mouse. Typing stops movement.
3. Ask for a quiet woodland with a stream and a path, or use the suggestion.
   Choose a clear path or wilder edges. The mock builds a fixed scene after a
   short delay. Stop cancels it; canceled work cannot arrive late.
4. Walk toward the water. Look at the stream and press **E**, click the water,
   or use **Select crossing**. Ask for a bridge there.
5. Inspect the amber preview, lower the rails, apply it, or discard it. The
   water blocks crossing until the bridge is applied. Undo restores the previous
   bridge revision. Preview changes leave the committed bridge intact.
6. Hide/show the whole cove, or use **Return to cove** to recall it and reset
   your viewpoint. Reference and world-bible panels remain available.

Conversation cards collapse while moving or in pointer lock. The input and the
selected target are kept separate: each mock build captures its target at submission.
Unknown requests explain the small supported vocabulary instead of pretending to
build arbitrary worlds. The bible, references, and scene reset on page refresh.

The microphone records up to 20 seconds. The existing local Whisper worker
transcribes it into the editable composer; sending remains explicit. First use
downloads the speech model. Denial leaves text usable. The scene works without
speech, cloud credentials, or an agent subscription.

## Implementation boundaries

- R3F 9.8.2 / React 19.2.9 / Three 0.186.1, with WebGPURenderer and forced
  WebGL2 via `?backend=webgl`. DOM conversation UI; Glyph/UIKit are still
  compatibility experiments rather than dependencies of this interface.
- The origin kit is authored and saved through installed Kiln 1.3.1, in the
  separate `../holodeck-assets` workspace. `assets/cove/` preserves
  its source and exact delivery provenance. Browser code loads only the GLB.
- Static geometry is grouped by material at load. Quantized GLB attributes are
  expanded into floating point before applying transforms; this prevents
  truncation and overflow. Saved semantic source nodes remain in the original GLB.
- Trees, grass, stream, and bridge are deterministic runtime scene scaffolding.
  Vegetation uses instancing. The geometry is deliberately stylized prototype art;
  the generated references are a visual direction, not runtime screenshots.
- Simple horizontal collision covers the cove wall/seat, table, canopy masts,
  tree trunks, world limits, and stream crossing. This is not a general physics
  engine. There is no jumping, swimming, character possession, terrain editor,
  VR session, persistent world, or real agent/subagent loop yet.
- Hiding the cove hides its geometry, reference placards and local light and
  removes its movement blockers. The origin remains available for recall.

## Verification

The warm cove pass uses saved Kiln revision
`r_62e28c9e86fe47e7859d08c4379328e5`, with its parent and source preserved under
`assets/cove/warm/`. It adds an asymmetric ember stone, softened clay edges,
pillows, a woven rug and climbing foliage. The browser supplies procedural
color/normal maps for clay, stone, wood and textiles, plus warmer lighting.
The thin canopy does not cast a shadow in this approximation. These material
maps are runtime derivatives, not embedded textures in the saved Kiln artifact.

The production build passed the existing interaction probe on both WebGPU and
forced WebGL2 after this pass. Those checks cover behavior and rendering errors;
they do not establish general device performance or visual acceptance.
For planned agent, bible and asset loading behavior, see
[local agent and live world authoring](local-agent-world-authoring.md).

`node --test src/prototype/session.test.mjs` checks cancellation, transactional
bridge revisions/undo, and unsupported intent boundaries. After `npm run build`
and `npm run preview`, `node scripts/prototype-probe.mjs` checks both backends,
text focus, movement, pointer lock/release, card collapse, cancellation, revisions,
cove recall and reference/bible panels. `node scripts/prototype-crossing.mjs`
checks approaching the stream, aim selection, preview blocking and applied crossing.
Receipts and screenshots live under `evidence/prototype-*`.

These local Chrome desktop checks do not qualify mobile, WebXR, other GPUs,
long-running memory behavior, production art, or natural microphone recognition.
The build still reports the existing large Three.js bundle warning.
