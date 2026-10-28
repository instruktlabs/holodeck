# Bolt rifle v1: No.4 Mk I* exterior candidate

Recorded 26 October 2026 local. One editable **art candidate** based on the museum-restored Savage No.4 Mk I* at Auckland Museum, object 776149 / accession 1983.50 / A7096. Its exact year remains unresolved: the institution catalogs 1943 and transcribes a 1942 body marking. Replacement furniture from the recorded 1991 restoration is part of this reference's appearance, not evidence of original factory condition. See the [pre-model dossier](firearm-bolt-v1-reference-dossier.md) and [museum record](https://www.aucklandmuseum.com/collection/object/776149).

This is original exterior game art, not a functional internal assembly or exact museum replica. It is a proposed WWII representative with no reconciled roster ID. The [collection production stages](firearm-collection-production.md) remain explicit: art candidacy does not imply integrated or production-qualified status.

## Delivery and costs

Use [firearm-bolt-v1-pins.json](../authoring/firearm-bolt-v1-pins.json) for the exact saved child revision in the workspace `project` collection, with source/GLB/preview paths and SHA-256 hashes. [The compact summary](../evidence/firearm-bolt-v1-summary.json) contains the inventory, evidence and limits. The earlier revision `r_2b86790049274a0aa42ced71d781edb4` is superseded by the child identified in those pins; do not select the collection's newest revision implicitly.

| Structural measure | Final candidate |
|---|---:|
| Triangles | 12,320 |
| Estimated primitive draws | 13 |
| Materials | 5 |
| Textures | 3 original procedural images |
| Decoded RGBA8 image bytes | 1,179,648 |
| Estimated image memory with mipmaps | 1,572,866 B |
| GLB bytes | 646,772 |

The model uses a 512² wood albedo and two 128² metal albedo/roughness-metalness images. Estimates are decoded image costs, not compressed runtime residency. Rounded longitudinal furniture, shaped exterior plates, real guard/sight openings, layered edges and restrained procedural finish variation establish the construction. No source photograph or historic stamp/serial is embedded in the asset.

Static surfaces are batched by material within their rigid owner. Draw estimates fell from 41 to 13 without changing the triangle count. All material-batch mesh names include their owner so the exported names are unique. The independently retained muzzle and interior-termination meshes remain directly inspectable. One candidate detail tier is supplied; no automatic LOD chain, Nanite setting or distance threshold is qualified.

## Frame and visual ownership

Metres, +X toward the muzzle, +Y up, +Z right. Origin is an authored receiver/display datum, not ground contact. The final envelope is approximately 1.13175 × 0.22329 × 0.09745 m, including the bolt handle and sling loops. The museum's overall-length entry was a scale sanity check; the model is not a dimensionally exact reconstruction.

| Owner | Intended adapter use |
|---|---|
| `Joint_BoltSlide` | Exterior bolt group, translation along the declared local X axis. |
| `Joint_BoltLift` | Child owning the bolt shell, handle and knob; visual lift rotation around X. |
| `Joint_Magazine` | Separate closed magazine exterior for future presentation. No feed or release mechanics included. |
| `Joint_Trigger` | Separate visible trigger. Hand contact and event timing remain unqualified. |
| `Joint_RearSight` | Separate two-leaf aperture-sight exterior. No sight calibration implied. |

The asset has 16 anchors plus those five rigid pivots. Exact rest matrices and metadata are in the pins. Static anchors cover `hand_right`, `hand_left`, `grip_primary`, `grip_support`, `sight_rear`, `sight_front`, `vfx_muzzle`, `interaction_bolt`, `interaction_magazine`, `interaction_trigger`, `interaction_select`, `support_butt`, and front/rear `accessory_sling` positions, all with the `anchor_` prefix. `anchor_bolt_hand` and `anchor_magazine_hand` are attached to the respective moving owners and follow their posed transforms.

These are visual assembly contracts, not evidence that a hand fits. The current pistol adapter cannot silently reuse its slide/magazine or grip assumptions. The game adapter owns selection collision proxies, animation state, commands, ammunition abstraction, aim/recoil, sound and VFX. Use the named muzzle-effect origin for presentation; it does not establish a physical accessory mount or calibrated bore/sight solution.

## Muzzle and contact review

The delivered muzzle has an actual annular mouth, modeled inner wall and a termination set back inside the visual cavity. No front-face disk fills the opening. The cavity proportions are artistic estimates because the reference set lacks a close frontal muzzle photograph. Passing the geometry test does not upgrade those estimates into historical measurements.

Actual frontal and oblique GPU renders show the changing interior wall and occlusion. A reproducible [triangle-ray check](../evidence/firearm-bolt-v1-verify.mjs) samples the mouth center and annular rim and confirms that the center first intersects a deeper surface. The result is in [geometry proof](../evidence/firearm-bolt-v1-geometry-proof.json). This is a visible game-mesh test, not a firearm engineering specification.

The saved-preview pass exposed a crescent-shaped gap between the front band and wood even though a minimum-distance query found contact elsewhere. The selected child refines that contour. This is an explicit example of why a zero-distance result cannot establish fit by itself.

Twelve selected rest-pose surface checks completed. Butt/trim, wrist join, guard, trigger, furniture, bands, magazine/receiver and sight-base interfaces show touching/intersecting surfaces. The bolt-shell/bridge pair has a positive gap after the bridge correction. These are unsigned surface distances, not attachment-strength or continuous-clearance certificates. They were measured before batching; the world geometry/normal/material-name comparison confirms the selected batched geometry matches that checked construction.

`Inspect_Bolt_Exterior` is a two-second **visual inspection clip**, sampled at phases 0, 0.17, 0.38, 0.55, 0.8 and 1. It demonstrates separate bolt lift and slide ownership with game-authored travel/timing. The sampled views show no obvious bolt/stock or bridge collision, and the final pose returns to rest. It is not a calibrated operating cycle, a reload implementation or a claim about continuous collision. No hand animation is included.

## Reference and attachment boundary

All 32 museum medium photographs were viewed individually before modeling; both sides, top/oblique, sight, buttplate, wood/metal joins and bolt-handle details were considered. The photographs are credited to Richard NG / Auckland Museum under the linked CC BY 4.0 terms in [the image manifest](../evidence/firearm-bolt-v1-reference-images.json). They stay in reference evidence, separate from the original procedural geometry and texture pixels.

The base configuration omits the museum web sling. Its two observed mounting locations receive visual anchors, but the runtime attachment allowlist is **empty** until a separately qualified sling asset/configuration is supplied. No modern optic rail, suppressor, laser, foregrip, pistol grip or generic interchangeable part is accepted. Era does not establish compatibility. The bayonet and any scope configuration would require their own exact-variant reference and fit work; they are not quietly included.

The dossier distinguishes recorded identity/materials from estimated cross-sections, installed magazine form, hidden surfaces, grain species, finish chemistry, wear and muzzle depth. No numerical recoil, accuracy, trajectory, timing, firing-effect or ammunition behavior is reference-qualified by this art pass. Follow [shot feedback fidelity](shot-feedback-fidelity.md) for that independent profile work.

## Qualification still required

Source, GLB and saved-preview hashes are verified, and the saved preview is material-faithful exact-artifact GPU evidence. The final source, animation and multi-view evidence all refer to the selected candidate; no generated concept is used as proof of the model. Structural export integrity passes, while visual realism and historical exactness remain review judgments.

This candidate still needs higher-resolution reference reconciliation, production surface polish/unique bake where useful, actual first-person and third-person hands/contact, complete inspect/reload/fire presentation, attachment fit, behavior profiles, target feedback, native/browser import and reimport, destination materials and owner acceptance. Default studio lighting shows depth, but a separately calibrated grazing-light/exposure fixture and destination close-up approval have not been completed. Do not call the candidate AAA, a perfect historical replica or production-ready.

PC and hub remain under load. Performance status is **DIRTY**; no FPS, GPU timing or large-catalog residency claim is made.

Review links: [final close views](../evidence/firearm-bolt-v1-final-close.png), [muzzle depth views](../evidence/firearm-bolt-v1-muzzle-final.png), [final inspection clip samples](../evidence/firearm-bolt-v1-final-motion.png). Exact saved preview and editable files are linked in the pins.
