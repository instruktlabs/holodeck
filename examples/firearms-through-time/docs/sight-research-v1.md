# Sight research v1: iron sights and first-person aim

Recorded 27 October 2026 local. This is a research and planning record. No asset, game, native or pipeline file was changed. It covers the five current firearms: the 1911-style pistol, the Model 1866 sporting rifle, the No.4 Mk I* (Savage), the Pattern 1742 musket and the Colt M4 R0977 carry-handle carbine. Source IDs such as **[S13]** refer to [the source list](../evidence/sight-research-v1-sources.json).

Every value carries one of these labels:

- **Documented**: stated by a cited manual, museum or manufacturer source.
- **Derived**: calculated from documented values. The working is shown.
- **Estimate**: anatomy, collector consensus or reasoning that no source in this pass confirmed.
- **Model**: measured from the saved Kiln source or pins.
- **Target**: a proposed game value. It is not a measurement.

## 1. Summary

| Gun | Real sight system | Biggest problem in the current aim | Recommended eye to rear sight |
|---|---|---|---|
| 1911-style pistol | Small open notch and low blade (GI). Front sight sharp; centre-mass hold in service doctrine. | Eye is 0.351 m behind the rear sight, which is closer than an extended two-hand hold. The model notch is 12 mm wide around a 4 mm blade, which leaves very wide light bars. The front blade top sits 1.5 mm below the rear top. | **0.55 m** (Target; real range is about 0.55 to 0.70 m) |
| Model 1866 rifle | Open folding-leaf sporting rear sight with a notch, mounted on the barrel. Dovetailed sporting front blade, often nickel-silver. | The camera is 0.69 m behind the rear sight, which puts it 77 mm **behind the buttplate**. The rear sight is a notchless slab. | **0.30 m** (Derived/Estimate) |
| No.4 Mk I* | Receiver-mounted aperture rear sight; this specimen has the two-position flip sight. Protected blade front. Front sight tip on or just under the point of aim. | The camera is 0.464 m behind the aperture and 76 mm **behind the buttplate**. A 6.2 mm hole at that distance subtends 0.77° (about 12 px at 1080p) with a crisp rim. That is the "thick pinhole" the owner saw. | **0.10 m** (Estimate; range 0.08 to 0.12) |
| Pattern 1742 musket | No rear sight. The bayonet stud near the muzzle doubles as the front sight. The 1764 drill has the soldier look along the barrel from breech to muzzle. | No view profile exists yet. The rear anchor floats 3 mm above the tang, and the front anchor is 3 mm above the stud top. | **0.22 m behind the breech** (Estimate) |
| Colt M4 carry handle | Dual flip aperture (about 0.070 in and 0.200 in) and a protected front post. Front sight post tip goes in the centre of the aperture with focus on the post; centre-mass hold. | No view profile exists yet. Model sight radius is 434 mm against about 368 mm documented. The sight line is 117 mm above the bore axis. There is a single 6.6 mm torus with no flip leaf or second aperture. | **0.07 m** (Derived/Estimate; range 0.05 to 0.09) |

**No.4 verdict:** an aperture rear sight is correct for this rifle. The flaw is presentation, not the presence of a peep. The eye is about 4.5 times too far from the aperture. A pinhole camera also draws the rim sharp, when a real eye sees it as a blurred, translucent ring. Moving the eye to about 0.10 m and applying an analytic ghost-ring treatment to the rear leaf should fix the look. Section 4.4 has the numbers.

## 2. How the current aim works (Model)

- `weapon-extension.jsx` line 73 places the weapon root at `camera + lerp(hipPosition, aimPosition)`, followed by recoil offsets, in camera space. The asset is then rotated by `assetForwardRotationY = π/2`, so asset +X maps to camera −Z. An asset point at `x` lands at camera depth `aimPosition.z − x`.
- The Holodeck world canvas sets `fov: 63` (three.js vertical), `near: .05` (`holodeck/src/world/app.jsx` line 190). Nothing changes FOV or near plane when aiming. At 1080p this gives about 15.4 px per degree at screen centre.
- Both rifle view files use `aimPosition.z = −0.58`. That value was carried from one rifle to the next; it was not derived from either rifle's stock geometry.
- `game/rifle-delivery.test.mjs` and `game/bolt-no4-delivery.test.mjs` assert that both sight anchors lie on the view axis in front of the camera. They do not check how far the eye is from the rear sight, or where it sits relative to the buttplate. That gap is how the 0.46 m and 0.69 m distances got through.

| Gun | Sight radius (Model) | Eye to rear sight now | Buttplate relative to eye now | Sight line above bore axis (Model) |
|---|---:|---:|---:|---:|
| Pistol | 180 mm | 0.351 m | n/a | 28 mm (sight line 0.077, muzzle-effect origin 0.049) |
| 1866 | 458 mm | 0.690 m | 77 mm **in front of** the eye | 27 mm |
| No.4 | 694 mm | 0.464 m | 76 mm **in front of** the eye | 42 mm (bore 0.110, blade tip 0.152) |
| Pattern 1742 | 1204 mm (abstract) | none | none | 21 mm above the axis (barrel top at the breech is 18 mm) |
| M4 | 434 mm | none | none | 117 mm (bore 0.080, aperture 0.197) |

For a shoulder arm, the eye must sit forward of the buttplate: the butt is in the shoulder pocket and the cheek rests on the comb. Both integrated rifles currently put the eye behind the buttplate. Seen from the eye, the gun is therefore pushed about 0.35 to 0.4 m too far forward.

## 3. What a real eye sees, and why a pinhole camera gets apertures wrong

**Focus.** Both US manuals tell the shooter to focus on the front sight, so the rear sight and the target blur. FM 3-22.9 para 4-5b(2) covers the rifle **[S1]**; FM 3-23.35 para 2-2b covers the pistol **[S6]**. FM 3-22.9 4-5b(2) adds that the eye tends to centre objects in a circle and seeks the brightest point, which makes aperture alignment largely automatic **[S1]**. The NRA primer says the same about apertures and ghost rings **[S28]**.

**Aperture vignetting (Derived from geometric optics).** A rendered camera is a pinhole, so it shows a hard-edged hole of angular diameter `a/d`, where `a` is the aperture diameter and `d` the eye distance. A real eye has a pupil of roughly 3 to 5 mm (Estimate) and is focused far beyond the leaf. The result:

- **Clear core:** fully clear within about `(a − p)/d`, where `p` is the pupil diameter.
- **Ring:** fades through a soft ring to fully blocked at about `(a + p)/d`.
- **Small apertures:** when `a < p`, there is no fully clear core. The aperture becomes the eye's effective stop, so the whole field stays visible but dimmer. The patent background notes that the small M16A2/M4 aperture admits less light and acts as a pinhole that improves depth of field **[S3]**.

| Case | Pinhole render | Real view, 3 mm pupil | Real view, 5 mm pupil |
|---|---:|---|---|
| No.4, 6.2 mm (Model) at 0.464 m (now) | 0.77° hard edge | 0.4° clear core, fading out to 1.1° | 0.15° clear core, fading out to 1.4° |
| No.4, 6.2 mm at 0.10 m (Target) | 3.55° hard edge | 1.8° clear, fading out to 5.3° | 0.7° clear, fading out to 6.4° |
| M4 large, 0.200 in at 0.07 m | 4.2° | 1.7° clear, fading out to 6.6° | fading from the centre out to 8.3° |
| M4 small, 0.070 in at 0.07 m | 1.5° | no hard edge; dim field to 3.9° | dim field to 5.6° |

The owner's complaint follows directly. At 0.46 m the pinhole render shows a crisp 12 px hole in a 38 px leaf and 106 px of protective shoulders, all in sharp focus. A real shooter sees a much larger, soft-edged window with a grey halo.

**Open notch sights (pistol, 1866).** The front blade is sharp and the notch is soft. Correct alignment centres the blade in the notch with its top level with the rear sight's top, leaving equal light on each side. FM 3-23.35 2-2a defines this for the pistol **[S6]**. BYSA describes the SMLE (open notch) in the same terms **[S13]**.

## 4. Per-gun findings

### 4.1 1911-style pistol (integration prototype; identity reference US Navy M1911A1 [S10])

**Real system**

- **Rear sight:** a small fixed open notch, dovetailed into the slide and set forward of its rear face. **[S7]** (Documented, qualitative.)
- **Front sight:** a small, low half-moon blade. The M1911A1 widened the front sight relative to the M1911. **[S7]**, **[S8]** (secondary, citing Poyer 2008).
- **Notch and blade sizes:** no GI dimension was found in this pass. Treat any figure as an Estimate until it is measured from reference photography.
- **Sight radius:** about 6.4 in (163 mm) on a modern Springfield Mil-Spec 1911A1 reproduction **[S9]** (secondary, from a search snippet). The common "6.5 in" figure was not confirmed.
- **Eye distance:** FM 3-23.35 has the firer extend the firing arm with elbow and wrist locked **[S6]**. SSAA puts the front sight about 1000 mm from the eye for a one-arm, arm's-length hold **[S11]**. A forum source gives about 24 in (0.61 m) to the rear sight **[S12]**. For a two-hand extended hold, 0.55 to 0.70 m to the rear sight is the Estimate.
- **Use:** front sight in sharp focus, centred in the notch with tops level. FM 3-23.35 2-2b puts the sight picture at the target's centre of mass and stresses alignment over placement **[S6]**. A 6 o'clock hold is a bullseye-target convention, not service doctrine; it is not sourced here and is not recommended for the range game.

**Model vs real**

| Item | Model | Real | Flag |
|---|---|---|---|
| Rear | Two separate 6 × 7 mm posts with a 12 mm gap; the slide top forms the notch floor | Small notch | Notch is 3 times the blade width, with very wide light bars. This reads like a modern wide-notch sight scaled up, not GI. |
| Front | 4 mm wide, 6 mm tall box; top at y 0.074 | Small low half-moon | Too square and wide for GI. Top is 1.5 mm below the rear top (0.0755), so it fails the tops-level rule. |
| Sight radius | 180 mm | about 163 mm (secondary) | About 10% long. Low priority. |
| Anchors | Only `Joint_Sight` at y 0.077; no rear/front anchor pair | none | The line runs 1.5 to 3 mm above both tops. Add the standard anchor pair. |
| Eye | 0.351 m | 0.55 to 0.70 m | Too close, so the pistol fills too much of the screen. |

**Presentation recommendation**

- **Eye distance:** 0.55 m (Target). This is a mild deviation toward readability from about 0.60 to 0.65 m. Going beyond 0.42 m needs arm-rig reach to be confirmed, because the hands follow the gun.
- **Aim FOV:** 52° vertical.
- **Rear sight treatment:** no ghost-ring treatment. An optional slight near-field softening of the rear sight is acceptable but not required.
- **Geometry:** rebuild the sights to GI-like proportions, with blade-to-notch width around 0.7 to 0.85 (Target, because no documented ratio was found). Make the front top level with the rear top.

### 4.2 Model 1866 sporting rifle (authored sporting-form interpretation; identity in `next-firearm-v1.md`)

**Real system**

- **Rear:** Model 1866 rifles carried a barrel-dovetailed folding-leaf open rear sight. Collector catalogues describe Henry-style and later sporting leaves, some with graduated centre notches. Examples are Rock Island Auction lot descriptions **[S23]** (search snippets; the pages returned 403 to direct fetch), the Winchester Collectors Association forum **[S24]** and a Bonhams lot with a ladder rear sight **[S25]**. Buckhorn rear sights appear on some rifles, including one factory-lettered example **[S23]**. Treat the exact leaf as specimen-specific.
- **Front:** a dovetailed sporting front sight with an iron, steel or nickel-silver blade **[S23]**. Bonhams describes a brass blade **[S25]**.
- **Sizes:** no documented notch or blade dimension was found. Both are Estimates.
- **Sight radius:** no documented figure was found. A 24 in barrel with the rear sight a few inches ahead of the receiver is consistent with the model's 458 mm (Estimate).
- **Eye distance (Estimate):** the rear sight is on the barrel, well forward of the receiver. A cheek on the comb puts the eye roughly over the wrist, about 0.28 to 0.33 m behind the rear sight. That is about 0.30 m forward of the crescent buttplate on this model.
- **Use:** front blade sharp and centred in the notch, with its top level with the notch shoulders; a fine bead or blade hold on the target. Open-sight technique is the same as FM 3-23.35 2-2a **[S6]** and BYSA's SMLE notch guidance **[S13]**.

**Model vs real**

| Item | Model | Flag |
|---|---|---|
| Rear | A plain 6 × 9 × 18 mm rounded block on a 48 mm base, top at 0.1995 | **No notch.** It is a flat bar. Add a folding leaf with a V or U notch, and use the leaf body for the shoulders. |
| Front | A 2 mm thick trapezoid blade, top at y 0.198, on a 14 mm base | Plausible. The anchor at 0.200 is 2 mm above the blade top. Put the anchor on the blade tip. |
| Eye | 0.69 m from the rear sight; camera 77 mm behind the buttplate | Far too far back. |

**Presentation recommendation**

- **Eye distance:** 0.30 m.
- **Aim FOV:** 45° vertical.
- **Rear sight treatment:** no ghost-ring treatment, because an open notch is not an aperture.
- **Front blade:** at 0.76 m the 2 mm blade is about 2.3 px at 63° and 3.4 px at 45° (1080p), which is acceptable.

### 4.3 Pattern 1742 Land Service musket (Colonial Williamsburg 1982-9 identity [S22])

**Real system**

- **Rear:** none. American Rifleman states the Brown Bess had no rear sight **[S19]**. Museums Victoria records a block front sight and no rear sight on a Land Pattern musket **[S21]** (search snippet).
- **Front:** a rectangular stud behind the muzzle that held the socket bayonet and also served as an aiming guide **[S19]**.
- **Sizes:** none documented.
- **Sight radius:** none in the strict sense. The breech-to-stud line is about the 46 in Long Land barrel length **[S19]**, which the model matches (barrel 1.155 m).
- **Eye distance (Estimate):** the 1764 Manual Exercise *Present* has the butt raised to the shoulder, the cheek close to the butt, the left eye shut and the head kept up. The soldier looks along the barrel from the breech pin to the muzzle **[S20]**. That puts the eye roughly 0.20 to 0.25 m behind the breech. The 1764 manual postdates the 1742 pattern; it is the nearest primary drill text found.
- **Use:** level and point. American Rifleman describes volley fire at about 50 to 60 yards and unreliable hits on a man-sized target beyond about 60 yards **[S19]**.

**Model vs real**

- **Rear anchor:** `anchor_sight_rear` (-0.10, 0.021) is honestly flagged `physicalRearSight: false`. It floats 3 mm above the barrel-top line and sits on the tang rather than at the breech.
- **Front anchor:** `anchor_sight_front` is 3 mm above the stud top, which is at y 0.018.
- **Fix:** put the rear reference on the barrel top over the breech plug (about x 0.0 to 0.02, y 0.018) and the front anchor on the stud top (y 0.018). The current line passes over the stud, so the eye would see the stud slightly below the aim point.

**Presentation recommendation**

- **Eye distance:** 0.22 m behind the breech.
- **Aim FOV:** 55° vertical (gentle).
- **Rear sight treatment:** no ghost ring and no invented rear sight.
- **Sight picture:** the barrel's top line plus the stud is the whole picture. Keep the barrel top readable with a small specular highlight; that is a lighting choice, not new geometry.
- **Reticle:** do not add one by default. Accuracy belongs to the behaviour profile; the sight should not imply precision the musket never had.

### 4.4 No.4 Mk I* (Savage; Auckland Museum 776149 [S18])

**Real system**

- **Rear:** an aperture backsight on the receiver bridge. Moving it from the barrel (SMLE) to the rear of the receiver lengthened the sight radius **[S13]**, **[S16]**. Variants **[S15]**, **[S16]**, **[S17]**, **[S13]**:
  - Mk 1: a milled ladder from 200 to 1300 yd, with a larger "battle" aperture when folded at about 300 yd.
  - Mk 2: a wartime L-shaped flip sight with two holes, 300 yd and 600 yd. BYSA says to use the 300 yd hole up to 400 yd **[S13]**.
  - Mk 3 and Mk 4: stamped sights.

  The dossier's museum images show a two-position aperture sight, which matches the Mk 2 pattern.
- **Front:** a protected blade with interchangeable blade heights. Blades step in 0.015 in increments, and the size 0 blade tip sits exactly 1.000 in (25.4 mm) above the bore centre **[S13]**, **[S14]**.
- **Front blade width (Derived):** REME zeroing data equate one blade width to 6 in at 100 yd and 1.5 in at 25 yd **[S14]**. With the 28.74 in sight radius, the width is 28.74 × 6/3600 ≈ **0.048 in (1.2 mm)**. Both ranges give the same value.
- **Aperture diameters:** not documented in any source reached. The model's 6.2 mm is an Estimate. BYSA says only that the battle aperture is the larger hole **[S13]**.
- **Sight radius:** mean **28.74 in (730 mm)**, Documented **[S14]**.
- **Eye distance (Estimate):** the aperture sits on the receiver bridge just ahead of the cocking piece. A natural cheek weld keeps the nose behind the cocking piece, which puts the eye about 80 to 120 mm behind the aperture. No source in this pass states the figure. Confirm it with a hands-and-stock pose review.
- **Use:** look through the aperture with focus on the foresight. Put the foresight tip in the middle of the aperture, then hold the tip just under the point of aim so the target stays visible ("lollipop on a stick") **[S13]**. That is a 6 o'clock-style hold. For the game's range targets, use the tip on or just under the aim point.

**Model vs real**

| Item | Model | Real | Flag |
|---|---|---|---|
| Rear type | Two-position flip leaf; 6.2 mm hole; 20 × 30 × 3 mm leaf; 28 mm protective shoulders | Mk 2 two-hole flip sight | Type is correct. Hole size is unverified (Estimate). |
| Sight radius | 694 mm | 730 mm | 5% short. Acceptable for now. |
| Front blade width | 3 mm | about 1.2 mm (Derived) | 2.5 times too wide. It currently reads well only because the eye is far away. |
| Sight height over bore | 42 mm | about 25 mm (size 0 blade) | About 16 mm too tall. The tall line raises the sights in the aim view and hides less of the receiver than the real rifle would. |
| Eye | 0.464 m; camera 76 mm behind the buttplate | about 0.10 m | **Wrong.** This causes the "thick pinhole". |

**Presentation recommendation**

- **Eye distance:** 0.10 m (eye at x about −0.216, about 0.29 m forward of the buttplate).
- **Aim FOV:** 45° vertical.
- **Ghost ring:** apply the analytic treatment from section 5.3 with a 4 mm pupil.
- **Near plane:** the cocking piece and bolt shroud lie within 0.05 m of the eye, so the aim view needs a near plane of 0.01 m or a separate weapon pass (section 5.4).
- **Expected screen coverage at 45° and 1080p:** pinhole 81 px (3.55°), soft window to about 120 px (5.3°), leaf about 260 px. The shoulders span 68% of screen height, but they sit below the line and blur.
- **Front blade:** at its real 1.2 mm width the blade would be 2.0 px, which is below the 2.5 px readability floor (section 5.5).

### 4.5 Colt M4 R0977 carry-handle carbine (2024 Colt catalogue configuration [S5])

**Real system**

- **Rear:** a dual flip aperture in the carry handle. A smaller aperture of about 0.070 in (1.8 mm) is for range beyond 200 m. A larger aperture of about 0.2 in (5.1 mm) is for under 200 m, a wider field of view and low light **[S3]**. FM 3-22.9 sets the unmarked aperture up and the 0-200 m aperture down **[S1]**. The removable-handle sight adjusts from 300 to 600 m.
- **Front:** a protected square post on the front sight base. No post width was confirmed in this pass.
- **Sight radius:** about 14.5 in (368 mm) **[S4]** (secondary, Magpul listing, from a search snippet).
- **Sight height over bore:** commonly quoted at about 2.5 to 2.6 in (Estimate; not verified).
- **Eye distance (Derived/Estimate):** FM 3-22.9 4-5a(6) uses nose contact with the charging handle as the stock-weld cue and says proper eye relief comes from a good cheek-to-stock weld **[S1]**. With the nose at the charging handle, the eye is about 50 to 90 mm behind the aperture.
- **Use:** tip of the front sight post in the centre of the rear aperture, focus on the post tip, centre-mass aiming point at 300 m **[S1]**.

**Model vs real**

| Item | Model | Real | Flag |
|---|---|---|---|
| Rear | A single bare torus, 6.6 mm inner diameter, 12.6 mm outer; no leaf, no second aperture, no ears | Two apertures on a flip leaf with protective ears | Wrong form for a ghost-ring look; too large for either aperture. |
| Front post | 3 × 22 × 3 mm; top at y 0.199 | Square post | The anchor is 2 mm below the post top. Put the anchor on the tip. |
| Sight radius | 434 mm | about 368 mm | **18% long.** Either the front sight base is too far forward or the handle is too far back. Reconcile against the catalogue side view. |
| Sight height | 117 mm above the bore | about 65 mm (Estimate) | Looks about 1.8 times too tall. Verify before changing. |

**Presentation recommendation**

- **Eye distance:** 0.07 m.
- **Aim FOV:** 45° vertical.
- **Ghost ring:** yes. Default to the large aperture (range targets are well within 200 m), with the small aperture as an option.
- **Near plane:** 0.01 m in aim.
- **Prerequisite:** do these geometry fixes before integration.

## 5. Presentation guidance across the guns

### 5.1 Eye distance (Target values, all labelled)

| Gun | Eye to rear reference | Basis |
|---|---:|---|
| Pistol | 0.55 m | Documented locked-arm hold [S6]; Estimate 0.55 to 0.70 m; shortened slightly for readability. |
| 1866 | 0.30 m | Estimate from barrel-mounted rear sight and cheek on comb. |
| No.4 | 0.10 m | Estimate from receiver-bridge aperture and cocking-piece clearance. |
| Pattern 1742 | 0.22 m behind the breech | 1764 drill: look along the barrel from the breech pin [S20]. |
| M4 | 0.07 m | Nose-to-charging-handle cue [S1]. |

These replace the copied −0.58 m camera offset. Section 6.2 shows how to derive each value from an eye anchor.

### 5.2 FOV during aim

- **Today:** 63° vertical, unchanged when aiming.
- **True scale:** a 27 in 16:9 monitor at 0.65 m subtends about 29° vertical (Derived). Getting real angular size would need about a 2.2× zoom.
- **Precedent:** games zoom on ADS. Arma Reforger's "focus" zooms while aiming down iron sights, defaults to 50% intensity and has a slider **[S29]**. Battlefield exposes an "ADS Field of View" option that changes ADS zoom behaviour **[S32]** (player forum).
- **Recommendation (deliberate gameplay deviation):** narrow the FOV to a per-gun `aimFovDeg`:

  | Gun | Aim vertical FOV | Magnification vs 63° |
  |---|---:|---:|
  | Rifles | 45° | about 1.5× |
  | Pistol | 52° | about 1.25× |
  | Musket | 55° | about 1.15× |

  Blend the FOV with the same `aimBlend` used for position. Offer an optional "true scale" setting computed from the player's screen size and viewing distance. It should not be the default, because 29° feels like a scope to most players.
- **Keep one FOV in aim.** The weapon and the world must share the same FOV during aim. Different FOVs keep alignment at screen centre but change how much target the front post covers. That breaks the post-width relationship that matters for a historical range. A separate weapon FOV, as in the Bevy view-model pattern **[S34]**, is acceptable at the hip.

### 5.3 Ghost-ring treatment

| Option | Accurate? | Reads well? | Cost and risk |
|---|---|---|---|
| A. None; hard pinhole (current) | No. Rim is sharp, window too small. | Poor at close eye distance; this is the owner's complaint. | None. |
| B. Screen-space depth-of-field on the near field | Closest to optics | Good, if the blur is tuned | Expensive; depth-discontinuity halos where a 0.1 m object fills the screen. Squad's 6.0 depth of field drew complaints about scopes and long range **[S31]**. A Reforger sight mod had to move the eye back because the "nearby depth of field" made the rear sight too blurry **[S30]**. |
| **C. Analytic aperture vignette (recommended)** | Matches the pupil-convolved window from section 3 to first order | Good and deterministic | Cheap; no post pass. Same result on WebGPU and forced WebGL2. |
| D. Fade the rear leaf's opacity | Partly. Keeps the window and loses the ring cue. | Fair | Cheap, but the ring can vanish entirely. |

**Option C in detail.** When the aim blend is above about 0.5, render only the rear-sight meshes with a node material:

- **Base colour:** keep the leaf's base colour.
- **Opacity:** opacity = `smoothstep(θcore, θouter, θ)`, where `θ` is the angle between the fragment's view ray and the sight axis, `θcore = (a − p)/2d` and `θouter = (a + p)/2d` (half-angles).
- **Pupil:** default `p` = 4 mm (Target).
- **Darkening:** add a slight grey darkening of the leaf outside `θouter` so it reads as an out-of-focus mass rather than a crisp part.
- **Small apertures:** where `a < p` (M4 small), the window has no clear core. Apply a uniform brightness scale of about `(a/p)²` inside `θouter`, clamped to a floor of about 0.35 (Target) so it stays playable.
- **Other parts:** the front post and target stay sharp. Keeping the target sharp is a deliberate deviation: doctrine puts focus on the post and the target blurs **[S1]**, **[S6]**. Blurring the target in a range-scoring game hides the very information the player is scored on. An optional "front-focus" setting could apply a light far blur later.

For open notch sights (pistol, 1866), the rear notch is close enough that leaving it sharp reads fine. Do not apply option C there.

### 5.4 Near plane

With the eye at 0.07 to 0.10 m from a receiver sight, parts behind the aperture fall inside 0.05 m and get clipped:

- No.4 cocking piece
- M4 charging handle
- M4 carry-handle rear

**Option 1:** lower the near plane to 0.01 m during aim, using the same blend. Check depth precision on WebGPU and forced WebGL2 at the 100 m target.

**Option 2:** render the weapon in its own pass with near 0.005 m, keeping the same FOV in aim.

Either option is a Holodeck host change (`src/world/app.jsx` / extension host), which needs authorisation.

### 5.5 Front sight readability

- **No.4 front blade at real width (1.2 mm at 0.79 m):**

  | Aim vertical FOV | 1080p | 1440p |
  |---|---:|---:|
  | 63° | 1.3 px | 1.8 px |
  | 45° | 2.0 px | 2.7 px |

- **Floor (Target):** a minimum apparent front-sight width of 2.5 px at 1080p in aim, to avoid shimmer and sub-pixel aliasing.
- **Recommendation:** author the documented width in the asset. Let the presentation layer apply an aim-time lateral scale to `Joint_FrontSight` (or a sight-picture variant) only when the computed width falls below the floor. Record it as a presentation deviation in the view profile.
- **Do not leave the 3 mm blade in the asset.** That would make the historical record wrong to fix a rendering limit.

### 5.6 What simulators and realistic shooters do

- **Military trainers.** EST II is a laser-based indoor trainer that displays targets on a screen 26 ft from the firer, who uses a weapon simulator **[S35]** (search snippet). The firer uses physical sights, so a rendered sight picture is a game-only problem with no simulator standard to copy.
- **Arma Reforger.** ADS "focus" zoom on iron sights, adjustable and 50% by default **[S29]**, plus a "nearby depth of field" option that blurs the rear sight. At least one community sight mod moved its eye point back to tame that blur **[S30]**. This is the same eye-distance versus blur trade-off this document resolves analytically.
- **Squad.** The 6.0 update (September 2023) added depth of field that players report affecting sights and scopes. Feedback split between realism and long-range usability **[S31]** (player threads; no official note was found).
- **Battlefield V/1.** "ADS Field of View" and "ADS DOF Effects" are user options **[S32]** (player forum).
- **Apex Legends.** The developers changed sight geometry to remove unintended blind spots and keep sight function independent of cosmetics **[S33]**. A high-profile shooter treats screen occlusion by sight geometry as a tuning target.
- **Squad 44.** Players asked the developers to correct the No.4 battle-sight zero to about 300 yd **[S36]**. Historical-shooter players notice sight details.

Sources for game behaviour are weaker than the firearm sources: most are official announcements or player reports, not technical write-ups. No claim here depends on undocumented internals of those games.

### 5.7 Accurate vs reads well: deliberate deviations

| Deviation | Accurate value | Game value | Why |
|---|---|---|---|
| Aim FOV zoom | Matches the display's angular size (about 29°) | 45 to 55° | Targets at 25 to 100 m must be readable; full 1:1 feels like a scope. |
| Target sharp | Target blurred (focus on the front sight) | Sharp | Scoring readability. |
| Ghost ring | Pupil-convolved blur | Analytic vignette | Cheap, deterministic, same on both backends. |
| Front sight width floor | Documented width | At least 2.5 px at 1080p | Avoid aliasing; only applied below the floor. |
| Pistol eye distance | 0.60 to 0.65 m | 0.55 m | The pistol stays legible; arm reach is safer. |
| Musket | No aid | No aid | Not a deviation. Listed so nobody adds a rear sight. |

## 6. Plan

### 6.1 Authoring rule additions (proposed `sight-contract-v1`; add to `hero-firearm-geometry-requirements.md` after owner approval)

**Anchors (Model frame: metres, +X muzzle, +Y up)**

1. `anchor_sight_rear`:
   - Notch sight: the centre of the notch bottom at the rear face of the leaf.
   - Aperture sight: the aperture centre on the eye-side face.
   - Musket: the barrel top over the breech plug. Keep `physicalRearSight: false`.
2. `anchor_sight_front`: the top-centre of the blade, post or stud tip. Tolerance: within 0.2 mm of geometry.
3. **New** `anchor_eye_aim`, on the rear-to-front line, behind the rear anchor. `userData`:
   - `eyeReliefM`
   - `basis`: documented, derived or estimate
   - `sourceIds`
   - `confidence`
4. **New, optional** `anchor_sight_rear_alt` for a second aperture (M4 small, No.4 600 yd leaf). Select it through a `sightSetting` state rather than a new mesh.
5. `userData.sight` on the root:
   - `rearType`: notch-v, notch-u, buckhorn, ladder, aperture-flip, aperture-ladder or none
   - `frontType`
   - `apertureInnerDiameterM[]`
   - `notchWidthM` and `notchDepthM`
   - `frontWidthM`
   - `frontHeightAboveBoreM`
   - `sightRadiusM`
   - a per-value label: Documented, Derived, Estimate or Model

**Geometry**

- The aperture is a real hole in a leaf with real thickness, not a bare torus. Keep the leaf outline, ears and shoulders the reference supports.
- A notch is a real cut in a leaf, with documented or labelled-estimate width and depth. A flat-top bar is not a notch.
- The front sight tip lies exactly on the sight line. Compare documented sight height over bore against `anchor_vfx_muzzle` on the bore axis.
- No geometry may intersect the eye-to-front-tip segment, apart from the intended rear sight opening edges.
- Document sight radius and height-over-bore deviations above 5% or 3 mm in the asset doc, with a reason.

**Required review renders (for each gun and aperture setting; exact saved GLB; WebGPU and forced WebGL2)**

1. Raw pinhole sight picture from `anchor_eye_aim` at the aim FOV, with a 25 m and a 100 m target.
2. The same picture with the presentation treatment (ghost ring, front-width floor).
3. A side elevation with the eye-rear-front line drawn, showing butt, cheek area and eye.
4. A coverage report: the numbers from the tests in section 6.3.

### 6.2 Deriving the aim camera per gun

- **Profile fields:** extend the view profile (`schemaVersion: 2`, still camera-local) with:
  - `aimFovDeg`
  - `aimNear`
  - `eyeAnchor: "anchor_eye_aim"`
  - `ghostRing: { pupilM, darken, smallApertureFloor }`
  - `frontWidthFloorPx`
  - `sightSetting`
- **Derive, don't tune:** `aimPosition` is computed, not hand-entered. With asset rotation `R = rotY(assetForwardRotationY)` and eye anchor position `e` in asset space, `aimPosition = −R·e`. That puts the eye exactly at the camera origin; the existing alignment test then guarantees the line lies on −Z. Keep the computed value in JSON for review, and have the test recompute it from the pins.
- **What does not change:** `hipPosition` is unchanged. Recoil offsets still apply after the lerp.
- **Hand reach:** check hands against the new aim pose, because the gun moves about 0.35 to 0.4 m toward the eye on the rifles and 0.2 m away on the pistol. The rig IK must reach without wrist breaks. That review is a gate, not an assumption.

### 6.3 Tests to add (game folder, `node --test`, deriving inputs from pins rather than literals)

1. **Sight-line alignment:**
   - eye, rear and front are collinear on −Z within 0.1 mm, in the order eye, rear, front;
   - the front tip is within 0.2 mm of geometry (ray hit);
   - no ray from the eye to the front tip hits the mesh first.
2. **Stock sanity:**
   - shoulder arms: `anchor_eye_aim` lies 0.15 to 0.35 m forward of `anchor_support_butt` in X;
   - eye relief falls within the per-gun documented or estimated band in section 5.1.
3. **Aperture coverage (analytic):**
   - clear-core and window angular diameters as a fraction of screen height at `aimFovDeg`;
   - No.4 and M4 large: the window is at least 6% of screen height and the clear core at least 3% (Targets).
4. **Aperture coverage (rendered):**
   - render a mask of rear-sight pixels from the eye at 1920 × 1080, on both backends;
   - report the occluded fraction inside a 20% central circle and assert it stays below the Target agreed by the owner;
   - store the evidence for both backends, as AGENTS.md requires.
5. **Front sight apparent width:** `w/(d + R)` × px-per-radian at `aimFovDeg` and 1080p. Assert at least `frontWidthFloorPx` after presentation scaling, and record the raw value.
6. **Notch light bars (pistol, 1866):**
   - blade-to-notch width ratio within the authored band;
   - front top level with the rear top within 0.3 mm.
7. **Ghost-ring function unit test:** the vignette is monotonic, 0 inside the core, 1 beyond the outer angle, and the small-aperture brightness floor holds.

### 6.4 Order of work

1. **No.4.** This is the owner-raised issue, and most of its geometry is already right.
   - Add the eye anchor and a v2 view profile at 0.10 m and 45°.
   - Add ghost-ring option C and the aim-time near plane.
   - Then narrow the blade to about 1.2 mm with the width floor, and review the sight height (42 mm against 25 mm).
   - Ends with the No.4 sight-picture review renders.
2. **Model 1866.**
   - Correct the eye distance (0.69 to 0.30 m); this is the worst error among integrated guns.
   - Add a real leaf notch.
   - Move the front anchor onto the blade tip.
3. **Pistol.**
   - Add the anchor pair and eye anchor.
   - Rebuild the GI-proportioned notch and blade with tops level.
   - Move the eye to 0.55 m, with an arm-reach review.
4. **M4 carbine** (not yet integrated).
   - Reconcile sight radius and height against the catalogue.
   - Replace the torus with a dual-aperture flip leaf and ears.
   - Move the front anchor onto the post tip.
   - Then integrate with a 0.07 m eye and option C.
5. **Pattern 1742** (not yet integrated).
   - Move the anchors to breech top and stud top.
   - Integrate with a 0.22 m eye and 55° FOV, with no aid.

Shared test and contract work (6.1 to 6.3) lands with step 1 and is reused afterwards.

### 6.5 Owner decisions needed

1. **Eye distance policy.**
   - (a) Use the documented cheek-weld and arm distances in section 5.1. **Recommended.**
   - (b) A halfway compromise.
   - (c) Keep the current offsets.
2. **Ghost-ring treatment.**
   - (a) Analytic aperture vignette. **Recommended.**
   - (b) Screen-space depth of field.
   - (c) Opacity fade only.
   - (d) None.
3. **Aim FOV.**
   - (a) Per-gun zoom: 45° rifles, 52° pistol, 55° musket. **Recommended.**
   - (b) A no-zoom 63° default plus a true-scale option.
   - (c) True scale by default.
4. **Front sight width.**
   - (a) Documented width in the asset plus a 2.5 px presentation floor. **Recommended.**
   - (b) Author wider blades.
   - (c) Accept sub-2 px blades.
5. **Target focus.**
   - (a) Keep targets sharp. **Recommended.**
   - (b) Add an optional front-focus far blur.
6. **Host changes** (the aim-time near plane and FOV blend need Holodeck edits).
   - (a) Authorise the host change for the aim near plane and FOV blend. **Recommended.**
   - (b) A game-side separate weapon pass only.
7. **M4 rework before integration** (dual apertures, radius and height reconciliation).
   - (a) Yes. **Recommended.**
   - (b) Integrate as-is and fix later.
8. **No.4 aperture size** (undocumented).
   - (a) Keep the 6.2 mm Estimate, labelled, and seek a measured source. **Recommended.**
   - (b) Measure from the Auckland photographs at 400 px resolution (low confidence).
   - (c) Choose a game value and label it Target.
9. **Pistol distance.**
   - (a) 0.55 m. **Recommended.**
   - (b) 0.45 m (more readable, less accurate).
   - (c) 0.62 m (closest to real; needs arm reach).

## 7. Limits of this research

- **Unmeasured dimensions.** No source in this pass gave a measured No.4 aperture diameter, GI 1911A1 notch or blade dimensions, an M4 post width, an M4 sight height, or Model 1866 notch dimensions. Those stay Estimates.
- **Weaker sources.** These came from search-engine snippets because direct fetches failed (403, 402 or binary): Rock Island Auction, the Magpul listing, Gun Tests, SSAA and some game sources. They are marked in the source list.
- **Not attempted.** No forum anecdote is used as the sole basis for a recommended value. No performance claim is made; both machines remain under load.
- **Pending review.** The eye distances are anatomical Estimates until a hands-and-stock pose review confirms them.

## 8. Owner decisions (27 October 2026)

All nine section 6.5 decisions were taken as recommended:

1. Real cheek-weld and arm eye distances.
2. Analytic aperture vignette as the ghost-ring treatment.
3. Per-gun aim zoom: 45° for rifles, 52° pistol, 55° musket.
4. Documented front-blade widths, with a 2.5 px presentation floor.
5. Targets stay sharp.
6. Holodeck host changes authorised for the aim-time near plane and FOV blend.
7. The M4 sights are reworked before integration.
8. The No.4 aperture stays at the 6.2 mm Estimate, labelled, while a measured source is sought.
9. The pistol eye sits at 0.55 m.

Work order follows section 6.4, starting with the No.4 inside its v11 integration ([bolt-integration-v11](bolt-integration-v11.md)).

### 8.1 Follow-up decisions (27 October 2026, during authoring)

1. **Open-notch sight-line reference** (pistol, 1866): `anchor_sight_rear` sits at the notch-shoulder top, not the notch bottom. The blade top is then level with the shoulders, with a light bar each side. This amends section 6.1 item 1. The notch-bottom point is kept in the anchor's extras as `notchBottomCentreRearFace`.
2. **1866 hammer:** the Ready pose and the aim hold the hammer cocked (`game/rifle-motion-v2.json`, 0.75 rad). Working the lever leaves a real 1866 cocked until the shot, and the uncocked spur stands in the v3 sight line.
3. **Pattern 1742 stud:** the eye is lifted 1.5 mm, as a labelled Estimate presentation offset (`eyeLift` in `game/sight-policy-v1.json`), so the stud shows about 0.2° above the breech. The anchors and geometry are unchanged.

A sloped sight line (the 1866's shoulder-top reference sits 1.2 mm above the blade tip) is levelled by a derived `aimPitch`. While aiming it turns the whole gun about the eye, so the eye stays at the camera origin and both sights lie on the view axis, in both destinations.
