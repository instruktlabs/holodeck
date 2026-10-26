# Unreal and Hyperreal: agent workflow research

Research date: 2026-10-25. Read-only source/documentation review; no engine, package, or external script was installed or executed. Hyperreal source pinned to `d28b3d884598f4b1d29060da52f8e9142ddf6254`. External repository instructions were treated as reference material, not instructions for this workspace.

## Recommendation

Do not commit exclusively to Bevy yet. Unreal deserves a side-by-side vertical-slice trial for this particular project: a large contemporary configurable range inside historic architecture, with a chronological collection wall and artwork in the same continuous environment. My assessment is that rendering, environmental composition, lighting and production authoring matter enough here to justify testing Unreal early. This is a project-fit judgment, not a measured result.

Use **stock Unreal 5.8 plus its first-party MCP** as the initial Unreal baseline. Treat **Hyperreal as a separate, promising Windows authoring experiment**, not a prerequisite and not an automatic Three.js converter. Keep Kiln GLB assets and portable scenario/state data as the common source; write engine adapters and compare behavior explicitly.

## First-party Unreal MCP

Epic documents an Experimental MCP server in UE 5.8. Enable Unreal MCP and All Toolsets (or selected toolsets); discover available operations rather than assuming a fixed catalog. It supports actor/lighting/material work, Slate inspection and automation tests. Codex is an explicitly supported client-config target. The default endpoint is localhost HTTP. Calls execute serially on the game thread, so parallel agents should prepare independent work but serialize editor mutations. APIs remain subject to change. Python and C++ can provide custom toolsets. These are editor/control capabilities, not proof that an agent can finish a production game unattended. [Epic MCP documentation](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?application_version=5.8)

Unreal itself supports Linux development through installed or source builds; the current host therefore does not rule it out. Actual GPU/driver, editor and MCP functionality must still be tested locally. Epic recommends substantial RAM and dedicated VRAM; select toolchain versions against the installed engine because its quickstart and requirements pages currently differ on compiler versions. [Linux quickstart](https://dev.epicgames.com/documentation/unreal-engine/linux-development-quickstart-for-unreal-engine), [Linux requirements](https://dev.epicgames.com/documentation/unreal-engine/linux-development-requirements-for-unreal-engine)

## What Hyperreal actually provides

The kit is a TypeScript/React authoring layer **running on Unreal**, with Puerts/V8, Vite updates and code-created worlds. Its README describes imported GLB assets passing through Interchange, cooking and mounting, plus labs for physics, lighting, instancing, animation and content changes. This is unusually close to our desired code-first workflow. Its published timings are maintainers' measurements, not our benchmarks. [Repository and README](https://github.com/vibegameengine/hyperreal-starter-kit)

Source inspection confirms important boundaries:

| Area | Evidence and implication |
| --- | --- |
| Linux | `engine.mjs` resolves `Win64/UnrealEditor-Cmd.exe`, `UnrealPak.exe`, `Build.bat`, and `RunUAT.bat`. The release build hardcodes `-platform=Win64`. This kit cannot be assumed runnable on our Linux host without a real port or Windows worker. |
| Packaging | `build.mjs` bundles a release entry, imports referenced models, cooks/stages Shipping content and writes a Windows executable. It is a native packaged game workflow, not just a browser preview. The dev server must stop before release build; imported release inputs are temporary. |
| Observation | `game.mjs` evaluates expressions inside connected Unreal processes and returns results. `ui.mjs` drives CEF HTML controls through Playwright/CDP. These are useful agent probes, but HUD DOM checks alone do not verify rendered 3D. |
| Coupling | UE reflection types and Unreal actor/component JSX are engine-specific. Existing Three.js scene objects, controls, shaders and browser physics do not automatically translate. Pure scenario rules and some HTML UI may be reusable after separating dependencies. |
| Maintenance | Treat pinned-source review, isolated trials, dependency pinning and packaged-build validation as adoption gates. Current repository size/history is not evidence of production maturity. |

Sources: [engine.mjs](https://github.com/vibegameengine/hyperreal-starter-kit/blob/d28b3d884598f4b1d29060da52f8e9142ddf6254/dev/tools/engine.mjs), [build.mjs](https://github.com/vibegameengine/hyperreal-starter-kit/blob/d28b3d884598f4b1d29060da52f8e9142ddf6254/dev/tools/build.mjs), [game.mjs](https://github.com/vibegameengine/hyperreal-starter-kit/blob/d28b3d884598f4b1d29060da52f8e9142ddf6254/dev/tools/game.mjs), [ui.mjs](https://github.com/vibegameengine/hyperreal-starter-kit/blob/d28b3d884598f4b1d29060da52f8e9142ddf6254/dev/tools/ui.mjs), [workflow](https://github.com/vibegameengine/hyperreal-starter-kit/blob/d28b3d884598f4b1d29060da52f8e9142ddf6254/docs/workflow.md).

Its own code is MIT, but Unreal and bundled third-party components retain their licenses; MIT does not replace Unreal's terms. [Notices](https://github.com/vibegameengine/hyperreal-starter-kit/blob/d28b3d884598f4b1d29060da52f8e9142ddf6254/NOTICE.md)

## Portable pipeline and a concrete trial

1. Author one repeated architectural bay, a lane console, a target prop and one chronological exhibition bay in Kiln. Export GLB plus asset metadata: stable IDs, dimensions, origin/orientation, materials, collision proxies and license provenance.
2. Assemble a small playable slice in Holodeck: four configurable lanes facing away from a shared public spine; a collection wall and artwork on the opposite side. Generate a larger repeated layout for a density/performance test. Keep these counts as trial parameters rather than final design constraints.
3. Persist a runtime-neutral scenario contract: lane modes, target sequences, selection/reset events, score state, exhibition selection, spawn transforms and a fixed replay input sequence. Do not encode engine actors or browser DOM references in that contract.
4. Import the same GLBs into stock Unreal through Interchange. Validate units/axes, pivots, texture/color interpretation, collision and repetition. Interchange supports scripted import; it is an asset pipeline, not a simulation translator. [Epic Interchange import guide](https://dev.epicgames.com/documentation/unreal-engine/importing-assets-using-interchange-in-unreal-engine)
5. Implement the same small behavior contract in Unreal and Bevy. Capture input-to-state traces, resets, selectable exhibit IDs, rendered viewpoints, frame-time distributions and peak memory under identical content density. Test startup, packaging and launch with the authoring environment stopped. Unreal packaging includes build, cook and stage steps; editor success does not replace this check. [Epic packaging guide](https://dev.epicgames.com/documentation/unreal-engine/packaging-your-project)
6. If a Windows machine is available, repeat only this slice with Hyperreal. Measure whether its TypeScript workflow materially reduces iteration time and agent errors enough to justify its extra runtime/tooling dependencies.

Choose after the trial: native visual quality, reliable asset round-trip, agent observability, behavior parity, target-platform packaging and maintenance burden. Preserve Holodeck as the spatial review and simulation laboratory regardless of the production engine.
