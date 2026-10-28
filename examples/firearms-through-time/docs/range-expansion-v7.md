# Range module and target integration

The first expanded range layout adds three canopy bays, one end infill, a gallery connector and second display bay, two preview booth consoles, a paper carrier on a stationary support, and a five-plate rack. Holodeck revision 7 and both Unreal qualification levels contain the same 11 added placements. The original collection, console, turning target and pistol loop retain their existing responsibilities.

## Implemented scope

The six newly imported asset types use immutable saved Kiln revisions. The second bay and two additional consoles reuse the existing v5 geometry. Canonical delivery identity, scene placements, collision and native import derivatives are recorded in `evidence/range-v7-manifest.json`. The layout adds 28,896 source triangles and 80 mesh instances; render passes and actual frame cost are different quantities. Both machines are under load, so timing and FPS remain unqualified.

The new target stations are visibly labeled as previews. Their named sheet and plate pivots and six surface anchors remain available to gameplay adapters. They do not yet receive weapon shots, store hit marks, reset fallen plates or return a carrier. The support holds the paper carrier at its two exported mounting planes; it is a stationary qualification stand, not a complete travel track. The original lane remains the playable one.

The gallery faces the shared concourse, opposite the booth bank. The canopy modules repeat at their 2.6 m connection spacing. Existing spawn, overview, lighting, cove, Bible, references and objects are preserved. The new native booth screens inherit the original effective material override instead of silently reverting to the imported material.

## Reusable Kiln integration behavior

1. **Keep the source asset immutable.** Export an exact saved revision with the editable profile, hash it, and store placement separately. Generated engine packages are derivatives with their own identities.
2. **Qualify the served form.** Holodeck serves textured GLBs with external images and repacked vertex buffers. Its catalog hash identifies the canonical file, not necessarily the bytes returned by the asset URL. Compare decoded accessor values, nodes, materials and fetched image bytes; record both hashes. All eight asset types used by the expansion pass this check.
3. **Use stable paths for repeated parts.** The rack and carrier contain repeated mesh names. The Unreal derivative assigns a unique name to each node and mesh instance while retaining a semantic-name map and the unchanged buffers/materials. Do not bind by an ambiguous leaf name.
4. **Handle importer naming explicitly.** Unreal named the single-mesh support after the input filename. A bounded alias maps that observed name to the canonical semantic node; counts and converted bounds must still match. The first attempt stopped before level mutation and was resumed from its import checkpoint.
5. **Preserve hierarchical ownership.** Unreal imports meshes in the asset's baked rest frame. The adapter recreates named empty nodes and compensates mesh components by their parent origin. The paper sheet stays under its carrier; each plate owns its own face and anchors. A flattened static import would make the future target controller unnecessarily fragile.
6. **Preserve effective materials.** Snapshot the actual material interfaces on existing components, not only the static mesh defaults. Additive geometry must not rewrite old overrides. Duplicated fixture modules inherit those interfaces explicitly.
7. **Test the specific collider.** A sweep hitting any box on a shared assembly actor can conceal a missing support collider. Check the hit component identity, not just its actor. Restored component parents and transforms need fresh package readback, plus a bounded reversible pivot probe.
8. **Persist collision policy, then reopen.** The existing studio sky sphere reloaded with `BlockAll` even though its creation script had called `set_collision_enabled(NO_COLLISION)`. This caused false obstacle hits and blocked a clear concourse probe. Both levels now explicitly save the `NoCollision` profile and disable actor collision; the creation script carries the same correction. The sphere's transform and material are unchanged, and pre-fix maps are backed up. A setter succeeding in memory does not prove the saved scene will behave correctly.
9. **Snapshot values, not editor wrappers.** Unreal Python property objects can reflect subsequent mutations. Copy numeric rotator fields before reversible pose probes; do not retain the live property wrapper as the restore value. Compare numeric transforms, not Python object string representations.
10. **Declare light mobility for the destination.** The user observed one lighting-rebuild warning. Readback found one Stationary directional light in each level. For these mutable test scenes, it is now explicitly Movable, with direction, color and intensity preserved. This uses dynamic lighting as described in [Epic's light mobility documentation](https://dev.epicgames.com/documentation/unreal-engine/movable-light-mobility-in-unreal-engine?lang=en-US). The runtime fixture now fails if `NumLightingUnbuiltObjects` is nonzero. No warning-suppression command or global static-lighting switch is used. This decision does not establish a final production lighting/performance policy.

These are candidates for an optional Kiln destination adapter and qualification skill. They remain project-local code; no extension release or global engine change has been published.

The placement script is a guarded revision-6-to-7 migration, not a general refresh command. Do not rerun it against revision 7 or use an asset collection's latest revision implicitly. Ongoing checks use `pipeline/check-range-v7.mjs`, the read-only `pipeline/verify_range_v7.py`, and the rendered `pipeline/run-range-expansion.ps1`. The two repair scripts intentionally preserve pre-change map backups and stop on an unexpected retry state. Generalizing this into an optional tool requires a schema/versioned migration contract and reusable destination discovery rather than hard-coded level names.

## Evidence and remaining review

- `evidence/range-v7-integration-checks.json`: served geometry/material/image equivalence, source costs, preserved world sections and both mounting anchors.
- `evidence/range-v7-native-result.json`: 65 imported meshes, 80 placed components per level, converted bounds and original actor/material preservation.
- `evidence/range-v7-holodeck-weapon-state.txt`: original pistol after aim/fire/reload/inspect and charcoal grip swap, seven rounds loaded, reserve 27, one shot and one hit.
- `evidence/range-v7-holodeck-paper-contact.txt`: actual keyboard traversal stops at the new paper station support; the scene is observed in WebGPU.
- `evidence/range-v7-holodeck-gallery.png`: player-height gallery join and original collection interaction.

Fresh-process hierarchy and reversible carrier/plate probes passed. WebGPU and WebGL2 both render revision 7 with a clear spawn; the actual pistol flow and traversal were exercised in WebGPU. Twenty existing weapon/rig Node tests passed. Native collision tests exposed the backdrop issue described above. Corrected RangeSliceLab editor and WeaponLab standalone runs both passed all nine expansion checks, including zero unbuilt lighting objects. Neither expansion run reported material compilation fallback warnings.

| Qualification | Evidence | Result |
|---|---|---|
| Browser served assets and original world preservation | `range-v7-integration-checks.json` | Pass; eight asset types, exact decoded content and image bytes |
| Native saved hierarchy, reversible poses, sky collision and dynamic sun | `range-v7-native-fresh-proof.json`, `range-v7-fresh-lighting.log` | Pass in fresh process for both maps |
| Editor range, specific collision components, lighting | `range-v7-editor-lighting-result.json` | 9/9; zero unbuilt lighting objects |
| Updated D: standalone range and lighting | `range-v7-packaged-result.json` | 9/9; zero unbuilt lighting objects |
| Existing pistol/rig in editor after placement | `weapon-range-v7-editor-result.json` | 34/34 |
| Existing pistol/rig in updated standalone | `weapon-range-v7-packaged-result.json` | 34/34; native overrides, inspect, aim, fire, reload and IK preserved |
| Weapon, IK, twist and delivery Node tests | `range-v7-node-tests.txt` | 20/20 |

All evidence filenames above are in `evidence/`. The final package is in `<package root>/WeaponLab`. Cold startup from D: under the current workload exceeded the old four-minute weapon-test allowance, so the runner now allows a configurable ten-minute startup/run/shutdown timeout. It still requires all 34 behavioral checks and a successful process exit. This is a correctness timeout, not a frame-time or startup performance target.

`range-v7-closeout.json` consolidates the passing receipts and records executable, game package and source-level hashes. The standalone overview uses a review camera while the first-person rig remains at the pawn; it is not a full-body/Maker view. The review board uses the clean RangeSliceLab editor overview for the native assembly comparison.

The gallery face is intentionally blank; artwork and strong close-range lighting/material presentation remain art tasks. Fine target print aliases at some distances. Opposite-side infill, a complete target track, moving collision and continuous motion clearance are not qualified by this placement pass. Review cameras differ between destinations, so the images do not establish numerical lighting parity.

## Parallel firearm candidates

Three Astra authoring agents delivered immutable original game-art candidates: [Pattern 1742 musket](firearm-flintlock-v1.md), [Lee-Enfield No.4 Mk I*](firearm-bolt-v1.md), and [Colt M4 R0977 catalog form](firearm-carbine-v1.md). Each has a primary-source reference dossier, declared configuration/uncertainties, saved source/GLB/preview identities and actual recessed muzzle geometry. The parent audited 13 artifact hashes and inspected close renders. The new cards are in the [22-candidate review board](../evidence/parallel-asset-review.html#eras-v7).

These are separate review candidates, not new playable guns. Hand fit, reload/inspect clips, attachment compatibility, destination integration and production art acceptance remain pending. The bolt rifle's corrected front-band revision supersedes its first saved candidate. The carbine receiver/stock still look planar; the bolt rifle needs finer receiver shapes and subtler wood. Historical roster mapping remains unresolved, so three era representatives do not imply complete era coverage.

## Next gameplay slice

Connect a versioned target registry to one authoritative shot resolver. Record target instance, surface identity, query-time transform, local hit point and accepted/resolved outcome. Use that same event for marks, feedback and statistics. Then implement paper return/review and per-plate reaction/reset in both engines. Preserve sheet history when starting a new string. The broader target and lane plans remain in `range-targets-and-shot-review.md`.
