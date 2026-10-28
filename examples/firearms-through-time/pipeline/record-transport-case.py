"""Assemble receipts from this bounded study; never synthesizes renderer results."""
import hashlib, json, re
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
evidence = root / 'evidence'
def read(name):
    return json.loads((evidence / name).read_text(encoding='utf-8-sig'))
def text(name):
    return (evidence / name).read_text(encoding='utf-8-sig')

saved = read('transport-case-saved.json')['asset']
render = read('transport-case-final-render.json')
delivery = read('transport-case-holodeck-delivery.json')
native = read('transport-case-packaged-cubemap-run.json')
source = root / 'authoring/museum-transport-case-final.glb'
sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert 'sha256:' + sha == saved['files']['asset.glb']['sha256']
assert delivery['ok'] and delivery['sourceSha256'] == sha
assert native['status'] == 'passed' and native['map'] == 'TransportCaseLab'
assert native['exitCode'] == 0 and native['dx12sm6'] and len(native['checks']) == 5
assert all(' PASS' in check for check in native['checks'])
assert Path(native['capture']).is_file()
stop, held, resumed, reset = [text('transport-case-webgl-'+name+'.txt') for name in ('stop','held','resumed','reset')]
pose = lambda t: re.search(r'museum-case :\s+stopped\s+/\s+([\d.]+)', t).group(1)
assert pose(stop) == pose(held) == '4.44'
assert 'WebGL2' in held and 'running  /  5.13' in resumed
assert '0.00  s  · paused' in reset and 'museum-case :  running  /  0.00' in reset

summary = {
 'asOf': datetime.now(timezone.utc).isoformat(), 'source': {'assetId':saved['assetId'],'revisionId':saved['revisionId'],'sha256':sha,'bytes':source.stat().st_size,'triangles':render['tris'],'boundsMetres':render['bounds']['size'],'meshCount':5,'imageCount':6},
 'native': {'map':native['map'],'checks':native['checks'],'dx12sm6':native['dx12sm6'],'capture':native['capture'],'receipt':'evidence/transport-case-packaged-cubemap-run.json'},
 'holodeck': {'savedRevision':delivery['worldRevision'],'sourceAndSharedTextureIntegrity':True,'textureCount':len(delivery['servedTextures']),'webgl2':{'stopHeldRadians':4.44,'resumeObservedRadians':5.13,'resetRadians':0},'webgpuEvidence':['transport-case-browser-stop-ax.txt','transport-case-browser-held-ax.txt','transport-case-browser-start-ax.txt','transport-case-browser-reset-ax.txt','transport-case-holodeck-sky-fixed.png'],'sourceFix':'Explicit sky and sky.light work without terrain/water; optional bounce also honored; 340 runtime tests and build passed.'},
 'visualReview': {'inspected':['authoring/museum-transport-case-final.png','evidence/transport-case-holodeck-sky-fixed.png','evidence/transport-case-holodeck-webgl-sky-fixed.png','evidence/calibration-native-case-cubemap.png',native['capture']],'observed':'Gray steel is visible after consumer environment corrections, with no source-albedo edits. Wood, paint, label, rubber and hardware render in both engines.','limits':['Not pixel-identical: floor, shadowing and display transforms differ.','Unreal floor speckling remains undiagnosed.','Micro-normal read-back is not an asymmetric orientation stress test.','Explicit SimpleAverage mips are a baseline setting, not proof that texture softness is resolved.','Viewports and moving packaged capture differ; do not use these whole-image screenshots as pixel-difference metrics.','No atlas, distance/LOD, collision, hinge, scalability or performance qualification.','Realistic case has not repeated the earlier fixture native-override reimport test.']},
 'reuse': {'genericKiln':'Asset identity, procedural source, channel contract and immutable delivery manifest.','unreal':'Importer profile, native override ownership, environment diagnosis, package/run receipts.','holodeck':'Explicit sky activation and world interaction.','uefn':'Research only: official MCP, Python and Interchange documented; optional adapter trial proposed, not installed or tested.'},
 'references':['native/.agents/skills/kiln-unreal-delivery/references/pbr-transport-case.md','evidence/transport-case-native-import.json','evidence/transport-case-source-textures.json','evidence/transport-case-environment-fix.json','evidence/material-sampling-native-profile.json']
}
(evidence/'transport-case-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
ledger = read('integration-learning-ledger.json')
entries = [
 {'id':'CONSTRUCT-SKY-001','topic':'consumer lighting','status':'failure-corrected-locally','observed':'Explicit Holodeck sky/light was not mounted in construct world without terrain/water. Separate mounting fixed metal response on WebGPU and WebGL2. Existing 340 runtime tests and production build pass.','owner':'holodeck','reuseDecision':'Consumer fix; do not compensate in Kiln source albedo.','evidence':['evidence/transport-case-holodeck-sky-fixed.png','evidence/transport-case-holodeck-webgl-sky-fixed.png','evidence/holodeck-sky-build.log']},
 {'id':'PBR-TRANSPORT-001','topic':'portable PBR','status':'observed-pass-limited','observed':'Five material regions and six textures imported and rendered in Holodeck and Unreal. Source and shared image integrity pass; five packaged interaction assertions pass. Explicit native HDR cube restored metal response.','owner':'asset-and-consumer-adapters','reuseDecision':'Promote channel/read-back/environment diagnostic recipe into scoped skill; keep full BRDF, normals, mips and optimization as separate qualifications.','limits':summary['visualReview']['limits'],'evidence':['evidence/transport-case-summary.json','evidence/transport-case-native-import.json','evidence/transport-case-packaged-cubemap-run.json']},
 {'id':'MIP-PROFILE-001','topic':'sampling','status':'configuration-observed','observed':'Native filtering was already trilinear. Mip generation changed from inherited TextureGroup to explicit SimpleAverage. The filter-mismatch hypothesis was not supported.','owner':'unreal-adapter','reuseDecision':'Record filter and mip generation separately; no claim of resolved softness.','evidence':['evidence/material-sampling-native-profile.json']}
]
ids={entry['id'] for entry in entries}
ledger['entries']=[entry for entry in ledger['entries'] if entry['id'] not in ids]+entries
ledger['lastTransportCaseRun']=native['capture']
(evidence/'integration-learning-ledger.json').write_text(json.dumps(ledger,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'ok':True,'sha256':sha,'nativeChecks':len(native['checks']),'sharedTextures':len(delivery['servedTextures'])}))
