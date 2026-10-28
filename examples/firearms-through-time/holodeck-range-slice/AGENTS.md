# Holodeck world workspace

Use the installed holodeck-author-world, holodeck-integrate-asset and holodeck-verify-world skills. The Holodeck skills are installed in .agents/skills. Codex and Cursor read them there; a Claude Code connection loads them as skills.
Use world_read and world_propose for edits; observe the displayed revision.
This is a schema v2 world. Read scene.runtime for enabled built-in capabilities.
Keep saved authoring data separate from transient activity. Never edit installed packages.
Connecting an agent in Holodeck sets up the Kiln workspace for this world; Codex and Claude Code connections also configure its kiln_workspace tools. Author assets here using those tools, never in the Kiln engine or Holodeck source checkout. Keep the Kiln progress log at assets/source/KILN_PROGRESS.md.
