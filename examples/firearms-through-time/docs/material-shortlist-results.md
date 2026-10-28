# Material shortlist and continuous-grain case

Historical scan/shortlist experiment. The subsequent original-recipe trial and
current case revision are in [procedural wood results](procedural-wood-results.md).

Recorded 2026-10-26. Local prototype: Kiln 1.5.0, Unreal 5.8.4, Holodeck WebGPU
and WebGL2. The original veneer revision remains available.

## Case result

Poly Haven **Fine Grained Wood** fits the individual case boards better than the
earlier panelled veneer. Grain follows the standing boards and lid; deterministic
UV offsets reduce obvious repetition. Measured repeat is 0.6 × 0.6 metres.
The current provider dimensions and asset page agree, but its legacy API `scale`
field says `30x30CM`. We kept both values in the catalog and used current dimensions.
Do not silently trust a provider's first available scale field.

Saved child `r_f86712dfed19484488af97a741eeb6cd` of
`r_e23d7ff0476e4eb98b9920143975224e`, asset
`a_97a44d3c5d574dab9d9c4994cf6d2be3`, program `p_a97616d49725`.
GLB SHA256 `9c5032f4d316d0d16937091b95cd72d47c0e3b73934d82ae956f19fc62aefacf`.
4,952,404 bytes, 3,044 triangles, nine meshes, six materials. Saved comparison:
geometry and bounds identical; UVs intentionally changed. There is no dedicated
end-grain texture yet.

- Holodeck case world revision 15: the entire saved scene was unchanged except
  case file/provenance. Paused activity remained at displayed 339.00 s and lid
  angle -0.13 rad after the asset loaded, then resumed opening. These are UI
  rounded values, not exact floating-point assertions.
- Unreal: actor/component bindings, hinge transforms and native override files
  were preserved. All seven exported source images equal the GLB image pixels.
  The editor-game run passed all nine open/close/reset checks and produced
  closed/intermediate/open captures. Transient PIE-state survival is untested.
- This revision was not recooked and tested as a packaged game. The previous
  packaged proof belongs to the veneer revision and must not be reused as proof
  for this one.

Evidence: `fine-wood-case-saved.json`, `fine-wood-native-result.json`,
`fine-wood-native-texture-repair.json`, `fine-wood-native-pixel-check.json`,
`fine-wood-editor-game.json`, `fine-wood-holodeck-delivery.json` and the UI text
receipts in `../evidence/`.

## Seven-surface first pass

Each surface is a separate saved one-metre swatch with an exact material pin.
This also bounds each build's resource closure; importing the entire library into
every asset would waste memory and exceed the material library pixel budget.
The neutral frontal-light gallery is a separate Holodeck world on port 4197 and
Unreal map `/Game/Qualification/MaterialLibraryLab`.

| Surface | Current use decision | Procedural research direction |
| --- | --- | --- |
| Fine Grained Wood | Preferred case wood; dark interiors need care | Directional pores, grain waves, scratches, roughness |
| Weathered Brown Planks | Broad plank surfaces; baked seams must fit geometry | Board widths, knots, bleaching, seam masks |
| White Plaster 02 | Worn plaster; visibly mottled rather than clean white | Broad patches plus fine pores |
| Concrete Floor 02 | Rough industrial surface; horizontal view still needed | Aggregate scale, stains, wear polish |
| Corrugated Iron | Conditional; modeled ribs needed near silhouette | Rib pitch/depth, oxidation, metal masks |
| Red Brick 03 | Readable masonry baseline at measured scale | Bond pattern, mortar width, edge wear |
| Stone Brick Wall 001 | Aged stone; close edges need relief geometry | Block distribution, joints, lichen |

All 21 vendor PNGs passed upstream size/MD5 checks, with local SHA256 provenance.
Normalization records RGB8 decoding; color is sRGB and normal/ARM are linear.
All 21 Unreal source-image exports matched the embedded GLB pixels. Holodeck's
pinned source, derived GLB and served texture bytes were also checked for all seven
swatches. Material-faithful Kiln GPU sheets and both Holodeck backends were reviewed.

The two web backends differed by at most 0.01 in sampled mean RGB channels.
Unreal's corrugated iron was about 17–19 code values darker than Holodeck in the
sampled patch; weathered wood and plaster also show visible smaller differences.
These means are diagnostic comparisons under one light/camera, not a visual
equivalence score. Metal needs an environment/roughness/compression investigation;
do not bake a compensating color tint into the source texture.

![Neutral light comparison](../evidence/shortlist-comparison.png)

Top row: fine wood, weathered planks, plaster, concrete. Bottom: iron, red brick,
stone. Backgrounds differ; measurements use interior surface regions only.

## What broke and what becomes reusable

1. The provider calls its color-map slot `Diffuse`, not a normalized `baseColor`
   name. Source adapters must inspect actual metadata and map semantics explicitly.
2. Existing Unreal Interchange texture identity can drift on reimport. The case
   adapter used semantic PNG names and explicit texture bindings/presence switches,
   followed by pixel readback. Native overrides stayed outside generated content.
3. Reloading an Unreal level invalidates Python UObject handles. The first
   post-repair assertion used a stale actor reference; reacquiring it and comparing
   persisted state succeeded. This was a verification harness error, not lost case
   state.
4. `CameraActor.auto_activate_for_player` needs `set_editor_property` in this
   Python API. The interrupted swatch setup was recovered without replacing a
   populated map.
5. A default runtime pawn intruded at the bottom of the first native gallery
   capture. Moving the panel group and camera together away from the origin keeps
   the same relative framing. Neutral lab fixtures must include capture hygiene.
6. The local editor's browser-file URL was blocked by browser policy. No bypass
   was attempted. Its UI remains unverified; syntax, schema and catalog validation
   are distinct from an interactive browser test.

## Next qualification gates

Run a grazing-light and environment-reflection test for iron; inspect near/far mip
transitions and compression artifacts for the seven surfaces; test a horizontal
concrete floor and modular masonry seams. Then implement one deterministic wood
recipe with directional grain, roughness and end grain, and compare it against
the scan using these same fixtures. Only promote adapters/recipes after repeated
evidence on representative assets. Keep all engine-specific tools opt-in.
