# Saved world library

The world-name button opens **Worlds**, with saved worlds and available examples.
Each world has its own files, revision history and local agent state.

## Create, open and rename

- Choose **New world**, enter a name, then **Create & open**. A fresh construct
  opens in the cove, ready for a bible, references and world authoring.
- Select a saved world to open it. An unavailable entry cannot be opened until
  its files are repaired; the picker does not delete or replace it.
- Choose **Rename current world**, enter its name, then **Save name**. This saves
  a new bible-title revision. Its folder and stable world ID stay unchanged.
- Under **Start from an example**, choose **Tidemark Island** or a smaller
  courtyard/kinetic fixture. Name the copy and choose **Create & open**. The copy
  has an independent history; edits never change the bundled example.

Tidemark's example ID is `tidemark`. Its scene, exact GLB deliveries and curated
public guidance are editable locally. The original procedural asset source,
reference attachments and agent history are excluded. Its physical mood board
starts empty. See [example contents and CLI commands](example-worlds.md).

## Resolve drafts before switching

The picker lists what prevents a world change: unsaved editor drafts, an unsent
message, an active agent turn or pending proposal, a load/import/save in progress,
or a disconnected host. Each blocker with a location has a **Review** link that
opens the sheet or message box holding it. Save or discard drafts using their editors, send or clear
the message, and finish or stop the agent turn. Apply or discard a proposal before
continuing. Native agent approval requests and in-flight host work also block
switching. The picker does not interrupt or discard work automatically.

Browser drafts survive closing their sheets within the same session. They
are not a disk backup: save before refreshing, closing the tab or stopping the
host. New/open/rename actions remain disabled while these blockers are present.

All tabs connected to one host share its active world. If another tab switches
while this tab has drafts, this tab keeps them visible with **Another tab changed
worlds**. Its old session can no longer save. Copy anything you need, then use the
explicit **Discard local drafts & open** action to join the current world. Stale
requests cannot write those drafts into the newly active world.

## Choosing a folder

The [first-run guide](getting-started.md) starts you in the preset cove, then
connects your agent. After that, use **New world** in the browser; the picker
creates each workspace for you.

There is no required `holodeck-worlds` name or namespace. The library is an
ordinary parent folder you choose, such as `../my-worlds`, separate from the
Holodeck source checkout. Init requires that parent to exist and creates a new
child world. Worlds shown together are direct children of the same library.
Each world is the local agent's working directory and workspace-write root,
with its own skills, history, assets and session state. This is local filesystem
storage, not a container or cloud mount. Connect initializes Kiln in that world
when needed; no Kiln engine checkout is required.

## Local storage and activation

By default, the library is the parent directory of the world passed to
`holodeck dev <world>`. Existing worlds must be direct children of that directory.
The host can set `HOLODECK_LIBRARY` to a different trusted library directory;
the starting world must still belong to it. The browser selects known IDs and
cannot open an arbitrary server path or download URL.

The library's `.holodeck-library.json` stores stable local identities separately
from names and folder names. Existing folders may have spaces; newly created
folders use generated IDs. Incomplete or invalid worlds stay unavailable rather
than being mistaken for ready entries. Renaming never moves a workspace.

One host has one active world and agent context at a time. A switch closes the
previous idle context and opens the selected workspace with a fresh activation
token. Requests, observations, asset URLs and event streams carry that context,
so an old tab is rejected even when two worlds share a revision number. Saved
history and pinned assets remain in their own workspace. Failed target validation
keeps the previous world active.

Restarting the host opens the explicit CLI starting world, not the last picker
selection. Camera position, actor pose and running activity are transient; world
switching and reopening do not restore a play-state checkpoint. See
[world history](world-history-and-export.md) for saved-scene restoration.

## Examples and portability

An example's manifest integrity identifies its delivered scene and GLB bytes.
Installing it creates a fresh local identity and revision history, rather than
importing the author's workspace. This boundary can support future verified
downloaded catalogs, but hosted libraries, account sync and network installation
are not implemented.

For a standalone playable site, use [static export](static-export.md). A static
player contains the accepted scene and assets without this local picker, agent
or authoring host. See [licensing](../LICENSING.md) for bundled content and
user-created world boundaries.
