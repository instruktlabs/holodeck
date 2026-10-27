# The Last Crossing: Kiln → Holodeck → Unity production plan

26 October 2026. Planning baseline, not an implementation receipt. Windows PC,
single player. The Chivalry-inspired direction and six concept sheets are approved.
Gameplay, quality targets and production choices below remain proposals. No scene
or game quality scores have been awarded.

## Outcome and boundaries

Build an original modular fortress in Kiln, assemble and inspect it in Holodeck,
then deliver the same authored place as a playable Unity siege and Explore scene.
The example must also teach a reproducible authoring/import workflow. Keep the
world editable: no monolithic castle mesh, hand-transcribed Unity layout or opaque
one-off conversion. Art direction remains grounded medieval warfare.

Kiln owns procedural geometry, materials, modular parts and saved asset revisions.
Holodeck owns composition, spatial intent, references and world revision history.
Blender is a candidate offline processing/rigging stage for Kiln derivatives.
Unity owns navigation, combat, animation, UI, audio and Windows builds. A shared
asset identity connects these products; their runtime capabilities are distinct.

The full creative scene is authored through Kiln/Holodeck. Features requiring
engine-specific implementations (water, wind, terrain, lighting, navigation and
skinned animation) get explicit adapters or documented omissions. A GLB does not
transport a game. Do not replace difficult Kiln assets with unrelated stock assets
silently; record a tooling exception and its reason if another method is needed.

Companions: [game and scene design](medieval-siege-design.md),
[bridge/tool research](unity-siege-pipeline.md),
[character comparisons](siege-character-pipeline.md),
[asset inventory](../examples/medieval-castle-unity/design/asset-inventory.json).

## Workspace and tooling qualification first

The project currently has a minimal scaffold, not a qualified development setup.
The latest local audit found Editor 6000.2.3f1, a matching ProjectVersion, only four
built-in module dependencies, no packages-lock.json, and no `unity` or `unity-cli`
command on this shell's PATH. This does not rule out a non-PATH CLI installation.
No project compile, importer, actual player frame or Windows build is evidenced.

1. Inventory Hub-managed and standalone CLI locations; record versions and binary
   paths without reading credentials. Confirm Editor license and Windows modules.
2. Qualify the official CLI/Pipeline route and plain Editor batch-mode fallback.
   The researched CLI candidate is 1.0.0-beta.14; treat beta/experimental tooling
   as a candidate, not proof of readiness. Prefer one control bridge.
3. Choose one Editor baseline deliberately. Probe the existing Editor first;
   evaluate the researched 6.3 LTS candidate before any migration. Do not upgrade
   unrelated projects or install every available integration.
4. Establish URP, one glTF importer (glTFast first), Test Framework, required input
   and navigation packages, and later Animation Rigging. Resolve compatible exact
   versions against the chosen Editor and retain manifest plus package lock.
5. Compile, run one EditMode and one PlayMode smoke check, capture an actual frame,
   build Windows x64, launch it, and confirm the correct project/build identity.
   A successful command dispatch is not completion of asynchronous import/build.
6. Save tool receipts, command help, version-specific documentation links, access
   date, package versions and supported operations. Offline docs are optional;
   indexed documentation matched to installed versions is required.

Keep the source checkout and authoring workspace separate. Current mapping:

| Area | Responsibility |
| --- | --- |
| `castle-unity` branch `example/medieval-castle-unity` | Independent example/bridge source and general documentation |
| `castle-world` | Kiln programs, saved asset integration and Holodeck world |
| `castle-design` | Approved references, design reviews, private planning and workflow journal |
| `castle-evidence` | Exact-revision observations, captures, experiments and build receipts |
| Unity `Assets/Generated` (planned) | Importer-owned content only |
| Unity `Assets/Game` (planned) | Gameplay wrappers, settings, UI and deliberate overrides |

Before production, add a workspace preflight that verifies paths, package pins,
capabilities, active world, disk space and project identity. Investigate OneDrive
sync contention before choosing Library/build/cache locations; never relocate the
project silently. Replace dependency-junction assumptions with a reproducible
locked install for release qualification. Never alter an unrelated agent's project.

## Production sequence and exit evidence

| Stage | Work | Exit gate |
| --- | --- | --- |
| 0. Baseline | Freeze approved reference IDs; reconcile bible, measured plan, inventory and toolchain receipts | Setup smoke build; every planned feature has an owner and delivery profile |
| 1. Modular blockout | Kiln dimensioned ground/bridge, wall bays, corners, towers, gates, ramp, keep mass and route markers; assemble in Holodeck | Entire main route, postern and rear evacuation road reviewed at eye level; clear widths and supported floors checked |
| 2. Bridge proof | Export small asymmetric gate/bridge section, material chart, collider and named hinge; import in Unity | Correct axes, scale, UVs, normals, materials and pivots; unchanged and changed reimports preserve IDs and game overrides |
| 3. Playable greybox | One lane, two defenses, two enemy roles, supplies, repair, breach/fallback, win/loss/restart | Packaged encounter playable from start to results; decisions change outcomes |
| 4. Art and character pilots | One polished gate/court slice; one infantry family with three loadouts; compare rigging methods before choosing | Holodeck visual review plus Unity deformation/contact review; repeatable derivative export |
| 5. Full fortress and siege | Expand kit, terrain/backdrop, service spaces, second approach, five waves, ram, three wagons, UI, sound and Explore mode | Full route/interaction matrix and complete session pass; no unimplemented rule presented as functional |
| 6. Quality and optimization | Review each dimension, playtest, profile selected crowd cap, fix largest defects | All mandatory dimensions meet gate; no unresolved blockers; measured Windows performance |
| 7. Reproduction and example | Fresh-workspace rebuild/import, provenance/license inventory, concise walkthrough and reusable commands | Another workspace can reproduce the qualified artifact; publication remains a separate decision |

Stage 2 starts after the first reusable modules, before finishing all art. Stage 3
tests the game while the environment is inexpensive to change. Polish one coherent
slice in stage 4 before multiplying detail. Do not complete a beautiful fortress
and only then discover that its lanes, camera or importer do not work.

## Modular construction contract

Start from the existing 40-family inventory; distinguish family, variant, saved
asset revision, assembly and placement counts. Plan architecture in 4 m bays with
explicit exceptions, 1 m wall thickness and measured floor datums. Dimensions in
the companion plan govern geometry; generated image labels do not.

Author in these batches:

1. Structural kit: straight wall, inner/outer corners, parapet, coping, tower base
   and upper section, gate opening/leaf/portcullis, bridge deck/arch/pier, stairs,
   ramp and landings. Test every intended join in a small kit yard.
2. Terrain and silhouette: gorge ground sections, rock families, river visual,
   approach and rear road; keep distant scenery distinct from traversable space.
3. Habitation: keep assemblies, storehouse/stable, forge shelter, well, hoardings,
   wall access, ammunition shelter. Give every building an access/usage rationale.
4. Game props: station components, barricades, repair materials, ram and wagons.
   Keep wheels, hinges and moving heads as named parts with explicit pivots.
5. Dressing: banners, crates, tools, timber, vegetation and wear concentrated where
   people work. Preserve tactical lanes and silhouette readability.
6. Characters: source body/equipment/attachments in Kiln; shared role identities
   connect Holodeck rigid previews to qualified Unity skinned derivatives.

Each family carries dimensions, units/basis, pivot, snap planes, material IDs,
bounds, collider intent, sockets/joints, LOD intent, reference IDs and provenance.
Use shared material families and controlled variation; optimize measured draw and
memory cost, not only triangles. Start below the proposed 48 unique scene assets
and 800 placements; verify current host limits, including cove/board overhead.

For each batch: read current workspace contracts → author → validate → render from
multiple sides → save immutable Kiln revision → import exact artifact → propose
placements → inspect loaded revision → sample support/clearance → actually walk
and interact → record findings. Preserve cove, board, reference decisions and
unrelated pending work. Never bypass the proposal flow by editing world.json.

## Scene transfer and repeatable Unity bridge

Implement one versioned bundle contract before a general exporter. Include exact
asset hashes/revisions, stable placement IDs and hierarchy, transforms, materials,
colliders, sockets, required capabilities and provenance. Use a separate gameplay
overlay keyed by placement IDs for station roles, health, routes and capture zones.

Implement these project-owned operations (names are proposed, not existing tools):
`ValidateBundle`, `ImportBundle`, `CompareImport`, `CaptureReview`, `BuildWindows`.
Expose the same code through CLI/Pipeline and batch mode. Validate the full bundle
before replacing last-good output; write an import receipt and readable diff.

Test asymmetric geometry, 1 m scale, parent transforms, negative/unsupported scale,
material alpha/roughness/normal maps, sockets, collider support and rotated parts.
Account for the glTF importer's own basis conversion exactly once. Reject duplicate
IDs, hash mismatches and unsupported features explicitly. Origin/cove exclusion is
an export option with an omission report, never a deletion from the source world.

Reimport tests: identical bundle; changed asset revision; moved placement; removed
placement referenced by gameplay; failed import; restored last-good bundle. Preserve
GUIDs and wrappers where intended. Deletions with gameplay references require a
resolution report. Unity art edits do not silently round-trip into Holodeck.

## Character and game work

Compare authored weights, heat and suitable geometric binders on the same skeleton.
Evaluate neural skeleton inference separately. Start with the soldier for the game;
use small creature/rigid/chain fixtures to test pipeline generality without adding
those creatures to the castle's scope. Ski Sim is one example, not the architecture.

Blender Python can automate rig setup, verification and baking. Keep source rigs,
deform bones, control rigs and baked clips distinct. Record derivative hashes and
tool versions. Validate five basic clips, two-hand grip and a real 0.18 m step
before expanding combat animations. Holodeck's current rigid preview does not
prove Unity skinning, ground IK or animation quality.

Build the game around explicit data: stations, crew assignments/travel, supplies,
range/LOS, attacks, gate states, routes, evacuation, waves and capture clocks.
Gameplay owns movement and combat; visuals follow that authority. Define pause
semantics and fixed-seed tests. An intact gate blocks navigation; breach opens it;
outer-gate loss is recoverable. The postern is connected and telegraphed. No first-
person melee, multiplayer or open-world expansion in this production slice.

Test no-input defeat, a winning loadout, alternate loadout, early outer breach,
postern response, repair timing, pause/resume, stranded-enemy handling and restart
after both win/loss. Include first-run instructions, readable objectives, selection
feedback, audio cues, volume controls, camera sensitivity and non-color team cues.

## Grading model: three independent scorecards

Use the existing scene-review pattern of named lenses, best/worst evidence,
blockers, specific fixes and repeated revision review. Do not inherit another
world's numeric scores. Holodeck coherence checks remain advisory and emit no
whole-world quality score; this rubric is a separate production assessment.

Scale: **null = unassessed**, 0 = absent/broken, 1 = rough proof, 2 = functional with
major defects, 3 = coherent and usable with bounded defects, 4 = polished and
repeatably qualified, 5 = exceptional with strong supporting review evidence.
Every score needs artifact identity, evidence, reviewer and limitation. A target
is never entered as an observed score. Mark inapplicable dimensions with rationale.

| Scorecard | Dimensions | Required evidence |
| --- | --- | --- |
| Scene | Reference/style fidelity; composition/landmarks; modular construction; habitation/material logic; traversal/collision; lighting/material quality; character scale/presence; technical performance | Matched overview and eye-level captures, join closeups, route walk, support queries, renderer observations |
| Game | Objective/control clarity; tactical readability; meaningful choices; pacing/difficulty; fairness/recovery; animation/contact; UI/audio/accessibility; reliability; Windows performance; desire to replay | Complete played sessions, decision/outcome notes, defects, captures/video, deterministic checks, packaged profiling |
| Pipeline | Reproducibility; provenance; interchange fidelity; reimport safety; automation/recovery; authoring efficiency; documentation/onboarding | Fresh setup, hashes/receipts, visual comparisons, repeat imports, failure recovery, timed tasks and another-workspace reproduction |

Stage gates: blockout requires construction/traversal at least 3; playable greybox
requires game clarity/reliability at least 3; final example requires every mandatory
dimension at least 3, and scene fidelity/construction, game readability/reliability,
pipeline fidelity/reimport/reproducibility at least 4. These thresholds are proposed.
Do not average away a low dimension. Broken routes, wrong transforms, corrupt
reimports, crashes or unwinnable states block progression regardless of scores.

Visual scoring is judgment, not automated truth. Record owner acceptance separately.
For fun/pacing, use human playtests; agent-only runs qualify mechanics, not enjoyment.
Initial small study: three fresh players where available, record comprehension,
loadouts, breach response, session duration and voluntary replay interest. Report
sample size and do not generalize a small sample into a universal fun score.

## Observation and regression protocol

Fixed capture set: bridge arrival, exterior gate oblique, gate join closeup, lower
ward at standing height, wall walk, inner ramp, keep yard/rear road, postern,
tactical overview and character/material test bay. Store camera transforms, lighting,
viewport, renderer and revision. Add failure views instead of selecting only heroes.
Use equivalent views in Unity; explain intentional renderer differences.

Route set: approach→gate→ward; ward→ramp→keep; yard→rear exit; postern approach;
wall stairs/walk; station access. Test narrow points, both directions and gate
states. Probe results, actual traversal and visual continuity are separate evidence.
Recheck affected routes after geometry/collider changes.

Target Windows 1080p/60 on declared hardware, with selected settings and crowd cap.
Measure CPU/GPU frame time p50/p95/p99, spikes, RAM/VRAM, loading, simulation backlog
and visible/active actors in a packaged build. A proposed steady-state budget is
p95 ≤16.7 ms after warmup; report loading separately and all spikes. Profile
25/50/100/200 actors to find a justified cap, not to promise 200. Compare cold/warm
runs and repeated fixed-seed scenarios. Record Holodeck WebGPU/WebGL2 independently.

## Workflow learning is a deliverable

Keep a private append-only journal outside the source checkout. Each entry records:
question/hypothesis, exact input/revision/tool versions, action, observed result,
evidence links, time/retries/manual repairs, decision, confidence, next experiment
and reusable lesson. Record failures and rejected alternatives as well as wins.

Classify issues as asset authoring, scene assembly, host capability, conversion,
Unity gameplay, tooling/setup or documentation. Give each issue an ID, severity,
reproduction, affected revisions, owner, remedy and retest evidence. A stage closeout
lists accepted changes, remaining defects, score changes and workflow lessons.

Tool experiments must answer a concrete gap using the same fixture and measurements.
Compare setup cost, quality, repair burden, headless operation, determinism,
licensing, hardware and maintainability. Pin the selected tool; keep a fallback.
Do not add MCPs, libraries or neural models merely because they are newer.

Promote recurring proven lessons into workspace preflight, reusable commands,
documentation or proposed skill improvements. Keep raw private captures/lineage
outside public source. Do not silently modify user-global skills or memory.

## First execution batch

1. Finish workspace/toolchain qualification and save a Windows smoke-build receipt.
2. Reconcile bible and plan against current accepted references and capabilities.
3. Author the structural kit yard and a single bridge-to-gate blockout in Kiln.
4. Assemble it through Holodeck proposals; record measured and walked observations.
5. Implement the smallest versioned exporter/importer and run reimport tests.
6. Review the three scorecards and journal before expanding art or game scope.

No further design answer is required to start that batch once execution begins.
The existing tactical siege/Explore scope is the planning assumption; unusual
tool purchases, external compute, publication and unrelated-project changes are
not implied by this plan. This planning pass does not install or qualify the stack.
