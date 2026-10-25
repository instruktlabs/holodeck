# Local agent and live world authoring

## Implemented status, 2026-10-22

The persistent prototype now has a local Node host, revisioned `world/world.json`,
history/undo, accepted asset hashes and immutable cached GLBs. Scene, bible and
mood board edits persist together. Invalid candidate files retain the previous
accepted world. The browser loads candidate assets before adopting the revision.
GPU prewarming and a general plugin/physics/controller framework remain unimplemented.

The cove has eight Kiln-authored modules with saved provenance. The mood board
supports images, notes, file snapshots, arrangement, categories, direction, bible
pins, replacement and removal. **Import pack** and **Import folder** add a `.zip`
or folder of PNG/JPEG/WebP images and MD/TXT/JSON/PDF/GLB files in one step. An
optional `manifest.json` (an array, or `{references:[...]}`) gives each `file` a
title, category, notes and status; each card's notes keep the pack name and
original path. A dogfood input pack's `input-manifest.json` lists `{images:[...]}`
the same way: each image's `provenance` is kept in its notes, a file whose
`sha256` differs is skipped, and the `userBriefFile` lands as an approved
**Brief** card. A category that differs from a default only in case joins it.
A pack adds at most 200 cards, within the board's 200-card limit,
and the board must still be saved. Zips must be stored or deflated, without ZIP64
or encryption. The physical frame is movable; editing uses HTML while the
in-world board uses a lit canvas texture.

## The dock and proposals

The browser has one bottom dock: agent presence, a slot for the request waiting
on you, the proposal line, selected references, the message box and section
tabs. Agent permission, question and plan requests wait there one at a time,
including while walking with the HUD hidden. Sections open in a sheet above the
dock.

The **World** sheet groups placements by family and asset, with a filter, meters
for the 64-asset, 1200-placement and two-million-triangle budgets, and inline
position, rotation and scale editing for the selected placement. It also holds
the environment choice, GLB import, the raw scene document and **Undo last world
edit**. The **Observe** sheet shows this browser's backend, draw and triangle
counts, frame p95 and time to first frame; frame timing pauses while the page is
hidden.

A staged proposal shows in the dock as its summary and change counts. Up to 120
added or moved placements draw as translucent ghosts in the world before Apply;
aiming and selection ignore them. **Review** summarises the changes, then shows
placements by asset, assets, scene settings, bible fields and board cards on
demand, with the raw JSON last. A proposal made against an older revision cannot
be applied. An applied revision loads where the user stands, with a short notice
of what changed.

`world_read` returns an overview by default, then named sections (`scene`,
`bible`, `objects`, `scatters`, `assets`, `files`, `references`,
`capabilities`) in pages under 24,000 characters with a `next` cursor.
`world_propose` takes the complete scene inline as `sceneJson` or as `sceneFile`, a JSON file
under `assets/source`; either way it is capped at 4 MiB. The host holds one
pending proposal, and a newer one replaces it. `world_sample` and `world_check`
accept the staged `proposalId` to measure a proposal before the user applies it.
Where walkable collider tops overlap the terrain, `world_sample` reports which
surface supports the point (`supportSource`, `supportId`) and every walkable height
there (`levels`).

## Agent adapters

The Codex adapter uses the installed CLI's app-server and managed local sign-in.
It discovers models dynamically, persists a thread, exposes eight world/reference
tools, stages proposals, surfaces native approvals and supports Stop. A command
approval can be allowed for that exact command and folder for the rest of the
thread. A live probe completed with `gpt-6.1-sol`, including world reads, a
proposal and separate apply. That is observed local integration, not a guarantee
about every account or future distribution/onboarding route. Native writes use a
world workspace sandbox; inherited connectors are not a complete isolation boundary.

The Cursor adapter spawns the installed `agent acp` process in the selected
world and authenticates with `cursor_login`. Permission, question and plan
requests use the same dock cards. Login, billing and credentials stay inside
Cursor. Image generation remains on Codex.

The Claude Code adapter runs the user's installed, unmodified `claude` CLI once
per turn in the selected world (`-p --output-format stream-json`), resuming the
saved session. Holodeck checks `claude auth status` before connecting, removes
API-key and provider variables from the child environment, never passes `--bare`,
and never reads Claude credentials. World tools and permission prompts go through
a local MCP bridge to the same dock cards. A card can grant one Kiln tool, all
Kiln workspace tools, edits in `assets/source`, or one exact shell command for
the rest of the session. The model list shows aliases and exact model IDs
separately. See the [provider policy](agent-provider-policy.md#anthropic-claude-code).

The browser remembers the last provider, model and effort connected in each
world, so after a host restart the dock offers a one-click **Reconnect**.

The user-facing image request and output-to-board review path is implemented.
Provider capability discovery and adapter tests passed. Actual native image
generation has not been exercised end-to-end by this milestone's recorded tests.
The installed Codex provider manages its image model separately from the selected
coding model. Generated results wait for board acceptance and are not automatically
bible-approved. [Codex image generation](https://learn.chatgpt.com/docs/image-generation),
[app-server](https://learn.chatgpt.com/docs/app-server).

## Workspaces and capabilities

`launch` uses `../holodeck-worlds/cove` by default. Running `npm run dev`
without the CLI serves `HOLODECK_WORKSPACE`, or `../holodeck-worlds/hearth` when
it is unset. Asset authoring uses the world's configured `kiln_workspace` setup;
installed package/engine code is outside ordinary world editing. Environment choices
are currently construct/meadow/woodland with static GLB placements and simple
blockers. Schema 2 also supports a bounded heightfield with up to four texture
layers, an ocean with optional surf, an optional gradient sky with clouds, seeded
scatter, and optional maker possession with first/third-person cameras. Placed
objects below the water are tinted automatically. General imported-rig
possession, custom physics and XR are future capabilities. See
[terrain and inhabitants](terrain-and-inhabitants.md).

New schema v2 examples add authored camera/blocker data and built-in hinge/spin
activity. The new `world_check` tool supplies advisory evidence for reflection;
its adapter path is tested with a mock transport, without a new live inference run.
See [architecture](architecture.md), [examples](example-worlds.md) and
[coherence protocol](coherence-protocol.md). No ECS or rigid-body backend is
required. New example workspaces receive Holodeck skills; existing instructions
are not overwritten.

