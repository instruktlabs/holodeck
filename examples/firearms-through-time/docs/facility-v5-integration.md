# Facility v5 staged integration

Holodeck facility integration is complete at **revision 5** on port **4202**. This lane submitted and applied the authorized facility-only proposal through the supported API. Both WebGPU and WebGL2 loaded the exact saved children and passed select/start/stop/restart/reset. This lane did not execute a native process, import, build or fixture; native integration is separately owned and executed by the parent.

The before/after receipt is [v5-facility-holodeck-preserve-proof.json](../evidence/v5-facility-holodeck-preserve-proof.json). It proves saved state equals live state, exactly three asset file/revision fields changed, and all objects, interactions, collision, runtime capabilities, environment, cove/origin, bible, references and other catalog entries are unchanged. `MI_ConsoleScreen.uasset` and `M_RangeFloor.uasset` are byte-identical before and after.

The attempted hot-update test did reach revision 5, but its first verifier treated the asset catalog as an array instead of its actual keyed object and failed before recording the held-state assertion. The corrected verifier passed fresh revision-5 interaction tests in both backends. **Held-pose persistence across the revision change remains unqualified**; no rollback/reapply was used to manufacture that evidence. The original failure and pre-update held state are retained.

The scripts are new `v5-` files. They consume the exact saved children in `authoring/facility-v5-pins.json`. The reviewed art and source limits remain in [facility-art-v5.md](facility-art-v5.md).

## Read-only preparation completed

- `node --check pipeline/v5-facility-plan.mjs` passed.
- Python `ast.parse` passed for `pipeline/v5-facility-native.py` without importing Unreal or writing bytecode.
- PowerShell AST parsing passed for `pipeline/v5-run-facility-native.ps1`.
- `node pipeline/v5-facility-plan.mjs --plan` read the live session and exact GLBs, verified all three source/GLB/manifest hashes, no skins/clips, single primitive per semantic mesh and 23 semantic mesh nodes. It wrote local evidence files only.
- Port 4201 returned HTTP 503, “This world is already open in another local host.” The existing weapon host on **4202** is the recorded owner. Its revision **4** matched the saved world exactly; world ID `fd10d5d1-cb96-42e6-bd1b-36485ffe9019`.

Prepared files:

- [Native integration manifest](../evidence/v5-facility-integration-manifest.json): exact revisions, sources, namespaces, per-role mesh bounds in native centimetres and maps.
- [Holodeck request](../evidence/v5-facility-holodeck-request.json): concrete scene-only request, base revision, world fingerprint and changed asset IDs. No cookie is saved.
- [Holodeck before snapshot](../evidence/v5-facility-holodeck-before.json): read-only live world at preparation time.

## Native strategy and commands

The existing `reimport_range_console.py` is a material-only updater and asserts identical geometry. Do not reuse it for these geometry changes. The new script imports into `/Game/Qualification/FacilityV5Generated/{collection-bay,booth-console,target-module}` and rebinds the existing 23 `RangeSliceActor` static-mesh components on **RangeSliceLab and WeaponLab**. It creates no actors or components and does not modify hand/weapon assets, floors, lighting, camera settings or gameplay code.

Every existing component's effective material interfaces are explicitly reapplied after `set_static_mesh`. This preserves the authored `MI_ConsoleScreen` and all source material behavior because v5 made no material-property or texture changes. Old `RangeSliceGenerated` assets deliberately remain as material dependencies. Their bytes, and all `RangeSliceOverrides` bytes, must remain unchanged. The new imported materials are not substituted for these bindings. This isolated derivative approach is justified by the legacy → three exporter boundary and preserves a recoverable baseline; it is not a test of in-place reimport over the old namespace.

Run commands from `<workspace>` **only after the parent finishes hand-rig work and releases the shared native destination**:

```powershell
# The native manifest is already frozen. Do not regenerate the old-parent
# Holodeck request after revision 5; the source-parent guard correctly rejects it.

# Optional fresh native preflight; launches a separate read-only NullRHI editor process.
./pipeline/v5-run-facility-native.ps1 -Action ReadOnly

# Actual import/bind/save mutation, once, in the serialized window.
./pipeline/v5-run-facility-native.ps1 -Action Apply

# Mandatory independent process readback even when Apply exits successfully.
./pipeline/v5-run-facility-native.ps1 -Action Verify

# Existing rendered interaction fixture; do not run concurrently with other GPU work.
./pipeline/run-range-slice.ps1 -Label facility-v5

# Later package qualification, after successful readback and visual review.
./pipeline/build-validation.ps1 -Target Package -Map RangeSliceLab
./pipeline/run-range-slice.ps1 -Packaged -Label facility-v5-packaged
```

The wrapper defaults to `ReadOnly`. It uses the existing bounded `run-unreal-script.ps1` without GPU, with a 600-second limit. An import attempt refuses an existing v5 namespace, backup, result or checkpoint. It snapshots both maps before imports and writes checkpoints after each qualified import and each map save. If the process crashes on shutdown, distinguish the saved result from process success and run `Verify`; never blindly rerun `Apply`.

Native expected assertions:

1. Exact source and GLB hashes; existing project and both maps.
2. Exactly one pre-existing `RangeSliceActor`, 23 mesh components and five blocker components in each map.
3. Exactly 8/7/8 new meshes with the current semantic node names and one material slot each. Unexpected importer names fail before binding; no fuzzy remapping.
4. All imported per-role mesh bounds match the actual v5 GLB after `[x,z,y]*100` conversion within 0.05 cm. This verifies the expected baked joint frame before retaining the existing negative-pivot compensation.
5. `bay_Joint=[23,0,104]` cm and `target_Joint=[0,0,170]` cm; all component parents, local translations/rotations/scales, collision/mobility, effective material interfaces, non-mesh frames and blockers unchanged after binding.
6. The same controller actor, unrelated actor identities/transforms/tags and existing source/material/override file hashes remain unchanged.
7. A fresh-process readback exactly equals the saved after-snapshot and repeats imported bounds/material-slot and old-file hash checks.
8. The existing 14 runtime assertions pass: modules/pivots loaded; selection required for start; selection reach; bay selection; selection limit; remote start; intermediate target pose; target limit; stop after deselect; reset reach; reset pose; blockers; swept walker collision; global reset.

`RangeSliceLab` fixture validation does not exercise WeaponLab's hand rig. Parent should run its separate current hand/weapon fixture after the facility bind. Both maps are deliberately saved by the script because WeaponLab already contains the duplicated RangeSliceActor. The script snapshots and preserves unrelated actor transforms/tags, but this alone is not a complete serialization audit of every unrelated actor property; the hand lane's own readback remains required.

Backup: `evidence/v5-facility-native-before/` contains both original map files and authored overrides. It does not delete old derivatives. Automatic filesystem rollback is not attempted. To recover after a partial save, close Unreal first, inspect `v5-facility-native-checkpoint.json`, compare backed-up hashes and restore only the named affected map files under a separate reviewed recovery action.

## Holodeck execution and repeat verification

No `world_read`/`world_propose` tool was exposed in this session. Execution used the local `/api/session`, `/api/propose` and `/api/proposal/apply` contracts. No script directly wrote `world/world.json`. `v5-facility-plan.mjs` is proposal-only; the separately audited `v5-facility-live.mjs` applies the exact matching proposal after checking its ID, world ID, base revision, scene, bible and references.

Executed once against revision 4:

```powershell
node pipeline/v5-facility-plan.mjs --plan
# The live verifier invoked --propose, then applied that exact proposal.
node pipeline/v5-facility-live.mjs
# Corrected catalog-shape check; read-only destination verification.
node pipeline/v5-facility-live.mjs --verify-only
node pipeline/v5-facility-walk-review.mjs
```

`--propose` rereads the live host and refuses a changed world ID/fingerprint, base URL or request, any pending proposal, any active embedded-agent turn, and scope other than the exact facility trio. It exports each exact saved editable GLB to a revision-specific file under `holodeck-range-slice/assets/imports`, verifies hashes, then POSTs the prepared request with the live cookie/world/epoch headers. Both submit and apply write checkpoints first. Proposal `d33294f4-4c21-4577-a98c-286f5f2109ea` was applied successfully, yielding revision 5 and clearing the pending proposal. Do not rerun proposal/apply. Use `--verify-only` for repeat UI checks while revision 5 remains current.

The request changes only `scene.assets` file/provenance for `collection-bay`, `booth-console` and `target-module`. Objects, placements, collision, behavior, runtime capability list, weapon assets, environment, cove/origin, bible and references are preserved. A fresh plan is required after any accepted world revision change.

Both backends passed actual loaded revision and all three exact source hashes; bay selection, target start, intermediate pose, full 90-degree turn, stop, restart and booth reset. Keyboard traversal went around the booth to reach the bay and console. This was not an exhaustive new collision qualification. Walking-height visual captures supplement the previously reviewed exact-asset multiview renders; they do not establish final owner acceptance or a quiet-host performance gate.

## Engine-code assessment

No engine or game code change is presently required. `ARangeSliceActor::AddModule` already separates named body/moving parts and holds `BayPivot`/`TargetPivot`; swapping the meshes on its existing components leaves `Parts`, parent frames and interactions intact. Existing Holodeck supports static GLBs with named rigid joints, asset-only proposals and scene-owned relay state. If native Interchange names or bounds differ, stop and qualify an explicit adapter mapping instead of changing engine code or guessing a compensation. No code changes were applied.

All measured timing/FPS remains **DIRTY** under current concurrent load. A successful import/readback and 14 assertions will establish structural/interaction behavior, not performance, final visuals or owner acceptance.
