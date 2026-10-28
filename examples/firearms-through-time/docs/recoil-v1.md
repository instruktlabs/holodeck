# Recoil v1: each gun pushes your aim, and you pull it back

27 October 2026. The owner chose recoil as the next round, and how it should behave: "Each gun pushes your aim along its own repeatable climb and drift, sized from its weight and cartridge (labelled Estimates), plus a little seeded randomness. Shots go where the muzzle points, so you learn to pull against it." This round builds that for the pistol, the 1866 and the No.4, in both hosts. It follows the contract in [shot feedback fidelity](shot-feedback-fidelity.md).

## How it behaves

- **The shot goes first.** A shot travels along the aim at the moment the trigger is accepted. Its kick turns the aim afterwards, so an uncorrected kick moves the next shot, not this one.
- **Rise, recover, residual.** The aim rises into each kick over a few hundredths of a second, so the view never snaps. Most of the kick then recovers by itself. A per-gun share, the residual, stays: that is what you pull back with the mouse.
- **A learnable pattern.** Consecutive shots step through the gun's own rows of climb and sideways drift. A shot fired after a pause (`resetAfter`) starts the pattern again. Past the last row, the last row repeats.
- **Slight variation.** Each kick varies a little: up to ±6% in climb and ±5% of the base kick sideways. The variation is seeded from the session and the shot, so a replay, and the other host, give the same kick.
- **The real look moves.** In the browser the kick turns the Holodeck walking look; in Unreal, the pawn's camera pitch and actor yaw. Your mouse adds to the same look, so there is one aim and nothing is counted twice.
- **Cosmetic kick unchanged.** The gun model's existing kick back and up stays as presentation. There is no camera shake.

## Profiles

`game/recoil-profiles-v1.json` is built by `pipeline/build-recoil-profiles-v1.mjs`. Every field carries the contract's provenance record (value, units, class, references, scope, uncertainty, tuning reason, approval, revision).

| | Pistol | 1866 | No.4 |
|---|---|---|---|
| Load (Estimate) | .45 ACP 230 gr at 830 ft/s, 5 gr powder | .44 Henry 200 gr at 1,125 ft/s, 27 gr black powder | .303 Mk VII 174 gr at 2,440 ft/s, 37 gr cordite |
| Gun mass (Estimate) | 1.10 kg | 4.0 kg ±0.5 | 4.1 kg |
| Recoil impulse | 3.89 N·s | 5.34 N·s | 11.06 N·s |
| Free recoil | 3.54 m/s, 6.89 J | 1.34 m/s, 3.57 J | 2.70 m/s, 14.92 J |
| Hold gain (tuning) | 0.72 °/√J, two hands | 0.52 °/√J, shoulder | 0.52 °/√J, shoulder |
| Base kick | 1.89° | 0.98° | 2.01° |
| Residual you correct | 12% | 25% | 20% |
| Recovery / rise time constants | 0.12 s / 0.02 s | 0.20 s / 0.03 s | 0.24 s / 0.035 s |
| Pattern restarts after | 0.6 s (trigger 0.22 s) | 1.6 s (lever 0.95 s) | 2.0 s (bolt 1.25 s) |
| Pattern | Climbs right, swings left mid-magazine, then back right (7 rows) | Gentle climb walking right as the lever works, then easing left (6 rows) | Stoutest: up and right through the first charger, back left through the second (10 rows) |

- **Physics** (Estimates): impulse = bullet mass × velocity + charge mass × 1.5 × velocity (the gas factor is a rule of thumb). Recoil velocity and energy follow from the gun's mass.
- **Base kick** = hold gain × √(free recoil energy). So the kick is sized from the cartridge and the gun's weight, and a handgun turns more per joule than a shouldered rifle.
- **Everything after the physics is gameplay tuning:** gains, patterns, variation, recovery and residual. No value is calibrated ballistics, and no pattern is presented as a historical spray.
- **Sources:** [M1911 pistol](https://en.wikipedia.org/wiki/M1911_pistol), [Sierra .45 ACP load data](https://sierrabullets.com/content/load-data/handgun/451/45-auto-(ACP).pdf), [.44 Henry](https://en.wikipedia.org/wiki/.44_Henry), [Winchester rifle](https://en.wikipedia.org/wiki/Winchester_rifle) (family figure, not the 1866 itself), a [modern 1866 listing](https://gun.deals/catalog/209936/winchester-model-1866) (weak), [.303 British](https://www.canadiansoldiers.com/weapons/ammunition/303.htm), [SSUSA on the .303](https://ssusa.org/content/last-cartridge-of-an-empire-303-british), [RMR Museum .303 bullets](https://hub.catalogit.app/royal-montreal-regiment-museum/folder/entry/.303-bullets) and the [McCord Stewart No.4](https://collections.musee-mccord-stewart.ca/en/objects/details/431071).

What one first shot does, with no variation:

| | Peak climb | Settles at | At 24 m, uncorrected |
|---|---|---|---|
| Pistol | about 1.37° at 0.04 s | 0.23° | about 9.6 cm high: two rings |
| 1866 | about 0.71° at 0.07 s | 0.25° | about 10.3 cm high: two rings |
| No.4 | about 1.51° at 0.08 s | 0.40° | about 16.8 cm high: three to four rings |

At the pistol's fastest trigger (0.22 s) the aim is still about 0.55° up. Rapid fire climbs, and pacing or pulling down brings it back. The paper rings are 5.1, 9.2, 13.3, 17.4 and 21.5 cm in radius.

## The model

`game/recoil.mjs` is engine-neutral, and Unreal mirrors it in `WeaponRecoil.h`.

- **State:** for pitch and for yaw, the part of the kicks still to recover, and where the aim is now relative to where it will settle.
- **Each accepted shot** adds (1 − residual) × kick to the recovering part. It lowers the current aim relative to the settle point by residual × kick, so nothing jumps.
- **Each frame** the aim follows the recovering part through the rise time constant while that part decays at the recovery rate. The step is the exact solution, so any frame split gives the same aim. The host turns its look by the change.
- **Seed:** FNV-1a 32 over UTF-8 of `<fnv1a32(sessionId)>|<shotId>|<profile revision>|weapon-response`, into mulberry32; two draws per shot. Shot IDs are the range session's own (`<session>:shot:<n>`).
- **Exactly once:** a missing or repeated shot ID gives no kick. A rejected trigger never reaches the recoil.

## Where it runs

**Browser:**
- `weapon-extension.jsx` calls `fireRecoil` after `recordShot` accepts a shot. Each live frame it calls `stepRecoil` with the weapon step's clamped time and turns the look. The status line shows the pattern row, or "needs host look". The replaced file is in evidence/recoil-v1/browser-before/.
- **Holodeck host** (uncommitted, in the experimental client-extension seam): `src/world/runtime-scene.jsx` gives the extension a `look` ref. While walking, `look.current.turn(yaw, pitch)` turns the walking look inside the mouse-look pitch clamp and returns what it applied. It is documented in Holodeck's `docs/client-extensions.md`. Nothing else in Holodeck changed for recoil.

**Unreal:**
- `pipeline/native-recoil-v1-source-edit.cjs` wires `WeaponRecoil::FState` into `AWeaponLoop`. Backups are in evidence/recoil-v1/native-source-before/.
  - The fire path kicks after `RecordShot` accepts the shot.
  - `TickRecoil` steps with the action clock and turns the pawn: camera pitch, clamped at ±75° like mouse look, and actor yaw. It carries turns smaller than 2e-4° until they add up, because Unreal ignores rotation changes under 1e-4° (see the qualification record).
  - The profile follows `ActiveProfile->ProfileId`; the pistol uses `pistol`.
- `WeaponRecoilData.h` is generated by `pipeline/generate-recoil-header.mjs` from the profiles and the fixtures.
- `WeaponRecoilFixture.h` replays the shared fixtures natively.

## Tests

- **Node** (`game/recoil.test.mjs`, 9 tests; 69/69 game tests in all):
  - Provenance on every field, and the physics recomputed from the inputs.
  - Patterns cover a full load, and the action keeps a string going.
  - Published FNV-1a vectors, and the fixture and native header generators are current.
  - The shared fixtures replay at 30, 60, 144 and 251 Hz.
  - Variation is seeded, slight and bounded, and differs between sessions.
  - The pattern walks and restarts.
  - A kick rises with no jump, peaks, and settles exactly at the residual.
  - A replayed or missing shot gives no kick.
- **Shared fixtures:** `game/recoil-fixtures-v1.json` (`pipeline/generate-recoil-fixtures-v1.mjs`) holds hash and PRNG vectors and one timed string per gun: 29 kicks and 353 aim samples.
  - `pipeline/check-recoil-fixtures.py` is a second implementation, written from the profiles, not from the module. It reproduces every hash, draw and kick exactly, and every aim sample within 1.3e-14° in 1 ms frames: `uv run --no-project python -I pipeline/check-recoil-fixtures.py`.
- **Negative tests:** `pipeline/recoil-negative-tests.mjs` runs the Node tests against five deliberately broken copies of the module, and all five are caught (evidence/recoil-v1/negative-tests.txt). The faults are a wrong PRNG constant, an aim that snaps, no residual, a replayed shot that kicks, and a pattern that never advances.

## Qualification record

**Holodeck** (evidence/recoil-v1/browser-check.json): one shot, then a second without touching the look. The second shot's recorded ray had turned by exactly residual × the first shot's seeded kick:

| Gun | Backend | Turn after one shot (up, right) | Difference from the model |
|---|---|---|---|
| 1866 | WebGPU | 0.2449°, 0.0091° | 4e-14° |
| Pistol | forced WebGL2 | 0.2226°, 0.0181° | 2e-14° |
| No.4 | WebGPU | 0.4144°, 0.0507° | 1e-11° |

Every first shot left along the resting aim. Zero console errors.

**Unreal editor game** (label `recoil-v1b`): pistol 39/39, 1866 47/47, No.4 51/51, range session 56/56 and range dressing 13/13, all with zero material fallbacks. Each gun's fixture adds five checks:
- `recoil_fixture_matches`: the native code replays the shared fixtures in 1/90 s frames. Every kick matches exactly, and the worst aim difference is 4.4e-15° (pistol), 2.4e-15° (1866) and 9.8e-15° (No.4).
- `recoil_shot_uses_pre_kick_aim`: the shot's ray equals the camera forward from before the trigger, and the shot kicked once.
- `rejected_fire_no_kick`: the cooldown or cycle refusal right after it adds no kick.
- `recoil_rises_then_settles`: the camera rises past half the kick, then settles at residual × kick within 0.001°. Measured from the pawn's camera:

| Gun | Kick (up, right) | Settled turn | Residual × kick | Peak climb |
|---|---|---|---|---|
| Pistol | 1.9667°, 0.1410° | 0.23613°, 0.01706° | 0.23600°, 0.01692° | 1.123° |
| 1866 | 0.9497°, 0.0850° | 0.23756°, 0.02125° | 0.23743°, 0.02125° | 0.709° |
| No.4 | 1.9387°, 0.2119° | 0.38788°, 0.04252° | 0.38775°, 0.04239° | 1.448° |

- `recoil_string_walks_pattern`: after the fixture's rapid string, the pattern row is where it should be: row 7 after the pistol's seven shots in one tick, row 3 after the 1866's three, row 5 after the No.4's five.

**The first editor run failed, and why.** Label `recoil-v1`: pistol 38/39, 1866 46/47 and No.4 50/51. Each failed `recoil_rises_then_settles`, and range session and dressing passed. There were two causes:
- **Pistol, a check placed too early.** The pistol fixture's next phase runs only 0.5 s after its shot. The excess it measured (0.031241°, 0.003150°) is exactly the recovery the model still has left at 0.5 s, so the check moved to the 7.3 s phase.
- **Rifles, Unreal dropping small turns.** The aim stuck about 0.003° up and right on both rifles. Unreal's scene components ignore any rotation change under 1e-4° (`FRotator::Equals` in the move path), so the tail of each recovery was lost. That is 1e-4° × the recovery time ÷ the frame time, it is the same on both axes whatever the kick, and it would grow with every shot. `TickRecoil` now carries the owed turn and applies it once it reaches 2e-4°, subtracting what the component actually took. The settled turns now agree within about 0.00014°.

The source-edit script includes both fixes. Applied to the backups, it reproduces the current sources byte for byte.

**Standalone package** (WeaponLab, rebuilt; label `recoil-v1b-packaged`): No.4 51/51, 1866 47/47, pistol 39/39, range session 56/56, range dressing 13/13 and range v7 9/9, all with zero material fallbacks. The packaged recoil probes settle within 0.00017° of residual × kick:

| Gun | Settled turn | Residual × kick |
|---|---|---|
| Pistol | 0.23201°, 0.02496° | 0.23185°, 0.02485° |
| 1866 | 0.23884°, 0.01780° | 0.23873°, 0.01764° |
| No.4 | 0.41854°, 0.03445° | 0.41841°, 0.03429° |

**Pistol fallbacks:** the pistol runner doesn't record material fallbacks, so its zeros come from a log scan.

Closeout: evidence/recoil-v1-closeout.json. It is generated from the result files, and it hashes the recoil sources and the Holodeck host file.

## Not verified

- **Owner's hands-on feel:** kick size, residual and recovery are first tuning, for the owner to judge with the locked mouse.
- **The climb between shots** was not watched live in the browser. The pane was hidden, so frames ran only while the tools captured; the settled turn does not depend on that.
- **Hit placement under rapid fire** in the browser beyond the Node fixtures.
- **Performance:** not measured.
