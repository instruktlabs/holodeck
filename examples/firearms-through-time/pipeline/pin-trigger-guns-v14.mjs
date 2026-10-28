// Browser pins for the round-v14 guns (Colt M4, Pattern 1742) from saved Kiln revision receipts. Each GLB is copied to its alias once;
// an alias or pins file that already exists must match exactly. Gun receipts list artifacts.glb ("sha256:" prefixed); hand and cue
// receipts list files['asset.glb'] and their own alias.
import {readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
const exists=p=>access(p).then(()=>true,()=>false);
async function pin(receiptFile,defaultAlias){
 const r=await read(receiptFile),glb=r.files?.['asset.glb']??r.artifacts?.glb;if(!glb)throw Error(receiptFile+' lists no asset.glb');
 const expected=String(glb.sha256).replace(/^sha256:/,''),bytes=await readFile(glb.path),sha256=hash(bytes),alias=r.alias??defaultAlias;
 assert.equal(sha256,expected,receiptFile+' saved revision hash');assert.equal(bytes.length,glb.bytes,receiptFile+' saved revision size');assert(glb.path.includes(r.revisionId),receiptFile+' must be a saved immutable revision');
 if(await exists(alias))assert.equal(hash(await readFile(alias)),sha256,alias+' exists with other content');else await copyFile(glb.path,alias);
 return {assetId:r.assetId,revisionId:r.revisionId,source:glb.path,alias,sha256,bytes:bytes.length,receipt:receiptFile};
}
const plan=[
 ['game/carbine-m4-asset-pins-v1.json','carbineM4',{gun:['authoring/firearm-carbine-v3-pins.json','authoring/carbine-m4-v3.glb'],hands:['authoring/carbine-m4-hands-v1-pins.json','authoring/carbine-m4-hands-v1.glb']}],
 ['game/flintlock-1742-asset-pins-v1.json','flintlock1742',{gun:['authoring/firearm-flintlock-v3-pins.json','authoring/flintlock-1742-v3.glb'],hands:['authoring/flintlock-1742-hands-v1-pins.json','authoring/flintlock-1742-hands-v1.glb'],token:['authoring/flintlock-1742-cartridge-v1-pins.json','authoring/flintlock-1742-cartridge-v1.glb']}],
];
const only=process.argv.slice(2);
for(const [file,profile,assets] of plan){if(only.length&&!only.includes(profile))continue;
 const pinned={};for(const [key,[receipt,alias]] of Object.entries(assets))pinned[key]=await pin(receipt,alias);
 const next=JSON.stringify({schemaVersion:1,profile,assets:pinned},null,2)+'\n';
 if(await exists(file))assert.equal(await readFile(file,'utf8'),next,file+' exists with other content');else await writeFile(file,next);
 console.log(file+': '+Object.entries(pinned).map(([k,p])=>`${k} ${p.revisionId} ${p.sha256.slice(0,12)}`).join('; '));
}
