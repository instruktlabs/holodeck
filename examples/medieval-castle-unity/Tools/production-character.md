# Reproduce a production character derivative

Use this flow for the authored humanoid fixture. It is not a generic auto-rigger.
Inputs are a saved Kiln GLB, its exact authored rest manifest, and optional
source-hash-pinned part overrides. Retain editable Kiln source and its asset and
revision IDs alongside those inputs.

1. Normalize the manifest with the installed Python:

   ```text
   python Tools/prepare_production_manifest.py --input <rest-manifest.json> --source <source.glb> --out <rig-manifest.json> --overrides <overrides.json>
   ```

   Omit `--overrides` when unused. This writes the normalized contract plus an
   exact author-manifest snapshot. A supplied override must match the source hash.

2. Run the qualified Blender 5.2 executable with a bounded thread count:

   ```text
   blender --background --threads 2 --python-exit-code 2 --python Tools/rig_production_soldier.py -- --input <source.glb> --manifest <rig-manifest.json> --out <rig-output-directory> --render
   ```

   Require a zero exit code and inspect `rig-audit.json`, the saved pose images,
   `Garrison.blend` and `Garrison-rigged.glb`. `--python-exit-code` is necessary:
   a Python exception can otherwise leave Blender's process exit code at zero.
   Workbench pose images qualify geometry; they do not qualify PBR appearance.

3. Verify the exported geometry in a separate Blender process:

   ```text
   blender --background --threads 2 --python-exit-code 2 --python Tools/verify_production_rig.py -- --input <Garrison-rigged.glb> --expected <expected-clip-poses.npz> --out <roundtrip.json>
   ```

   Require all nine clip samples to pass. Keep the maximum distance and exact
   export hash. Do not interpret delivery fidelity as animation-quality approval.

4. Copy that exact GLB into `Assets/SoldierProduction/Garrison.glb`, then use the
   matching licensed Editor and `SoldierProductionImport.ImportAndBuild` with:

   ```text
   --soldier-glb Assets/SoldierProduction/Garrison.glb --expected-sha <sha256> --expected-clips Walk,Idle,LookAround
   ```

   Use the workspace Unity CLI skill for the supported Editor invocation. Keep
   source, packages, settings and `.meta` GUIDs; do not transfer Library caches.
   The importer checks clip binding paths, actual weighted motion and source
   material/texture counts before producing the player.

5. Run a one-soldier player validation with `--counts 1 --seconds 8
   --preview-sequence true --output <new-directory>`. Inspect actual PNGs and
   requested-versus-active animation states. Encode the Walk frame sequence at
   the FPS in its `sequence.json` to preserve the imported clip duration.

6. Use a clean player process for `--counts 1,25,100,250,500 --seconds 8
   --preview-sequence false --output <new-directory>`. Verify source/build IDs,
   rendered frames, skin motion and captured pixels before reporting timings.
   Keep unavailable GPU timing as null. This fixture measures rendering and
   Animator evaluation, not the castle game, navigation, combat or contact IK.

The rig uses explicit weights and baked procedural clips. It has no neural model
dependency, facial rig, foot locking or two-handed weapon constraint. The successor
crowd tooling is documented in [crowd-optimization.md](crowd-optimization.md):
two-material palette conversion, protected LODs, one canonical skeleton and
reproducible mixed/all-walk workloads. Qualify these derivatives in actual Unity
pixels and timing runs; preserve the full-detail rig as their source.
