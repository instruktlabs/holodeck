# 1866 rifle delivery into Unreal and Holodeck

The next integrated candidate is the authored 1866 sporting rifle. It has a saved satin-brass/walnut revision, a recessed muzzle, separate lever and hammer pivots, a dedicated 41-bone hand delivery and a separate visual loading cue. This is a playable art prototype. It does not qualify historical capacity, calibrated recoil/ballistics, production anatomy or AAA finish.

## Ownership and extension boundary

Kiln owns the original geometry, materials, named anchors and saved immutable hand clips. The game owns profile selection, ammunition, action gates, target sessions, scoring and persistence. Holodeck loads the skinned hands in this project's first-person extension; its static world-placement admission remains unchanged. Unreal imports into `/Game/Qualification/RifleV10` and binds those derivatives through `UWeaponProfileData`. Both destinations use the shared motion, rig, view and game contracts. None of this installs a global skill or changes Kiln core.

`game/rifle-asset-pins-v1.json` records the exact delivered revision for each component. `pipeline/pin-rifle-browser.mjs` verifies all saved sources before promoting browser aliases. The canonical pistol and hand aliases remain pinned to their prior revisions. Native overrides and existing saved maps are preserved rather than replaced by the rifle delivery.

## Use

Open [the rifle prototype](http://127.0.0.1:4202/prototype.html?backend=webgpu&weapon=rifle1866&weaponReview=1), enter the world in first person, choose a lane and start a string. I inspects, Q aims, F fires, R reloads. The weapon selector switches profiles through a fresh launch when actions and range travel are idle; it is not a live inventory/equip animation. The pistol retains its original local history key; rifle sessions use a separate key and record the weapon identity.

For native play use `pipeline/play-weapon-lab.ps1 -Profile rifle1866`. The existing pistol remains the default. Native range controls are 1/2/3 for lanes, Enter to start, Backspace to end, T to return/resume paper, Y to replace/reset and PageUp/PageDown for review.

The six-round load and 24-round reserve are explicit prototype tuning. Each 2.4-second reload cycle transfers one round at 65% and repeats until full or the reserve is empty. A per-cycle latch prevents duplicate transfer. Inspect, aim and fire are gated during reload; the 0.95-second visual lever cycle also gates competing actions. The seven-shot range string is independent of magazine capacity, so it requires a reload. Loading-cue visibility has no ammunition authority.

## Reusable decisions

- Use a delivery profile for mesh/clip/rig/view bindings. Share the state machine and target system while retaining per-model action policies and attachment allowlists.
- Preserve semantic bone identities across fitted hand revisions. Pose both wrists, solve fixed-length arms, then distribute axial forearm twist. Verify the delivered GLB and live consumer adapter separately.
- Put moving parts under authored pivots with compensating child placement. Preserve the rest transform when applying runtime angles; do not infer pivot location from imported mesh bounds.
- Make contact time an explicit game event and evaluate it independently from a visible animation token. Test early, exact, repeated and insufficient-reserve cases.
- Give imported rigid weapon materials explicit Nanite usage before cooking. The editor compiles missing usages on demand, so only a packaged run shows the default-material fallback.
- Separate camera placement from hand geometry. The source sight anchors align at Y=0.200m, so the current aim view uses a -0.200m camera-local offset.
- Preserve imported source materials and native overrides as separate ownership layers. Verify exact source identities, saved references and destination captures before promoting a delivery.

## Qualification record

Completed 27 October 2026 by Claude Code, taking over after the Codex session ran out of usage at 07:34. Performance remains unqualified because the PC and hub are under other development load. Maker's full-body arm/equipment binding is a separate future task; these are first-person view arms.

### Delivered revisions

| Component | Collection / asset / revision | GLB SHA-256 |
|---|---|---|
| Rifle | next-firearm-v1 `a_a8c8a92ae979442dbcf5836c8e72ee2e` / `r_d1fa6f16dd67465ba6f41a66a1b9d6f8` | `7496ea5e…6efe` |
| Hands | next-firearm-v1 `a_e22b20538f204e1ca7a86886cf630a89` / `r_3fcbc30917df47179ebe0efa04281019` (program `p_9a97eea44a1f`) | `4d6346ca…412a` |
| Loading cue | next-firearm-v1 `a_98ff5290ff394615bd25913a3a60f3d4` / `r_3ff9c7f1eb254f14a4efbb7ec4e58265` | `a6c1ab59…26f5` |

The hands are the `final2` thumb refinement. Codex verified that build (`authoring/rifle-hands-v1-verification.json`) but never saved it. It was saved after an assembly review from the side, close and first-person views, plus the 53% reload frame; the rebuild was byte-identical to the verified GLB. Rebuilding the hands needs `KILN_GLTF_EXPORTER=three` and `--materials materials/gloves-v5/pins.json`. Without the pins the build fails with Kiln's opaque sandbox rejection.

### Corrections made during closeout

- **Loading-cue offset.** `cartridge.rightWristRelativeCenter` changed from [0.104, 0.043, -0.006] to [0.122, 0.031, -0.017] m (wrist-local). At the 65% commit, the cue centre had been 28.8 mm from `anchor_interaction_loading_gate`, failing the delivery test's 25 mm limit. It is now 8 mm from the gate and 12 mm from the right index tip throughout the reload. The hand clips were not changed. The hands source still embeds the old value as unused metadata.
- **Native review clip.** The saved rifle GLB contains a Kiln review clip, `PresentationLeverReview`, which rotates only `Joint_Lever` and `Joint_Hammer`. `pipeline/rigid-native-delivery.mjs` now drops explicitly allowlisted review clips from the rigid native derivative, because the destination drives those pivots from shared motion data. Any other animation still fails staging.

### Results

- Node: 41/41 `game/*.test.mjs` tests; browser IK probe of 244 poses (`evidence/rifle-v10-browser-ik-test.json`).
- Holodeck, port 4202, in WebGPU and forced WebGL2 (`evidence/rifle-v10-browser-check.json`, screenshots in `evidence/rifle-v10-browser/`):
  - A seven-shot Original-lane string scored 7/7 for 70 points with a mid-string reload.
  - Reload transferred one round per 2.4 s cycle and repeated until full.
  - Fire was refused during the lever cycle, when the rifle was empty, and before a string started.
  - A shot with the wrong lane selected was recorded as non-scoring.
  - Rifle history uses its own storage key with `weaponId`, and the pistol relaunches with its own state.
  - No console errors on either backend.
- Unreal editor game:
  - The C++ rebuild passed (`evidence/rifle-v10-rebuild-editor-result.json`).
  - The scoped import passed with 18 parts and 11 anchors; all 250 protected map and override files were unchanged (`evidence/rifle-v10-native-import.json`).
  - The rifle fixture passed 41/41 checks with no material fallbacks and the map unchanged (`evidence/rifle-v10-editor-result.json`).
  - All nine captures were inspected. In `reload-gate`, the brass cue sits between the thumb and the receiver at the gate.
- Standalone Win64 package (`<package root>/WeaponLab`; the v9 package is kept at `packages-retained/WeaponLab-v9-last-good`):
  - The first cook rendered seven rifle and cartridge materials with the default material because they lacked Nanite usage. `pipeline/fix_rifle_v10_nanite_usage.py` sets explicit Nanite usage on the RifleV10 materials only, leaving protected files unchanged.
  - After re-cooking, the rifle fixture passed 41/41 with zero fallbacks (`evidence/rifle-v10-packaged-result.json`).
  - Pistol regression passed 34/34; range-session regression passed 56/56.
  - The editor rifle fixture was re-run after the material change: 41/41.
  - The packaged captures (`evidence/rifle-v10-packaged-sheet.png`) match the editor captures.
- Summary: `evidence/rifle-v10-closeout.json`.

### Known limitations

- From the browser's first-person camera, the receiver hides most of the cue at the gate. Its position was checked by measurement, not by eye.
- At the browser pane's 1024×768 size, the pistol's hip pose (unchanged from v9) sits below the frame.
- Hand and gun contact is sampled and scoped. It is not collision certification.
