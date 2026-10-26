# Engine decision — proposed, not selected

25 October 2026. Official documentation checked during this review. Recommendations are engineering judgments, not comparative benchmarks.

## Recommendation

Updated after user-supplied Hyperreal research: evaluate **Unreal** first for this game’s production runtime; keep **Bevy** as the alternative for a more controlled, modular runtime. No engine is selected. See [Unreal/Hyperreal findings](../holodeck-game-pipeline/UNREAL-AGENT-RESEARCH.md). These optimize different goals; the engine decision should be made on a playable slice, not a static beauty shot.

Keep the existing Three.js authoring viewport. Export a portable world/game manifest to one native runtime. Do not implement all gameplay twice or attempt five engine adapters at once. A native exported game will launch separately; embedding it into Holodeck's browser viewport would require additional hosting/streaming integration.

| Candidate | Fit for this project | Principal tradeoff | Position |
|---|---|---|---|
| Bevy | Rust, data-oriented ECS, modular systems, glTF loading and skeletal animation suit generated worlds and inspectable game state. | More responsibility for production tooling, animation integration and polish; upstream warns about breaking releases and missing features. | Alternative runtime experiment. |
| Unreal | Lumen and dedicated IK tooling fit the quarry lighting, detailed displays and first-person presentation. | More complex automation/import pipeline and engine-specific assets; mature tools still require content and tuning. | First production-runtime evaluation. |
| Unity | General-purpose C# workflow, platform options and Animation Rigging offer a practical middle ground. | Still requires a Holodeck importer, game architecture and asset pipeline; not an automatic portability solution. | Good choice if C# and broad deployment dominate. |
| s&box | Facepunch's C#/Source 2 game platform offers hotload, an editor and built-in multiplayer. | Standalone distribution is documented as preview with Valve approval and a Facepunch license; validate the intended shipping route. | Strong social/multiplayer experiment, less attractive as default independent runtime. |
| Existing Three.js runtime | Keeps immediate browser access and today's Holodeck integration. | The team owns more game systems and tooling as scope grows. | Retain for authoring/prototyping; browser delivery can still justify it. |

Facepunch's product is **s&box**, distinct from the separate product called The Sandbox. Its current site lists Windows and Linux support; do not evaluate it using outdated Windows-only assumptions.

## Engine trial

Use one booth, a gallery section, three contrasting exhibit configurations and one scored target activity. Keep the same source assets, manifest, cameras and challenge rules. First prove the browser simulation, then import, equivalent native gameplay, reset and a packaged launch. Then inspect animation quality, edit/rebuild time, memory after repeated switching and measured frame times on this machine.

Bevy passes the trial if the complete loop, reliable asset lifecycle, acceptable hand/sight alignment and a reproducible native package work without excessive custom tools. Record effort and concrete missing capabilities; no arbitrary promise of parity with Unreal. If presentation/tooling work dominates, switch the runtime trial to Unreal before expanding the catalog.

Browser play is a major decision boundary. A desktop runtime does not replace a browser preview in place. If shareable browser delivery is mandatory, evaluate that requirement before choosing Unreal or s&box, and test actual browser builds for any proposed alternative.

A Rust simulation core can be reused natively or through WASM, but is optional and separate from rendering-engine selection. Rust does not itself make behavior accurate, deterministic or fast. Validate the declared game model and profile actual integration costs.

## Sources

- [Bevy features](https://bevy.org/) — ECS, glTF, animation and supported platform claims.
- [Bevy introduction and stability warning](https://bevy.org/learn/quick-start/introduction/) — modular Rust engine and breaking-change/maturity caveats.
- [Unreal Lumen](https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine) — dynamic lighting/reflections.
- [Unreal IK Rig](https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-rig-in-unreal-engine) — character goals, solvers and retargeting tools.
- [Unity platform development](https://docs.unity3d.com/Manual/PlatformSpecific.html) and [Animation Rigging](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.4/manual/index.html).
- [s&box overview](https://sbox.game/about) — C#, editor, hotload, multiplayer and OS listing.
- [s&box documentation](https://sbox.game/dev/doc/) — Source 2 and standalone distribution preview/approval conditions.

Sources describe capabilities, not results measured in Holodeck. Licensing and export conditions should be rechecked for the eventual release; no financial comparison is claimed here.


Current alternatives research also identifies first-party Unity agent tooling and s&box MCP. See [alternative engines](../holodeck-game-pipeline/ALTERNATIVE-ENGINES-RESEARCH.md). Unity merits a finalist trial if editor automation is decisive. No recommendation establishes measured superiority.
