# Historical inhabitant preset study

This page preserves the original visual and architecture proposal; implementation
status and planned steps below describe that earlier study. The current optional
Maker preset has a rendered body, procedural pose and first/third-person cameras
with walking, jumping and swimming. See [terrain and inhabitants](terrain-and-inhabitants.md)
for the implemented contract. General imported-avatar possession, skinning and
ragdoll support remain unimplemented.

The default inhabitant should give the construct a recognizable presence while
remaining replaceable. It is one optional character preset, not the required body
or camera for every world. Entering a world chooses its declared possession profile;
leaving it returns to the authoring view without changing that world's saved layout.

## Visual direction

Working concept: a quiet maker formed from kiln-fired clay, dark timber and linen.
Use adult proportions, a readable silhouette, gently uneven ceramic surfaces and
visible articulated joints. Warm ivory and terracotta body pieces carry the cove's
material language. A small amber inset in the chest recalls the kiln core. A simple
recessed face and a moss cloth tie give identity at normal playing distance. The
shape should work when standing, reaching, sitting and falling, with enough joint
clearance for those poses.

The first mockup should show a full-body figure, the same figure in the cove, an
over-the-shoulder world view and first-person hands. These are visual studies, not
screenshots or proof of runtime behavior. Do not commit to a rig before the design
reads at the actual camera distances.

## A preset is more than a GLB

Keep the authored character separate from the runtime capabilities that inhabit it:

| Record | Responsibility |
| --- | --- |
| Appearance | Pinned Kiln revision or imported GLB, materials, part identities and LODs |
| Body definition | Units, proportions, rest pose, joint frames, sockets and contact landmarks |
| Rig binding | How semantic body roles map to rigid parts or a skin skeleton |
| Controller profile | Movement, collision shape, supported surfaces and input actions |
| Camera profile | First-person eye anchor or third-person follow settings and occlusion handling |
| Optional physics profile | Rigid bodies, joint constraints and controlled-to-ragdoll handoff |

Derive representations from shared body data where possible. A visual joint and a
physics joint need explicit coordinate frames and must agree after scaling. State
which adapter owns each transform: animation, procedural posing or physics. Camera
possession must remain stable when those ownership modes change.

Rigid authored modules are a useful first preset: torso, pelvis, head, paired arm
and leg segments, hands and feet. The import path should also allow a skinned GLB.
Neither path makes a generic model automatically humanoid, animatable or safe to
ragdoll. Report the supported capabilities, missing mappings and fallback behavior
before allowing possession. A static model can still be a placed asset.

An inhabitant is selected as one asset by default. Its semantic parts remain
available for intentional drill-down. Those identities should survive batching,
LOD changes and asset revision adoption so an agent can discuss a wrist, a material
or the whole character without depending on a render draw number.

## Small proof after visual alignment

1. Author the approved original body in a separate Kiln workspace with named parts
   and shared joint landmarks. Review it standing, seated and with bent limbs.
2. Load one pinned revision and connect a first-person/third-person camera pair to
   the same movement state. Test door clearance, camera collision and mode changes.
3. Add a bounded optional ragdoll adapter. Demonstrate pose and velocity handoff,
   a fall, a settled state and an explicit reset. Do not use ragdoll as the walking
   collision model.
4. Import an independently authored second GLB through the same declared adapter
   interface. This proves the preset is replaceable rather than a hard-coded hero.
5. Return advisory observations for joint alignment, scale, contact, camera
   obstruction, missing capabilities and observed runtime cost. Keep visual
   judgment and measured performance distinct from schema validity.

At the time of this study the box walker was the prototype controller. It remains
the controller for worlds without maker possession.
