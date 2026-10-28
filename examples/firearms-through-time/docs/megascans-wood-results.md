# Megascans wood trial

2026-10-26. Local integration study for an optional Kiln extension. Source maps
and destination artifacts remain in this private workspace.

## Source and delivery

Selected [Quixel Wood Veneer Wall Panels](https://www.fab.com/listings/b514d475-4115-4012-88b0-f85c61fedca5), legacy ID `vlskbcz`, free when acquired.
User approved the Fab EULA; downloads became available after the dialog cleared.
The 2K texture set is 6,568,656 bytes; vendor glTF medium tier is 4,975,006 bytes.
The latter supplies already-packed PNG maps and avoids guessing how separate
JPEG normal/gloss/AO exports should be converted. Archives and hashes are kept
under `materials/private/megascans-vlskbcz/`.

Used vendor PNGs without pixel edits: base color, normal and ORM, each 1024 × 2048.
Scan coverage is 0.5 × 1 m. Base color is sRGB; normal/ORM are linear data.
ORM is R=AO, G=roughness, B=metallic. Blue is zero throughout, so wood is dielectric
despite its multiplicative metallic factor being 1. Mean source roughness is
0.5824, an image statistic rather than a fitted BRDF measurement. Normal convention
follows the vendor glTF positive-Y contract. No displacement, separate specular/gloss
model or procedural rebake was introduced. The [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)
defines channels/color spaces; the decoder's generic `srgb` label is not authoritative
for normal/ORM usage.

Kiln material `megascans-wood-veneer-vlskbcz`, revision
`sha256:e6683c86735d6cc56f990ad602ee9b13fbefaf633d23f5bb903aaebfd24199c6`.
Prepared through public material-library host APIs, then imported with the workspace
CLI. Exact pins accompany render/save. Asset source contains no texture paths or
network loaders.

Case asset `a_97a44d3c5d574dab9d9c4994cf6d2be3`, child
`r_e23d7ff0476e4eb98b9920143975224e`, program `p_667461e5bcd6`.
Parent `r_b8eb01baa98d4382a2f1fba14e52c82a` remains intact.
GLB SHA-256 `c353180322586e23fe2ff6e08b847036f58190fdc69f0cc4935c52fcb806f587`.
Size grew from 634,488 to 5,372,160 bytes. Seven images, six materials, nine draws,
3,044 triangles. Geometry, bounds and rest transforms are identical. Only the two
timber meshes change material/UVs: V scales by 0.5 to respect the rectangular scan.
Other components are unchanged in the exported comparison.

## What worked

- Kiln Dawn/D3D12 GPU render displays the actual imported maps.
- Holodeck revision 14 changes only the case file/provenance. Scene objects,
  behavior, environment and other assets stay unchanged. Pinned GLB and every
  served shared image match the saved delivery.
- A real WebGPU update retained paused lid angle -0.65 rad and activity clock
  36.37 s. Resume reached -1.83 rad; close, reopen and reset were observed.
  AX receipts and screenshots are in `evidence/megascans-holodeck-*`.
- Unreal keeps the actor, nine components, mesh paths, bounds and hinge transforms.
  Native paint roughness 0.18 and steel roughness 0.72, parent bindings and both
  authored `.uasset` hashes remain unchanged.
- After the repair below, all seven textures exported from Unreal have exactly
  the same decoded RGBA pixels as their GLB source images. This proves source-art
  identity, not equality after GPU compression, lighting or tone mapping.

## What broke, and the repair

Adding the wood normal shifted GLB image order. Reimporting existing Interchange
Texture2D assets by their old identities silently fed some assets the wrong new
images. Paint's normal became the 1024 × 2048 wood normal; the inventory label
changed dimensions. Material 0 retained the old shared normal and lacked its new
AO binding. Actor/reference checks and interaction checks alone missed this.

`pipeline/repair-megascans-textures.py` extracts embedded PNGs by explicit name,
imports into corresponding generated textures, applies sRGB/compression/mips, and
synchronizes texture parameters plus `bHas*Texture` switches from GLB slots.
Authored overrides stay outside that generated namespace. Normal textures use the
previously qualified `flip_green_channel=false` profile. ORM uses mask compression;
color uses default compression; normals use normal-map compression.

Unreal setters can return false when a value is already unchanged. The first repair
attempt incorrectly asserted those returns. The corrected script verifies resulting
bindings/switches instead. All seven source-pixel comparisons pass in
`megascans-native-pixel-check.json`.

Do not treat the initial `megascans-native-result.json` or the first editor-game
capture as a complete material pass: they precede repair. Final evidence must also
include repair, pixel verification and corrected runtime captures. The raw
Interchange script reproduces the failure; it is not a standalone update recipe.

Holodeck proposal review still says “no differences” for a file/provenance change.
The applied revision and delivered bytes do change; this remains a preview-summary
defect, not evidence that no update occurred.

## Visual curation decision

Corrected editor-game and freshly cooked packaged D3D12/SM6 runs each passed all
nine interaction checks. Captures are referenced by `megascans-editor-game.json`
and `megascans-packaged.json`. Both Holodeck WebGPU and WebGL2 display the new maps;
full close/reopen/reset and paused-update preservation were exercised on WebGPU.
WebGL2 was separately checked for loaded revision, appearance and full opening.

Matched 24 × 24 lid patches measure approximately RGB (130,105,86) in Unreal and
(123,92,69) in Holodeck. WebGPU/WebGL2 patch means differ by less than 0.3 code
levels across three sampled wood patches; native editor/package means differ by
less than 0.1. These are display-encoded image observations, not a colorimetric or
BRDF equivalence test. The native lid remains visibly lighter/less saturated.
See `megascans-render-patch-comparison.json` for regions and limits.

The scan has convincing grain and roughness detail, but its baked horizontal panel
grooves cross the case's modeled vertical slats. Local per-slat UVs repeat grain.
It is a useful pipeline test and a candidate for panelled walls, **not a recommended
default for timber case slats**. Next use continuous grain, deliberate orientation
and variation, and separate end-grain treatment. Higher resolution will not fix
these structural conflicts.

Native paint/steel overrides intentionally differ from portable materials.
Differences there are not wood-import failures. Full BRDF/HDR matching, shadow
softness, grazing-angle mips and production budgets remain separate qualifications.
Concurrent builds invalidate casual browser frame-time comparisons. No live Unreal
PIE state-survival claim is made.

## Optional catalog and tool boundary

`materials/catalog.json` starts a metadata-only catalog. Entries need source URL,
license/acquisition, scale, resolution, normal/packing conventions, intended uses,
seam/end-grain caveats, runtime receipts and explicit curation status. Import success
does not establish aesthetic suitability.

Link Fab assets for users to acquire themselves; do not ship these standalone maps
in a public extension. The [Fab license summary](https://www.fab.com/eula) permits
compatible tools and incorporation in projects but excludes standalone redistribution.
Use verified CC0 or original textures for bundled starters, retaining actual license
records. The listing's NoAI tag is retained; Epic describes it as prohibiting
generative-AI data collection in its [license documentation](https://dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab).
This trial binds existing maps with deterministic tools; it does not train a model
or submit maps to an image generator.

Candidate starter families: continuous/weathered wood, painted metal, bare steel,
rubber, concrete, stone, brick, plaster, fabric and soil. Keep the first set small
and qualified. Atlases differ from tiling surfaces; terrain/foliage need their own
scale, opacity and mip tests.

Seven concrete CC0 candidates are linked in [the starter shortlist](texture-starter-shortlist.md).
Their pages and license were checked, but their maps have not been downloaded or
qualified in either runtime. Keep that status separate from the completed veneer trial.

Keep acquisition/catalog metadata outside the engine; immutable maps/provenance and
portable pins in workspace resources; Unreal parameter mappings/import settings in
its optional adapter; Holodeck proposals/behavior in its world adapter. Do not put
account authentication, vendor downloads or engine assumptions into generic asset
programs. No extension or public release was published by this trial.
