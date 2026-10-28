# Range layout v1: three options

27 October 2026. Stage 1 of the range campus in [roadmap v13](roadmap-v13.md): layout options as plans at real distances, for the owner to choose one through the question tool. Building the blockout is the next stage.

**Status:** decided. The owner chose **Option C, Escarpment Terraces** on 27 October 2026. See [Decision](#decision).

## The brief

The owner's direction on 27 October:

- many lanes, exercises and targets;
- the guns on racks behind the booths;
- strong architecture;
- a desert setting, with a tall cliff backstop far out.

The references set the aesthetic, not the layout: "we want to build a properly laid out gun range in a more creative and AAA like vision". None of the options traces the concept images or the six banks of eight in `range-campus-01`.

All three options run the same programme: 8 bays, 72 lanes, and a cliff 1.15 km out. Only the organisation changes.

| Option | Idea |
|---|---|
| **A. Grand Line** | One monumental covered firing line faces the cliff, with the gun racks along its full length. |
| **B. Canyon Fan** | Eight bays fan out from a gate tower into a horseshoe canyon, so each bay is its own slot in the rock. |
| **C. Escarpment Terraces** (recommended) | The player arrives on the mesa rim above the whole range, then descends to an elevated Long Field and two wings at grade. |

## Files

All files are in `handoff/design/firearms-through-time/blueprints/`.

| File | Contents |
|---|---|
| [range-layout-v1-comparison.png](../handoff/design/firearms-through-time/blueprints/range-layout-v1-comparison.png) (and `.svg`) | All three options side by side: site plans at one scale, campus plans at one scale, and a table of key numbers |
| [range-layout-v1-option-a.png](../handoff/design/firearms-through-time/blueprints/range-layout-v1-option-a.png), `-option-a.svg`, `-option-a.json` | Option A sheet and layout |
| [range-layout-v1-option-b.png](../handoff/design/firearms-through-time/blueprints/range-layout-v1-option-b.png), `-option-b.svg`, `-option-b.json` | Option B sheet and layout |
| [range-layout-v1-option-c.png](../handoff/design/firearms-through-time/blueprints/range-layout-v1-option-c.png), `-option-c.svg`, `-option-c.json` | Option C sheet and layout |
| `range-layout-v1-validation.json` | Automated checks for all three options |
| `build_range_layout_v1.py` | Generator. It uses only the Python standard library. `python -I build_range_layout_v1.py` rebuilds the JSON, the SVGs and the checks. |

The PNGs are headless Chrome renders of the SVGs, 2400 px wide.

Each option sheet has five panels:

- **Site plan:** the cliff, the danger trace and the arrival.
- **Campus plan:** bays, booths, targets, concourse and rack wall.
- **Section A-A:** the Long Field axis at true scale, both the campus end and the whole axis.
- **Section B-B:** player scale, through the rack wall, concourse, booth and canopy.
- **Rationale.**

The earlier files in that folder (`layout.json`, `placements.json`, `range-campus-01.*`, `validation.json`, `build_blueprint.py`) are untouched.

## Layout JSON

The schema is `ftt-range-layout-v1`, with status `proposal-for-owner-decision`.

**Frame**

- X runs east (across the range), Y north (downrange) and Z up, in game metres.
- The origin is the centre of the Long Field firing line, at floor level.
- Bearings are in degrees clockwise from north.
- The file names the SPACE-02 convention. Each runtime converts it explicitly.

**Provenance labels**

| Label | Meaning |
|---|---|
| `reference` | Cited from the sources below |
| `estimate` | Derived or approximate, not measured |
| `game` | Tuning chosen for this proposal |

Holodeck constants are marked `HOLODECK` because they were read from code. Every bay carries a `reference` note and a `game` note.

**Stable IDs** follow the same pattern in every option:

| Element | ID pattern | Example |
|---|---|---|
| Bay | `bay.{code}` | `bay.p25` |
| Firing line | `fl.{code}` | `fl.lf` |
| Lane | `lane.{code}.{nn}` | `lane.lf.07` |
| Firing point | `fp.{code}.{nn}` | `fp.lf.07` |
| Target position | `tgt.{code}.{nn}.{dddd}` (distance in metres) | `tgt.lf.07.0300` |
| Backstop | `backstop.{code}` | `backstop.p100` |
| Gong terrace | `step.{dddd}` | `step.1000` |
| Rack wall | `rackwall.*` | A `rackwall.main`; B `rackwall.ring`; C `rackwall.l1-west`, `.l1-undercroft`, `.l1-east`, `.l2` |
| Concourse | `concourse.*` | A `concourse.main`; B `concourse.ring`; C four segments matching the rack wall |
| Cliff | `cliff.main`, `cliff.crown`, `talus.main`, `site.basin` | |
| Other | `armory.*`, `deck.*`, `tower.*`, `bayhead.*`, `portal.*`, `landmark.*`, `sight.*`, `route.*`, `danger.*`, `pad.clay` | B adds `avenue.*` and `fin.*`; C adds `level.l1` to `level.l3`, `escarpment.south` and `hall.l3` |

- **Bay codes, west to east:** `p25`, `ts`, `pl`, `lf`, `p100`, `cu`, `hb`, `mv`.
- **Counts:** every option has 72 lanes, 72 firing points and 382 target positions.
- **IDs:** A has 603, B 633 and C 615. All are unique.

## What real ranges do

### Sources

PDFs were converted to text locally and read; the NSSA source is a web page.

- **UK-NRA:** NRA (UK), *Range Design and Range Safety Handbook*, Issue 1, December 2022. <https://nra.org.uk/wp-content/uploads/NRA-RANGE-DESIGN-AND-SAFETY-HANDBOOK-DEC-2022-22-12-22-1.pdf>
- **NZ:** New Zealand Police, *Shooting Range Manual* V4.01, 5 June 2026. <https://www.firearmssafety.govt.nz/sites/default/files/2026-06/NZ-Police-Shooting-Range-Manual-V4.01%20-%205%20Jun%202026.pdf>
- **ISSF:** *ISSF General Technical Rules*, Edition 2022 (first print 01/2023). <https://www.swissshooting.ch/media/o1edqrqq/20230619_issf_2023-technical_rules.pdf>
- **NRAWC:** NRA Whittington Center, *Quick Range Summary*, January 2025. <https://www.nrawc.org/media/4773/range-summary-and-general-rules-2025.pdf>
- **NSSA:** NSSA, *Skeet Basics*. <https://mynssa.nssa-nsca.org/skeet-basics/>

Every fact in this section is a reference fact.

### Firing line and lanes

- **Minimum lane widths** (UK-NRA 3-13-3):
  - rimfire rifle 1 m;
  - pistol or carbine 1 m with screens, 1.8 m without;
  - centrefire rifle 1.8 m;
  - plus 0.5 m of flank clearance.
- **ISSF firing points:**
  - 300 m: at least 1.60 × 2.50 m (6.4.8);
  - 50 m: at least 1.25 × 2.50 m (6.4.9);
  - 10 m: 1.00 m wide (6.4.10);
  - 25 m: 1.50 × 1.50 m for rapid fire, 1.00 × 1.50 m for other events (6.4.11.7).
  - 25 m ranges come in sections of two groups of five (6.4.11.3), roofed at least 2.20 m high (6.4.11.2).
- **Behind the line:**
  - A firing line is at least 2.5 m deep, so the range officer can work behind the shooters (NZ 3.42).
  - The safety officer must move freely behind the firers (UK-NRA 3-13-4 C).
  - A covered firing line is allowed (NZ 3.43).
  - Firing lines are set at right angles to the range axis (NZ 3.36).
- **Spectators** stand behind a barrier at least 7.0 m behind the firing line (ISSF 6.4.3.4).
- **Targets** (UK-NRA 2-7-4 D):
  - Centres are typically 0.45 to 1.5 m high.
  - Spacing follows the firer spacing.
  - Converging lines of fire are acceptable. Diverging lines are not normally used, because they enlarge the protective structures and the danger area.
- **Gallery ranges** (NZ 2.6; UK-NRA 4-8):
  - Firing lines are every 100 yd or m, up to 1000.
  - There are commonly up to 12 lanes, each 4 m wide.
  - There is a mantlet, a markers' gallery and a backstop.
  - The limited danger area runs 1,830 m behind the target line.

### Distances by discipline

- **ISSF distances:**
  - Ranges are 10, 25, 50 and 300 m.
  - Target heights are 1.40 m at 10 and 25 m, 0.75 m at 50 m and 3.00 m at 300 m.
  - Distance tolerances run from ±0.05 m at 10 m to ±1.00 m at 300 m (6.4.5.1).
  - Outdoor ranges should be open to the sky for at least 12.5 m of a 25 m range, 35 m of a 50 m range and 285 m of a 300 m range. Transverse baffles between the firing line and the targets are allowed (6.4.3.3).
- **Running target** (ISSF 6.4.15 and 6.4.16): a 10.00 m visible run at 50 m (2.00 m at 10 m), with 5.0 s and 2.5 s runs.
- **Whittington (NRAWC), pistol:**
  - 50 yd pistol range with gongs at 25, 40 and 55 yd;
  - Practical Police Combat 3 to 50 yd;
  - hunter pistol silhouette 40 to 100 m;
  - long-range pistol silhouette 50 to 200 m.
- **Whittington (NRAWC), rifle and general:**
  - multi-purpose bays 10 to 100 yd with movable frames;
  - sight-in at 25, 50, 100 and 200 yd;
  - small bore 25 to 100 yd;
  - High Power silhouette 200 to 500 m;
  - High Power 200 to 1000 yd with F-Class frames;
  - Cooper Rifle Walk 10 to 1500 yd;
  - STAR steel 50 to 600 yd, with plates 3 to 24 in;
  - black powder 25 to 100 yd.
- **Skeet:**
  - The field has a radius of 19.20 m and a chord of 36.80 m, with stations 8.13 m apart (ISSF 6.4.20.1).
  - Shotgun ranges face north to north-east in the northern hemisphere, with the sun behind the shooter (ISSF 6.4.17.1).
  - The high house is 10 ft and the low house 3.5 ft. Targets cross 15 ft above the centre (NSSA).

### Backstops, side berms and baffles

- **Backstop heights for no-danger-area ranges** (NZ Table 3.2):

  | | Pistol | Rifle |
  |---|---|---|
  | Height | 2.5, 3.0, 5.0, 7.0, 9 and 12 m at 10, 15, 25, 50, 75 and 100 m | 4.0, 5.0, 6.0 and 7.0 m at 25, 50, 75 and 100 m |
  | Flank extension | 1.0 to 3.0 m | 1.0 to 2.5 m |
  | Crest depth | at least 600 mm | at least 900 mm |

  The toe sits within 3.5 m of the target line.
- **Backstop construction** (NZ 3.12 and 3.13):
  - The face is at least 34°, and is restored if it falls below 30°.
  - Impact fill is at least 0.5 m for low velocity and 0.9 m for high velocity.
- **Bullet catchers** (NZ 3.21, 3.23 and 3.24): at least 2.5 m high and 0.5 m above the highest target. Mobile catchers serve targets away from the backstop.
- **Side berms** (NZ 3.26):
  - at least 2.1 m high;
  - a slope of at least 34°;
  - a crest of at least 600 mm;
  - continuous.
- **Side walls** (NZ 3.30 and 3.28): vertical and at least 2.1 m high. A side backstop that is shot into needs 2.5 m.
- **Baffle ranges** (NZ 2.7): timber cladding 25 to 50 mm thick on battens (NZ Table 3.7), and an "eyebrow" over the firing line (NZ 3.38).
- **Steel targets** (NZ 3.52 to 3.60): shot square-on, close to the backstop, rigid, leaning 15° forward, AR500-class plate.
- **Target lines:** intermediate target lines are allowed (NZ 3.48), and moving-target run limits are marked on the target line (NZ 3.50 and 3.51).

### Danger areas and the cliff

- **Ricochet** (NZ definitions; UK-NRA 2-2-25):
  - High velocity (over 2,148 ft/s): up to 30° off soft ground and 45° off rock, concrete and steel.
  - Low velocity: 15° and 45°.
- **Cones of fire** (NZ Table 3.1): pistol 23 mils (1.29°), outdoor rifle 20 mils (1.125°), small-bore 10 mils.
- **Range types** (UK-NRA 2-7-1): total energy, full danger area, limited danger area and no danger area.
- **Terrain backstop** (NZ 4.9; UK-NRA 2-2-14):
  - A slope of 56° or more lets the danger area stop at a contour at least 50 m above the highest target.
  - A slope of 30° to 56° needs 100 m.
  - Below 30° the rule does not apply.
  - The slope must span the full width of the danger template.
  - The UK rule measures the 50 m from the line of sight from the 100 m firing point.

### Walking routes

The safe routes are behind the line:

- the safety officer moves freely behind the firers (UK-NRA 3-13-4 C);
- the firing line is deep enough for the officer (NZ 3.42);
- spectators stand at least 7 m back (ISSF 6.4.3.4);
- an indoor range entrance is behind the rearmost firing point (UK-NRA 3-3-2).

## What every option shares

### Bays

| Bay | Lanes | Targets | Backstop | Activities | Basis |
|---|---|---|---|---|---|
| **Precision 25** (`p25`) | 10, in two groups of five | Paper carriers at 5, 7, 10, 15 and 25 m | 5.0 m; overhead baffles at 3.5, 8, 13 and 19 m; timber-clad side walls 3.0 m | Paper Gallery: round budget, zone scoring, grouping and string review; Era Tour pistol presets | Reference: ISSF 25 m sections and 2.20 m roof, NZ 5.0 m at 25 m. Game: carrier stops. |
| **Timed Sequences** (`ts`) | 8 | Pop-ups at 5, 10 and 15 m; a lit-shape arc of 12 shapes from 20 to 35 m | 6.0 m | Color Circuit, Pop-Up Garden; Rhythm Windows and Daily Remix later | Estimate: 6.0 m interpolated between NZ 5.0 m (25 m) and 7.0 m (50 m). |
| **Plate Yard** (`pl`) | 8 | Steel at 10, 15, 25, 40 and 50 m; near steel on mobile bullet catchers | 7.0 m | Plate Chorus, gong ladders 25 to 50 m; Carnival Stack later | Reference: Whittington gongs, NZ steel rules and pistol 7.0 m at 50 m. |
| **Long Field** (`lf`) | 12 | Per-lane pop-ups 50 to 250 m, steel at 300 m, gongs on the Steps at 400, 500, 600, 800 and 1000 m | Side berms 4.5 m to 300 m; the cliff is the final backstop | Long-field sequences, steel ladders, magnified electronic review | Reference: gallery range layout, terrain backstop rule. Game: targets enlarged beyond 300 m. |
| **Precision 100** (`p100`) | 12 | Carriers at 25 and 50 m, fixed frames at 100 m | 7.0 m; earth side berms 4 m | Zeroing at 25, 50 and 100 m, rifle paper, grouping review | Reference: ISSF 50 m points, Whittington sight-in, NZ rifle 7.0 m at 100 m. |
| **Custom Practice** (`cu`) | 8 | Movable frame anchors every 5 to 25 m, out to 100 m | 7.0 m | Custom presets (skin, size, placement, motion, sequence, scoring), Station Passport, Daily Remix | Reference: Whittington multi-purpose bays. Game: pistol presets capped at 50 m, because NZ asks 12 m of backstop for pistol at 100 m. |
| **Heritage Butts** (`hb`) | 8 | Frames at 50 m; butts at 100 m with a stone mantlet and markers' gallery | 7.0 m stop butt | Era Tour (muskets and early rifles), marker-style review | Reference: gallery range anatomy (UK-NRA 4-8, NZ 2.6). Game: the only working butts. |
| **Moving Targets** (`mv`) | 6 | Turning targets at 10 and 15 m; crossing rail at 25 m; running-target wall at 50 m with two 10.00 m openings | 7.0 m | Rail Parade, running-target runs, turning cards | Reference: ISSF running target. Game: one opening serves three lanes. |

The Steps' tops are 1.4, 2.9, 4.9, 9.1 and 14.7 m (game), tuned so that each terrace sits higher on screen than the one before. A skeet field to ISSF geometry is reserved west of the campus in every option. It is not part of this programme. Its facing is not settled: the reserved pads face north-west, away from the bays, while ISSF prefers north to north-east with the sun behind the shooter.

### Player-scale cross-section

| Item | Value | Label |
|---|---|---|
| Lane pitch | 2.6 m, the Range 01 canopy module spacing. That is 5.9 player-capsule widths, and above the 1.0 to 1.8 m minimum lane widths. | Game |
| Firing line to the rear of the booth zone | 3.0 m (NZ asks at least 2.5 m) | Game |
| Concourse | 6.0 m wide | Game |
| Rack wall face | 9.0 m behind the firing line, so the guns are behind every booth. The ISSF barrier distance is at least 7.0 m. | Game |
| Rack depth | 0.6 m. The Range 01 collection bay is 0.525 m deep. | Game and Range 01 |
| Canopy | Front edge 0.8 m ahead of the line; underside 2.82 m and top 3.08 m are Range 01 values | Estimate and Range 01 |
| Canopy cut-off above eye level | 36° at the booth, 9.2° mid-concourse, 6.8° at the rack wall | Estimate |
| Player | Eye 1.72 m, capsule radius 0.22 m, walk 2.6 m/s, run 4.5 m/s, maximum step 0.35 m, maximum slope 45° | Holodeck, read from code |
| Camera | 63° vertical field of view, about 15.4 px per degree at the centre of a 1080p frame | Holodeck `src/world/app.jsx`, read from code |

### Site and cliff

All site values are game choices:

- **Cliff:** 1150 m north of the Long Field line. The face is 185 m high, at about 80°.
- **Crown:** 225 m, on the main axis.
- **Apron:** sand and scree, 60 m deep and 40 m high.
- **Flanks:** ridges 60 to 120 m high close the basin.

**Terrain backstop test** (reference rule). The face is steeper than 56°. Its top stands 170 m above the highest target (the 1000 m gong top, 14.7 m), against the 50 m required. It spans the whole danger trace.

**How the cliff reads** (estimate):

- From every booth the cliff stands above that bay's own backstop crest. The crests sit 2.7° to 5.3° above eye level; the face top is about 9° and the crown about 11°.
- At 1080p, the crown sits about 170 px above the centre of the frame.
- The booth canopy frames the cliff. From the rear of the concourse its edge hides the upper face. The crown rises into view under the edge about 4.9 m behind the firing line (5.2 m on C's balcony).
- If Precision 25's baffles follow the no-blue-sky principle, its booths will not see the cliff at all. That would make it the one enclosed bay. This is a choice for the blockout.

**Danger trace** (illustrative):

- The trace uses 30° high-velocity ricochet edges from the outermost lanes. Every lane, and both outer ricochet edges, ends in rock.
- The Long Field cone of fire is 1.125°.
- This is a game representation, not an engineered danger area.
- All public routes stay behind the firing lines.

### Checks run on every option

All checks pass on all three options. Results are in each JSON's `checks` block and in `range-layout-v1-validation.json`.

- Bay fields clear of each other by 1 m, to 320 m.
- Every lane ends in rock.
- Both outer 30° ricochet edges end in rock.
- The rack wall is at least 7 m behind the line.
- The firing line is at least 2.5 m deep.
- Backstops follow the NZ table.
- The cliff passes the terrain backstop rule.
- The cliff shows above each bay's backstop.
- IDs are unique.
- Every drawn sightline is clear of buildings, towers, booth canopies and backstop berms, sampled every 0.25 m.
  - This check caught three faults in the first draft, which are now fixed. The crown was hidden by the booth canopy from A's and B's portals, and by A's Gate Hall from the original arrival point. The head of the Shaft blocked C's Lookout.

## Option A: Grand Line

**Idea.**
- All eight bays stand side by side on one straight firing line, about 300 m long.
- Every lane is parallel and aimed north at the cliff.
- The Armory sits on the Long Field axis. The Gate Hall portal is the reveal.

**Flow from arrival to the booths.**
1. The player arrives in the forecourt with the crown standing above the Gate Hall: 10.0° against the hall's 8.5°.
2. Closer in, the 12 m hall hides the crown.
3. Through the portal, the Long Field opens under the canopy edge, down to the 1000 m gongs.
4. Crossing the concourse, the full cliff and crown rise into view.
5. The pistol wing runs west and the rifle wing east, along one 6 m concourse. The rack wall runs behind every booth.

End towers (20 m) and the bay heads beside the Long Field climb to a roof deck at +6 m over the Armory.

**Bays.**
- West to east: Precision 25, Timed Sequences, Plate Yard, Long Field, Precision 100, Custom Practice, Heritage Butts, Moving Targets.
- Pistol bays sit west of the Long Field and rifle bays east.
- Bays are separated by 8 m, with 12 m around the Long Field.
- The Long Field floor is sunk 3 m from 20 to 300 m, so its berms read low from the line.

**Sightlines and landmarks.**
- The crown above the Gate Hall on arrival.
- The portal under the canopy edge to the 1000 m gongs, at 0.8°.
- The crown from the front of the concourse, at 11.0°.
- From the roof deck over the Steps, at 0.45°.
- Both end towers seen along the concourse.
- Landmarks: the Crown, the Steps, Heritage Butts, the running wall, the two end towers and the Gate Hall.

**How the cliff reads.** The cliff is dead ahead on the main axis, and every lane points at it. From the Long Field booth, the face top is 9.1° above eye level and the crown 11.0°.

**Player-scale check.**
- The farthest booth is 276 m from arrival: 106 s at a walk, 61 s running.
- The rack wall is 305 m long. Net of the portal, that is room for 118 rack bays of 2.5 m against the 60-gun catalogue.
- Long Field bands sit at −2.2° (100 m), −0.7° (300 m) and +0.80° (1000 m). The 100 to 1000 m spread is 3.0°, about 46 px at 1080p, so the far field is a thin band near the horizon.

**Strengths.**
- It is the most conventional real layout: one line, parallel lanes, one continuous safe route behind it.
- It is the cheapest to block out, using straight repeats of the Range 01 canopy, booth and rack modules.
- It has one continuous rack wall.

**Risks.**
- The walks along a 300 m line are long, and the view repeats bay after bay.
- Verticality is limited to the roof deck, and there is one reveal.
- It is the closest in spirit to the earlier banks-in-a-row blueprint.

## Option B: Canyon Fan

**Idea.**
- The firing line is a polygon around a 30 m gate tower.
- Lanes stay parallel within each bay, but the bays diverge: from 42.9° west of north (Precision 25) to 59.3° east (Moving Targets).
- The ground between the bays widens into sandstone fins that serve as side berms.
- A horseshoe canyon wall, 160 to 225 m high, closes every bay's danger area.

**Flow from arrival to the booths.**
1. The player arrives at the canyon mouth, facing the gate tower (26° up from the forecourt).
2. Past the tower, eight avenues of 110 m each fan out across the Fan Court. Each avenue frames its own bay and the canyon wall beyond it.
3. Each avenue ends at a portal in the Armory ring.
4. Through the portal is the curved concourse, with the rack wall behind and the bay opening ahead as a slot between fins.

The ring deck (+6 m) and the tower look over all eight bays.

**Bays.** The order is the same as A, set around the fan. The Long Field is on the main axis, its floor sunk 3 m as in A.

**Sightlines and landmarks.**
- From the gate tower down the main avenue to the crown (10.0°).
- The crown from the front of the Long Field concourse (11.0°).
- Each outer bay's slot ends on its own canyon wall: Precision 25 at 8.4°, Moving Targets at 9.6°.
- Landmarks: the Crown, the gate tower, the Steps, the sandstone fins, Heritage Butts and the running wall.

**How the cliff reads.** Only the Long Field faces the crown. The other bays each face their own part of the horseshoe. From the booths, the face tops sit 8.6° to 9.0° up.

**Player-scale check.**
- This is the shortest arrival: the farthest booth is 208 m, 80 s at a walk and 46 s running. Every bay is the same 110 m avenue from the tower.
- The rack wall is 249 m, or 197 m net of eight portals: room for 78 rack bays of 2.5 m.
- The Long Field bands are the same as A: a 3.0° spread, about 46 px.

**Strengths.**
- It is the most distinctive plan. Each bay has its own slot, light and canyon view.
- The avenues are self-explaining wayfinding.
- The fins are real side berms and strong landforms.

**Risks.**
- The bays diverge by up to 60° from north. Real practice avoids diverging lines of fire because they enlarge protective structures and danger areas (UK-NRA 2-7-4 D). Here the horseshoe canyon has to wrap the whole site. The outer ricochet edges reach rock at 676 m and 556 m, inside the canyon.
- Sun angle varies from bay to bay.
- The wedge joints and the polygonal concourse and roof need new corner modules.
- The Fan Court is a large area to dress.

## Option C: Escarpment Terraces (recommended)

**Idea.** The campus is cut into the basin's south escarpment, on three levels:

| Level | Height | What is there |
|---|---|---|
| L3 | +24 m | Mesa-top arrival, the Chronology Hall and the Lookout |
| L2 | +12 m | The Long Field balcony, with its own concourse and rack wall |
| L1 | grade | The pistol and rifle wings, joined at grade by the Undercroft beneath the balcony, so the L1 rack wall runs unbroken from end to end |

Each wing bay is turned 2.3° to 7.7° to aim at the crown. Converging lines of fire are acceptable (UK-NRA 2-7-4 D), and each firing line stays at right angles to its own axis.

**Flow from arrival to the booths.**
1. The player arrives on the mesa, walks through the Chronology Hall and out onto the Lookout. The whole basin is in one view: both wings below (−10.8° and −8.3°), the Long Field, the Steps and the crown (9.5°).
2. The Shaft descends to the Long Field balcony at +12 m.
3. Bridges at L3 lead to two stair towers that descend to the wings at grade.

**Bays.** The order is the same as A, at grade except the Long Field. Its booths sit on the balcony 12 m above the basin floor, and its targets stand on the floor.

**Sightlines and landmarks.**
- From the Lookout to the crown, and down into each wing.
- From the balcony over the Steps (0.11°).
- Every wing bay aims at the crown (10.9° from the Moving Targets booth).
- Landmarks: the Crown, the Lookout, the balcony, the Shaft and stair towers, the Steps and Heritage Butts.

**How the cliff reads.** The Lookout is the only viewpoint in any option that shows the whole range at once: the basin floor, both wings, the Long Field and the cliff. From the balcony the face top is 8.5° up and the crown 10.4°. The crown rises under the canopy edge 5.2 m behind the line. From the wings, the face top is 9.05°.

**Player-scale check.**
- This is the longest arrival: the farthest booth is 318 m, 122 s at a walk and 71 s running.
  - That includes about 24 m of descent by stair: 150 risers of 0.16 m.
  - The extra path for flights and landings is an estimate, about 46 m.
  - Holodeck cannot move walkable colliders, so the browser host has no lifts.
- The rack wall is 350 m across L1 and L2: room for 139 rack bays of 2.5 m.
- From the balcony the Long Field bands sit at −7.3° (100 m), −2.4° (300 m) and +0.11° (1000 m). The 100 to 1000 m spread is 7.4°, about 113 px at 1080p, 2.5 times A and B, so the distance bands separate on screen.
- The balcony gives a depressed line of fire. The UK handbook allows depressed lines (2-7-4 D). The blockout should still check the near targets and the side berms from 12 m up.

**Strengths.**
- It has every AAA beat in the brief: arrival from above, a reveal, landmarks, strong sightlines and three levels.
- The elevated Long Field reads its distances far better than a flat line.
- It keeps A's proper parallel layout at grade.

**Risks.**
- It has the longest arrival, with stairs.
- It needs the most terrain to build: the escarpment, terraces, towers, the Shaft and the balcony.
- The rack wall splits across two levels.

## Comparison

| | A. Grand Line | B. Canyon Fan | C. Escarpment Terraces |
|---|---|---|---|
| Levels | Grade, roof deck +6 m, end towers | Grade, ring deck +6 m, 30 m gate tower | L1 grade, L2 balcony +12 m, L3 mesa and Lookout +24 m |
| The reveal | Gate Hall portal; the crown rises under the canopy at the booths | Gate tower with eight avenues | The Lookout over the whole basin |
| Arrival to farthest booth | 276 m (106 s walk, 61 s run) | 208 m (80 s, 46 s) | 318 m (122 s, 71 s), stairs included |
| Concourse; rack wall | 305 m; 305 m (118 rack bays) | 255 m; 249 m (78 rack bays) | 363 m; 350 m (139 rack bays), on two levels |
| Cliff from the Long Field | face 9.1°, crown 11.0° | face 9.1°, crown 11.0° | face 8.5°, crown 10.4° |
| Long Field bands, 100 to 1000 m | 3.0° (about 46 px) | 3.0° (about 46 px) | 7.4° (about 113 px) |
| Lines of fire | Parallel | Diverging by bay | Converging slightly on the crown |
| Build effort (estimate) | Lowest: straight repeats of Range 01 modules | Medium to high: corner modules, horseshoe canyon | Highest: escarpment, terraces, towers, Shaft and balcony |
| Main risk | Monotony and long walks along one line | Diverging bays and custom joints | Long arrival and the most terrain |

## Recommendation

**Option C, Escarpment Terraces.**

- It keeps the properly laid out range of A: parallel lanes at grade, real backstop and berm sizes, and one continuous safe route with the rack wall behind every booth.
- It adds what the owner asked for beyond A: arrival from above, a single great reveal from the Lookout, landmarks at every level, and real verticality.
- Its elevated Long Field gives the long distances a visible depth that A and B cannot.
- Its costs are the walk and the terrain. The layout proof should time the stairs and the walk in the browser host before any art is committed.

**Fallback: Option A**, if build cost and speed matter most.

Option B is the most striking plan, but it fights normal range practice on diverging lines of fire, and needs the most custom architecture.

## Decision

**Chosen: Option C, Escarpment Terraces.** The owner chose it on 27 October 2026 through the question tool, after reviewing the comparison sheet and the three option sheets. It was the recommended option.

- **Layout of record:** `handoff/design/firearms-through-time/blueprints/range-layout-v1-option-c.json`, with its sheet `range-layout-v1-option-c.png`.
- **IDs:** the blockout should keep the stable IDs from this JSON.
- **Options A and B:** kept as the record of the alternatives considered. They are not to be built.
- **Points for the layout proof to test:**
  - the walk and stair times in the browser host;
  - the balcony's depressed line of fire over the near Long Field targets and side berms;
  - whether Precision 25's baffles hide the cliff;
  - the skeet pad's facing, if it is ever approved.

**Next stage:** a layout proof (blockout) of the chosen plan, built as its own world so the playable Range 01 slice keeps working. It should have desert terrain, the cliff, walkable routes and player-eye checks ([roadmap v13](roadmap-v13.md)).
