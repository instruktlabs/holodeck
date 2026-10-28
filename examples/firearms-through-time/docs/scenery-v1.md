# Scenery v1 — proposed quarry planting kit

Three original saved assets and one static groundcover LOD child. **Authoring candidates only; no destination integration or owner approval.** Exact hashes, bounds, contracts and costs are in [summary](../evidence/scenery-v1-summary.json) and [pins](../authoring/scenery-v1-pins.json).

## Reference evidence and interpretation

Actually inspected preferred [concept 04](../handoff/design/firearms-through-time/concepts/04-shared-concourse-direction.png): pale quarry cut/slopes with sparse muted scrub outside the range. The [style guide](../handoff/design/firearms-through-time/STYLE-GUIDE.md) explicitly assigns desaturated quarry stone #A99E8C and charcoal steel #30383C. These support the rock palette and sparse vegetation cue; they do not establish species, planting density or exact geometry. The current bible (revision 6 at audit) contains no approved planting specification. The [reference audit](../evidence/scenery-v1/reference-audit.json) retains the read-only bible snapshot and source hashes.

The planter is **an authored forecourt/perimeter proposal**, absent from concept 04. It must not be placed in the shared concourse or stair reservations without a clearance/sightline review. Earlier museum concepts are not current direction. No world, native map, canonical pin or review-board changes occurred.

## Saved artifacts

- **architectural-planter**: `a_3837b399f4854835a8378b092c1165b0` / `r_3c63abb1ec1d44c5b086858ce8ed991b` ([saved preview](../authoring/assets/kiln/a_3837b399f4854835a8378b092c1165b0/revisions/r_3c63abb1ec1d44c5b086858ce8ed991b/preview.png), [GLB](../authoring/assets/kiln/a_3837b399f4854835a8378b092c1165b0/revisions/r_3c63abb1ec1d44c5b086858ce8ed991b/asset.glb), [source](../authoring/assets/kiln/a_3837b399f4854835a8378b092c1165b0/revisions/r_3c63abb1ec1d44c5b086858ce8ed991b/source.kiln.js)).
- **groundcover-clump**: `a_2de896af5e8e4a4faff607a4e512c40d` / `r_b22807da981c4134a95649a0d7c6fed5` ([saved preview](../authoring/assets/kiln/a_2de896af5e8e4a4faff607a4e512c40d/revisions/r_b22807da981c4134a95649a0d7c6fed5/preview.png), [GLB](../authoring/assets/kiln/a_2de896af5e8e4a4faff607a4e512c40d/revisions/r_b22807da981c4134a95649a0d7c6fed5/asset.glb), [source](../authoring/assets/kiln/a_2de896af5e8e4a4faff607a4e512c40d/revisions/r_b22807da981c4134a95649a0d7c6fed5/source.kiln.js)).
- **quarry-edge-cluster**: `a_02617d58906d49e8883ff2577a836010` / `r_b448544f190b44fd9b1b9795884c0a47` ([saved preview](../authoring/assets/kiln/a_02617d58906d49e8883ff2577a836010/revisions/r_b448544f190b44fd9b1b9795884c0a47/preview.png), [GLB](../authoring/assets/kiln/a_02617d58906d49e8883ff2577a836010/revisions/r_b448544f190b44fd9b1b9795884c0a47/asset.glb), [source](../authoring/assets/kiln/a_02617d58906d49e8883ff2577a836010/revisions/r_b448544f190b44fd9b1b9795884c0a47/source.kiln.js)).
- **groundcover-lod1**: `a_2de896af5e8e4a4faff607a4e512c40d` / `r_097bbd33c07449f4b196cda6a3cf5a30` ([saved preview](../authoring/assets/kiln/a_2de896af5e8e4a4faff607a4e512c40d/revisions/r_097bbd33c07449f4b196cda6a3cf5a30/preview.png), [GLB](../authoring/assets/kiln/a_2de896af5e8e4a4faff607a4e512c40d/revisions/r_097bbd33c07449f4b196cda6a3cf5a30/asset.glb), [source](../authoring/assets/kiln/a_2de896af5e8e4a4faff607a4e512c40d/revisions/r_097bbd33c07449f4b196cda6a3cf5a30/source.kiln.js)).

All are in collection `project`. Source, GLB and preview file hashes were independently checked. Each exact saved six-view GPU preview reports materialFaithful=true and exactArtifact=true and was visually inspected. Final four-view construction sheets add top/rear/underside review; their in-loop receipts correctly report exactArtifact=false. Auto-QA acceptance is not owner acceptance.

| Asset | Triangles | Draws | Materials | Measured XYZ metres | GLB |
|---|---:|---:|---:|---|---:|
| architectural-planter | 4,852 | 7 | 7 | 0.843 × 1.053 × 1.633 | 346.2 KiB |
| groundcover-clump | 2,618 | 3 | 3 | 0.944 × 0.304 × 0.930 | 202.2 KiB |
| quarry-edge-cluster | 576 | 3 | 3 | 2.138 × 0.624 × 1.365 | 45.0 KiB |
| groundcover-lod1 | 630 | 2 | 2 | 0.924 × 0.303 × 0.930 | 50.1 KiB |

All four use **zero maps, zero external material dependencies, zero decoded image memory, opaque single-sided materials**. Leaves/blades are closed narrow solids, not alpha cards. Opaque overlaps still have depth/shadow/geometry costs; zero alpha does not prove low GPU cost. One of each base asset totals 8,046 triangles and 13 material draws. Per-asset batching groups static geometry by surface role; scene instancing is not installed.

Groundcover LOD1 reduces 2,618 → 630 triangles (75.9%) and 3 → 2 draws. It keeps seven tuft centers and ground origin, but fewer blades and two segments give a sparser angular silhouette. Width shrinks about 0.021 m. It is a separate child artifact, not an embedded automatic LOD chain; destination selection/transition thresholds remain untested. The 576-triangle rock cluster does not justify another geometry LOD at this stage.

## Placement and construction

- **Planter:** origin at ground-center Y=0; container 0.72 X × 0.62 Y × 1.60 Z m, soil top Y=0.55. Closed steel shell, supported base/plinth, returned rim, 38 small opaque gravel pieces, three simplified evergreen-like shrubs and four sedge-like tufts. The collision proposal is the container box; foliage is nonblocking. Overall foliage extends beyond the container. Five exported merged-role surface checks are complete at zero distance (steel/soil, soil/bark, soil/gravel, bark/each leaf tone); these do not prove every individual join.
- **Groundcover:** anchor [0,0,0]; roots start at Y=-0.012 m for terrain embedding. Seven sparse tufts, 119 full-detail blades or 63 low-detail blades. No ground disk or collision is baked. Adapter must position/project it on actual terrain and avoid walk routes.
- **Rock cluster:** ground plane Y=0, three main angular stones plus six spalls. A first saved revision exposed a lower side point 0.017 m below zero; final child corrects it while preserving topology. Embed about 0.03–0.06 m into host terrain to hide seams. Proposed coarse blockers per large stone are only a starting intent; use measured destination collision or convex proxies. This is not walkable terrain or a rock wall.

## Rights, limits and qualification

All geometry is original editable procedural source. No third-party texture/image copying, downloaded foliage, photogrammetry, or reference-pixel baking. Materials are authored palette values with PBR factors. No new library resources or engine code were created.

The vegetation remains stylized and sparse, without botanical identity, wind, translucency or fine texture. Thin tips can alias. Stone is visibly faceted and lacks microtexture/strata; it is a medium/background dressing candidate, not a hero rock. Review lighting is dark on the charcoal shell; no albedo compensation was applied. Slope fitting, near/far stability, shadows, destination material fidelity, repeated placement and native import all remain pending.

The hub and workstation are under load. **No timing, FPS or performance verdict** is made. Structural geometry/material/texture counts and saved artifact identities are the only cost claims.
