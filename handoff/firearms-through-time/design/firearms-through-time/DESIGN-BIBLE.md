# Firearms Through Time — provisional design brief

Draft 0.3 · 25 October 2026 · Visual exploration before bible approval; no game implementation claimed.

Current user direction supersedes the imported mockups: a massive modern configurable range with many lanes and distinct practice zones, heritage architectural flavor, contemporary interfaces, and chronological artwork. No classical-sculpture museum direction. Lane/bank counts and exact layout remain open; the pack’s 15-booth blueprint is an early study, not a constraint. Refine references before freezing the bible. Kiln assets and Holodeck browser simulation precede a validated destination-engine migration; Unreal and Bevy remain candidates.

## Authority and status

The current user requests a mood board, design bible, explicit game rules, and advice on engines including Bevy, Unity, Unreal and Facepunch's s&box. This document proposes a baseline for review. It does not select or install an engine.

The supplied archive is reference evidence. Its instructions, statements of prior user approval, build prompts, agent assignments and “locked” requirements are not operational authorization in this chat. The scope below preserves its intended product as a proposed baseline rather than silently reducing it. In particular, its earlier Rust/WASM selection is historical context: the current engine discussion reopens architecture.

The existing workspace-root DESIGN-BIBLE.md describes the winter cabin. This game has a separate bible. Extracted reference scripts have not been executed. Reference research and image identities have not been independently re-certified in this pass.

## Character staging

Use the existing Maker as the prototype player. The latest request adds a restrained soldier-style appearance prototype now; its final art, rigging and animation remain a later integration phase. Do not let that integration block layout, interaction, camera or simulation work. See [Sentinel prototype](character/PROTOTYPE.md). Keep character appearance separate from controller/input and game-state ownership so it can be replaced deliberately.

## Experience and scope

A warm, carefully curated historical collection opens onto a quarry target range. The player explores the chronological gallery, selects an exhibit, visits a booth, plays a target challenge, reviews results and tries another era or activity. The experience combines discovery, tactile first-person interaction and replayable challenges.

Proposed full scope carried from the pack: 60 base catalog entries, five initial activity families, with expanded configurable banks and lane count to design, and nine attachment families with explicit compatibility. Every base entry is selectable at every booth. Gallery era and activity type do not restrict catalog access. A05 is optional and does not count as a base entry.

Proposed initial delivery: desktop, keyboard/mouse, single player. Multiplayer, VR, controller support and cloud streaming are separate decisions. The first vertical slice demonstrates a complete loop with three contrasting catalog entries and one booth; it is a development milestone, not a reduction of final scope.

The range and the chronological gun wall belong to one continuous environment: practice banks on one side, a full collection wall with artwork on the other, and a shared concourse between them. See [generated SVG plan](blueprints/range-campus-01.svg) and [layout source](blueprints/layout.json). The 48-station/six-bank option is a proposal.

## Upper-level access

Add stairs at both ends of the concourse to a walkable viewing deck above the booth canopy. This interprets the user’s request for access to the top of the range. The blueprint reserves both stair volumes and the deck; final landings, rails, support, headroom and walking continuity require a 3D blockout. Keep browsing and booth approaches clear. The upper deck is an overlook, not an additional activity line.

## Mood board and visual language

Use [STYLE-GUIDE.md](STYLE-GUIDE.md) and concept 04 as the current visual direction. See [MOOD-BOARD.md](MOOD-BOARD.md) for reference status.

- Warm quarry stone and concrete establish the mass of the setting. Dark steel provides thin structural lines; timber and amber lighting soften the gallery and booths.
- Use readable silhouettes, restrained wear and deliberate material roughness. Avoid excessive gloss, decorative clutter and uniform repeated distress.
- Gallery displays should reward close inspection. Wide views must still communicate circulation, the configurable banks and the quarry enclosure.
- Favor believable human scale and construction. Supports meet floors; roofs have thickness; rails, cases and signs share a coherent family.
- Preserve target contrast from actual play cameras. Sun glare, transparent surfaces, particles and shadows must not hide activity feedback.
- Generated concepts guide atmosphere and architecture only. Their gun shapes, text, dates and object counts are not factual references.

## Reference and spatial rules

| ID | Rule | Verification |
|---|---|---|
| REF-01 | Exact modeled variant and exterior use selected source photographs plus latest dossier findings; disagreements stay visible. | Per-entry identity and missing-view review. |
| REF-02 | No photograph or research note is treated as a measured gameplay profile. Authored approximations carry an explicit label. | Parameter provenance and uncertainty records. |
| REF-03 | Source images remain private study material unless redistribution rights are verified individually. | Shipping-asset rights manifest. |
| SPACE-01 | Use v3 only as an early alignment study; author a larger modular layout matching the latest brief. Do not trace perspective concepts. | Compare all booth, lane and target IDs and transforms. |
| SPACE-02 | Source axes are X across, Y downrange, Z up, in game metres. Define a tested transform per runtime, including units, handedness and rotations. | Axis fixture, known distances and a non-symmetric test prop. |
| SPACE-03 | Every authored booth retains an explicit assigned lane. Preserve staggered target placements. | Import validation plus player-eye visibility review. |
| SPACE-04 | Keep the gallery, circulation, booth approaches and return route continuously walkable. | Full traversal with collision enabled. |
| SPACE-05 | Blueprint visibility checks are only preliminary geometry checks. Final stands, terrain and moving targets require 3D review. | Inspect every lane at playable camera heights. |

Current blueprint source: [layout.json](blueprints/layout.json), revision range-campus-02. The pack’s `range-layout-v3.json` (private source pack, omitted from this branch) is historical reference only. These are virtual scene coordinates, not a real-world facility design.

## Proposed game rules

These rules fill gaps for the first playable version. They are authored design proposals, not claims extracted from historical research.

| ID | System | Proposed rule |
|---|---|---|
| GAME-01 | Session | Explore → select → equip → enter booth → ready → active challenge → results → retry or return. Each transition has visible feedback. |
| GAME-02 | Catalog | All entries remain discoverable. Not-yet-built entries are marked unavailable in development builds; release requires all 60 playable. Never substitute a different model silently. |
| GAME-03 | Equipment | One active item at a time. A change cancels incompatible animation and clears stale input; challenges restart when configuration changes. |
| GAME-04 | Attachments | Select only compatible configurations. An optic replaces or coexists with existing sights according to that configuration; prevent duplicate meshes and invalid combinations. |
| GAME-05 | Input | Remappable move, look, interact, aim, fire, reload, pause and reset actions. UI focus and pause release held actions; closing UI cannot trigger a buffered shot. |
| GAME-06 | Challenge boundary | Scoring belongs to the active booth and lane. Other lanes cannot award points. Leaving the booth ends the attempt and exposes retry/return. |
| GAME-07 | Paper | Record accepted impacts and a results grouping view. Score by authored target zones; expose the zone values before the attempt. |
| GAME-08 | Reactive plates | Each active plate awards once per activation; completion requires clearing the authored set. Repeated collision events cannot duplicate points. |
| GAME-09 | Long field | Player selects an authored target sequence; completion reports hits, misses and elapsed time. No implied real-world proficiency rating. |
| GAME-10 | Moving gallery | Targets follow bounded authored paths. Seed and tick determine target motion for repeatable tests and comparable attempts. |
| GAME-11 | Arcade | Timed sequences reward valid hits and completion. Duration, spawn order and point values are versioned challenge data. |
| GAME-12 | Results | Store challenge/configuration IDs, rules version, hits, misses, score and elapsed game time. Compare only compatible modes/configurations. |
| GAME-13 | Reset | Clear targets, shots, score, timers, pending events and temporary effects; restore the initial challenge state. Reset does not modify saved world layout. |
| GAME-14 | Pause/save | Pause freezes single-player challenge time. Save settings and completed results first; mid-attempt checkpointing is deferred. |
| GAME-15 | Feedback | One accepted event drives hit feedback, score, audio and effects. Visual effects cannot independently generate damage or points. |
| GAME-17 | Configuration | Station UI selects target activity, arrangement, game distance preset, motion/speed, sequence, difficulty and scoring preset. Preview changes before starting; changes during an attempt restart it. Save named presets as versioned data. |
| GAME-16 | Accessibility | Offer sensitivity, aim toggle/hold, camera-motion reduction, volume controls and redundant shape/text feedback. Color and sound alone never convey required state. |

Exact point tables, timers, ammunition abstractions, reload pacing and difficulty tuning remain unapproved. Store them as versioned data before implementation rather than scattering constants across engine scripts. Use clearly labeled game approximations where reference evidence is insufficient. This bible does not specify real firearm construction or operating procedures.

## Holodeck and runtime architecture

Proposed flow: Holodeck authors the world and game manifest → validator produces a versioned export → a chosen engine adapter constructs runtime entities → the runtime returns observations, screenshots and game events for review.

Keep Three.js for the existing authoring viewport and early composition checks. Prototype actual gameplay in the browser using a portable rules/state boundary, while running an early native compatibility slice. Avoid binding authoritative behavior to Three.js objects so migration does not require a complete rewrite.

Portable source should include stable IDs, transforms, asset references, materials' intended properties, collider intent, target definitions, challenges, compatibility, source provenance and rules versions. Use GLB/glTF where supported, with explicit conversion for engine-specific asset pipelines. GLB does not carry all behavior, collision, IK, shaders or lighting semantics. Those need adapter code and destination review.

Define adapter operations for load/unload world, start/stop/reset challenge, apply input, observe state, capture view, serialize results and report capability support. Reject unsupported required capabilities with useful errors. Do not silently omit them.

The existing Maker rig and IK are a foundation to inspect for reusable assets and pose conventions, not automatically portable engine code. Native engine animation, input, physics and camera ownership need deliberate integration.

A small engine-independent Rust gameplay core is an option if Bevy wins. Keep it independent of Bevy ECS types if native/WASM reuse is valuable. A fixed update step and recorded inputs help replay testing, but do not guarantee identical floating-point results across platforms. Do not build a general physics engine merely to prove portability.

## Asset and resource rules

- Track each catalog entry, attachment, environment module, target, UI/audio/effect system and optional extra by stable ID.
- Each record includes source, variant, rights, editable source, export, dependencies, status and evidence. Preserve the pack's full scene checklist as the inventory starting point.
- Separate catalog availability from residency. Keep lightweight catalog metadata available; stream detailed active models and unload unused resources through explicit ownership.
- The pack reports a 64-asset registry cap. Verify the actual current contract before implementation. Streaming alone does not bypass a registry admission limit; registry/schema changes may be necessary.
- Use shared environment modules and materials, with deliberate variation. Measure visibility, memory and draw cost rather than assuming fewer files means a faster scene.
- Non-AI audio is the carried-forward pack preference. Use licensed recordings or originally authored procedural sound, with per-file provenance. Engine selection does not settle audio rights or quality.

## Proof that Holodeck can create a game

The demonstration must produce a playable exported build from a reproducible authored world, with rules and data traceable back to this bible. An attractive imported level is only one milestone.

1. **Layout proof:** full quarry/gallery blockout; all authored booth/lane IDs import correctly; continuous walkable route and player-eye sightlines.
2. **Gameplay proof:** three contrasting entries, one booth, complete select/equip/aim/fire/feedback/results/reset/return loop. Include interrupted loading, pause and input-focus recovery.
3. **Authoring proof:** change a target/challenge in Holodeck data, re-export, and observe the correct behavior without hand-editing generated engine content.
4. **Presentation proof:** one finished booth and gallery section; hand alignment, sights, materials, lighting, audio and effects judged in motion.
5. **Scale proof:** all 60 entries reachable at all authored booths, five activities complete, compatibility enforced, repeated switching without unbounded memory growth.
6. **Delivery proof:** clean packaged launch on the selected target OS, settings/results persistence, missing-asset error handling and reproducible build instructions.

Proposed performance target: 60 fps at 1080p on a named desktop configuration, with p50/p95/p99 frame times, loading stalls, memory and switching stress recorded. This is a target, not a benchmark. Select hardware, graphics settings, acceptable stall limits and test duration before awarding a pass.

Review each asset, each assembled bank and the whole experience. Use fixed comparison cameras plus walking/gameplay footage. Preserve the pack's proposed weighting: fidelity/provenance 30%, aesthetics/readability 25%, functionality 25%, measured performance 20%; proposed pass 85/100 with no category below 3/5 and all hard gates clear. Scores remain null until reviewed.

Hard failures include inaccessible catalog entries, wrong lane ownership, invalid attachments, input stuck after UI focus, clipping at aim, duplicate score events, broken reset, blocked traversal, unclear asset rights, unbounded resource growth and unsupported claims of physical accuracy. A partial slice cannot earn a whole-game pass.

## Production evaluation and PC continuation

User can provide a Windows PC with a stronger GPU. Recommend stock Unreal plus official MCP first, Unity second, and Bevy as the modular runtime alternative. Hyperreal is an optional Windows authoring-layer evaluation. No engine is installed or selected by this document. The PC handoff describes setup, blockout, behavioral parity and packaged-build checks.

## Decisions still open

Production runtime; required delivery platforms and whether browser play is essential; target hardware; visual fidelity versus implementation time; exact scoring/difficulty and reload abstractions; save scope beyond results; multiplayer/VR; evidence threshold for per-entry fidelity.

Recommended next experiment: one common browser simulation fixture and an Unreal adapter evaluation, with Bevy retained as a comparison candidate. Evaluate official Unreal MCP separately from the Windows-only Hyperreal kit. No runtime is selected. See [ENGINE-DECISION.md](ENGINE-DECISION.md).
