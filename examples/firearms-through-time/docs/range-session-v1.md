# Target sessions across Unreal and Holodeck

Qualified local prototype, 27 October 2026. This supersedes the implementation-gap section of the earlier `range-targets-and-shot-review.md` audit; its broader activity catalogue remains design intent. Final qualification is recorded separately in `evidence/range-v8-closeout.json`.

## Where the skill fits

The optional Kiln Unreal delivery skill already exists under `native/.agents/skills/kiln-unreal-delivery`. It now links a target delivery recipe and explicitly disables implicit invocation. It remains local, unpublished and scoped to the native workspace. No global skill install, Kiln engine change or Holodeck package change is part of this work.

Kiln authors the asset and its geometry contract. Holodeck's existing integrate/verify skills stage the scene through supported proposal/apply and inspect the displayed result. The Unreal delivery skill preserves imported component bindings and native material overrides. General game development stays in the native workspace/toolkit. Rules and gameplay belong to this game, with thin browser/native adapters. This lets other Kiln users adopt the asset workflow without inheriting this shooting range's rules.

## Shared contract

`game/range-rules-v1.json` is the versioned game tuning source. `pipeline/generate-range-rules.mjs` produces the native header and explicit collision profile from the pinned world request. Source coordinates are metres, +Y up; Unreal maps them to centimetres `[x,z,y]*100`. All basis axes and half extents must be reordered together.

One accepted command consumes one abstract round and creates one immutable shot. The nearest front-facing scoring surface competes with explicit world box proxies. The record retains shot/string/sheet/activation IDs, tick, ray, outcome, points, surface ID, local position/UV and the world pose at impact. The score reads that record once. Wrong-lane and inactive-plate impacts remain distinct from eligible hits; world marks are cosmetic.

Grouping uses eligible paper/original hits in target-local space: centroid, maximum pairwise spread and RMS distance from centroid. Fewer than two hits has no spread/RMS value. UI labels use game centimetres. No claim of real ballistic calibration is made by these prototype values.

Sessions start explicitly. Seven accepted shots or five cleared plates ends a string. Returning paper ends the string immediately and gates firing before ammunition changes. The carrier travels 3.2 m at 0.8 m/s on a fixed 60 Hz simulation, stops on obstruction, and resumes explicitly. Start while docked deploys first. Replacing paper advances its sheet ID while retaining archives. Starting a new plate string advances activation and resets all five pivots.

Marks store local coordinates under their surface anchors. Retrieval moves their presentation without changing historical world positions. Paper source revision `r_946b8c27076f409fbfd96fe8ee4ab139` moves the old dock stop out of the travel path; the new saved rail is `a_1e848fabc2274391abc6e832db004173` revision `r_acf7d9fe86504eb299d788f9ddf13671`. Original target parts and native override assets are preserved by the importer.

## Current adapters

Holodeck world revision 8 uses `weapon-extension.jsx`, `game/range-three.mjs` and `game/range-ui.mjs`. Its HUD selects lanes, starts/ends strings, returns/replaces paper, reviews archived numbered groups and exports JSON. The extension wraps and restores the project's runtime collision function for the moving paper body. It does not modify the host. Local session snapshots restore into review/blocked state, not a silently active string. Weapon animation state is transient.

Unreal uses `RangeSession` called from `WeaponLoop`. Keys are 1/2/3 for original/paper/plates, Enter start, Backspace end, T return/resume, Y replace paper/new plate string, PageUp/PageDown archive review and F8 export. The native export goes to `Saved/RangeSessions`; restart restoration is not yet implemented. Native world marks now use seven frame-attached instanced mesh batches, with a separate dark unlit material explicitly enabled for instancing. The batches rebuild when visible ledger membership changes; target motion carries the instances. The HUD carries numbered impacts. These remain prototype surface marks rather than production decals or physical holes.

Two native evidence failures were caught by inspecting captures after logic passed. First, deferred HighResShot captured the next test state; settle/hold phases now surround each capture. Second, transient debug points were not visibly present on the returned paper; durable geometry replaces reliance on debug rendering. The separate generated mark material preserves original override files and makes the required cooked shader usage explicit.

## Qualification and limits

28 rule/weapon/rig tests and 8 actual-GLB adapter checks passed. Unreal passed 48 target checks in editor and standalone, plus 34 standalone weapon and 9 range regressions (including zero unbuilt lighting objects). Both actual destination exports reproduce the shared surface, scoring and grouping calculations. A live WebGPU browser string produced three hits, 18 points and a 5.29 cm spread; returning retained marks/history and did not consume ammunition when fire was attempted. Five live plate hits produced 50 points, then reset correctly. Player obstruction/resume, archive review and export were observed. WebGL2 rendered the same saved archive without console errors. The shared PC/hub is under load, so performance remains DIRTY. Read final receipts for current counts and exact source identity.

The collision profile consists of authored box proxies and scoring planes/discs. It is not a triangle-accurate arbitrary-world physics query. The physical booth screens now mirror the HUD review selection; see [screen and impact qualification](range-console-and-impacts-v9.md). The v8 evidence above remains the earlier baseline. The source assets remain prototype art. Pixel-identical screen rendering, advanced decals, VFX/audio, realistic ballistics, complete activity playlists, multiplayer authority and unattended recovery are separate future work. No automatically published optional extension is implied by this local recipe.
