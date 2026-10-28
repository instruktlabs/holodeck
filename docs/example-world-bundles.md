# Portable example worlds

An example bundle is an editable scene and exact GLB assets, separate from a
playable static-site export. The local installer accepts a bundled example ID
or a directory already present on the machine:

```sh
holodeck init my-world --example construct
holodeck init my-world --bundle ./portable-example
```

Named bundles live at `examples/<id>/example.json` inside the package. The
included `tidemark` bundle installs through that same path with
`holodeck init my-world --example tidemark`. The world library consumes `listExamples()` metadata and
creates a new workspace through `scaffold(root, id)`. It does not open or edit
the packaged example in place. A library world ID belongs to the new workspace;
it is independent of the example ID, display title and bundle integrity digest.

## Format and integrity

The versioned format is `holodeck-example-v1`. It contains only:

- `example.json`: ID, public title/description, source revision, required world
  schema/runtime/module versions, world and asset receipts, and an integrity hash.
- `world/world.json`: a validated schema-v2 scene starting at revision zero.
- `assets/imports/<sha256>.glb`: the exact pinned GLBs used by the scene, origin
  and physical mood board.
- `assets/imports/terrain/<sha256>.png`, only when the terrain has
  `appearance.layers`: the exact pinned layer maps and paint masks. The manifest
  lists each under `textures` with its hash, byte count and dimensions.
- `assets/imports/terrain/<sha256>.r32`, only when the terrain is a heightmap:
  the exact pinned height samples. The manifest lists the file under `height`
  with its hash, byte count and sample size.
- Optional `preview.png`: an actual runtime screenshot, limited to 8 MiB and
  4096 pixels per dimension, with its own hash, byte count and dimensions.

Each receipt contains SHA-256 and byte size. The manifest `integrity` is SHA-256
over UTF-8 JSON with object keys recursively sorted, original array order, no
whitespace, and the `integrity` field omitted. It is independent of local folder
names, world library UUIDs and installation time. Integrity detects changes; it
does not establish publisher identity, license rights or visual acceptance.

Installation validates the manifest, exact inventory, every file hash, GLB
capabilities and scene limits before creating a destination. Capability records
must agree with `scene.runtime`. Unsupported versions or modules fail locally;
the installer does not fetch code or add capabilities. The current schema-v2
limits are 128 assets (`MAX_ASSETS`, measured; see [asset budget](architecture.md#asset-budget)),
1200 placements, 32 MiB per GLB, 128 MiB of assets and
two million placed source triangles, including every flock member. Legacy
schema-v1 scenes retain their 64-asset and 200-placement limits. Terrain layer textures keep
their own rules: at most 32 MiB of PNGs, counted inside the 128 MiB, and layer
maps square, power-of-two and one shared size. The listed textures must be
exactly the files the terrain names. A heightmap's height file must be the one
its terrain names, with `nx × nz × 4` bytes, the record's sha256 and finite
samples; it also counts inside the 128 MiB.

Only validated world data, GLBs, terrain PNGs, height samples and the optional preview enter an install. Bundle
scripts, plugins, session files, extra files and escaping paths are rejected.
Installed authoring skills come from the trusted Holodeck package, never from
the bundle. The install creates a fresh editable history when first opened.

The bundle is **scene-editable**: recipients can view the world, move or replace
assets, edit terrain and behavior, and save their own scene revisions. It is not
**procedural-source-editable**. Exact GLBs and Kiln provenance IDs do not include
the original private `.kiln` library or editable asset-authoring programs, and
those IDs do not grant access to the author's library. Exact-source asset
refinement therefore needs a separately available, authorized source artifact.

## Preparing a curated bundle

The Node-side `createExampleBundle(workspace, options)` reads an immutable
accepted receipt and rechecks pinned asset, terrain texture and height sample
hashes before copying. The terrain is repointed at the copies' content-addressed names. `options`
requires `out`, `id`, `title` and `description`; `revision` selects a specific
accepted revision. Optional `authoring: {intent, rules}` supplies public prose.
When omitted, those fields are blank. `preview` is a local path to a real
runtime PNG captured from the selected revision, preferably with the HUD hidden.
A generated concept image is not a runtime preview.

The projection clears board references, bible pins and the board page, while
retaining the physical board fixture, transforms and exact frame asset. Its
title becomes “World board”. It retains scene objects, terrain, water, foliage,
runtime behavior and exact required GLBs. Unused assets are omitted. Public
Kiln asset and revision IDs remain; provenance paths are removed. Raw bible
text, reference attachments, mutable asset sources, accepted receipts, agent
sessions, provider settings, research and workspace paths are not copied.

The writer rejects recognizable absolute paths in world or embedded GLB JSON
metadata. It never rewrites GLB bytes to conceal metadata: such an asset needs
an explicitly reviewed new revision. Automated projection cannot judge whether
arbitrary authored labels, geometry or embedded metadata disclose private work.
Review the resulting inventory, source rights and actual rendering separately
before adding a curated bundle to a distribution.

`readExampleManifest(directory)` supports cheap catalog metadata reads.
`readExamplePreview(directory)` verifies only the optional PNG and returns its
bytes, hash and dimensions, or `null`. `loadExamplePreview(id)` resolves a known
packaged example before reading that preview; a host can serve it through a
fixed authenticated image route without exposing arbitrary filesystem paths.
`readExampleBundle(directory)` performs full verification and returns
`{manifest, world, assets, textures, previewBytes}`. Each asset entry includes
its hash, relative file, geometry metrics and retained verified byte buffer.
Each texture entry, keyed by file, includes its dimensions, byte count and
verified bytes.
`installExampleBundle(directory, newWorkspace)` returns the installed world.
Both writer and installer refuse existing destinations. An interrupted output
retains an `EXAMPLE-INCOMPLETE.txt` or `INSTALL-INCOMPLETE.txt` marker; the library
must not treat it as ready. The same rule applies to `REMIX-INCOMPLETE.txt`.

## Repairing a pinned asset

When a placed asset has a defect, such as a cloth through a neighbouring module,
fix it in the separate Kiln workspace and save it as a new revision of the same
asset (`--asset <id> --parent <revision>`). Then re-pin the packaged examples
from that revision directory:

```sh
node scripts/repin-example-asset.mjs <kiln store>/assets/kiln/<assetId>/revisions/<revisionId>
```

`repinExampleAsset(directory, {assetId, revisionId, bytes})` verifies the whole
bundle first. In every example that places the asset, it writes the new
content-addressed GLB, updates the world's `file` and `provenance.revisionId`,
and refreshes the world and asset receipts and the integrity. It removes the old
GLB once nothing references it, then verifies the bundle again. Examples that
don't place the asset are left alone, and a second run reports them as already
pinned. `sourceRevision` stays the same, because only the asset changed, not the
authored scene. A run that fails partway leaves `EXAMPLE-INCOMPLETE.txt`. Restore
that bundle from version control and run it again.

The Cove's starter modules are not bundles. The script reports any module that
still pins the old revision. Update these by hand:

- `assets/cove/modules/<id>/`: `source.kiln.js`, `review.png` and
  `provenance.json`, with the parent revision.
- The module's entry in `assets/cove/modules/manifest.json`.
- `public/assets/cove-modules/<id>.glb`.

Authoring worlds pin assets through their own history, so commit their re-pin
through Holodeck. Kiln's QA checks a module on its own, so check a repair to
soft goods, or anything resting against another module, in the composed scene.
Retake every site image that shows the repaired asset. A capture scenario with
`maker: false` leaves the walker out of shots of a place.

## Future sharing boundary

The same versioned data contract can support downloadable worlds later. There
is currently no remote catalog, download pipeline, upload service, cloud storage
or publisher trust system. Any future transport must preserve immutable hashes,
bounded admission, declared capabilities, fresh-destination installation and
the prohibition on downloaded executable code or plugins. Transport and
publisher verification are separate from a valid scene bundle.

A future optional, curated public Kiln source pack or registry link could supply
editable programs for exact-source refinement. That would be a separate delivery
contract with its own provenance and review. It must not imply automatic
JavaScript execution or copy a raw authoring workspace or private library.
