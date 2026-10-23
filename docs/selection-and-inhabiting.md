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
