# Authored hand clips and contact refinement, 2026-10-26

The first weapon fixture now uses exported skeletal animation in both consumers.
This is a functional animation and contact pass on prototype art. It is not AAA
art acceptance, an anatomical scan, or a finished production character rig.

## What changed

The hands retain 33 bone identities and one skinned mesh. Palm volumes now taper
at the heel, with a fuller thumb base and distinct finger lengths. MCP/PIP/DIP
bone centers sit along each curved finger rather than ending the third joint at
the fingertip. Skin weights blend around those joint centers. The right index
rests along the frame; the support hand wraps outside the primary hand.

Four actual clips travel in the GLB: Ready (1 second, static neutral pose),
Reload (3.2 seconds), Inspect (3.6 seconds) and Fire (0.22 seconds). Reload releases
the support grip, reaches the magazine, closes the fingers, withdraws, exchanges
below view, inserts, seats, releases, and regrips. Inspect releases the support
hand and holds both sides of the weapon before returning. The clips contain
33 rotation channels and two wrist translation channels each, with explicit
neutral endpoints. Reload/inspect are sampled at 60 Hz with linear glTF keys;
quintic easing is baked into the values. Fire uses 14 equal intervals over .22s.

The initial reload export still left the fingers spread around the magazine.
Assembled browser captures exposed this; an additional immutable revision adds
a separate three-joint grasp curl, blended independently from open-hand release.
The final revision is in `game/asset-pins.json`; earlier v3 captures without
`final` in their filenames can show the rejected open-finger draft.

The hand mesh has 25,544 triangles and three embedded PBR maps. Pistol geometry,
its 72 moving/static parts, attachment anchors and PBR delivery are unchanged.
The charcoal grip option still updates the 32 existing grip material bindings.

## Boundaries suitable for the optional extension

- **Kiln asset authoring:** geometry, skin, named bones, material resources and
  clips are source assets. `authoring/first-hands.kiln.js` is the exact saved
  source, not an independently maintained copy of the rig.
- **Shared game contract:** `game/animation-v3.json` owns durations, stages,
  weapon/magazine transforms and hand offsets. `animation-sampler.mjs` samples
  the authored table. Game rules own ammunition, compatibility and action gates.
- **Holodeck adapter:** `weapon-extension.jsx` validates both delivered hashes,
  verifies clip names/durations, and uses `AnimationMixer` at the game-owned clip
  time. It stops and uncaches the mixer before disposing scene resources. This
  remains the explicitly enabled client extension; Holodeck's generic static
  world asset admission has not been broadened to accept skins or clips.
- **Unreal adapter:** a `USkeletalMeshComponent` plays imported `AnimSequence`
  assets. Playback rate is zero and the adapter sets/evaluates time from the game
  clock. Manual wrist posing has been removed. `SetClips` stores hard asset
  references so cooking includes all four sequences. The C++ presentation table
  is generated from the same JSON and records its SHA-256.
- **Destination ownership:** grip appearance remains a destination material
  override. Neither a clip nor a source mesh replacement owns ammunition,
  attachment policy, world interaction state, or native material overrides.

These are local candidates for extension tools, not a published Kiln feature.
A reusable version should expose a rig/contact profile, a clip manifest and a
consumer adapter. The current finger curl values are fitted to this fixture;
reuse the validation workflow, not these angles for every weapon or hand.

## Obstacles and fixes

**Stale editable source despite a correct saved asset.** The v2 exporter had
refused to overwrite an existing source filename; a later copy used that older
file. We recovered `p_a6a2daa71847` into a unique file before editing. The new
promotion script checks BOTH source and GLB hashes against the saved revision
before replacing canonical files. CLI exit/JSON success must be checked before
any dependent copy. `hands-v2-parent-exact.kiln.js` is the recovered parent;
the old `first-hands-v2-qualified.kiln.js` must not be used to resume authoring.

**Animation sampling needs material resources too.** The first CLI animation
request omitted `--materials` and failed during the material-dependent build.
Supplying the same pinned material manifest used for render/save resolves it.

**Whole-revision comparison currently rejects skins.**
`evidence/hands-v3-comparison.json` reports that limitation, not a pass. Direct
GLB tests instead check bone identities, target channels, timestamps, quaternion
normalization, neutral endpoints and delivery hashes. Geometry and rest-joint
positions intentionally changed. Full geometric preservation is not claimed.

**Changing the native component type invalidated the serialized property.**
The old poseable component could not deserialize into the skeletal component
property. The replacement uses `AnimatedGloves`; the native `SetHands` method
recovers that existing component when the property is null. The import adapter
removes only the obsolete `SkinnedGloves` component and saves the map after
checking the 72 part bindings. Python cannot assign this read-only property.
A fresh import and rendered run then succeeded without that migration warning.

**Importer names and Python accessors differ from assumptions.** UE created
`first-handsReload`, etc., beside the skeletal mesh, with no underscore before
the clip name. The adapter enumerates actual AnimSequence assets and matches
those names. Skeleton is read with `get_editor_property('skeleton')`; direct
`.skeleton` access is unavailable on AnimSequence in this installation. Failed
attempts are retained in import logs. The verified import receipt is authoritative.

The glTF non-root-skinned-mesh warning remains. The parent transforms here are
identity; actual consumer playback was checked. This does not certify arbitrary
transformed or nested skinned assets. Engine resampling/compression is also a
separate boundary from the GLB key data.

## Verification and evidence

`game/animation-delivery.test.mjs` tests the delivered bytes, not just authored
parameters: channel targets/times/values, normalized quaternion keys, endpoint
return, finger motion, wrist-to-magazine motion, and source provenance. Together
with delivery and gameplay tests, 15 Node tests pass. The renderer-specific UI
captures confirm WebGPU and real WebGL2 (`?backend=webgl`, not `webgl2`). Both
play reload/inspect, block firing during inspect, return to neutral and preserve
the charcoal grip override. Reload commits ammunition once.

Unreal's editor game run passed 28 assertions, including imported clip durations,
actual finger/wrist deformation, both inspect views, action gates, regrip,
ammunition and retained grip state. The separately launched standalone package also passed all 28 checks.
Its executable SHA-256 is `C4B4B5BA3E02743F95752C864A8FB06E85EF2B880BA5662A1CD010B4225597E1`. The final summary records
the package container hashes and source pins; editor success alone does not
qualify a package.

Key receipts and captures:

- `evidence/weapon-v3-node-tests.txt`
- `evidence/hands-v3-reload-final.json` and `.png` (real clip sampling)
- `evidence/weapon-v3-native-import.json`
- `evidence/weapon-v3-native-material-bindings.json`
- `evidence/weapon-v3-editor-result.json`
- `evidence/weapon-v3-packaged-result.json`
- `evidence/weapon-v3-webgpu-backend.txt` and `weapon-v3-webgl2-backend.txt`
- `evidence/weapon-v3-final-webgpu-inspect.json` and `*-webgl2-inspect.json`
- `evidence/weapon-v3-final-webgpu-reload.json` and `*-webgl2-reload.json`
- `evidence/weapon-animation-v3-summary.json` (final pins/results/limits)

## Repeating the workflow

Run from this workspace. Use the pinned local Kiln CLI and GPU service described
in `authoring/AGENTS.md`. Refine the saved program reference, export to a unique
source filename, render/sample with `materials/weapon-v2/pins.json`, review the
actual assembled contact, then save a child revision. Do not run an old draft
promotion script against a newer revision.

For this checkpoint, `pipeline/promote-hands-v3.mjs` verifies the exact saved
source and GLB; `pipeline/generate-presentation-header.mjs` generates the native
table. `pipeline/reimport_weapon_v3.py` imports the stable source basename and
reconciles generated material bindings. Serialized/editor work is ordered:

1. `pwsh -File pipeline/build-validation.ps1 -Target Editor -Map WeaponLab`
2. `pwsh -File pipeline/run-unreal-script.ps1 -Script pipeline/reimport_weapon_v3.py -Label weapon-v3-import -TimeoutSeconds 600`
3. `pwsh -File pipeline/run-weapon-lab.ps1 -Label v3-editor`
4. `pwsh -File pipeline/build-validation.ps1 -Target Package -Map WeaponLab`
5. `pwsh -File pipeline/run-weapon-lab.ps1 -Packaged -Label v3-packaged`

Wait for each process to finish before the dependent step. Then verify the
browser UI on both renderer backends. `pipeline/play-weapon-lab.ps1` launches the
standalone package; port 4202 runs the explicitly enabled Holodeck extension.

## What is still visibly unfinished

The gloves are assembled procedural forms, with segmented pads and simplified
webbing and thumb shapes. Some fingertip contact still needs sculpt/rig review;
there is no continuous collision/contact solver or anatomic certification.
Forearms blend to a fixed root and stretch during low withdrawal; there are no
elbow/forearm twist chains or IK. The exchange remains below the frame, without
a separately tracked spare/dropped magazine or inventory animation. The gun's
blocky silhouette and the lighting difference between the viewers remain.

The next art step is a unified glove sculpt/retopology and a forearm/twist rig,
then contact constraints against the grip and magazine throughout the clips.
Preserve semantic identities where feasible, version the rig contract when
adding joints, and keep game timing independent of animation events. Sound,
recoil/VFX, clip blending and performance budgets need their own qualification.
