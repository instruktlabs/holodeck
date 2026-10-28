# Shot feedback fidelity and reusable adapter contract

Research snapshot: 2026-10-26 local. This document records a read-only code/reference audit and a proposed implementation contract for entertainment simulation. It does not qualify historical recoil or implement VFX. Parent subsequently recorded these requirements in live Bible revision 6 and completed the separate [v5 hand/trigger-well pass](weapon-contact-twist-v5.md). Exact audited file hashes and source status are in [shot-feedback-reference-audit.json](../evidence/shot-feedback-reference-audit.json); their code snapshots are historical where later edits differ.

Every selectable gun must have its own resolved weapon/configuration/ammunition behavior profile. Model identity, action presentation, accuracy, recoil response, trajectory behavior, cadence and feedback must not silently inherit one generic pistol preset. Shared values are legitimate when justified; uniqueness does not require inventing differences. Era organizes the exhibition and never determines attachment compatibility or behavior.

## What exists now

| Inspected implementation | Confirmed behavior | Missing qualification |
|---|---|---|
| `game/weapon.mjs:3-16` | One `collection-pistol-01` spec. Accepted fire consumes once, updates counters, starts a prototype cooldown and a 90 ms `flash` scalar. `targetHit` intersects one rotating rectangular plane and returns only a boolean. | No immutable accepted/resolved event, shot seed/timestamp, general occlusion, impact point/normal/material output, per-weapon profile registry or projectile flight. Numeric timing is explicitly prototype tuning. |
| `game/presentation.mjs:5-9`, `weapon-extension.jsx:34-54` | The browser checks the target from camera origin/direction. A decaying scalar moves/rotates the weapon root, shifts the slide and changes the UI border. Hand animation samples the Fire clip. | `flash` is not a muzzle particle, light or smoke effect. No impact decal/audio or independent camera kick appears in this inspected path. `Joint_MuzzleFX` exists in the asset source but is not consumed here. |
| `WeaponLoop.cpp:35-49` | Native code performs an analytic camera-ray/target-plane test, increments counters, briefly draws a green debug point, and applies equivalent gun-root/slide motion. | Target center is hardcoded while only its normal is read from the target pivot. The returned boolean discards hit data. No scene trace, material lookup, Niagara, persistent impact mark or shot audio appears here. Camera attachment is not camera recoil. |
| `animation-v3.json`, `weapon.test.mjs:3-7` | Fire timeline includes an authored finger channel. Tests cover rejection/consumption and simple target-plane hit/miss cases. | They do not prove event timing, actual finger/trigger contact, muzzle attachment, target-surface hit placement, occlusion, recoil fidelity or effect synchronization. No new runtime tests were run for this document-only audit. |

The current gun is labeled **1911-style**, not a certified replica of a precisely identified historical configuration. A previously cited Navy M1911A1 museum page timed out in this audit, so it remains an unresolved reference here. The next Model 1866 asset is a plain sporting-form interpretation with qualified exterior references; it has no authored shooting behavior. The parent also reported a possible frame/trigger-well contact obstruction in the pistol. That is a pending geometry/contact check, not a measured finding of this audit.

## Evidence and historical fidelity

Maintain a reference dossier per exact configuration. Record institution/manufacturer, direct URL, object/model and variant, specimen or production period, ammunition identity when known, reference date, image/video rights and whether the example is original, restored or a modern reproduction. Dynamic references additionally need capture frame rate, shutter/exposure, camera/view angle, lighting, edited/slow-motion status and timecodes. Still photographs cannot qualify recoil trajectories, flash duration or audio timing. Unknown capture conditions limit conclusions about apparent brightness, smoke and motion.

The [Met's Model 1866 object](https://www.metmuseum.org/art/collection/search/904559) supports identity and its 1870 presentation-specimen context. The [Winchester Model 1866 page](https://www.winchesterguns.com/support/owners-manuals/model-1866.html) explicitly describes a modern version. Those sources must not be combined into an apparently measured historical shot profile. Neither supplies a calibrated firing/impact dataset for this project's authored sporting configuration. Keep all numerical recoil, flash, accuracy and trajectory values **unqualified** until an appropriate source or clearly labeled game-tuning decision is attached.

Each profile field stores `{value, units, provenanceClass, referenceIds, configurationScope, uncertainty, tuningReason, approvedBy, revision}`. Classes are `reference-backed`, `estimated`, `gameplay-tuned` and `unknown`. Source-backed exterior identity does not upgrade unrelated behavior fields. No universal fixed spray sequence is presented as historically accurate. Recoil *tendency*, shot-to-shot variation, recovery and player input can coexist in a reproducible seeded game model; a fixed repeating pattern is an explicit gameplay choice if adopted.

## Per-weapon behavior profile

Resolve a pinned tuple of `weaponId + configurationId + ammunitionProfileId + behaviorRevision`. Separate the cosmetic ID and asset revision. Ammunition IDs here describe virtual profiles, not recommendations for real use. The content validator rejects missing required fields and incompatible combinations rather than silently borrowing another weapon's data.

| Domain | Versioned fields and ownership |
|---|---|
| Identity/compatibility | Exact platform and configuration, references, allowed virtual ammunition/attachments, visual action family, required anchor/rig contract. Explicit allowlists, not era rules. |
| Accuracy/aim | Intrinsic dispersion distribution, authored bias, stance/aim-state modifiers, stability/recovery, optional gameplay aim displacement and random substream. Distinguish precision/group spread from accuracy/bias and from camera motion. |
| Recoil | Weapon transform response, return curve, shot-to-shot tendency/variation, accumulation policy, animation/contact response; separate optional authoritative aim-state change and accessibility-scaled camera response. |
| Trajectory | Explicit `hitscan` or simulated-flight mode, virtual launch/flight parameters, integration revision, collision/sweep policy, range and termination rules. Wind/drop/penetration/ricochet are absent unless separately specified and tested. Never call a hitscan approximation calibrated ballistics. |
| Timing/state | Acceptance cadence, action/cycle/reload state machine and event offsets, adapter presentation channels. Animation observes authority; a frame callback cannot spend ammunition or award score. |
| Shot appearance/audio | Muzzle emitter profile, smoke profile, optional light, sound asset/revision, action/casing presentation where supported, effect seed policy and visibility/scalability bounds. No automatic casing or slide effect on every gun. |
| Impact response | Versioned surface taxonomy and per-profile effects, decals/marks, sound and permitted target reaction. Feedback is tied to resolved collision data; scoring is a separate consumer. |

A pistol slide response and a Model 1866 lever presentation must not share identical automatic animation merely because both accept a fire command. The new 1866 exterior has no operating animation to enable yet. Cosmetics may share behavior when they change only appearance; an attachment that changes a virtual gameplay property selects a new qualified configuration. Unknown combinations fail validation.

## One shot, immutable events, separate consumers

Proposed common sequence:

1. Normalize an input `commandId` at a simulation tick. Check session/activity, weapon state, compatibility and cadence. Rejection produces no shot, muzzle effect or recoil impulse; an intentional dry-response cue is its own event.
2. Freeze the pre-response authoritative aim state, camera aim sample and world muzzle transform. Accept once, assign `shotId`, sequence number, profile hash and seed. Emit `ShotAccepted` with `sessionId`, activity/string ID, `commandId`, `tick`, `simulationTime`, `weaponId`, configuration/ammunition/profile revisions, aim policy/ray, world muzzle basis and effect-profile revision.
3. Resolve the shot through the declared query/flight policy. Emit one terminal `ShotResolved` for the fixture's one-contact mode: outcome (`scoring-hit`, `non-scoring-hit`, `miss`), shot/event IDs, resolution tick/time, first blocker/object ID, target instance and activation IDs, target-definition revision, surface/material IDs, travel fraction/distance, impact world point/normal, surface-local point/normal, UV if valid, and target transform at impact. Unsupported data is explicitly absent, not fabricated as zero. Canceled or failed queries use a separate lifecycle/error record and do not masquerade as a resolved miss. This outcome vocabulary matches the target/review contract.
4. Muzzle flash/smoke, weapon/slide animation, camera response and shot audio consume `ShotAccepted`. Surface effects/mark/audio consume `ShotResolved`. Scoring independently consumes the same resolved record and target activation. Each consumer deduplicates by event/shot ID and channel; particles never raycast again to decide a hit or change score.

For simulated flight, `ShotAccepted` and `ShotResolved` occur at different ticks. Sample the target transform at impact, while retaining the shot-time snapshot separately. Store immutable historical world-space results plus local attachment coordinates: a live mark follows a moved target, while a saved result/replay still explains where the original impact occurred. Non-scoring surface impacts still need feedback. A miss needs no fabricated target decal.

Use deterministic substream seeds derived from session seed, shot ID, profile revision and channel (`dispersion`, `weapon-response`, `camera-response`, `muzzle`, `smoke`, `impact`, `audio`). Dropping decorative particles under load must not consume the gameplay random stream or change later shots. Replay equal inputs/profile/query records exactly at the event level. Live cross-engine collision is a separate equivalence test, and GPU particle pixels need not be bitwise identical.

## Aim, bore and camera agreement

Do not use the screen center as an impact point or project a mark onto the target after a boolean hit. The camera, world muzzle and animated first-person mesh are distinct coordinate owners. Purely cosmetic camera shake is added after sampling authoritative aim and cannot redirect an already accepted shot. If recoil intentionally changes future aim, the rules advance that explicit aim state; do not count the same camera offset a second time.

Proposed first-slice policy: a camera aim query chooses an intended scene point, then a world-muzzle query toward that point selects the actual first blocking contact. The muzzle cannot shoot through nearby cover just because the camera sees over it. Record this as `camera-converged-muzzle-query`, an explicit game aiming approximation. Keep a separately selectable `strict-world-bore` policy for future work that derives the shot directly from the authoritative weapon basis. Do not switch policies implicitly with aim mode. Near obstacles, camera/muzzle separation, reticle position and sight presentation require dedicated review.

Record the world muzzle transform used by the query and the viewmodel muzzle transform used to draw the flash. Both derive from declared anchors plus tested axis/unit conversion; first-person FOV/scale transforms must never leak into world collision. Unreal's [first-person rendering documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/first-person-rendering) describes projection/scale changes and a distinct world representation. The adapter must validate their alignment and each component's rendering classification rather than assume the displayed muzzle is the physical query origin.

## Visual and audio response rules

Muzzle effects use the named muzzle frame at the accepted event. A brief attached flash and a released smoke plume have different attachment policies; smoke must not remain rigidly glued to a moving muzzle. Shape, brightness, lifetime and bloom/exposure response are per-profile artistic choices until supported by dynamic evidence. Do not substitute a large permanent orange light for a reference-qualified flash. Short events need event-time sampling so a long render frame does not silently erase the cue or extend its simulation duration.

Weapon/root motion, moving-part motion, hands/contact and camera kick use separate tracks. Their peaks, phase offsets and recovery are reviewed together but are not tied to one shared `flash` countdown. Camera scaling, reduction/off controls and FOV changes must not alter authoritative accuracy or results. Check finger pose against actual visible trigger contact and trigger-well clearance before claiming tactile fidelity; preserving a named joint alone is insufficient.

Impact effects orient to the actual normal, with a small declared rendering-only offset to avoid depth fighting. Keep the mathematical impact unchanged. Choose response by stable surface ID: proposed paper fibers/mark, wood flecks, stone dust and metal response are separate authored profiles, not an assertion that every material always produces the same visible event. Avoid universal sparks or universal black craters. Map unknown materials to a restrained declared fallback and log it. Marks have bounded size, lifetime/count and reset ownership; on thin or moving targets they must not project onto neighboring geometry or detach during movement.

Shot and impact audio are separate events and spatial origins. Sound variation comes from the shot's audio seed; record asset and mix revisions. Define any propagation delay explicitly, and test its synchronization with flight/impact time. No recorded sound or flash intensity is claimed authentic without matched provenance and capture conditions.

## Optional extension split

| Layer | Reusable proposal | Remains outside the layer |
|---|---|---|
| Kiln/common asset tooling | Validate exact asset/material pins, named muzzle/sight/hand anchors, units/bases, moving groups, effect-asset provenance; export inspection captures and machine-readable contracts. | Gun balance, ammunition rules, collision authority, scoring and recoil policy do not enter Kiln core. |
| Optional engine-neutral feedback package | Versioned accepted/resolved event schema, per-field provenance, profile resolver, deterministic seed derivation, deduplication, replay/fixture format, effect lifecycle and capability report. | No implicit firearm simulator or automatic world mutation. |
| Holodeck project adapter | Bridge host collision/query results to the common schema; render supported effects/marks/audio, keep viewmodel and world frames distinct, provide capture/replay controls and resource disposal. | Do not assume a future field is already supported by world schema. The current local extension must opt in; unsupported required channels fail visibly. |
| Unreal adapter | Map validated world hits and Physical Materials to common IDs; bind Niagara/effect parameters, sockets, camera patterns, decals, audio and lifecycle; retain native overrides outside generated assets. | No duplicate scoring rules; no silent engine-specific profile substitution. |

Official implementation references: [Unreal traces](https://dev.epicgames.com/documentation/unreal-engine/traces-in-unreal-engine---overview) expose impact location/normal and hit metadata; [Physical Materials](https://dev.epicgames.com/documentation/en-us/unreal-engine/physical-materials-user-guide-for-unreal-engine) require explicit simple/complex collision mapping. [Niagara attached spawning](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/Niagara/UNiagaraFunctionLibrary/SpawnSystemAttached) supports component attachment and lifecycle/pooling options; [Niagara determinism](https://dev.epicgames.com/documentation/en-us/unreal-engine/caching-and-reusing-your-system) supports repeatable emitter resets with unchanged inputs. [Camera Shake](https://dev.epicgames.com/documentation/en-us/unreal-engine/camera-shakes-in-unreal-engine) offers separately configurable patterns and instance behavior. [Decal materials](https://dev.epicgames.com/documentation/en-us/unreal-engine/decal-materials-in-unreal-engine) project surface properties with rendering-path constraints. The project's `EngineAssociation` is 5.8; opened official pages also identify 5.8. These capabilities are not proof of local implementation.

The [Three.js Raycaster contract](https://threejs.org/docs/pages/Raycaster.html) provides nearest-first intersections, world points and object/face/UV information. Its sidedness and duplicate edge hits need explicit handling. A browser adapter must transform normals to the declared frame and map material identity itself; the library API does not supply this game's surface taxonomy or authoritative shot semantics.

## Proposed cross-engine fidelity gates

All gates below are **pending**, not passes from this audit. Freeze profile/asset revisions, event log, query policy and camera/exposure/backend settings in each receipt. Validate WebGPU and WebGL2 separately, plus Unreal editor and packaged output.

| Gate | Required evidence |
|---|---|
| Identity and provenance | Every gun/configuration/ammunition tuple resolves its own explicit profile; no generic fallback. Required fields carry a source, estimate or tuning decision. Historical vs reproduction scopes remain separate. |
| Exactly-once feedback | Accepted command creates one shot/muzzle/audio/recoil event. Cooldown, empty, inspect, reload, paused, duplicate and stale-session commands create none. Replaying a resolution cannot duplicate a mark, score or sound. |
| Hit placement and obstruction | Center/edge/corner, rotated/scaled/moving targets, oblique faces, nearer blocker, camera-visible but muzzle-blocked, backface, miss and missing-material fixtures. Compare first blocker, world/local point, normal, target activation and material. Initial proposed simple-fixture tolerance: 1 mm point and 0.5 degrees normal after unit conversion; revise openly before testing harder geometry. |
| Aim consistency | Overlay camera ray, world muzzle ray, sight line and actual impact. Test hip/aim, near/far, FOV/aspect changes and obstacles. Cosmetic camera kick off/on produces the same accepted shot results. |
| Event-time phase | Capture just before/at/after emission, peak movement and recovery using simulation timestamps, including synthetic skipped render frames. One accepted shot drives the correct channels without extending gameplay time or duplicating transients. |
| Hand and moving-part contact | Multi-view near shots across the fire/cycle/recovery sequence, actual trigger contact and open-well clearance, no finger/slide clipping. Match each gun's visual action; do not reuse pistol slide motion on the 1866. |
| Surface appearance | Controlled lighting/exposure fixtures for paper, wood, metal and stone; normal-aligned marks, no projection bleed, moving-target attachment, correct audio origin and lifetime/reset cleanup. Realism approval is separate from numeric alignment. |
| Seed/replay and variation | Same seed/profile/input gives equal event records and channel selections; different seeds show bounded declared variation. Disabled visual channels cannot alter later shots. Check per-gun tendency/distribution and recovery, not only one attractive take. |
| Lifecycle and export | Reset, weapon/config switch, scene unload, stale async completion, pooled effect reuse and reimport preserve pins, native overrides and stable IDs; bounded resource counts without orphaned effects/decals/audio. |
| Delivery | Editor and packaged native captures plus explicit browser backend receipts. Conformance traces, limitations and owner visual review remain distinct. |

Both PC and hub are under load. Performance status is **DIRTY**. No FPS, GPU timing, scalability tier or production effect budget is qualified here. Structural counts and correctness fixtures can be developed now; clean performance measurements require a separately recorded stable workload.

