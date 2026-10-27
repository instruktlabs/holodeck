"""Bundle .meta and generated-scene GUID closure gate (holodeck issue #32).

Run with `python -I`; stdlib only, read-only. Catches what validate_render_settings.py
does not: bundle assets without a committed .meta, generated-scene GUID references
that no committed .meta (or known Unity built-in/package GUID) resolves, re-minted
GUIDs relative to another project copy, and .meta bytes differing from a build-input
receipt. Not an Editor import, compile or rendering check.

  python -I Tools/validate_bundle_meta.py [--project DIR] [--bundle-dir Assets/CastleSliceBundle]
      [--scenes-dir Assets/CastleSliceGenerated] [--known Tools/known_unity_guids.json]
      [--package-root DIR]... [--allow-uncommitted] [--compare OTHER/Assets]
      [--receipt inputs.json [--receipt-scope closure|all]]

Exit 0 when no errors; 1 otherwise. Divergence found by --compare is reported, not gating.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

GUID_LINE = re.compile(rb'^guid: ([0-9a-f]{32})\r?$', re.M)
GUID_REF = re.compile(rb'guid: ([0-9a-f]{32})')
NULL_GUID = '0' * 32
YAML_SUFFIXES = {'.unity', '.prefab', '.mat', '.asset', '.controller', '.anim', '.overrideController', '.mask', '.playable'}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def unity_visible(rel_parts):
    # Unity ignores hidden entries, names ending in "~" and a few reserved names.
    return not any(p.startswith('.') or p.endswith('~') or p.lower() in ('cvs',) or p.endswith('.tmp') for p in rel_parts)


def meta_guid(meta):
    m = GUID_LINE.search(meta.read_bytes())
    return m[1].decode() if m else None


def walk_assets(root):
    """Yield (path, is_dir) for Unity-visible entries below root (root excluded)."""
    for dirpath, dirnames, filenames in os.walk(root):
        base = Path(dirpath)
        rel = base.relative_to(root).parts
        if not unity_visible(rel):
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if unity_visible((d,))]
        for d in dirnames:
            yield base / d, True
        for f in filenames:
            if unity_visible((f,)) and not f.endswith('.meta'):
                yield base / f, False


def guid_index(*roots):
    """GUID -> list of project-relative asset paths, from every .meta under roots."""
    index = {}
    for root in roots:
        if not root.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if unity_visible((d,))]
            for f in filenames:
                if f.endswith('.meta'):
                    meta = Path(dirpath) / f
                    g = meta_guid(meta)
                    if g:
                        index.setdefault(g, []).append(meta.with_suffix(''))
    return index


def git_status(project, paths):
    """Return (available, {posix relpath: status}) for the given project-relative paths."""
    try:
        prefix = subprocess.run(['git', '-C', str(project), 'rev-parse', '--show-prefix'], capture_output=True, text=True, check=True).stdout.strip()
        tracked = set(subprocess.run(['git', '-C', str(project), 'ls-files', '-z', '--', *paths], capture_output=True, check=True).stdout.decode().split('\0'))
        status = subprocess.run(['git', '-C', str(project), 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', *paths], capture_output=True, check=True).stdout.decode()
    except (OSError, subprocess.CalledProcessError):
        return False, {}
    result = {}
    for p in tracked:
        if p:
            result[p] = 'committed'
    for entry in status.split('\0'):
        if len(entry) > 3:
            code, rel = entry[:2], entry[3:]
            rel = rel[len(prefix):] if prefix and rel.startswith(prefix) else rel
            result[rel] = 'untracked' if code == '??' else 'modified:' + code.strip()
    # ls-files paths are relative to -C (the project); porcelain paths to the repo top.
    return True, result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    here = Path(__file__).resolve().parent
    ap.add_argument('--project', type=Path, default=here.parent)
    ap.add_argument('--bundle-dir', default='Assets/CastleSliceBundle')
    ap.add_argument('--scenes-dir', default='Assets/CastleSliceGenerated')
    ap.add_argument('--known', type=Path, default=here / 'known_unity_guids.json')
    ap.add_argument('--package-root', type=Path, action='append', default=[], help='read-only package source tree whose .meta GUIDs count as resolved (e.g. the Editor BuiltInPackages folder)')
    ap.add_argument('--allow-uncommitted', action='store_true', help='accept .meta files present on disk but not committed (pre-commit staging check only)')
    ap.add_argument('--compare', type=Path, help='other project Assets directory; report GUIDs that differ for byte-identical assets')
    ap.add_argument('--receipt', type=Path, help='build inputs JSON {"inputs": {path: sha256}}; .meta hashes must match')
    ap.add_argument('--receipt-scope', choices=['closure', 'all'], default='closure', help='closure: bundle, generated and scene-referenced metas gate (default); all: every receipt .meta gates')
    a = ap.parse_args(argv)

    project = a.project.resolve()
    errors, warnings = [], []
    rel = lambda p: Path(p).resolve().relative_to(project).as_posix()
    bundle_dir, scenes_dir = project / a.bundle_dir, project / a.scenes_dir
    if not bundle_dir.is_dir():
        errors.append(f'bundle directory missing: {a.bundle_dir}')

    # --- 1. Bundle .meta closure -------------------------------------------------
    need_meta = []  # project-relative assets that must have a .meta
    parent = bundle_dir
    while parent != project / 'Assets' and project / 'Assets' in parent.parents:
        need_meta.append(parent)
        parent = parent.parent
    bundle_files = []
    if bundle_dir.is_dir():
        for path, is_dir in walk_assets(bundle_dir):
            need_meta.append(path)
            if not is_dir:
                bundle_files.append(path)
        for meta in bundle_dir.rglob('*.meta'):
            if not meta.with_suffix('').exists():
                warnings.append(f'orphan .meta without asset: {rel(meta)}')
    bundles = {}
    for path in bundle_files:
        if path.suffix == '.json':
            try:
                data = json.loads(path.read_text(encoding='utf-8-sig'))
            except ValueError as e:
                errors.append(f'unreadable bundle JSON {rel(path)}: {e}')
                continue
            if not isinstance(data, dict) or not isinstance(data.get('assets'), list):
                continue
            for asset in data['assets']:
                target = path.parent / asset.get('file', '')
                if not target.is_file():
                    errors.append(f'{rel(path)} lists missing asset file: {asset.get("file")}')
                elif asset.get('sha256') and sha256(target) != asset['sha256'].removeprefix('sha256:'):
                    errors.append(f'{rel(path)} asset hash mismatch: {asset.get("file")}')
            bundles[rel(path)] = {'assets': len(data['assets']), 'sha256': sha256(path)}
    meta_guids = {}
    for path in need_meta:
        meta = Path(str(path) + '.meta')
        if not meta.is_file():
            errors.append(f'missing .meta: {rel(path)}' + (' (folder)' if path.is_dir() else ''))
            continue
        g = meta_guid(meta)
        if not g:
            errors.append(f'.meta has no valid guid line: {rel(meta)}')
        else:
            meta_guids[rel(meta)] = g

    git_ok, status = git_status(project, [rel(Path(str(p) + '.meta')) for p in need_meta if Path(str(p) + '.meta').is_file()] or ['Assets'])
    uncommitted = []
    for m in sorted(meta_guids):
        state = status.get(m, 'untracked' if git_ok else 'unknown')
        if state != 'committed':
            uncommitted.append(f'{m} ({state})')
    if not git_ok:
        (warnings if a.allow_uncommitted else errors).append('git unavailable or project not in a repository: cannot prove .meta files are committed')
    elif uncommitted:
        (warnings if a.allow_uncommitted else errors).append(f'{len(uncommitted)} bundle .meta file(s) not committed: ' + ', '.join(uncommitted))

    # --- 2. Generated-scene GUID closure -----------------------------------------
    index = guid_index(project / 'Assets', project / 'Packages')
    for g, paths in index.items():
        if len(paths) > 1:
            errors.append(f'duplicate GUID {g}: ' + ', '.join(rel(p) for p in paths))
    known = json.loads(a.known.read_text(encoding='utf-8')) if a.known and a.known.is_file() else {}
    known = {k: v for k, v in known.items() if re.fullmatch(r'[0-9a-f]{32}', k)}
    package_index = guid_index(*[p.resolve() for p in a.package_root])
    references = {}
    scene_files = sorted(p for p, d in walk_assets(scenes_dir) if not d and p.suffix in YAML_SUFFIXES) if scenes_dir.is_dir() else []
    if not scene_files:
        errors.append(f'no generated YAML assets found in {a.scenes_dir}')
    for scene in scene_files:
        raw = scene.read_bytes()
        if not raw.startswith(b'%YAML'):
            warnings.append(f'binary-serialized, GUIDs not inspected: {rel(scene)}')
            continue
        for g in GUID_REF.findall(raw):
            references.setdefault(g.decode(), set()).add(rel(scene))
    resolved, unresolved = {}, {}
    for g, users in sorted(references.items()):
        if g == NULL_GUID:
            continue
        if g in index:
            target = index[g][0]
            resolved[g] = {'asset': rel(target), 'kind': 'project'}
            if not target.exists():
                errors.append(f'GUID {g} resolves to a .meta whose asset is missing: {rel(target)}')
        elif g in known:
            resolved[g] = {'asset': known[g].get('name'), 'kind': 'known:' + known[g].get('source', '?')}
        elif g in package_index:
            resolved[g] = {'asset': package_index[g][0].as_posix(), 'kind': 'package-root'}
        else:
            unresolved[g] = sorted(users)
    for g, users in unresolved.items():
        errors.append(f'unresolved GUID {g} referenced by ' + ', '.join(users))
    # Importer scripts named inside bundle .meta files (e.g. glTFast). Registry
    # packages are not readable without Library, so these are informational.
    importers = {}
    for m in meta_guids:
        for g in set(x.decode() for x in GUID_REF.findall((project / m).read_bytes())) - {meta_guids[m], NULL_GUID}:
            importers.setdefault(g, []).append(m)
    importer_unresolved = sorted(g for g in importers if g not in index and g not in known and g not in package_index)
    for g in importer_unresolved:
        warnings.append(f'importer GUID {g} (in {len(importers[g])} bundle .meta) not verifiable from project/known/package roots')

    report = {'status': None, 'project': str(project), 'bundleDir': a.bundle_dir, 'scenesDir': a.scenes_dir,
              'bundles': bundles, 'bundleMetas': len(meta_guids), 'uncommittedMetas': len(uncommitted),
              'sceneFiles': [rel(s) for s in scene_files], 'referencedGuids': len([g for g in references if g != NULL_GUID]),
              'resolved': {'project': sum(1 for v in resolved.values() if v['kind'] == 'project'),
                           'known': sorted(g for g, v in resolved.items() if v['kind'].startswith('known')),
                           'packageRoot': sorted(g for g, v in resolved.items() if v['kind'] == 'package-root')},
              'unresolved': unresolved}

    # --- 3. Optional cross-project comparison ------------------------------------
    if a.compare:
        other = a.compare.resolve()
        if not other.is_dir():
            errors.append(f'--compare directory missing: {other}')
        else:
            scoped = {}
            for p in bundle_files + scene_files + [index[g][0] for g, v in resolved.items() if v['kind'] == 'project']:
                if p.is_file() and Path(str(p) + '.meta').is_file():
                    scoped[rel(p)] = p
            sizes = {p.stat().st_size for p in scoped.values()}
            other_by_hash = {}
            for path, is_dir in walk_assets(other):
                if not is_dir and path.stat().st_size in sizes:
                    meta = Path(str(path) + '.meta')
                    other_by_hash.setdefault(sha256(path), []).append((path.relative_to(other.parent).as_posix(), meta_guid(meta) if meta.is_file() else None))
            divergent, same, absent = [], 0, []
            for r, p in sorted(scoped.items()):
                mine = meta_guid(Path(str(p) + '.meta'))
                matches = other_by_hash.get(sha256(p), [])
                if not matches:
                    absent.append(r)
                    continue
                differing = [{'path': op, 'guid': og} for op, og in matches if og != mine]
                if differing:
                    divergent.append({'asset': r, 'guid': mine, 'other': differing})
                if any(og == mine for _, og in matches):
                    same += 1
            report['compare'] = {'other': str(other), 'scopedAssets': len(scoped), 'sameGuidIdentical': same,
                                 'divergentGuidIdentical': len(divergent), 'noIdenticalCopy': len(absent),
                                 'divergent': divergent, 'noIdenticalCopyAssets': absent}
            if divergent:
                warnings.append(f'{len(divergent)} byte-identical asset(s) carry different GUIDs in {other}; never transfer metas between these copies by path')

    # --- 4. Optional receipt .meta hash check ------------------------------------
    if a.receipt:
        inputs = json.loads(a.receipt.read_text(encoding='utf-8-sig')).get('inputs', {})
        metas = {k: v for k, v in inputs.items() if k.endswith('.meta')}
        # Gating scope: bundle metas, generated-asset metas and metas of project
        # assets the generated scenes reference. --receipt-scope all gates every entry.
        in_scope = set(meta_guids) | {rel(Path(str(p) + '.meta')) for p in scene_files}
        in_scope |= {rel(Path(str(index[g][0]) + '.meta')) for g, v in resolved.items() if v['kind'] == 'project'}
        matched, mismatched, missing, outside = [], [], [], []
        for k, v in sorted(metas.items()):
            p = project / k
            state = 'missing' if not p.is_file() else 'mismatch' if sha256(p) != v else 'match'
            if state == 'match':
                matched.append(k)
            elif a.receipt_scope == 'all' or k in in_scope:
                (missing if state == 'missing' else mismatched).append(k)
            else:
                outside.append(f'{k} ({state})')
        not_covered = sorted(m for m in in_scope if m not in metas and (project / m).is_file())
        other_changed = sorted(k for k, v in inputs.items() if not k.endswith('.meta') and (project / k).is_file() and sha256(project / k) != v)
        report['receipt'] = {'file': str(a.receipt), 'scope': a.receipt_scope, 'metaEntries': len(metas), 'matched': len(matched),
                             'mismatched': mismatched, 'missing': missing, 'outOfScopeDifferences': outside,
                             'scopedMetasNotInReceipt': not_covered, 'nonMetaInputsChangedSinceReceipt': other_changed}
        errors += [f'receipt .meta hash mismatch: {k}' for k in mismatched] + [f'receipt .meta missing from project: {k}' for k in missing]
        if not_covered:
            warnings.append(f'{len(not_covered)} scoped .meta file(s) not covered by the receipt (new since that build)')

    report['status'] = 'failed' if errors else 'passed'
    report['errors'], report['warnings'] = errors, warnings
    report['scope'] = 'Static .meta/GUID closure only; no Unity import, compile, rendering or build claim'
    print(json.dumps(report, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
