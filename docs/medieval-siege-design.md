# The Last Crossing: design proposal

## Hybrid inhabitation blueprint update

The owner's later direction adds inhabiting existing defenders in first- and
third-person to tactical defense. The older first-person exclusion below is
historical scope, superseded as a design objective, not as an implemented claim.
The measured gameplay proposal and SVG diagrams are in
[hybrid-defense-v1](../../castle-design/blueprints/hybrid-defense-v1/gameplay-design.md).
They preserve the first bridge/open-gate/inner-barricade loop and distinguish
candidate architecture, proposed upper ascent, camera/melee clearance, and
one-entity possession from the legacy native smoke. The new composition remains
unapplied and its art/interaction approval pending.

Revision 0.1, 26 October 2026. Working title. Windows PC, single player.

The owner approved a grounded, Chivalry-inspired visual direction: substantial
fortifications, strong original heraldry, practical armor and a visible siege.
The game rules, dimensions, counts and budgets below are proposals, not implemented
or approved gameplay. Concept images establish appearance, not measured geometry.

## Experience

A small garrison holds a bridge fortress while its baggage and wounded leave by
the rear road. The player commands defensive stations, reserves and repairs.
The castle is a place to explore and a compact siege to replay. One carefully
made location should support both experiences without becoming an open-world RPG.

Two modes share the same assets and layout:

- **Explore:** walk from bridge to gate, lower ward, wall walk, inner gate and keep;
  inspect equipment and understand how the fortress functions. No hostile waves.
- **Siege:** elevated tactical camera with rotation, zoom and pause; hold the
  crossing through five authored waves, evacuate three wagons, protect the keep.
  A paused inspection camera can descend to human height. First-person melee is
  outside the first release; Chivalry is a visual reference, not a combat promise.

Target a 12–18 minute first successful siege. A concise briefing, first-wave
tutorial, readable warnings, loss/retry and a results screen are part of the scene.

## Why this castle exists

The narrow crossing collects tolls and controls movement through a river gorge.
An enemy advance wants the bridge intact. That explains the ram and infantry
assault instead of limitless artillery, a small garrison instead of a huge army,
and a protected rear service road instead of an isolated decorative mountaintop.

Spatial sequence: southern approach → bridge → outer gate → lower military ward
→ broad inner ramp → inner gate → keep yard → rear evacuation road. A narrow
eastern service path reaches a postern and creates a second, telegraphed threat.
It must visibly connect to the approach; enemies never appear inside the walls.

The fortress has a stable/storehouse, forge lean-to, well, ammunition shelter and
wall access stairs. Each explains a task or an inhabited space. Place clutter at
edges and workstations; central circulation remains open.

## Layout contract, before art

Proposed playable envelope: about 90 × 140 m, with a separate distant gorge
backdrop. These are editable design dimensions, not measurements from the images.
Holodeck source coordinates are metres with +Y up. Plan north is +Z; asset forward
remains Kiln's +X. The importer owns the Unity basis conversion.

| Space | Approximate center (x,z) | Design dimensions / level | Purpose |
| --- | --- | --- | --- |
| Bridge | (0,-55) | 7 m clear × 36 m; deck y=0 | Main approach and long sightline |
| Outer gate | (0,-34) | 5 m clear opening, 5 m headroom | First defense; ram objective |
| Lower ward | (0,-8) | 36 × 40 m; y=0 | Reserve movement and repair decisions |
| Flank postern | (22,-8) | 2.2 m clear opening | Infantry-only alternate threat |
| Inner ramp | (0,17) | 6 m clear × 30 m; rises 4 m | Continuous wagon route |
| Inner gate | (0,32) | 5 m clear opening | Fallback defense |
| Keep yard | (0,42) | 26 × 16 m; y=4 | Final objective, no roof-only access |
| Keep footprint | (0,57) | 16 × 14 m | Entrance faces the yard; rear route passes beside it |
| Rear road | (15,60) | 5 m clear | Wagons exit beside the keep, away from attackers |

The rear route bends east at the keep yard, avoiding the keep footprint. A 1 m
landing joins the bridge to the outer gate, then a 4 m entry apron joins the ward.
Adjust longitudinal extents together to remove overlaps during plan review. Ramp
begins at z=2 and ends at z=32; keep it clear through the upper half of the ward.
Walkways are at least 1.8 m clear; primary stairs 2 m; treads rise about 0.18 m.
Use actual actor/camera clearance tests. Collision support tops match visible
floors; parapets and railings are separate blockers. No invisible bridge floor.

Wall kit: 4 m snap bays, 1 m wall thickness, 6 m parapet platform baseline.
Connection planes, floor datums, corner ownership and pivot conventions are
recorded per asset. Gate, portcullis, doors, ram head and wheels remain independent
moving parts. Whole buildings are assemblies; the whole castle is never one GLB.

## Siege rules

The player assigns **crews** to prepared positions, spends **supplies** on equipment
and repairs, and decides when to withdraw. No towers appear arbitrarily on the
bridge. Each station is a real timber platform, embrasure or hoarding with access.

Initial tuning proposal: 3 crews, 120 supplies, 6 station sockets and 3 reserve
crews unlocked over the encounter. A crew is a gameplay unit, represented by up
to three soldiers. Reassigning takes travel time; a moving crew cannot shoot.

| Choice | Initial supply cost | Role / tradeoff |
| --- | ---: | --- |
| Bow station | 40 | Fast anti-light fire; weak against shields/armor |
| Crossbow station | 60 | Slower armor penetration; exposed reload window |
| Stone-drop hoarding | 50 | Short gate-front area attack; limited useful arc |
| Spear reserve | 0 equipment cost | Delays infantry at a marked choke; cannot stop a ram alone |
| Repair order | 30 | Restores a bounded gate segment; ties up a crew and pauses under nearby attack |

Each crew consumes one assignment token regardless of decorative head count.
Starting supplies allow two bows or two crossbows, so a mixed setup requires
trading early coverage for specialization. Values must be tuned by play, not
treated as a solved economy. Supplies arrive between waves; no magical gold
appears from corpses. A small recovery grant prevents an unrecoverable early loss.

Enemies: light infantry pressure exposed defenses, shield infantry resist frontal
arrows, sappers threaten the postern or gate, and one crewed ram anchors the final
assault. Shields are directional; flanking should visibly matter. No spellcasters.

Five wave beats: introduction on bridge; mixed shield push; clearly signaled
postern diversion; coordinated pressure with a repair window; ram-led final push.
Wave compositions and timings are data, with a fixed seed for qualification.
Three wagon departures occur between the early waves on the separate rear road.

Gate destruction opens a real route. Attackers pause to attack intact gates and
take the new route only after destruction. Outer-gate loss is recoverable: crews
can retreat to the inner court. A strong defense may hold the outer gate all game;
the script must not force a cinematic breach. Attacker control of the keep capture
zone for 20 unpaused seconds causes defeat; a visible progress bar explains it.
Win when all three wagons are safe and the final wave is defeated. No hidden
surviving enemy may prevent completion; stranded enemies produce a diagnostic.

Pause freezes movement, projectiles, capture, evacuation and wave clocks. Orders
can be queued while paused. No random damage needed initially. Range, line of sight,
target priority, fire cadence and armor modifiers are explicit rules. Projectiles
visualize resolved attacks or use a documented deterministic hit step; do not mix
two independent damage systems. Towers cannot fire through stone walls.

## Art bible

Grounded high-medieval warfare with cinematic clarity. Pale grey limestone,
dark oak, dark slate, worn iron, mail, wool and linen. Defenders use burgundy and
ivory diagonal-bar heraldry; attackers use mustard and charcoal with a different
mark. Final marks require a separate clean reference; do not trace generated
ambiguities. Team recognition also uses silhouette, shield shape and UI markers.

Broad stone masses read at tactical distance; corners, joints, wear, straps and
hardware reward eye-level inspection. Wear has causes: soot above fires, polished
hand contact, damaged gate boards, wet ground near drains. Avoid uniform noise.
Bright angled daylight with cooler shadows; local smoke may signal damage but
must not hide a whole lane. Night, storms and seasonal variants are later work.

Soldiers are realistically proportioned adults, roughly 1.65–1.9 m tall. Distinct
helmets, shields, shoulder shapes and weapons distinguish roles before tiny
texture detail. No oversized pauldrons, decorative spikes or toy proportions.
Metal must read differently from dyed cloth. Avoid identical cloned faces at
inspection distance; two head variants and controlled equipment variation suffice
for the first family. Explicitly separate collision capsules from visual height.

Reference approval covers aesthetic direction only. Generated castle views have
inconsistent geometry and cannot be used as interchangeable measured elevations.
Next references: clean plan/elevations; one gate construction sheet; infantry
front/side/back rest pose and equipment breakdown; material swatches in neutral
light. Each goes through visual review before production.

## Asset inventory and ownership

The machine-readable inventory is `examples/medieval-castle-unity/design/asset-inventory.json`.
P0 is a bridge proof, P1 is the complete playable siege, P2 is visual enrichment.
Assets begin as planned, with no invented asset IDs or saved revision receipts.

Kiln owns editable asset programs, material pins, geometry, named joints, anchors,
bounds and immutable saved revisions. Holodeck owns scene composition, the bible,
reference decisions and spatial review. Unity owns the game loop, navigation,
combat, UI, audio, animation controllers and platform build. Neither Holodeck
schema nor a GLB is assumed to transport gameplay automatically.

Author in a separate world workspace. Copy only qualified independent fixtures
into the eventual public example. Original references, lineage and captures stay
outside the source repository until their intended distribution is reviewed.

## Characters: prove one family first

The current Holodeck contract rejects skins and embedded animation clips; it can
preview rigid named-joint figures with procedural gait. The installed Kiln 1.4.0
default exporter reports skinning unsupported. This is the present limit, not a
claim about every experimental export path.

Deliver two explicit profiles when necessary:

1. A static rest-pose articulated preview for Holodeck, with stable named joints,
   equipment anchors and a matching collision envelope.
2. A Unity game character with a verified skinned mesh, skeleton and animation
   clips. Blender rigging/weight painting is the proposed additional stage for
   believable human deformation; source-to-derivative provenance is mandatory.

Kiln remains responsible for equipment, modular armor and authored source assets.
Qualify whether its body geometry is fit for rigging before promising the entire
body pipeline. If not, document the body-authoring gap and use a deliberate
Blender-authored body rather than claiming that a rigid puppet meets the target.
Holodeck sees the declared preview, not an identical animated character. A future
skeletal controller for Holodeck is separate engine work.

Use one common human skeleton and body family, with original equipment variants
for crossbowman, shield infantry and sapper. Initial clips: idle, walk, run, turn,
crossbow aim/fire/reload, spear thrust, work/repair, hit, stagger, death. Add bow
and ram-push clips only when those gameplay roles enter the build. In-place motion
is driven by the simulation; root motion is not mixed into path traversal.
Require ground contact, weapon grip, shoulder/elbow/knee deformation, turn/stop
transitions and death cleanup tests on the actual Unity delivery.

Starting per-character targets: 12–18k LOD0 triangles, 5–8k LOD1, 1–3k LOD2;
one body renderer and as few equipment renderers/materials as practical. These
are estimates, not passed budgets. Share texture sets, avoid cloth simulation
initially, and cap persistent corpses. Ordinary GPU instancing does not batch
skinned crowds automatically.

## Scale and performance

First prove 25, then 50, 100 and 200 active attackers with a fixed scenario and
camera route. The production cap follows profiling. Start with pooled GameObjects,
a fixed simulation step, shared route graphs and a spatial index for targeting.
Do not do every-tower × every-enemy scans or a NavMesh path request every frame.
Use a route graph for siege lanes; reserve NavMesh for local crew navigation if
the measured need justifies it. Gates update connectivity explicitly.

Reduce distant animation and visual effects independently of authoritative combat.
Offscreen enemies still attack, capture and evacuate consistently. If simulation
falls behind, report it and use bounded catch-up; do not silently skip damage.
Adopt Jobs/Burst or another crowd renderer only after identifying the bottleneck.

Initial PC target: 1080p/60 on a declared reference machine, with measured CPU/GPU
frame percentiles, spikes, memory and load time in a packaged build. No hardware
qualification yet. Holodeck currently limits 64 assets, 1200 placements and two
million placed source triangles; cove and board consume budget too. Aim below
48 unique scene assets and 800 placements for margin. Scene and Unity crowd budgets
are separate: the Holodeck preview does not contain a 200-soldier siege simulation.

## Acceptance milestones

1. **Design and references:** direction approved; measured route plan, game bible,
   inventory and character delivery contract reviewable. No visual-quality claim.
2. **Bridge proof:** one asymmetric gate, one material chart, one soldier preview
   and one equipped Unity character import at correct scale with preserved IDs.
   Reimport twice without duplicate objects or lost gameplay overrides.
3. **Playable encounter:** one lane, two defenses, two enemy roles, repairs,
   win/loss, restart and a Windows build. Test strategic choices before more art.
4. **Complete scene:** second approach, fallback gate, five waves, ram, evacuation,
   sound, UI and Explore mode. Every intended route traversable.
5. **Quality example:** approved hero/eye-level views, shared asset provenance,
   profiling at the selected crowd cap, reproducible export/import and packaged
   build instructions. No missing materials, floating defenses or hidden blockers.

Fun is a playtest outcome: record whether players understand the objective and
breach consequences, use more than one viable loadout, recover after gate loss,
and want another run. Keep difficulty and pacing editable without reauthoring art.

## Current state

Design only. The Unity scaffold has no gameplay or imported castle. The approved
concept is not a render of the implementation. Toolchain research and the bridge
contract are documented separately in `unity-siege-pipeline.md`. No publication,
merge or release is part of this milestone.
