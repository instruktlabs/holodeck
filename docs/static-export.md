# Static scene export

Export an accepted schema v2 world to a new directory:

```sh
holodeck export ./my-world --out ./my-site
holodeck export ./my-world --out ./older-site --revision 4
```

Without `--revision`, export uses the last accepted receipt, including its pinned
asset bytes. It does not use a staged `world/world.json`. `holodeck init` writes
the first accepted snapshot, so a new world exports straight away. A workspace
made another way needs one `holodeck dev` session before its first export. Existing output
directories are refused. A failed build leaves an `EXPORT-INCOMPLETE.txt` marker;
retry into a fresh directory.

Upload the entire finished directory to a static HTTP(S) host. URLs are relative,
so the same package works at the domain root or beneath a path such as
`/worlds/example/`. No Node process, agent login, provider credential or API route
is needed. Open through the host rather than `file://`. HTTPS enables WebGPU on
supported browsers; the renderer falls back to WebGL2. `?backend=webgl` forces that
backend for verification.

`?benchmark=1` opens an opt-in diagnostics panel with actual renderer evidence,
validated fixed-camera scenarios, bounded measurements and a local JSON download.
It preserves the strict presentation gate and reports missing proof as unverified.
See [measuring a static world](performance-benchmark.md) for the workflow and its
limits. Without this parameter the player keeps its normal exploration controls.

The player reuses the registered world runtime, terrain, water, interactions and
camera controller. Enter world starts exploration. Worlds with maker possession
support first and third person, walking, jumping and swimming. Free camera uses
WASD with Q/E for vertical movement. Escape returns to the overlook and releases
mouse capture. Right-drag is available without capture. The toolbar controls cove
visibility, return to arrival and activity pause. Activity is local to the browser
session and is never saved into the exported files.

On a touchscreen the player uses the same controller without mouse capture. A
thumb on the left of the scene becomes a floating stick that walks or flies, and
runs at its rim. Any other finger drags to look. On the overlook one finger
orbits and two fingers pinch to zoom. Buttons appear only when they apply:
Interact when the reticle finds something (a tap does the same), Jump while
walking as the inhabitant, Up and Down in the free camera, and Clear view to hide
the HUD. On screens narrower than 700 px the toolbar folds into one View button.
See [selection and inhabiting](selection-and-inhabiting.md#touch).

Exports contain the scene, only the GLBs used by its origin, placements and
scatter variants, and its pinned terrain layer PNGs (renamed by hash under
`assets/imports/terrain/`). The
bible's title is replaced by a generic title; intent, rules, references and the
mood board are excluded. Agent history, credentials, source files, workspace paths
and installed authoring skills are not copied. Safe collection/asset/revision IDs
are retained. Embedded GLB metadata stays unchanged because the original pinned
bytes are delivered; this is not a metadata scrubber or a publication license.

## Page metadata

The page title defaults to "Holodeck world". To publish a scene with real head
tags, supply public metadata at export time. It never comes from the bible:

```sh
holodeck export ./my-world --out ./site/worlds/garden \
  --title "The garden · Holodeck" --description "A walled garden to walk at dusk." \
  --url https://example.com/worlds/garden/ --image ./garden-card.jpg \
  --image-alt "The garden from its gate" --license https://creativecommons.org/publicdomain/zero/1.0/
```

- `--title` and `--description` are required together. They set `<title>` and the
  meta description.
- `--url` is the page's absolute `https` address and must end with `/`. It adds a
  canonical link, Open Graph and Twitter tags, and schema.org `CreativeWork`
  JSON-LD.
- `--image` takes a local PNG or JPEG. It is copied to `preview.png` or
  `preview.jpg`, and its dimensions are read from the file. The social card uses
  it only when `--url` is also given.
- `--license` adds a license URL to the JSON-LD.

All text is HTML-escaped. Values that look like local file paths are refused.

`manifest.json` identifies the accepted revision and SHA-256 of every delivered
file except the manifest itself. The build uses its own Vite entrypoint with
`configFile: false`, `publicDir: false` and relative base URLs. It never starts the
local agent host. The private reference-board module is excluded from this build.

Schema v1's legacy prototype controller is not included in this initial exporter.
Exporting a supported scene proves packaging and byte identity; the deployed
site still needs visual, interaction and performance review on its target browsers.
