# Hand contact, material continuity and forearm twist v5

Recorded 2026-10-26 local time. This is an optional workspace prototype, not a published Kiln extension or accepted AAA character.

## What changed

The right index was too long and straight. Its authored forward span is now 51 mm instead of 70 mm, with a relaxed bend toward the frame. This is a control-curve comparison, not an anatomical measurement of the whole finger. The complete exported asset's X extent shrank by 16.245 mm. The other right fingers wrap around the front of the grip instead of cutting through its corner. Both thumbs sit closer to the frame, and the support-hand reload grasp was refitted against the magazine's exported exterior.

Gloves and sleeves now use one original, seamless woven material rather than selecting atlas quadrants by triangle normal. Cylindrical UVs include seam unwrapping; the arbitrary triangular material boundaries are removed. Stretching at complicated finger junctions remains possible. This is not a production hand unwrap, stitching pass or leather-detail treatment.

Two twist helper bones per forearm distribute wrist axial rotation at 40% and 80%. They are elbow children, not ancestors of the wrist, preserving the three-joint IK chain and wrist orientation. Sleeves blend weights across the helpers. The authored clips, browser live solver and Unreal skeletal-control node use the same rest axes and fractions. The shared gameplay timeline and ammunition rules did not change.

## Saved source and delivery

- Collection `project`, asset `a_42eb15873bde4c8fad62f46d032f42d8`.
- Child revision `r_3c71036a6dca494cb96c201e926f49e3`, parent `r_b5687ad219644071a624f87caea713fb` (v4 ancestor `r_26582e5e86cb4dc2a449201ebdde43cb`).
- Program `p_9d2abe2f5417`; exact source [first-hands-v5-final3-exact.kiln.js](../authoring/first-hands-v5-final3-exact.kiln.js).
- Source SHA-256 `9d2abe2f54173739ec3c25de6f79d2d05dee22aeb115c3da954d099a76dd3f34`.
- GLB SHA-256 `e58e5838de305f9dbb75f813a0e2c36d12f52a13ddb5e85efeeb00a241d4c0d7`.
- Rig schema 3: 41 bones; all 37 previous identities retained. One skin, two meshes, one material, four clips. Both source and GLB hashes were compared with the immutable save before canonical promotion.
- 68,024 triangles versus 58,726 in v4, two source draw calls unchanged. The topology repair and contact shapes increased geometry; this is not an optimization win. Production retopology and LODs remain necessary.
- Original glove material pin: `weapon-v5-gloves` / `sha256:ec1b218ecd4ee562ce188ad98da8a24dc2f2ba7f239189535d07ddd032d5bd7c`; three 1K maps, approximately 16 MiB RGBA8 including mipmaps before compression.

The pistol now has an open exterior trigger well and a visibly attached trigger. The earlier frame occupied part of that opening; shortening the finger alone could not fix its firing contact. Only Mesh_Frame and Mesh_Trigger changed; 70 other meshes, all materials, the 72-part count and moving pivots were preserved. The new pistol revision is r_5dd04d19ed3d445f9cb2c9fa2cc00494, GLB SHA-256 9a707e472c77c308a9a34000921dc657687edee1cd8e9549a91ea9cb052d255a; 4,104 triangles (24 more). A second hand child makes the press shallower without changing hand geometry. The 21-phase distal-index probe found no frame/grip penetration; this does not prove perfect contact with the trigger face. Native import uses a fresh `/Game/Qualification/WeaponGenerated/first-hands-v5b-combined` namespace. Interchange combines by skeleton and imports the four actual animation sequences. Native material binding explicitly reconciles base color, normal and ORM textures. The 72 pistol parts and native grip overrides remain destination-owned.

## Evidence and limits

Twenty Node tests pass, including topology, normalized weights, historical joint identities, gameplay transitions, clip endpoints, twist weighting and axial extraction. The exact browser adapter passes 84 poses with a translated, rotated and scaled root and targets offset from the authored clips. Maximum wrist error is below 1e-12 m; this mathematical adapter test does not measure rendered visual fidelity. Baked clip sampling has a maximum wrist error of 0.210 mm.

Both gloves and both sleeves are closed connected surfaces with no boundary, degenerate or nonmanifold edges at the 1 micrometre weld tolerance used by the check. A previous draft produced one nonmanifold edge; changing the extraction spacing from 2.7 to 2.65 mm resolved it. That resolution belongs to this exact source revision, not every implicit surface.

The [contact report](../evidence/hands-v5-contact-measurements.json) evaluates actual skinned exported vertices assigned predominantly to distal joints. It measures the frame/grip at Ready and magazine at three reload phases. No sampled distal vertices penetrate those targets in the final candidate. Ready thumb gaps are approximately 0.49 mm right and 0.87 mm left; reload thumb gap is approximately 1.07–1.13 mm. This is a targeted sampled test, not whole-hand continuous collision certification or proof of ideal anatomy. It does not establish trigger-pad contact throughout Fire.

Unreal editor GPU run: **34/34 checks passed**, including live off-clip IK, fixed bone lengths, actual finger animation, forearm twist motion/distribution, interaction state and native material override preservation. [Result](../evidence/weapon-v5-final-editor-result.json). Native import exited normally. The final standalone WeaponLab package also passed **34/34 checks**. [Packaged result](../evidence/weapon-v5-final-packaged-result.json). Executable SHA-256: DAC5AA7AEACB6BF5542E9C715251C5DC7BF7CD84C0A7B215423D1EB802E5F97D. The package includes facility v5; the separate old RangeSliceLab package was not rebuilt.

Holodeck WebGPU: observed Ready, Fire at 25%, both inspect sides, reload withdrawal, and a live aim/fire/reload/inspect loop. Ammunition returned to 7/7, reserve to 27, with one shot/hit and charcoal grip retained. Final pinned assets also rendered in WebGL2 with fire/reload observed. The shorter finger reads better in side views, but rounded fingers, palm transitions, cuff structure and motion polish remain prototype quality.

**Performance qualification is deferred:** the owner reports both hub and PC under load. Frame rates, intervals, build times and startup times from this pass are not clean performance evidence. Source triangles, texture dimensions, hashes and correctness checks remain useful structural evidence.

## Reusable tools

- [Contact probe](../pipeline/measure-hand-contacts-v5.mjs): skin exported vertices, identify intended contact surfaces and report gaps/penetration. Extend with palm/knuckle and swept-time tests before a production gate.
- [Browser IK and twist adapter](../game/arm-ik-three-v5.mjs), [pure twist extraction](../game/forearm-twist.mjs), [rig data](../game/arm-rig-v5.json) and generated native rest axes.
- [Continuous glove material baker](../pipeline/bake-gloves-v5.mjs): editable, original procedural resource with exact pins; no reference-image pixels.
- [Native importer](../pipeline/reimport_weapon_v5.py): immutable source checks, isolated import namespace, combined skeleton, semantic clips and preserved weapon components.
- Pose review: append `&weaponReview=1` to the prototype URL. The optional clip selector, phase slider and side-view selector freeze presentation using the real exported clips and shared timeline. They do not consume ammo or change attachments. Choose **Live** to resume the gameplay state. This is an explicit authoring view, not part of the ordinary player interface.

The glTF exporter still reports zero-weight joint-slot warnings and skinned children below a root. Destination rendering and transformed-root tests are necessary; a successful source export alone is insufficient. Do not suppress these warnings as if resolved.

## Maker integration

Maker already has its own bones, skeleton and skinned meshes. It continues to drive the walkthrough body and procedural gait/emotes. The weapon extension receives camera/view/runtime state; it loads a separate hand skeleton and positions its viewmodel from the camera. No Maker bone mapping or third-person weapon posing is implemented. We have not replaced Maker's arms or given him a second visible full-body pair.

The next character step is a shared source character definition and an optional character adapter: consistent proportions and clothing, handedness, grip targets, state-to-pose mapping, first-person visibility and third-person posing. Detailed first-person hands and a cheaper full-body mesh can be separate delivery profiles of that identity. Qualify camera changes, equip/unequip, reach, clipping and animation transitions in both engines before claiming a unified character. Keep this engine-specific capability opt-in; the asset and gameplay contracts stay engine-neutral.

## Parallel art batch

Three Astra/high lanes produced three revised facility modules, four complementary props and three Winchester 1866 exterior variants including a display LOD. The [review board](../evidence/parallel-asset-review.html) includes the preferred concept, references, immutable revisions and costs. Parent reviewed the rendered sheets. They remain art prototypes, not visual approval.

Facility v5 was imported into both native maps with the same 23 components, pivots, collision and material interfaces. Fresh-process readback passed; the range fixture passed 14/14 checks. Old generated material dependencies and authored override bytes were preserved. The new rifle and four props remain authored candidates; no claim of fitted hands, gameplay integration or engine qualification is made for them. The lower-detail rifle is static and cannot substitute for an animated lever assembly. Texture sharing is not automatic across embedded GLBs.


## Range and firearm requirements recorded during review

The live Bible was updated through supported proposal/apply to revision 6, changing only intent/rules and preserving scene, references, asset pins and origin. [Target/lane/string/retrieval design](range-targets-and-shot-review.md) and [shot-feedback fidelity](shot-feedback-fidelity.md) distinguish existing plans and current counters from unimplemented systems. Each gun/configuration/ammunition combination needs an explicit versioned profile with field-level evidence; shared values require justification. [Hero geometry requirements](hero-firearm-geometry-requirements.md) covers genuinely recessed muzzle openings. Both current firearm prototypes still use dark closed geometry at the muzzle; neither is qualified as hollow.

