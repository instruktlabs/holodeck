# The Last Crossing: playable castle slice

**Paused checkpoint:** read [CHECKPOINT.md](CHECKPOINT.md) before resuming. The
latest terrain adapter is ahead of the legacy bundle and requires explicit
contract reconciliation before a new build.

A native Windows example of Kiln assets composed in Holodeck and imported into
Unity. The current slice is a bridge, open gate, lower courtyard, protected stair,
wall ballista and inner barricade. It is a playable blockout, not the full fortress
or finished art pass described in the design bible. The legacy revision 10 scene
passed a bounded native technical smoke on Unity 6000.7.0b6, but its composition
was visually rejected. Reconstruction candidates remain unapplied and await
visual approval; the technical pass does not qualify their appearance or behavior.

## Play

Build with `CastleSliceBuild.QualifyAndBuildWindows`, then run
`Builds/CastleSlice/LastCrossing.exe`. Explore before starting the wave; climb the
courtyard stair to the ballista platform. The approaching raiders attack the
**inner barricade**, beyond the open gate.

| Control | Action |
| --- | --- |
| Enter mouse look button | Capture mouse for movement and aiming |
| WASD / Shift | Walk / sprint with collision |
| Space / Start wave | Begin the 24-raider wave |
| E near the ballista | Operate / leave the weapon |
| Mouse / left button | Aim / fire while operating the ballista |
| Q | Heavy bolt, costs two supplies |
| F / Auto crew | Toggle slower automatic defense; mounting takes manual control |
| R / Repair | Repair the barricade by 75 health, costs three supplies |
| Escape | Release mouse to the interface |
| Enter / Restart | Reset the siege, player, enemies and supplies |

There are six supplies, 200 barricade health and at most twelve active enemies.
Normal bolts deal 65 damage; a heavy bolt deals 120 plus nearby splash damage.
Defeat all 24 raiders to win. An undefended barricade can be breached. Automatic
fire helps while exploring, but manual fire reloads faster.

## Reproduce the scene and build

Use Unity **6000.7.0b6**, the checked-in package pins and the Windows Standalone
build module. Activate the user's own license on each execution machine. Use a
normal local project directory when a sync-client folder causes import problems;
copy source, settings and exact inputs explicitly, preserving `.meta` GUIDs.
Never copy `Library` caches or a live Editor lock between machines.

`Assets/CastleSliceBundle/slice.json` holds the reusable layout, marker contract,
shared terrain triangles, collision and exact GLB hashes. `CastleSliceBuild`
checks those hashes before scene generation and reflects the glTF X basis once.
It generates `Assets/CastleSliceGenerated/PlayableCastle.unity`, leaving the
historical blockout and soldier benchmark scenes separate. The generated scene
is importer-owned; put durable changes in the bundle or runtime adapter.

### Terrain contract, bundle selection and GUID gate

`--slice-bundle Assets/<dir>/<name>.json` selects the bundle (default: the
qualified `Assets/CastleSliceBundle/slice.json`); assets resolve beside it. The
builder fails closed unless the terrain declares one of two contracts:

- `holodeck-heightfield-appearance-v1`: exported by the authoring workspace's
  `build-slice.mjs --bundle-out <new file>` from the **stored** accepted world
  revision (`.holodeck/history/<rev>.json`). It carries Holodeck's own vertex
  normals, the appearance resolved with the renderer's defaults, the source
  revision and SHA-256 values, and an explicit `unsupported` feature list. The
  builder rejects a v1 bundle that lacks this provenance.
- `legacy-flat-ground-v0`: an explicit regression path for pre-contract
  bundles. It requires `legacyBaseColor` (`#rrggbb`) and `legacyBaseColorSource`.
  `legacyMaterial: "urp-lit-ground"` keeps the committed URP Lit `Ground.mat`
  unchanged, after checking it matches the colour, for r10 pixel parity. The
  default `vertex-palette` bakes the colour through the diffuse vertex shader.

`Evidence/castle-slice-scene.json` records the bundle path and hash, the terrain
contract, the palette and colour source, the material and the unsupported
features. A new bundle is a new identity and needs its own native smoke run.

Before any cross-host Editor job, run the read-only GUID gate:

```text
python -I Tools/validate_bundle_meta.py [--compare OTHER/Assets] [--receipt INPUTS.json] [--package-root DIR]
python -I -m unittest discover -s Tools/tests -v
```

It requires a committed `.meta` file for every bundle file and folder. Every
GUID referenced by `Assets/CastleSliceGenerated` must resolve to a project
`.meta`, to an entry in `Tools/known_unity_guids.json`, or to a `--package-root`
tree. `--compare` reports byte-identical assets with different GUIDs.
`--receipt` checks `.meta` hashes in the closure against a build-input receipt.
`CastleTerrainAppearance.RunContractFixture` exercises the contract gates in
the Editor.

From an installed Editor's batch mode:

```text
Unity -batchmode -quit -nographics -job-worker-count 2 -projectPath PROJECT -executeMethod CastleSliceBuild.QualifyAndBuildWindows -logFile BUILD_LOG
```

The builder requires the existing qualified soldier prefab
`Assets/SoldierProductionGenerated/Garrison-a1a7f8c75fbc.prefab` and its controller.
Its three weighted clips and protected LODs are derivatives of the saved Kiln
source, not unchanged exports. Input handling is **Both**, including the new
Input System used by this game's keyboard and mouse controls. The build enables
four shadow cascades and a 50 m distance, then restores the project's prior policy.

The bounded Windows smoke harness uses the actual `CharacterController`, muzzle
raycasts and camera aiming. It tests ascent, mounting, a crosshair hit, a defended
wave, descent, bridge traversal, an unattended breach and restart:

```text
LastCrossing.exe -force-d3d11 --slice-smoke-dir ABSOLUTE_EVIDENCE_DIRECTORY --slice-smoke all
```

It caps rendering at 30 fps, writes checkpoints and PNGs, and exits. Allow about
four minutes plus contention headroom. RenderTexture captures show the world;
interactive interface and input usability remain a separate review. The pure C#
`SiegeSimulationTests` can check rule invariants without starting Unity.

## Pipeline and limits

Author geometry in the separate Kiln/Holodeck workspace. Save immutable Kiln
revisions, export exact GLBs, preserve source hashes and compose through Holodeck
proposals. Keep private captures, load measurements and analysis outside this
repository. Repeated kit placements reuse source assets; that does not by itself
prove a frame-time target.

This slice uses a fixed enemy lane with animated soldiers, not NavMesh combat AI.
Soldiers walk while advancing and idle while damaging the barricade; authored
attack clips, foot IK, possession, melee and hybrid GPU crowd animation remain
future work. The river is a static visual surface. Vegetation, rock and castle
materials remain blockout art. Crowd timing under shared-machine load is not a
capacity result. A CastleKit material look-dev study (triplanar, macro and
de-tile keywords, with measured cost) is in [Assets/LookDev](Assets/LookDev/README.md).

- [Design bible](../../docs/medieval-siege-design.md)
- [Full production plan](../../docs/medieval-siege-production-plan.md)
- [Unity bridge research](../../docs/unity-siege-pipeline.md)
- [Character export procedure](Tools/production-character.md)
- [Crowd material and LOD conversion](Tools/crowd-optimization.md)
- [Hybrid animation design](../../docs/siege-hybrid-crowd-animation.md)

The original `SiegeBridge` importer and free-fly `SiegePreview` remain historical
bridge fixtures. Their route rays do not replace the playable slice's controller
and combat checks. The beta Editor resolved these effective package versions:

| Package | Resolved version | Source |
| --- | --- | --- |
| Universal Render Pipeline | 17.7.0 | Built into 6000.7.0b6 |
| Animation Rigging | 6.7.0 | Built into 6000.7.0b6 |
| Input System | 6.7.0 | Built into 6000.7.0b6 |
| Test Framework | 1.9.0 | Built into 6000.7.0b6 |
| glTFast | 6.20.0 | Registry |
| Unity Pipeline | 0.9.1-exp.1 | Registry |

The manifest retains older requested versions for some built-in packages; the
beta Editor overrides those requests with its built-ins. Use the resolved
package lock and Editor import receipt when reproducing this environment, rather
than reading requested versions as installed versions. Registry glTFast and
Pipeline pins are unchanged. No cloud project is required.
