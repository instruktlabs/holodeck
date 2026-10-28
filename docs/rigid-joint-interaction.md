# Rigid joint interaction

Enable `interaction.joint@1` to open or close a named child joint inside a static
GLB. This differs from `interaction.hinge@1`, which rotates an entire door
placement and its collider around the vertical axis.

```json
{"type":"joint","node":"Joint_Lid","axis":"x","angle":-1.8,"speed":1.5}
```

`node` is an exact, unique child name, `axis` is a local x/y/z axis, `angle` is
the opening offset in radians (absolute magnitude .1 to PI), and `speed` is
radians per second (greater than zero, at most 4). The renderer composes the
offset with the child's authored rest orientation. The GLB remains static and
contains no embedded clip. Moving parts must stay below the named pivot.

The action toggles open/closed. Reset closes the joint. Runtime state survives
appearance and placement changes with the same object ID and behavior contract;
changing the behavior resets that state. A missing or ambiguous node disables
the action and is reported through articulation diagnostics.

The placement stays fixed. An optional body box collider also stays fixed; the
moving child has no swept collision or force simulation. Keep the body placement
yaw-only, as required by current runtime validation. Do not use this behavior for
a passage-blocking door, moving support surface, or physically simulated lid.
