# Hero firearm exterior geometry requirements

Recorded 2026-10-26. Upcoming art acceptance requirements for close inspection in Firearms Through Time. This document does not implement or approve an asset revision. The current v5 qualification work remains separate; no asset or engine edits were made for this requirement pass.

The user requires high visual realism, including barrels that visibly open rather than end in closed blocks. The requirement is for convincing exterior game geometry and visible interior depth. It does not require a functional through-bore, engineering internals, manufacturing dimensions or a working mechanism.

## Current truth

| Asset | Evidence and current limitation | Status |
|---|---|---|
| Model 1866 sporting exterior v1, satin/aged/display LOD1 | Exact saved sources at lines 69–76 construct an octagonal barrel cylinder and two short black cylinders at/forward of the end face. No opening is cut and no interior wall is modeled. The name `Muzzle_Recess` does not establish a recess. See [asset record](next-firearm-v1.md) and [immutable pins](../authoring/next-firearm-v1-pins.json). | Dark stepped placeholder; fails the new open-mouth/depth requirement. |
| Current 1911-style pistol | Parent inspected the current saved source `first-pistol-v5-final-exact.kiln.js`, revision `r_5dd04d19ed3d445f9cb2c9fa2cc00494`: a torus rim plus a dark `CircleGeometry` sits at the muzzle. The trigger-well revision did not change it. | Confirmed flat-disk placeholder; fails the open-mouth/depth requirement. |

Do not label a dark disk, painted hole, normal-map suggestion or rim surrounding a flush cap “hollow.” A short modeled cavity may terminate out of view: that is a blind visual cavity with genuine visible setback, not a functional bore. State which construction was actually delivered.

## Visible muzzle construction

For each exact weapon/configuration, use its exterior reference dossier to establish the visible outline and mouth/rim character. Record missing muzzle references rather than extrapolating from an unrelated model, modern reproduction or era. The Model 1866 museum image used for the main sporting silhouette crops the muzzle, so additional configuration-appropriate close reference is required for a historically qualified muzzle treatment.

The hero mesh must have an actual opening in the front surface, an outer-to-inner rim transition, and interior wall geometry that recedes behind that opening. No unremoved end cap may fill the opening. The interior must reveal parallax and occlusion as the camera moves off axis; a uniformly black center alone is insufficient evidence. A recessed termination can bound the game asset beyond the intended visible depth. Any invented depth or small bevel treatment is labeled artistic interpretation.

Rim and interior shading must respond coherently to light. Use clean winding/normals, intentional hard edges and smooth transitions, without inverted faces, smoothing across a deliberate corner, overlapping coplanar caps, z-fighting or light leaks. Darker material and ambient shading may support depth but cannot replace geometry. Double-sided material is not a substitute for a correctly modeled visible wall. Inspect the exported mesh as well as the authored source.

## Major visible parts and contact

Preserve the reference-supported silhouette of the stock/grip, receiver/frame, slide or other moving exterior, barrel, sights, trigger and guard/lever. Give major exposed transitions enough shape and edge treatment to catch light at the intended screen size. Avoid intersecting blocks that hide a required opening or create false seams.

Check wood/metal and grip/frame interfaces from both sides and oblique views. Intended joins may touch; decorative embedment must not obscure the silhouette. The visible trigger well must remain open where reference and pose require it. Review actual finger contact, support-hand placement and moving-part clearance through the authored animation phases. Anchor existence and a zero-distance static contact check do not prove correct fit or moving clearance.

Keep stable named hand, grip, sight, muzzle-effect and interaction anchors with explicit units and frame. Save any anchor change as a versioned contract change. Viewmodel effects must originate from the exported muzzle anchor after adapter transforms; a new mesh mouth cannot silently leave the effect floating inside a face or outside the rim. Gameplay rays, recoil, scoring and animation timing remain adapter responsibilities described in [shot feedback fidelity](shot-feedback-fidelity.md).

## LOD and optimization

Hero LOD0 must retain the visible opening, rim and cavity at close inspection distance. Simplified LODs must preserve the muzzle silhouette and readable depth while the opening remains resolvable at their intended screen size. Reduce unseen detail and tessellation before removing the cavity. A distant approximation is only acceptable after a documented screen-size transition review; it must not produce a popping filled-in mouth or become selectable for close inspection.

Review each exported LOD, not just LOD0. Preserve anchor frames and required moving-part identities; a static material-batched display LOD is not an animation substitute. Record triangles, primitives/draw estimate, materials and texture memory per revision, with actual scene costs qualified separately. Both machines are under load, so performance remains **DIRTY** and no FPS/timing claim follows from structural savings.

## Required review evidence

Every gate below is pending until a new exact saved revision is inspected.

| Gate | Required evidence |
|---|---|
| Actual depth | Saved-GLB topology/section or inspection evidence showing removed front cap, rim, interior wall and setback; no engineering specification is needed. |
| Multi-angle readability | Actual GPU renders from near frontal, left/right oblique and profile views, including a short off-axis camera move or matching angle sequence that reveals parallax. |
| Light response | Neutral exposure plus a side/grazing-light view, showing the rim highlight, inner-wall shading and occlusion without crushing the center to black. Record light/camera settings and material fidelity. |
| Surface quality | Close renders of major part transitions, clean normals and no false gaps, intersections, z-fighting or light leaks. |
| Pose/contact | Actual hand/weapon assembly at rest, aim and relevant fire/cycle/recovery phases; visible trigger contact and moving-part clearance. |
| LOD continuity | Matching framing at proposed transition screen sizes for every LOD, with opening/silhouette/depth retained and no obvious popping. |
| Export/destination | Exact source/GLB hashes, immutable revision, anchor contract and saved-render fidelity; subsequent browser/native assembly captures before claiming integrated parity. |

Passing these gates establishes the specified visible construction and review evidence. Historical likeness, material quality and owner acceptance remain separate judgments; neither a dark center nor a structural QA pass establishes high realism by itself.
