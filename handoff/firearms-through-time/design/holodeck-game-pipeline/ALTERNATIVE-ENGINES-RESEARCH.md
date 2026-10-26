# Alternative engines for the Holodeck pipeline

Research date: 2026-10-25, America/New_York. Documentation review only: no engine installed, project imported, benchmark run, or package built. Recommendations below are engineering judgments, not measured results. Scope: Kiln assets → Holodeck spatial/browser simulation → native configurable range and historical collection gallery.

## Recommendation

**Unity merits a trial alongside Unreal, ahead of committing to Bevy, when agent-driven visual editing is a primary criterion.** Its current first-party CLI, MCP and agent skills directly address the requested workflow. **Godot is the best additional small portability trial** if Linux automation, direct GLB ingestion and a simple controllable toolchain outweigh having commercial editor integrations. **s&box deserves a watchlist or focused experiment**, particularly for its editor MCP and game platform, but its current asset conversion and standalone distribution restrictions make it a weaker default destination.

Do not run four full production prototypes. Use the same minimal acceptance slice in the two finalists; keep Godot as a fallback and s&box as a deliberate platform choice. None of these findings proves a runtime will outperform the browser or another engine for this scene.

## Evidence and implications

| Engine | Asset and behavior transfer | Agent workflow / Linux | Packaging constraints and trial position |
|---|---|---|---|
| Unity | Official `com.unity.cloud.gltfast` imports GLB/glTF in editor or at runtime; docs cover Built-in, URP and HDRP. Gameplay remains C#/components or an explicitly integrated shared core. | First-party plugin supplies agent skills, including Codex. Current CLI drives the local editor directly or through MCP, plus builds/tests. Unity 6 supports a Linux editor within documented OS/GPU configurations. | Package and render-pipeline versions must be pinned. Build target modules, editor license and delivery-specific SDK requirements still apply. Strong contender for an editor-centered agent pipeline. |
| Godot | Native recommended glTF 2.0/GLB scene import; post-import scripts/inherited scenes provide an adapter seam. Game rules need Godot scripts/native integration and shared fixtures. | Official command-line workflow, headless import/scripts and exports suit file-oriented agents. This review does not establish a first-party Godot MCP server. | Export presets and matching templates required. Godot 4 C# projects cannot currently export to web; web renderer restrictions matter if replacing Holodeck with a Godot web build. Good compact portability baseline. |
| s&box (Facepunch) | ModelDoc documents FBX/OBJ/VOX rather than GLB. Official roadmap still lists glTF support as planned. Budget a derived asset conversion and material/scale verification step. | Native Linux engine/editor/client shipped in 2026. Built-in editor MCP supports scene inspection/editing, asset search, play, logs and screenshots; custom C# tools can extend it. | Standalone export is preview and requires individual Valve approval and a Facepunch standalone license; PC only in current docs. Strong agent interface, less direct asset/distribution fit. |

Unity sources: [glTFast 6.14](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.14/manual/index.html), [editor import](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.14/manual/ImportEditor.html), [Linux system requirements](https://docs.unity3d.com/6000.0/Documentation/Manual/system-requirements.html), [command-line builds](https://docs.unity3d.com/6000.0/Documentation/Manual/build-command-line.html).

Godot sources: [supported 3D formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html), [import configuration](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/import_configuration.html), [CLI](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html), [web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), [C# basics](https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/c_sharp_basics.html).

s&box sources: [ModelDoc](https://sbox.game/dev/doc/editor/model-editor), [roadmap](https://sbox.game/roadmap/), [release notes: Linux in 26.09.01; MCP in 26.07.08](https://sbox.game/release-notes), [editor MCP](https://sbox.game/dev/doc/editor/mcp-server), [standalone export](https://sbox.game/dev/doc/exporting/).

## Agent documentation worth retaining

Unity's [current CLI migration guide](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli) explicitly replaces the deprecated MCP server in `com.unity.ai.assistant` with the CLI's MCP server. It also documents direct `unity command` and `unity eval` editor control, local offline operation, headless builds and tests. Driving a running editor requires Unity 6.0 LTS or later and the Pipeline package. The CLI is separate from the paid in-editor assistant. Older blog tutorials describing AI-assistant subscription requirements are therefore not the setup authority for a new pipeline.

The [official Unity agent plugin guide](https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin) supplies maintained engineering skills and links to agent-specific setup. This is a concrete starting point for a Holodeck adapter skill; preserve its version and capabilities rather than assuming a marketplace MCP package is necessary.

Godot's [headless CLI documentation](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) and [post-import customization](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/import_configuration.html) give enough official primitives to design a scriptable import-and-verify adapter. Resolve the actual installed stable version before turning floating `/stable/` links into implementation instructions.

s&box's [MCP documentation](https://sbox.game/dev/doc/editor/mcp-server) describes a localhost editor service with scene/game-object operations and extensible C# tools. This is meaningful first-party agent support, not merely a chatbot. Linux support should be verified on this workstation, but it is no longer reasonable to reject s&box as Windows-only.

## Shared trial contract

This is a proposed engineering test, not a claimed engine feature:

1. Import one Kiln GLB module, one decorated historical display bay and one configurable lane into the same connected hall. Preserve stable authored IDs, meters, coordinate transforms and source hashes in a separate manifest.
2. Drive lane configuration, abstract target state, scoring, display selection and reset from engine-independent events. Compare normalized state traces with the Holodeck browser simulation; do not compare engine entity handles or expect a GLB to contain gameplay.
3. Re-export the source module and confirm generated assets update without overwriting hand-authored gameplay or exhibit metadata. Validate materials, transparency, lights, collisions and bounds visually and by schema.
4. Produce and launch a Linux build. Record import failures, agent-accessible observations, manual interventions and frame/memory captures on the same scene/hardware. Increase lane and display counts only after the behavior slice passes.

Keep GLB as the editable asset exchange, JSON/schema plus fixtures as the behavioral contract, and engine adapters as replaceable implementations. s&box's FBX conversion would be a derived target artifact, never a replacement for the Kiln source. Browser-to-native behavior portability must be built and tested regardless of which engine wins.
