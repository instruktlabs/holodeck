# Inhabiting and referring to the world

The v2 prototype separates using an object from discussing it with an agent.

- **Enter world** hides the authoring workspace and uses the world's configured
  walk spawn/look. Re-entering keeps the current walking position and activity.
  The implemented controller is still the fixed-height flat-ground walker.
- **E** operates the aimed nearby object: open/close a hinge or start/stop a
  mechanism. Holding the key does not repeatedly toggle it. Visible foreground
  geometry occludes the target; the runtime checks reach against its current bounds.
- **Escape** leaves habitation and releases the mouse. **Enter** returns to the
  composer. **H** hides/restores every remaining HUD element while inhabiting.
- Mouse lock is requested from the Enter action or a click in the world. If the
  browser denies it, the interface reports that and retains right-drag look.
- In authoring, **click or F** selects a whole placed entity. **Shift-click or
  Shift-F** adds/removes a reference. Up to sixteen entities can be attached.
  Trees expose Trunk and Canopy scopes in the reference panel. Imported GLBs
  remain whole assets until a semantic part binding is supported.

References are attached to the next submitted message. The host resolves their
stable IDs against the accepted world and includes placement, collider, behavior,
shape or asset file, accepted content hash and available provenance. It records
the same context and accepted revision on the user message. The browser cannot
submit arbitrary file paths as selected references. This does not mount new
folders or automatically attach rendered images or GLB bytes to the model.

Deleted objects drop out of the current selection when a revision loads; an
unsupported part scope falls back to the whole entity. Requests containing stale
IDs are rejected before starting Codex. Selection is a discussion scope, not an
automatic edit or permission to apply a proposal. The world bible and revision
checks still govern proposed changes.

The physical mood board opens its reference editor. It is currently a special
surface, not an ordinary placed-entity conversation reference. General hierarchy
selection, arbitrary skinned-character import and first/third-person possession
are separate proposals; see the inhabitant preset study.
