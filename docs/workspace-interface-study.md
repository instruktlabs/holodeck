# Workspace interface study

Status: proposed layout, evaluated in a separate clickable study. The working
runtime received containment and input fixes; the full visual design is not adopted.

Two independent agent reviews were run without the intended design explanation:
one first-look review of captured screens, one browser task walkthrough. A third
agent proposed information architecture without reading implementation or reviews.
These are synthetic heuristic evaluations, not human usability research.

A fresh reviewer then walked the separate study without source or review context.
They verified whole/part selection, two retained references, conversation collapse
and enter/return. Two misleading labels were corrected: an attached tree is no
longer offered as missing, and the notes edit button names its actual scope.
Desktop and 873-pixel layouts were inspected, including scrolled close controls.
These observations do not establish broader user acceptance or mobile coverage.

The reviewers identified competing starting actions, unnamed controls at narrow
widths, overlapping branding, an unbounded selection panel, and recovery controls
that were hidden or scrolled away. Click/Shift-click reference accumulation and
the explicit Enter world action were understandable. The mood board label was
clearer than production terminology such as module, collider, or Bible.

## Proposed component boundaries

| Component | Owns |
| --- | --- |
| World viewport | Rendering, spatial picking, possession and world interaction |
| Workspace shell | Author/inhabit mode, layout zones and focus return |
| Workbench | One active scene, rules, references, conversation or review panel |
| Selection inspector | Whole-asset identity and deliberate semantic part scope |
| Reference tray | Persistent references for the current conversation draft |
| Agent composer | Text/voice input and visible context attached to submission |
| Inhabit HUD | Named interaction prompt, mouse-lock fallback, recovery and hide toggle |

Panel visibility does not own selection, draft text, running simulation or the
world document. Collapsing a panel preserves those states. Opening the mood board
replaces the focused panel; it does not spawn another competing drawer. Proposals
remain explicit review/apply operations.

Use labelled primary controls with supporting icons. Keep technical properties
behind disclosure. Give the world most of the screen; reserve space between the
workbench and composer rather than relying on z-index to conceal collisions.
The study demonstrates whole-tree/part references, additive references, collapsed
conversation, mood-board review, editable study rules and a simulated inhabit mode.
It makes no real agent calls and never requests microphone permission.

## Surface and interaction rules

Use warm liquid-glass framing with a readable inner text surface, restrained blur,
subtle edge highlights and visible keyboard focus. Glass is decorative; hierarchy
and readable labels must survive a solid-panel fallback. Do not make primary
actions depend on unfamiliar icon-only buttons or very small captions.

Keep close/back controls visible during scrolling. Escape unwinds the active
surface or leaves habitation. Native Tab navigation belongs to the authoring UI.
While inhabiting, E performs the named world action and authoring selection is
inactive. No automatic panel movement should follow every camera movement.

Before integrating the study, review the narrow-window layout, reference retention,
scrolled recovery, proposal flow and world visibility with the user. The character
concept and first/third-person preset proposal are separate from UI implementation.
