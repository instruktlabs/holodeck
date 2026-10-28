# Bolt rifle v1 reference dossier

Pre-model record, 26 October 2026 local. Selected identity: **Lee-Enfield No.4 Mk I*, Savage Arms**, WWII family, based on Auckland Museum accession **1983.50 / A7096**, object **776149**. The candidate configuration is a museum-restored exterior interpretation, not an exact pristine service specimen. Production and integration qualification remain pending.

## Primary records and scope

| Source, accessed 2026-10-26 local | Supported facts | Limits |
|---|---|---|
| [Auckland Museum object 776149](https://www.aucklandmuseum.com/collection/object/776149), [institutional API](https://collection-publicapi.aucklandmuseum.com/api/v3/opacobjects/776149) | No.4 Mk I*, Savage; WWII context; wood, steel, brass and webbing; aperture sight and brass buttplate. Catalog year is 1943, while the transcribed body marking says 1942. The museum records replacement wood/furniture during restoration in June 1991. | Exact production year is unresolved. Restored furniture and aged finish do not establish original factory appearance. Overall scale uses the museum's 1130 mm entry as a visual sanity check. |
| [National Army Museum 1982-04-759-2](https://collection.nam.ac.uk/detail.php?acc=1982-04-759-2) | Independently identifies a No.4 Mk I* made at Long Branch in 1945. | Different maker/specimen. Corroborates family/era only; no transfer of markings, finish or component details. NAM photographs are copyright-protected and are not used in the asset. |
| [Canadian War Museum 19770467-142](https://www.warmuseum.ca/collections/artifact/1043694) | Search-indexed record identifies another Long Branch No.4 Mk I*, 1944. | Full page required JavaScript in this audit. Secondary corroboration candidate only; not relied on for geometry or materials. |

The IWM No.4 Mk I page returned HTTP 403. It is not treated as verified evidence. No claim is derived from forum discussions, generated concept guns, operating instructions or construction drawings.

## Observed photographs before modeling

The museum API supplied 32 medium derivatives, each 400 × 267 px. All 32 were opened individually. The full [image manifest](../evidence/firearm-bolt-v1-reference-images.json) records exact image IDs, URLs, local evidence paths and credit. Numbers below refer to that manifest, not invented photographic titles.

| Images | Observed exterior evidence used |
|---|---|
| 01–04 and 32 | Both side silhouettes, elevated/top angle, stepped butt/wrist, long segmented forewood, receiver opening outline, bands and sling position. A spare wooden component is laid separately; it is not an attached second fore-end. |
| 05 | Rounded brass buttplate edge and trap outline; worn wood/metal transition. |
| 06–09 | Two-position aperture sight exterior, open circular apertures, pivot and raised protective shoulders. |
| 12, 14–17, 22 | Butt/wrist wood grain, visible joins, side hardware and metal-band finish. |
| 18–21, 23–26 | Bolt-handle silhouette and round knob, receiver exterior planes, stock socket and marking locations. Exact serials, museum inventory marks and proof stamps will not be copied. |
| 28–29 | Detached magazine exterior finish/edge treatment. Installed magazine silhouette is partly estimated rather than claimed directly measured from the overall views. |

Images 10–11, 13, 20, 25, 27 and 30–31 also show surfaces within or beneath the assembly. They are not a source for functional internal construction. The model will use closed nonfunctional shells behind visible exterior openings.

No close frontal muzzle photograph was supplied in this set. The visible muzzle outline is supported at low resolution by the overall views; the new visible rim/interior setback is authored game geometry with estimated proportions, not a measured historical bore. This uncertainty must remain explicit even after the geometry passes the open-mouth visual gate.

## Rights and attribution

The collection page credits Richard NG, 21 March 2017, and links its photographs to [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Evidence derivatives are unmodified museum downloads. Credit: **Richard NG / Auckland Museum Tamaki Paenga Hira, accession 1983.50 / A7096, CC BY 4.0**, with the source and license links retained in the image manifest. Museum photography is reference evidence only; no photograph will be embedded in the GLB, procedural texture or asset source. Original geometry and textures will be authored for the game; no museum endorsement is implied.

## Authoring choices and unresolved fields

- Known identity is the No.4 Mk I* family and Savage museum specimen. Exact year stays null, with catalog 1943 and marking 1942 retained as conflicting evidence.
- Reconstruct the observed exterior silhouette, divided wood furniture, subdued dark metal, brass butt trim, sight apertures and bolt-handle character. Wood species, hidden cross-sections, exact finish chemistry, small bevels and wear intensity are estimates/artistic interpretation.
- Base candidate omits the web sling. Preserve front/rear visual sling anchors; a separate sling attachment needs its own fit/animation qualification before the runtime allowlist can accept it. No optic rail, suppressor, laser or universal modern attachment interface is inferred. A muzzle-effect anchor is not an accessory mount.
- Visible bolt, magazine, trigger and rear sight receive separate named owners. Any pose-review animation is a visual clearance demonstration with game-authored timing, not a calibrated operating cycle.
- Recoil, accuracy, ammunition/trajectory behavior, firing VFX and sounds remain unknown/unimplemented. No behavior is inferred from era or exterior geometry.

Bounded workspace searches did not locate the named imported roster at dossier creation. The coordinating agent confirmed that no authoritative roster path was established and authorized this specimen as a proposed representative. Roster mapping remains unresolved; no catalog entry ID is invented. This does not establish catalog coverage or production readiness.
