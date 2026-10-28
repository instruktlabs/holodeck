# Sight plan delivery v12: 1866 rifle and pistol integrated, M4 and Pattern 1742 authored

Recorded 27 October 2026. This implements docs/sight-research-v1.md section 6.4, steps 2 to 5, under the owner decisions in sections 8 and 8.1. The No.4 (step 1) shipped in [bolt-integration-v11](bolt-integration-v11.md).

## Authored revisions

All of these are saved Kiln children. Each passes its own verify script against its parent.

| Gun | Revision | Doc | What changed |
|---|---|---|---|
| Model 1866 | `r_efaced2294e24e9890f47971a737d375` (v3b; geometry from v3 `r_c2f00fc8…`) | [rifle-1866-v3-sights](rifle-1866-v3-sights.md) | Folding-leaf rear sight with a 1.0 × 1.2 mm U notch (Estimate) under `Joint_RearSight`. Rear anchor at the notch-shoulder top, front anchor on the 2 mm blade tip, `anchor_eye` 0.30 m behind the rear anchor (0.313 m forward of the butt). |
| 1911-style pistol | `r_7074467518f94364b59838f83f31ff93` (v6) | [first-pistol-v6-sights](first-pistol-v6-sights.md) | One dovetailed GI-style rear block with a 1.75 mm notch, and a 1.8 mm half-moon blade with its top level with the notch shoulders. Sights and sight anchors stay on the slide. `anchor_eye` 0.55 m behind the rear anchor. |
| Colt M4 | `r_776d1f994d254c8ca5a414029e26c57f` (v2) | [firearm-carbine-v2-sights](firearm-carbine-v2-sights.md) | Dual flip aperture leaf (5.08 / 1.78 mm) with ears, and a 1.83 mm protected post under `Joint_FrontSight` with its anchor on the tip. Sight height 81.9 → 66.0 mm. `anchor_eye` 0.07 m behind the aperture. Not integrated. |
| Pattern 1742 | `r_209f60c0d25c48c78b470b192e5f5942` (v2) | [firearm-flintlock-v2-anchors](firearm-flintlock-v2-anchors.md) | Anchors only: rear reference on the barrel top over the breech plug, front anchor on the stud top, `anchor_eye` 0.22 m behind. No geometry change. Not integrated. |

## Presentation

All four views are derived from the delivered pins by `pipeline/derive-sight-view.mjs` and the policy in `game/sight-policy-v1.json`. Nothing is hand-tuned.

| Profile | Eye to rear | Aim FOV (vertical) | Near | Aim pitch | Notes |
|---|---:|---:|---:|---:|---|
| `pistol` | 0.55 m | 52° | 0.05 m | 0 | No ghost ring. The blade is 2.7 px at 1080p. |
| `rifle1866` | 0.30 m | 45° | 0.03 m | 0.150° | No ghost ring. Ready holds the hammer cocked (`game/rifle-motion-v2.json`). |
| `boltNo4` | 0.10 m | 45° | 0.01 m | 0 | Unchanged from v11. |
| `flintlock1742` (preview only) | 0.22 m | 55° | 0.05 m | 0.065° | 1.5 mm eye lift (Estimate). |

- **Aim pitch:** turns the whole gun about the eye while aiming, so a sloped open-notch line lies on the view axis. The browser does this in `weapon-extension.jsx`, and Unreal through `UWeaponProfileData::AimPitchDeg`.
- **Pistol arms:** the farther eye needs a new rig, `game/arm-rig-v6.json`. See [Pistol grip](#pistol-grip).

## Destinations

- **Browser:**
  - `game/weapon-browser-profiles.mjs` loads the new aliases: `authoring/first-pistol-v6.glb` and `authoring/rifle-1866-v3.glb`, written by `pipeline/pin-sight-revisions.mjs`.
  - It also loads the pins (`game/pistol-asset-pins-v2.json`, `game/rifle-asset-pins-v2.json`), rifle motion v2, the views, and pistol rig v6.
  - The v5 pistol and v2 rifle aliases and pins are unchanged.
- **Unreal** (`pipeline/native-sight-v12-source-edit.cjs`; backups in evidence/sight-v12/native-source-before/):
  - The rifle profile now loads `/Game/Qualification/RifleV12/DA_Rifle1866`, from `pipeline/stage-rifle-v12-native.mjs`, `prepare_rifle_v12.py` and `fix_rifle_v12_nanite_usage.py`. RifleV10 is preserved.
  - Since [support grip v13](support-grip-v13.md), it loads RifleV13 (hands v2, rig v2), and RifleV12 is preserved.
  - `moving_parts_return_to_rest` compares the hammer to the Ready pose, not to zero.
  - The rifle fixture also checks `aim_fov_reaches_profile`.
  - The pistol's hip, aim and aim FOV come from the generated `WeaponPistolViewData.h` (`pipeline/generate-pistol-view-header.mjs`). The hip is unchanged; the aim is now 62.35 cm forward and −7.16 cm.
  - `WeaponArmRigData.h` is regenerated from `game/arm-rig-v6.json`.
  - `pipeline/reimport_pistol_v6.py` imports the v6 GLB into `WeaponGenerated/first-pistol-v6` and swaps `Mesh_FrontSight` in place. It replaces the two v5 rear posts with one `Mesh_RearSight` on the slide through the new `AWeaponLoop::RemovePart`, so the pistol has 71 parts. The map backup is in evidence/sight-v12/pistol-native-before/.

## Pistol grip

The owner noticed the forearms meeting the grip at the wrong rotation in the pistol aim view. The cause was in the gloves themselves: the v5 hands embedded shoulder and elbow joints built for `game/arm-rig-v5.json`. With the farther eye, that showed as low, flared elbows, forearms rising into the grip at about 38°, and a 40–43° bend at each wrist.

- **Rig:** `game/arm-rig-v6.json` now has shoulders beside and below the eye (off-screen in aim), with poles that put each elbow under the gun line. Each forearm points along its hand.
- **Hands v7:** Kiln child `r_686f213a922647ce967c27f5afdcebb1` of the pistol hands (alias `authoring/first-hands-v7.glb`) rebuilds the arm joints and sleeves from that rig. Fingers, contacts and clips are identical to v5.
- **Wrist bend at Ready:** 40.0° / 42.8° → 0° / 0°. Elbows open from about 80° to about 140°. Reach is at most 94% of arm length (limit 95%).
- **Reload:** the support hand's 9–37 mm misses during reload and inspect are gone.
- **Unreal:** `pipeline/reimport_hands_v7.py` imports the hands into `WeaponGenerated/first-hands-v7-combined`. Earlier hands folders are kept.
- **Twist check:** the ~10° forearm twist during reload was an artefact of the misaligned arm, and it is now under 1°. So the native liveness check `forearm_twist_moves_during_reload` became `forearm_twist_moves_during_hand_actions`, measured over inspect and reload with the same 0.05 rad threshold (`pipeline/native-sight-v12b-source-edit.cjs`).
- **Remaining:**
  - The forearms run nearly parallel (4–5° inward) rather than in a wide V.
  - In the inspect right-hold pose the left wrist still bends 25°, which comes from the clip's hand rotation.
- **Evidence:** evidence/pistol-grip-v6/ (before and after measurements and WebGPU/WebGL2 screenshots).

## Qualification record

- **Node:** 57/57 game tests. `game/sight-views.test.mjs` checks, for each integrated profile:
  - eye at the camera origin
  - both sights on the view axis
  - eye relief and aim FOV from the policy
  - pistol tops level and reach
  - hand joints matching rig v6
  The rifle test also checks the cocked Ready hammer.
- **Holodeck** (evidence/sight-v12-browser-check.json; screenshots in evidence/sight-v12-browser/ and evidence/pistol-grip-v6/): pistol and 1866 aim pictures, live hits and reloads on WebGPU, and forced WebGL2 confirmed. Zero console errors.
- **Unreal editor game:** 1866 42/42, pistol 34/34, No.4 46/46, range session 56/56 and range dressing 13/13, with zero material fallbacks.
- **Standalone package:** No.4 46/46, 1866 42/42, pistol 34/34, range session 56/56, range dressing 13/13 and unflagged range v7 9/9, with zero material fallbacks.

## Open

- **M4:** the owner chose to rescale the whole gun. The v3 proportions revision (`r_f0ad6458af8b40c48ca99eca88d48abe`, [record](firearm-carbine-v3-proportions.md)) brings the sight radius to 371 mm, against 368 mm documented (+0.9%), and passes verification. The M4 and the Pattern 1742 are not yet integrated: they still need views, hands, rigs and both destinations.
- **Estimates:** notch, blade and post sizes are Estimates where no measured source exists, and every eye distance is a Target.
- **Performance:** not measured.
