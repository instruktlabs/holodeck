# Hybrid defense blueprint v1

Proposal for review, not a possession/combat implementation. This package joins
the tactical defense game and inhabitable defenders around one authoritative
simulation. It extends the original design's first-person exclusion in response
to the owner's newer request; it does not quietly convert existing features into
completed combat. The current reconstruction remains unapplied and art approval
pending.

## Read the diagrams

- `01-tactical-circulation.svg`: parameterized plan in Holodeck source metres,
  +Z north, with candidate architecture, actual preserved markers, enemy route,
  player route and illustrative station priority coverage.
- `02-section-camera-clearance.svg`: metric section and explicit camera/combat
  hypotheses. The west stair is projected onto the bridge longitudinal section.
- `03-mode-ownership.svg`: tactical control, inhabitation and station operation
  using the same entity identity, health, equipment and action clock.

The diagrams were generated from the measured staged site plan and marker bundle. The authoring workspace retains their generator and exact input/output receipts. Diagram labels are design constraints, not measured camera, weapon or appearance passes.

## First encounter and decisions

Preserve the implemented 24-raider bridge wave, at most twelve active attackers,
open gate and visible inner barricade. Enemies travel source x=60 from z=-70 to
-22; the barricade stands at z=-20.5. The current ballista uses real muzzle LOS,
damage and reload timing. Legacy r10 passed ascent, mount/aim, defended victory,
descent, bridge return, unattended breach and restart on the beta. That evidence
does not transfer automatically to reconstructed towers, terrain or camera modes.

The existing six-supply economy presents heavy bolt (two supplies) versus repair
(three supplies for 75 health), with slower automatic defense versus manual fire.
The proposed preparation phase adds assignment of crews to authored accessible
station sockets and a visible reserve pool. Orders should have travel time;
equipment does not appear arbitrarily in the bridge lane. Between-wave resupply,
multiple weapons, deployment prices and the original five-wave evacuation game
remain later design work. Do not mix its 120-supply proposal into the existing
six-supply encounter as though both were implemented.

The tactical camera should expose threatened routes, resources, station
readiness and objective health. Inhabiting a defender trades that overview for
direct aiming and movement without pausing the whole siege. Optional tactical
pause must freeze the same simulation clock for waves, movement, damage,
projectiles and resources; camera movement while paused must not advance combat.

## Inhabitation contract

Select an existing living defender; reserve and promote its representation before
transferring controls. FPS and TPS are camera modes on the same actor. Preserve
stable ID, health, world transform, equipment, action tick/phase, target and event
cursor. Only one movement authority and one collision/damage owner may be active.
Returning to tactics hands the same body to AI; it must not respawn, heal or
duplicate. An occupied station has one reservation. Leaving it restores control
to the same defender at a collision-valid position. Death releases both station
and control; camera transition must not resurrect the actor.

The current free walker is not soldier possession. New work includes controller
ownership, camera occlusion, locomotion transitions, attacks, blocks, hit reactions,
weapon event timing, teammate congestion and equipment attachment. Idle, Walk and
LookAround are the only existing qualified clips; a crossbow prop's separated
trigger/bolt and named grip points do not supply a reload animation.

## Near/far representation

Retain full skeleton/Animator for the possessed defender and immediate combat.
The earlier hybrid contract favors GPU bone animation for the distant 22-bone
soldier before vertex VAT. VAT remains an optional measured choice for distant
non-skeletal effects; neither GPU crowd path is implemented. Never derive damage
or collision from animation textures.

Start a bounded prototype with one possessed plus eleven nearby full rigs as a
test configuration, not a capacity claim. Earlier proposed hysteresis (12m
promotion, 16m demotion, .5s hold, .15s visual blend) remains unqualified. Possessed,
attacking and contact-critical actors override distance. If promotion resources
are exhausted, defer a new possession request or reduce distant visual work;
never silently remove the current player's collision fidelity. Demote only
after contact/action ownership permits it; preserve phase and event cursor so
damage is not emitted twice during transition.

## Space and camera gates

The preserved west stair uses 35 risers of .18m to y=6.3. Tower rooms have 1.8m
clear portals. B3 resolves the gate crown's 2m vertical connection as a design:
rear tower doors connect to a cross-gallery x=53.1..66.9, z=-25.78..-23.38 at
y=6.3. A central return link x=58.8..61.2 reaches z=-28.7, then an external
south-facing stair ascends to z=-32.3 with twelve 1/6m risers and .30m treads.
The y=8.3 top landing continues to z=-34.7. Stair/landings are 2.4m clear;
supports stay outside the ground lane x=58..62. The open-air stair lies between
roof edges x=57.66/62.34, avoiding the tower ceiling. This resolves the planned
path graph; it does not establish authored geometry or traversal acceptance.
The upper ward at +4.2m likewise has no qualified ascent. The architect's B3
proposal supplies an east ascent at source x=68: first flight z=-18 to -14.4,
12 risers of .175m to y=2.1; 2.4m landing to z=-12; second flight to z=-8.4
at y=4.2; top landing to z=-6. Proposed width is 2.4m and headroom target 2.1m.
This requires explicit rear-curtain and retaining-wall openings. Purple diagram
lines show this design proposal, not a tested addition to the current bundle.
The current west flight is 2.4m tread width, .30m going and 10.5m run, with no
intermediate landing; preserve its existing top and bottom landings.

Existing capsule radius .28m and height 1.8m are controller dimensions, not a
complete kit envelope. Independent character audit reports 1.8082m helmet height,
Idle width .653m and sampled Walk width .657m/depth .954m. Thus collision passage
alone cannot establish armor or weapon clearance. The current ~1.6m camera is not
a measured anatomical eye position. FPS needs explicit helmet/face clipping and
eye alignment review. TPS starting boom 2.5m, sweep radius .20m and shoulder
offset .35m are tuning hypotheses: collision shortens the boom, with a proposed
close-distance FPS fallback, rather than moving the actor through a wall.

Use a proposed 3.6m-diameter sword fighting pocket, then measure actual attack sweeps and
camera retreat. A 2.2m spear length is not its attack radius. Narrow portals and
stairs are transit spaces; two combatants cannot be assumed to pass or swing
through one another. Audit both hand contacts, nearby walls, shield bounds and
underarm deformation before promoting a visual equipment draft to combat use.

## Visible operator and presentation limits

Reserve a dedicated **2×2m operator/reload envelope**, plus at least 2.2m lateral
room for the weapon and a separate approach/dismount path. The dashed plan box
is a proposed reservation centered on the existing operator marker, not a
verified replacement station layout. Current operator center is .8m behind the
machine, putting the stock tail only .177m ahead of the body center, inside the
nominal capsule envelope. Current mounting has no visible operator and omits
stock collision. Its camera/LOS smoke cannot qualify full-body mounting.

Explore 1.05–1.15m behind the machine only as a test hypothesis; derive actual
windlass/trigger grip targets before moving the runtime marker. Independently
check feet, stock, wrists, arms/mail, helmet, reload motion and enter/leave
transitions through the proposed reserved area. No grip or reload acceptance
is implied by the current static ballista.

The optimized soldier uses one skin with shared materials. Disabling a Head
bone is not head-only first-person hiding. Qualify an explicit render-mask or
first-person presentation derivative while retaining third-person appearance
and shadows; do not silently delete approved head geometry. There are no finger
bones, weapon grip animations or combat clips. These constraints come from the
independent `defender-camera-envelope.md` review, not a new test in this package.

## Implementation gates

1. Approve candidate site hierarchy and actual overview/approach/court views;
   complete triangle-level floor ownership and structural support checks.
2. Re-run physical routes and muzzle LOS against exact reconstructed geometry.
3. Implement one existing defender's possession without replacing its entity;
   test enter/leave, death, restart, station reservation and blocked camera.
4. Add one weapon action with explicit hit window, recovery and one damage event;
   compare first/third-person presentation using the same simulation action.
5. Prototype near/far bone playback and promotion continuity independently of
   crowd capacity. Test under contention honestly; no prior benchmark grants a
   shipping population or performance budget for combat.

No particles, ornament or extra prop density are required to pass these gates.
Visual refinement serves readable routes, faction identity and construction.
