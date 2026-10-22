# Third-party notices

Holodeck's MIT and CC0 designations do not replace third-party licenses.

## Inter font

The Inter font files in public/fonts/ originate from Google Fonts and retain the SIL Open Font License 1.1 in [public/fonts/OFL.txt](public/fonts/OFL.txt). The static Inter-Regular.ttf instance and inter.font.glb derivative remain covered by that font license.

The project site bundles an unmodified copy of the same variable font as site/fonts/Inter.ttf, with its license in [site/fonts/Inter-OFL.txt](site/fonts/Inter-OFL.txt).

## Instrument Serif font

site/fonts/InstrumentSerif-Regular.ttf and site/fonts/InstrumentSerif-Italic.ttf are unmodified copies from the Google Fonts repository (github.com/google/fonts, ofl/instrumentserif, commit 0b58fb370093f9a9f4ff785d94405710b79de67c). Copyright 2022 The Instrument Serif Project Authors (https://github.com/Instrument/instrument-serif). They are licensed under the SIL Open Font License 1.1, included as [site/fonts/InstrumentSerif-OFL.txt](site/fonts/InstrumentSerif-OFL.txt), and are not covered by Holodeck's MIT or CC0 designations.

## Installed software dependencies

Dependencies are installed through package.json and package-lock.json and retain the licenses and notices shipped in their packages. This includes Kiln, React, React Three Fiber, Three.js, pmndrs math, Vite and the Transformers.js speech stack. Diagnostic-only dependencies also retain their original notices. Holodeck does not relicense these packages under CC0. Preserve applicable dependency notices when redistributing bundled software.

Speech model weights downloaded on first use retain their upstream terms and are not part of Holodeck's CC0 asset dedication. Generated ONNX runtime files under public/runtime/ come from installed dependencies and are excluded from the source repository.

## First-party provenance

Cove asset source and revision metadata are in assets/cove/. Tidemark's manifest pins its delivered scene and asset bytes. Concept images were generated with Image Generator and are distinct from runtime captures. First-party licensing scope is defined in [LICENSING.md](LICENSING.md).
