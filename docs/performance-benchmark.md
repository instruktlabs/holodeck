# Measuring a static world

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
