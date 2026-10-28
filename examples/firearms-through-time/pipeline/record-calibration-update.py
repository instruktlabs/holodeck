"""Collate measured calibration and source-update evidence, retaining old results."""
import json,hashlib,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(n):return json.loads((ROOT/'evidence'/n).read_text(encoding='utf-8-sig'))
def text(n):return (ROOT/'evidence'/n).read_text(encoding='utf-8-sig')
saved=read('exhibit-v2-saved.json')['asset'];native=read('native-update-result.json')
run=read('exhibit-packaged-latest.json');browser=read('holodeck-v2-delivery.json');cal=read('calibration-measurements.json')
h=hashlib.sha256((ROOT/'authoring/interaction-exhibit-v2.glb').read_bytes()).hexdigest()
assert h==native['sourceSha256']==browser['sourceSha256']==saved['files']['asset.glb']['sha256'][7:]
assert native['ok'] and browser['ok'] and run['status']=='passed' and run['dx12sm6'] and len(run['checks'])==8
assert all(c.endswith(' PASS') for c in run['checks'])
for file in ['holodeck-update-before-ax.txt','holodeck-update-loaded-ax.txt']:
 assert re.search(r'stopped\s+/\s+3\.72\s+rad',text(file))
assert re.search(r'running\s+/\s+0\.00\s+rad',text('holodeck-update-reset-ax.txt'))
assert 'revision 6' in text('holodeck-update-reloaded-ax.txt')
assert 'EXHIBIT_MATERIAL override=0.120000 source=0.550000 childRead=1 parentRead=1' in Path(run['log']).read_text(encoding='utf-8-sig')
assert Path(run['capture']).is_file()
limits=cal['limits']+['Hot-update state retention tested in Holodeck WebGPU; baseline interaction/chart also covered WebGL2.','Native verification is a fresh packaged launch, not live editor/game hot reload or physical keyboard input.','Native copper roughness is deliberately overridden; identical appearance is not expected. Floors differ and browser stripes appear softer; texture sampling remains unqualified.','Asset-only proposal preview reported no differences despite applying the update; this UI defect is unresolved.','No normal-map, packed-channel, atlas, mip-distance, LOD, HDR reflection, collision or performance qualification.']
summary={'asOf':'2026-10-26','status':'passed-with-stated-limits','asset':saved,'sourceSha256':h,'calibration':cal,'nativeImport':native,'nativePackaged':run,'holodeckDelivery':browser,'holodeckObservedInteraction':{'backend':'WebGPU','stoppedAngleBeforeAndAfterRad':3.72,'resumeObserved':True,'resetAngleRad':0,'reloadWorldRevision':6,'evidence':['holodeck-update-before-ax.txt','holodeck-update-loaded-ax.txt','holodeck-update-reset-ax.txt','holodeck-update-reloaded-ax.txt','holodeck-v2-resumed-ax.txt']},'visualReview':{'nativeCapture':run['capture'],'holodeckCapture':'evidence/holodeck-v2-final.png','inspected':True,'observed':'Wider checker panel, changed stripes and signed markers visible in both runtimes. Cove no longer casts the broad band over Holodeck panel. Dark metal and ground shadows remain under zero-fill lighting.'},'limits':limits}
(ROOT/'evidence/calibration-update-summary.json').write_text(json.dumps(summary,indent=2))
entries=[
 ('CALIBRATION','observed-pass-limited','Matched chart and native EV+0.09 reduced gray error from 6.08 to 2.04 code levels; maximum color residual 9.85. Keep chart measurements separate from presentation lighting.','calibration-measurements.json'),
 ('COVE-SHADOW','failure-corrected','Cove on/off screenshots isolated the wide shadow. Moving exhibit/spawn into clear space removed it. Test owner-visible surrounding geometry, not only isolated assets.','holodeck-v2-final.png'),
 ('NATIVE-UPDATE','failure-corrected','Mesh import and pipeline override alone skipped existing materials. Explicit generated material/texture reimports updated source roughness to 0.55; native child remains 0.12 and byte-identical. Eight packaged assertions passed.','native-update-result.json'),
 ('MATERIAL-SETTER','failure-corrected','MaterialEditingLibrary scalar setter returned false even with rendering enabled. Reflected parameter array with parent parameter info persisted and passed fresh runtime readback.','native-override-before-update.json'),
 ('HOLODECK-UPDATE','observed-pass-limited','WebGPU tab retained stopped 3.72 rad pose across asset update. Start/reset and revision6 reload passed. Preserve asset/object IDs and behavior contract.','holodeck-update-loaded-ax.txt'),
 ('PROPOSAL-DIFF','observed-open-defect','Asset-only proposal said no differences despite changed file/provenance and successful apply. Future diff should expose asset revision/hash changes.','world-update-proposal.json'),
 ('SHARED-TEXTURES','expected-behavior-verified','HTTP GLB is a derivative with extracted shared images. Pinned source, derivative bytes and both texture downloads verified. Track source and transport identities separately.','holodeck-v2-delivery.json')]
ledger=read('integration-learning-ledger.json');ids={'EXHIBIT-'+x[0]+'-002' for x in entries}
ledger['entries']=[e for e in ledger['entries'] if e['id'] not in ids]
for topic,status,observed,evidence in entries:
 ledger['entries'].append({'id':'EXHIBIT-'+topic+'-002','topic':topic.lower(),'status':status,'observed':observed,'sourceHashes':{'glb':h},'evidence':['evidence/'+evidence,'evidence/calibration-update-summary.json'],'limits':limits})
ledger['latestCalibrationUpdate']='evidence/calibration-update-summary.json'
ledger['lastExhibitPackagedRunId']=Path(run['log']).parent.name
(ROOT/'evidence/integration-learning-ledger.json').write_text(json.dumps(ledger,indent=2))
print(json.dumps({'status':summary['status'],'nativeChecks':len(run['checks']),'holodeckRevision':browser['worldRevision']}))
