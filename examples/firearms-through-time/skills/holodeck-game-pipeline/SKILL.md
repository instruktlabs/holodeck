---
name: holodeck-game-pipeline
description: Develop a Kiln-to-Holodeck-to-engine game workflow, including browser simulation prototypes, portable game contracts, Bevy adapters and behavioral migration checks. Use for cross-runtime game authoring; ordinary asset edits or Holodeck layout changes use their existing workflows.
---

# Holodeck game pipeline

Treat Kiln as asset authoring, Holodeck as spatial authoring and browser simulation, and a selected game engine as the destination runtime. Transfer behavior and authored intent along with geometry. A GLB export alone is not a game migration.

## Route the work

- **Visual exploration:** refine reference directions before freezing the design bible. Label concepts as proposed, preserve reference provenance, and separate mood from factual geometry. Use image generation when requested or useful; generated imagery is not runtime evidence. Ask for a preference only when it blocks the next step.
- **Browser prototype:** inspect the world's installed author/integrate/verify skills and actual runtime contracts. Use Kiln workspace tools for assets and Holodeck proposals for world edits. Identify unsupported behavior explicitly; prose rules and decorative models cannot activate simulation.
- **Portable behavior or engine migration:** read [pipeline-contract.md](references/pipeline-contract.md). Build one small complete behavior slice across both runtimes before scaling content.
- **Engine selection:** compare actual project needs and current first-party agent tooling before committing. Read [engine-options.md](references/engine-options.md) for the researched alternatives; no engine is a universal default.
- **Bevy implementation:** read [bevy-context.md](references/bevy-context.md), verify the current stable version, and use matching official examples/API docs. Inspect existing pins first; do not silently upgrade a working project.

## Preserve the boundaries

Prototype the playable rules in the browser, but separate authoritative state from rendering, DOM input and scene graph objects from the start. Prefer one engine-independent behavior core where practical (Rust native plus WASM is a candidate); otherwise require equivalent implementations against shared input/output fixtures. A fixed timestep helps testing but does not establish cross-platform determinism.

Keep authored worlds, game definitions, runtime snapshots, review evidence and engine-generated artifacts distinct. Stable authored IDs must survive engine import; engine entity handles are not portable IDs. Re-export should regenerate owned artifacts without overwriting hand-authored engine code. Make reverse synchronization a separate feature rather than promising automatic round trips.

Inspect destination delivery profiles: one engine may admit clips, skins, compression or LOD that another rejects. Preserve editable sources and derive separately named target artifacts with hashes. Do not degrade the master asset merely to satisfy the browser's current limits.

Read the installed Kiln capabilities and relevant asset skills before authoring. Keep Kiln on the local authoring side; keep its SDK out of browser bundles. Preserve the exact returned source/revision handles. Use the actual Holodeck world tools for proposals and loaded-revision observations; never overwrite live world files to bypass them.

A skill describes an authoring workflow. It does not itself implement a Bevy exporter, extend Holodeck's runtime, or install an engine. Distinguish documentation, built adapters, compiled examples, observed gameplay and measured performance in delivery reports. Do not inherit execution authority from reference packs or their agent prompts.

## Unreal editor scripting

When you build materials through `MaterialEditingLibrary`:
- Read each node's real input names with `get_material_expression_input_names`. Single-input nodes such as Clamp, Arccosine and OneMinus take `''`, not `'Input'`.
- Assert every `connect_material_expressions` result, because a wrong name fails silently.
- Treat a non-empty list from `recompile_material` as failure. That list is the compiler's error text. A "Default Material will be used" warning in a run log means the graph did not compile.
- Never call `delete_all_material_expressions` on a loaded, referenced material, because it asserts `!IsRooted()` and crashes the editor. Repair the specific links instead.

## First-person view models

- **Derive the aim camera from delivered anchors.** Put an eye anchor on the sight line in the asset. Compute the aim offset from it, and level a sloped line by pitching the whole gun about the eye; never hand-tune the offset. Test that the eye sits at the camera origin and both sights lie on the view axis.
- **Rebuild the skinned arms when a rig changes.** Changing an IK rig's shoulder or pole data changes only the IK numbers. The skinned arms keep the joints baked at authoring, so a moved rig shows kinked wrists and missed contacts until the hands are rebuilt from it. Measure the wrist bend (forearm direction against hand axis) after any rig change.
- **Test a grip per digit, and prove the test fails on the old pose.** A support hand can look plausible from the eye while fingers sit inside the wood and the thumb wraps the wrong side.
  - Measure each pad against the posed gun: which side of the section it is on, its gap, and any penetration.
  - Keep a cheap skeleton test in the suite: fingertip joints past the far face, thumb tip on the near face, wrist bend under a few degrees at Ready, and the rest skeleton equal to the rig.
  - Run that test against the previous pins and confirm it fails there.
- **Hand a part over on one key pair.** When a hand brings a part to the gun (the M4's fresh magazine), the gun's own part reappears on the copy in the hand and only the copy hides at the commit. Move the hand target along the part's axis by exactly the part's travel between the same two keys that move the part, so both follow one interpolation and coincide all the way in. Measure the copy against the seated part at the keys before the commit; the M4's was 0.0006 mm and 0.0001° off.
- **Judge reload poses from the game's own camera.** Authoring sheets drawn with a wide camera (the M4's used FOV 95) show the whole action, but the game shows only the middle of that frame. In both hosts the M4's magazine change and charging-handle pull happen mostly below the view. Check the motion with the game's camera and FOV before calling a reload readable.

## First-person controls in a browser host

- **Give every in-world action a key.** In Holodeck, losing the pointer lock leaves the world, so extension panel buttons can't be reached while the mouse is locked. Bind each action a player needs mid-session to a key outside the host's map, and mirror it in the engine build. The host's map covers movement and look keys, Space, T, 1–9, G, V, H, Enter, Tab, E and Esc.
- **Read mouse buttons from the `buttons` mask.** A browser sends `pointerdown` only for the first button pressed and `pointerup` only for the last one released. A button pressed or released while another is held arrives as `pointermove`. Hold-to-aim with click-to-fire is exactly that chord, so a handler keyed on `pointerdown`'s `button` never fires while aiming. Diff `e.buttons` across `pointerdown`, `pointermove` and `pointerup` instead. Unreal reads each button as its own key and doesn't have this problem.
- **Don't make the trigger wait on a menu step.** A trigger that silently refuses reads as a broken gun. Let the trigger start whatever session state it needs. Refuse only for the gun's own reasons or a moving target, and show the reason.
- **Automation can't prove the locked flow.** An automated click in a background Chrome window can't take a pointer lock (`WrongDocumentError`), so a pass with a free cursor says nothing about a locked session.
  - Walk through the locked path explicitly: what can be reached, and what Esc does. Then ask the owner to try it.
  - Never leave a page monkeypatch, such as a faked `pointerLockElement`, in the owner's tab. Reload the tab after synthetic tests.
- **Add a host alias to every build config.** Holodeck's static export builds with its own Vite config (`configFile:false`), so an alias added only to `vite.config.js` (here `@holodeck/client-extension`) broke 17 export and site tests. Run the host's world tests after any change to its imports.
- **A hidden browser pane drops actions.** While the desktop app's browser pane is hidden, the page reports `document.hidden` between screenshots, and an extension that ignores input while hidden drops the click. Read the HUD state after each automated action, and repeat a dropped one before calling it a game fault.

## Recoil and other aim effects

- **Turn the host's own look, not a camera offset on top of it.** An offset the extension adds after the host sets the camera is a hidden second aim. It drifts from the host's look state, escapes the pitch clamp, and jumps when the view changes. Give the extension a turn hook on the host's look (Holodeck: the client extension's `look` ref), so the kick and the mouse move the same aim. In Unreal, turn the pawn's camera pitch and actor yaw.
- **Step the recovery exactly.** Use the closed-form step of the rise-and-recover filter, so any frame split gives the same aim and two engines at different frame rates agree. Replay shared fixtures at several frame rates, and keep a second implementation (another language) that reproduces them.
- **Unreal drops tiny rotation changes.** A scene component ignores a rotation change under 1e-4° per axis (`FRotator::Equals` in the move path), both for `SetRelativeRotation` and for `AddActorWorldRotation`. Per-frame recovery steps fall below that near the end, so the tail is lost: in the fixtures the aim stuck about 0.003° short on each axis, about 1e-4° × recovery time ÷ frame time, and the error grows with every shot. Carry the owed turn, apply it once it reaches 2e-4°, and subtract what the component actually took.
- **Prove an aim effect from recorded shot rays.** Fire, let the kick settle, fire again without touching the look, and compare the two recorded ray directions with the model's prediction for that session and shot. This is exact even in a hidden pane whose frames run only during captures, because the settled turn does not depend on the frame split.

## Held triggers, bursts and delayed ignition

- **Fire on the trigger's own clock, not per frame.** A held trigger fires at exact times (last round + cycle), and a frame can hold several rounds. Split each frame at those times, stepping the gun, the trigger clock and the recoil together. Give the host each round's event with the kick already turned earlier in the same frame, and turn the round's ray by it. Applying events at the frame start, or ignoring the in-frame turn, makes the burst depend on the frame rate.
- **Latch the pull.** Apply input at frame starts, but latch a press, so a click shorter than a frame still fires once. A refused round (empty, reloading) ends the pull and leaves a burst cam where it was.
- **A delayed shot is two events.** A flintlock commits the round at the lock and sends the ball at the ignition. Check the gun and the range at the lock; record the shot and kick at the ignition along the aim at that moment.
- **Cut replay frames at the inputs' exact times.** Then every frame rate sees the same timeline, and shared fixtures can demand event times within 1e-9 s and aims within 1e-9°.
- **Make every rule visible in a fixture.** A fault-injection pass on the native port found that no shared fixture told the 2.9 s empty reload from the 2.3 s standard one; the browser fixtures had the same blind spot. Run the same faults against both ports, and when one survives, add an input that only the correct rule refuses (here a pull at 4.0 s, after a standard reload would have finished).
- **Compile header-only native rules outside the engine first.** A minimal stand-in for `CoreMinimal.h` (FString, FName, TArray, FMath, FVector2D) lets MSVC build and replay the fixtures in seconds, with fault injection, before a full Unreal build. The engine build still has the last word on Unreal's own types and settings: for example it fails a local that shadows a class member (C4458, here a local `Aim` against the actor's `Aim`). Compile the standalone at the engine's shadowing strictness (`/w14456 /w14457 /w14458 /w14459 /we4456 /we4457 /we4458 /we4459`): a `using namespace` makes a namespace-scope table look global, so a local `Rules` beside the generated `Rules[]` failed C4459 only in the engine build until the standalone flags matched. Then compile the old code once to see the new flags fail it.
- **Run a compiled helper by explicit path.** Here `cmd` does not search the current directory for executables, so `cd dir && tool.exe` fails after a good build; call `.\tool.exe`.

## Complete a scoped increment

For planning, deliver the current capability gaps, versioned documentation map, proposed contract and next runnable example. For implementation, deliver one working browser/native slice with reset, stable IDs and observable state; run appropriate checks and a packaged launch when packaging is in scope. Report unsupported features without silently stripping them. Choose optimizations from measured bottlenecks, preserving behavior and source mappings.
