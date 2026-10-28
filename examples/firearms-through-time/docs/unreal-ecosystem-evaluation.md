# Unreal ecosystem integration evaluation

Checked 2026-10-26 against official documentation. These are proposed optional
integrations, not claims that every integration is installed or qualified.

## Recommended direction

Kiln owns portable editable assets, source/revision identity, geometry contracts,
surface intent and delivery manifests. A project-enabled Unreal adapter owns
native material bindings, import profiles, scene placement and engine execution.
Holodeck consumes portable deliveries with its own renderer and runtime behavior.
Keep native shader graphs and third-party plugin dependencies out of the generic
asset contract. Preserve explicit fallbacks for portable previews.

| Capability | Fit with Kiln | Next qualification |
|---|---|---|
| Quixel Megascans through Fab | Reuse scanned surfaces, decals and props rather than rebuilding all source art | Import one entitled surface; record listing, acquired license, map hashes, scale, color spaces and normal convention; compare portable PBR with a native material instance |
| Fab Unreal integration | Bring an owner's existing library into an Unreal project | Test an asset already in the account; preserve local dependency paths and project ownership; no bulk library download |
| Epic Unreal MCP / Toolset Registry / EditorToolset | Editor operations, material tooling, screenshots, PIE and automation | Already enabled and tool discovery responds in this isolated project. Serialize game-thread calls; qualify operations individually rather than inferring coverage from tool count |
| PCG | Turn Kiln modules and existing assets into seeded arrangements, buildings or environments | A small seeded scene, stable asset references, regenerate without duplicate actors or touching authored overrides |
| Geometry Scripting | Native mesh analysis and engine-side processing | Compare source/imported bounds, collision and generated derivatives; do not replace immutable source with a processed native mesh |
| MaterialX / Interchange | Candidate for richer material interchange | One supported material round trip plus baked PBR fallback. UE support does not establish Holodeck support or full shader equivalence |
| Substrate | Rich native layered materials | Optional Unreal enhancement behind a portable surface binding; measure cost and document fallback instead of promising browser parity |
| Third-party agent plugins | Potential gaps in official tool coverage | Inventory missing operations first, then test a specific plugin's version, license, bounded execution, readback and uninstall path in a scratch project |

The first useful feature is a material-binding table: stable source surface ID ->
native material instance plus user overrides, with immutable imported defaults.
Reimport should update generated defaults, preserve the binding and explicit user
values, and emit a diff. A separate scene adapter can resolve the same asset IDs
into Unreal actors or Holodeck objects without making scene state engine-specific.

## Content and publication boundary

Fab is a marketplace; Quixel Megascans is the scanned asset/material library.
Do not assume all Megascans are free or that older Bridge entitlements have the
same terms as a new Fab acquisition. Fab's Standard License summary permits use
in compatible tools and incorporated projects, and prohibits standalone asset
redistribution. Check the actual acquisition and license for each item. Public
Kiln examples should use our own/redistributable assets; private entitled content
can remain referenced in the owner's project. Native-only material features need
a declared portable fallback before sending a scene to Holodeck.

## Sources

- [Epic: Unreal MCP](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)
- [Fab overview and integrations](https://www.fab.com/o/about)
- [Quixel library and licensing information](https://quixel.com/ai-info)
- [Fab Standard License summary](https://www.fab.com/eula?lang=en)
- [Epic: PCG overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview)
- [Epic: Geometry Scripting](https://dev.epicgames.com/documentation/unreal-engine/introduction-to-geometry-scripting-in-unreal-engine)
- [Epic: MaterialX support](https://dev.epicgames.com/documentation/unreal-engine/materialx-support-in-unreal-engine?lang=en-US)
- [Epic: Substrate](https://dev.epicgames.com/documentation/unreal-engine/substrate-materials-in-unreal-engine)
