# Fresh worlds and runtime examples

`init <new-folder>` starts an empty grid construct with the current modular cove,
the maker in first person, overview camera, and cove collision. `--example construct` selects the
same starter explicitly. Its origin blockers cover the current shell's seat and
back; the board retains the starter placement. All disappear with the cove.

Tidemark Island (`tidemark`) is a bundled scene with sandy terrain, shoreline
water, jungle vegetation, articulated patrols and flying boid flocks. Select it
under **Start from an example** in the [world picker](world-library.md), or use
the CLI below. Each copy has its own name, saved revisions and local agent session.

Winter Mountainside Cabin (`winter-mountainside-cabin`) is a snowy conifer
mountainside at dusk with a trailhead, woodland loop and lake viewpoint, and a
furnished two-storey timber cabin with a sleeping loft, deck and hinged doors.

The bundle contains the editable world document, exact pinned GLBs and curated
public bible guidance. Its physical mood board starts empty. You can change
placements, terrain, lighting and supported behavior, or replace an asset with a
new delivery. Original procedural asset sources, reference attachments and agent
history are excluded; the GLBs are not the original Kiln source programs.

Courtyard and kinetic remain smaller architectural fixtures. Like the Cove,
both walk as the maker on flat, box-collided ground (no terrain). The cove uses its
existing Kiln-authored modules. The courtyard has procedural atlas foliage, wind
and textured surfaces; its paths, architecture and mechanisms use built-in shapes.
Replace a shape with an asset-backed placement while retaining its ID and behavior.

From the source checkout:

```sh
node bin/holodeck.mjs init ../my-world
node bin/holodeck.mjs check ../my-world
node bin/holodeck.mjs dev ../my-world --port 4189
node bin/holodeck.mjs init ../my-island --example tidemark
node bin/holodeck.mjs dev ../my-island --port 4192
node bin/holodeck.mjs init ../my-cabin --example winter-mountainside-cabin
node bin/holodeck.mjs dev ../my-cabin --port 4193
node bin/holodeck.mjs init ../my-courtyard --example courtyard
node bin/holodeck.mjs check ../my-courtyard
node bin/holodeck.mjs dev ../my-courtyard --port 4190
node bin/holodeck.mjs init ../my-gallery --example kinetic
node bin/holodeck.mjs dev ../my-gallery --port 4191
```

Open /prototype.html on the chosen port. Init requires a new folder; it never
merges over existing work. Built-in templates copy their cove deliveries and
source, example data and Holodeck skills. Bundled examples copy their verified
scene and GLB deliveries, public guidance and skills, with an example receipt.
Agent connection retains the existing Kiln setup workflow.

- Tidemark Island: Enter world to explore the beach and jungle. Maker possession
  supports first/third person, walking, running, jumping and swimming. Free camera
  lets you inspect the scene. Patrol joints and flock wings use procedural gait.
- Winter Mountainside Cabin: Enter world at the trailhead and follow the trail
  markers up to the cabin. Press E near a door to open it; the interior stair
  leads to the loft, and the return path passes the lake viewpoint seat.
- Courtyard: Enter world, approach and aim at the garden gate, then press E to
  open/close it within 3.5 metres of its current bounds. Follow the path to the basin.
- Kinetic exhibit: independently Start / stop nearby mechanisms, pause/resume
  everything or Reset activity. Those actions do not modify saved layout.
- All: WASD walking, mouse lock when supported, right-drag look as a fallback.
  Enter opens the message box without leaving the world, and Escape from it
  returns to walking. Escape while walking returns to authoring; H hides all
  remaining HUD while inhabiting.
  Overlook provides right-drag orbit and wheel
  zoom. Hide/recall the cove. Scene, bible, board and undo use the shared host.
  No agent inference is needed to explore.

Authoring selection uses click/F and Shift to add references. It is separate
from E interaction. See [selection and inhabiting](selection-and-inhabiting.md).

The proof scope covers asset identity, placement/collider agreement, origin
visibility, camera ownership, activity reset, capability rejection, failed loads,
undo and reopening. Both renderer backends require their own observations.
The courtyard and kinetic fixture checks do not qualify Tidemark's art, terrain,
gait or performance; those need their own runtime review. Articulated gait uses
named rigid joints rather than embedded GLB animation clips or skeletal skinning.
General physics, guided tours, XR, plugin loading and distance LOD remain outside
the current implementation. Bundled examples are CC0; runtime code is MIT.
See [licensing](../LICENSING.md).
