# Megascans surface trial checkpoint

Current results: [Megascans wood results](megascans-wood-results.md).
The authenticated trial has now acquired a free wood surface, saved a child
revision and applied it in Holodeck and Unreal. The original preparation notes
below are historical; use the results document for current status and failures.

Started 2026-10-26. User approved applying a Megascans surface to the case in
Unreal and Holodeck and documenting reusable optional tools/skills.

Baseline: case asset `a_97a44d3c5d574dab9d9c4994cf6d2be3`, revision
`r_b8eb01baa98d4382a2f1fba14e52c82a`, program `p_ac6b79f7f8a3`.
Baseline restored into this authoring workspace; receipt
`evidence/megascans-baseline-restored.json`. Holodeck baseline is revision 13.
Preserve the baseline delivery and native paint/steel material overrides.

## Historical access state before the trial

Fab library navigation redirected to Epic sign-in. The sign-in tab has been made
visible for the user. Await authenticated access before choosing/downloading an
entitled surface. Common Megascans directories and the Fab VaultCache did not
yield a surface payload; FabLibrary contains a listings database only. Unrelated
older textures on D: have no verified Megascans provenance and are not substitutes.
No Megascans surface has been acquired, imported or applied yet.

## Prepared comparison

Choose one wood surface already owned or free, record the actual listing and
acquisition/license, and download a bounded texture set. Keep original maps and
hashes. Record physical repeat size and normal convention. Prepare base color as
sRGB; normals and roughness/metallic/AO as linear data. Preserve explicit channel
packing and any conversion in a reproducible manifest. Avoid displacement for
this first matched static-geometry comparison.

Kiln discovery exposes an external material import payload with source/license
records and PNG hashes, and approved texture resources for source binding.
Saved contracts: `evidence/megascans-material-contracts.json`; initial discovery
in `evidence/megascans-kiln-material-discovery.json`. Use supported public CLI
interfaces and exact resource pins, not arbitrary file access inside asset source.

Change only the case timber material through a child revision; compare exported
geometry and transforms against the baseline. Compare the portable PBR delivery
in Holodeck with native Unreal texture/material settings at matched texel scale,
lighting and camera. Check the hinge and native paint/steel overrides again.
Record actual source/derived assets and rendered evidence separately. Account
sign-in and acquisition are user-specific setup requirements for a future optional
adapter, not something to embed in generic Kiln or published examples.
