Current implementation: the first pistol uses a dedicated first-person hand rig. The v6 update refines wrist/cuff shape while preserving v5 forearm twist and finger contact; see [current wrist qualification](wrist-refinement-v6.md) and [v5 qualification](weapon-contact-twist-v5.md). Full-body weapon integration and production art remain later work.

# Character and weapon production direction

Recorded 2026-10-26. This separates the current range prototype from planned game systems.

## Character decision

Use Holodeck's built-in **Maker** for the current walkthrough, scale, reach and collision checks. Maker already has bones, a skeleton and skinned meshes, driven by procedural gait/emotes. The custom weapon arms are a separate camera-relative first-person viewmodel with their own clips and IK. They do not replace or drive Maker's arms. The native fixture uses a simple first-person capsule pawn.

The first firearm should ship with **rigged first-person arms and hands**, neutral clothing/gloves, hand contact targets and a small animation set. Prove inspection, equip, aim, fire, reload and return/reset as one game loop before expanding the catalog. Animation events request gameplay actions; the authoritative weapon state validates them. State must not depend on a clip's frame count or a visual mesh name.

A coherent character is the next character milestone: match arm proportions and clothing to Maker, then define a character adapter for grip targets, handedness, animation state, first-person visibility and third-person posing. Use one source character definition with explicit view profiles; detailed first-person hands and a cheaper full-body presentation can share identity without duplicating visible arms. This adapter is not implemented. Holodeck's ordinary world asset admission path remains static/rigid; its built-in Maker and this optional custom extension separately demonstrate skeletal rendering. General imported character support still needs its own admission and animation contracts. Do not flatten the master rig merely to fit the static importer.

The handoff's **Sentinel** is an existing static rigid-joint prototype (about 1.896 m, 9,884 triangles, 80 primitives, seven materials), not a skinned/animated production character. Its historical Kiln IDs are references, not proof of installation in this workspace. Reuse design ideas or measured proportions only after inspecting the actual revision. Do not describe it as already rigged.

See [all-era firearm collection production](firearm-collection-production.md) for the required reference dossier, model-family compatibility and asset qualification gates.

## Weapon and attachment boundary

Start with one researched representative firearm. Preserve reference sources, provenance, dimensions and identity before modeling. Era is catalog metadata, not a compatibility rule. Model platform/family, revision/configuration and explicit allowed attachments independently. An earlier weapon need not expose modern attachment interfaces; shared parts within an era are allowed only when supported by the specific design.

Keep four layers separate:

- Asset geometry, material roles, LODs and export profiles.
- Assembly/configuration: stable component IDs, named visual attachment anchors, compatibility and exclusion rules.
- Game state: equip, selection, readiness, ammunition abstractions, reload transitions, firing events and target results.
- Presentation: hands, skeletal/rigid animation, sounds, camera response and effects driven by state.

Use named visual anchors for the right/left hands, sight line, muzzle effects, magazine interaction and accessory mounting. Record their coordinate frames and revision compatibility. These are game asset contracts, not real-world manufacturing specifications. Attachment changes must preserve weapon identity and state, update visuals and grip targets, and reject incompatible configurations. Save/load should store IDs and configuration, not scene hierarchy paths.

First end-to-end proof: one base weapon, one permitted attachment swap where historically appropriate, one invalid combination rejected, stable animation/hand contact, native material override preserved through source update, and the same serialized configuration understood by both adapters. The full simulation and ballistics model remain a separate design/validation task; the current turning target has no shooting or scoring.

## Visual quality gates

AAA is a target, not the current prototype status. Require recognizable proportions, believable construction/contact, controlled bevels, consistent texel density, directional wood/metal detail, clean normals, intentional roughness variation and close/medium/far inspection. Qualify first-person hands and reload contact in motion. Add bake, LOD, Nanite or other techniques only where measured geometry, deformation and performance support them. Small prototype meshes do not establish a final hero-asset budget.

## Optional Kiln extension split

Common: provenance, recipes, material manifests, units/axes, named anchors, assembly schemas and revision compatibility checks. Unreal adapter: import/reimport, skeleton and material mapping, build/cook/capture and native overrides. Holodeck adapter: supported capabilities, proposal/apply, rigid joints and runtime observations. Game-specific firearm rules stay in this project, not in Kiln's engine-agnostic default surface.

Reference foundation: [Epic first-person rendering](https://dev.epicgames.com/documentation/en-us/unreal-engine/first-person-rendering), [character implementation](https://dev.epicgames.com/documentation/unreal-engine/implementing-your-character-in-unreal-engine?lang=en-US), [IK Rig retargeting](https://dev.epicgames.com/documentation/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine?lang=en-US). These are implementation references, not claims that those systems have been integrated here.


