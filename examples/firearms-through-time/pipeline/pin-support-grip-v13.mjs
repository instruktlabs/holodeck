// Promote the support-grip v13 hands (rifle-hands-v2, bolt-no4-hands-v2) to new browser pins. Earlier pins and aliases stay as they are.
import {readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
const exists=p=>access(p).then(()=>true,()=>false);
async function hands(receiptFile){const r=await read(receiptFile),glb=r.files['asset.glb'],bytes=await readFile(glb.path),sha256=hash(bytes);
 assert.equal(sha256,glb.sha256,receiptFile+' saved revision hash');assert.equal(bytes.length,glb.bytes,receiptFile+' saved revision size');assert(glb.path.includes(r.revisionId),receiptFile+' must be a saved immutable revision');
 if(await exists(r.alias))assert.equal(hash(await readFile(r.alias)),sha256,r.alias+' exists with other content');else await copyFile(glb.path,r.alias);
 return {assetId:r.assetId,revisionId:r.revisionId,source:glb.path,alias:r.alias,sha256,bytes:bytes.length,receipt:receiptFile};}
// [pins this replaces, new pins, hands receipt]. Gun and token carry over unchanged, after a hash check.
const plan=[['game/rifle-asset-pins-v2.json','game/rifle-asset-pins-v3.json','authoring/rifle-hands-v2-pins.json'],['game/bolt-no4-asset-pins-v1.json','game/bolt-no4-asset-pins-v2.json','authoring/bolt-hands-v2-pins.json']];
for(const [from,to,receipt] of plan){const old=await read(from);
 for(const [key,p] of Object.entries(old.assets))if(key!=='hands')for(const file of [p.source,p.alias])assert.equal(hash(await readFile(file)),p.sha256,from+' '+key+' '+file);
 const next=JSON.stringify({...old,assets:{...old.assets,hands:await hands(receipt)}},null,2)+'\n';
 if(await exists(to))assert.equal(await readFile(to,'utf8'),next,to+' exists with other content');else await writeFile(to,next);
 console.log(to,'hands',old.assets.hands.revisionId,'->',JSON.parse(next).assets.hands.revisionId);}
