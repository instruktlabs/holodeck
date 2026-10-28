# Natural wood, end grain and destination lighting

Recorded 2026-10-26. Local optional Kiln extension study, Kiln 1.5.0,
Unreal 5.8.4 CL58902052 D3D12/SM6 and Holodeck WebGPU.

## Material result

The case now has finer growth lines, grain that bends around knots, independent
board variation and dedicated cut-end grain. The atlas uses one material slot;
long faces and board ends select different regions by face orientation. The
case's metal frame hides many end faces, so a separate timber specimen makes
the mapping easier to inspect. It is a floating material fixture, not a finished
placed game prop.

![Updated case in both engines](../evidence/natural-wood-engine-comparison.png)

Unchanged-scale crops. Unreal uses full texture residency for this capture;
Holodeck uses WebGPU. Backgrounds, shadows and some highlights still differ.

![Six-view timber inspection](../evidence/timber-specimen-kiln.png)

This improves the regular striped appearance of the first recipe. It is still
a procedural approximation: the long-grain field and end rings are independently
constructed, not cross-sections through one coherent 3D tree volume. Geometric
chips, split fibers, bevel transitions, distant atlas mips and anisotropic wood
shading are not qualified by this trial.

## Reusable recipe and mapping

`pipeline/wood-natural-recipe.mjs` version 0.2.0 preserves the earlier 0.1.0 recipe.
`materials/procedural-wood/natural.json` exposes seed, color, grain frequency/bend,
knot count/strength, pore strength, roughness, relief and physical dimensions.
No source images or downloaded scan pixels are used. Shortlist references are
inspiration and retain their own identities and licenses.

The output is a 2048 x 1024 atlas: two 1024-square regions, each with 16-pixel
extruded gutters. Usable long grain represents 1.2 m and end grain 0.6 m. The
whole atlas is not a repeating tile. The face mapper uses the declared timber
axis, keeps UVs inside the selected region and rejects boards too large for that
region instead of silently wrapping across it. Different boards use deterministic
offsets. See `authoring/timber-atlas-uv.js.txt` and the saved case source.

Base color is sRGB; normals are linear, tangent-space +Y; ORM is linear with
AO=1 and metal=0. Relief comes from a dedicated height field. Physical dimensions
scale normal derivatives independently for each atlas region. Color contains no
baked light or shadows. The natural preset uses roughness 0.70 and 0.12 mm relief.

The 2-megapixel CPU bake took 23.36 seconds, 28.59 seconds including import on this
workstation. This is slower than the simpler 1K trial and is not a GPU benchmark.
Cache the sampled height field before considering GPU synthesis; the current
implementation evaluates neighbors repeatedly for derivatives. Keep changed
recipes under a new version and pin. Destination rendering already uses the GPU.

## What was checked

| Check | Current evidence |
| --- | --- |
| Deterministic recipe | Same inputs reproduce pixels on this JS runtime; seed and knot controls affect color; roughness-only changes leave color/normal alone. |
| Map semantics | Distinct end field, valid encoded normals, AO=1/metal=0, correct gutter replication, invalid parameter rejection. |
| Saved case geometry | Positions, normals, indices, nodes, hinge and material slots identical to the parent. Only wood UVs/material data changed. Non-wood UVs are unchanged. |
| Atlas assignment | 72 timber triangles use end grain and 144 use long grain; none cross atlas regions. |
| Native import | Ten exported source-art images match source GLB pixels: seven case and three specimen. GPU block compression is a separate step. |
| Native preservation | Same actor/component/mesh identities, bounds and hinge. Painted-frame and steel override bytes and roughness values 0.18/0.72 remain unchanged. |
| Native interaction | Nine editor-game assertions passed: parts, closed start, intermediate angle, open limit, stable body/pivot, lid lift, close, reopen and reset. |
| Holodeck preservation | Entire case scene unchanged except asset file/provenance. Paused displayed time 294.30 s and lid angle -1.83 rad survived replacement; rounded UI evidence retained. |
| Holodeck interaction | Reset returned the lid to 0.00 rad; subsequent opening observed and captured. |
| Holodeck delivery | Both exact saved source hashes, host-derived GLBs and all shared texture bytes verified. |

Case asset `a_97a44d3c5d574dab9d9c4994cf6d2be3`, revision
`r_e748864a864b4f3fbabb7a165d336fe1`, program `p_16a9307f2cbc`.
GLB SHA256 `4ca3de4b451e4e050f521709e193432ff6ac216a5ac83b598c0b7da619b8e5a0`,
4,065,444 bytes. Holodeck case world revision 17 on port 4196.

Timber asset `a_f2ecbc9f6e674b188b74d84ec423624b`, revision
`r_664404df27d142129fdbb8250ed67b80`, program `p_7ee7a558dfdb`.
Holodeck specimen world revision 4 on port 4198; native map NaturalWoodLab.
Material pin `procedural-wood-natural-v1` /
`sha256:626c86309dcd86200d60a950aee19d89263aec6e2d051ad8745500827d912b51`.

## Lighting diagnosis

The earlier smoother frontal panel was brighter in Unreal. This pass separates
light-source angular size, normal contribution and texture residency. The lab
uses fixed exposure, no environment illumination, a 63-degree vertical FOV and
matching camera/light vectors. These controls are diagnostic settings, not a
recommended production lighting rig.

The repaired three-panel fixture rendered valid materials after a GPU editor
compile, explicit Nanite material usage and conventional raster components.
NormalScale=0 persisted after reopening the project. The native directional
light uses zero angular size; the Holodeck control has no normal map. The
previous native source angle was 0.5357 degrees.

Mean screenshot RGB differences, Unreal minus Holodeck in 0–255 code values:

| Surface | Flat normals, zero native source angle |
| --- | --- |
| Scanned reference | +0.01, -0.24, +0.12 |
| Generated dry | +2.78, +5.17, +6.35 |
| Generated lower roughness | +9.59, +12.68, +14.59 |

The smoother frontal highlight remains stronger in Unreal. Normal relief and
finite directional-source size do not explain the whole mismatch. This test
changed both controls relative to the old baseline; it does not estimate each
contribution separately. The remaining diagnosis is destination specular/BRDF,
roughness sampling/compression and tone mapping. Do not tint source albedo to
hide it. These means measure fixed interior image patches, not perceptual error
or full material equivalence. See `natural-wood-render-comparison.json`.

The default-streaming native case capture lost fine grain. Repeating with
`run-opening-case.ps1 -FullTextureResidency` restored it while preserving all
nine interaction checks. This isolates a streaming-dependent detail loss, not a
missing source texture or UV change. The flag applies only to that launched
process. It is a diagnostic capture control, not a shipping streaming policy.
Production needs a warm-up/readiness gate, rebuilt streaming data after UV/scale
changes and measured texture budgets. No global rendering setting was changed.

Repeat the qualified case capture with:

```powershell
pwsh -File pipeline/run-opening-case.ps1 -FullTextureResidency
```

The small specimen uses the same isolated option:

```powershell
pwsh -File pipeline/capture-calibration.ps1 -Map NaturalWoodLab -Label timber-review -FullTextureResidency
```

Use a fresh label to preserve earlier evidence. Inspect the image after checking
the exit status and fallback warnings. These launch an editor-game process and
exit automatically; they do not leave a native editor open.

A completed screenshot file alone is not a passing lighting test. The separate
timber specimen also required conventional rendering after its Nanite capture
continued to show fallback despite a clean warning scan. Native Nanite material
qualification remains a separate gate from this small low-poly content workflow.
The final `calibration-native-natural-timber-resident.png` was inspected: the
board renders its grain with conventional rendering and full texture residency.
`natural-wood-visual-review.json` identifies the usable and excluded captures.

### Obstacles and guardrails

- Duplicating a World through the generic asset API crashed this UE build.
  Reconstructed a small bounded fixture from its known meshes and camera instead.
- Some newly imported/cloned materials rendered checkerboard fallback because
  their Nanite usage was not ready for the game process. Disabling Nanite on the
  fixture components alone did not fix the captures. Those images are excluded.
- Capture logs now reject reported material fallback. One checkerboard image
  had no matching warning, so visual inspection remains mandatory.
- Setter return values and guessed switch names are insufficient proof. Discover
  actual material parameters and read their values back. The diagnostic uses
  the imported parent's NormalScale parameter for the flat-normal control.
  On this UE build the scalar setter returned false while read-back changed
  NormalScale from 1 to 0. This caused two early assertion failures; value
  read-back and a saved receipt resolved the ambiguity. The requested texture
  switches do exist on this parent; their return booleans alone were misleading.
- Native case detail was softer than the Holodeck image despite equal source
  pixels. A separate full-residency capture tests streaming without altering
  portable colors or changing the user's global engine configuration.

Official references: [material-editing API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MaterialEditingLibrary),
[directional lights](https://dev.epicgames.com/documentation/unreal-engine/directional-lights-in-unreal-engine),
and [texture streaming controls](https://dev.epicgames.com/documentation/unreal-engine/texture-streaming-configuration-in-unreal-engine).

## Extension boundary and next content

Promote the original recipe, physical atlas contract, face mapper, immutable pins
and source-pixel verifier into a common optional material-tool layer after reuse
on production content. Keep material compilation, native usage flags, texture
residency diagnostics and Unreal captures in the Unreal adapter. Holodeck keeps
its existing proposal/review/apply flow. No global skills or engine files changed.

The workspace is ready to start the [first asset slice](first-asset-slice.md): a
collection bay, booth/console and target module in the modern range, followed by
a reference-qualified historical prop. Keep lighting fixtures alongside this
work. A complete campus and perfect renderer equality are not entry gates.

This revision has not been recooked or tested as a packaged game. Earlier
packaging receipts belong to earlier revisions. No live Unreal PIE-state
preservation, WebGL2 rerun, performance qualification or public release is claimed.

Primary receipts: `natural-wood-recipe-tests.json`,
`natural-wood-geometry-uv-check.json`, `natural-wood-delivery-check.json`,
`natural-wood-case-native-result.json`, `natural-timber-native-result.json`,
`natural-wood-editor-game.json` and `natural-wood-case-ui-loaded.txt` in `evidence/`.
The later full-residency run is `natural-wood-editor-game-full-residency.json`;
shader/read-back evidence is `wood-control-gpu-compiled.json` and
`natural-wood-fixture-reopen.json`. Failed checkerboard captures are retained as
failure evidence and excluded from the quantitative comparison.
