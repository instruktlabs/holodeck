# Moving a Unity project between hosts

## Copy inputs, not caches

Run imports and builds from a normal local working directory. Synchronized or
cloud-backed folders can break imports. Copy the source, packages, settings and
exact bundle inputs explicitly, with every `.meta` file and its GUID. Do not
transfer `Library` caches or live Editor lock files between machines.

On a build host, pin the matching Editor version and platform module. Save the
input hashes, exit code, full logs and output checksums as the build receipt.
Copy hash-verified evidence to synchronized storage only after the job ends.

## GUID closure

- Generated scenes reference bundle models by GUID, often many times per model.
  A commit that has the GLBs, bundle JSON and scene but not the bundle metas
  cannot be resolved anywhere else (holodeck#32).
- When two copies of a project disagree on GUIDs, the authoritative set is the
  one whose imported hashes match the build input receipt. Recover metas from
  it; never mint new ones by re-importing.
- Render settings are a separate closure (holodeck#26): pipeline asset,
  renderer, URP global settings and default volume profile, with metas and
  `ProjectSettings`. Keep a receipt of any deliberate GUID replacement and the
  previous source snapshot.
- During an Editor version migration, distinguish upgraded serialization from
  temporary build-only overrides. Restore the overrides and archive the
  migrated asset before an outer restore step puts the original bytes back.

## Jobs and locks

- Serialize heavy jobs in one project with a lock, and check host memory when a
  job is dispatched, not only when it is planned. Use one low-priority job when
  the host is shared.
- A leftover lock filename after an Editor crash is not proof of a live Editor.
  Check the owning process and the exclusive file lock before recovering.
- Never borrow or terminate another project's Editor or unrelated jobs.

## Accounts and licences

Check Unity account and licence status separately, including from a fresh shell
session after sign-in. Licence activation needs the owner's chosen licence and
any terms they must accept. Do not copy credentials or print authenticated
command lines. An inconsistent auth result is a finding to investigate, not a
reason to keep asking the owner to sign in.

## Floor ownership and composition review

When terrain and modular paving occupy the same footprint, choose one visible
and walkable owner (holodeck#30). Compare exported terrain triangles with the
transformed floor triangles, not only heightfield vertices or route rays. Remove
the covered terrain surface or recess it with explicit clearance, keep
foundations at exposed edges, and recheck collision height and landings in both
directions.

A replacement composition needs its own review: its overview, approach, eye
level views and terrain-to-floor edges, after the numeric checks pass. A
previous scene's smoke run, a new reference image or a successful import does
not approve it. Record candidate source and bundle hashes and approval state.
