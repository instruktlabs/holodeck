# Range slice qualification

2026-10-26. Local prototype; no source publication or optional extension release.

## Delivered content

Three original Kiln assets use charcoal painted metal, restrained natural oak and cream/teal accents. Collection bay: 1,640 source triangles. Booth/console: 2,840. Turning target: 3,492. Total 7,972 across 23 mesh/material groups before destination render passes. Bay and console each embed three wood images; these are the existing pinned natural-wood atlas, not a new licensed download. Assets are saved in the project collection; `evidence/range-slice-assets.json` records the initial revisions and hashes. `evidence/range-console-update-proposal.json` records the console child revision.

The new `holodeck-range-slice` world preserves the scaffold's cove and mood board. The collection bay, console and target sit at X=12, 18 and 24 metres. A 20 by 12 metre floor supports the walkthrough. Scene collision is explicit and independent of decorative meshes; the rotating target face has no moving-part collision. `evidence/range-slice-contract.json` is the initial layout/adapter contract, not a replacement for the current accepted world.

Unreal map: `/Game/Qualification/RangeSliceLab`. Its 23 imported parts use separate controller/pivot components, five blocker boxes and a first-person capsule pawn. The actor stores joint transforms separately from generated static meshes. This fixture uses conventional mesh rendering; small rigid parts do not justify claiming Nanite or LOD qualification.

## Observed interaction

Holodeck WebGPU and forced WebGL2: walked from arrival to bay, selected it, walked to console, started the remote target, observed its 90-degree limit and reset it while retaining selection. WebGPU additionally stopped at X=17.82 m against the console blocker during an attempted continuous crossing. The coherence query reported the loaded revision and a clear declared spawn. These are bounded observed routes, not whole-campus traversal proof.

The in-world E action was exercised on the bay and console, in addition to the Observe panel's actions. Embedded-browser pointer lock was unavailable; existing arrow-key look controls made the real flow testable. Maker appears in overview and uses the built-in procedural gait. Unreal uses a bodyless first-person capsule in this fixture; there is no claimed skeletal character parity.

Native baseline: 14 assertions passed in a rendered game process, including selection prerequisites, out-of-reach refusal, joint limits/intermediate pose, stopping after deselection, target reset, blocker count and an actual swept pawn collision. Overview and intermediate target screenshots were inspected. `evidence/range-slice-baseline-result.json` retains the full check list.

## Revision safety

The console's child revision changes paint roughness from .62 to .68 and source-screen roughness from .30 to .50. Geometry, mesh names, placement IDs, joint definitions and texture roles stay stable.

Holodeck revision 2 applied while WebGL2 had the bay selected and target open. The observed position stayed 16.55, 1.72, 0.10; both joints retained 1.57 radians, and the console retained one activation. Target reset still worked afterward. The saved before-update AX file contains only a diff; the before values above come from the full tool observation, while `range-slice-webgl-after-update.txt` is a complete saved readback. Do not mistake the partial before file for a full snapshot.

Unreal's native screen material lives in `RangeSliceOverrides`, outside generated content. Reimport assertions confirmed unchanged actor/components, bounds, pivot frames and material bindings, with no duplicate generated assets. Native roughness stayed .19 and the override file's SHA-256 stayed `f7b6eb7f9ec56cd6e7fd8f797e069d21dace7ea5021bb2cb4cfafed44626903a`; its imported parent changed to .50. The new paint value read back as .68. The map saved successfully.

The reimport process then crashed during Python plugin shutdown with an access violation. This is a failed process even though its mutation receipt passed. We did not repeat the mutation. A separate read-only process reopened the saved map, checked all 23 components and material values/override bytes, and exited cleanly (`range-console-native-fresh-readback.json`). The workflow must preserve checkpoints, distinguish save success from process success, and independently verify after an ambiguous exit. The teardown defect is not considered fixed by that recovery.

## Obstacles and reusable improvements

- Kiln rounded-box radii must be bounded by the smallest dimension. Clamp before generating small trim parts.
- Atlas extent checks need a tiny numerical tolerance: a float32 .60 m face measured .600000023 m. The mapper now permits 1e-6 m, without relaxing atlas-region limits meaningfully.
- Review support/contact before integration. Refinement added a continuous bay backing and badge support, closed excessive counter seams, added console foot pads and lifted the target joint to 1.70 m for motor clearance.
- Interchange bakes the GLB parent pivot into static vertices. Validate imported bounds first, then compensate the attached moving mesh by the negative pivot. Do not infer the frame from its label.
- The editor's 2.49 GB shared PCH stalled this small module under workstation memory pressure. Local no-PCH compilation with one action completed successfully. This is a measured workstation workaround, not a universal Unreal performance recommendation. No unrelated job was stopped.
- The actual Holodeck forced backend query is `backend=webgl`. `backend=webgl2` silently preferred WebGPU; backend readback caught the mistake before it was counted as WebGL2 evidence.
- A material-only asset revision appeared as 'no differences' in the proposal dock, although full Review correctly showed the changed asset. The dock now includes changed/removed asset counts.
- Added generic opt-in `interaction.relay@1` with explicit target IDs and optional selection prerequisite, plus `remoteOnly` joints. No arbitrary callbacks or recursive relay graph. State survives appearance updates. Four relay tests plus existing joint/runtime tests pass (22 combined).
- Relay activity displays activation count and last action, rather than an invented zero rotation. Keep observation types faithful to actual state.

## Visual and product limits

These are usable first prototypes, not AAA-approved hero assets. Walking-height browser review shows the wood grain/knots and supported construction. Paint reads very dark; labels/screens remain blank content surfaces. Unreal's neutral backdrop/floor and softer shadows differ from Holodeck's sky, procedural floor and sharper shadows. Match material intent and interaction first, then refine lighting using common fixtures. Full texture residency was forced for native visual qualification; normal streaming behavior is not thereby qualified.

Next art passes: richer material breakup, readable runtime console content, labels, scene enclosure/lighting and hero detail/bakes. Next game slice: one researched firearm with rigged hands, configuration/attachment contracts and the equip/inspect/aim/fire/reload/target loop. No firearm, ammunition simulation, scoring, full character rig, multiplayer or final performance budget is implemented here.

Reusable candidates: pinned asset delivery, atlas tolerances, semantic material roles, validated joint-frame compensation, destination-owned overlays, relay capability checks, process checkpoint/readback and rendered assertion captures. Keep generic recipes and contracts common; keep Unreal code and game-specific behavior in their adapters/projects. The optional Kiln extension is still a local prototype, not a published plugin.

Final package: built and archived to D:, then the actual packaged game executable
passed all 14 assertions with no reported material fallback. Overview, motion and
reset images were inspected. The immediate reset capture contains temporal-AA
history on the target; it is not a settled still. The five cooked content files
and actual game executable are hashed in `evidence/range-slice-summary.json`.

Holodeck's full runtime suite passed 347 tests, the world-tools suite passed nine,
proposal-diff tests passed six, and the production bundle built successfully.
These checks complement the observed browser flows; they do not certify visual
quality or performance. The temporary UBA memory-wait override used during
diagnosis was removed from the build helper; single-action/no-PCH compilation
remains scoped to this small native fixture.
