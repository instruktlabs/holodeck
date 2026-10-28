# Booth screens and impact presentation

Qualified local prototype, 27 October 2026. Use `evidence/range-v9-closeout.json` for exact tested files and outcomes. Holodeck world remains revision 8: this pass changes the project-owned runtime extension, not saved world placement or Kiln source assets.

## Ownership and reuse

The game owns selected session/archive, accepted shot records and scoring. `game/range-view.mjs` gives the browser HUD and physical display one read model. Native `RangeSession::ReviewRows`, `ReviewLane`, `ReviewString` and `Stats` serve the same purpose. Rendering and impact effects cannot award points or consume ammunition. The three consoles currently mirror one selected session; independent lane operators and multiplayer ownership are future work.

Kiln supplies the saved screen/target geometry and stable semantic surfaces. The optional Unreal delivery skill owns destination binding and preservation checks. Holodeck's integration/verification skills retain scene admission and browser observation. The reusable tools here are surface-frame binding, removable runtime display layers, change-driven texture updates, material-aware cosmetic impacts, bounded resource lifetime and destination evidence. Range-specific labels, scoring and controls remain in this game.

## Physical display contract

The pinned booth revision is `a_9509119312ea40b8a15d66f2361cd3eb / r_5ff8d00018224e7fa3ee926f0add1d6f`. `Mesh_Body_screen` has identity node transform because its tilt and placement are baked into its vertices. Its flat front measures 0.47328 x 0.33828 m. The runtime overlay is 0.466 x 0.331 m, leaving about 3.64 mm per edge, with a 0.8 mm front offset.

Source frame: center `[.1554221517,1.3273941410,-.31]`, normal `[-.9396926208,.3420201433,0]`, right `[0,0,1]`, up `[.3420201433,.9396926208,0]`. This fixed revision-specific frame should eventually become a saved semantic anchor in the authoring contract. Never infer it from an axis-aligned bounding-box center.

All three booths use one 1024 x 728 dynamic texture. The browser uses a CanvasTexture with sRGB color and an unlit material; native uses a canvas render target and a separately generated screen material. The display redraws when the reviewed data changes, rather than uploading on every frame. The original screen mesh and its material slot remain intact under a removable overlay. Browser disposal removes overlays/proxies and frees only their owned resources.

Holodeck's two static preview booths can be batched, removing individually addressable screen nodes. This initially left all displays unbound. The adapter now binds an available screen mesh or constructs its own frame from the exact authored booth placement. It does not disable batching or modify the host renderer. The fallback is restricted to the known booth asset and must be requalified for a different asset revision.

## Impact presentation

Paper/original targets use a small irregular dark puncture (roughly 4 mm radius) with a pale fiber edge around 7 mm. Steel uses a dark elliptical scuff around 9 mm plus five restrained warm streaks lasting 0.22 seconds. Browser geometry uses a shared irregular fan; native uses layered instanced shapes. These are comparable presentation recipes, not identical pixel output or calibrated material failure physics.

Persistent marks remain in target-local coordinates, so they follow returned paper and moving plates. Displaying archives never changes physical marks. Replacement/reset clears the appropriate visible marks while retaining the immutable ledger. Each surface retains at most 256 recent visible marks; transient effects allow 16 simultaneous bursts / 80 streaks. Restored history does not replay bursts. Misses and blocker-only events do not invent a target impact.

The original target's cyan center is raised geometry: its front is source X=-.055 m, while the scoring anchor is -.0475 m. Close-up inspection found that it occluded a shallower mark. For this pinned asset only, impacts within 29 mm of the center use an 8.5 mm presentation offset; other impacts retain 1.2 mm. Headless geometry checks establish clearance over the actual cyan/cream bounds without changing the scoring origin or immutable impact snapshots. This is a bounded visual correction, not generic surface-conforming decal projection.

Cosmetics have no collision, damage or scoring authority. Paper punctures are surface marks, not mesh holes; sparks are a restrained prototype effect, not a claim about exact firearm/ammunition/material behavior. Production decals, audio and calibrated VFX remain separate work.

Browser persistent marks currently share geometry/materials but remain individual meshes; native marks use instanced batches. Native transient instances now change allocation only when the active count changes, update transforms in place, and request PSO precaching when the batch is registered. The visible-count caps bound resources but do not prove a frame budget at the cap. Close native captures also expose pre-existing broken/coplanar-looking printed rings on the original target. That asset needs a separate geometry/material pass; the new puncture itself clears its raised center.

## Verification and observed failures

- `node --test game/range-view.test.mjs game/range-session.test.mjs`: 11 passing checks, including archive/current selection, ready clearing, immutable state and historical plate counts after a live reset.
- `node pipeline/test-range-adapter.mjs`: 13 passing actual-target-GLB checks, including effects expiry, duplicate/history suppression, resource caps, retained records, raised-graphic clearance and cleanup.
- `node pipeline/test-range-console.mjs`: 7 passing actual-booth-geometry/canvas-command checks, including face fit, shared texture, redraw suppression, material preservation, batched fallback and disposal. The headless fixture strips image references only in an in-memory derivative; it does not prove GPU appearance.
- Browser WebGPU observation: an archived three-hit paper group reads 18 points / 5.29 cm spread / 2.30 cm RMS on the physical screen. Three new real UI shots on the original target produced 30 points and appeared on the same screen. The archived plate group reads 50 points / 5 hits after a live reset. A fresh plate hit earned 10 points and independently moved that plate; close-up scuff and puncture images were inspected. WebGL2 displayed the archived paper group on the physical screen without console errors. Five individual spark streaks were not distinguishable in the wide live browser capture; lifecycle is qualified separately.

Native steel streaks initially rendered dark even though the intended unlit material was bound and the shader graph reported warm emission. Increasing geometry thickness alone did not resolve it. A rendering-enabled material refresh was therefore tested separately; the initial attempt to delete/recreate a rooted expression triggered an engine assertion before saving. Editing the existing constant avoids that destructive graph operation. The original preparation receipt and failed capture/log remain preserved; final material hashes and warm-pixel evidence are required by the closeout. The stationary-material diagnostic rendered both regular and instanced controls correctly, and a subsequent normal process also rendered bright streaks. This demonstrates a warmup dependency; it does not isolate a particular shader/PSO cache. The diagnostic is opt-in and its actors are excluded from normal play. The final path requests PSO precaching and reuses transient instances. Entirely cold shader/PSO caches on other hardware remain unqualified.

Unreal passed 56 target/presentation checks in editor and standalone, plus 34 packaged weapon and 9 range regressions. Both destination exports independently reproduce their scoring and grouping calculations. The native scripted group is 30 points with 10 cm spread; the browser screenshot uses a different, manually fired group, so these images are not identical-input comparisons. All 31 core rule/weapon/rig/view tests pass. See the closeout for exact source and cooked artifact identity. The first native run passed logic but rendered its console vertically flipped; correcting plane orientation and inspecting fresh captures resolved that visual failure. Close-up native effect captures use a fixture-only held pose at a recorded age; production lifetime remains 0.22 seconds.

The cleanup test caught a late effect callback repopulating a disposed adapter. The guarded impact entrypoint now ignores it, and the regression passes. Scene/asset/source identity, displayed result and loaded-host performance remain separate gates. Both PC and hub are under load; no frame-budget acceptance is claimed.

Implementation references: [Three.js CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html), the installed Unreal engine headers, and the local workspace validation skill. Source pins and original native material hashes are retained in the preparation/qualification receipts.

