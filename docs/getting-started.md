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
Agent authoring uses a local Codex CLI signed in with ChatGPT, or the Cursor CLI.
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

You arrive in the preset cove in an otherwise empty construct.

1. Click **Connect ↗**, then **Codex** or **Cursor**.
2. For Codex, choose a model from the returned list. Reasoning effort can stay
   at its model default. Codex must be signed in with ChatGPT before sending a
   message. For Cursor, choose Agent, Plan or Ask. Sign-in, billing and
   credentials stay inside Cursor. Holodeck does not read them.
3. Describe what to build in the message box. Add intent and rules in the bible
   and references on the mood board as needed. Review proposed world changes and
   Cursor permission, question or plan requests, then apply scene changes.

For example: “Help me plan a small woodland retreat around this platform. Start
with a short bible and a walkable blockout.” Image generation stays on the Codex
connection.

Connect automatically configures a Kiln authoring workspace inside this world
when one is missing. You do not need to clone or author inside the Kiln engine
repository. Holodeck uses the installed Kiln dependency and connects the agent
to this world's `kiln_workspace` tools.

## More worlds from the browser

Click the world-name button to open **Worlds**. Choose **New world**, enter a
name, and select **Create & open** for another fresh cove. Or choose **Tidemark
Island** under **Start from an example** for an independent editable scene copy.
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
computer, not a Docker volume or cloud mount. Holodeck does not copy Codex
credentials into it. Folder layout is storage underneath the browser workflow,
not something you need to manage during normal authoring.

Stop the terminal server with Ctrl+C. To return, run `launch` again from the
checkout, or `dev` with an explicit world folder. Restarting opens the world
named in that command, not your last picker selection. Scene revisions persist;
camera position and running activity are not saved play-state checkpoints.
