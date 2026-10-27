# Soldier crowd derivatives

This is a bounded pipeline for the saved garrison soldier. Keep the editable
Kiln source, full-detail rig and every derivative under separate identities.
The palette converter intentionally rejects unsupported material features. It
is not a general-purpose glTF optimizer.

## Material consolidation

```text
python Tools/optimize_soldier_glb.py --input <rigged.glb> --out <palette-directory>
```

The result has two submeshes: the original textured mail and a palette material.
The other original linear base colors are retained in float32 `COLOR_0`. A tiny
nearest-filter metallic/roughness texture uses the original factors quantized
to 8 bits, with maximum factor error below 0.002. Geometry, normals, joint indices
and skin weights remain exact. UV0 is deliberately repurposed only on originally
untextured surfaces; the original mail image and UVs are preserved.

Read `palette-audit.json`, then compare actual Unity pixels before accepting the
material conversion. The destination shader must support linear vertex colors
and glTF metallic/roughness channels. Ordinary URP/Lit does not preserve this
palette by itself. A material-count reduction is not measured performance.

## Protected LODs

Use the pinned **meshoptimizer 1.1.1** JavaScript package (MIT), including its
license. The simplifier requires the package's `index.js` as an explicit path
and verifies the installed version; no installed package is edited.

```text
node Tools/simplify_soldier_lods.mjs <palette-directory>/simplifier-input.json <lod-directory>/lod-indices.json <meshoptimizer-directory>/index.js Tools/garrison-lod-protection.json
python Tools/optimize_soldier_glb.py --input <palette-directory>/Garrison-LOD0.glb --out <lod-directory> --lod-indices <lod-directory>/lod-indices.json
```

Run the simplification on the hub under its shared Unity job lock. The index
receipt identifies the exact LOD0 SHA-256; packaging rejects mismatched sources.
The simplifier considers normals, colors, UVs, joints and weights while selecting
existing vertices. All retained vertex attributes, bind matrices and clips stay
exact. Its error bound is not a guarantee of good deformation or silhouette.

An initial 6,710/3,174-triangle pair collapsed thin cuffs and helmet rims despite
small position errors. Those versions were rejected. The current guard preserves
original connected surfaces when a new triangle opposes a retained vertex normal
by more than the allowed threshold. Original hard-edge smoothing exceptions are
preserved only for exact oriented source triangles. Every retry and protected
component count is recorded. That guard produced **8,468 / 7,740 triangles**, but
actual Unity PBR views then exposed independent mail/tunic intersections and beard
gaps that gray geometry previews missed. Those versions were also rejected.

The successor preserves the original tunic, skin, mail and boxed beard together
using `garrison-lod-protection.json`, which is pinned to the exact palette source
hash and original material mapping. It retains **12,550 / 11,504 triangles**,
against **15,978** at full detail. Layer clearance needs explicit protection as
well as normal orientation. Retaining visible form takes precedence over a
requested reduction ratio; measure whether these conservative LODs pay for their
resident mesh and skinning costs.

Inspect actual posed views and use lower LODs only at qualified screen sizes.
Shared materials and one canonical 22-bone skeleton should serve all levels; copying extra Animators
or complete independent skeletons per LOD defeats part of the optimization.

## Crowd evidence

Use `--animation-mode mixed` for shuffled Idle/Walk/LookAround and `all-walk`
for a walking workload. Both use reproducible `--animation-seed` assignments,
independent phases and modest speed variation. `--crowd-preview true` captures
60 frames at 30 Hz for a 25-unit stage, outside timing. These are in-place clips;
standing actors in mixed mode are intentional, and no navigation is implied.

Keep readback and video encoding outside performance samples. Run a clean process
for measured comparisons. Preserve resolution, light/shadow range, backend,
camera framing, seed, animation workload and sampling duration. Record actual
draw/triangle counters separately from configured LOD mesh counts. Treat null
GPU timing as unavailable and distinguish hub GPU results from Windows results.

```text
python Tools/audit_crowd_run.py <completed-run-directory> --out <audit.json>
```

The audit checks completion, source/build identity, all saved image hashes,
render callbacks, actual clip state and advancement for up to 16 spread units,
assigned speeds and the single canonical skeleton. It preserves allocator warning
counts. It does not substitute for reading the images or reviewing the motion.

For this fixture, hidden manual D3D11 completed two 30-second-per-stage Windows
tests without allocator warnings. Hidden manual D3D12 reproduced a warning;
visible normal-camera D3D12 was clean in one approved test. Use the qualified
configuration and retain the scope of that evidence, not a universal leak claim.
