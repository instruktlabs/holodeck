# Medieval Castle: mountain-pass fortress (in progress)

**In progress.** This is the current castle: an earlier blockout pass that its
owner judged not final quality. A rebuild is underway, and this bundle will be
replaced when it lands. Treat the layout, proportions and art as provisional.

A fortress holding a mountain pass, composed in Holodeck from Kiln assets. A
bridge crosses a gorge to an open gate, a walled lower courtyard, a stair up to a
wall ballista and an inner barricade. The scene is the source revision 10 of the
castle world, projected into the portable [example bundle](../../docs/example-world-bundles.md)
format at revision zero. It pairs with the native Unity slice in
[medieval-castle-unity](../medieval-castle-unity/), which imports the same layout.

## What it demonstrates

- **Stamped heightfield terrain.** A 150 × 145-cell heightfield over
  150 m × 145 m, shaped by five ordered stamps: a flattened gorge, flattened
  courtyard and approach plateaus, and raised north and east ridges. Walls,
  cliff supports, trees and ground cover sit on that terrain. It uses no sampled
  heightmap file and no terrain layer textures.
- **A modular kit.** Walls, bridge spans, courtyard paving and stair flights are
  shared blockout modules reused across placements: 15 wall, 6 bridge and 4
  courtyard placements, plus 10 cliff supports, 5 oaks and 18 ground-cover clumps.
- **The maker on terrain.** First-person walking with box collision
  (`collision.boxes@1`, `camera.walk-orbit@1`, `inhabitant.maker@1`,
  `terrain.heightfield@1`), with the modular cove and an empty World board at the
  origin.

## Open it

From the source checkout:

```sh
node bin/holodeck.mjs init ../my-castle --example medieval-castle
node bin/holodeck.mjs check ../my-castle
node bin/holodeck.mjs dev ../my-castle --port 4195
```

Open /prototype.html on that port and choose **Enter world**. You start on the
approach south of the bridge. The authored route crosses the bridge, passes the
gate and climbs the courtyard stair to the ballista platform. The example also
appears under **Start from an example** in the world picker.

## Measured and not measured

Counted from the bundle files: 23 assets, 81 placements (7 of them built-in
shapes), 6.9 MB of GLBs and 105,722 placed source triangles, within the schema-v2
limits. `holodeck check` validates the installed world and its hashes.

Not measured for this revision in Holodeck: frame time, visual quality on
either renderer backend, and walking the full route. There is no runtime preview
image yet; a generated concept is not a substitute. The Unity slice's technical
smoke results belong to that project and do not qualify this scene.

## Content and licensing

The scene data, manifest and GLBs are CC0 1.0, as set out in
[LICENSING.md](../../LICENSING.md). Every GLB is Kiln-authored procedural
geometry:

- the cove, lamp, planting, rug, seating, hearth, canopy and World board are the
  bundled Cove modules, byte-identical to those under `public/assets/`;
- the castle and slice modules (gate, wall, wall corner, bridge, court, landing,
  stair flights, mantlet, barricade, ballista, cliff support, oak and ground
  cover) are untextured blockouts from native Kiln programs, with no external
  meshes or textures.

Kiln asset and revision IDs remain in the world for provenance. The original
`.kiln` programs, reference images, design notes and review material are not
part of the bundle.
