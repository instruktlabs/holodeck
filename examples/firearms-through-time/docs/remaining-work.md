# Remaining work

27 October 2026, end of round v14. What is left, in order.

## 1. Pattern 1742 in both hosts

The authoring is in progress: gun v3 with a separate ramrod, the hands, the paper cartridge, the drill and the lock. Once it is delivered:

- **Pin it:** `node pipeline/pin-trigger-guns-v14.mjs flintlock1742`, then record its measurements in [M4 and Pattern 1742 v14](m4-1742-v14.md).
- **Browser:** add the profile to `game/weapon-browser-profiles.mjs`. Drive the cock, the frizzen, the pan flash at `anchor_vfx_pan`, the ramrod and the cartridge cue from the motion channels.
- **Unreal:**
  - add the flintlock fields to `UWeaponProfileData`;
  - add its plan to `pipeline/stage-trigger-guns-v14-native.mjs` and its import to `pipeline/prepare_trigger_guns_v14.py`;
  - write a `FlintlockTestTick`. `pipeline/run-trigger-lab.ps1` already lists its captures.
- **Already decided:** a condensed drill of about 10 s, and the lock delay with no misfires (pan flash, then the shot 60 ms later).

## 2. Owner requests (27 Oct)

- **Pick the guns from a wall rack in the range,** instead of the panel's drop-down.
- **Keep test readouts out of the play view.** The controls list, the compatibility check and the other test text move behind a debug switch.
- **Side-by-side videos** of the same actions in Unreal and in the R3F host.

## 3. Owner trial of recoil and the M4

The owner will try the recoil later. Their verdict may change the gameplay values in `game/recoil-profiles-v1.json`.

## 4. M4 motion and hands

- **The reload is hard to see.** The magazine change and the charging-handle pull happen mostly below the game view. Raising or rolling the gun during the change would show them.
- **Charging-handle travel is 63 mm,** short of the 70 mm Estimate, because the stock overlaps the handle.
- **The index finger returns to the trigger after the magazine release.** A real shooter keeps it straight along the receiver, and the index needs a second axis to do that.
- **At full pull the left elbow sits 18 cm ahead of the wrist.** This shows only from the side.

## 5. Packaged builds

Package WeaponLab with the M4 (and the 1742). Then rerun `pipeline/run-trigger-lab.ps1 -Packaged` and `pipeline/run-v14-regressions.ps1 -Packaged`. This round's runs were all in the editor.

## 6. Range dressing licence

The service bench, cabinet and wall sign use the Kiln library wood `procedural-wood-dry-v3`, which is licensed `LicenseRef-Local-Unpublished`. To bring them into the public Holodeck example, either relicense that wood or re-author the three pieces with a published material.

## 7. Holodeck host

- **The client-extension hook is experimental.** Static export always uses the no-op extension. There is no versioned lifecycle, error isolation or manifest validation yet.
- **Optional skills install by destination.** Holodeck installs an optional skill when a world lists its destination in scene.destinations; Unity is the first. This example's holodeck-game-pipeline skill isn't registered there yet, so copy it into a project's skill folder by hand.

## 8. Roadmap after this

Then the range campus (layout options, a layout proof, activities, art), then the 60-entry collection. See [roadmap v13](roadmap-v13.md).
