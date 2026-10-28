# Preview-to-game checks

Keep rule tests, destination geometry, actual control paths and rendered play as
separate checks. A small engine-independent simulation can test victory, loss,
restart, population limits and supply costs without starting an Editor. Compile
against cached references only as a preflight; it does not run Unity serializers,
importers, analyzers, physics or input devices.

This Unity version's `JsonUtility` produced an empty nested collider object from
an explicit JSON null. The slice delivery adapter therefore writes a tagged
`type: none` record for absent collision, while Holodeck retains its own null
contract. Reject missing or unknown collider tags instead of silently treating
them as nonblocking geometry. Check destination deserialization with an actual
Editor import before multiplying the bundle.

Match the active input backend to the runtime APIs. The playable adapter used
`Keyboard.current` and `Mouse.current` while the historical project enabled only
legacy input. Pure model tests and direct method calls did not expose that gap.
The current example enables Both. Device presence is a prerequisite, not proof
of actual keyboard/mouse events or comfortable controls.

A meaningful slice smoke walks the real controller through the approach, stairs
and return route, mounts the nearby defense, aims the camera at a visible target,
and checks the crosshair ray, muzzle obstruction, damage and reload state. Later
autoplay shots can prove the bounded encounter is winnable, but must be labeled
as autoplay. Test an unattended loss and a fresh restart too. A RenderTexture
capture excludes OnGUI overlays; assess interface usability separately.

Let mounting take ownership of the weapon. An automatic crew that spends the
shared cooldown before manual input can make a supposedly faster manual mode
ineffective. Keep the HUD's ownership state consistent with the actual controller.

Check host memory at job dispatch, not only during planning. Apply the workspace's
existing admission threshold and use one low-priority job when sharing a host.
A leftover lock filename after an Editor failure is not proof of a live Editor;
check the owning project process and exclusive file lock before recovery. Never
borrow or terminate another project's Editor. Keep restored pipeline bytes and
input hashes in the private build receipt.
# Cross-host render settings

Copy the render-pipeline asset, renderer, global settings and default volume
profile together with their `.meta` files and `ProjectSettings`. A matching path
does not mean a matching GUID: independently generated hub assets can occupy the
same path while canonical settings resolve to nothing. Run
`Tools/validate_render_settings.py` before launching the Editor. Keep a receipt
of any deliberate GUID replacement and retain the previous source snapshot.
During an Editor migration, distinguish upgraded serialization from temporary
build-only shadow overrides; restore the overrides and archive the migrated
asset before an outer interruption-safety runner restores the original bytes.

## Floor ownership and candidate composition

When shared terrain and modular paving occupy the same site, designate one
visible and traversable owner per footprint. Compare actual exported terrain
triangles against transformed floor triangles, not only heightfield vertices or
route rays. A triangle can cross a court even when its vertices are outside it.
Remove the covered terrain surface or recess it with explicit clearance; retain
foundations at exposed edges. Recheck collision height and grounded landings in
both traversal directions. Do not hide authored coplanarity with shader bias.

For a rebuilt fortress, deeper water requires correspondingly supported piers,
abutments and retaining walls. A proposed tiered ward needs a connected ascent,
not a floating keep backdrop. Review the same candidate's overview, bridge
approach, court eye level and terrain/floor edge views after the numerical gates.
Keep fortress hierarchy, site integration, circulation, construction and dressing
as separate visual criteria. Extra props cannot repair failed terrain massing.

Record candidate source/bundle hashes and approval state. A prior scene's native
smoke, a newly generated reference image or a successful import does not approve
the replacement composition. Terrain appearance needs its own material/layer
transfer evidence; matching terrain geometry does not establish visual parity.

