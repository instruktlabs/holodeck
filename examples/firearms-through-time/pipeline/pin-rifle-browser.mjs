// Promote exact, saved revisions only. Never replace the canonical pistol aliases.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const inputs={gun:['authoring/rifle-1866-v2-pins.json','authoring/rifle-1866-v2.glb'],hands:['authoring/rifle-hands-v1-pins.json','authoring/rifle-hands-v1.glb'],token:['authoring/rifle-1866-v2-loading-token-pins.json','authoring/rifle-loading-token-v1.glb']};
const assets={},copies=[];
for(const [key,[receipt,alias]]of Object.entries(inputs)){
 const pin=await read(receipt),file=pin.files['asset.glb'],source=pin.glb??file.path,bytes=await readFile(source),sha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha256,file.sha256.replace(/^sha256:/,''),key+' saved revision hash');
 assert(pin.assetId&&pin.revisionId&&source.includes(pin.revisionId),key+' must be a saved immutable revision');
 assets[key]={assetId:pin.assetId,revisionId:pin.revisionId,source,alias,sha256,bytes:bytes.length,receipt};copies.push([source,alias]);
}
for(const [source,alias]of copies)await copyFile(source,alias);
await writeFile('game/rifle-asset-pins-v1.json',JSON.stringify({schemaVersion:1,profile:'rifle1866',assets},null,2)+'\n');
console.log(JSON.stringify({ok:true,assets},null,2));
