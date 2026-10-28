"""Audit delivered crowd evidence. Run after the player exits, outside timings."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('run')
parser.add_argument('--out', required=True)
args = parser.parse_args()
run = Path(args.run)
read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
identity = read(run/'identity.json')
events = [json.loads(line) for line in (run/'progress.jsonl').read_text().splitlines() if line.strip()]
failures = []
if not events or events[-1]['kind'] != 'complete': failures.append('Player did not complete')
failures.extend(e.get('message','Player error') for e in events if e['kind']=='error')
results = [e for e in events if e['kind']=='result']
if not results: failures.append('No timing samples')
for result in results:
    if result['sourceSha256'] != identity['sourceSha256'] or result['buildIdentity'] != identity['buildIdentity']:
        failures.append('Result identity mismatch')
    if not result['animationAdvanced'] or result['renderedFrameCount'] <= 0: failures.append('No rendered animation')
captures = [e for e in events if e['kind']=='capture']
for capture in captures:
    path = run/capture['file']
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != capture['sha256']:
        failures.append('Missing or mismatched capture '+str(path))
    if not capture['nonUniform'] or not capture['stateMatches'] or not capture['phaseMatches'] or capture['settledRenderCallbacks'] < 3:
        failures.append('Unqualified rendered capture '+capture['file'])
animation = []
for result in results:
    count = result['count']
    distribution = read(run/f'animation-distribution-{count}.json')
    before = read(run/f'animation-samples-{count}-before-sample.json')['samples']
    after = read(run/f'animation-samples-{count}-after-sample.json')['samples']
    if len(distribution['assignments']) != count: failures.append('Incomplete animation assignment')
    if len(before) != min(16,count) or len(after) != len(before): failures.append('Incomplete multi-unit animation samples')
    deltas = []
    for first, last in zip(before, after):
        if first['unit'] != last['unit'] or not first['stateMatches'] or not last['stateMatches']:
            failures.append('Sampled unit/state mismatch')
        assigned = distribution['assignments'][first['unit']]
        if abs(first['speed']-assigned['speed'])>1e-5 or abs(last['speed']-assigned['speed'])>1e-5:
            failures.append('Runtime animation speed differs from assignment')
        delta = last['normalizedTime']-first['normalizedTime']
        if delta <= .001: failures.append('Sampled animation did not advance')
        deltas.append(delta)
    assignments = distribution['assignments']
    histogram = {state:sum(a['state']==state for a in assignments) for state in sorted({a['state'] for a in assignments})}
    if distribution['mode']=='all-walk' and any(not a['state'].lower().endswith('walk') for a in assignments):
        failures.append('All-walk stress mode contains another clip')
    animation.append({'count':count,'mode':distribution['mode'],'seed':distribution['seed'],'clips':histogram,
                      'phaseMin':min(a['phase'] for a in assignments),'phaseMax':max(a['phase'] for a in assignments),
                      'speedMin':min(a['speed'] for a in assignments),'speedMax':max(a['speed'] for a in assignments),
                      'uniqueAssignedPhases':len({a['phase'] for a in assignments}),
                      'sampledUnits':len(before),'allSampledUnitsAdvanced':all(delta>.001 for delta in deltas)})
    lod_path = run/f'lod-configuration-{count}.json'
    if lod_path.is_file():
        lod = read(lod_path)
        if lod['animators'] != 1 or lod['distinctBoneTransforms'] != 22: failures.append('Duplicated or changed animation skeleton')
log = (run/'player.log').read_text(errors='replace')
report = {'run':str(run),'sourceSha256':identity['sourceSha256'],'buildIdentity':identity['buildIdentity'],
          'gpu':identity['gpu'],'graphicsApi':identity['graphicsApi'],'animationMode':identity.get('animationMode'),
          'failures':failures,'structuralPass':not failures,'jobTempAllocWarnings':log.count('JobTempAlloc'),
          'capturedImagesHashVerified':len(captures),'animation':animation,
          'limits':['Animation phase/skin evidence is not navigation, combat, foot locking or visual approval.',
                    'Clean bounded samples are not sustained hardware capacity or a universal allocator fix.',
                    'Configured LOD geometry and instantiated triangles are not actual visible GPU submissions.']}
Path(args.out).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
raise SystemExit(1 if failures else 0)
