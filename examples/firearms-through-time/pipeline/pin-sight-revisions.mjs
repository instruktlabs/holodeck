// Promote the owner-approved sight revisions (pistol v6, 1866 v3) to new browser aliases. The v5 pistol and v2 rifle aliases stay pinned.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function gun(pinsFile,alias){const p=await read(pinsFile),source=p.artifacts.glb.path,bytes=await readFile(source),sha256=hash(bytes);
 assert.equal(sha256,p.artifacts.glb.sha256.replace(/^sha256:/,''),pinsFile+' saved revision hash');assert(source.includes(p.revisionId),pinsFile+' must be a saved immutable revision');
 await copyFile(source,alias);return {assetId:p.assetId,revisionId:p.revisionId,source,alias,sha256,bytes:bytes.length,receipt:pinsFile};}
const which=process.argv.slice(2);
if(which.includes('pistol')){const old=(await read('game/asset-pins.json')).assets;
 await writeFile('game/pistol-asset-pins-v2.json',JSON.stringify({schemaVersion:1,profile:'pistol',assets:{pistol:await gun('authoring/first-pistol-v6-pins.json','authoring/first-pistol-v6.glb'),hands:{...old.hands,alias:'authoring/first-hands.glb'}}},null,2)+'\n');}
if(which.includes('rifle')){const old=(await read('game/rifle-asset-pins-v1.json')).assets;
 await writeFile('game/rifle-asset-pins-v2.json',JSON.stringify({schemaVersion:1,profile:'rifle1866',assets:{gun:await gun('authoring/rifle-1866-v3-pins.json','authoring/rifle-1866-v3.glb'),hands:old.hands,token:old.token}},null,2)+'\n');}
console.log('pinned',which.join(','));
