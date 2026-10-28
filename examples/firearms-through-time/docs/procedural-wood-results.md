# Original procedural wood in Unreal and Holodeck

Recorded 2026-10-26. Local optional-extension prototype using Kiln 1.5.0,
Unreal 5.8.4 CL58902052 (D3D12 SM6), and Holodeck WebGPU. Nothing was published
or enabled globally. The earlier scanned case revision remains available.

## Result

The original wood recipe renders in both destinations and updates the interactive
case without changing its geometry, UVs, hinge, or native override assets.
The dry finish is a usable controllable baseline. Broad regular growth lines make
it more stylized and less naturally varied than the scanned reference. The scan
remains the stronger realism reference; this trial is not a claim to replace it.

![Engine comparison](../evidence/procedural-wood-engine-comparison.png)

Each group is scan, original dry wood, and the same generated wood with lower
roughness. Top: frontal light. Bottom: grazing light. These are labeled crops of
the original captures at unchanged pixel scale. Backgrounds differ and are
excluded from measurements.

![Procedural case in Holodeck](../evidence/procedural-wood-holodeck-case-open.png)

![Procedural case in Unreal](../evidence/opening-case-run-20261026T195501851Z/case-open.png)

## Recipe and material contract

`pipeline/wood-recipe.mjs` is version 0.1.0: periodic seeded value noise, warped
growth bands, directional fibers/pores and sparse wear. It takes no input images.
The Fine Grained Wood shortlist entry informed the grain/pore/wear study; the
generated material does not inherit the scan's identity or license.

- Parameters: seed, resolution, physical repeat, grain count/bend, pore strength,
  roughness, relief in metres, wear and sRGB color. Unknown or invalid parameters
  are rejected. `materials/procedural-wood/dry.json` and `oiled.json` are editable.
- A dedicated height field produces tangent-space normals. Dark color markings
  do not automatically become deep grooves. Base color has no baked illumination.
- The portable outputs are base color (sRGB), normal (linear, OpenGL positive Y),
  and ORM (linear, R=1 AO, G=roughness, B=0 metallic). No occlusion is fabricated.
- Both finishes use seed 62, 1024-square maps, 0.6 m repeat and 0.00016 m relief
  amplitude parameter. Roughness bases are 0.72 and 0.28. The latter is called
  `oiled` in filenames, but does not model oil absorption, clearcoat or anisotropy.
- Dry and lower-roughness outputs have identical color and normal pixels; only
  ORM changes. The three-panel GLB therefore contains seven unique images,
  because identical maps are deduplicated.

Dry bake: 1,275 ms; lower-roughness bake: 1,251 ms. Including material import:
6,679 and 4,824 ms respectively. These are single measurements on this workstation,
not a benchmark or a GPU comparison. CPU synthesis is fast enough for this 1K
trial; destination rendering and Kiln visual reviews used the GPU. Consider GPU
synthesis only after measuring a workload that needs it.

Every successful output retains exact recipe source, normalized parameters,
SHA256 hashes, material revision pins and timings. See
[`recipes.json`](../materials/procedural-wood/recipes.json) and the
[recipe guide](../materials/procedural-wood/README.md). Source/download references
and original recipes remain separate records, linked by stable catalog IDs.

## What passed

| Gate | Evidence and scope |
| --- | --- |
| Repeatability | Same seed/parameters reproduce all map bytes on the current JS runtime; a changed seed changes grain. Cross-platform bit identity is untested. |
| Periodicity | Analytic color, height and roughness wrap on both axes; largest sampled boundary error 4.69e-13. This does not prove every mip level looks seamless. |
| Map semantics | Encoded normals are unit length within quantization tolerance; AO=1, metallic=0; changing roughness leaves color/normal unchanged. |
| Asset update | Saved comparison reports identical geometry and UVs; 3,044 triangles, 3,836 vertices, nine meshes and six materials retained. |
| Unreal import | All 14 exported source-art images (seven case, seven lab) equal the GLB pixels. This excludes GPU block compression. |
| Unreal preservation | Actor/component/mesh bindings, bounds, transforms and hinge remain unchanged. Native painted-frame and steel override files retain their hashes and roughness values, 0.18 and 0.72. |
| Unreal runtime | Nine editor-game checks pass: all parts, closed start, intermediate pose, opening limit, stable body/pivot, lid lift, close, reopen and reset. |
| Holodeck delivery | Both pinned source hashes, derived HTTP GLBs and all served shared-image bytes match their exact saved revisions. |
| Holodeck preservation | Entire saved case scene unchanged except case file/provenance. Paused displayed time 43.27 s and lid angle -0.20 rad survived replacement, then resumed. UI numbers are rounded. |
| Holodeck interaction | Observed close/open after update; open angle -1.83 rad; Reset activity returned the case to closed/0.00 rad. Screenshots and AX receipts retained. |
| Destination rendering | Fixed-camera frontal and grazing captures reviewed in Unreal and Holodeck WebGPU. WebGL2 was not rerun for this procedural revision. |

Case asset `a_97a44d3c5d574dab9d9c4994cf6d2be3`, revision
`r_096099160ddb496891d9203c5c2ba554`, parent
`r_f86712dfed19484488af97a741eeb6cd`, program `p_9e17cb8743e9`.
GLB SHA256 `2298862b9a694780715035c1496430193e7701825ecb2834e458dab0151986c8`,
1,834,132 bytes. This is about 63% smaller than the preceding scanned case GLB;
compressed file size is not a GPU-memory measurement.

Comparison asset `a_dc13abd28b1947a09d69a957b2135a38`, revision
`r_73381d3e08aa496b8abba406bc138f74`, program `p_83fe892570d3`.
Its GLB is 6,219,692 bytes, including the scanned reference maps.
Holodeck case world is revision 16 on port 4196; the comparison is revision 2
on port 4198. Native maps are OpeningCaseLab and ProceduralWoodLab.

## Remaining rendering differences

Lab camera is [10, 1.72, 3.4] metres, looking toward -Z, vertical FOV 63 degrees,
1280 x 720. Frontal light points from [0,0,1], intensity 1. Grazing light points
from [5,0,1], intensity 3. Environment illumination is zero and exposure is fixed.
This isolates directional response, not a complete production lighting setup.

Mean screenshot RGB differences (Unreal minus Holodeck), in 0–255 code values:

| Surface | Frontal | Grazing |
| --- | --- | --- |
| Scan | 0.00, +0.09, -0.55 | -0.49, -0.15, +1.08 |
| Generated dry | +2.58, +5.23, +6.63 | +1.35, +1.49, +1.93 |
| Generated lower roughness | +8.50, +11.88, +13.50 | -0.38, -0.82, -0.56 |

The smoother frontal sample has a visibly stronger, whiter highlight in Unreal.
Grazing interior patches agree more closely. Patch means are diagnostics, not a
perceptual similarity score. They do not measure bevel highlights, full BRDF,
normal-map orientation across every UV island, or compression fidelity.
The exact cause of the frontal highlight difference is not yet isolated; likely
areas to test are destination BRDF/tonemapping and compressed roughness/normal
sampling. Do not hide the difference by tinting the portable source per engine.

## Obstacles resolved and reusable pieces

1. **Custom recipe versus built-in DSL.** Kiln's `source.kind: procedural` is for
   its bounded built-in recipes; it rejects this custom byte-map recipe form.
   The working adapter imports original generated PNGs as external resources and
   retains source/parameter hashes. Generation stays outside asset code.
2. **Local provenance URL.** The current material schema requires HTTP(S) source
   URLs. A loopback server exposes only the actual original-source notice during
   import. The baker starts/closes the server it owns, verifies an existing one,
   and leaves unrelated processes alone. Tests cover the exact notice, 404 for
   other routes/methods, reuse and shutdown. A public extension needs durable
   provenance support; shipping localhost source links is not a release solution.
3. **Native reimport identity.** The reusable candidate manifest selects the
   exact saved GLB. `qualify-case-material.py` verifies its hash, backs up the
   native generated assets, reimports semantic textures, repairs bindings and
   checks overrides. It avoids reloading a level while holding stale UObject
   references. Custom/native instances remain outside generated content.
4. **False timeout during engine shutdown.** The first case mutation wrote a
   success receipt and saved the level before the old 120-second runner timed
   out during shutdown. We inspected checkpoints rather than blindly repeating
   a mutating import. A fresh process reopened the saved map and verified its
   nine meshes and overrides, followed by the passing gameplay test. Runner
   bounds are now 300 seconds for editor scripts and 180 for GPU captures/tests;
   this run observed about 112 seconds just to initialize the editor.
5. **Texture deduplication.** Count actual embedded images and bind by semantic
   names. Assuming three new maps per variant would incorrectly reject the
   intentionally shared color/normal images.

The optional extension should expose the generator/configuration, immutable
material resources, shortlist links and qualification receipts without requiring
an engine. Unreal-specific Python import/binding/capture tools load only for that
destination; Holodeck uses its existing propose/review/apply boundary. No direct
world file edits or Kiln engine changes were needed.

## Evidence and next iteration

Primary receipts in `../evidence/`: `procedural-wood-recipe-tests.json`,
`procedural-wood-delivery-check.json`, `procedural-wood-case-native-result.json`,
`procedural-wood-native-reopen.json`, `procedural-wood-editor-game.json`,
`procedural-wood-capture-comparison.json`, and the case UI/activity text receipts.
Import adapter smoke receipts are in `materials/procedural-wood/import-smoke-v1/`
and `standalone-smoke-v1/`. The latter started its own notice server, imported
successfully and verified that the server stopped afterward.

Next: soften the regular growth bands, add independent knots and dedicated end
grain, test bevelled board junctions and near/far mip transitions, and isolate the
lower-roughness highlight difference with a flat-normal/compression control.
The new case revision has **not** been recooked and tested as a packaged game;
earlier package evidence belongs to a different material revision. Live Unreal
PIE-state survival, shader anisotropy, GPU generation speed and publication remain
unqualified. Keep this local and optional until those selected release gates pass.
