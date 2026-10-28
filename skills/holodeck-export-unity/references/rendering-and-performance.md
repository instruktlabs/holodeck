# Rendering diagnosis and performance evidence in Unity

## URP shadows

- Isolate a suspected geometry defect with matched shadow-on and shadow-off
  captures before editing the source asset.
- Record the effective URP shadow settings, not only the Light's stored bias.
  With `usePipelineSettings`, the Light's own bias values are inactive.
- More bias can erase contact shadows without fixing the original defect. Keep
  that tradeoff visible, and never turn shadows off silently to call an asset
  fixed.
- To find the source of a bad cast band, disable only the suspect material's
  caster pass while it stays visible and receives shadows. That is a diagnostic,
  not a final workaround.
- Check world-space shadow texel size, not only map resolution. URP scales depth
  and normal bias by the projection's texel footprint, so one long cascade can
  serrate surfaces that several cascades over the same range render cleanly.
  Enable the cascade policy in the pipeline asset before building with normal
  variant stripping, then restore and verify the asset.

## Shader variants

Bound diagnostic variants to the feature under test. Disabling unused-variant
stripping can cause a very large build, and an interrupted Editor can persist
that override even past a script's `finally`. Keep the original value in the
outer runner, restore and verify it after any interruption, and prefer the
smallest diagnostic that exercises the feature.

## Captures

- Read the actual pixels of each capture. A frame counter, exit code or state
  hash does not prove a rendered frame.
- An enabled camera in a hidden or batch-mode window can receive no render
  callbacks. Fail the run before sampling if callbacks are missing.
- For a posed capture, check both the requested animation state and the visible
  pose. A readback can show the previous pose after the state has changed; wait
  for several completed camera render callbacks, record the count and inspect
  the image instead of relying on a fixed delay.
- Hash each capture and bind it to the asset and bundle revision it shows.

## Timing

- Keep texture readback, image encoding and logging outside timed intervals.
  Use a clean process without preview sequences for population tests.
- Run player binaries from a normal local directory. Moving directories alone
  does not prove an improvement.
- Keep repeat variability and every allocator warning. A completed sweep or a
  zero exit code does not establish clean memory behaviour. Mark warnings that
  occur during timing, and keep diagnostic flags out of measured runs.
- When a warning depends on presentation, isolate camera lifecycle and graphics
  backend with the same source and player build. Report a bounded result; one
  configuration staying clean does not establish a general fix.
- Without per-run utilization or a coordinated quiet window, a sequential
  same-build difference does not isolate a cause. For capacity work, alternate
  trial order. Do not repeat expensive sweeps to chase a favourable number.
- Keep geometry, material, draw-count and rendered-motion evidence separate from
  timing uncertainty.
