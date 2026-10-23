# Dogfood: tropical island through the interface

This records one end-to-end authoring pass, started 2026-10-22, that builds a
new tropical island scene only through the Holodeck browser interface and a
connected local agent. It turns friction into fixes and follow-up work for
Holodeck and Kiln. It is a working log, not a qualification of art, routes or
performance.

## Setup

- World: a fresh construct world at `holodeck-worlds/tropical-island`, created
  with `holodeck init` and served with `holodeck dev`. It does not reuse the
  Tidemark example; this pass aims for a more realistic, higher-fidelity result
  from its own mood board.
- Agent: **Connect → Claude Code** on the user's Claude subscription. Model
  alias `opus` (the session log shows it resolved to `claude-opus-5-5`) with
  reasoning effort `max`.
- Input: a reference pack of six AI-generated images (hero, eye level, modular
  kit, asset kit, materials, layout) and a short brief. The images are
  inspiration, not engine renders, measured plans or texture maps.
- Browser driving: the in-app browser at the default pane size (about
  1024×768 CSS pixels).

## Fixed during this pass

| Issue | Change | Evidence |
| --- | --- | --- |
| Every card added one at a time landed at the same position (`40,125`), so six linked images stacked under the newest one. Placement offsets were by index within one add batch. | `placeCards` in `src/world/board.mjs` gives new cards the first free grid slot from the visible sheet onward, spilling to the next sheet; the board follows to the sheet where the last card landed. | `src/world/board.test.mjs`; browser check: a new note landed in a free slot beside the stacked cards. |
| The board heading read `1 / 34`, which looks like a card count. | The heading reads `Sheet N`; the page limit is the shared `BOARD_PAGES` constant. | Browser check. |
| The composer was a single-line `<input>`, so typed or pasted line breaks were stripped. The agent received a numbered, multi-paragraph brief as one run-on line. | The composer is an auto-growing `<textarea>` (CSS `field-sizing: content`, capped height). Enter sends; Shift+Enter adds a line; IME composition is respected. | Browser check: a 9-line message kept its 9 lines in the host's stored transcript. |
| A pending approval was invisible while any side panel was open (`.zen-workspace:has(.drawer) .conversation{display:none}`), and nothing else signalled it. The turn sat blocked until the panel was closed. | With a panel open, a **"Claude is waiting for your answer · Review ↗"** button (or **"A proposal is ready to review"**) appears above the composer; it closes the panel and opens the conversation. | Used throughout turn 3 (about 20 approvals). |
| A new approval card could arrive below the fold of the conversation column, under a long user message. | A request card scrolls itself into view when it appears. | Used throughout turn 3. |
| The working card had its own **Stop** button. When an approval card closed, the layout shifted and that Stop moved under the pointer; a second click there stopped the turn. | The working card no longer duplicates Stop (the composer keeps it) and says **WAITING FOR YOU** while a request is open, instead of the last tool name. | Reproduced once in this pass. |
| An interrupted turn disappeared from the conversation without a trace. | A **STOPPED** note explains that the turn ended early and that sending a message continues the session. | Browser check. |
| After a page reload, the reasoning selection silently fell back to the model default, so the next turn ran without `--effort max` even though the panel had shown **max** before the reload. The session file confirmed one turn went out with no effort. | The browser remembers the last model and effort per provider; the session's saved effort is adopted when nothing is chosen. | Browser check: Opus and max survived a reload. |
| A model chosen while one provider was active carried over to another (Codex's `default` stayed selected after switching to Claude Code, hiding the saved `opus`). | A provider change re-reads that provider's own saved choice. | Browser check. |
| Every Kiln call needed its own approval click, so an authoring loop (validate, render, inspect, edit) would need dozens of clicks. | Claude Code approval cards for `kiln_workspace` tools add **Allow for this session**. The grant is remembered with the session. File edits inside the world's `assets/source` get **Allow edits in assets/source for this session**; shell, other files and other tools still ask per call. | `server/claude.test.mjs`: the second call is allowed without a card, the grant survives a reconnect, Bash never offers the option, and edit grants refuse paths outside `assets/source` (including `..` escapes). |
| Linked mood-board files were titled with the raw filename (`02-eye-level.png`). | `referenceTitle` in `server/world-store.mjs` drops the extension and a leading number, and turns dashes and underscores into spaces (`Eye level`). | `server/board.test.mjs`. |
| On the mood board, clicking empty board space did not deselect a card, and Escape closed the whole panel. | Clicking the empty board, or pressing Escape outside a text field, deselects the card and returns the inspector to board settings. | Browser check with a dispatched Escape key; a click on empty board space. |
| The UI never showed which model an alias resolved to. | The adapter records `model` from Claude Code's `init` event; the Agent panel shows "Last turn ran on claude-opus-5-5 · max effort" and lists tools allowed for the session. | `server/claude.test.mjs`. |
| Shallow water read as milky grey-white instead of clear turquoise. Submerged ground was shaded as dark wet sand (`#9f9173`) under a 38%-opaque surface, and grazing Fresnel mixed in the pale fog colour. | `src/world/landscape.jsx`. Submerged terrain is shaded as seabed under two-way Beer–Lambert absorption (per metre RGB `0.9, 0.16, 0.11`), blending toward the water's shallow and deep colours with depth. Cheap drifting caustics light the shallow seabed and fade with depth and distance. The surface reflects a blue sky gradient instead of the fog colour, softens Fresnel over the shallows, and becomes opaque in deep water so the terrain lattice edge no longer shows. | Browser check of the overview and the arrival view on WebGPU and forced WebGL2. Both report 56 draws, 317,859 rendered triangles, and frame interval p95 14.0 ms, equal to the 14 ms baseline the agent read on revision 3 (refresh-paced; not a GPU timing). `npm run test:runtime`: 160 pass. |
| Agent replies showed raw Markdown, so the capability table arrived as pipes and dashes. | A small parser (`src/world/message-format.mjs`) renders headings, lists, pipe tables, bold and inline code as React elements, never raw HTML. User messages stay plain text. | `src/world/message-format.test.mjs`; browser check of a seven-row table. |
| In a narrow pane (280 px), the composer's four buttons squeezed the textarea to 1 px wide. With `field-sizing: content`, the wrapped placeholder grew it to its 168 px cap, covering the approval card's buttons, which could not be scrolled into reach. The wrapped tool row also slid under the conversation. | `src/world/style.css`, under 480 px: the textarea takes its own row above the buttons, the keyboard hint is hidden, and the conversation sits between the tool row and the composer. | Browser check at 280×862: textarea 218 px wide, conversation ends 11 px above the composer, and Allow once was clickable at the pane's own size for the rest of turn 4. |
| H29, H24, H32 and the [agent context gaps](#agent-context-gaps): agents learned rotation order, the foliage binding, terrain and environment behaviour, proposal size and budget strategy by trial or by reading engine sources. | Upgrade plan Phase 1. `world_read` capabilities (`server/world-tools.mjs`) now state: rotation as XYZ Euler radians and Kiln degrees (`placements`); the full foliage admission rules and Kiln `Mesh_<name>` binding (`spatial.foliage`); every terrain appearance setting, what is fixed, and that Kiln materials cannot reach terrain (`spatial.terrainAppearance`, `terrainRendering`); water and sky rendering (`waterRendering`, `sky`); what each environment type renders (`environmentTypes`); proposal size and staging (`proposals`); and a budget strategy (`budgetStrategy`). `skills/holodeck-author-world/references/current-runtime.md` lists the same facts with their keys. | `server/world-tools.test.mjs` (7 tests), including that every terrain, water and sky field appears without an engine read. |
| Agents had no exact route from a saved Kiln revision to `assets/imports` (K5). | `skills/holodeck-integrate-asset/SKILL.md` names one command, `node kiln.mjs export ASSET_ID REVISION_ID --profile editable --format glb --out assets/imports/SCENE_ID-REVISION_ID.glb --json`, and one destination. | Run on a copy of this world: the output sha256 matched the saved revision's `asset.glb`, and a second run refused to overwrite. |
| H15: Kiln skills landed only in the Codex layout, and Claude Code read them by path. | Measured on Claude Code 2.1.300: `--setting-sources user` loads no project `.claude/skills`, `CLAUDE.md` or `AGENTS.md` (a sentinel in `CLAUDE.md` was not seen; with `user,project` it was). `server/kiln-workspace.mjs` registers the connecting provider's harness (`codex`, `claude`, `cursor-agent`), adds it to an existing workspace once, and no longer installs `kiln-compose-scene`. For Claude Code, `server/claude.mjs` copies the world's installed skill folders into a temporary `holodeck-world` plugin passed with `--plugin-dir`, so no project settings or hooks load. | `server/kiln-workspace.test.mjs` and `server/claude.test.mjs`. Live: with this world copy, Claude Code's `init` listed all six `holodeck-world:*` skills under `--setting-sources user`; invoking a plugin skill needed no approval. |
| H17: world guidance named only Codex, and the world `CLAUDE.md` never loaded for Claude Code. | `server/world-guide.mjs` holds provider-neutral text used by the scaffold, remix, example install and default `AGENTS.md`. The Claude Code adapter instructions now carry what `CLAUDE.md` would have. | `server/examples.test.mjs`, `server/history.test.mjs`, `server/example-bundle.test.mjs`. |
| H26: Kiln's guide puts `KILN_PROGRESS.md` at the world root, outside the edit grant. | The Codex, Claude Code and Cursor instructions and the world guide say to keep it at `assets/source/KILN_PROGRESS.md` (Kiln-side: instruktlabs/kiln#212). | Adapter instruction tests in `server/codex.test.mjs`, `server/claude.test.mjs`, `server/cursor.test.mjs`. |
| H28: `world_propose` took the whole scene inline in one tool call, so large turns ran into the agent's output limit. | Upgrade plan Phase 2.1. `world_propose` takes `sceneFile`, a world-relative `.json` path under `assets/source`, as an alternative to `sceneJson`. It must resolve inside `assets/source` after symlinks, and is capped at 4 MiB like inline JSON, which is now capped too. It goes through the same world validation. File staging was chosen over appending batches to a draft: agents already write planner output to `assets/source`, which the session edit grant covers, and the host keeps one validation path and no partial draft state. `capabilities.proposals` and `current-runtime.md` say when to use it. | `server/proposal-staging.test.mjs`: an 800-placement scene stages from a file; path escapes (`..`, `.`, absolute, backslash, other folders, wrong extension), oversize files and inline JSON, malformed JSON, missing files, both inputs, and invalid scenes are refused. |
| H19: `world_sample` and `world_check` read only the accepted world, so the agent built a 640-line replica to measure its proposals. | Upgrade plan Phase 2.2. Both tools take `proposalId` and evaluate the host's staged proposal without applying it: no browser observation, initial behavior state, `time` null meaning 0, and a `source` record naming the proposal. A stale or superseded ID is refused. The host passes the staged proposal to the Codex and Claude Code adapters. No overhead preview render: the host is Node with no renderer, so a render would need a headless browser per call, which is not cheap. | `server/proposal-staging.test.mjs`: sampling a proposal that raises the terrain from 1 m to 3.5 m returns 3.5 m, and the accepted world still samples 1 m at the same revision. |
| H13: the review card showed the proposal as one raw JSON dump. | Upgrade plan Phase 2.3. `src/world/proposal-diff.mjs` compares the accepted world with the proposal: bible fields side by side (rules line by line), board cards added, removed, moved or edited, scene settings and terrain keys, assets, and placements grouped by asset as added, removed, moved (transform only) or changed. `src/world/proposal-review.jsx` shows the summary lines, then a details table, then the raw JSON (rendered only when opened). Styling is minimal for the interface design pass. | `src/world/proposal-diff.test.mjs` (5 tests). DOM check with the real turn 4 change staged in a world copy (revision 5 restored, revision 6 proposed): the card reads "Placements: +394 across 28 asset groups (110 → 504)", "Assets: +28 (…)" and "Terrain: appearance (rockColor, rockSlope, sandColor, wetSandColor)". Collapsed, the review is 176 px tall in a 290 px card at 1024×768; opened, a 28-row table scrolls within 240 px. |
| H31: every GLB embedded its own copy of the Kiln library textures; the 40 assets transferred 22.7 MB. | Upgrade plan Phase 3.3. `server/texture-store.mjs` derives a served form of each admitted GLB: embedded images move to `/api/textures/<sha256>.<ext>`, and geometry buffer views are repacked and remapped. Each distinct image is held once per host and served with immutable caching; the client sends the world context headers with texture fetches. Pinned GLBs, provenance, history and static export keep the exact bytes. GLBs whose buffer views are addressed by Meshopt or Draco are served unchanged. `HOLODECK_SHARED_TEXTURES=0` turns the derivation off. | `server/texture-store.test.mjs` (5 tests): geometry and sparse data byte-equal after remapping, unsupported layouts left whole, one copy of a shared image, host routes, a texture requested after a restart. Hub (GTX 1660 Ti Max-Q, driver 615.71.09, run `upgrade-plan/runs/texcheck-20261022-145421`), with an empty cache on both backends: the 101 embedded images are 14 distinct ones. Transfer fell from 22,698,060 bytes (40 GLBs) to 8,620,219 (7,152,251 of GLBs plus 1,467,968 of textures), −62%. Frozen-activity screenshots are pixel-identical on WebGPU (0 of 921,600 pixels differ). On WebGL2, 111 pixels differ by one level, within the run-to-run noise of the same build (131 pixels by one level). |
| H21: there was no scatter or region-fill primitive, so dense groves and undergrowth were listed placement by placement. | Upgrade plan Phase 3.2. `scene.scatters` records (module `scatter.seeded@1`) expand with a seed into ordinary static placements inside a region polygon, with density per 100 m² capped by `maxCount`, minimum spacing, height, slope and water-depth limits, keep-out paths, circles and polygons, an `avoid` list of earlier scatters, scale, yaw and lean jitter, terrain-normal conform, and `removed` indices that delete single instances without reshuffling. One pure module (`src/world/scatter.mjs`) serves validation, budgets, the runtime, rendering, `world_sample`, `world_check`, selection and the review diff. `world_read` describes the contract with a working example. | `src/world/scatter.test.mjs` (9 tests): repeat runs and a fixed snapshot, budget counting and the error naming each scatter, keep-outs, limits, spacing, `avoid`, `removed`, Euler rotations and colliders. An independent island fixture expresses a 103-palm grove and its undergrowth as two records. On a hub copy of revision 6, the 103 listed palms, 229 plants and 80 debris pieces became five records (`grove-palms` 103, `grove-shrubs` 115, `grove-ground` 98, `beach-plants` 16, `beach-debris` 80): 504 listed placements became 92 listed plus 412 expanded, and `world.json` fell from 322,325 to 161,259 bytes. Keep-outs there are derived circles around the kept objects, not turn 3's planner rules. Hub numbers are in [Upgrade plan checks](#upgrade-plan-checks). |
| H30: terrain appearance had seven settings and no texture or normal maps, so Kiln-authored textures could not reach the terrain and the ground under the grove stayed bare sand. | Upgrade plan Phase 3.1. `terrain.appearance.layers` holds up to four layers of PNG albedo, normal and optional roughness maps, with planar or triplanar projection, strength, tint, and masks by height, slope, height above water, distance to assets or scatters (`near`) and a painted PNG. The host pins each PNG by hash in the receipt, like GLBs, so history, undo, remix and static export keep exact bytes; terrain PNGs are capped at 32 MiB inside the 128 MiB world budget. The shader packs the maps into two texture arrays (roughness in albedo alpha) plus one 512×512 mask texture, so the terrain stays one draw on both backends, and the wet band and seabed apply over the layers. | `src/world/terrain-layers.test.mjs` (6 tests) and `server/terrain-textures.test.mjs` (3 tests): validation, mask bands, PNG admission, near and paint rasterization, pinning, replacement creating a revision, restore, undo, remix, static export and the host route. On a hub copy of revision 6 with procedural sand-grain and leaf-litter maps generated in the scratch copy only (1024², 10.5 MiB of PNG), the sand shows grain and the ground within 3.5 m of the palms reads as litter, on both backends. Captures: `upgrade-plan/runs/20261022-154645` against the baseline `20261022-154452` (arrival, overlook and ground views), and close-ups in `closeup-20261022-155141`. Draws and triangles are unchanged; numbers are in [Upgrade plan checks](#upgrade-plan-checks). |
| H20: re-running the same design script needed a click every time: around 30 in turn 2, and in turn 3 six runs of `plan_grove.py` and three of `make_proposal.py`. | Upgrade plan Phase 4.1. Claude Code Bash and PowerShell cards, and Codex command approvals, offer **Allow this exact command for the session**. The grant names the tool (Claude), the working folder and the exact command string; nothing is prefix-matched. Claude grants persist with the Claude session and drop on reconnect if saved for another folder; Codex grants persist with the thread and end with it. Granting also answers a waiting card for the same command. | `server/claude.test.mjs` and `server/codex.test.mjs`: the repeat runs without a card; other arguments, a trailing space, the other shell, a subfolder and a folder outside the world still ask; reconnect keeps the grant; a new Codex thread clears it. |
| H10: Kiln tools were granted one at a time, so read-only Kiln discovery still asked once per tool per session. | Upgrade plan Phase 4.2. Kiln cards add **Allow all Kiln workspace tools for this session**, which covers every `kiln_workspace` tool and nothing else, beside the per-tool grant. | `server/claude.test.mjs`: one card for the first Kiln tool, later Kiln tools run without one while a shell command still asks, and the grant survives reconnect. |
| H35: at revision 8, `world_read` returned 182 KB, more than Claude Code's tool output limit, so Claude Code saved it under `~/.claude` and the agent had to ask to read the user's home folder to see its own world. | Upgrade plan Phase 6.4. Measured on Claude Code 2.1.300 with a probe MCP tool: world-like JSON of 48.5 KB arrived inline and 56 KB was saved to a file. `world_read` (`server/world-read.mjs`) now answers in sections of at most 24,000 characters, half that limit. With no arguments it returns the overview: scene settings, objects grouped by asset with counts and bounds, scatter summaries and the bible. `scene`, `bible`, `objects` (optionally one asset), `scatters`, `assets` (with pinned hashes), `files`, `references` and `capabilities` page by bytes with a revision-bound cursor. The Codex tool contract moved to version 5. | `server/world-read.test.mjs` (7 tests): a 2,001-object, 64-asset world keeps every section under the cap; paging returns each object once and in order; asset filters; an oversized bible leaves the overview; bad sections, assets and stale cursors are refused; the real capability text pages under the cap. Revision 8 rebuilt with this branch: 188.5 KB in one result before; overview 20.1 KB, objects 6 pages (largest 23.0 KB), capabilities 2 pages (22.9 KB) after. |
| H34: underwater absorption applied only to the terrain, so placed GLBs under the water got no depth tint; the agent baked a tint into each coral group's albedo, and the shallowest brain heads still read as pale bumps. | Upgrade plan Phase 6.3. One water column (`waterColumn` in `landscape.jsx`, CPU mirror `underwaterColor` in `src/world/water-optics.mjs`) now shades the seabed and every asset with a placement that can reach below the highest crest, from depth at the fragment. Tinted assets render from converted copies; others and the loader cache are untouched. At revision 8 that is 11 assets (coral and rocks). | `src/world/water-optics.test.mjs` (4 tests). Hub captures of revision 8: the seabed, water and every dry pixel are identical before and after; only submerged objects change, now taking the seabed's turquoise scatter and caustics at their own depth (reef close-up: 7.2% of pixels change). The coral's baked tint is still in its albedo, so it is now tinted twice; removing it is the agent's call. |
| H22: no breaking surf on the reef rim or swash on the beach. | Upgrade plan Phase 6.1. Optional `water.surf` (`src/world/surf.mjs`): a 512×512 map built from the heightfield by marching the swell along its direction gives break strength, whitewater distance and the swell reaching each shore. The ocean draws set lines and travelling whitewater; the terrain draws swash with lace foam and damp sand. Visual only; `sampleWater` is unchanged. | `src/world/surf.test.mjs` (4 tests): breaking at a reef rim and not in open water or at the map edge, a sheltered lagoon beach with less swash than an exposed one, determinism and direction. Hub copy of revision 8 with `surf: {}`: whitewater over the lagoon shallows and along the beach, a swash band on the sand; the outer rim stays a subtle ring from the overlook. |
| H23: only sun and fog were configurable, with no clouds, so the overlook sky read flat grey. | Upgrade plan Phase 6.2. Optional `environment.sky` (`src/world/sky.mjs`): a zenith-to-horizon gradient whose horizon defaults to `fogColor`, a sun disc, and procedural cumulus ported from three.js `SkyMesh`. The water reflects the same gradient. Without it, the analytic sky is unchanged. | `src/world/sky.test.mjs` (4 tests). Hub copies of revision 8 with a gradient and with clouds render the same on WebGPU and WebGL2. |
| H36: the walker stood only on terrain, so the turn 7 jetty's decks, platform and stair, all with box colliders, could not be walked on; the colliders only blocked. | Upgrade plan 6.5. A collider box (or each box in a compound) takes `walkable: true`. The walker and patrols stand on the highest of the terrain and the walkable tops at most 0.35 m above their feet (in the air, only tops they fall past). Footprints grow 0.1 m to bridge seams, a walkable top within one step does not block (so treads climb), edges fall, and water depth counts from the top. Yaw only; refused with a behavior. `world_sample` reads y as an eye height and reports `supportSource: "collider"`, `supportId` and `levels`; routes carry the feet and report a `drop`. Setting the flag on the island's jetty is the agent's call; no world was changed. | `src/world/walkable.test.mjs` (9 tests) and `server/walkable-sample.test.mjs` (3) on an independent yawed jetty: stairs up and down, the 2 cm seam, falling off a side, landing a jump, a wader blocked under a deck, a swimmer under a high deck but not a low one, a patrol along the deck, validation, and unflagged worlds unchanged. Revision 9 in Node with the jetty flagged: the walker crosses the decks at −1.85 and steps down the stair into 0.5 m of water. Hub copy with the flag and the spawn on deck 2: the arrival view stands on the deck on both backends; the unflagged copy starts under it. |
| H1 and H4: a reference pack had to be linked image by image and titled by hand, and the category suggestions matched none of the pack's categories. | Interface pass (direction B, merge `ade4b53`). `src/world/reference-pack.mjs` imports a dropped folder or `.zip` in one step, with an optional `manifest.json` for titles, categories, notes and status; each card keeps its pack and path in its notes. Categories default to Scene, Layout, Kit, Asset, Material, Atmosphere, Architecture and Rules. | `src/world/reference-pack.test.mjs` (2 tests): a zipped pack with stored and deflated entries applies its manifest; a pack without one gets readable titles and the default categories. |
| H3: **Link a workspace file** was reachable only in the board-settings state. | Interface pass (direction B, merge `ade4b53`). The link field stays reachable while a card is selected. | Reported by the interface pass; no separate test. |
| H6 and H16: the model list offered aliases only, and after a dev-server restart the host came back as Codex, disconnected. | Interface pass (direction B, merge `ade4b53`). Exact model IDs are listed apart from aliases, and the last connected provider is remembered per world for one-click reconnect (`src/world/presence.mjs`). | `src/world/presence.test.mjs` (3 tests). |
| H8: `holodeck dev` flooded the log with `@pmndrs/glyph` source-map errors. | Interface pass (direction B, merge `ade4b53`). `vite.config.js` drops only those warnings. | The noise did not appear on the hub runs, so the filter is not verified there. |
| H9 and H25: the board panel clipped its toolbar, and the World panel listed every placement twice in one long scroll. | Interface pass (direction B, merge `ade4b53`). One bottom dock carries presence, a decision slot, the proposal line, the reference tray, the composer and the section tabs; each section opens in a bottom sheet at half or tall height. The board toolbar wraps and stays in view. The World sheet groups placements by family and asset (`src/world/placement-groups.mjs`) with a filter, budget meters and inline transform editing for the selection. | `src/world/placement-groups.test.mjs` (3 tests), including 504 placements collapsing to a handful of rows. Hub capture of the tall World sheet on a revision 6 copy: 5 groups and 541 px of scroll, against 29,734 px before. |
| H11 and H12: a long user message pushed request cards below the fold, and buttons moved after a card resolved. | Interface pass (direction B, merge `ade4b53`). Long messages fold; requests wait one at a time in the decision slot, with stable buttons and a 400 ms arm delay. The coordinate-frame mismatch in H12 belongs to browser automation, not the interface. | Hub captures of the decision slot at desktop and phone sizes. These are **mock UI**: the agent state was injected into that browser only and no agent ran. |
| H27 and H33: frame interval p95 read about 1 s while the page was hidden, and load time could not be measured with the pane hidden. | Interface pass (direction B, merge `ade4b53`). Frames while the page is hidden, and the first interval after it returns, are not recorded, and the panel says timing is paused. The probe records `firstFrameMs` from when a world opens, and observations carry it with the page's visibility. Hidden-pane painting itself is browser behaviour. | Hub runs, merged build against `main`, revision 6 copy, 10 runs: draws, triangles and p95 identical on both backends (1280×720: 244 draws, 2,494,312 triangles; 390×844: 211 draws, 2,144,269 triangles; p95 8.4 ms, refresh-paced). Ready times within about 200 ms; first frame about 3.0–3.25 s after activation. |
| H41: the dock's section tabs had a transparent background, dark text and a white glow, so over deep water at the overlook they could not be read. | `src/world/style.css`: the tab row sits on the same glass as the presence bar, and the glow is gone. | Found in the revision 10 hub capture (overlook, both backends); checked in the browser over the overlook's water. |
| H37: Claude Code asked before every Read of the world's own skill references, which live in the session plugin folder outside the world. | `pluginRead` in `server/claude.mjs` answers a Read, Glob or Grep inside the session plugin folder without a card. The path must be absolute, and a Glob pattern or Grep `glob` may not be absolute or contain `..`. Edits there, and reads anywhere else outside the world, still ask. | `server/claude.test.mjs`: three plugin reads run without a card; a climbing pattern, an edit of a plugin skill and `plugin/../mcp.json` each raise one. Not yet seen live; the island's host copy is synced after turn 9. |
| H38 and H39: every Claude Code card was titled **Run a command? · shell**, and a Glob card showed only its folder. Turn 8's Glob of `*` across the projects folder could not be judged from the card. | `permissionCard` in `server/claude.mjs` titles each card by tool: **Read a file?**, **Search for files?**, **Search file contents?**, **Edit a file?**, **Write a file?**, **Fetch a web page?**, **Use a Kiln tool?** and **Run a command?**. A search shows its pattern beside its folder, plus the Grep file filter. A path outside the world, or a pattern that climbs out, adds an **Outside this world** chip (`src/world/dock.jsx`). The card's source reads the tool name, for example **Claude Code · Glob**. | `server/claude.test.mjs`: titles, pattern lines and the outside flag for each tool, including turn 8's case. Not yet seen live. |
| H42: `holodeck export` refused a world made with `init` until it had been opened in a browser. | `bin/holodeck.mjs` opens the new world once after `init`, which validates it and writes the accepted snapshot. `export` stays a projection of an accepted receipt and never opens a store. | `server/examples.test.mjs`: `init --example courtyard` then `export` through the CLI writes revision 0 and leaves no host lock. |
| Turn 9: the surf capability said the swell breaks "where depth first falls below breakDepth", so the agent modelled both a single break and repeated breaks to explain the lagoon's whitewater. | `capabilities.spatial.surf` in `server/world-tools.mjs` states the engine's rule (`src/world/surf.mjs`). The swell is capped at depth/breakDepth and recovers about 1/200 per metre over deep water. It breaks again wherever the water gets shallower than any point it has crossed, so a lagoon beach shallower than the rim flat breaks a second time. | `src/world/surf.test.mjs`: no break over the 4 m lagoon, a second break on the beach face, and whitewater restarting there. |
| Example bundles refused any scene with terrain layers, so a layered island could not ship as an example. | `server/example-bundle.mjs` copies each pinned layer map and paint mask to `assets/imports/terrain/<sha256>.png` and lists it under `textures` in `example.json`. The terrain is repointed at those names. Install rechecks hashes, dimensions and the terrain size rules, and requires the listed files to be exactly the ones the terrain names. | `server/terrain-textures.test.mjs`: a layered world bundles, installs and reopens with the same texture hashes. A changed PNG, a dropped receipt and an unlisted file are each refused. |

## Holodeck findings

Severity: **High** blocks or misleads a normal flow, **Medium** is real
friction, **Low** is polish.

| # | Area | Finding | Severity | Suggested change |
| --- | --- | --- | --- | --- |
| H2 | Mood board | Fixed above (readable default title). A reference pack manifest title now wins over it (H1, below). | — | — |
| H5 | Agent panel | Fixed above (model and effort persistence). | — | — |
| H7 | Conversation | Fixed above (single-line composer). | — | — |
| H14 | Conversation | Fixed above (Markdown rendering). | — | — |
| H18 | Agent instructions | With shell needing approval per call, the agent still listed folders through PowerShell. | Low | Fixed in the adapter instructions: inspect with Read, Glob and Grep; shell needs approval. |
| H37–H39 | Agent permissions, request cards | Fixed above. | — | — |
| H40 | Agent permissions | Each distinct argument list for the same world script needs its own approval. Turn 8 ran `turn8.py` four times (`verify export tint surf`, `verify`, `scene samples`, and so on), so **Allow this exact command for the session** never applied. Turn 9 asked four times in eight minutes to run `turn9.py farzones`. The script was edited between runs, and only the `Select-Object -Last N` tail changed in the command, so neither an exact-command grant nor a content-hash grant would have covered the reruns. | Low | Offer a session grant for one script under `assets/source` with any arguments, bound to the script's content hash so an edit asks again. |
| H42 | Static export | Fixed above. | — | — |
| H43 | Scatter | Before apply, no tool reports where a staged scatter's instances land; only counts. In turn 9 the agent certified whole regions worst-case, so that every root the engine could accept passed its view checks. It said exact positions were "not verified". | Medium | Let `world_read` (or `world_sample` with `proposalId`) return a staged scatter's expanded instances: positions, variants and rotations. |
| H44 | Sky | The `environment.sky` capability names `zenithColor`, `horizonColor` and a curve, but not the formula. In turn 9 the agent estimated the arrival sky colour by guessing a power-of-sine blend. | Low | State the gradient formula, or the colour at a few elevations, in the capability text. |
| H45 | Rendering | On the draw-bound hub GPU, a light distance variant costs draws: each new asset is its own batch, per part and per pass. Turn 9's two far-palm assets added about 24 draws to save triangles that were not the limit. A group spanning over 96 m is also split into grid cells, and a cell holding one placement draws it alone (about 12 more). Revision 11 went from 269 to 307 draws and missed refresh. | Medium | Report draws per asset in `world_read` budgets, so agents weigh draws as well as triangles. Merge single-placement cells into a neighbouring batch. Longer term, distance LOD inside one asset rather than separate assets. |

## Kiln findings

Kiln stays pinned at 1.3.1. These are consumer observations. Each needs a
minimal reproduction in a Kiln workspace before it becomes a Kiln change.

| # | Area | Finding | Suggested change |
| --- | --- | --- | --- |
| K1 | MCP annotations | `kiln_export` reports `readOnlyHint: true`, although an export produces delivery files. A client that auto-allows read-only tools would let exports through without review. | Mark export as not read-only (it is non-destructive and idempotent), or split "describe export" from "write export". |
| K2 | MCP annotations | `kiln_renderer` combines a read-only `status` with a stateful `reprobe`, so the whole tool is `readOnlyHint: false` and a status check always needs approval. | Split status into a read-only tool or action, so clients can allow it safely. |
| K3 | Materials | The agent reports no shipped sand, coral limestone, palm-frond or thatch materials in the 1.3.1 library. Tropical scenes need all four. | Add these as material presets, or document a recipe for each. |
| K4 | Preview | The agent reports the GPU renderer has not been verified in this workspace, so previews show shape but not true materials. In turn 3 the render service started on demand and showed true materials. | Make renderer readiness and fallback explicit in the `kiln_renderer status` output and in the authoring skill. |
| K5 | Delivery | `kiln_export` returns `kiln://` resources only. Writing GLBs into the world's `assets/imports` needed a shell call to the local `kiln.mjs` CLI, with an approval each time. Exports never overwrite, so every revision gets a new file name. | Let export take a workspace-relative output path (bounded to the project), or add a delivery target to the workspace config. |
| K6 | Geometry | No helper repeats or merges sub-geometry. About 600 leaflets per palm, plus coconuts and sheath, were built by hand with the raw mesh helper. | Add array/repeat-along-curve and merge helpers that keep per-vertex UVs. |
| K7 | Export naming | Part names get a `Mesh_` prefix, so a host contract that binds exact node names (`fronds_0..3`) needs overrides. | Keep authored names by default, or document the override. |
| K8 | Host contracts | Kiln does not know Holodeck's foliage wind contract (single-primitive frond meshes; UV.y 0 at attachment, 1 at tip). The agent checked it with its own GLB inspector script. | Allow a host-supplied validation profile that QA runs before save. |
| K9 | QA | The default six-view sheet is too small to judge a palm crown, and the overlap check cannot measure open shells such as fronds. | Accept explicit cameras and crop in the QA render; skip or adapt overlap checks for open meshes. |
| K10 | Materials | Six materials per palm gives a poor instancing grade; a shared frond material would cut it to three. | Suggest material merges in the QA report when parts share a shader. |
| K11 | Materials | Turn 4: the library had no stone, sand, foliage or driftwood materials; the agent authored `cove-limestone` (dry and wet), `cove-sand` and `cove-driftwood`. The newer material format cannot generate normal maps from height, so limestone pits are painted rather than embossed. | Add a height-to-normal step in the material format. |
| K12 | Geometry | The work budget rejected noise beyond about 10 octaves. Export has no vertex colours or second UV set, so wet lines and dark pocket interiors needed exact triangle cuts. | Document the budget; support vertex colour or a second UV set for masks. |
| K13 | Errors | Errors were often a generic "Invalid input", and one helper caps its input at 200 characters. | Name the field and limit in validation errors. |
| K14 | Geometry | Turn 9: no way to derive a lighter variant. For 8 rocks, the agent hand-wrote culling of buried faces and a coarser remesh. For two far palms, it replayed the random draws by hand to keep their crowns identical. | Add a decimation or level-of-detail step that keeps silhouettes, materials and part names, and a seeded variant that reuses a parent's random state. |
| K15 | Revisions | A child save reports "changed" without saying how much: no triangle, bounds or silhouette delta. The agent measured those outside Kiln. | Report triangle, bounds and silhouette deltas against the parent revision on save. |

### Upstream status

First checked against Kiln main at 1.3.1, then updated on 2026-10-22 after
the Kiln fix cycle for these findings. Merged fixes are on Kiln `main` and ship
in 1.4.0; Holodeck still pins Kiln 1.3.1.

| # | Status |
| --- | --- |
| K1 | Probably by design. Over MCP, `kiln_export` returns descriptors and writes no files, and a parity test asserts the read-only hint. Only CLI export writes. Drop it unless MCP export gains a file destination. |
| K2 | Fixed on Kiln main: read-only `kiln_renderer_status` (instruktlabs/kiln#206, PR #222). |
| K3 | Fixed on Kiln main: natural presets for coastal and tropical materials (instruktlabs/kiln#210, PR #228); a second set (#221) is in review. |
| K4 | Documented in the workspace `AGENTS.md` and the authoring skill (`viewFidelity.materialFaithful`; the GPU service starts on demand). |
| K5 | In progress: opt-in `kiln_export_to` bounded to a host root (instruktlabs/kiln#207), not yet merged. |
| K6 | Fixed on Kiln main: repeat leaflets along a curve and surface foliage helpers (instruktlabs/kiln#211, PR #224). |
| K7 | Documented in the Kiln authoring and QA skills (`createPart` names meshes `Mesh_<name>`). The gap is Holodeck's foliage contract text, which does not mention it. |
| K8 | In progress: host validation profile checked by QA (instruktlabs/kiln#208), not yet merged. |
| K9 | Mostly documented: custom camera cells and `markOpenShell` exist; overlap on open shells is a stated measurement limit. |
| K10 | Fixed on Kiln main: material merge advice in the QA report (instruktlabs/kiln#209, PR #227). |
| K11 | Fixed on Kiln main: V3 normal-from-height derivation (instruktlabs/kiln#205, PR #225). |
| K12 | Fixed on Kiln main: authored vertex colours and attributes (instruktlabs/kiln#195, PR #226). |
| K13 | Fixed on Kiln main: validation errors name the rule (instruktlabs/kiln#198, PR #214). |
| K14 | Not filed yet; found in turn 9. |
| K15 | Not filed yet; found in turn 9. |

Also filed from Holodeck findings:
- instruktlabs/kiln#212: configurable `KILN_PROGRESS.md` location (H26), fixed on Kiln main (PR #223).
- instruktlabs/kiln#213: opt-in shared runtime textures (H31), in review as PR #235.

## Agent context gaps

These caused avoidable friction across turns 2–4. They belong in the
contract text `world_read` returns, the Holodeck skills, or the world
scaffold.

All of them are addressed by upgrade plan Phase 1 (see "Fixed during this
pass"). Two remain partial: there is still no admission preflight an agent can
run on a GLB before proposing, and the progress-log location is an instruction
until Kiln makes it configurable (instruktlabs/kiln#212).

- **Foliage contract.** It says nothing about Kiln's `Mesh_` prefix and
  offers no admission preflight, so the agent wrote its own GLB inspector.
- **Rotation.** Placement `rotation` is radians, XYZ order. The Kiln skills
  use degrees for part rotation.
- **Proposal size.** No size limit or batching guidance for `world_propose`
  (H28).
- **Terrain appearance.** No skill says Kiln materials cannot reach the
  terrain (H30). The installed `kiln-compose-scene` skill describes Kiln's own
  terrain composition, which misleads inside a Holodeck world.
- **Export delivery.** No document names the Kiln export command, profile
  and destination for `assets/imports` (K5).
- **Harness.** Skills are installed in the Codex layout (`.agents/skills`)
  even for Claude Code (H15). The world `AGENTS.md` names only Codex (H17).
- **Progress log.** Kiln's workspace `AGENTS.md` tells the agent to keep
  `KILN_PROGRESS.md` at the world root, outside the edit grant (H26).
- **Engine docs.** No contract pointer covers the terrain, wave and
  environment-type details the agent read from engine docs (H24, H32).
- **Budget strategy.** No guidance on density, variants against the 64-asset
  cap, or scatter (H21).

## Agent turns

1. Planning: read the board and references, propose a bible, tidy the board,
   and report which runtime capabilities exist for water, sky, fish, foliage and
   terrain. The first attempt was stopped by an accidental click (see the Stop
   fix above) and resumed in the same session. The proposal was applied as
   revision 2: a 20-rule bible, "Crescent Cove — an island to explore on foot",
   a prioritized split between Kiln assets and Holodeck terrain/water, and a
   two-sheet board layout. Revision 3 renamed the board.

   Capability gaps the agent reported against the brief, to be confirmed in
   the runtime:
   - **Sky:** no clouds and no sky parameters beyond sun and fog.
   - **Water:** no caustics, refraction or reflection, and no breaking surf on
     the reef.
   - **Fish:** flocking is aerial boids only; no underwater schooling, and flock
     bounds cannot follow the water surface.
   - **Terrain:** a heightfield only. No overhangs or real cliffs, no painted
     paths, no ground scatter.
   - **Foliage:** wind needs correctly authored frond meshes; no gusts or trunk
     bend.
2. Landform, water and light: a heightfield island with a graded route, an
   ocean, sun and haze, maker possession, and route checks. The turn was
   stopped once on purpose to ship the session edit grant, then resumed. It
   was applied as revision 4:
   - all 32 terrain stamps on a 256×229 lattice
   - a crescent beach, a wading shelf, a 2.5 m lagoon basin, a reef rim with a
     pass, and a headland with a benched trail to a 22 m summit
   - three long, low swells
   - a high west-north-west sun, with fog only past 260 m
   - first- and third-person maker possession, arriving on the beach facing
     the lagoon

   The agent's numbers were computed from its replica, not measured:
   - path slope at most 18.3°
   - jetty-end depth 0.50 m at rest
   - summit 22 m above sea

   Observed in the browser: the arrival faces the lagoon with the headland to
   the left (east), as designed. The water looked milky until the shader fix
   above.
3. Measurement, catalogue and palms: applied as revision 5.
   - **Measured revision 4:** `world_sample` matched the replica exactly
     across 64 samples, 38 routes and 103 palm roots. This corrected the
     turn-2 headland trail slope from 18.3° to 19.34°, still under the 20°
     target.
   - **Catalogue:** `assets/source/catalog.md` plans 25 families as 54 GLBs.
     With the cove that is 62 of 64 assets, 920 of 1,200 placements and
     1.80M of 2M placed triangles. The 64-asset cap binds first, so each
     family gets two or three shaped variants, and placements add yaw, scale
     and lean.
   - **Palms in Kiln:** one program yields four variants:

     | Variant | Height | Triangles |
     | --- | --- | ---: |
     | tall | 17.8 m | 9,178 |
     | lean | 14.8 m | 7,922 |
     | arch | 11.6 m | 7,642 |
     | young | 3.8 m | 3,794 |

     Each binds `fronds_0..3` for wind.
   - **Grove:** 103 placements (17 beach-edge, 72 grove, 14 young clumps),
     712,646 placed source triangles. The planner kept routes, the shelter
     front, the jetty line, the cove and the summit and viewpoint sightlines
     clear.

   Observed in the browser on revision 5:

   | Backend | Draws | Rendered triangles |
   | --- | ---: | ---: |
   | WebGPU | 157 | 1,490,085 |
   | Forced WebGL2 | 161 | 1,509,995 |

   Rendered counts include shadow passes. Frame timing was not valid because
   the pane was hidden (H27). The two backends look the same.
   - **Strong:** leaning, ringed trunks, coconuts, readable crowns and crown
     shadows.
   - **Still missing compared with the references:**
     - the sand is flat and bright;
     - the headland is an untextured beige mass (K3);
     - there is no undergrowth, beach debris or rock;
     - the reef rim is a soft oval with no texture;
     - a grey band sits on the horizon.
4. Ground, rock and undergrowth: applied as revision 6. The dev server had
   stopped between turns, so Claude Code was reconnected and resumed the same
   session with its saved grants (H16).
   - **Assets:** 28 Kiln assets:
     - 12 limestone rocks: three cliff faces, two outcrops, three boulders,
       two beach rocks and two reef rocks;
     - 11 wind-ready plants: naupaka, hibiscus, alocasia, nest fern, sword
       fern, grass tuft and patch, vine mat and fringe, scrub, purslane;
     - 5 debris kinds: driftwood log and pile, fronds, coconuts, shells.
   - **Placements:** 394 (85 rocks, 229 plants, 80 debris).
     - 74 colliders, on large rocks and logs.
     - 140 low pieces are tilted to the ground.
     - Roots were measured with `world_sample`, within 0.69 mm of plan.
   - **Terrain appearance:**
     - sand `#cdb994`, wet sand `#9b8f78`, rock `#a9a394`;
     - `rockSlope` lowered from 0.62 to 0.56.
   - **Budget after the turn:**

     | | Used | Cap |
     | --- | ---: | ---: |
     | Assets | 40 | 64 |
     | Placements | 504 | 1,200 |
     | Placed source triangles | 1,467,314 | 2,000,000 |

     The agent asks to re-plan the catalogue before turn 5. With 13 slots
     reserved, about 32 planned variants no longer fit. Rocks used 350k
     triangles against 141k planned.
   - **Shell:** about 10 shell approvals. The batch export script copied all
     28 GLBs from the Kiln store with hash checks in one run, which works
     around K5.

   Observed in the browser on revision 6, at the arrival view:

   | Backend | Draws | Rendered triangles | Frame interval p95 |
   | --- | ---: | ---: | ---: |
   | WebGPU | 242 | 2,495,924 | 14.0 ms (pane visible) |
   | Forced WebGL2 | 242 | 2,495,924 | 14.0 ms |

   The two backends look the same. In the grove with the free camera,
   WebGPU showed 204 draws, 1.97M triangles and p95 13.9 ms.
   - **Better:**
     - limestone cliff tiers now hide the headland's bay face;
     - the grove floor has shrubs, ferns, grass tufts, vine mats, fallen
       fronds and driftwood, and reads close to the references at eye level.
   - **Still off:**
     - The reef rocks form an evenly spaced dotted line around the rim,
       clearly artificial from the beach.
     - Submerged rocks cast hard grey shadows on the seabed.
     - A fern's root ball shows as a dark disc above the sand.
     - A beach palm's trunk base is an open tube, visible from close by.
     - The ground under the canopy is bare sand (H30).
     - The sand still reads bright.
5. Fixes and catalogue re-plan: applied as revision 7.
   - **Palms:** all four palm GLBs have a flared, capped root plate buried at
     least 0.24 m at every placement (+60 triangles each). The agent could not
     reproduce the open base in its terrain copy; the closed base removes it at
     any depth.
   - **Nest fern:** the dark nest sat 8 cm above the base point while
     placements sink only 3 cm, so it showed at all 14 placements. It is now
     moved below the ground contact.
   - **Plant bases:** 35 shrub and mat placements were re-rooted, with partial
     tilt to the slope.
   - **Reef rocks:** the 20 evenly spaced rocks became 17 in 7 uneven
     clusters (3 breakers on the shallow west rim, 8 awash, 6 just under).
     None sits above the water in the arrival view.
   - **Budget after the turn:** 40 assets, 501 placements, 1,468,075 placed
     triangles.
   - **Payload:** the staged scene was 133.5 KB (about 72k tokens) in one
     `world_propose` call. The agent estimates 170 KB by the end of the plan
     and about 272 KB at the 1,200-placement cap, so payload size, not the
     cap, will limit density (H28).
   - **Re-planned catalogue:** 17 of the 24 remaining slots and 64% of the
     remaining triangles. Proposed turn order: coral, shelter and jetty, far
     palms with cheaper cliff revisions (about 56k triangles freed), seagrass,
     leaf litter, then fish if a swimming test reads underwater. A 7-slot,
     190k-triangle reserve is held for overruns, distant islands, a shade tree
     and path edging, each pending the user's go-ahead.
   - **Kiln friction:**
     - renders have no ground, so judging burial needed a test ground and
       below-ground cameras;
     - the preservation check reports "changed" without a magnitude.

   Measured on the hub (see "Measurement" below) for revision 7, at the
   arrival view, 1280×720:

   | Backend | Draws | Triangles | Time to ready | Frame interval p95 |
   | --- | ---: | ---: | ---: | ---: |
   | WebGPU | 244 | 2,495,697 | 6.6 s | 8.4 ms |
   | WebGL2 | 244 | 2,495,697 | 11.9 s | 8.4 ms |

   The reef now reads as natural clusters from the arrival view and the
   overlook.
6. Coral: applied as revision 8.
   - **Assets:** four Kiln composites, each one mesh: rubble patch (2,234
     triangles), brain heads (2,766), staghorn (3,658) and table (2,876),
     54–95 KB each. Thin finger coral read as urchins at this triangle count
     and was replaced with staghorn.
   - **Colour:** Kiln has no vertex colours, so ramp strips stand in. The
     64-op paint cap limits each asset to eight ramps. The water tint does not
     reach GLBs (H34), so the agent baked it into the albedo at each group's
     median depth.
   - **Placement:** 60 groups in 32 clusters, each rooted with `world_sample`;
     the samples matched its terrain copy to 0.04 mm.
     - All tops sit at least 0.3 m under the rest water level, and the deep
       basin heads at least 1.15 m, so no colliders or wind bindings are
       needed.
     - The jetty line, an 18 m wading corridor from the arrival, and three swim
       lanes are kept clear.
     - Yaw, scale (0.47–1.52), a slight stretch and up to 6° of tilt hide the
       repetition.
   - **Composites:** placing the roughly 1,570 pieces one by one would need
     about 2,070 placements, over the 1,200 cap.
   - **Payload:** dropping the default `layer` and `materialStyle` from the
     coral objects saved 39 bytes each. The scene was 144 KB, and the agent
     had to expand it by hand (H28).
   - **Review:**
     - The staged scene matched the agent's source file in every object and
       section.
     - Against revision 7, it adds 60 objects and 4 assets and changes nothing
       else.
   - **Budget after the turn:** 44 assets, 561 placements, 1,635,639 placed
     source triangles (81.8%).
   - **Kiln:**
     - Easy: GPU material-faithful views, file programs with variant swaps,
       child revisions, and the preservation compare reporting "material
       only" for the re-bake.
     - Hard: no vertex colours or second UV (K12), no in-water preview, and
       no self-intersection check on composites.

   Measured on the hub for revision 8, at the arrival view, 1280×720:

   | Backend | Draws | Triangles | Time to ready | Frame interval p95 |
   | --- | ---: | ---: | ---: | ---: |
   | WebGPU | 263 | 2,692,037 | 7.2 s | 8.4 ms |
   | WebGL2 | 263 | 2,692,037 | 16.1 s | 8.4 ms |

   Coral adds 19 draws and about 196k rendered triangles, and both backends
   stay refresh-paced.
   - **Overlook:** dark patches across the lagoon and along the reef rim.
   - **Arrival:** rubble and staghorn read as seabed patches. The shallowest
     brain-head domes read as pale, smooth bumps at the surface (H34).
   - **Unverified:** whether normals stay correct under non-uniform scale with
     instancing.
7. Shelter, jetty and brain-head fix: applied as revision 9.
   - **Shelter:** 11,674 triangles; a thatched hip roof on six posts, a table,
     two benches, and a plank floor level with the sand.
   - **Jetty:** three deck sections (1,912 triangles each), a 3 × 3 m platform
     (3,880) and a stair (1,180).
     - The deck sits 0.65 m above the rest water level, on posts set
       0.50–1.64 m into the seabed. Heights come from 36 `world_sample`
       points.
     - The catalogue put the stair at the root, but the deck meets the sand
       about 3 m along the line. The agent moved the stair to the seaward end,
       stepping into knee-deep water where a swim lane starts.
   - **Not walkable:** every jetty piece has a box collider, but the walker
     stands only on terrain, so you cannot walk out on the jetty (H36). The
     agent declined to fake it with hidden ramps.
   - **Brain heads:**
     - The pale look came from the colour bake: one bake depth for all 14
       heads, skewed toward the deep ones, put a thick cyan tint on the shallow
       tops.
     - A child revision (3,758 triangles, was 2,766) bakes darker dead-coral
       tops for shallow water. It adds lobed clusters, a dished top, rubble
       skirts and lower tops.
     - The seven shallow heads sit 4–5 cm lower, with tops now 0.59–1.02 m
       under the rest level. One is scaled to 0.86 to clear a swim lane.
   - **Keep-outs:** no coral in the jetty corridor, and none of 1,167
     sightline test rays blocked.
   - **Review:**
     - The staged scene matched the agent's source file in every object and
       section.
     - Against revision 8 it adds 6 objects, all with colliders, and 4 assets.
     - It repoints `coral-brain-heads` to the new revision and moves or
       rescales 13 heads. Nothing else changes.
   - **Budget after the turn:** 48 assets, 567 placements, 1,671,997 placed
     source triangles (83.6%), 23.13 MiB of asset files. The payload was
     147.5 KB.
   - **Friction:**
     - `world_read` overflowed Claude Code's tool output limit (H35).
     - Engine lookups for walking and colliders took about ten single-file
       approvals (H32).
     - In Kiln, `kiln_validate` passed a program whose build then failed: the
       noise colours needed hex numbers, not RGB arrays. One GPU render timed
       out. There is no stretched noise for wood grain or straw.

   Measured on the hub for revision 9, at the arrival view, 1280×720:

   | Backend | Draws | Triangles | Time to ready | Frame interval p95 |
   | --- | ---: | ---: | ---: | ---: |
   | WebGPU | 269 | 2,731,147 | 9.6 s | 8.4 ms |
   | WebGL2 | 269 | 2,731,147 | 18.6 s | 8.4 ms |

   The turn adds 6 draws and about 39k rendered triangles, and both backends
   stay refresh-paced.
   - **Arrival:** the brain heads now read as dark seabed patches, with no pale
     domes at the surface.
   - **Overlook:** the shelter's thatch and the jetty show on the inner beach.
   - **Backend parity:** WebGPU and WebGL2 frames differ by a mean of 1.9
     (arrival) and 0.8 (overlook) on the 0–255 scale, from animated water and
     foliage.
   - **Load time:** ready times are higher than revision 8's (7.2 s and
     16.1 s). The time is not yet split between new assets and run-to-run
     variation.

8. Clean-up on the upgraded engine: applied as revision 10.
   - **Host:** the isolated host was refreshed from merged `main`, with the
     one-dock interface, sectioned `world_read`, the automatic underwater tint,
     surf, sky and walkable colliders. Claude Code reconnected to the same
     session with its earlier grants; Opus at max effort.
   - **Walkable jetty:** `walkable: true` on the three deck slabs, the platform
     slab and the three stair treads; posts and rails still only block. Tread
     tops were corrected by under 0.5 mm so each sits at its walking surface.
     On the staged proposal, `world_check` routes from the sand onto the
     platform, down the stair and back were clear, and 30 `world_sample`
     points put the walker on the decks at −1.85 m with no gaps at module
     joints, the treads 0.2875 m apart and the stair foot in 0.54 m of water.
   - **Coral:** four Kiln child revisions without the baked tint (geometry,
     UVs, normals and triangles identical; only the albedo changed), so the
     engine's tint is no longer applied twice. The agent restored each saved
     revision in Kiln, made one edit and saved a child.
   - **Surf:** `breakDepth` 1.35, `intensity` 0.95, `whitewater` 12 m,
     `runUp` 0.22, tuned against the published break rule on the agent's
     terrain replica.
   - **Sky:** zenith `#2d72c4` and light cumulus (coverage 0.3), drifting with
     the palm wind; the horizon stays the fog colour.
   - **Staging:** from `assets/source/turn8/scene-t8.json` (`sceneFile`,
     147.8 KB). The staged scene matched that file exactly, and against
     revision 9 it changed only the coral records, the seven walkable boxes,
     `water.surf` and `environment.sky`: no new assets, placements or placed
     triangles.
   - **Engine lookups:** the agent grepped its progress log for engine paths
     and asked to glob the user's whole projects folder for engine sources
     (H39). The request was rejected, and the agent tuned surf and coral from
     the published `world_read` capabilities instead, which were enough.
   - **Approvals:** one Read of its own skill reference (H37), one Kiln
     restore, and four runs of the turn script, each with different
     arguments (H40).

   Measured on the hub for revision 10, at the arrival view, 1280×720, on
   merged `main` (`1e43bc1`):

   | Backend | Draws | Triangles | Time to ready | Frame interval p95 |
   | --- | ---: | ---: | ---: | ---: |
   | WebGPU | 269 | 2,733,343 | 7.8 s | 8.4 ms |
   | WebGL2 | 269 | 2,733,343 | 19.4 s | 8.4 ms |

   The same build renders revision 9 at 269 draws and 2,731,147 triangles
   (ready 7.5 s and 20.0 s, p95 8.4 ms). Revision 10 adds 2,196 triangles,
   the authored sky dome, and no draws.
   - **Arrival:** cumulus over the beach, and whitewater bands in the lagoon
     and a swash line on the sand. The sky reads paler than revision 9's
     analytic gradient, and the lagoon whitewater is heavier than the brief's
     "gentle lagoon"; both are tuning for a later turn.
   - **Overlook:** whitewater along the outer rim; the flat grey band at the
     top of revision 9's frame is gone. The coral reads as darker seabed
     patches.
   - **Not yet seen:** a first-person walk along the jetty in the browser.

9. Sky, lagoon, cheaper rocks and far palms: applied as revision 11.
   - **Brief:** deepen the sky, calm the lagoon, cut the cliff triangles, and
     add palms on the far shore.
   - **Conflict:** the agent left the east horn across the bay bare. Palms there
     would block the summit's protected view of the lagoon and reef (bible
     rule 3), so it planted the headland ridge and north-east shore instead.
   - **Sky:** zenith `#1e5eba` with `horizonColor` `#b0cfea`; fog and clouds
     unchanged. The agent estimated the arrival colours by guessing the
     gradient formula (H44).
   - **Surf:** `breakDepth` 1.35 → 2.8, deeper than the 2.5 m lagoon basin, so
     the lagoon no longer breaks a second time; `whitewater` 12 → 9 m,
     `intensity` 0.9. The capability text described a single break, so the
     agent modelled both readings. That text now states the engine's rule (see
     Fixed). On the agent's terrain model, lagoon whitewater fell from 2,379 to
     210 m².
   - **Rocks:** eight Kiln child revisions with buried faces culled and a
     coarser remesh. Placed rock triangles fell from 280,131 to 147,172, with
     silhouettes within about 0.1–0.6 px from the beach and overlook. The
     method was hand-written (K14), and Kiln reported changes without sizes
     (K15).
   - **Palms:** module `scatter.seeded@1` and three scatters. Five full palms
     on the ridge behind the summit; ten within 16 m of the north trail; 21 of
     24 light far variants (2,989 and 2,681 triangles) on the north-east
     shore. The regions were certified worst-case against every protected ray
     on a terrain replica, because no tool reports a staged scatter's
     positions (H43).
   - **Budget:** 50 assets, 603 placements, 1,729,626 placed triangles.
   - **Staging:** from `assets/source/turn9/scene-t9.json`. The staged scene
     matched that file exactly. Against revision 10 it changed only the eight
     rock records, two new assets, the scatter module and records, `water.surf`
     and `environment.sky`. All 567 objects, the bible and the board were
     unchanged.
   - **Approvals:** about 30, almost all reruns of the turn script with a new
     step or an edited script (H40). Kiln renders and source exports ran
     through the world's `kiln.mjs`.

   Measured on the hub for revision 11, at the arrival view, 1280×720, on the
   same build as revision 10, in two runs (`20261022-230509`, `20261022-230859`):

   | Backend | Draws | Triangles | Time to ready | Frame interval p95 |
   | --- | ---: | ---: | ---: | ---: |
   | WebGPU | 307 | 2,951,468 | 9.0 s, 8.3 s | 8.4 ms, 16.6 ms |
   | WebGL2 | 307 | 2,951,468 | 23.0 s, 9.3 s | 16.7 ms, 16.7 ms |

   - **Regression:** revision 11 misses refresh on WebGL2 in both runs and on
     WebGPU in one. It adds 38 draws; on this GPU the bottleneck is draws, not
     triangles.
   - **Where the draws come from:** counted with `planStaticBatches`, batches
     went from 76 to 78 and individual placements from 21 to 22.
     - The two light far-palm assets are new batches. Each has six parts, drawn
       in the colour and shadow passes: about 24 draws.
     - One ridge palm sits alone in its 96 m batching cell: about 12 draws.
     - The far variants saved about 120,000 triangles that were not the limit.
   - **Arrival:** a bluer sky and a much calmer lagoon.
   - **Overlook:** the ridge palms stand in one line along the crest, like a
     hedge.

## Measurement

From revision 7 on, performance and visual evidence come from the hub, not
the authoring PC. The PC is also used for gaming, so its GPU timings are
neither clean nor representative, and a hidden browser pane renders no frames
(H27, H33).

- **Hub:** a Linux machine with a GTX 1660 Ti, reached over a direct wired
  link.
- **Method:** a synced copy of the checkout and the world (without the Kiln
  store) runs `bin/holodeck.mjs dev` there. Headed Chrome on the NVIDIA GPU
  (PRIME offload) records, per backend:
  - draws and triangles from `window.holodeckPrototype`;
  - time to ready;
  - frame intervals;
  - screenshots.
- **Lock:** a shared lock serializes measurements across sessions.
- **Pacing:** the hub display's refresh interval is about 8.3 ms, so a p95
  of 8.4 ms means refresh-paced.
- **Baseline:** revision 6 measured 244 draws and 2,494,312 triangles, ready
  in 11.6 s on WebGPU and 19.2 s on WebGL2. That was a cold run; revision 7's
  shorter times are warm.

The harness lives outside the repository, with the user's local tools.

## Upgrade plan checks

Each phase of [the upgrade plan](dogfood-upgrade-plan.md) ends with the test
suites, a build and a browser check. Browser checks run on the hub, not the
authoring PC: headed Chrome on an NVIDIA GeForce GTX 1660 Ti with Max-Q Design
(driver 615.71.09) at 1280x720, against a copy of this world at revision 6,
never the live world. Frame intervals are paced by the hub display's refresh
(about 8.3 ms), so a p95 near 8.4 ms means at refresh; they are not GPU times.

| Phase | Tests | Backend | Draws | Rendered triangles | Ready | Frame interval p95 | Hub run |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | runtime 160, world 112, build passes | WebGPU | 244 | 2,494,312 | 9.0 s | 8.4 ms | `upgrade-plan/runs/20261022-143217` |
| 1 | | WebGL2 | 244 | 2,494,312 | 7.3 s | 8.4 ms | same |
| 2 | runtime 165, world 115, build passes | WebGPU | 244 | 2,494,312 | 9.4 s | 8.4 ms | `upgrade-plan/runs/20261022-144335` |
| 2 | | WebGL2 | 244 | 2,494,312 | 7.6 s | 8.4 ms | same |
| 3.3 | runtime 165, world 120, build passes | WebGPU | 244 | 2,494,312 | 9.3 s | 8.4 ms | `upgrade-plan/runs/20261022-150724` |
| 3.3 | | WebGL2 | 244 | 2,494,312 | 7.5 s | 8.4 ms | same |
| 3 baseline | runtime 180, world 126, build passes | WebGPU | 244 | 2,494,312 | 9.0 s | 8.4 ms | `upgrade-plan/runs/20261022-154452` |
| 3 baseline |  | WebGL2 | 244 | 2,494,312 | 7.3 s | 8.4 ms | same |
| 3.1 layers |  | WebGPU | 244 | 2,494,312 | 7.0 s | 8.4 ms | `upgrade-plan/runs/20261022-155330` |
| 3.1 layers |  | WebGL2 | 244 | 2,494,312 | 7.7 s | 8.4 ms | same |
| 3.2 scatter |  | WebGPU | 269 | 2,446,984 | 9.6 s | 8.4 ms | `upgrade-plan/runs/20261022-155643` |
| 3.2 scatter |  | WebGL2 | 269 | 2,446,984 | 7.4 s | 8.4 ms | same |
| 4 | runtime 180, world 130, build passes | WebGPU | 244 | 2,494,312 | 9.4 s | 8.4 ms | `upgrade-plan/runs/20261022-161412` |
| 4 |  | WebGL2 | 244 | 2,494,312 | 7.3 s | 8.4 ms | same |
| 6 baseline (r8) | runtime 180, world 130, build passes | WebGPU | 263 | 2,692,037 | 9.4 s | 8.4 ms | `upgrade-plan/runs/20261022-162256` |
| 6 baseline (r8) |  | WebGL2 | 263 | 2,692,037 | 7.4 s | 8.4 ms | same |
| 6.4 | world 137 | WebGPU | 263 | 2,692,037 | 9.4 s | 8.4 ms | `upgrade-plan/runs/20261022-163235` |
| 6.4 |  | WebGL2 | 263 | 2,692,037 | 15.9 s | 8.4 ms | same |
| 6.3 | runtime 184 | WebGPU | 263 | 2,692,037 | 9.8 s | 8.4 ms | `upgrade-plan/runs/20261022-164215` |
| 6.3 |  | WebGL2 | 263 | 2,692,037 | 7.9 s | 8.4 ms | same |
| 6.1 surf | runtime 188 | WebGPU | 263 | 2,692,037 | 10.0 s | 8.4 ms | `upgrade-plan/runs/20261022-172415` |
| 6.1 surf |  | WebGL2 | 263 | 2,692,037 | 8.5 s | 8.4 ms | same |
| 6.2 sky | runtime 192 | WebGPU | 263 | 2,694,233 | 9.8 s | 8.4 ms | `upgrade-plan/runs/20261022-171036` |
| 6.2 sky |  | WebGL2 | 263 | 2,694,233 | 7.8 s | 8.4 ms | same |
| 6.2 clouds | world 137, prototype 3, build passes | WebGPU | 263 | 2,694,233 | 9.8 s | 8.4 ms | `upgrade-plan/runs/20261022-171314` |
| 6.2 clouds |  | WebGL2 | 263 | 2,694,233 | 8.0 s | 8.4 ms | same |
| 6.5 H36 (r8) | runtime 201, world 140, prototype 3, build passes | WebGPU | 263 | 2,692,037 | 10.1 s | 8.4 ms | `upgrade-plan/runs/20261022-180443` |
| 6.5 H36 (r8) |  | WebGL2 | 263 | 2,692,037 | 7.9 s | 8.4 ms | same |
| 6.5 r9 |  | WebGPU | 269 | 2,731,147 | 9.9 s | 8.4 ms | `upgrade-plan/runs/20261022-181602` |
| 6.5 r9 |  | WebGL2 | 269 | 2,731,147 | 18.6 s | 8.4 ms | same |
| 6.5 r9 deck spawn, flagged |  | WebGPU | 225 | 2,299,936 | 9.5 s | 8.4 ms | `upgrade-plan/runs/20261022-181234` |
| 6.5 r9 deck spawn, flagged |  | WebGL2 | 225 | 2,299,936 | 16.8 s | 8.4 ms | same |
| 6.5 r9 deck spawn, unflagged |  | WebGPU | 225 | 2,299,936 | 9.3 s | 8.4 ms | `upgrade-plan/runs/20261022-181439` |
| 6.5 r9 deck spawn, unflagged |  | WebGL2 | 225 | 2,299,936 | 7.3 s | 8.4 ms | same |

Phase 1 changes text the agent reads, not rendering, so the counts match the
revision 6 hub baseline (244 draws, 2.49M triangles, p95 8.4 ms).

Phase 2 changes agent tools and the review card. No proposal is staged during the
hub run, so the rendered scene and its numbers are unchanged.

Phase 3.3 serves GLBs with shared textures. The run before `20261022-150724`
(`20261022-150314`) read a WebGL2 p95 of 16.6 ms; two reruns read 8.4 ms, so it
is recorded as noise. Ready times vary by about ±2 s between runs of the same
build, so the transfer saving does not show as a ready-time change here, where
the browser and host share a machine.

Phase 3 rows measure three hub copies of revision 6 with the Phase 3 build:
the unchanged copy (baseline), one with two terrain layers (`world-layers`),
and one where five scatter records replace 412 listed placements
(`world-scatter`). Layers add no draws or triangles; the terrain stays one
draw. The scatter copy draws 25 more batches, because its instances spread
over more 96 m batching cells than the listed ones, and its variant mix
renders 47,328 fewer triangles.

The first host start on each edited copy read WebGL2 ready times of 17.7 s
(layers, `20261022-154645`) and 19.3 s (scatter, `20261022-155234`). Repeat
starts read 7.7 s and 7.4 s, so the rows show the repeats. Captures are in
`20261022-154452`, `20261022-154645` and `20261022-155234` (arrival, overlook
and ground views on both backends), and close-ups in
`closeup-20261022-155141`: looking down at the beach, and at the grove edge.
In the close-ups the WebGL2 sand reads about 2 levels lighter, with slightly
softer grain, than WebGPU (pixel standard deviation 2.1 against 2.7 in the
same crop). The baseline backends differ by about 1 level there.

Phase 4 changes approval cards and grants, not rendering, so the counts
match the revision 6 baseline. H32's read-only engine docs grant was not
added: Phase 1.6 already answers terrain, water and sky questions through
`world_read`, and a request to read engine docs or `~/.claude` still asks every
time.

Phase 6 rows measure copies of revision 8 on the hub (`upgrade-plan/world`;
revision 6 is kept as `world-r6`). Surf and sky use copies with `water.surf: {}`
(`world-surf`), `environment.sky: {zenithColor: '#3d7fc4'}` (`world-sky`) and
the same plus `clouds: {coverage: 0.35}` (`world-sky-clouds`). A reef close-up
copy (`world-reef`, Overlook camera moved low over the shallow brain heads)
gives the 6.3 before/after: `20261022-163613` and `20261022-164002`. With no
surf or sky settings, the final build renders revision 8 pixel-identical to
the 6.3 capture in all three views (`20261022-172745`). The authored sky is a
48×24 sphere, 2,196 more triangles than the analytic box; nothing adds draws.

WebGL2 ready times on the hub are bimodal, about 8 s or about 19 s, and do not
follow the Phase 6 changes. The same build and world read 19.8 s then 8.0 s
back to back (`world-surf`, `20261022-171917` and `20261022-172016`), and the
unchanged revision 8 copy read 19.6 s (`20261022-172103`) after 7.9 s earlier
on that build. Rows use a run in the ~8 s mode where one exists; the 6.4 row is
the only run on that build. WebGPU ready stays between 9.4 and 10.7 s.

H36 (6.5) changes support and collision, not rendering. On the H36 build the
unchanged revision 8 copy matches the last Phase 6 capture (`20261022-172745`) in
every view on both backends except 0.00–0.04% of pixels, scattered rather than
along any edge. The revision 8 copy is kept as `world-r8`. `upgrade-plan/world`
is now a scratch copy of revision 9, and the hub host saved it as revision 10.
`world-r9-walk` marks the jetty's four deck boxes and three stair treads walkable
and spawns on `jetty-deck-002`, facing the stair. `world-r9-spawn` has the same
spawn without the flags. The arrival view, which is the walker's eye, stands
1.72 m above the deck in the flagged copy on both backends; the two backends
differ in 0.57% of pixels. In the unflagged copy it stands in the water under
the deck, about 1 m above the deck top. The two deck-spawn copies draw the
same. The WebGL2 ready times of 16.8 s and 18.6 s are the slow mode described
above.

The CPU cost was measured in Node on the PC, on revision 9 with the jetty
flagged:
- A walkable-top query over the 7 boxes takes 0.1 µs.
- A full collider miss takes about 29 µs both before and after H36.
- One walker frame (`stepInhabitant` at 60 fps) takes a median of 114 µs and a
  p95 of 295 µs while walking the jetty from the sand down the stair into the
  water.


