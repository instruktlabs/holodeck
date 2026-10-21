# Airborne flocks

Enable `motion.boids@1` and assign this behavior to an imported asset placement
with `collider: null`. This independent example defines an airborne group:

```json
{
  "type": "flock", "count": 12,
  "bounds": [-8, 8, 3, 8, -8, 8],
  "speed": 2.5, "neighborRadius": 4, "separationRadius": 1,
  "terrainClearance": 1.2, "seed": 42,
  "gait": {
    "stride": 2,
    "channels": [
      {"node": "wing_left", "axis": "x", "amplitude": 0.6, "phase": 0},
      {"node": "wing_right", "axis": "x", "amplitude": -0.6, "phase": 0}
    ]
  }
}
```

Every field except `gait` is required. Gait additionally enables `motion.gait@1`;
it shares the [named-joint contract](articulated-gait.md). Wing geometry must remain
under explicit local pivot groups. Mirrored joints may need opposite amplitudes
or phases; check the actual exported transforms.

Count is an integer from 1 to 48, with at most 96 birds across the scene. Bounds
are `[xmin,xmax,ymin,ymax,zmin,zmax]` in world metres, within ±1000, and each extent
is at least .5 metres. Placement position does not offset this volume. Placement
scale sizes the birds and yaw can correct a model's +X forward orientation.
Bounds constrain roots, so include body and wingspan margins. Speed is .1–12 m/s,
neighbor radius .1–30 m, separation radius .05–10 m and no larger than the
neighbor radius, terrain clearance .1–30 m, and seed an unsigned 32-bit integer.

The shared fixed-step clock advances seeded separation, alignment and cohesion.
Boundary steering, bounded acceleration and terrain clearance constrain flight.
Pause, hiding the origin layer, E stop/start and reset use the normal activity
controls. A terrain edit reseeds the affected flock against the new support.
Impossible flight volumes disable the flock and report `state.diagnostics`.
There is no obstacle avoidance, bird collision, pathfinding, food/predator AI or
rigid-body simulation. Separation is steering, not a guarantee of non-overlap.

Each source mesh becomes one instanced mesh with independent per-bird matrices.
Sources are limited to 32 ordinary single-material mesh primitives; nested GLB
instancing and skinning are unsupported. Source geometry/material resources stay
shared and are not modified by the renderer. Joint targets must resolve uniquely;
advisory binding failures appear under `activity.gaitDiagnostics[placementId]`.
All repeated bird triangles count toward the existing two-million placed-triangle
limit. Instancing saves draw calls, not triangles. Inspect the real scene on WebGPU
and forced WebGL2 before judging visual quality or performance.
