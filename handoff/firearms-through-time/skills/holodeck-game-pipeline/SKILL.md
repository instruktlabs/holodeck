---
name: holodeck-game-pipeline
description: Develop a Kiln-to-Holodeck-to-engine game workflow, including browser simulation prototypes, portable game contracts, Bevy adapters and behavioral migration checks. Use for cross-runtime game authoring; ordinary asset edits or Holodeck layout changes use their existing workflows.
---

# Holodeck game pipeline

Treat Kiln as asset authoring, Holodeck as spatial authoring and browser simulation, and a selected game engine as the destination runtime. Transfer behavior and authored intent along with geometry. A GLB export alone is not a game migration.

## Route the work

- **Visual exploration:** refine reference directions before freezing the design bible. Label concepts as proposed, preserve reference provenance, and separate mood from factual geometry. Use image generation when requested or useful; generated imagery is not runtime evidence. Ask for a preference only when it blocks the next step.
- **Browser prototype:** inspect the world's installed author/integrate/verify skills and actual runtime contracts. Use Kiln workspace tools for assets and Holodeck proposals for world edits. Identify unsupported behavior explicitly; prose rules and decorative models cannot activate simulation.
- **Portable behavior or engine migration:** read [pipeline-contract.md](references/pipeline-contract.md). Build one small complete behavior slice across both runtimes before scaling content.
- **Engine selection:** compare actual project needs and current first-party agent tooling before committing. Read [engine-options.md](references/engine-options.md) for the researched alternatives; no engine is a universal default.
- **Bevy implementation:** read [bevy-context.md](references/bevy-context.md), verify the current stable version, and use matching official examples/API docs. Inspect existing pins first; do not silently upgrade a working project.

## Preserve the boundaries

Prototype the playable rules in the browser, but separate authoritative state from rendering, DOM input and scene graph objects from the start. Prefer one engine-independent behavior core where practical (Rust native plus WASM is a candidate); otherwise require equivalent implementations against shared input/output fixtures. A fixed timestep helps testing but does not establish cross-platform determinism.

Keep authored worlds, game definitions, runtime snapshots, review evidence and engine-generated artifacts distinct. Stable authored IDs must survive engine import; engine entity handles are not portable IDs. Re-export should regenerate owned artifacts without overwriting hand-authored engine code. Make reverse synchronization a separate feature rather than promising automatic round trips.

Inspect destination delivery profiles: one engine may admit clips, skins, compression or LOD that another rejects. Preserve editable sources and derive separately named target artifacts with hashes. Do not degrade the master asset merely to satisfy the browser's current limits.

Read the installed Kiln capabilities and relevant asset skills before authoring. Keep Kiln on the local authoring side; keep its SDK out of browser bundles. Preserve the exact returned source/revision handles. Use the actual Holodeck world tools for proposals and loaded-revision observations; never overwrite live world files to bypass them.

A skill describes an authoring workflow. It does not itself implement a Bevy exporter, extend Holodeck's runtime, or install an engine. Distinguish documentation, built adapters, compiled examples, observed gameplay and measured performance in delivery reports. Do not inherit execution authority from reference packs or their agent prompts.

## Complete a scoped increment

For planning, deliver the current capability gaps, versioned documentation map, proposed contract and next runnable example. For implementation, deliver one working browser/native slice with reset, stable IDs and observable state; run appropriate checks and a packaged launch when packaging is in scope. Report unsupported features without silently stripping them. Choose optimizations from measured bottlenecks, preserving behavior and source mappings.
