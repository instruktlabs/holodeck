# Firearms Through Time

A first-person shooting-range game built on Holodeck's
[client-extension hook](../../docs/client-extensions.md), with the same rules
ported to Unreal Engine. It is kept here as a worked example of taking a game
from Kiln assets through the Holodeck browser host to a native engine. It is
not a bundled world: it doesn't appear in the world picker and isn't part of
the npm package.

Four weapons play in both hosts: a 1911-style pistol, an 1866 sporting rifle,
a No.4 Mk I* bolt rifle and a Colt M4 carbine with semi and 3-round burst.
A Pattern 1742 flintlock musket is being authored. See
[remaining work](docs/remaining-work.md) for what is not done.

## What is here

| Folder | Contents |
|---|---|
| `weapon-extension.jsx` | The React Three Fiber client extension: view model, skinned hands with arm IK, sights, recoil on the host's look, the HUD and the range session. |
| `game/` | Engine-independent rules and data: weapon state, the held trigger (semi, burst, flintlock lock delay), recoil, the range session, and per-weapon contracts, motion clips, arm rigs and views. Shared fixtures (`trigger-fixtures-v1.json`, `recoil-fixtures-v1.json`) are replayed by both hosts. |
| `authoring/` | The ten pinned browser GLBs: four guns, their hands, the 1866 loading token and the No.4 charger. Pins with revision IDs and hashes are in `game/*-asset-pins-*.json`. |
| `holodeck-range-slice/` | The range world (Holodeck schema v2) and the 19 GLBs it places. |
| `native/ToolchainValidation/` | The Unreal Engine 5.8 C++ project, source only: weapon actors, the data-asset profile, the trigger and recoil ports and the in-engine test ticks. |
| `pipeline/` | The scripts that made and checked the assets: Kiln programs, glTF analysis, native staging, Unreal Python import, PowerShell runners and a standalone MSVC check of the native trigger rules. |
| `docs/` | Round reports with measurements. Start with [M4 and Pattern 1742](docs/m4-1742-v14.md), [controls](docs/controls-v12.md) and [recoil](docs/recoil-v1.md). |
| `skills/holodeck-game-pipeline/` | An optional agent skill for this Kiln, Holodeck and engine workflow, with the lessons from these rounds. Install it only into a project that wants it. |

## Play it in the browser

From the repository root, after `npm ci`:

```powershell
$env:HOLODECK_WORKSPACE = "$PWD\examples\firearms-through-time\holodeck-range-slice"
$env:HOLODECK_CLIENT_EXTENSION = "$PWD\examples\firearms-through-time\weapon-extension.jsx"
npm run dev
```

Open `http://127.0.0.1:4186/prototype.html?weapon=carbineM4`. The other
weapons are `pistol`, `rifle1866` and `boltNo4`, and the panel switches
between them. Add `&backend=webgl` to force WebGL2. The host runs the world in
place, so edits you make in Holodeck change this folder's `world.json`.

| Action | Keys |
|---|---|
| Lock the mouse | Enter the world, or click the view |
| Fire | LMB or F; hold for a burst |
| Aim | Hold RMB; Q toggles |
| Reload, inspect, swap grips | R, I, C |
| Semi or burst (M4) | B |
| Take a gun from the wall rack | Look at it, then X |
| Show the string and target review | J |
| Change lane, end the string | L, Backspace |
| Return the paper, new sheet | P, Y |
| Review strings, export the session | PageUp and PageDown, F8 |
| Release the mouse | Esc |

The first trigger pull starts a string in the current lane.

## Tests

```powershell
cd examples/firearms-through-time
node --test "game/*.test.mjs"
```

58 tests cover the weapon state, trigger and recoil fixtures, the range session
and the mouse-button handling. Seven more tests check the pinned GLBs against
the Kiln source store, so they stay in the authoring workspace.

## Unreal

The project targets Unreal Engine 5.8.4. Only its source and config are here.
Its content is generated: `pipeline/stage-*-native.mjs` derives native GLBs
from the browser pins, and `pipeline/prepare_*.py` imports them in the editor.
Both read the Kiln source store, so a fresh clone can build the C++ module but
can't regenerate the content.

`pipeline/check-trigger-native.ps1` compiles the header-only trigger rules with
MSVC against a stand-in `CoreMinimal.h` and replays the shared fixtures in
seconds, without Unreal. The `pipeline/run-*.ps1` runners start the editor, or a
packaged build under `FTT_PACKAGE_ROOT`, on a test map and write their results
under `evidence/`.

## What stays out

- **Three range dressing pieces:** the service bench, cabinet and wall sign use
  a Kiln library wood that isn't licensed for publication, so this copy of the
  world leaves them out.
- **The Kiln source store and receipts, evidence captures and reference
  images:** they stay in the authoring workspace. The docs still name those
  paths, for provenance.

## Licence

Code, the Unreal module, scripts and Kiln programs are MIT. The world data and
GLBs are CC0, as set out in [LICENSING.md](../../LICENSING.md). Firearm names
describe the historical designs the models depict; no trademark rights are
granted.
