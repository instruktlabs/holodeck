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

You need Git, Node.js and npm, plus a local Codex CLI signed in with ChatGPT for
agent authoring. Node 24.20.0 and npm 11.19.0 were used for this evaluation.
You can open and inspect a world before connecting the agent.

```sh
git clone https://github.com/instruktlabs/holodeck.git
cd holodeck
npm ci
mkdir ../my-worlds
node bin/holodeck.mjs init ../my-worlds/first-world
node bin/holodeck.mjs dev ../my-worlds/first-world --port 4190
```

If your chosen parent directory already exists, skip `mkdir`. The first-world
directory must be new: init creates it and refuses to overwrite an existing
path. Its parent must exist first.

Keep that terminal running and open
`http://127.0.0.1:4190/prototype.html`. You arrive in the preset cove in an
otherwise empty construct. This is the current first-run flow; there is no
one-command setup-and-launch wizard yet.

1. Click **Connect ↗**, then **Connect local Codex**.
2. Choose a model from the returned list. Reasoning effort can stay at its
   model default. Codex must be signed in with ChatGPT before sending a message.
3. Describe what to build in the message box. Add intent and rules in the bible
   and references on the mood board as needed. Review the agent's proposed world
   changes, then apply them to enter the accepted scene.

For example: “Help me plan a small woodland retreat around this platform. Start
with a short bible and a walkable blockout.” Agent turns use your local Codex
connection; the model list and availability come from that installed app-server.

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

The checkout contains Holodeck's tools. `my-worlds` is just the parent folder
you chose for saved worlds; `holodeck-worlds` is not a required name or namespace.
By default, the picker discovers worlds directly inside the parent of the world
passed to `dev`. Keep worlds you want in one picker as siblings there.

Each child world holds its scene, assets, references, installed workspace skills,
history and local agent session state. Its directory is the agent's actual
working directory and workspace-write root. It is an ordinary folder on this
computer, not a Docker volume or cloud mount. Holodeck does not copy Codex
credentials into it. Folder layout is storage underneath the browser workflow,
not something you need to manage during normal authoring.

Stop the terminal server with Ctrl+C. To return, run the same `dev` command
from the checkout. Restarting opens the world named in that command, not your
last picker selection. Scene revisions persist; camera position and running
activity are not saved play-state checkpoints.
