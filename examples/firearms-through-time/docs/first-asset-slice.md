# First production asset slice

Recorded 2026-10-26. The first three modules now exist as saved Kiln prototypes
and are being qualified in both destinations. The working case established revisioned asset
delivery, interaction and separate native overrides. Asset production can begin
now; exact lighting equality is not a prerequisite for modeling the range.

## Direction and scope

Follow `handoff/design/firearms-through-time/STYLE-GUIDE.md` and the layout JSON.
Build one chronological collection bay across a continuous concourse from one
modern booth. Use charcoal steel, pale concrete and restrained natural oak.
The transport case is a useful interaction fixture and possible service prop;
its blue painted trim does not establish the facility palette.

1. **Collection bay:** wall backing, shelf, horizontal mounts and replaceable
   label/artwork panels. Model plausible supports and edge details. Leave the
   historical object slot empty until its reference and identity are selected.
2. **Booth kit:** partition/frame, work surface and console enclosure with clear
   standing space. Provide a screen surface and interaction anchor. Labels and
   control behavior remain runtime data, not painted fake UI in the mesh.
3. **Target module:** stand/carrier and replaceable target face. Establish stable
   anchors for positioning and selection. Start with a simple target; scoring,
   ballistics and activity presets are separate implementation work.
4. **One reference-qualified historical display prop:** choose from researched
   collection data, verify proportions and references, then model a recognizable
   exterior for inspection. Do not invent dates or operating details from a
   generated image. Select the actual entry before authoring it.

The first playable loop is browse/select a bay, walk across to the booth, preview
a target arrangement, start/reset and return. Full campus replication, stairs,
large catalogs and complex simulation follow after this slice works.

## Per-asset delivery

- Use metres, a declared forward axis, explicit placement origin and stable part
  and material names. Record dimensions and anchors in the asset contract.
- Keep portable PBR materials and UV intent with the saved asset. Knots/end grain
  are available for joinery; use continuous grain where construction calls for it.
- Declare collision intent independently of render geometry. Test clearance,
  support/contact and selection at player height in the destination scene.
- Save a child revision and pin it in the scene. Keep destination interaction,
  authored placements and native material overrides outside generated folders.
- Review silhouettes and contact before detail; then inspect UV scale, end faces,
  bevels and near/far mips. Record triangles, draw calls and texture costs.
- Reimport once after a deliberate asset change and rerun the interaction. At the
  completed slice boundary, cook/package the current revisions and play them.

## Integration work alongside content

Treat the lighting rig as a regression fixture. Resolve a mismatch when it blocks
an asset decision; do not postpone every new asset until all renderer features
match. Keep original source maps, engine-specific appearance adjustments and
their evidence distinct. Profile the actual slice before selecting Nanite, LOD
budgets, additional plugins or a different shader system.

Character, firearm and attachment sequencing is recorded in
`characters-weapons-and-attachments.md`. Maker supports the browser walkthrough;
the first gun and first-person hands are the next content/system slice.

Promote a helper into the optional Kiln extension only after it works on the
case and a representative production asset. Portable recipe/atlas tools belong
in the common layer; Unreal import, compilation and capture checks belong in
the Unreal adapter; Holodeck retains proposal/review/apply.
