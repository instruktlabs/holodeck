# Range targets, lanes and shot review

Audit: 26 October 2026. The read-only audit below captured revision 5. Parent subsequently merged the proposed intent/rules through the supported API at revision 6, preserving scene/references/assets/origin; see [Bible update proof](../evidence/range-bible-v5-preserved.json). No target-ledger, retrieval or scoring gameplay was implemented by this documentation pass. Existing design proposals remain proposals, and no performance qualification is asserted.

## What the plans already contain

Yes, the intended campus has many lanes and target types. [DESIGN-BIBLE.md](../handoff/design/firearms-through-time/DESIGN-BIBLE.md) draft 0.3 carries five activity families: paper, reactive plates, long field, moving gallery and arcade. GAME-07 already calls for accepted impacts, a grouping view and authored scoring zones; GAME-12 calls for results; GAME-17 calls for configurable station presets. The one-booth slice was explicitly a milestone, not reduced final scope.

[The layout](../handoff/design/firearms-through-time/blueprints/layout.json) proposes six banks: paper, reactive, moving, timed sequences, long field and custom practice. Six banks × eight stations = 48 is an exploratory option, not an approved count. [Activity research](../handoff/design/firearms-through-time/RANGE-ACTIVITY-RESEARCH.md) lists fourteen ideas, including Paper Gallery, Plate Chorus, Color Circuit, Pop-Up Garden, Rail Parade and Clay Constellation; playlists/era tours reuse those primitives. Cooperative, puzzle/rhythm and daily-remix modes remain later proposals. A target type, lane profile and activity preset are separate dimensions; one suitable lane can host several presets.

Concept prompts mention paper carriers and moving tracks, but neither the source Bible nor research specifies a working return-to-booth state machine. Physical retrieval after a string is a new explicit requirement to design, not an already delivered feature. Existing references establish visual/category context only; no new external factual claim is needed for this plan.

## Current implementation and gaps

The read-only live session on port 4202 is world `fd10d5d1-cb96-42e6-bd1b-36485ffe9019`, revision **5**. Its built-in capabilities are box collision, walk/orbit camera, Maker inhabitant, joint interaction and relay interaction. The bay selects; the console toggles a single target through 90 degrees; reset restores its pose. It has no carrier translation, lane-session ownership or results capability.

The Bible still says “No gunfire, scoring or skeletal weapon animation in this slice.” That sentence is stale relative to the separately loaded game extension and native WeaponLab. Replace it with an accurate boundary: prototype firing/hit counters and animated hands exist in game code; full scoring, shot review, lane activities and retrieval do not.

| Area | Confirmed code today | Missing contract |
|---|---|---|
| Shot acceptance | `game/weapon.mjs` and native `WeaponLoop` reject busy/cooldown/empty commands, consume an abstract round and increment shots/hits. | Session/string/shot IDs, immutable accepted/resolved events and persistent history. |
| Target hit | Browser `targetHit` computes a boolean against one rotated rectangle; native `HitTarget` uses a hard-coded centre and target-pivot normal. Native draws a short-lived green debug point. | Nearest-blocker query, stable target/surface identity, point/normal/UV, zones, target-transform snapshot and distinction between scoring/non-scoring hits. |
| Target geometry | Saved v5 target has a replaceable face, printed rings, clips and `Joint_Target`. | Explicit scoring surface frame; decorative rings are not score definitions. The current proxy plane passes through the pivot, while the rendered paper face is offset from it. |
| Presentation | Browser overlay/native HUD show ammo, shots, hits and action state. | Console review, marked world target, per-string/session scoreboard, target replacement/archive. |
| Reset | `RangeSliceActor::ResetTarget/ResetSlice` restores joint/selection state. | It does not clear `WeaponLoop` counters, archive a string or retrieve a target; a shared session owner is required. |

The analytic tests do not inspect intervening world blockers or enforce active-lane scoring ownership. These are current prototype limitations, not claims about a general collision system. Code was inspected read-only; this audit did not rerun gameplay fixtures.

## Proposed lane and target catalogue

| Lane profile | Compatible target forms | Activity/results | Retrieval/review |
|---|---|---|---|
| Paper / precision | Replaceable paper or digital ring/grid card | Numbered impacts, authored zones, grouping and string comparison | Return carrier to booth; remote screen review also available. |
| Reactive plates | Abstract plate/disc bank; flash/fall response | One award per target activation; clear-set completion | Reset mechanism and digital hit map; no paper-return fiction. |
| Moving | Rail discs or turning geometric cards | Versioned paths, sequence and exposure windows | Stop and dock compatible carrier; otherwise screen replay. |
| Timed sequences / arcade | Lit shapes and pop-up arrays | Ordered/wave events, points, completion; untimed alternative | End round, park array, review sequence/timeline. |
| Long field | Authored near/middle/far target anchors | Selected sequence, hits/misses and game elapsed time | Magnified electronic review; retrieval only for compatible carrier. |
| Custom practice | Supported combinations above | Previewed target skin, size, placement, motion, sequence and scoring preset | Capability-driven controls; reject unsupported combinations. |

Flying disc arcs are a researched activity proposal that needs an authored compatible field/profile; do not silently add a seventh approved bank. No exact lane count, distance, point table or speed is locked by this note. Start with a paper/string/retrieval loop, then reuse the event contract for plates and motion before campus replication.

## Proposed impact and event contract

One engine-neutral session authority owns command acceptance, target state and score. Renderer objects, decals, particles, sounds and HUD counters consume its events. Native and browser adapters must implement the same versioned rules; matching names alone do not establish parity.

1. `ShotAccepted`: `eventId`, `commandId`, `sessionId`, `stringId`, monotonic `shotId/sequenceNo`, `simulationTick/time`, player/booth/lane IDs, weapon/configuration/rules revision, deterministic seed, aim-ray policy, resolved ray and pre-kick muzzle transform, effect profile/revision. Rejected commands have reasons and do not increment shots or consume ammunition.
2. `ShotResolved`: accepted shot ID plus resolution tick, outcome (`scoring-hit`, `non-scoring-hit`, `miss`), first-blocker ID, target instance/activation ID, target-definition and scoring-schema revisions, surface ID/material category, attachment-frame ID, world point/normal and surface-local point/normal, normalized surface UV, target/surface transform snapshot at the query tick, zone ID and score delta. A miss has explicit null impact fields. A physical hit can award zero points without becoming a miss. Current instant-ray mode resolves at the acceptance tick; any later delayed resolver must record both ticks and the target transform at resolution.
3. `StringEnded`, `TargetReturnRequested`, `TargetDocked`, `ResultsCommitted`, `TargetReplaced` and session/reset events carry the same session/lane and ordering envelope. Retain existing planned session/round/presentation/resolution events, with a documented mapping rather than two competing score paths.

Use a target-authored scoring frame, not incidental render-mesh UVs. For a surface with origin `C`, right/up/normal basis `R,U,N`, width `W` and height `H`, transform world hit `P` with the **captured** inverse surface transform. Record local `(x,y,z)` and `u=x/W+0.5`, `v=y/H+0.5`. Reject outside/masked surface regions before scoring; do not clamp an outside hit into a valid zone. Author corner orientation and front/back acceptance explicitly. The existing target can use local right along source +Z, up +Y and front normal −X, but its exact face plane/visible inset must be authored and checked against the saved child revision. Do not infer the scoring plane from the joint centre or batch mesh origin.

Zone definitions are revisioned circles/polygons/masks in that scoring space. Show values before starting. Specify boundary tolerance and tie rule once; do not let texture filtering determine score. Store both immutable shot-time world data and local coordinates: marks attached to the live target follow its current transform during turning/retrieval, while history/replay uses the shot-time snapshot. A new paper sheet receives a new surface-instance ID; pooled targets increment activation ID so old hits cannot score again.

Determinism means fixed simulation ticks, seeded motion and effect substreams keyed by shot ID/channel, stable command ordering and defined numeric tolerances. Query the nearest valid blocker before scoring; deterministic tie-breaking handles equal distances. Deduplicate accepted commands and resolved event IDs. One instant shot resolves once; no penetration chain is implied. Presentation kick cannot alter an already captured ray. Persist the immutable accepted/resolved ledger and derive counters/results from it. Cross-engine replay needs golden fixtures and tolerance checks; fixed ticks alone do not prove bitwise floating-point parity. Coordinate feedback details with [shot-feedback-fidelity.md](shot-feedback-fidelity.md).

## Proposed return-to-booth loop and UX

State flow: `idle → preview → deploying → ready → active string → ending → returning → docked review → redeploy/retry or complete`. Paused is an explicit orthogonal flag. A string ends at its authored event budget or through **End string**; ending freezes its result ledger before target movement. This is virtual gameplay state, not a model of a real facility's procedures.

The gameplay interlock disables accepted fire outside active state, during target travel/docked review, pause, UI focus, loss of booth ownership or configuration change. End/return processes before fire on the same tick, clears held input and rejects later queued commands for that string. Returning freezes activity motion, resolves the string's already accepted instant shots, then moves only the carrier along its authored path. Reset cannot resume firing or erase committed results; replacing a sheet archives it first. Duplicate return commands are harmless. A blocked/failed carrier stops with a clear status and retry/cancel action; it never teleports or silently starts another string. Leaving the booth aborts the active attempt with a reason. These guards need one shared authority across target and weapon code.

At the booth, show selected lane/profile, target preview, game-space position preset, scoring rules and string budget before **Deploy / Start string**. During play, keep a compact shots/valid hits/score/string-progress display with redundant icon/text feedback. **End string & return** brings compatible paper to a review position; **Review remotely** opens the same ledger without requiring travel. During travel, show **Returning — firing unavailable**, with visible carrier motion. At dock, show numbered marks on the actual sheet and a zoomable console diagram. Selecting a mark highlights its sequence number and zone result; misses and non-scoring surface hits remain in the shot list.

The session scoreboard reports accepted shots, scoring hits, non-scoring hits, misses, zone totals, score and elapsed game time; grouping uses target-local coordinates with clearly defined game units and returns “not enough hits” when appropriate. Separate per-string, per-target sheet and session totals. Compare only matching preset/rules/configuration/assist profiles. Offer **Next string**, **Replace target**, **Retry as new attempt**, **Save result** and **Return to collection**; no real-world proficiency rating. New/moving/returned sheets must not lose their historical marks. Color, sound and flashes are supplementary; provide readable labels, reduced effects, untimed variants and keyboard panel controls.

## Implementation and acceptance boundaries

Proposed first increment: data contract + one paper target + persistent local marks + string review + return/deploy interlock, with identical browser/native fixtures. Follow with plates, moving/turning targets and lane presets; build the campus from qualified modules afterward. The carrier requires new authored travel/dock anchors and a compatible saved asset, not merely moving the present floor-mounted turning stand.

Required checks: translated/rotated/scaled surface round-trip; UV corners and mirrored-axis rejection; exact zone boundaries; occluded/wrong-lane/back-face policy; moving target at query tick; marks stay attached after return; historical snapshots remain unchanged; duplicate command/event and target reuse; reset/retry archives and clears the right scope; end/fire same-tick ordering; pause/UI focus/leave-booth gates; failure during return; browser/native ledger parity; accessible review and complete start/end/return/redeploy loop. No visual, performance or whole-game pass follows from this document.

The parent may merge [the minimal Bible fragment](../evidence/range-target-bible-fragment.json) after a fresh read/preserve check through the supported proposal API. It corrects stale prose and records planned scope without adding unsupported runtime fields or changing references, placements or current asset pins.
