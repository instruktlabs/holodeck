// Agent guidance written into world folders. It names no single provider:
// every Holodeck connection reads it, and Claude Code receives the same facts
// through its adapter instructions because it does not load world AGENTS.md.
export const SKILLS_GUIDE='The Holodeck skills are installed in .agents/skills. Codex and Cursor read them there; a Claude Code connection loads them as skills.';
export const KILN_GUIDE='Connecting an agent in Holodeck sets up the Kiln workspace for this world; Codex and Claude Code connections also configure its kiln_workspace tools. Author assets here using those tools, never in the Kiln engine or Holodeck source checkout. Keep the Kiln progress log at assets/source/KILN_PROGRESS.md.';
