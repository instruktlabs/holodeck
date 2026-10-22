# Distribution boundary

Holodeck is a source-distributed toolchain using Kiln, hosted at
https://github.com/instruktlabs/holodeck. Code is MIT; designated first-party
bundled assets and example worlds are CC0 1.0. See [licensing](../LICENSING.md).
The npm package remains private and is not published.

Private research is stored outside the checkout: source-specific analysis,
captures, local paths and lineage. Public architecture and skills contain general
requirements, without private implementations or dependencies on private repos.
New example data is independently authored for Holodeck. Cove provenance retains
revision identities without machine-specific workspace paths.

package.json.files is an explicit npm allowlist. Git and npm are separate exposure
boundaries. Local evidence and private directories are ignored; candidate source
and the npm dry-run manifest are checked separately. Automated checks catch common
path/artifact mistakes, not arbitrary semantic disclosure. Review source and asset
provenance before publishing.

Do not turn a private implementation into a public example by renaming it. Derive
the requirement, implement it for Holodeck and demonstrate it with an independent
fixture. Check actual licenses and attribution before reusing public third-party
code or assets.

The CLI has launch, init, check, dev and export. Vite builds the static player and runs the
local authoring host. Speech runtime files come from installed dependencies.
Scaffolded worlds live outside the package. Static exports contain a playable
accepted scene and its pinned assets; local agents, authoring prose, reference
files and editable workspaces are excluded. See [static export](static-export.md).

The public scene shelf is a separate static site in `site/`. `site/scenes.json`
lists each world by id, title, summary, preview and path. Tidemark is the first
entry, exported into `site/worlds/tidemark/`. The shelf plays those scenes and
points visitors to the clone and launch commands. It does not connect an agent,
accept uploads, or publish the npm package. Contribution and direct publishing
from the local app come later, on top of this catalog.

Curated editable examples use the versioned [example world bundle](example-world-bundles.md)
format: accepted scene data, exact pinned GLBs and an optional real runtime preview.
Installations receive independent revision histories and library IDs. Public bible
text is explicitly supplied; raw sessions, research, mutable source files and
reference attachments stay outside the package. Local bundle installation does
not add downloaded code or plugins. A future download service is architecture
only; there is no remote distribution pipeline or publication action here.
These bundles support scene editing and viewing; exact GLBs and provenance IDs
do not include the private Kiln library or original editable asset programs.
Any future curated public source pack or registry link is a separate contract
for source refinement, without automatic JavaScript execution or raw workspace copying.

The public identity is Holodeck powered by Kiln, with repository
`instruktlabs/holodeck` and private package identity `@instruktlabs/holodeck`.
GitHub publication does not publish an npm package. The authoring app stays on
the local machine. Deploying the scene shelf is separate from the Kiln site.
See the [integration boundary](integration-boundary.md) and
[local world library](world-library.md).
