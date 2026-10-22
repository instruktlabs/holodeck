# Static scene export

Export an accepted schema v2 world to a new directory:

```sh
holodeck export ./my-world --out ./my-site
holodeck export ./my-world --out ./older-site --revision 4
```

Without `--revision`, export uses the last accepted receipt, including its pinned
asset bytes. It does not use a staged `world/world.json`. Open the workspace with
`holodeck dev` first if it has never acquired an accepted snapshot. Existing output
directories are refused. A failed build leaves an `EXPORT-INCOMPLETE.txt` marker;
retry into a fresh directory.

Upload the entire finished directory to a static HTTP(S) host. URLs are relative,
so the same package works at the domain root or beneath a path such as
`/worlds/example/`. No Node process, agent login, provider credential or API route
is needed. Open through the host rather than `file://`. HTTPS enables WebGPU on
supported browsers; the renderer falls back to WebGL2. `?backend=webgl` forces that
backend for verification.

The player reuses the registered world runtime, terrain, water, interactions and
camera controller. Enter world starts exploration. Worlds with maker possession
support first and third person, walking, jumping and swimming. Free camera uses
WASD with Q/E for vertical movement. Escape returns to the overlook and releases
mouse capture. Right-drag is available without capture. The toolbar controls cove
visibility, return to arrival and activity pause. Activity is local to the browser
session and is never saved into the exported files.

Exports contain the scene, only the GLBs used by its origin, placements and
scatter variants, and its pinned terrain layer PNGs (renamed by hash under
`assets/imports/terrain/`). The
bible's title is replaced by a generic title; intent, rules, references and the
mood board are excluded. Agent history, credentials, source files, workspace paths
and installed authoring skills are not copied. Safe collection/asset/revision IDs
are retained. Embedded GLB metadata stays unchanged because the original pinned
bytes are delivered; this is not a metadata scrubber or a publication license.

`manifest.json` identifies the accepted revision and SHA-256 of every delivered
file except the manifest itself. The build uses its own Vite entrypoint with
`configFile: false`, `publicDir: false` and relative base URLs. It never starts the
local agent host. The private reference-board module is excluded from this build.

Schema v1's legacy prototype controller is not included in this initial exporter.
Exporting a supported scene proves packaging and byte identity; the deployed
site still needs visual, interaction and performance review on its target browsers.
