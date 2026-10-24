# Measuring a static world

## Visible diagnostics

Open a freshly built static export with `?benchmark=1` to use the **Viewer
diagnostics** panel through ordinary browser controls. No console evaluation,
agent connection or browser automation is needed. The ordinary player is
unchanged when this parameter is absent. Benchmark mode reserves the canvas and
keyboard for declared fixed-camera views; return to the normal player to walk.

1. Prepare the three camera records described below. Paste their JSON array into
   the panel and choose **Load camera JSON**. Input is limited to 16,384 characters
   and accepts only the existing bounded scenario schema, never executable code.
2. Select a scenario and **Apply camera for framing**. Check the actual backend,
   raw adapter/renderer fields, revision and presentation. Missing hardware fields
   are shown as unverified. Use the reload links to prefer WebGPU or force WebGL2;
   a requested WebGPU session that falls back to WebGL is rejected.
3. Use a visible 1920×1080 browser viewport with device DPR1 and a 1920×1080 canvas.
   The existing presentation gate is unchanged: canvas DPR1 alone does not change
   device DPR or viewport size. An unsupported presentation cannot qualify.
4. Optionally enter the SHA-256 of the externally verified export manifest. The
   panel records this user-supplied identity; it does not verify the file inventory.
   Choose **Warm up 10s and record 60s**. Camera readiness has a five-second bound;
   the sampler retains its 75-second collection deadline. Keep the tab visible
   and avoid resizing throughout warmup and recording. Reload ends the session.
5. **Download result JSON** retains the declared scenario, start/end observations,
   renderer proof, timestamps, raw frame rows, summaries, errors and limitations.
   The result identifies its own scenario and camera, even after selecting or
   applying another view. Its download link remains available while that result
   is displayed, including during the next recording, until a new result replaces it.
   Repeat each declared view on both backends using matching exports. Reloading
   loses the pasted settings, so keep the camera JSON alongside the results.

The panel does not label missing fallback or adapter evidence as hardware proof.
Resolved samples containing errors are rejected and remain downloadable. Browser
errors, GPU errors and presentation changes persist for the session; reload before
retrying after an error. A rejected sampler promise has no completed frame rows.
The panel refreshes at low frequency and overlays the viewport without resizing
the canvas. Its collection and display overhead are part of these measurements.

**Recorded** means this session met the panel's checks, not that the world passed
final qualification. This workflow does not provide cold-profile startup or host
admission/temperature evidence. Verify the complete export inventory and record
quiet-host conditions separately. Earlier authoring captures are not qualified by
a later static-viewer measurement. Review the timing limitations below as well.

## Developer runner

The developer checkout includes a bounded Linux/NVIDIA benchmark runner in
`scripts/benchmark-world/`. It uses the existing Playwright development dependency
and an explicitly selected installed Chrome; it does not install browsers, call
providers, or use the local agent host.

Build a fresh static export with the opt-in benchmark hook, then hash its
`manifest.json`. Prepare exactly three camera records with unique `id`, finite
`position` and `target` three-vectors, `fov` from 30 to 90, and boolean `cove`.
For example, a camera record is
`{"id":"arrival","position":[0,2,8],"target":[0,2,0],"fov":63,"cove":false}`.
Put the three records in a JSON array. Choose views for the specific world and
visually check their framing before interpreting timing results.

Run on an allocated idle machine's real headed display, with its ordinary
display authorization and GPU-selection environment already configured:

```sh
node scripts/benchmark-world/run.mjs \
  --export ./my-site --manifest-sha256 EXACT_SHA256 --revision 8 \
  --scenarios ./benchmark-cameras.json --out ./new-results \
  --chrome /path/to/installed/chrome --vendor nvidia --backend both \
  --reservation /tmp/holodeck-performance-reservation \
  --playwright-module ./node_modules/playwright-core/index.mjs
```

The output directory must be new. Use the same reservation location as other
benchmark jobs on that machine. An existing reservation is preserved and refused.
The runner verifies the full export inventory and serves the exact retained bytes
on loopback. Each of three views gets a fresh browser profile, cold navigation,
10 seconds warmup and 60 seconds recording. WebGPU and forced WebGL2 run serially
at 1920x1080/DPR1. Actual hardware identity, visibility, dimensions, admission,
errors and temperature checks must pass. The total run has a 950-second deadline.

Reports retain raw bounded frame records, interval and callback-span distributions,
draw/triangle totals across render passes, load timings, long tasks, captures and
host observations. Rejected runs retain diagnostics. Cleanup closes only the
owned browser/server and matching reservation; it does not stop unrelated apps.

Cold browser profiles leave OS and driver caches intact. Localhost delivery is
not a WAN-loading measurement. Callback spans are not GPU timings, draw totals
are not unique source triangles, and display refresh caps observed frame rate.
These are fixed free-camera views with active scene behavior. The avatar remains
at arrival; the Sun shadow focus follows the viewed terrain, using the same
free-camera policy as normal exploration. They do not qualify traversal, camera collision,
animation quality, or multi-client server load. Host monitoring cannot attribute
all short-lived processes or per-process GPU activity. Use matching sealed exports,
camera files and presentation settings for comparisons.
The frame intervals include diagnostic collection overhead; callback spans end
before that frame's sample collection. Neither value represents uninstrumented
GPU execution time.

The runtime hook is enabled only by `?benchmark=1`; ordinary exports use the same
renderer/runtime/effects with the hook inactive. Developer scripts are excluded
from the consumer package.
