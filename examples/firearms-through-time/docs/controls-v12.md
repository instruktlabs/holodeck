# Controls v12: mouse and keyboard

27 October 2026. The owner asked for proper mouse-and-keyboard controls with a locked cursor, as in an FPS. They then reported that the first version "wasnt working and there was no recoil". This record covers both rounds.

## Scheme

| Action | Browser (Holodeck host) | Unreal |
|---|---|---|
| Capture the mouse | Enter world, or click the view | Captured at start (game-only input, hidden cursor) |
| Fire | LMB (mouse locked) or F; hold for a burst | LMB or F; hold for a burst |
| Aim | Hold RMB (mouse locked); Q toggles | Hold RMB; Q toggles |
| Reload, inspect, swap grips | R, I, C | R, I, C |
| Semi or burst (M4, round v14) | B | B |
| Release the mouse | Esc, which also leaves the world (host behaviour) | — |

Range keys:

| Range action | Browser | Unreal |
|---|---|---|
| Start a string | Fire | Fire, or Enter |
| Change lane | L (Paper, Plates, Original in turn) | L, or 1 Original, 2 Paper, 3 Plates |
| End the string | Backspace | Backspace |
| Return the paper, or resume blocked travel | P | P or T |
| New sheet (paper) or reset plates | Y | Y |
| Review archived strings | PageUp, PageDown | PageUp, PageDown |
| Export the session | F8 (downloads JSON) | F8 (Saved/RangeSessions) |

The browser can't use Unreal's 1–3, T or Enter, because the host keeps 1–9 and T for emotes and Enter and Tab for the composer.

## Why the first version failed for the owner

1. **A test override left in the Chrome tab.** Automation can't take a real pointer lock in a background Chrome window (`WrongDocumentError`). The logic was therefore tested with a faked `document.pointerLockElement`, and that override stayed in the tab. The host then believed the mouse was already locked, so it never requested a real lock. Reloading the tab removed it.
2. **The trigger only worked inside a range string.** Outside one, a shot was refused with "Start a range string before firing", which appeared only in the panel text. With the mouse locked, the only way to start a string was the panel's Start string button. Esc releases the lock, and the host then leaves the world, which ends the string. A locked session could therefore never fire. Unreal had the same rule, but with an Enter key for it.

## Owner decisions (27 Oct)

- **First shot starts a string, in both hosts.**
  - With no string running, a trigger pull that can fire starts one in the current lane. That shot is scored like any other.
  - Strings still end at 7 shots, on End, or on leaving.
  - With the paper docked at the booth, the pull sends it downrange instead of firing. The string begins when it arrives.
  - The gun refuses only for its own reasons (cycling, reloading, empty) or while the target moves.
- **Range keys:** Unreal's keys where the browser host leaves them free, plus L and P. Unreal gained L and P too, so both hosts share one scheme.

## Implementation

- **game/range-session.mjs:** `startOnTrigger`. The ready and leave messages now say to fire to start a string.
- **weapon-extension.jsx:**
  - The trigger checks the gun first, then calls `startOnTrigger`, then the range gate. A refusal shows the range's reason, such as "Deploying — firing unavailable".
  - The range keys sit beside the range panel and use the same gate as its buttons.
- **game/range-ui.mjs:** a key legend line, and `review(step)`, which mirrors Unreal's PageUp and PageDown.
- **Unreal** (pipeline/native-range-trigger-v12-source-edit.cjs; backups in evidence/sight-v12/native-source-before/*.before-range-trigger.*):
  - The WeaponLoop fire action starts a string from ready or review when the gun has a round.
  - RangeSession gains the L and P keys, the new HUD hints and the new messages.
- **Earlier in the round** (pipeline/native-controls-v12-source-edit.cjs; browser backup evidence/sight-v12/weapon-extension-before-controls.jsx): hold-RMB aim, LMB fire under lock and game-only input.

The native range-session fixture keeps 56 checks:
- `ready_gate_preserves_ammo` became `unbound_trigger_cannot_start_string`. With a target binding missing, the trigger is refused without starting a string or spending a round.
- `docked_review_gate_no_ammo_loss` was removed. `start_redeploys_before_active` became `docked_trigger_redeploys_without_shot`, run after the docked captures, because the pull now sends the paper downrange.
- `plate_string_starts` became `plate_lane_selected`. The new `trigger_starts_plate_string` checks that the first plate shot starts string 3 and is scored.

The 1866 and No.4 fixtures keep 42 and 46 checks (pipeline/native-range-trigger-v12b-source-edit.cjs):
- Each opened with `ready_session_blocks_fire_before_ammo`, which asserted the old rule. The first editor run failed there: the pull started a string and fired, which shifted the ammo and shot counts behind it.
- It became `empty_trigger_starts_no_string`. With the gun emptied for the check, the pull is refused, starts no string and records nothing. That is the new rule's guard.
- The other refused-fire checks are unaffected, because cycling, inspect, reload and cooldown refuse before the trigger can start anything.

## Qualification record

- **Node:** 58/58 game tests. The new test checks that the trigger starts a string only from ready or review, and that a docked paper deploys first.
- **Chrome, keyboard path (automation, pistol, WebGPU):**
  - F with no string running started one and scored 10 in ring 1.
  - L was refused mid-string with the hint, and changed lane after Backspace ended the string.
  - PageUp and PageDown stepped the review from current to 1, 0, 1 and back to current.
  - P returned the paper, which docked. Y fitted a new sheet.
  - F at the docked paper sent it downrange without a shot. The string began when it arrived, and the next F was recorded.
- **Unreal editor game,** all with zero material fallbacks:
  - Range session 56/56, pistol 34/34 and range dressing 13/13 (label `range-trigger-v12`).
  - 1866 42/42 and No.4 46/46 after the fixture fix (label `range-trigger-v12b`).
  - The first 1866 and No.4 run failed on the old-rule check described above.
- **Standalone package** (WeaponLab, rebuilt with both edits; label `trigger-v12-packaged`), all with zero material fallbacks: No.4 46/46, 1866 42/42, pistol 34/34, range session 56/56, range dressing 13/13 and range v7 9/9.
- **Owner, hands-on in Chrome (27 Oct), a quick look, not a full test:** "the cursor locks, left-click fires with recoil, and holding right-click aims". The owner then said they "didnt fully test".

Closeout: evidence/controls-v12-closeout.json. It is generated from the result files. The pistol runner does not record material fallbacks, so its count comes from a log scan.

## Firing while aiming (owner report, 27 Oct)

The owner reported that hip fire worked, but holding RMB to aim and clicking LMB to fire did not.

- **Cause:** browsers treat a second mouse button as a chord.
  - They send `pointerdown` only for the first button pressed, and `pointerup` only for the last one released. A button pressed or released while another is held arrives as `pointermove`.
  - The extension listened only to `pointerdown` and `pointerup` button codes. With RMB holding aim, the LMB press never reached the trigger.
  - Releasing RMB while LMB was still held was missed too, which could leave the aim held.
- **Fix:** `game/mouse-buttons.mjs` reads every press and release from the change in `e.buttons`. The extension feeds it `pointerdown`, `pointermove` and `pointerup`, and clears the mask when the lock is lost. Backup: evidence/aim-fire-v12c/browser-before/weapon-extension.jsx.
- **Unreal:** not affected. `WeaponLoop.cpp` reads each mouse button as its own key, so there is no native change.
- **Checks:**
  - **Node:** 72/72 game tests. The 3 new ones in `game/mouse-buttons.test.mjs` include the pre-fix handler, which fires 0 times on the aim-then-fire sequence.
  - **Browser:** my own pane tab, WebGPU. The lock was faked and the tab was sent the events a browser sends; it was reloaded afterwards.
    - Before the fix, with RMB held (AIM), the LMB press left Shots 0 and Ammo 7/7. A hip click fired.
    - After it, the same press fired and hit while aiming (Shots 1, Hits 1). Pressing RMB while LMB was held aimed, and releasing it returned to the hip.
  - **Evidence:** evidence/aim-fire-v12c/browser-check.json.
- **Not verified:** a real locked mouse in the owner's browser, and forced WebGL2. The handler doesn't depend on the backend.

## Not verified

- **Locked-mouse flow beyond that first look:** for example the range keys under lock, Esc and re-entry, and a full string with reloads. Automation can't take the lock, and the owner's look was brief.
- **Browser F8 export:** not triggered, because it downloads a file.
- **Unreal key presses:** the fixtures call actions directly, since input is skipped in test modes. The new key bindings compile but were not pressed.
