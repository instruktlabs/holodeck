# Unreal toolchain consultation

Recommendation: begin with stock Unreal 5.8 plus official agent tooling on the Windows PC. Evaluate Hyperreal in a separate small project only after establishing a baseline. Do not make the entire project depend on a new bridge before its import, observation and packaging paths work locally.

| Tool / system | Intended job | Boundary |
|---|---|---|
| Unreal MCP + selected Toolsets | Discover editor capabilities; inspect actors; place content; edit exposed settings; invoke tests | Experimental; serialize editor mutations and inspect actual supported tools. |
| Python Editor Script Plugin / Editor Scripting Utilities | Deterministic scene generation from JSON, import configuration, metadata tagging and repeatable editor checks | Editor-only, not shipped gameplay. |
| Interchange | GLB/glTF asset import with a controlled pipeline and reusable import settings | Does not translate behavior or guarantee material/rig fidelity. |
| Blueprints + a small C++ runtime module where needed | Interactions, lane configuration, activity state, events, score/reset and portable query adapters | Keep gameplay out of one-off editor scripts. Use text-based data for scenario definitions. |
| Character controller / input / animation tools | Playable walking, camera, interaction and later skeleton/IK integration | Sentinel currently has rigid pivots only; do not assume humanoid retargeting works. |
| Material instances and lighting tools | Shared material language, exhibit illumination and range visibility | Test actual target GPU; no blanket Lumen/Nanite performance promise. |
| Automation / Functional Testing / screenshot comparison | State transitions, repeated resets, walking route and visual regressions | Rendered review and packaged launch remain required. |
| Unreal Insights / runtime stats | Frame, CPU/GPU and loading investigation | Measure representative scene density and record machine/settings. |
| Build/cook/stage/package (UAT when appropriate) | Produce a reproducible Windows build and launch with editor stopped | Editor play success is not packaged-build evidence. |
| Hyperreal (optional) | TypeScript/React scene authoring, live asset cooking, runtime probes and HTML UI | Windows-specific kit on Unreal, not Three.js conversion; separate evaluation dependency. |

## Primary documentation

- [Official Unreal MCP](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)
- [Editor Python](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python)
- [Interchange](https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-assets-using-interchange-in-unreal-engine)
- [Automation framework](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine)
- [Packaging](https://dev.epicgames.com/documentation/en-us/unreal-engine/packaging-your-project)
- [Unreal Insights](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine)
- [Hyperreal](https://github.com/vibegameengine/hyperreal-starter-kit), inspected at d28b3d884598f4b1d29060da52f8e9142ddf6254.

Confirm installed engine, plugin/tool names, compatible compiler and Windows SDK from the actual installation before setup. Do not copy a stale compiler version from this document. Unreal MCP is a local editor service; run the agent on the PC rather than exposing it publicly. Source control should include authored data and source; generated engine content needs an explicit ownership/reimport policy.

## Why this ranking

Unreal is the best current fit in my judgment for this project's environmental scale, material/lighting ambition and eventual character presentation. The Windows workstation removes Hyperreal's platform mismatch and helps with iteration, but does not eliminate engineering work or establish performance.

Unity is the next candidate for a C# workflow and current first-party agent skills/CLI. Bevy is attractive if a modular Rust runtime and Holodeck platform control outweigh production-tool maturity. A shared Rust behavior core can be used without choosing Bevy. Keep the engine-independent contract regardless of destination.
