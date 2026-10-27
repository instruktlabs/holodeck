# Castle development checkpoint

Paused at the owner's request after completing the in-flight reference and
blueprint documents. This is a work-in-progress checkpoint, not a release.
No new scene application or full player build accompanies this checkpoint.

## State to preserve

- Unity **6000.7.0b6** is the selected Editor on both execution hosts. Read the
  resolved package lock, not just manifest requests, for effective versions.
- The legacy Holodeck revision 10 playable slice passed a Windows D3D11
  technical smoke: stair ascent/descent, ballista aim and damage, defended
  24-raider victory, bridge traversal, unattended breach and restart. It produced
  4,008 camera callbacks over approximately 186 seconds under shared load.
  Its visual composition was rejected. This is not a performance qualification.
- The checked-in `Assets/CastleSliceBundle/slice.json` remains that legacy input:
  SHA-256 `3b5fcfa46ec54e6d34ef1b41640ea14e8c4ef0beacacbed4c276eb825afbd552`.
- A separate reconstruction candidate with 18 assets and 146 placements is
  staged in the authoring workspace. It has not been applied or rendered in the
  game. Its numerical clearance checks do not confer visual approval.
- The B3 stair/gallery construction design and hybrid defense diagrams in
  [design/blueprints](design/blueprints/README.md) are proposed. They do not exist
  in the staged candidate yet. Stronger concept art is saved with the private
  review package and still needs owner review.
- The rigged soldier has Idle, Walk and LookAround clips, 22 bones and three
  LODs. First/third-person soldier possession, melee, weapon animations, IK and
  hybrid GPU crowds remain unimplemented. The current free walker is separate.
- Ten newly saved architecture, dressing and equipment assets cover eight
  inventory concepts. They are geometry-reviewed drafts, not ten new assets
  already integrated into a qualified game. See `design/asset-inventory.json`.

## Known build boundary

The new `CastleTerrainAppearance` adapter requires an explicit terrain contract.
Its isolated Editor import/compiler and 12-vertex palette fixture passed on the
beta; GPU appearance and player shader variants remain unqualified. The legacy
bundle predates that contract and contains only terrain positions and indices.
**Do not expect the current source to rebuild the old bundle unchanged.** Either
stage the approved candidate's full v1 appearance/normals export, or make an
explicit, separately identified legacy migration with `legacy-flat-ground-v0`
and its actual source color. Never silently invent a palette or overwrite the
qualified bundle and then reuse its old smoke receipt. The previously built
legacy executable remains available in the private handoff.

## Resume order

1. Read the private companion `castle-design/CHECKPOINT.md`, review index and
   workflow journal alongside this checkout. They locate the saved world,
   immutable asset identities, candidate, evidence, host paths and source archive.
2. Obtain review of the stronger art direction and blueprints. Previous approval
   of the Chivalry direction does not approve these new images or reconstruction.
3. Review B3 for construction and gameplay coherence, then author the missing
   stair, landing, gallery and wall-opening modules in Kiln. Integrate through a
   fresh Holodeck proposal after checking the current accepted revision.
4. Resolve the terrain input contract, preserve all `.meta` GUID dependencies,
   and run `Tools/validate_render_settings.py` before a cross-host Editor job.
5. Observe the applied revision and inspect eye-level, tactical and approach
   views. Test actual body, camera, weapon and controller clearance; then build
   and re-run native gameplay checks against that exact candidate.
6. Add possession on one authoritative actor before increasing combat/crowd
   scope. Profile on a sufficiently quiet host; no capacity claim from these
   shared-load smoke runs.

Both hosts are shared. Admit one heavy job at a time through the established
castle job lock, require at least 4 GiB available memory, use bounded workers and
low priority, and never stop unrelated work. No job is intentionally queued by
this checkpoint. Read the project pipeline skill before continuing.

## Tracked findings

- [#26: render-settings GUID closure](https://github.com/instruktlabs/holodeck/issues/26)
- [#27: explicit no-collider serialization](https://github.com/instruktlabs/holodeck/issues/27)
- [#28: load-aware serial jobs](https://github.com/instruktlabs/holodeck/issues/28)
- [#29: evidence-based asset inventory](https://github.com/instruktlabs/holodeck/issues/29)
- [#30: terrain/floor ownership](https://github.com/instruktlabs/holodeck/issues/30)
- [#31: terrain appearance transfer](https://github.com/instruktlabs/holodeck/issues/31)

Local mitigations and staged geometry are not upstream fixes or closed issues.
The checkpoint commit is local only. Publishing, pushing, merging and deployment
remain separate actions.
