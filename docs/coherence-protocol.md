# Advisory world checks

`world_check` returns `holodeck.coherence/1`. The same read-only operation is
available through **Check world** in the **Observe** sheet and POST /api/check in
the local authenticated host. It is not part of validation, proposal acceptance
or loading. Findings never block an edit and no whole-world quality score is
emitted. An agent can pass the staged `proposalId` to check a proposal before
the user applies it; that report starts from initial behavior state, has no
browser observation, and names the proposal as its source.

The report contains the accepted revision, displayed revision and observation age;
inventory and enabled modules; measured renderer values when recently observed;
individual checks with status, evidence and explanatory text; limitations and
suggested next observations. Status values describe observations, not approval.
An attention result may describe an intentional constraint such as a closed gate.

The initial driver checks spawn clearance and optional straight route samples
using the same yaw-box query as the walker. Agent input `routesJson` is null or a
JSON array of up to eight `{id,from:[x,1.72,z],to:[x,1.72,z]}` records. The HTTP
equivalent accepts `routes` directly. Each route has at most 65 samples; reported
spacing makes gaps explicit. Hits include object/blocker IDs and world positions.
The query uses a 0.22 metre walker radius at the fixed 1.72 metre eye height.
In worlds with terrain or maker possession, routes instead follow supported feet
with the shared slope, step and water rules; see
[terrain and inhabitants](terrain-and-inhabitants.md). The inventory reports
target, placed and removed counts for each scatter.

Fresh matching browser activity poses inform moving blockers. Observations older
than ten seconds or from a different revision are labeled and not used as current
pose evidence. Without current observations, probes use initial behavior state.
A v1 world has no registered spatial driver; the report says so without inferring
collision. Unsupported heights are reported per probe.

Sampling frozen poses is not walking a controller, validating a physical route,
running a mechanism or evaluating appearance. The report says what was not tested.
Actual interaction drivers, visual captures and additional query models can extend
the protocol independently of world genre. Any future driver should declare its
inputs, capabilities, work bound, side effects and reset policy. Read-only probes
must not secretly advance simulation or rewrite authoring state.

The reflection loop is: read the world and intent, edit through normal tools,
inspect the loaded revision, request a focused check, interpret the observations,
and perform any needed interaction or visual review. Skills guide that judgment;
hard validation continues to reject malformed or unsupported data separately.
