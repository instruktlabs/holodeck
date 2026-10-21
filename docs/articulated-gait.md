# Articulated patrol assets

`motion.gait@1` adds bounded visual joint rotations to a patrol or flock
placement. It preserves the accepted GLB geometry and its authored rest pose.
This is a procedural rigid-part gait, not skeletal skinning, foot IK or physics.

Deliver a static GLB containing the named joint hierarchy in its authored rest
pose. The current importer rejects embedded animation clips. Animated Kiln QA
studies can remain separate review derivatives; Holodeck's gait behavior drives
the delivered rest-pose joints. Check the exported runtime artifact itself, since
a successful animated review does not establish that this importer accepts it.

Add `gait` inside the existing patrol behavior and enable both modules:

```json
{
  "stride": 0.8,
  "channels": [
    {"node": "hip_left", "axis": "z", "amplitude": 0.35, "phase": 0},
    {"node": "hip_right", "axis": "z", "amplitude": 0.35, "phase": 3.141592653589793},
    {"node": "shoulder_left", "axis": "z", "amplitude": 0.18, "phase": 3.141592653589793},
    {"node": "shoulder_right", "axis": "z", "amplitude": 0.18, "phase": 0}
  ]
}
```

Every shown field is required. Stride is .05 to 10 metres along the asset's local
+X forward axis before placement scale. Channels number 1 to 32. Node names must
match `[-A-Za-z0-9_]{1,64}` and resolve to exactly one child node in the loaded GLB.
The asset root cannot animate. Axes are local `x`, `y` or `z`, amplitude is within
±1.2 radians, and phase is within ±2π radians. Each node/axis pair appears once;
multiple axes compose in channel order. Only imported default/`kiln` assets are
supported, because cove batching removes the required joint hierarchy.

Author a separate named group at each joint origin, with that limb's geometry and
any lower joints beneath it. The transform hierarchy must survive export. Do not
merge moving limbs into one material batch. Check node names and pivots in the
exported GLB, not just the source program. Use a bent authored rest pose where
needed so the bounded offsets do not hyperextend knees or elbows. The example
names are illustrative and do not cause anatomy inference.

Each channel offsets its authored local rotation by
`amplitude * sin(2π * distance / (stride * placement.scale.x) + phase)`.
Distance is measured patrol travel, so obstruction does not keep a walk cycle
running in place. A short blend settles joints when waiting, blocked or stopped.
Global activity pause and hidden origin freeze the pose. Reset returns to rest.
Patrol display position, heading and gait distance interpolate between fixed
simulation ticks; collision and observations keep the authoritative tick state.

If any target is missing, ambiguous or the root, the entire gait is disabled.
`world_observe` reports those advisory messages under
`activity.gaitDiagnostics[placementId]`. No diagnostic means the binding resolved;
it does not certify plausible anatomy or motion. Inspect the actual rendered gait,
including stopping, turning, foot placement, terrain and both renderer backends.
Gait does not move the placement root or deform its collider.

Flocks use the same record for wing joints, with deterministic per-bird phase
offsets and travel distance. They require `motion.boids@1` rather than the patrol
module. Global pause and stop freeze flight and wing phase. See
[flock behavior](flock-behavior.md) for bounds and source-mesh limits.
