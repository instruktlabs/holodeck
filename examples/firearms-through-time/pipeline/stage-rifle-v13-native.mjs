// Rifle v13: support grip v13 (hands v2 rebuilt from arm rig v2) on the v12 gun, token, motion v2 and view v2. Same revisions as game/rifle-asset-pins-v3.json.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {nativeDelivery} from './rigid-native-delivery.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const dir='evidence/rifle-v13-delivery';await fs.mkdir(dir,{recursive:true});
const pins={gun:await read('authoring/rifle-1866-v3-pins.json'),hands:await read('authoring/rifle-hands-v2-pins.json'),token:await read('authoring/rifle-1866-v2-loading-token-pins.json')};
const input={};
for(const[k,p]of Object.entries(pins)){const file=p.files?.['asset.glb'];const glb=p.glb??file?.path??p.artifacts?.glb?.path;const sha=(file?.sha256??p.sha256??p.glbSha256??p.artifacts?.glb?.sha256)?.replace(/^sha256:/,'');assert(glb&&sha,`Missing exact GLB pin ${k}`);const bytes=await fs.readFile(glb);assert.equal(hash(bytes),sha,`Pin bytes ${k}`);input[k]={glb,sha256:'sha256:'+sha,assetId:p.assetId,revisionId:p.revisionId};if(k!=='hands')input[k]=await nativeDelivery(input[k],`${dir}/${k}.glb`,{reviewAnimations:k==='gun'?{PresentationLeverReview:['Joint_Lever','Joint_Hammer']}:{}});}
const browser=(await read('game/rifle-asset-pins-v3.json')).assets;for(const k of Object.keys(pins))assert.equal(pins[k].revisionId,browser[k].revisionId,'Native and browser pins differ: '+k);
const files=['game/rifle-game-contract.json','game/rifle-motion-v2.json','game/rifle-arm-rig-v2.json','game/rifle-view-v2.json'];
const metadata={};for(const file of files){const b=await fs.readFile(file);metadata[file]={sha256:hash(b),data:JSON.parse(b)};}
const rig=metadata['game/rifle-arm-rig-v2.json'].data;
for(const arm of Object.values(rig.arms)){const rest=solveArmIK(arm.shoulder,arm.wrist,arm.pole,arm.upperLength,arm.forearmLength);arm.lowerAxis=arm.wrist.map((x,i)=>(x-rest.elbow[i])/arm.forearmLength);}
const motion=metadata['game/rifle-motion-v2.json'].data,rules=metadata['game/rifle-game-contract.json'].data;
assert.equal(motion.clips.Fire.duration,rules.cooldown);assert.equal(motion.clips.Reload.duration,rules.reload);assert.equal(motion.reloadCommitPhase,rules.reloadCommitPhase);assert.equal(rig.bones,41);
const payload={schemaVersion:1,destination:'/Game/Qualification/RifleV13',input,metadata,pins,performance:'DIRTY'};
await fs.writeFile(`${dir}/manifest.json`,JSON.stringify(payload,null,2));console.log(JSON.stringify({manifest:`${dir}/manifest.json`,parts:input.gun.meshes.length,tokenParts:input.token.meshes.length,sources:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v.sha256]))}));
