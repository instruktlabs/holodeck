# Getting started

Set up locally, open the preset cove, connect your coding agent, and describe
the world you want to build. The cove, creation platform and mood board are
already there. You do not need to design an entrance or manage folders through
the browser before starting.

Holodeck is an early source-checkout prototype available at
[instruktlabs/holodeck](https://github.com/instruktlabs/holodeck).
If you already have this checkout, start with `npm ci` inside it.
There is no npm release.

## Start your first world

You need Git, Node.js and npm. Node 24.20.0 and npm 11.19.0 were used for this
evaluation. `npm ci` installs dependencies once; launch does not download them.
Agent authoring uses a local Codex CLI signed in with ChatGPT, the Cursor CLI,
or your own installed Claude Code CLI signed in with your Claude subscription.
You can open and inspect a world before connecting an agent.

```sh
git clone https://github.com/instruktlabs/holodeck.git
cd holodeck
npm ci
node bin/holodeck.mjs launch
```

Launch creates `../holodeck-worlds/cove` when that folder is new, using the
construct scaffold, then starts the dev server and opens `prototype.html`.
Run it again to reopen that world. If the folder exists and is not a Holodeck
world, launch stops without changing it. Pass a directory to use another folder:
`node bin/holodeck.mjs launch ../my-worlds/first-world`.

`init` remains available when you want to create a world without starting the
server. It still refuses to overwrite an existing path, and the parent directory
must already exist.

You arrive in the preset cove in an otherwise empty construct. The world fills
the screen. One dock at the bottom holds the agent's status, the message box and
the section tabs: **Conversation**, **Bible**, **Mood board**, **World**,
**Observe**, **History** and **Agent**. A tab opens its section in a sheet above
the dock; **Tall** and **Half** change its height.

1. Choose **Connect** beside the message box. The **Agent** sheet opens. Pick
   **Codex**, **Cursor** or **Claude Code**, then choose **Connect Codex**,
   **Connect Cursor** or **Connect Claude Code**.
2. For Codex, choose a model from the returned list. Reasoning effort can stay
   at its model default. Codex must be signed in with ChatGPT before sending a
   message. For Cursor, choose Agent, Plan or Ask. Sign-in, billing and
   credentials stay inside Cursor. Holodeck does not read them. For Claude Code,
   sign in first by running `claude` in a terminal. Connect checks
   `claude auth status`, shows the sign-in method and plan, and refuses an API-key
   sign-in so billing stays on your subscription. Holodeck offers no Claude login
   and never reads Claude credentials. Choose a model alias or an exact model ID
   (listed separately), or keep the account default.
3. Describe what to build in the message box. The latest reply appears briefly
   above the dock; **Conversation** holds the whole thread. Add intent and rules
   under **Bible** and references under **Mood board** as needed. Permission,
   question and plan requests wait in the dock one at a time.
4. A proposal appears as a line in the dock with a count of its changes. Added
   or moved placements show as ghosts in the world; **Preview** turns them off
   and on. **Review** opens the differences. **Apply** saves a new revision,
   which loads where you stand; **Discard** drops it.

Click an object to refer to it in your next message; Shift-click adds more.
**Enter world** lets you walk the result. While walking, Enter opens the message
box without leaving the world; Enter sends and Esc returns to walking. Esc while
walking, or **Return to making**, brings back the workspace.

For example: “Help me plan a small woodland retreat around this platform. Start
with a short bible and a walkable blockout.” Image generation stays on the Codex
connection.

Connect automatically configures a Kiln authoring workspace inside this world
when one is missing. You do not need to clone or author inside the Kiln engine
repository. Holodeck uses the installed Kiln dependency and connects the agent
to this world's `kiln_workspace` tools.

## More worlds from the browser

Click the world-name button at the top left to open **Worlds**. Choose **New
world**, enter a name, and select **Create & open** for another fresh cove. Or
choose **Tidemark Island** under **Start from an example** for an independent
editable scene copy.
The picker creates the folders for you. Connect the agent in the selected world
when you want to author there.

Save or discard drafts and finish or stop active agent work before switching.
One host serves one active world; all tabs connected to it share that selection.
**Rename current world** changes its displayed bible title, leaving its folder
and stable ID unchanged. See [saved worlds](world-library.md) for switching and
draft recovery details.

## Where your work lives

The checkout contains Holodeck's tools. `holodeck-worlds` is the parent folder
launch uses beside the current directory; it is not a required namespace if you
pass another path. The picker discovers worlds directly inside the parent of the
world passed to `launch` or `dev`. Keep worlds you want in one picker as siblings
there.

Each child world holds its scene, assets, references, installed workspace skills,
history and local agent session state. Its directory is the agent's actual
working directory and workspace-write root. It is an ordinary folder on this
computer, not a Docker volume or cloud mount. Holodeck does not copy Codex,
Cursor or Claude credentials into it. Folder layout is storage underneath the browser workflow,
not something you need to manage during normal authoring.

Stop the terminal server with Ctrl+C. To return, run `launch` again from the
checkout, or `dev` with an explicit world folder. Restarting opens the world
named in that command, not your last picker selection. Scene revisions persist;
camera position and running activity are not saved play-state checkpoints.
This browser remembers the last agent connected in each world, so after a
restart the dock offers **Reconnect** with that provider.
