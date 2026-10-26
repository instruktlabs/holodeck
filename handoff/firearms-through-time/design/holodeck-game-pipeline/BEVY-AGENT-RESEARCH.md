# Bevy as a Holodeck destination — research, 25 October 2026

**Recommendation: keep Bevy as the leading pipeline experiment, and Unreal as a serious competing game-production destination. Do not freeze the engine decision yet.** Bevy fits a programmable Holodeck unusually well; Unreal has a stronger case when the principal deliverable is a visually polished first-person environment with sophisticated animation. These are architectural judgments, not measured results.

## Verified version and evidence

The official [release list](https://github.com/bevyengine/bevy/releases) identifies **v0.20.0** as latest; [release notes](https://bevy.org/news/bevy-0-20/) date it to 8 October 2026. The local context manifest pins `b3bdd75becaffe9a16677cf5bae5bd6d198f052b` and records files as downloaded, not executed. No engine was installed or built for this research.

Search results for `bevy_remote/latest` still exposed 0.19.1, and the web tool could not retrieve the explicit 0.20.0 API page. This is a practical agent-context hazard: use the release-tagged source and examples, not search snippets or an unverified “latest” API. Pin Bevy, Cargo.lock, Rust toolchain and compatible third-party plugins together. Do not assume a physics/editor plugin supports 0.20 merely because Bevy does.

## What actually transfers

Use Kiln for editable geometry; export a GLB plus a separate versioned world/game manifest. Preserve stable authored IDs, part pivots, attachment anchors, units, bounds, asset hashes and semantic roles. The [0.20 glTF loader](https://github.com/bevyengine/bevy/blob/v0.20.0/crates/bevy_gltf/src/lib.rs) and [extras example](https://github.com/bevyengine/bevy/blob/v0.20.0/examples/gltf/load_gltf_extras.rs) provide an import path. Extras expose metadata; they do not automatically create gameplay systems. The tagged example uses `WorldAssetRoot` and `GltfAssetLabel::Scene(0)`; older snippets may use different APIs.

Keep the proposed authoritative core independent of Bevy, Three.js and browser objects. A small Rust crate compiled natively and to WASM can own seeded target motion, session configuration, score events, pause/reset and progression. The maintained [wasm-bindgen guide](https://wasm-bindgen.github.io/wasm-bindgen/) documents Rust/JavaScript interoperation and TypeScript bindings. Holodeck can retain its browser renderer while calling that core. There is no need to embed a second Bevy renderer simply to share rules.

Adapters still own input, scene import, rendering, audio and collision queries. A shared language does not establish deterministic floating-point behavior, equal collision results or equal timing. Use tick-indexed commands, explicit query results, stable IDs, event ordering and numerical tolerances. For Unreal, either implement a deliberate Rust/native bridge or reimplement the modest rules layer against the same fixtures; GLB does not convert browser code into Blueprints/C++.

## Agent tooling and examples

The official [remote server](https://github.com/bevyengine/bevy/blob/v0.20.0/examples/remote/server.rs) enables `RemotePlugin` plus `RemoteHttpPlugin`; its reflected resource and component show inspectable runtime state. The [integration test](https://github.com/bevyengine/bevy/blob/v0.20.0/examples/remote/integration_test.rs) queries UI entities, injects a mouse event and captures a screenshot. This is useful evidence that agents can observe and exercise a running native application. It is not an existing Holodeck MCP adapter. Add a small game-level command/observation interface rather than coupling tests to arbitrary ECS edits.

The integration test requires the separate `app_under_test` example, `bevy_remote` and `bevy_feathers`; the local excerpts do not include all those dependencies/assets. The animation example also imports `examples/helpers/number_input_f32.rs`, absent from the local excerpt pack. Run examples from a complete matching checkout when implementation begins. Screenshot capture requires a visible, rendered window according to the example.

Useful pinned starting points: [fixed timestep](https://github.com/bevyengine/bevy/blob/v0.20.0/examples/movement/physics_in_fixed_timestep.rs), [first-person view model](https://github.com/bevyengine/bevy/blob/v0.20.0/examples/camera/first_person_view_model.rs), and [animation graph](https://github.com/bevyengine/bevy/blob/v0.20.0/examples/animation/animation_graph.rs). These demonstrate individual techniques, not a complete controller, shooter or asset-production pipeline.

## Art, animation and a large hall

Bevy's animation graph example demonstrates blending clips. It does not establish an end-to-end rigging, retargeting, hand IK or first-person animation workflow. Test one actual production rig before selecting it for animation-heavy work. Unreal's [Control Rig](https://dev.epicgames.com/documentation/en-us/unreal-engine/control-rig-in-unreal-engine) includes in-editor rigging, animation, full-body IK and Python workflow hooks; that is a substantive production advantage.

A massive configurable range/gallery needs modular bay assets, repeated-mesh reuse, sensible light/shadow budgets, zone activation and collision proxies whichever engine wins. Bevy 0.20 improves rendering and editor foundations, but its [introduction](https://bevy.org/learn/quick-start/introduction/) explicitly warns of missing features and breaking releases. Do not mistake its Solari rendering showcase for a turnkey production editor or a browser-compatible quality preset. Unreal supplies [World Partition](https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine), including cell streaming and HLOD integration; whether this single hall actually needs it should follow profiling. Unreal also [imports GLB](https://dev.epicgames.com/documentation/en-us/unreal-engine/gltf-file-format-support-in-unreal-engine); asset portability is not exclusive to Bevy.

## Concrete engine decision trial

Build the same small slice in Holodeck and native Bevy: one historical exhibit wall bay, one configurable practice bay, an animated target, a visitor route and a working selection interface. Reuse the same GLB/manifest and core. Prove scale/orientation/pivots, stable identity after re-export, exactly-once score events, pause/reset and repeatable input replay. Add one real rig if articulated hands are required.

Then repeat that representative environment/interaction slice in Unreal, preserving the contract. Record agent edit-to-visible-result time, manual repair count, import/re-import correctness, packaged startup, frame-time percentiles, memory, lighting fidelity and animation effort on named hardware. Expand repeated bays to the proposed whole-hall count only after the slice works. Choose Bevy if programmable integration and maintainability win; choose Unreal if production tooling materially reduces the work needed for the intended game. Neither speed nor visual superiority has been measured here.
