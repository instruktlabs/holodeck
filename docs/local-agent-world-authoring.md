# Local agent and live world authoring

## Implemented status, 2026-10-21

The persistent prototype now has a local Node host, revisioned `world/world.json`,
history/undo, accepted asset hashes and immutable cached GLBs. Scene, bible and
mood board edits persist together. Invalid candidate files retain the previous
accepted world. The browser loads candidate assets before adopting the revision.
GPU prewarming and a general plugin/physics/controller framework remain unimplemented.

The cove has eight Kiln-authored modules with saved provenance. The mood board
supports images, notes, file snapshots, arrangement, groups, direction, bible pins,
replacement and removal. Its physical frame is movable; editing uses HTML while
the in-world board uses a lit canvas texture.

The Codex adapter uses the installed CLI's app-server and managed local sign-in.
It discovers models dynamically, persists a thread, exposes eight world/reference
tools, stages proposals, surfaces native approvals and supports Stop. A live probe
completed with `gpt-6.1-sol`, including world reads, a proposal and separate apply.
That is observed local integration, not a guarantee about every account or future
distribution/onboarding route. Native writes use a world workspace sandbox;
inherited connectors are not a complete isolation boundary.

The Cursor adapter spawns the installed `agent acp` process in the selected
world and authenticates with `cursor_login`. Permission, question and plan
requests use the same approval cards. Login, billing and credentials stay inside
Cursor. Image generation remains on Codex.

The user-facing image request and output-to-board review path is implemented.
Provider capability discovery and adapter tests passed. Actual native image
generation has not been exercised end-to-end by this milestone's recorded tests.
The installed Codex provider manages its image model separately from the selected
coding model. Generated results wait for board acceptance and are not automatically
bible-approved. [Codex image generation](https://learn.chatgpt.com/docs/image-generation),
[app-server](https://learn.chatgpt.com/docs/app-server).

The world workspace is `../holodeck-worlds/hearth` by default, overridable with
`HOLODECK_WORKSPACE`. Asset authoring uses its configured `kiln_workspace` setup;
installed package/engine code is outside ordinary world editing. Environment choices
are currently construct/meadow/woodland with static GLB placements and simple
blockers. Schema2 also supports a bounded heightfield/ocean and optional maker
possession with first/third-person cameras. General imported-rig possession,
custom physics and XR are future capabilities. See
[terrain and inhabitants](terrain-and-inhabitants.md).

New schema v2 examples add authored camera/blocker data and built-in hinge/spin
activity. The new `world_check` tool supplies advisory evidence for reflection;
its adapter path is tested with a mock transport, without a new live inference run.
See [architecture](architecture.md), [examples](example-worlds.md) and
[coherence protocol](coherence-protocol.md). No ECS or rigid-body backend is
required. New example workspaces receive Holodeck skills; existing instructions
are not overwritten.

