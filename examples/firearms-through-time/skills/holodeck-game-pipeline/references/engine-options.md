# Engine options — dated research, not a permanent ranking

Checked 25 October 2026. Revalidate capabilities against installed versions before implementation.

- **Unreal 5.8:** [official experimental MCP](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor) enables editor tools and automation. Discover actual toolsets; serialize mutations on the editor game thread. Good production candidate when environment rendering and animation tools matter.
- **Hyperreal:** [starter kit](https://github.com/vibegameengine/hyperreal-starter-kit), reviewed at d28b3d884598f4b1d29060da52f8e9142ddf6254, offers TS/React scenes on Unreal, GLB import/cook and runtime probes. It is an engine-specific authoring layer, not automatic Three.js conversion. Current setup/build is Windows-specific; stock Unreal has its own Linux path. Treat published timings as upstream claims until reproduced.
- **Unity:** [agent plugin](https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin) and [CLI migration guide](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli) provide current agent tooling. The CLI replaces older Assistant MCP instructions. Inspect glTFast and the selected render pipeline for import compatibility.
- **Bevy:** see bevy-context.md. Strong modular/shared-Rust option; compare production animation/tools and package delivery using a real slice.
- **Godot:** [CLI](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) and native glTF import offer a compact Linux automation baseline. Pin the stable docs/version before coding.
- **s&box:** [editor MCP](https://sbox.game/dev/doc/editor/mcp-server) and native Linux support are current. [Roadmap](https://sbox.game/roadmap/) still lists glTF as planned, and [standalone export](https://sbox.game/dev/doc/exporting/) has preview/approval requirements. Evaluate a derived asset-conversion path explicitly.

Choose two finalists for one common scene/behavior fixture rather than building multiple full prototypes. Compare agent observability, import fidelity, authoritative behavior, editing cost, packaging and measured performance. A jam or new tool can justify an experiment, but does not establish that engine's suitability for the whole platform.
