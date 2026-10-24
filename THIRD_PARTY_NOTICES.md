# Third-party notices

Holodeck's MIT and CC0 designations do not replace third-party licenses.

## Inter font

The Inter font files in public/fonts/ originate from Google Fonts and retain the SIL Open Font License 1.1 in [public/fonts/OFL.txt](public/fonts/OFL.txt). The static Inter-Regular.ttf instance and inter.font.glb derivative remain covered by that font license.

The project site bundles a Latin subset of the same variable font, converted to WOFF2 with fontTools 4.59.0 and keeping its weight and optical-size axes, as site/fonts/Inter.woff2, with its license in [site/fonts/Inter-OFL.txt](site/fonts/Inter-OFL.txt).

## Instrument Serif font

site/fonts/InstrumentSerif-Regular.woff2 and site/fonts/InstrumentSerif-Italic.woff2 are Latin subsets, converted to WOFF2 with fontTools 4.59.0, of InstrumentSerif-Regular.ttf and InstrumentSerif-Italic.ttf from the Google Fonts repository (github.com/google/fonts, ofl/instrumentserif, commit 0b58fb370093f9a9f4ff785d94405710b79de67c). Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif). They are licensed under the SIL Open Font License 1.1, included as [site/fonts/InstrumentSerif-OFL.txt](site/fonts/InstrumentSerif-OFL.txt), and are not covered by Holodeck's MIT or CC0 designations.

## Installed software dependencies

Dependencies are installed through package.json and package-lock.json and retain the licenses and notices shipped in their packages. This includes Kiln, React, React Three Fiber, Three.js, pmndrs math, Vite and the Transformers.js speech stack. Diagnostic-only dependencies also retain their original notices. Holodeck does not relicense these packages under CC0. Preserve applicable dependency notices when redistributing bundled software.

Speech model weights downloaded on first use retain their upstream terms and are not part of Holodeck's CC0 asset dedication. Generated ONNX runtime files under public/runtime/ come from installed dependencies and are excluded from the source repository.

## Kiln library textures

Some Winter Mountainside Cabin GLBs embed texture maps from Kiln's built-in material library, which derives them from CC0 1.0 Poly Haven textures: Bark Brown 01, Oak Veneer 01, Rock Face 03, Brown Planks 03 and Rough Concrete (polyhaven.com). CC0 requires no attribution; the source is recorded here for provenance.

## First-party provenance

Cove asset source and revision metadata are in assets/cove/. Tidemark's manifest pins its delivered scene and asset bytes. Concept images were generated with Image Generator and are distinct from runtime captures. First-party licensing scope is defined in [LICENSING.md](LICENSING.md).
