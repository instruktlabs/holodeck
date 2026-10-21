# Author a place, then realize its assets and behavior

Use this guidance when creating a new environment or substantially changing its
layout. Scale the depth to the request; a small placement fix need not become a
new world-planning exercise.

Start with the experience: where the user arrives, what they notice, where they
can go, what they do there, and how they return to the cove. Identify major spaces,
routes, landmarks, thresholds and intentional empty areas before commissioning
individual props. A world may be intimate or expansive; asset quantity does not
establish either spatial depth or gameplay depth.

Choose the world's organizing activity: a connected settlement, a crossing, a
process to observe, a staged event or a room to explore may need different models.
Declare implemented camera/control modes and interaction scope. Moving traffic
does not by itself imply vehicle physics; a tour does not imply a playable actor.

Translate the bible and approved references into relationships:

- Scale references and actor clearance; support surfaces and terrain grades.
- Approach, doorway, bridge and departure envelopes; useful sightlines.
- Near activity, middle-distance landmarks and distant atmosphere.
- Density zones and exclusions: protect paths, framing and interactions.
- Shared sun/sky/fog/material language, with intentional local exceptions.
- Camera and movement profiles that can actually experience those decisions.

Keep these as design intent until corresponding host capabilities implement them.
Do not invent unsupported fields in the current strict scene schema. If terrain,
navigation or physics is needed but unavailable, report that as a capability gap.

Place relationally where possible. A barn may align with a gate and bare pen;
a lift follows the course flank with reachable terminals; a room doorway connects
to a corridor and a standing area. Moving the parent place should preserve its
terrain support, interaction frames, collision and lights. Test the actual actor
through these relationships, including after the cove is hidden.

For modular architecture, define shared connection planes, wall thickness,
corner ownership and top heights before arranging segments. Verify joins in plan
and at player height; intended openings remain distinct from accidental gaps.
Avoid coplanar overlapping skins that shimmer. Keep planting envelopes and roots
inside their intended soil/support areas, with clear separation from circulation.
A water surface needs an actual basin recess and rim relationship, not only a
water-colored top face. Preserve these relationships when modules are moved.

Review atlas materials in motion and on both supported renderer backends. Discrete
atlas identities must not interpolate between fragments; repeating UVs need correct
texture gradients and seamless source boundaries. Inspect broad repetition,
cutout stability and shadow agreement separately. A sharp close-up does not prove
distant foliage stability, and a shader effect does not replace world interaction.

Before editing a relationship, identify dependent products. A bridge can affect
approaches, river crossing and support; plants can affect visual density,
navigation and concealment; furniture can anchor an interaction station. Report
what must be regenerated or rechecked. Preserve temporal states and targets when
an activity changes phase, or when a camera mode changes presentation.

Use Kiln for reusable asset geometry and metadata while preserving an independent
scene layout. Do not make the whole location one inseparable asset merely because
it can be exported that way. Repeated assets can share runtime batches without
losing editable scene identity. Moving parts retain independent behavior ownership.

Review at meaningful views and states: arrival, route approach, player-eye
threshold, close interaction, overview when relevant, and return. Inspect the
assembled lighting and materials. A high camera may hide a doorway failure; a
beautiful still may hide an unreadable route or uncomfortable camera transition.

For simulation-heavy worlds, define what can be active, how often it updates,
which queries it needs and what happens under load. Visibility is not simulation
relevance. Reducing AI or physics frequency can change the world's rules; retain
essential behavior when proposing quality reductions. Budget CPU simulation,
render submission, GPU effects, loading and memory separately.

Count nested expensive operations as well as outer jobs. State whether overload
defers, refuses or simplifies work, and whether one indivisible job can exceed its
slice. Never claim a schema or cooperative timer can preempt arbitrary extension
code. Keep unsupported resource policies as explicit capability requests.

Keep art direction, implemented behavior, measured performance and owner acceptance
as separate findings. A valid pack is a set of building blocks; the assembled scene
and the experience require their own evidence.
