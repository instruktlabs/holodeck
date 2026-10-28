# Portable game contract — proposed architecture

These are design requirements for a future adapter, not fields supported by current Holodeck schemas. Inspect the actual host before choosing names or implementing migrations.

## Source and ownership

| Layer | Owns | Must not become |
|---|---|---|
| Kiln source | Editable geometry, materials, part hierarchy, pivots, anchors and revision provenance | The authoritative game simulation |
| World document | Composition, stable object IDs, asset references, terrain, routes and reference/bible intent | A serialization of Three.js or Bevy internal objects |
| Game definition | Rules version, components, state transitions, queries, input actions, clocks and reset behavior | Arbitrary code strings executed from an untrusted pack |
| Behavior core | Authoritative tick/state/event transitions | A renderer, UI tree or asset loader |
| Runtime adapter | Input normalization, collision/query bridge, presentation, audio, loading and diagnostics | A second untracked rules implementation |
| Evidence | Build IDs, inputs, state/events, images, performance setup and results | An inferred pass based on concept art |

Use a versioned manifest with units, axes/handedness, world and rules revisions, hashes, source IDs, destination profile and required/optional capabilities. Asset records map to parts/anchors and optional native derivatives. Game records describe initialized components, state ownership, command vocabulary and declared queries. Fail missing required capabilities; expose optional fallbacks and their effect.

## Behavior interface

A useful conceptual boundary is initialize(definition, seed), step(tick, commands, query_results), observe(), reset(seed), and optionally snapshot/restore. These are proposed operations, not existing tools. Queries need tick IDs, coordinate frames, stable object IDs, ordering and error behavior. Responses cannot arrive silently one tick late.

Specify fixed tick duration, maximum catch-up, overload behavior, pause semantics and render interpolation separately. Order systems and commands deterministically where required. Edge inputs need unique sequence IDs so one click is not consumed twice during catch-up. UI focus loss clears held input. Camera presentation may update per frame while simulation uses the normalized aim/input sampled for the tick.

A shared Rust core compiled for WASM and native can reduce semantic drift. It must not depend on Bevy components or browser objects. Complex collision/physics can remain adapter-owned, but then its differences need explicit tolerances and fixtures. Do not claim bitwise determinism from a shared language or fixed clock.

## Re-export and identity

Keep source ID → runtime entity mappings. Validate units, handedness, winding, transforms, normals, bounds and anchor/collider alignment with an asymmetric fixture. Use separate browser/native deliveries if material, compression, rigging or LOD support differs. Preserve original assets and record conversion settings and hashes.

Start with one-way regeneration plus destination-specific overlays. Generated files have an ownership boundary; authored gameplay plugins live elsewhere. Define whether active state survives a compatible scene update or resets. Invalid updates leave the last usable revision intact. Round-trip edits require a conflict model and are not implicit.

## Behavioral equivalence fixtures

Use neutral examples before coupling the pipeline to a large game:

1. A rotating exhibit with start/stop/reset: part identity, pivots, input actions and timer state.
2. A moving target and score counter: seeded motion, one score event per activation, pause and repeatable reset.
3. A gate and walking route: transforms, collider agreement and obstruction behavior.
4. Asset switch during activity: canceled work, stale-event rejection and resource cleanup.

Each fixture records definition hash, seed, ordered tick-indexed commands, relevant query results, expected state/events and tolerances. Compare discrete transitions exactly. Set numerical tolerances from the model and task before running comparisons; do not widen them to hide a defect. Distinguish core-only replay from live runtime integration: replaying canned collision results does not validate destination physics.

Also inspect motion/materials and traversal in both destinations. Behavioral parity does not imply visual parity. Record native and browser graphics settings independently; an engine name alone does not demonstrate a speedup.

## Delivery progression

Explore references → choose visual intent → establish provisional bible/rules → Kiln assets and Holodeck spatial blockout → browser playable slice → native equivalent slice → compare/revise → expand content → profile/package.

An early native import test can run during browser prototyping to expose incompatibilities, but the browser is a real simulation prototype, not merely a screenshot stage. Avoid building a full engine abstraction before one end-to-end slice works.
