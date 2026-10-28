# From a Unity preview to a playable slice

Keep rule tests, destination geometry, actual control paths and rendered play
as separate checks. A small engine-independent simulation can test win, loss,
restart and resource rules without starting an Editor. Compiling against cached
references is only a preflight: it runs no Unity serializer, importer, analyzer,
physics or input device.

## Serialization

Some Unity versions' `JsonUtility` produces an empty nested object from an
explicit JSON null. For absent collision, write a tagged `type: none` record in
the delivery bundle while Holodeck keeps its own null. Reject missing or unknown
collider tags instead of treating them as non-blocking geometry. Check
deserialization with an actual Editor import before multiplying the bundle.

## Input

Match the active input backend to the APIs the runtime calls. Code using the
Input System's `Keyboard.current` and `Mouse.current` does nothing in a project
that enables only legacy input, and pure model tests or direct method calls do
not expose it. Device presence is a prerequisite, not proof of real keyboard
and mouse events or comfortable controls.

## Smoke

A meaningful smoke drives the real controller along the arrival route, its
stairs and the return, then exercises the slice's main interaction against a
visible target and checks its results. Scripted autoplay can show that an
encounter is winnable, but label it as autoplay. Test an unattended loss and a
fresh restart too.

Reachability comes first. Before refining stairs, confirm from the walkable
collider tops that every station connects to the spawn, as in
`holodeck-author-world`. Use actual controller movement and body sweeps in both
directions; downward support rays cannot expose a blocked entrance.

When a manual mode and an automatic one share a resource such as a cooldown,
let the player's action take ownership, and keep the HUD consistent with the
controller that actually owns it.
