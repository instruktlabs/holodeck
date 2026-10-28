# No.4 bolt rifle delivery into Holodeck and Unreal (v11)

The third playable profile is `boltNo4`, the saved No.4 Mk I* exterior candidate ([firearm-bolt-v1](firearm-bolt-v1.md)). It has a visual bolt cycle on the saved pivots, dedicated first-person hands and a five-round charger cue. This is a playable art prototype. It does not qualify historical capacity, rate of fire, calibrated recoil or ballistics, production anatomy or AAA finish.

## Ownership

Kiln owns the rifle, hands and charger cue geometry and the saved hand clips. The game owns the profile, ammunition, action gates, target sessions and scoring. Both destinations use the shared motion, rig, view and game contracts:
- `game/bolt-no4-game-contract.json`
- `game/bolt-no4-motion-v1.json`
- `game/bolt-no4-arm-rig-v1.json`
- `game/bolt-no4-view-v2.json` (from `pipeline/derive-sight-view.mjs`; `game/bolt-no4-view-v1.json` is the superseded first view)

`pipeline/bolt-hand-author.mjs` writes the motion, rig and view. It also derives the hands program from the accepted rifle v10 hands, and builds a fitting-only assembly (hands, No.4 and charger) for review renders. `pipeline/pin-bolt-browser.mjs` promotes the exact saved revisions to browser aliases. `game/bolt-no4-asset-pins-v1.json` records them.

## Rules (prototype tuning)

- A ten-round magazine with thirty in reserve.
- Firing starts a 1.25 s visual bolt cycle: lift 50°, draw 7 cm, drive, turn down. The cycle gates every other action.
- A reload cycle lasts 3.0 s. It opens the bolt, seats a charger and strips up to five rounds at 60%, then closes the bolt. Cycles repeat until the magazine is full or the reserve is empty.
- A short reserve strips only what remains.
- The attachment allowlist is empty except the `restored-furniture` finish. The sling stays unqualified, per the candidate's pins.

## Engine changes

- **Browser** (`weapon-extension.jsx`, `game/weapon.mjs`, `game/bolt-presentation.mjs`):
  - Profile selection gains `boltNo4`, and the charger reload is a second per-cycle reload policy.
  - The pistol's slide and magazine channels now drive only the pistol. The No.4 has its own `Joint_Magazine`, which they would otherwise have moved.
  - The loading cue now takes an optional wrist-relative rotation.
- **Unreal** (`WeaponProfileData`, `WeaponLoop`, `WeaponProfileRuntime`):
  - Profiles gain an `ActionKind` (`lever` or `bolt`), `RoundsPerCommit`, a bolt pivot with slide and lift components, and a loading-cue rotation.
  - Validation requires each kind's own moving parts and interaction anchor.
  - The rifle profile asset is unchanged: its defaults are `lever` and one round per commit.
  - The bolt fixture (`BoltTestTick`, run by `pipeline/run-bolt-lab.ps1`) shares the rifle's report and capture hooks.
- **Staging** (`pipeline/rigid-native-delivery.mjs`): review clips can allow a listed translation channel, because the No.4's review clip draws the bolt.

## Sight presentation (owner decisions, docs/sight-research-v1.md section 8)

- **Gun v2** (`authoring/firearm-bolt-v2-sights.kiln.js`, revision `r_7a36158e3c3b4db99eacb702f1785f64`): a 1.2 mm front blade under `Joint_FrontSight`, a rear aperture under `Joint_RearSight`, and `anchor_eye` 0.10 m behind the aperture (real cheek weld).
- **Aim and near plane** come from `game/sight-policy-v1.json`: 45° vertical aim FOV and a 1 cm near plane.
- **Rear aperture** at 6.2 mm, labelled Estimate.
- **Ghost ring:** an analytic opacity fade by view angle around the eye-to-aperture axis, using a 4 mm pupil and 35% darkening.
  - Browser: a TSL node material.
  - Unreal: `/Game/Qualification/SightV11/M_GhostRing` with per-part MIDs that keep the imported base colour.
  - Targets stay sharp.
- **Front-blade floor:** the blade widens only below 2.5 px at a 1080 px reference height, and only while aiming.
- **Material wiring:** single-input material nodes (Clamp, Arccosine, OneMinus) take the input name `''`, not `'Input'`. The first import wired `'Input'`, the link silently failed, and the material fell back to the default. `pipeline/rebuild_ghost_ring_v11.py` repaired that link in place, and `pipeline/ghost_ring_material_v11.py` builds it correctly for fresh imports.

## Qualification record (27 October 2026)

- **Node:** 52/52 game tests, including 6 No.4 rule tests and 5 delivery tests (saved-revision pins, 41 bones and clip timing, charger at the guide at commit, bolt pivots, eye anchor and sight alignment).
- **Holodeck** (evidence/bolt-v11-browser-check.json, evidence/bolt-v11-browser/): on WebGPU and forced WebGL2 (`backend=webgl`, WebGL2 context confirmed), a 7/7 70-point string on the Original lane with a five-round charger reload mid-string.
  - Fire during the cycle was refused.
  - The string closed at 7 accepted shots.
  - Zero console errors.
- **Unreal editor game** (`pipeline/run-bolt-lab.ps1 -Label v11-editor`, evidence/bolt-v11-editor-result.json): 46/46 checks and zero material fallbacks. The checks include:
  - bolt lift and draw
  - the five-shot string
  - charger 5 + top-up
  - the 7 + 2 reserve boundary
  - the aim FOV
  - the ghost ring active in aim
  - IK without stretch
  - Captures are in evidence/bolt-v11-editor-*.png.
- **Rifle regression after both C++ changes:** 41/41 in the editor game, zero fallbacks.
- **Standalone package:** `build-validation.ps1 -Target Package -Map WeaponLab`, archived to <package root>/WeaponLab. Zero material fallbacks in every run:

  | Check | Result |
  |---|---|
  | No.4 bolt | 46/46 |
  | Rifle regression | 41/41 |
  | Pistol regression | 34/34 |
  | Range session | 56/56 |
  | Range dressing | 13/13 |
  | Unflagged range v7 | 9/9 |

Not qualified: historical capacity, rate and ballistics; production hand and anatomy art; browser hip view of the charger at small viewports (the hands sit below the frame); Maker/full-body binding; performance.
