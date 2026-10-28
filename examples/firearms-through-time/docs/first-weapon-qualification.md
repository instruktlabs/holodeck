# First weapon and skinned hands

This is the initial checkpoint. For the current materials, 25,568-triangle hands,
forearm weights and shared reload timeline, read [the v2 refinement](weapon-refinement-v2.md).

The first local weapon loop is an original 1911-style exterior and two gloved
hands. It is a playable prototype, not a museum reconstruction or AAA art signoff.
The prior collection bay, booth console and turning target remain the test space.

## Playing

Run `pipeline/start-weapon-holodeck.ps1`, then open
http://127.0.0.1:4202/prototype.html?backend=webgpu. Enter world in first person.
I inspects, Q toggles aim, F fires, R reloads, C changes grip appearance. The
workbench also provides buttons; a browser without mouse lock can use arrow keys
to look. Native uses the same keys plus left/right mouse for fire/aim. Native B
resets the booth target, leaving R exclusively for reload in this map.

Unreal's separate map is `/Game/Qualification/WeaponLab`. Launch it with
`pipeline/play-weapon-lab.ps1` after packaging. Existing RangeSliceLab and case
maps remain separate. The range's previous R reset behavior remains in that map.

## Asset and state contracts

`game/asset-pins.json` contains exact saved Kiln revisions and SHA-256 values.
The browser hashes both GLBs before parsing and fails visibly on a mismatch.
`game/attachment-contract.json` distinguishes hand contacts, effect origins,
moving parts and compatible mounts. The current compatible options are walnut
and charcoal appearances on the same grip panel geometry. An optic attachment is
rejected: the first model has no authored optic mount. Era membership does not
grant compatibility.

The pistol has 4,080 delivered triangles and 72 mesh nodes. The gloves have 7,080
triangles, one skinned mesh and 33 named bones: shared root, two wrists, and three
bones per finger. Weights interpolate between adjacent finger bones. The source
is editable in `authoring/first-pistol.kiln.js` and `authoring/first-hands.kiln.js`.
The Three exporter is explicitly selected only in these authoring commands,
because the established exporter does not deliver skinning.

Game rules live in `game/weapon.mjs`: cooldown, ammunition, inspect exclusivity,
reload completion and compatible attachments. Reload commits ammunition once at
completion, not on a render-frame animation event. Pose output drives the slide,
magazine, support wrist and index finger. Hits use the actual oriented target
plane and bounded extents, not an unconditional hit flag. Values are prototype
game tuning, with no ballistic or real firearm operating model.

Holodeck's project-owned `weapon-extension.jsx` loads the rig explicitly. The
generic host hook is opt-in through `HOLODECK_CLIENT_EXTENSION`; other launches
use a no-op module. The adapter additionally checks this project's three object
IDs, ignores author/third-person/paused input, and removes its UI/listeners when
unmounted. Static-world GLB admission still rejects skinning. The rig has not been
flattened or smuggled through that contract. Current static world export does not
package the extension; this is a local development integration, not a published
Kiln plugin.

Unreal imports the same master as a SkeletalMesh. `AWeaponLoop` drives its actual
UPoseableMeshComponent and uses the same state/pose rules in C++. Native state
must remain authoritative; the viewmodel does not own world simulation. The
current JS/C++ rules are duplicated and tested, not automatically generated from
one shared implementation. Packaging and rendered scenario checks qualify that
duplication for this slice only.

## Evidence and obstacles

- `evidence/weapon-editor-result.json`: 19 rendered native checks passed on the
  initial skin. The final packaged receipt is the authority for the refined skin.
- `evidence/weapon-packaged-result.json`: all 19 checks passed on the final skin
  in the standalone Windows package. No material fallback warnings were found.
  Executable SHA-256: `5259e240ce58f9b1bb56915a426e020ef7b354881b2d81d976ad718cc825b340`.
- `evidence/weapon-hands-reimport.json`: refined skin imported with all 33 names,
  source hash and native grip parameter verified.
- `evidence/range-slice-post-weapon-result.json`: all 14 earlier native range
  checks still pass with the new module; no material fallback warnings.
- `evidence/weapon-holodeck-runtime-tests.log`: all 347 host runtime tests passed.
  Three client-extension configuration tests and six weapon-rule tests also pass.
- Browser screenshots and full accessibility receipts use `weapon-holodeck-*`
  and `weapon-webgl-*`. They distinguish active reload from its completed state.
- Bone semantic roles must be lowercase; the helper rejected uppercase roles.
- Zero-weight index lanes should use joint index zero. Fixing those lanes removed
  hundreds of glTF validator warnings. One non-root skinned-node warning remains;
  its parent is identity, and actual consumer skin/deformation checks are required.
- Generic AssetSubsystem map duplication followed by load caused a world-lifetime
  error. `new_level_from_template` is the supported fixture construction path.
- Unreal sanitizes decimal dots in imported mesh names. The importer adapter
  normalizes those names when mapping static nodes to moving-part groups.
- A missing newly generated module can remain cached by Vite outside its root.
  Finish generating pins before starting the extension host; the restart helper
  checks its exact recorded process before restarting only that host.
- Initial reload framing hid the magazine. Raising the viewmodel exposed the
  support-hand motion. Cuff geometry was added to close a visible wrist gap.

## Reusable extension candidates and next art work

Extract a pinned skinned-asset loader, semantic rig/anchor validator, static-node
import name mapping, attachment compatibility manifest, pose-driver adapter,
native scenario runner and screenshot comparison recipe. Keep ammunition and
firearm rules in the game project. Keep native material overrides outside the
generated source material ownership boundary.

Before a public extension, add lifecycle/error isolation, a versioned manifest,
export support, generated cross-engine conformance fixtures and install tests.
Before AAA visual qualification, replace the glove forms with sculpted anatomy,
refined finger contacts and retargetable animation; add authored reload clips/IK,
proper cloth/leather detail, close-up metal and wood texture work, audio/VFX,
viewmodel wall avoidance, LOD/performance qualification and multiple-camera art
review. Current inspect/reload are procedural poses, not baked animation clips.
The first model exposes compatibility without pretending every historic weapon
accepts every attachment. Full-body character work follows this hand/contact loop.

Reference for visual/historical direction: the US Navy museum's
[Moitoret M1911A1 entry](https://www.history.navy.mil/our-collections/artifacts/arms-and-ordnance/small-arms/handguns/45-caliber-M1911A1-pistol-Moitoret.html).
The original geometry is not a dimensional replica of that object.
