# Support grip v13: the rifle support hand grips the fore-end

27 October 2026. The owner reported that on the rifles the support hand "keeps like cupping the front of the stock as opposed to gripping it". They chose to fix the 1866 and the No.4 only, and to have a sub-agent author the new hands. The pistol is untouched.

## What was wrong

Measured at Ready by `pipeline/measure-support-grip-v13.mjs`, from skinned glove vertices against the posed gun:

| v1 hands | 1866 | No.4 |
|---|---|---|
| Wrist bend (forearm against the hand axis) | 58.5° | 57.4° |
| Fingers | Lying along the underside toward the muzzle: index and middle on the near side, ring and little on the far side | The same |
| Thumb | Far side | Far side |
| Deepest penetration into the wood | 17.9 mm (middle finger) | 22.3 mm (ring finger) |

Every sampled clip key failed every target. That's 24 keys on the 1866 and 36 on the No.4.

## The new grip

- **Hands v2.** Each is a Kiln child of the accepted v1 hands.
  - 1866: `r_7269e881c7664cb68deb34bbd441f7f8`, alias `authoring/rifle-hands-v2.glb`, receipt `authoring/rifle-hands-v2-pins.json`.
  - No.4: `r_77de43bccb58428b8307432b15af8ebb`, alias `authoring/bolt-no4-hands-v2.glb`, receipt `authoring/bolt-hands-v2-pins.json`.
  - The first save of each had two non-manifold edges where the index finger crossed the middle knuckle. Both are superseded and not used.
- **Rigs v2:** `game/rifle-arm-rig-v2.json` and `game/bolt-no4-arm-rig-v2.json`.
  - Only the left wrist, the left pole and the left rest-hand rotation change.
  - The support wrist moves toward the near side: 78.5 mm on the 1866 and 70.5 mm on the No.4.
  - The pole puts the elbow out and down to the left, so the forearm runs along the hand axis (40° yaw, 18° pitch).
  - Shoulders, arm lengths and the whole right arm are unchanged.
  - The hands' bind pose is built from these rigs, so each pair is used together.
- **Unchanged:** the right hand, the 41 bones and all four clips. The left hand never moves relative to the gun in any clip, so one contact pose covers every key.

Measured at Ready, with the agent's targets: finger pads on the far side within 3 mm, thumb pad on the near side within 3 mm, palm within 5 mm, penetration under 1 mm, wrist bend under 10°.

| v2 hands | 1866 | No.4 |
|---|---|---|
| Wrist bend | 1.1° | 1.1° |
| Finger pads | All four on the far side, 1.06–1.11 mm off the wood | All four on the far side, 0.75–1.15 mm |
| Thumb pad | Near side, 1.21 mm | Near side, 1.23 mm |
| Palm | Under the fore-end, 1.49 mm | Under the fore-end, 1.48 mm |
| Penetration | 0 | 0 |
| Keys meeting every target | 24/24 | 36/36 |

Evidence for both tables is in evidence/support-grip-v13/:
- summary.json, before-*.json and after-*.json
- verification-*.json: topology, bones, clips and baked IK
- Before and after renders

## Wiring

**Browser:**
- `game/weapon-browser-profiles.mjs` loads the v2 hands and rigs through new pins: `game/rifle-asset-pins-v3.json` and `game/bolt-no4-asset-pins-v2.json`.
  - `pipeline/pin-support-grip-v13.mjs` writes them, checking every hash.
  - The gun and token entries carry over unchanged.
- Earlier pins and aliases are untouched. The replaced browser files are backed up in evidence/support-grip-v13/browser-before/.

**Unreal:**
- `pipeline/derive-support-grip-v13-native.cjs` derives the v13 delivery scripts from the qualified rifle v12 and No.4 v11 ones. Only the hands, the rig and the destinations change.
- **Staging:** `stage-rifle-v13-native.mjs` and `stage-bolt-v13-native.mjs` write the manifests to evidence/rifle-v13-delivery/ and evidence/bolt-v13-delivery/. The rifle staging also checks that its pins match the browser's.
- **Import:** `prepare_rifle_v13.py` and `prepare_bolt_v13.py` import into `/Game/Qualification/RifleV13` and `/Game/Qualification/BoltV13`.
  - The parts and anchors match the qualified imports: 19 and 12 for the 1866, 17 and 17 for the No.4.
  - The gun and token sources are identical; only the hands differ.
- **Materials:** `fix_rifle_v13_nanite_usage.py` and `fix_bolt_v13_nanite_usage.py` give the new materials Nanite usage (8 and 9).
- **Preserved:** each import receipt confirms that the protected folders kept their exact bytes, including RifleV12 and BoltV11. Those stay on disk as the previously qualified state.
- **Switch:** `pipeline/native-support-grip-v13-source-edit.cjs` points `WeaponLoop.cpp` at the new data assets, and the rifle and bolt lab runners hash them.
  - Backups are in evidence/support-grip-v13/native-source-before/.
  - The rig values reach the IK through the data asset, so no other native source changed.

## Tests

- **`game/support-grip.test.mjs`** (new) checks each rifle's delivered hands:
  - The rest skeleton equals its rig: shoulder, elbow and wrist within 0.1 mm.
  - Every fingertip joint is past the far face (z > 20 mm about the bore plane).
  - The thumb tip is past the near face (z < −20 mm).
  - The support wrist bends under 5° at Ready.
  - The browser profile loads those pins and that rig.
- **The test catches the old pose.** Pointed at the v1 hands and rigs, it fails at the first finger (evidence/support-grip-v13/negative-test-v1.txt).
- **Delivery tests** read the hands from the new pins, and check that the earlier pins still match their files.

## Qualification record

- **Node:** 60/60 game tests (evidence/support-grip-v13/node-tests.txt).
- **Holodeck,** both rifles on WebGPU and forced WebGL2, in the desktop browser pane (evidence/support-grip-v13/browser-check.json; screenshots in browser/):
  - Each loaded only the v2 hands.
  - The wrap shows at the hip, from the left side, mid-reload, during inspect and in aim. The support hand stays out of the sight picture.
  - On WebGL2 one live shot each started a string and hit for 10 points while the action cycled.
  - Zero console errors.
- **Unreal editor game** (label `support-grip-v13`), all with zero material fallbacks:
  - 1866 42/42, No.4 46/46 and pistol 34/34.
  - The runtime reports name the RifleV13 and BoltV13 data assets and the v2 hands revisions.
  - The Ready captures (evidence/rifle-support-grip-v13-ready.png, evidence/bolt-support-grip-v13-ready.png) show the wrap.
- **Standalone package** (WeaponLab, rebuilt; label `support-grip-v13-packaged`), all with zero material fallbacks:
  - No.4 46/46, 1866 42/42, pistol 34/34, range session 56/56, range dressing 13/13 and range v7 9/9.
  - The packaged runtime reports name the RifleV13 and BoltV13 data assets and the v2 hands revisions.
- **Pistol fallbacks:** the pistol runner doesn't record material fallbacks, so its zero comes from a log scan.

Closeout: evidence/support-grip-v13-closeout.json. It is generated from the result files.

## Not verified

- **Owner's hands-on look** with the locked mouse.
- **Collision:** contacts come from sampled skinned vertices against the posed gun, not a continuous collision certificate.
- **Performance:** not measured.
