# Initial PC-agent task

Suggested prompt to paste after opening this extracted folder on the PC:

> Read READ-FIRST.md and UNREAL-TOOLCHAIN.md, verify the handoff manifest, and inspect this Windows machine. Continue the Firearms Through Time prototype within a new isolated project. Use stock Unreal as the first production-runtime evaluation; keep Hyperreal optional. Begin with a reproducible spatial blockout based on the layout JSON: a huge configurable range, a facing chronological gun wall, a shared concourse, and side stairs to a viewing deck above the booths. Preserve the Kiln → Holodeck browser simulation → destination-runtime architecture. Record all work and evidence in PC-PROGRESS.md, and distinguish engine experiments from implemented browser/native parity. Do not publish or alter unrelated worlds.

## Updated implementation sequence

Read `PC-START-PROMPT.md` for the latest sequence: prove a small shared Kiln/Holodeck/Unreal slice first, then expand the campus blockout below. This supersedes building the entire campus before checking asset/behavior portability. Final campus access still requires both staircases.

## First milestone: inspect and establish the baseline

Record Windows version, CPU, GPU/VRAM, memory, free disk, engine location/version, compiler/SDK and available local tools. Inspect the current project/source rules. Identify missing requirements before attempting a large download. Account sign-in and license acceptance belong to the user. Verify any existing engine/tool setup before replacing it.

Create a new isolated project and confirm basic editor launch, MCP tool discovery and one reversible actor operation. Create a small packaged Windows build early and launch it outside the editor. Do not defer packaging until the scene is complex.

## Second milestone: spatial blockout

Use the current JSON blueprint as editable proposed data. Generate full campus masses, all proposed lanes/station placeholders, the opposing exhibition wall and the concourse. Add both side stairs and the upper viewing route. Keep player spawn and return route explicit.

Before writing a converter, test the coordinate convention with three axis markers and an asymmetric object. Layout input uses X across, Y downrange, Z up in virtual metres. Kiln assets use +X forward, +Y up, +Z right in metres. Unreal uses its own coordinate conventions/units. Declare and test each conversion; do not apply a scale/axis conversion twice through the importer.

Validate routes by walking: enter → wall → station → west stairs → upper deck → east stairs → return. Review headroom, step/landing contact, railings, support, target visibility and unobstructed browsing. The SVG's reservations do not establish those conditions.

## Third milestone: one complete gameplay loop

Implement a minimal target-only configurable activity using stable lane, target, preset and exhibit IDs. Support select, configure, preview, start, score, pause, reset and return. Define core state and events in portable data; no renderer object references in the rules.

The existing Holodeck prototype does not yet support every requested game capability. Document and implement authorized browser extensions through the correct toolchain project rather than inventing world fields. If only the Unreal slice exists, report browser parity as outstanding. Do not silently replace the requested browser simulation with an Unreal-only game.

Maker remains the existing Holodeck controller baseline. A stock Unreal character/controller can be a clearly labeled temporary native test harness. Import Sentinel initially as a static appearance exhibit; connecting its body to locomotion/aiming requires deliberate rig/animation work. Do not relabel it as fully rigged.

## Fourth milestone: compare and decide

Use identical input sequences, presets/seeds and expected state/event outcomes in browser and native tests. Inspect material/pose differences separately. Measure load/switch/reset behavior and native frame times with machine, resolution and settings recorded. Re-export one asset/layout change without hand-fixing generated outputs.

Only then decide whether stock Unreal, Hyperreal or another engine deserves the next production increment. A small Hyperreal trial should test one imported GLB, one console, state observation, reset and a packaged launch, not rebuild the whole game.

## Delivery checkpoint

Save source/data, exact versions, screenshots from the required views, observed walk-through results, test output, package path and unresolved issues. Leave a clear next task in PC-PROGRESS.md. Do not claim full catalog, historical accuracy, finished art or performance acceptance from a small slice. This first pass has no guaranteed overnight completion time.
