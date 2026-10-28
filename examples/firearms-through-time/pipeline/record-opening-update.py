"""Read-only evidence aggregation; fails rather than accepting stale runtimes."""
import json,hashlib
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
def read(n):return json.loads((E/n).read_text(encoding='utf-8-sig'))
saved=read('opening-update-saved.json')['asset']
native=read('opening-update-native-result.json')
gpu=read('opening-update-holodeck-webgpu.json');gl=read('opening-update-holodeck-webgl.json')
delivery=read('opening-update-holodeck-delivery.json')
editor=read('opening-case-editor-game-latest.json');package=read('opening-case-packaged-latest.json')
build=read('validation-build-package-result.json')
assert native['ok'] and native['revision']==saved['revisionId']
assert gpu['ok'] and gl['ok'] and delivery['ok']
assert delivery['sourceRevision']==saved['revisionId']
for receipt in [editor,package]:
 assert receipt['status']=='passed' and len(receipt['checks'])==9 and receipt['dx12sm6']
 assert receipt['started']>saved['createdAt']
 assert all(Path(f).is_file() for f in receipt['captures'])
assert build['exitCode']==0 and package['started']>build['completed']
for o in native['overrides']:
 assert hashlib.sha256(Path(o['file']).read_bytes()).hexdigest()==o['sha256']
source=ROOT/'authoring/opening-case-update.glb'
assert 'sha256:'+hashlib.sha256(source.read_bytes()).hexdigest()==saved['files']['asset.glb']['sha256']
out={'ok':True,'checkedAt':datetime.now(timezone.utc).isoformat(),'asset':saved,'nativeReimport':native,'holodeck':{'webgpu':'opening-update-holodeck-webgpu.json','webgl':'opening-update-holodeck-webgl.json','delivery':delivery,'livePreservedAngleRadians':gpu['before']['runtime']['states']['museum-case']['angle']},'editorGame':editor,'packageBuild':build,'packagedGame':package,'limits':['Native saved reimport and fresh runtime tested; live PIE transient state not tested.','WebGPU hot update tested; WebGL2 reload and controls tested.','Stable part/material ordering only; arbitrary removal/reorder not qualified.','Visual inspection is not pixel-equivalent lighting or shader proof.']}
(E/'opening-update-summary.json').write_text(json.dumps(out,indent=2))
print(json.dumps({'ok':True,'revision':saved['revisionId'],'worldRevision':delivery['worldRevision'],'nativeChecks':len(native['checks']),'editorGameChecks':len(editor['checks']),'packagedGameChecks':len(package['checks'])}))
