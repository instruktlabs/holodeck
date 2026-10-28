# Wrist silhouette refinement v6

The owner identified lumpy wrists in the current first-person hands. The v5 wrist field used an offset, round-ended capsule overlapping a circular sleeve. It created an inflated heel and an abrupt sleeve intersection. V6 aligns the glove's wrist extension with the forearm direction, reduces its volume, flattens its cross-section, and gradually transitions the distal sleeve to an oval cuff.

Saved child: `a_42eb15873bde4c8fad62f46d032f42d8 / r_248b93182e044a78b525862b756fc663`, parent `r_3c71036a6dca494cb96c201e926f49e3`, program `p_5b63d8f033f8`. Exact source is `authoring/first-hands-v6-exact.kiln.js`; export is `authoring/first-hands-v6.glb`; canonical deliveries and `game/asset-pins.json` point to this child.

GLB SHA-256: `66c4393cafade7715bcea85a19d03db63329a3064c5e782a3933d76ac8e3d3c9`.

## Evidence

- [Exact exported comparison](../evidence/wrist-v6-preservation.json): unchanged 41-bone rig, inverse binds, all four animation channel/key/value sets, material definitions and embedded texture bytes. All distal contact vertex positions, bone indices and weights are identical to v5. This preserves the previous scoped fingertip tests; it does not certify every palm/cuff contact continuously.
- [Saved comparison](../evidence/wrist-v6-saved.json): 68,024 → 63,006 triangles, two draws, one material; overall bounds unchanged. The reduction is structural cost, not an FPS claim.
- [Regression tests](../evidence/wrist-v6-node-tests.txt): 20/20 existing tests pass, including rig, clips, IK, source pins and gameplay transitions.
- Holodeck WebGPU: exact hash-checked assets loaded; Ready, Inspect and Reload reviewed. Live fire and reload returned to 7/7, reserve 27, one shot/hit and charcoal grip retained. This is a reload-based asset update, not a new held-state hot-reload qualification.
- Unreal: imported to a new `first-hands-v6-combined` namespace, preserved the weapon actor/component bindings and effective native hand material assignments, then passed all 34 editor weapon checks. Native reload and inspect captures were visually reviewed. The rebuilt standalone package also passed 34/34 checks, and its reload capture was visually reviewed. Content-package hashes are in [the closeout receipt](../evidence/wrist-v6-summary.json).

![Holodeck reload wrist](../evidence/wrist-v6-holodeck-reload.png)

![Unreal reload wrist](../evidence/weapon-wrist-v6-editor-reload.png)

## Reusable tools and limits

The optional extension can expose a wrist/cuff profile with forearm-aligned continuation, independent width/depth and a controlled sleeve transition. Preserve hand goals, bone identities and animation timing when changing the silhouette. Compare exported contact vertices and weights, not just source text. Retain local material overrides when rebinding imported skeletal assets.

Kiln's generic revision comparison currently rejects skins (`Revision comparison does not support skins`). This is recorded, not treated as a pass; `pipeline/check-wrists-v6.mjs` supplies the bounded exact GLB comparison above. The first native attempt used a Python attribute not exposed on SkeletalMeshComponent; it stopped before import. The corrected adapter uses supported per-slot material getters/setters and verifies readback.

The gloves remain an anatomical/art prototype with a deliberate cuff seam. This pass does not make them final production hands or bind them to Maker's body. WebGL2 was not requalified for this revision. PC/hub load makes current timing and FPS unsuitable for a performance verdict.

