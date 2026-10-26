# Holodeck game workflow — working proposal

25 October 2026. No production engine selected and no native adapter implemented.

## Agreed direction

Improve references → align on a data-driven blueprint → establish the bible and rules → author assets in Kiln → compose and simulate in Holodeck's browser → migrate the same authored intent and behavior to a production engine → compare actual results.

The browser prototype includes simulation, not only visual composition. Separate game rules and authoritative state from renderer/DOM/engine objects. Port assets, stable IDs, configuration data, commands and expected events; implement destination-specific adapters. A shared Rust/WASM/native core is one option, not a prerequisite that forces Bevy.

## Engine findings

- [Unreal / Hyperreal](UNREAL-AGENT-RESEARCH.md): stock Unreal 5.8 plus official experimental MCP is the leading production evaluation. Hyperreal supplies a promising TypeScript/React-on-Unreal path but its setup and packaging are Windows-specific. It does not convert Three.js games automatically.
- [Bevy](BEVY-AGENT-RESEARCH.md): 0.20.0 is the checked stable release. Strong modular Rust and shared-core candidate, with official remote-testing examples. More production tooling/animation integration needs evaluation.
- [Unity, Godot, s&box](ALTERNATIVE-ENGINES-RESEARCH.md): Unity has current first-party agent skills/CLI/MCP and deserves finalist consideration. Godot is a useful lightweight Linux portability baseline. s&box has Linux and MCP, but GLB conversion and standalone distribution complicate this path.

Use one identical small browser/native fixture before committing. Judge asset import, behavior equivalence, character control, agent observations, material quality, reset/re-export, packaging and measured performance. Do not build several full games to compare engines.

Epic's [AI MegaJam announcement](https://www.unrealengine.com/news/2026-epic-ai-megajam) confirms November 12–15, 2026, using Unreal or UEFN. The [event page](https://itch.io/jam/2026-epic-ai-megajam) says game work starts November 12 and earlier work must be declared. This research/preparation is not a claim of entry eligibility or a registration.

## Reusable agent skill

Created and structurally validated `holodeck-game-pipeline` under the user's Codex skills directory. It contains the portable behavior contract and a versioned Bevy documentation map. It is a reusable local authoring skill, not a shipping Holodeck feature. Product integration will need versioned schema/runtime extensions, export adapters, observations and tests in the toolchain.

The local [Bevy reference excerpts](bevy-0.20.0-context/manifest.json) include eight official tagged examples plus license notices, with hashes. They have not been compiled or run; some need companion files and upstream assets. Use the full pinned upstream source for execution.

## Current game artifacts

- [Provisional brief](../firearms-through-time/DESIGN-BIBLE.md): not an approved bible.
- [Exploratory mood board](../firearms-through-time/MOOD-BOARD.md): updated massive modern range direction.
- [SVG blueprint](../firearms-through-time/blueprints/range-campus-01.svg): six banks / 48 stations as a configurable proposal, with a facing chronological collection wall and shared concourse.
- [Python generator](../firearms-through-time/blueprints/build_blueprint.py), [layout input](../firearms-through-time/blueprints/layout.json), [placement data](../firearms-through-time/blueprints/placements.json), [validation](../firearms-through-time/blueprints/validation.json).
- [Range activity research](../firearms-through-time/RANGE-ACTIVITY-RESEARCH.md): 14 source-inspired and invented game activities, reusable preset dimensions and priorities.
- [Soldier prototype source](../firearms-through-time/character/sentinel.kiln.js): static rigid-part appearance prototype; Maker remains available for controller testing.
