# Inhabiting and referring to the world

The v2 prototype separates using an object from discussing it with an agent.

- **Enter world** closes any open sheet, shrinks the dock to a status line and
  uses the world's configured walk spawn/look. Re-entering keeps the current
  walking position and activity. Without maker possession the controller is the
  fixed-height flat-ground walker; with it, see
  [terrain and inhabitants](terrain-and-inhabitants.md).
- **E** operates the aimed nearby object: open/close a hinge or start/stop a
  mechanism. Holding the key does not repeatedly toggle it. Visible foreground
  geometry occludes the target; the runtime checks reach against its current bounds.
- **Enter** (or Tab) opens the message box without leaving the world and releases
  the mouse. Enter sends the message and returns to walking; **Escape** returns
  to walking without sending.
- **Escape** while walking, or **Return to making**, leaves habitation and
  releases the mouse. **H** hides/restores every remaining HUD element while
  inhabiting; a request waiting for your answer still shows.
- **T** while walking as the maker holds an emote wheel open at the reticle. The
  mouse (captured or not) or the arrow keys highlight a slice; releasing T plays
  it, and releasing at the centre or Escape cancels. A click on a slice also
  plays it. **1–9** play the wheel's slots directly. See
  [emotes](terrain-and-inhabitants.md#emotes).
- Mouse lock is requested from the Enter world action or a click in the world. If
  the browser denies it, the interface reports that and retains right-drag look.
- In authoring, **click or F** selects a whole placed entity. **Shift-click or
  Shift-F** adds/removes a reference. Up to sixteen entities can be attached.
  They show as chips above the message box; the selection card lists what the
  agent receives, and **Arrange in World** opens the placement in the **World**
  sheet. Trees expose Trunk and Canopy scopes. Selecting a scatter instance
  selects its scatter record. Imported GLBs remain whole assets until a semantic
  part binding is supported.

References are attached to the next submitted message. The host resolves their
stable IDs against the accepted world and includes placement, collider, behavior,
shape or asset file, accepted content hash and available provenance. It records
the same context and accepted revision on the user message. The browser cannot
submit arbitrary file paths as selected references. This does not mount new
folders or automatically attach rendered images or GLB bytes to the model.

Deleted objects drop out of the current selection when a revision loads; an
unsupported part scope falls back to the whole entity. Requests containing stale
IDs are rejected before the agent turn starts. Selection is a discussion scope, not an
automatic edit or permission to apply a proposal. The world bible and revision
checks still govern proposed changes.

Clicking the physical mood board opens the **Mood board** sheet. It is currently
a special surface, not an ordinary placed-entity conversation reference. The
built-in maker preset supplies first/third-person possession. General hierarchy
selection and arbitrary skinned-character import are separate proposals; see the
inhabitant preset study.

## Touch

Touch drives the same controller and runtime as the keyboard and mouse, and never
asks for mouse capture. `src/world/touch-input.mjs` turns fingers into the
keyboard's axes:

- **Left thumb.** A finger landing on the left of the scene in walk or free mode
  becomes a floating stick. Its deflection walks or flies at proportional speed,
  and the rim runs. A faint ring shows where it goes.
- **Look.** Any other finger drags to look, alongside the stick.
- **Overlook.** One finger orbits, and two fingers pinch to zoom.
- **Tap.** A short, still tap operates what the reticle aims at while walking. In
  authoring, a tap selects, as a click does.

Buttons for keyboard-only actions appear only when they apply:

| Button | Replaces |
| --- | --- |
| Interact | E, when the reticle finds something |
| Jump | Space, while walking as the inhabitant |
| Emote | T and 1–9: press and drag toward a slice, then lift to play it; or tap to open the wheel and tap a slice |
| Up and Down | E and Q, in the free camera |
| Talk | Enter, which opens the message box while inhabiting |
| Clear view | H; tap Show controls to bring the HUD back |
| Add more | Shift: while it is on, each tap adds a reference instead of replacing them |

On screens narrower than 700 px, each camera cluster folds into one View button
with 44 px choices. On touchscreens, buttons and tabs grow, and fields use 16 px
text so phones do not zoom on focus.

Touch mode follows the last pointer: a touch switches the hints and buttons to
touch, and moving a mouse switches them back.
