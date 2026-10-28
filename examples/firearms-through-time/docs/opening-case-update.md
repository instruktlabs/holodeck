# Opening case update qualification, 2026-10-26

Source `authoring/opening-case-update.kiln.js`, program `p_ac6b79f7f8a3`.
Same project asset `a_97a44d3c5d574dab9d9c4994cf6d2be3`; child revision
`r_b8eb01baa98d4382a2f1fba14e52c82a` of
`r_af7d41459c754cae97a806284cca1a3c`. Original source and delivery retained.
SHA-256 `fe8296e2fba5d54e18d736cb6f2d7c509dac89e194d98abcee848d42e1b69cd4`.

## Results

Changed olive paint to blue, paint roughness 1 -> .60, steel .38 -> .23,
and lid timber thickness .035 -> .055 m with its bottom fixed. Export comparison
found only four material-bearing nodes and one lid geometry node changed;
no added/removed nodes or transform changes. Same 3,044 triangles, nine meshes,
six materials/images. GPU contact sheet visually inspected.

Holodeck revision 12 -> 13 was applied through the proposal UI at paused -0.475
radians with the open target true. Exact state survived and all scene objects
stayed identical. Open/close/reopen/reset passed on WebGPU. WebGL2 loaded revision
13 after reload and passed the same controls; this was not a second independent
hot update. Source hash, served derivative and all six shared images verified.

Unreal destination remains `/Game/Qualification/OpeningCaseGenerated`.
Use the same basename `opening-case-delivery.glb` in a separate staging folder
to retain importer namespace without replacing the original delivery.
Explicitly reimport six generated materials and six textures, in addition to
meshes. Reapply the tested trilinear/simple-average mip profile and normal green
flip false, scoped to this source/importer path.

Before reimport, created two authored material instances outside generated
content: paint roughness .18 and steel .72, each bound to body and lid. Both
.uasset hashes and parameters survived unchanged; generated parents updated to
.60 and .23. Same actor, nine components, mesh and material bindings, hierarchy
and component transforms. Lid timber top changed 66 -> 68 cm; other bounds fixed.

Updated native D3D12/SM6 editor-game passed all nine existing checks: loaded parts,
closed/intermediate/open poses, body/pivot stability, lid lift, close, reopen,
reset. Actual browser and native open screenshots inspected. Native lighting and
deliberate material overrides mean pixel-identical output is not the criterion.
Rebuilt packaged D3D12/SM6 game also passed all nine checks with inspected captures.
Package/content hashes and results are in `evidence/opening-update-summary.json`.
No claim of live Unreal PIE state survival: native proof is saved reimport plus
a fresh runtime launch. Holodeck proof includes live transient state survival.

## Failures and reusable lessons

- First native harness expected an explicit RoughnessFactor on paint. Default 1
  is inherited and omitted locally. Read effective values and retain the full
  global parameter address for explicit authored overrides. No content loss.
- Python struct strings contain memory addresses. Normalize those before
  comparing persistent transforms across processes. The first comparison failed
  on addresses before import; retain the raw receipt alongside corrected evidence.
- Browser diagnostics update asynchronously after reset. An immediate WebGL2
  read was stale. Waiting for observed reset state passed without runtime changes.
- The first failed baseline exceeded the wrapper's bounded exit time and its
  owned process was stopped. Successful retries exited zero. Unrelated Unity and
  editor processes were left alone.
- Generated material names are indices. This qualifies a stable nine-part and
  material-order update, not arbitrary reorder/removal. A published adapter needs
  semantic surface-slot bindings and explicit conflict reporting.
- Preserve existing actor bindings and assert them; do not rebuild bindings to
  make a test pass. Back up native content before mutation and keep authored
  instances outside generated content.

Local qualification fixtures: `pipeline/opening_update_native.py` records baseline
then reimports/asserts; `pipeline/opening-update-browser.mjs` applies the one-time
live update (`--webgl-only` repeats only the reload/control check);
`pipeline/opening-update-review.mjs` captures unobscured views;
`pipeline/verify-holodeck-delivery.mjs --opening-update` checks delivery integrity.
These are local fixtures, not released general-purpose tooling.

## Evidence

- `evidence/opening-update-{edited,compare,render,saved}.json`
- `evidence/opening-update-native-{before,result}.json`
- `evidence/opening-update-holodeck-{webgpu,webgl,delivery}.json`
- `evidence/opening-update-review-{webgpu,webgl}.png`
- `evidence/opening-case-run-20261026T182145836Z/result.json` and three captures
- `evidence/opening-update-summary.json` binds final runtime and package receipts
