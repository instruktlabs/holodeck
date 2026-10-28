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

package.json.files is an explicit npm allowlist. It includes every skill in
`skills/`; optional skills such as `holodeck-export-unity` reach a world only when
its scene opts in (see [architecture](architecture.md)). Git and npm are separate exposure
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

The public scene shelf is a separate static site in `site/`, for
`https://holodeck.kilnstudio.tools/`. `site/scenes.json` lists each scene by id,
the bundled example it is built from, title, summary, four collage shots, path
and Kiln gallery link: Crescent Cove, the Quiet Courtyard, Tidemark Island,
Winter Mountainside Cabin and the Cove (from `construct`). Each scene's 1200×630 social card is
`site/cards/<id>.jpg`.

`npm run render:site` prerenders `site/index.html` from `site/scenes.json`, with
the home page JSON-LD, `sitemap.xml`, `robots.txt` and `llms.txt` (a plain-text summary
for language models, in the kilnstudio.tools/llms.txt format: every scene from the
catalog with its Kiln pack, the About page, getting started and the repository); the
shelf needs no script at runtime. Each sitemap URL carries a `<lastmod>`: a scene's catalog `updated` date (when
its example or card last changed) and, for the shelf and `site/about/`, the dates in
`PAGES` in `scripts/render-site.mjs`. Update the date in the commit that changes the page;
with full git history the site test fails a date older than the page's last commit.
`site/about/` is the About and how-to-use page, linked from the shelf footer.
`site/_headers` sends `X-Robots-Tag: noindex` on `holodeck-5mm.pages.dev` and its
deployment and branch aliases, so only `holodeck.kilnstudio.tools` is indexed.
`server/site.test.mjs` fails while the rendered output is stale, and
checks image sizes, lazy loading, local links, social card sizes and export
hashes offline. Fonts are bundled as woff2 subsets, and the site loads nothing
from other hosts.

Scene exports are not committed. `npm run build:site -- --out <new-folder>`
(`scripts/build-site.mjs`) copies the shelf without its cards. It then installs
each scene's example into a temporary folder with `holodeck init --example`
and exports it with `holodeck export`, taking the page title, description,
canonical URL, card, image alt and CC0 licence from the catalog. Exports are
deterministic: an unchanged example rebuilds byte for byte. The site's GLBs are
the examples' GLBs, so git stores them once. Four scenes build in about 7 s.

### The Lab

The Lab, at `site/lab/`, holds experiments that are not ready for the shelf: an
unfinished scene, or the same scene built in different engines. It is linked
from the shelf's and the About page's footers and is kept out of the shelf, the
hero carousel, the Scenes menu and the scene list in `llms.txt`, which links the
Lab once under Optional, marked experimental. The sitemap lists the Lab and each
entry's page.

`site/lab.json` lists its entries in order; the file is optional. An entry is:

```json
{
 "id": "medieval-castle",
 "title": "Medieval Castle",
 "blurb": "What it is, in a sentence or two (at most 260 characters).",
 "status": "An honest status note: in progress, what pass this is, what comes next (at most 240).",
 "updated": "2026-10-27",
 "cardAlt": "Alt text for the entry's 1200×630 card.",
 "videos": [
  {"engine": "Unity", "mp4": "lab/medieval-castle/unity.mp4", "poster": "lab/medieval-castle/unity.jpg", "width": 1920, "height": 1080, "caption": "Optional."},
  {"engine": "React Three Fiber", "mp4": "lab/medieval-castle/r3f.mp4", "poster": "lab/medieval-castle/r3f.jpg", "width": 1920, "height": 1080}
 ],
 "scene": {"example": "medieval-castle"}
}
```

Each entry's folder `site/lab/<id>/` holds `card.jpg` (1200×630), each
video's MP4 and JPEG poster, and the rendered `index.html`, and nothing else.
An entry has two or more videos. Each is H.264 (`avc1`), at most 8 MB, with
its `moov` box first so it streams at once (`ffmpeg -c:v libx264 -pix_fmt
yuv420p -movflags +faststart`); its poster and its listed `width` and `height`
match the video's coded size. `npm run render:site` checks all of this and
renders `site/lab/index.html` and each entry's page, where the videos sit side
by side (`controls muted playsinline`, `preload="none"`, with the poster) under
the status note. `scene` is optional: when present, `npm run build:site` exports
that bundled example to `lab/<id>/play/` the same way as a shelf scene, with the
entry's card and a page title marked experimental, and the entry links to it.
`updated` is the entry page's lastmod; `LAB` in `scripts/render-site.mjs`
dates the Lab's index.

The shelf plays those scenes and points visitors to the clone and launch
commands. It does not connect an agent, accept uploads, or publish the npm
package. Contribution and direct publishing from the local app come later, on
top of this catalog.

## Site deploys

`.github/workflows/site.yml` builds and deploys the site to the `holodeck`
Cloudflare Pages project, which serves `holodeck.kilnstudio.tools` and whose
production branch is `main`:

- **build**, on every PR and every push to `main` that touches the site, the
  examples, the viewer or the deploy scripts. It runs without secrets. It builds
  the site, runs the full preflight as a dry run, records the folder's sha256 and
  uploads the folder as an artifact.
- **preview**, for PRs from branches of this repository only, never forks. It
  uploads that artifact to the Pages branch `pr-<number>`
  (`https://pr-<number>.holodeck-5mm.pages.dev`) in the `site-preview` environment.
- **production**, on a push to `main` or a manual run on `main`. It runs in
  the `site-production` environment, whose required reviewer approves each
  deploy in GitHub.

Both deploy jobs verify the artifact's sha256 against the build job and run
every check again. They install Wrangler 4.147.0 from the locked `deploy/`
package with `npm ci --prefix deploy --ignore-scripts`, so its dependencies and
integrity hashes are pinned too. Workflow permissions are `contents: read`, and
the workflow never uses `pull_request_target`.

`scripts/deploy-site.mjs` refuses to upload when:
- the checkout is dirty or has untracked files;
- any file in `site/` is not committed;
- the shelf is stale;
- the built folder differs from the committed shelf outside `worlds/`;
- the built folder has a file outside the shelf, the catalog's scenes and the
  Lab's playable scenes;
- a scene export lacks its canonical link or card, or fails its hash manifest;
- an export is unfinished;
- a symlink, a Worker or Functions input is present;
- a file exceeds the Pages limits;
- a production upload names a branch other than the project's production branch;
- a preview names the production branch.

It reads the project's `production_branch` from the Cloudflare Pages API
(read-only, with the deploy token). Wrangler compares against the same setting
to decide between production and preview, and it is already set before the
first deployment. A real upload needs `CLOUDFLARE_API_TOKEN` and a 32-character
`CLOUDFLARE_ACCOUNT_ID` in the environment; there is no interactive login. A
production deploy notes when `holodeck.kilnstudio.tools` is not yet attached to
the project.

`site/_headers` sets the Pages response headers: `nosniff`, a strict referrer
policy, no framing, and a Permissions-Policy without camera, microphone,
location, payment or USB on every page. Viewer bundles, GLBs and terrain
textures under `/worlds/<scene>/assets/` and `/lab/<entry>/play/assets/` are
named by content hash and cached as immutable. There is deliberately no script Content-Security-Policy, which
could break the WebGPU viewer. `server/site.test.mjs` checks that every file the immutable rule
covers has a hashed name.

**One-time setup, by the maintainer.** None of this is in the repository:
1. In Cloudflare, make sure the `holodeck` Pages project exists as a direct
   upload project with production branch `main`, and attach
   `holodeck.kilnstudio.tools` as its custom domain.
2. Create a Cloudflare API token with only *Account · Cloudflare Pages · Edit*
   on the Kiln account. Pages permissions cannot be limited to one project, so
   this token can also deploy production. That is why previews never run for
   forks.
3. Create the GitHub environments `site-preview` and `site-production`. Give
   `site-production` a required reviewer and limit it to the `main` branch.
4. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets of both
   environments.
5. Set the repository variable `SITE_DEPLOY` to `enabled`. Until it is set,
   the deploy jobs are skipped, so no environment is created without its
   protection.

To deploy by hand in an emergency, set the token and account ID in the
environment for the run. Then, from a clean checkout of the commit to publish,
run:

```powershell
./scripts/deploy-site.ps1 -ProjectName holodeck -DryRun
./scripts/deploy-site.ps1 -ProjectName holodeck
```

The script then builds into a fresh temporary folder, runs the same checks and
uploads with the same pinned Wrangler. It uses the `deploy/` package when it is
installed, or otherwise `npm exec` with the exact version.

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
