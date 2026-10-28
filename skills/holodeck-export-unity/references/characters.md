# Characters, skins, LODs and crowds in Unity

Character geometry is authored in Kiln. These are destination checks for the
skinned or simplified derivatives a Unity adapter makes from it.

## Count and prove the rig

- Count unique meshes, instantiated primitives, materials, skins and clips
  separately. Named pivots or sockets are not a deformation rig.
- Require weighted pose tests before multiplying a static study into a crowd:
  resolve the Animator root from the actual clip paths and measure skinned
  vertex motion. A binding smoke on one fixture does not qualify a different
  production character or its rendered look.
- Give every imported mesh exactly one matching skin rule. An unknown component
  must fail, not fall back to a default bone. Keep rigid straps and armour on
  their intended bone.
- Compare intended poses with the baked actions, then import the exported GLB
  in a fresh process and compare sampled clip geometry again. Preserve the
  source frame rate.
- Check winding with backface culling on, in the actual Unity front and rear
  views. Do not hide an orientation error with double-sided materials. Preserve
  vertex IDs when correcting winding so skin mappings stay stable.
- Label limits in the handoff: ground-height correction is not foot locking or
  contact IK, and a procedural walk is not a qualified animation set.

## Derivatives and LODs

- For a palette or material derivative, compare decoded linear vertex colours
  and texture channels, then destination pixels. Keep source geometry and skin
  hashes separate from the derivative hash.
- Bind simplifier output to the exact input GLB hash. A small simplification
  error does not protect thin closed wraps such as cuffs and rims; they can fold
  across their thickness. Audit new triangle orientation against the retained
  normals and rerender the failed pose. Accept a larger LOD when needed to keep
  the visible form.
- Independently simplified layers can intersect even when each passes an
  orientation check. Simplify mating layers together, or validate an explicit
  clearance-aware simplification, and review them in material-faithful views.
- Share the canonical bones and one Animator across LOD renderers. Record actual
  draw counters, not the sum of configured meshes. Compare all resident LOD
  skinning cost with a one-renderer control: fewer submissions can coexist with
  slower frames when inactive meshes still update. Prove the same actors still
  render before crediting an improvement.
- Establish the approved close-view character before enforcing a low triangle
  budget, and derive crowd LODs from that baseline.

## Crowds

- Give crowd tests explicit animation workloads. Assigning clips by grid index
  makes visible stripes even with varied phase; shuffle with a saved seed and
  vary phase and speed independently.
- Include an all-moving workload so idle actors do not hide animation cost.
  Record runtime state, phase and speed for spatially spread units.
- Reset single-unit capture poses to their assigned crowd states before warmup.

## Component approval

Treat an owner approval as a component boundary when later feedback targets
another part. For an equipment-only revision, compare decoded geometry, material
values and the complete transform ancestry; a whole-file hash changes with any
edit and cannot prove the approved component was preserved. Review the revised
part from the side, rear and underneath as well as the front.

## Large Kiln sources

A Kiln program between the evaluator's source cap and the program store's limit
can pass edit and validate and then fail evaluation with a misleading protocol
error (kiln#299). Check source byte size before a large literal-buffer edit.
Keep the original data and use declared precision reduction or a supported
resource binding. Do not patch the installed evaluator or silently decimate to
fit.
