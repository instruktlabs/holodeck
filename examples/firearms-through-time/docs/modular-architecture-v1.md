# Modular architecture v1

Three new saved Kiln candidates fill gaps around the existing facility v5 bay and booth: a repeatable canopy, a post-mounted end infill, and a narrow gallery connector. They follow the charcoal framing, pale concrete and restrained oak of the viewed concept 04 and STYLE-GUIDE v0.3. Concept 04 remains a preferred working direction, not final owner acceptance. No fixed lane count or world layout is implied.

Exact saved IDs, source/GLB/preview paths and SHA-256 hashes are in `evidence/modular-architecture-v1-inventory.json`; detailed evidence is in `evidence/modular-architecture-v1-summary.json`. The separate integration pins are `authoring/modular-architecture-v1-pins.json`. Saved source is authoritative; early generator/draft files are historical and must not replace the final `*-delivery.kiln.js` sources.

| Module | Triangles | Draws before batching | Final draws | Materials |
|---|---:|---:|---:|---:|
| Canopy bay | 2,556 | 13 | 4 | 4 |
| End infill | 984 | 6 | 3 | 3 |
| Gallery connector | 728 | 11 | 7 | 6 |
| Total | 4,268 | 30 | 14 | Shared roles; see inventory |

The before/after comparison uses the fitted geometry, including the gallery closure repair. Static geometry is combined by rigid owner and material. Original part roles survive as `Part_*` nodes with `sourceBounds`; explicit `Snap_*` nodes remain unchanged. The gallery's `Mesh_ArtworkInsert` remains separate for later content binding. The verification script compares decoded triangles, normals, UVs and material assignments to 1e-6, plus exact snap anchors, material definitions and embedded image hashes. All comparisons pass. It does not certify destination behavior.

The canopy and end infill have no texture images. The gallery reuses the existing pinned procedural natural oak: three 2048×1024 images, 25,165,824 decoded RGBA8 bytes, approximately 33,554,433 bytes with mipmaps. This is texture storage accounting, not observed VRAM use. No new external imagery, LODs, texture compression or runtime deduplication claims are included.

## Placement and anchors

All dimensions are meters in the existing asset frame: +X faces toward the range, +Y is up, +Z is right. Preserve root pivots and scale 1. The destination adapter must explicitly convert this frame into its own axis convention.

**CanopyBay:** Ground-origin module with post centers X=-0.85/1.25, Z=±1.17. Roof top is Y=3.08; the header underside is Y=2.82. `Snap_BoothOrigin` places the existing booth at the same origin. Repeat at 2.6 m along Z using `Snap_RepeatLeft/Right`; adjacent roofs retain a 9 mm seam and footing edges retain 40 mm clearance. Complete repeated units deliberately retain paired posts. `Snap_Post_*`, `Snap_EndPanelLeft/Right` and `Snap_RoofDatum` expose support and assembly positions. It is overhead architecture, not a walkable upper deck.

**BankEndInfill:** Mount at `CanopyBay/Snap_EndPanelRight` ([0,0,1.17]) with matching orientation. `Snap_PostFront/Rear` match X=-0.85/1.25. The panel hangs above ground at Y=0.16, supported by tabs and spacers against the canopy posts. Its upper frame is open, with no transparent glass material. Use at a bank boundary; the existing booth already includes its own inner partitions. A left-side mirrored/rotated fit has not been qualified.

**GalleryConnector:** Place the connector between existing collection bays with their roots at `Snap_BayOriginLeft/Right` ([0,0,±1.65]). `Snap_InsertionLeft/Right` denote nominal ±0.4 m insertion edges, not whole-asset tiling pitch: the shelf is 0.992 m wide and intentionally overhangs toward the neighboring bay shelves. Shelf front X=0.295 and top Y=0.9475 match the bays; total top Y=2.44 also matches. `Snap_ArtFace`, `Snap_ShelfFront` and `Snap_BayTop` expose content/alignment datums. Dark return strips close the bay setback above the existing base fixings. The artwork insert is intentionally blank.

## Review and limits

The multi-side GPU sheets, canopy underside views and final four-view assembly were opened and inspected. Saved previews are material-faithful, exact-artifact renders whose input GLB hashes match the saved files. The assembly uses the exact existing bay and booth source programs; it is a fitting jig, not a proposed destination layout. The earlier gallery light gap was closed with dark returns and the shelf was widened to meet adjacent shelves.

The measured booth-to-canopy header clearance is 0.60 m; booth-to-post is 0.18 m; booth-to-end-infill is 0.20 m. All 22 selected attachment interfaces report zero surface distance, including intended contacts/overlaps. These checks do not prove structural engineering, passage clearance or physics behavior. The assembly QA has 37 duplicate-name warnings from repeated asset roots: use full instance paths when resolving anchors. Its overlap analysis is partial (64/138 candidate pairs tested; 18 unmeasurable and 56 beyond the budget), so it is not a complete collision certificate.

Integration still needs destination actor/catalog registration, deliberate placement, collision proxies derived from the retained part bounds, material/texture reuse, instance-path handling, and actual traversal and interaction checks. Provide rights-cleared artwork before filling the blank insert. No game code, canonical pins, shared world or native maps were edited by this batch. No performance verdict is possible while both PC and hub are under load.

Recheck local delivery evidence from `authoring/` with `node modular-architecture-v1-verify.mjs` followed by `node modular-architecture-v1-inventory.mjs`. The latter asserts source, GLB and preview hashes against the saved revisions and writes this batch's inventory only.

Parent review note: final assembly continuity was inspected. The exact saved gallery top view shows fine striping along a narrow backing/trim interface; close-up depth/overlap review is still required before destination art approval. This candidate is not final hero-art acceptance.
