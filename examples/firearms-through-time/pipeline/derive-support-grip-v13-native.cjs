// Derive the support grip v13 native delivery scripts from the qualified rifle v12 and No.4 v11 ones. Only the hands revision, the arm
// rig and the destinations change (RifleV13, BoltV13); RifleV12 and BoltV11 stay as they are. Every replacement must match its count.
const fs=require('fs'),path=require('path');
const dir=__dirname;
const jobs=[
 ['stage-rifle-v12-native.mjs','stage-rifle-v13-native.mjs',[
  ['// Rifle v12: the v3b sight revision, the cocked-Ready motion v2 and the derived view v2 (owner sight decisions, 27 Oct).','// Rifle v13: support grip v13 (hands v2 rebuilt from arm rig v2) on the v12 gun, token, motion v2 and view v2. Same revisions as game/rifle-asset-pins-v3.json.'],
  ["const dir='evidence/rifle-v12-delivery'","const dir='evidence/rifle-v13-delivery'"],
  ["hands:await read('authoring/rifle-hands-v1-pins.json')","hands:await read('authoring/rifle-hands-v2-pins.json')"],
  ["const files=['game/rifle-game-contract.json'","const browser=(await read('game/rifle-asset-pins-v3.json')).assets;for(const k of Object.keys(pins))assert.equal(pins[k].revisionId,browser[k].revisionId,'Native and browser pins differ: '+k);\nconst files=['game/rifle-game-contract.json'"],
  ["'game/rifle-arm-rig-v1.json'","'game/rifle-arm-rig-v2.json'",2],
  ["destination:'/Game/Qualification/RifleV12'","destination:'/Game/Qualification/RifleV13'"]]],
 ['stage-bolt-native.mjs','stage-bolt-v13-native.mjs',[
  ["import fs from 'node:fs/promises';\n","// No.4 v13: support grip v13 (hands v2 rebuilt from arm rig v2); gun, charger cue, motion v1 and view v2 as in v11. Inputs are game/bolt-no4-asset-pins-v2.json.\nimport fs from 'node:fs/promises';\n"],
  ["const dir='evidence/bolt-v11-delivery'","const dir='evidence/bolt-v13-delivery'"],
  ["read('game/bolt-no4-asset-pins-v1.json')","read('game/bolt-no4-asset-pins-v2.json')"],
  ["hands:await read('authoring/bolt-hands-v1-pins.json')","hands:await read('authoring/bolt-hands-v2-pins.json')"],
  ["'game/bolt-no4-arm-rig-v1.json'","'game/bolt-no4-arm-rig-v2.json'",2],
  ["destination:'/Game/Qualification/BoltV11'","destination:'/Game/Qualification/BoltV13'"]]],
 ['prepare_rifle_v12.py','prepare_rifle_v13.py',[
  ['"""Rifle v12 (v3b sights, cocked Ready).','"""Rifle v13 (support grip v13: hands v2 and arm rig v2 on the v3b sights and cocked Ready). RifleV12 is preserved.'],
  ["['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','BoltV11','SightV11','RangeDressingV1Generated']","['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RifleV12','BoltV11','BoltV13','SightV11','RangeDressingV1Generated']"],
  ["rifle-v12-delivery/manifest.json","rifle-v13-delivery/manifest.json"],
  ["dest=='/Game/Qualification/RifleV12'","dest=='/Game/Qualification/RifleV13'"],
  ["rifle-v12-native-before.json","rifle-v13-native-before.json"],
  ["rifle-v12-native-import-checkpoint.json","rifle-v13-native-import-checkpoint.json"],
  ["['game/rifle-arm-rig-v1.json']","['game/rifle-arm-rig-v2.json']"],
  ["(C/'RifleV12').rglob","(C/'RifleV13').rglob"],
  ["rifle-v12-native-import.json","rifle-v13-native-import.json"],
  ["RIFLE_V12_IMPORT_PASS","RIFLE_V13_IMPORT_PASS"]]],
 ['fix_rifle_v12_nanite_usage.py','fix_rifle_v13_nanite_usage.py',[
  ['RifleV12','RifleV13',5],
  ["['NativeOverrides','RangeSliceOverrides','WeaponGenerated']","['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RifleV12','BoltV11','BoltV13','SightV11','RangeDressingV1Generated']"],
  ["rifle-v12-nanite-usage.json","rifle-v13-nanite-usage.json"],
  ["RIFLE_V10_NANITE_USAGE_PASS","RIFLE_V13_NANITE_USAGE_PASS"]]],
 ['prepare_bolt_v11.py','prepare_bolt_v13.py',[
  ['"""Import pinned No.4 bolt profile derivatives only;','"""No.4 v13 (support grip v13: hands v2 and arm rig v2). BoltV11 is preserved. Import pinned No.4 bolt profile derivatives only;'],
  ["['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RangeDressingV1Generated']","['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RifleV12','RifleV13','BoltV11','SightV11','RangeDressingV1Generated']"],
  ["bolt-v11-delivery/manifest.json","bolt-v13-delivery/manifest.json"],
  ["dest=='/Game/Qualification/BoltV11'","dest=='/Game/Qualification/BoltV13'"],
  ["bolt-v11-native-before.json","bolt-v13-native-before.json"],
  ["bolt-v11-native-import-checkpoint.json","bolt-v13-native-import-checkpoint.json"],
  ["['game/bolt-no4-arm-rig-v1.json']","['game/bolt-no4-arm-rig-v2.json']"],
  ["(C/'BoltV11').rglob","(C/'BoltV13').rglob"],
  ["bolt-v11-native-import.json","bolt-v13-native-import.json"],
  ["BOLT_V11_IMPORT_PASS","BOLT_V13_IMPORT_PASS"]]],
 ['fix_bolt_v11_nanite_usage.py','fix_bolt_v13_nanite_usage.py',[
  ['BoltV11','BoltV13',4],
  ["['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RangeDressingV1Generated']","['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RifleV12','RifleV13','BoltV11','SightV11','RangeDressingV1Generated']"],
  ["bolt-v11-nanite-usage.json","bolt-v13-nanite-usage.json"],
  ["BOLT_V11_NANITE_USAGE_PASS","BOLT_V13_NANITE_USAGE_PASS"]]]];
// Validate every job before writing anything.
const out=jobs.map(([from,to,pairs])=>{const raw=fs.readFileSync(path.join(dir,from),'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');
 for(const [a,b,n=1] of pairs){const found=s.split(a).length-1;if(found!==n)throw Error(`${from}: expected ${n} of ${a.slice(0,70)}, found ${found}`);s=s.split(a).join(b);}
 const target=path.join(dir,to);if(fs.existsSync(target))throw Error('Exists: '+to);return [target,s.replace(/\n/g,eol)];});
for(const [target,text] of out)fs.writeFileSync(target,text);
console.log('derived',out.map(([t])=>path.basename(t)).join(', '));
