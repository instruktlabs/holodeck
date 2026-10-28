// Promote exact, saved No.4 revisions only. Never replace the pistol or rifle aliases.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
const revisionDir=(a,r)=>`authoring/assets/kiln/${a}/revisions/${r}`;
// Write a receipt for each saved revision of this delivery, in the rifle receipts' shape.
async function receipt(save,file,extra){
 const {assetId,revisionId}=save.asset,dir=revisionDir(assetId,revisionId),files={};
 for(const name of ['asset.glb','source.kiln.js','preview.png']){const b=await readFile(dir+'/'+name);files[name]={path:dir+'/'+name,sha256:hash(b),bytes:b.length};}
 assert.equal('sha256:'+files['asset.glb'].sha256,save.asset.files['asset.glb'].sha256,file+' saved GLB hash');
 await writeFile(file,JSON.stringify({schemaVersion:1,collection:save.collection,assetId,revisionId,files,glb:files['asset.glb'].path,source:files['source.kiln.js'].path,...extra},null,2)+'\n');
}
await receipt(await read('evidence/bolt-hands-v1-save.json'),'authoring/bolt-hands-v1-pins.json',{assetContract:'bolt-hands-v1',profile:'boltNo4',materials:'materials/gloves-v5/pins.json',buildEnvironment:{KILN_GLTF_EXPORTER:'three'},authoring:'pipeline/bolt-hand-author.mjs (from the accepted rifle v10 hands source)'});
await receipt(await read('evidence/bolt-charger-cue-v1-save.json'),'authoring/bolt-charger-cue-v1-pins.json',{assetContract:'bolt-charger-cue-v1',profile:'boltNo4',source:'authoring/bolt-charger-cue-v1.kiln.js'});
const gunPins=await read('authoring/firearm-bolt-v2-pins.json');
const inputs={
 gun:{assetId:gunPins.assetId,revisionId:gunPins.revisionId,source:gunPins.artifacts.glb.path,sha256:gunPins.artifacts.glb.sha256,alias:'authoring/bolt-no4-v2.glb',receipt:'authoring/firearm-bolt-v2-pins.json'},
 hands:{...(await read('authoring/bolt-hands-v1-pins.json')),alias:'authoring/bolt-no4-hands-v1.glb',receipt:'authoring/bolt-hands-v1-pins.json'},
 token:{...(await read('authoring/bolt-charger-cue-v1-pins.json')),alias:'authoring/bolt-no4-charger-v1.glb',receipt:'authoring/bolt-charger-cue-v1-pins.json'}};
const assets={};
for(const [key,p]of Object.entries(inputs)){
 const source=p.glb??p.source,bytes=await readFile(source),sha256=hash(bytes);
 assert.equal(sha256,(p.sha256??p.files['asset.glb'].sha256).replace(/^sha256:/,''),key+' saved revision hash');
 assert(p.assetId&&p.revisionId&&source.includes(p.revisionId),key+' must be a saved immutable revision');
 await copyFile(source,p.alias);assets[key]={assetId:p.assetId,revisionId:p.revisionId,source,alias:p.alias,sha256,bytes:bytes.length,receipt:p.receipt};
}
await writeFile('game/bolt-no4-asset-pins-v1.json',JSON.stringify({schemaVersion:1,profile:'boltNo4',assets},null,2)+'\n');
console.log(JSON.stringify({ok:true,assets},null,2));
