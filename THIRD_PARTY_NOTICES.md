# Third-party notices

Holodeck's MIT and CC0 designations do not replace third-party licenses.

## Inter font

The Inter font files in public/fonts/ originate from Google Fonts and retain the SIL Open Font License 1.1 in [public/fonts/OFL.txt](public/fonts/OFL.txt). The static Inter-Regular.ttf instance and inter.font.glb derivative remain covered by that font license.

## Installed software dependencies

Dependencies are installed through package.json and package-lock.json and retain the licenses and notices shipped in their packages. This includes Kiln, React, React Three Fiber, Three.js, pmndrs math, Vite and the Transformers.js speech stack. Diagnostic-only dependencies also retain their original notices. Holodeck does not relicense these packages under CC0. Preserve applicable dependency notices when redistributing bundled software.

Speech model weights downloaded on first use retain their upstream terms and are not part of Holodeck's CC0 asset dedication. Generated ONNX runtime files under public/runtime/ come from installed dependencies and are excluded from the source repository.

## First-party provenance

Cove asset source and revision metadata are in assets/cove/. Tidemark's manifest pins its delivered scene and asset bytes. Concept images were generated with Image Generator and are distinct from runtime captures. First-party licensing scope is defined in [LICENSING.md](LICENSING.md).
