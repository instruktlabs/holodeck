# Carbine v1 — saved catalog-form exterior candidate

Original procedural **Colt M4 R0977 catalog-form interpretation** saved for review. This is a proposed representative, not a confirmed entry in the unresolved 60-item roster. Destination integration and owner acceptance are pending.

## Exact artifact

- Asset: `a_b50808618ce54c1386d12212e186cc47`; revision: `r_74666f57c86c43fb91cdc9252736d017`.
- Program: `p_ccdef5ee6caf`; exact editable source export: `authoring/firearm-carbine-v1-qualified.kiln.js`.
- Saved GLB: `authoring/assets/kiln/a_b50808618ce54c1386d12212e186cc47/revisions/r_74666f57c86c43fb91cdc9252736d017/asset.glb`.
- GLB SHA-256: `8191fc5512b37a03738b807f06a042e5e261e93b73678d4880d1faa1e51fded1`.
- Source SHA-256: `ccdef5ee6caf27617e8adf1d8d7e3d9b6bf721c9aec61f0812474fd9ad76019c`.
- Pin: `authoring/firearm-carbine-v1-pins.json`; machine-readable report: `evidence/firearm-carbine-v1-summary.json`.
- Declared model/harness: gpt-6-astra / codex. High reasoning requested, not manifest-verifiable.

## Reference and rights

The [pre-modeling dossier](firearm-carbine-v1-reference-dossier.md) records source selection, era uncertainty and image inspection. Colt's [2024 catalog p24](https://www.colt.com/wp-content/uploads/2024/08/2024-Colt-MLE-Catalogweb.pdf) governs the selected R0977 configuration: ribbed polymer handguard, carry handle, fixed front sight, extended sliding stock and metal magazine. The viewed [2026 catalog p8](https://www.colt.com/wp-content/uploads/2026/02/25-COLT-1930-COLLATERAL-2026-MLE-Catalog-RND7-FINAL-Paperturn-Single-Pages.pdf) adds related-family receiver-side cues only. Colt's [timeline](https://www.colt.com/timeline/) supplies a 1994 family milestone, not a date for every pictured component. [AWM REL47829](https://www.awm.gov.au/collection/C2084113) is a different specimen consulted as text to avoid generic accessory mixing.

Reference PDFs/page images are copyrighted private-study files, excluded from delivery and review-board embedding. Original geometry and two procedural maps contain no copied reference pixels, logos, serials or scans. Original-art authorship does not establish permission to reproduce reference images or use trademarks publicly.

## Review and costs

Actually viewed final four-angle sheet `evidence/firearm-carbine-v1/final-review.png`, six-detail sheet `final-detail-review.png`, and saved six-view `preview.png`. Saved preview reports full-material GPU fidelity and exactArtifact=true. Custom sheets were rendered in-loop, exactArtifact=false, but their input GLB SHA-256 exactly equals the saved file. No owner approval is implied by Kiln acceptance.

| Metric | Saved candidate |
|---|---:|
| Triangles | 13,596 |
| Draw primitives / materials | 16 / 5 |
| GLB bytes | 840,612 |
| Maps | 2 original 256 × 256 PNGs |
| Decoded RGBA8 / estimated mip bytes | 524,288 / 699,052 |
| Bounds X × Y × Z | 0.86090 × 0.29205 × 0.05971 m |
| Nonfinite vertices / degenerate triangles | 0 / 0 |
| Transparency / double-sided materials | none / none |

Static geometry is batched by material within seven presentation groups; carry handle, magazine, stock and charging handle remain separable. This retains 16 primitives rather than flattening future moving parts. Static display instances can share immutable resources. No LOD is supplied: destination silhouette/distance and hand requirements should govern the next reduction. Costs are structural; PC and hub timing is contaminated.

## Geometry and fitting evidence

`evidence/firearm-carbine-v1/saved-geometry-audit.json` parses the exact saved GLB. A center ray passes through the muzzle mouth and first hits a blind termination; an off-center rim ray hits the lip. The authored visual setback is 0.036 asset metres. Axial and both oblique GPU closeups show the rim, receding inner wall, slots and parallax. These are artistic exterior details, not real weapon dimensions or a functional bore. Trigger-well, carry-handle and sight-frame transverse rays miss geometry in their intended gaps.

The receiver-to-stock, handguard, magazine and carry-handle surface checks report zero minimum distance. This establishes static contact/crossing only. QA records five observations: intentional joined/embedded overlaps and incomplete pair-volume coverage for nonmanifold/open/batched parts. It does not certify solid clearance, every internal overlap or moving-part clearance.

Metres, +X forward, +Y up, +Z right; origin at receiver reference. Group names: `Joint_Receiver`, `Joint_Stock`, `Joint_Handguard`, `Joint_Magazine`, `Joint_CarryHandle`, `Joint_ChargingHandle`, `Joint_Muzzle`. Render mesh is not a physics collider; destination should supply coarse selection/collision hulls.

| Anchor | World XYZ metres |
|---|---|
| anchor_mount_carry_handle | -0.0600, 0.1164, 0.0000 |
| anchor_hand_right | -0.1310, -0.0201, 0.0147 |
| anchor_hand_left | 0.1550, 0.0576, -0.0182 |
| anchor_grip_primary | -0.1360, -0.0145, 0.0000 |
| anchor_grip_support | 0.1570, 0.0660, 0.0000 |
| anchor_sight_rear | -0.1410, 0.1619, 0.0000 |
| anchor_sight_front | 0.2930, 0.1619, 0.0000 |
| anchor_vfx_muzzle | 0.4840, 0.0800, 0.0000 |
| anchor_interaction_magazine | 0.0210, -0.0600, 0.0119 |
| anchor_support_butt | -0.3750, 0.0480, 0.0000 |
| anchor_mount_receiver_top | -0.0600, 0.1164, 0.0000 |

The two carry-handle mount anchors coincide exactly. Only `carbine-v1-carry-handle` is proposed for this receiver-top slot; it is installed in the source. No alternative optic, quad rail, suppressor or launcher is declared compatible. Anchors are visual assembly targets, not validated hands or real accessory specifications.

## Remaining gates

- Reference-informed original exterior candidate, not an approved roster entry or museum replica; authoritative 60-item roster unresolved.
- Receiver, carry handle and stock still have broad simplified planar faces at close range; no historic logos, markings or serials.
- Exact muzzle front/slot layout and blind cavity are authored estimates; only side-profile reference qualifies the exterior family silhouette.
- Original 256px procedural roughness/metallic-roughness maps; no normal-map or authored wear pass. Dedicated raking-light review remains pending.
- Static contact distances of zero indicate touching/crossing, not penetration clearance. QA observes intentional embedded/joined overlaps and partial nonmanifold pair coverage.
- Only included carry-handle mount is demonstrated in the rest pose. No runtime attachment swapping, alternate accessories or shared attachment-contract edits.
- Hands, sight/camera fit, inspect/reload/fire/stock animation, collision, browser/native integration and owner acceptance pending.
- No LOD supplied; preserve separate animation/attachment groups until destination distance and silhouette requirements are known.
- PC and hub were under load. Timing/FPS evidence is contaminated; structural counts only, no performance or AAA verdict.

Integration needs: assign a reviewed roster entry; assemble approved hands and validate fingers/palms, camera sight line and projected first-person scale; author presentation animations; implement only the candidate-specific attachment allowlist; import the exact pin and inspect destination readback, material render and interaction; define coarse collision and distance-driven LOD; obtain owner acceptance. No canonical or destination files were changed by this lane.
