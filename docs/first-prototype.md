# Holodeck first prototype plan

Date: 2026-10-21. Status: milestone 1 authorized; visual direction under review.
Companion: [package specification](package-spec.md).
Current identity: [creation platform and cove kit](creation-platform.md).

## Outcome

Demonstrate one complete local creation loop: open a cozy starting space, connect
the user's Codex session, discuss references by text and push-to-talk, accept a
world rule, build a small walkable scene, revise it using runtime feedback, hide
the starter, and reopen the saved result.

The prototype is complete only when that loop works with a real local agent and
an actual browser scene. A scripted demo can exercise the UI during development
but cannot establish agent integration or world-authoring acceptance.

## Proposed bounds

| Area | First prototype |
| --- | --- |
| Distribution | Local development checkout of a separate package; no publishing |
| Host | Windows and a current Chromium browser on the owner's development machine |
| Agent | One Codex app-server adapter, one active writer/session per project |
| Starting space | One Kiln-authored cozy cove kit on a bounded platform in the grid construct |
| World | One approximately 30 m by 30 m clearing; up to 50 placed objects |
| Assets | Up to six reusable asset types; at least one created or revised through Kiln |
| Traversal | Walk/look, static collision, safe spawn and return; one simple interaction |
| References | Up to 12 local images, two-way comparison, pinning and annotations |
| Bible | Intent, appearance, traversal rules, budgets, and explicit decision states |
| Input | Keyboard/mouse, text, one local push-to-talk transcription adapter |
| UI | Conversation, reference board, selection card, journal, origin, progress |
| Renderer | R3F with WebGPURenderer; test native WebGPU and forced WebGL2 |
| Persistence | Scene, bible, references, revision history, agent-thread mapping |

These numbers are proposed test bounds, not measured package limits. The other
earthen/woven/stone/paper/ember starting-space directions remain future presets.

## Milestones after scope approval

### 1 Compatibility and visual contract

Use an isolated package checkout. Select exact compatible versions of React,
R3F, Three.js, Glyph, and any spatial UI dependency. Render one label, one dynamic
caption, one image panel, and one selectable object in both backends. Verify font
loading/failure, text replacement, clipping, and teardown. Use a DOM fallback if
Glyph blocks progress; record the result rather than requiring a typography rewrite.

Select and test one locally executed transcription backend, including microphone
permission denial and editable transcript recovery. Record setup, model download,
resource cost, and supported host. Browser speech APIs are not presumed local.

Prepare a visual study of the starter, reference board, selected-object state,
and listening state. Confirm this direction before detailed UI implementation.
Measure a baseline on the named machine and fix the prototype resource budgets.

### 2 Local project and agent loop

Scaffold a writable project and run the local host. Connect Codex through stdio;
stream messages, expose actual permissions, interrupt a turn, and resume the thread.
Import references and send selected reference/object context with the prompt.
Verify disconnect/reconnect without duplicate turns or losing accepted state.

### 3 References and decisions

Watch completed files, generate thumbnails, update the board, and pin exact
revisions. Editing annotations updates agent context. Accept or supersede a bible
decision and show the resulting readable journal. A new image revision cannot
silently replace an accepted reference.

Built-in image generation is outside this prototype. Images created externally
arrive live through the reference import/watch path. This proves the workflow
without assuming a Codex subscription supplies an image-generation API.

### 4 Scene authoring and feedback

The agent places rough forms, creates/revises one asset through a separate Kiln
asset workspace, and stages its delivery in the world. Select an object and ask
for a change. Capture the actual scene, inspect traversal and budgets, and complete
one feedback-driven correction. No asset authoring occurs in the engine checkout.

Validate and swap scene revisions; reject stale writes and invalid assets.
Implement selection, transform changes, static colliders, and one built-in
interaction such as toggling a lamp. Persist and undo at least one applied change.

### 5 Enter, hide, recover

Hide starter geometry and all its effects, continue walking, and summon controls.
Save, close, reopen, and restore the same accepted world and references. Exercise
cancelled generation, a broken asset, a disconnected agent, and an interrupted
file write. The last valid world remains usable throughout recovery.

## Acceptance checks

| Check | Evidence required |
| --- | --- |
| Installation boundary | New writable world folder; installed package and Kiln checkout untouched by authoring |
| Real agent | Browser prompt reaches the chosen project session; streamed reply, stop, approval, resume demonstrated |
| Voice | Recorded speech becomes an editable transcript submitted to that same thread; denial leaves text usable |
| Live references | Add and revise images without reload; accepted pin stays on its selected bytes |
| Context | A request about a selected object/reference records the exact IDs and revisions sent |
| Bible | Proposed rule is visibly accepted and persists; a conflicting proposal does not silently replace it |
| Authoring | One Kiln asset revision reaches the scene and one feedback-driven change is verified in scene |
| Concurrency | A stale agent patch cannot overwrite a newer direct user placement |
| Loading | Invalid or cancelled replacement leaves prior geometry and collision active |
| Collision | Player can traverse the intended route and cannot walk through the declared static obstacle |
| Origin | Hiding removes starter collision/light/audio; return restores a safe usable authoring location |
| Persistence | Reopen preserves scene, bible, exact reference pins, and session linkage |
| UI | Complete loop with keyboard/mouse; readable focus/contrast and reduced-motion mode |
| Backends | Same test scene and UI exercised on WebGPU and forced WebGL2; differences recorded |
| Recovery | Agent disconnect, partial file, and failing load yield actionable state with no lost accepted revision |

## Responsiveness and resource targets

Record hardware, browser, versions, viewport, backend, scene revision, and test
sequence. Targets below are provisional and must be assessed against milestone 1:

- Local selection/control feedback: p95 under 100 ms.
- Valid small metadata/reference changes: visible within one second after the
  host receives a complete file or operation. Image decode and thumbnail time
  are recorded separately; use bounded fixture sizes.
- Warm scene at 1080p: target 60 fps, p95 frame interval at most 20 ms over a
  60-second traversal. Also record long frames and loading interruptions.
- Asset preparation: report decode/upload/compile duration separately from agent
  generation. Do not promise a fixed time for model output or large assets.
- Twenty repeated replacements: no accumulating live resource counts after
  retirement; inspect estimated resident bytes and browser diagnostics as well.

Set finite geometry, texture, file-size, decode-concurrency, and resident-resource
caps from the baseline before scene production. Budget failures keep the active
revision and report the violating resource. Passing on the owner's machine does
not qualify mobile or headset performance.

## Explicitly deferred

Full VR authoring and headset qualification; remote headset access to the host;
multiplayer; multiple simultaneous agent writers; continuous voice or spoken
responses; bundled image-generation service; remote hosting; marketplace or
arbitrary downloaded plugins; dynamic physics; large terrain streaming; unlimited
world generation; and publishing the package.

Keep input commands and world origin independent of desktop presentation so XR
can be evaluated next. Do not advertise VR support until a headset flow passes.

## Decisions to settle at scope review

The separate repository and milestone 1 work are authorized. One Codex adapter
and local push-to-talk remain the prototype defaults. Review the platform/cove
visual identity before asset production. The implementation evaluation chooses the exact
dependency versions, transcription backend, and measured budgets; it must return
to scope review if a required capability cannot be delivered within these bounds.

Later milestones remain unstarted. This document does not authorize commits,
publication, deployment, or paid agent inference.
