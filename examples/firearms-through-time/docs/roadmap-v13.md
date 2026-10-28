# Roadmap v13: guns, range and recoil

27 October 2026. The owner asked when the full gun collection, the whole range, and recoil patterns the player has to learn to control will be built. They set the order below through the question tool.

## Owner decisions (27 Oct)

- **Next, once the current round lands:** recoil patterns.
- **Recoil:** each gun has a learnable pattern, with slight variation.
- **Range:** many lanes, exercises and targets, the guns on racks behind the booths, and strong architecture. Set it in a desert, with a tall cliff backstop far out.
- **References are the aesthetic, not the layout:** "we want to build a properly laid out gun range in a more creative and AAA like vision".

## Where things stand

- **Guns:**
  - Three are playable prototypes in both hosts: pistol, 1866 and No.4.
  - The M4 is rescaled to the catalogue (v3 proportions, sight radius within 0.9% of documented). The Pattern 1742 is authored. Neither is integrated.
  - The 60-entry catalog is still a proposed roster ([firearm collection production](firearm-collection-production.md)).
- **Range:** the Range 01 slice. It has a booth bank, lanes of about 24 m with paper, plates and the turning target, a service station, and three architecture modules.
- **Recoil:** before recoil v1 it was cosmetic only: the weapon model kicked, but the aim didn't move. [Recoil v1](recoil-v1.md) now moves the aim on the three playable guns, under the contract in [shot feedback fidelity](shot-feedback-fidelity.md).

## Order

1. **Current round (done):** the rifle support-hand grip (1866 and No.4) is integrated in both hosts; see [support grip v13](support-grip-v13.md). The M4 rescale and the controls are done too.
2. **Recoil v1 (built; owner feel review next):** on the three playable guns, in both hosts; see [recoil v1](recoil-v1.md).
3. **M4 and Pattern 1742 to playable (M4 done in both hosts; the 1742 is being authored):** see [M4 and Pattern 1742 v14](m4-1742-v14.md) and [remaining work](remaining-work.md). Each gun has its own recoil profile. The M4 brings the first automatic or burst fire, where patterns matter most.
4. **Range campus:** layout options for the owner to choose from, then a layout proof, then the activities, then art. The references guide the look, not the layout.
5. **Collection:** audit the 60-entry roster against the era coverage matrix, settle the production order with the owner, then build in tranches through the delivery gate.

Pace: one gun into both hosts has taken about one full round, as the No.4 did. Recoil v1 is about one round. The range is several rounds: layout design and a proof, roughly one round per activity family, then art passes. The range layout design doesn't depend on recoil, so it can run in parallel. These are sequencing estimates, not dates.

## Recoil v1

Built on 27 October; see [recoil v1](recoil-v1.md). It follows this plan with one simplification: the kick is sized as a hold gain (two-hand pistol or shoulder) times the square root of the free recoil energy, and the bore's height above the hold is not modelled.

- **Profile:** a versioned recoil profile per gun.
  - The impulse estimate comes from the projectile's mass and velocity plus the propellant, and the gun's mass gives recoil velocity and energy.
  - Muzzle rise comes from the bore's height above the hold. Cadence comes from the action.
  - Every value is labelled Estimate or gameplay tuning, never calibrated ballistics.
- **Learnable pattern:** each accepted shot kicks the aim (up, with a sideways drift) along a fixed sequence for that gun. A small seeded variation is added, deterministic per session and shot, so both hosts replay the same kicks.
- **Recovery:** the aim returns part of the way toward its pre-shot point at a per-gun rate. The rest is the player's to correct with the mouse.
- **Resolution:** a shot travels along the aim at the moment the trigger is accepted, and the kick applies after it. An uncorrected kick therefore moves the next shot.
- **View:** the camera follows the aim. The existing model kick stays as presentation, and any camera shake is cosmetic and can be scaled down.
- **Feedback:** range review already shows group spread and drift, so improvement is visible.
- **Verification:**
  - Shared seeded fixtures for the kick sequences, run in the Node tests and the native checks.
  - An owner hands-on feel review.

## Range campus

**References:** handoff/design/firearms-through-time/:
- concepts/02-massive-modern-range-study.png, 03-overview-layout-study.png and 04-shared-concourse-direction.png
- blueprints/range-campus-01 (six banks of eight stations, 240 virtual metres)
- RANGE-ACTIVITY-RESEARCH.md, DESIGN-BIBLE.md, STYLE-GUIDE.md

The references set the **aesthetic only**: heritage stone, timber and steel, contemporary station interfaces, a lit collection wall, a covered firing line, and a long view over the range. They are not a layout to trace. Neither is the blueprint's six banks of eight stations.

The design:
- **A properly laid out range:**
  - Real range design: firing lines and lane widths, standard distances per discipline, side berms and baffles, backstops sized to their lanes, and safe walking routes behind the line.
  - Composed with a creative, AAA vision: an arrival sequence, landmarks, strong sightlines and verticality, and moments of reveal.
- **Owner asks to keep:**
  - Many lanes, exercises and targets.
  - The guns on racks behind the booths.
  - Strong architecture.
  - A desert setting, with a tall cliff backstop far out.
- **Candidate exercises** (from the activity research, not fixed counts): paper and precision, reactive plates, moving targets, timed sequences, long field, and custom practice.
- **Stages:**
  1. **Layout design:** two or three layout options as plans at real distances, showing flow, bays, the rack wall and sightlines. The owner picks one through the question tool.
  2. **Layout proof:** a blockout of the chosen plan, with desert terrain and the cliff, walkable routes and player-eye checks. Build it as its own world, so the playable Range 01 slice keeps working.
  3. **Activities:** bay by bay.
  4. **Art passes.**
