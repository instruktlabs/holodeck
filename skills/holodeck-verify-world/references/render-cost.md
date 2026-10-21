# Rendering cost in the destination

Use this when adding repeated scenery or reviewing a rendering optimization.
Start with the accepted and loaded revisions, exact asset hashes, camera/view,
backend, viewport/DPR, origin visibility, activity state and capture interval.
Compare the same content and settings before and after a change.

## Count the source and the frame separately

A GLB's primitive/material count is a single-pass source cost. Every compatible
source part can become a separate instance batch; sharing one asset file or
similar-looking colors does not make all its parts one draw. Count repeated
source triangles, including flock members, before instancing. Instancing saves
submissions but does not simplify geometry or remove fragment/shader work.

Inspect material splits, transparency and shadow casters before adding density.
An opaque material, a double-sided leaf and a transparent surface can have
different pass costs. Keep intentional material/UV semantics and rigid joint
boundaries; do not flatten moving parts or replace authored shading merely to
reduce the source count. Changes to shadow policy need visual and moving-object
checks, as well as a measured cost comparison.

## Check both close views and the overview

The current runtime groups compatible static placements by asset/layer, splitting
large groups into 96-metre X/Z cells while keeping compact groups together. Each
mesh is culled as a whole against the main and shadow cameras. This is not
per-instance GPU culling. Terrain/ocean remain whole meshes, and a flock's bounds
cover its authored flight volume.

Global batches can save draws while submitting off-camera instances. Smaller
chunks can reject more geometry but add draws in a wide view. Check an actor-height
view, a boundary/turn and an overview; preserve selection IDs, collision and wind
bounds. Fewer submitted triangles at one viewpoint do not prove a frame-time win.

Distance LOD and automatic source-GLB LOD selection are not implemented. An asset
name, lower-tier geometry or an export's LOD metadata does not establish runtime
switching. Verify the exact consuming loader and observe selected levels before
claiming LOD. Fog alone does not remove geometry submissions.

## Read observations with their time and pass scope

Browser draw/triangle counters are sampled once per frame and include render
passes since the previous reset, including shadows and postprocessing. They are
not the placed-source budget or a count of visible unique triangles. The host
receives periodic snapshots; one world_observe result is not a per-frame trace,
pass breakdown or average draw count for its frame-time window.

For a comparison, collect a bounded sequence after loading settles and state
which frames and passes it includes. Frame-interval percentiles include CPU work,
refresh pacing and stalls; they are not GPU durations. Keep first-load/first-view
stalls separate from settled traversal. Test WebGPU and forced WebGL2 separately.
Report a count reduction as such until comparable timing evidence supports more.
