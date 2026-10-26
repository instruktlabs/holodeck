# Bevy agent context

Checked 25 October 2026: official release/latest resolves to **v0.20.0**, also listed by the Bevy news page. This is a dated observation, not a perpetual latest-version assertion. Recheck before starting a new project; preserve an existing project's pin unless an upgrade is in scope.

## Documentation strategy

Use the [official learning entrypoint](https://bevy.org/learn/), [versioned 0.20.0 API](https://docs.rs/bevy/0.20.0/bevy/), [release](https://github.com/bevyengine/bevy/releases/tag/v0.20.0), and [migration guides](https://bevy.org/learn/migration-guides/introduction/). Pin the exact dependency and lockfile for reproducibility. Select matching examples from the release tag rather than mixing main-branch code and an older crate. Check the release's Cargo.toml for toolchain requirements and features before installing or compiling.

The [official example browser](https://bevy.org/examples/) provides running browser examples and source links. It is useful for exploration; tagged source is the implementation reference. Community tutorials are secondary and should declare the version they cover. Do not dump whole manuals into the skill; fetch task-relevant API pages and source as needed.

## Starter examples

All source paths below are under [Bevy v0.20.0](https://github.com/bevyengine/bevy/tree/v0.20.0). Read only the examples needed for the current slice. Dependencies and referenced assets may require the complete tagged repository; individual files are not standalone projects.

| Source path | Application to the pipeline |
|---|---|
| examples/3d/3d_scene.rs | Small renderer/camera/light baseline. |
| examples/gltf/load_gltf_extras.rs | Inspect imported scene metadata; map explicit IDs rather than infer game rules from mesh names. |
| examples/movement/physics_in_fixed_timestep.rs | Separate authoritative updates, accumulated input and interpolated presentation. |
| examples/camera/first_person_view_model.rs | Explore separate first-person/world presentation; does not supply complete character control or IK. |
| examples/animation/animation_graph.rs | Investigate native animation composition and destination rig requirements. |
| examples/state/states.rs | Menu/play state organization and transitions. |
| examples/remote/server.rs | Investigate development-time observation through Bevy Remote Protocol. |
| examples/remote/integration_test.rs | Study automated interaction/testing; inspect required companion programs. |

Example source carries upstream MIT/Apache licensing. Preserve notices when copying. Downloaded examples are not compiled or tested until actually run against the pinned source/toolchain.

## Agent-facing integration

Bevy Remote Protocol is a candidate for inspectable native state, alongside explicit game-level commands and observations. Read the tagged server/test examples before choosing an API. Do not assume an existing Holodeck MCP bridge or exporter. Scope development control to local trusted processes; do not expose a mutating development endpoint publicly by default.

For a native target, start with import + stable identity + one observable behavior. For browser simulation, either integrate the independent core into existing Holodeck presentation or separately investigate Bevy/WASM; embedding another renderer is a larger architectural choice. Neither route automatically translates Three.js components into Bevy systems.

Bevy's [own introduction](https://bevy.org/learn/quick-start/introduction/) warns about breaking releases and incomplete features. Evaluate actual animation, tools, package size and iteration costs. Consider Unreal or Unity when project requirements justify their production tools; retain the portable contract and revalidate with their versioned primary docs.
