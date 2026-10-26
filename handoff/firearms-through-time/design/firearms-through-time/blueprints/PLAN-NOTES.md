# Range campus spatial study

This proposal puts the range on one side and a continuous gun wall through the ages on the other, within one environment. A shared concourse lets the player browse an exhibit, choose a configuration, walk to a station and return to the exhibition without a scene transition.

The first option shows six banks of eight stations, plus 60 collection slots. These are adjustable counts. Target markers illustrate distribution only: they are not final layouts or obstruction-tested placements. The six banks establish visual variety; configuration presets can change activity without requiring another physical lane. The historical modules are display groups, not validated dates or classifications. Artwork and exact exhibit assignments are later content decisions.

`layout.json` is the source. Run `python build_blueprint.py` from this directory (or invoke it by path) to regenerate `range-campus-01.svg`, `placements.json` and `validation.json`. The generator needs only Python's standard library. The SVG is the review output; editing it directly will not update the source layout and regeneration will replace those edits. Edit the generator for drawing style and the JSON for supported dimensions/counts.

The plan uses a uniform drawing scale; the wall diagram at right is a schematic elevation. X is across the banks, Y is downrange and Z is up. Adapters must convert this declared frame to Kiln/Holodeck/engine coordinates explicitly. The generated placement format is proposed interchange data, not valid current Holodeck world JSON.

Validation checks unique IDs, finite/bounded coordinates, station-to-lane alignment, bank fit, zone continuity and SVG XML. It does not prove 3D sightlines, walking clearance, collision behavior, performance or design approval.

Next layout review: preferred station count; bank activity mix; gallery depth and browsing alcoves; entrance/return routes; seating; artwork scale; configurable console placement. Expand the activity set from RANGE-ACTIVITY-RESEARCH.md after choosing the first playable modes.

## Revision 02 — side stairs and upper deck

The current JSON reserves west/east side stairs and a deck above the booth canopy. Gold marks on the SVG identify access and the upper deck line. Elevation 4.2 and stair extents are provisional virtual dimensions. This is a viewing promenade reached from the same concourse. The current checks validate reservation coordinates, not tread/landing geometry or continuous traversal. Build those explicitly and test both directions.
