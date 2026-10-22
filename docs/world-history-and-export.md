# World history, remixing and static delivery

Accepted scene edits create numbered revisions in the local world workspace.
Each snapshot retains the scene, bible, reference records and a receipt binding
asset IDs to immutable GLB bytes. Replacing a mutable import does not change the
bytes belonging to an older accepted revision. Transient player positions,
activity phases and agent sessions are not simulation checkpoints.

Open **World → World history** to browse snapshots. Restoring an older revision
creates a new current revision: later snapshots remain available. Restore checks
the current base revision and verifies the old asset hashes before applying it.
Wait for an active agent turn to finish so its proposal is not silently displaced.

Remix creates a new sibling world folder with the selected layout, bible, board
references and pinned GLBs, beginning at revision zero. Existing destinations are
never overwritten. The new world receives the maintained Holodeck skills; agent
sessions and credentials are not copied. Unversioned asset source and the original
Kiln library are not copied. GLB provenance remains a source identity, not a claim
that the source library is installed in the remix. Configure its local Kiln
workspace before refining assets. Board references retain their pinned files;
mutable source pointers are cleared because those files were not copied.

History is local and data-driven. It requires no Git repository or VCS service.
Its files are a development format rather than a cross-version archival standard.
Deleting a workspace or its cached blobs can make revisions unavailable; normal
workspace backup remains separate.

Pinned GLBs stay byte-exact in `.holodeck/blobs`, in history and in exports.
The local host serves the browser a derived form of each GLB: embedded
images move to `/api/textures/<sha256>.<ext>`, so an image shared by many
assets downloads once. The image bytes are unchanged, so rendering is the same.
The derived form is rebuilt in memory and never written back.
`HOLODECK_SHARED_TEXTURES=0` serves the pinned bytes instead.

Terrain layer PNGs are pinned the same way, in the receipt's `textures` map
keyed by their path. Restore and remix copy each pinned image to
`assets/imports/terrain/snapshot-<sha256>.png` and point the layers at it;
undo uses `restored-<sha256>.png`.

## Static experience boundary

A static export is a playable snapshot of an accepted schema-v2 scene and its
pinned assets. It has no local authoring server, subscription connection, agent
conversation, filesystem tools, or editable bible. Public interaction comes from
the runtime capabilities already declared by that scene. Editing and agent work
continue in the original or remixed local workspace, followed by another export.

Exports use relative resource paths so the directory can be served at a domain
root or a subdirectory. Serve over HTTP(S); opening `index.html` with `file://`
does not provide the browser loading environment. WebGPU requires a secure
context (HTTPS or localhost); the player also supports WebGL2. Hosting an export
does not itself provide multiplayer, save synchronization or a cloud agent.

The [export command and artifact inventory](static-export.md) document exactly which files are
included. References, authoring prose and local session data are excluded from
the public player by default. Publication and asset license clearance remain
separate owner decisions; creating a local export does not deploy anything.
