# CastleKit material look-dev

A material study for the castle kit. `Shaders/CastleKit.shader`
(`LastCrossing/CastleKit`) is a hand-written URP shader: base colour x tiling
albedo x COLOR_0, with a normal map and packed ORM (R occlusion, G roughness,
B metallic). Run 01 tested UV-mapped tiling (`_CK_TILING`). Run 02 added three
material keywords, each off by default; with all three off the run-01 path is
unchanged:

- `_CK_TRIPLANAR`: world-space triplanar projection of the same maps, so UV0 is
  ignored.
- `_CK_MACRO`: zero-mean, low-frequency world-space albedo variation.
- `_CK_DETILE`: world-space de-tiling (two random tile offsets per region,
  blended) so the tile period stops showing on large faces.

The shader also carries a later cost-study path (`_CK_DETAIL`, and de-tile on UV
maps). Its scene, materials and scripts are not included here, and no included
material enables it. `CastleKitRun01Ref.shader` is the run-01 shader kept for the
regression comparison.

## Contents

- `LookDev.unity` (run 01): variants A (glTFast materials), B (flat Kiln factors)
  and C (`CK_C_*`, run-01 maps) on a tower and three wall bays.
- `LookDev02.unity` (run 02): B6 kit modules and a gorge terrain crop, with
  `CK_D_*` (run-02 maps and keywords) against C, flat-factor (`CK_F_*`),
  albedo-only (`CK_Dalb_*`), unlit material-id (`CK_ID_*`) and run-01-shader
  (`CK_R_*`, `CK_Cflat_*`) controls that the scene references.
- Editor builders: `Assets/Editor/LookDev/LookDevBuild.cs` and
  `LookDevBuild02.cs` rebuild the scenes and materials from `lookdev-inputs.json`,
  `castlekit-remap.json` and `Run02/*.json`, after checking each GLB's SHA-256.
- Capture components: `Scripts/LookDevCapture.cs` and `LookDevCapture02.cs`
  write PNGs and `results.json` to `--output DIR` (default `LookDevOutput`
  beside the player's data folder).

The `CK_D_*` materials are saved as run 02 left them (macro on masonry, rock,
rubble and slate). They do not yet follow the recommendation below.

## Measured cost

GPU ms added per 1080p frame, measured on a laptop GPU at boost clock. Each pair
is at 7 m / 3 m camera distance.

| Keyword | Masonry | Rock |
| --- | --- | --- |
| Triplanar | ≈0 / ≈0 | +0.12 / +0.08 |
| Macro | +0.41 / +0.51 | +0.58 / +0.52 |
| De-tile | +0.19 / +0.22 | +0.28 / +0.24 |
| All three | +0.62 / +0.79 | +1.05 / +0.95 |

The base frame is 0.44–0.56 ms. Texture memory does not depend on the keywords.
The macro's value at 25–60 m was not measured.

## Recommendation

- Terrain and rock skins: triplanar plus de-tile.
- Rock macro: on hold. It is the most expensive keyword and is not visible at
  7 m or 3 m.
- Limestone and granite on assets with UV0 in metres: stay UV-mapped, with
  triplanar only as a fallback; no de-tile and no macro.
- Rubble and slate: stay as material D.
- Iron and oak: UV only.

## Map provenance

- `Textures/run02/ck-{limestone-ashlar,granite-ashlar,rock,rubble,iron}_*.png`:
  made by the seeded generator script `gen_maps.py` (version `run02-r6`) outside
  Kiln. Seeds: limestone ashlar 60201, granite ashlar 60301, rock 60401,
  rubble 60501, iron 60601. `Textures/run02/scripted-maps.json` records the
  generator hash, tile sizes, linear means and file hashes.
- `Textures/run02/kiln-ck-iron_*.png`: Kiln 1.6.0 procedural `ck-iron` export,
  byte copies; see `kiln-ck-iron.maps.json`.
- `Textures/ck-*.png` (run 01, also used by the D oak and slate materials):
  decoded unchanged from Kiln material export payloads; see `Textures/maps.json`.

## Licensing

The maps, materials, models, scenes, terrain crop and JSON data in this folder
are first-party content under CC0 1.0, as listed in the repository's
`LICENSING.md`. The shaders and C# scripts are code under MIT. The shader's hash
function follows Dave Hoskins' "Hash without Sine", and de-tiling follows Inigo
Quilez's texture-repetition article (technique 3).
