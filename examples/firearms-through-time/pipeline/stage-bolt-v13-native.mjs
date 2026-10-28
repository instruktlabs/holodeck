// No.4 v13: support grip v13 (hands v2 rebuilt from arm rig v2); gun, charger cue, motion v1 and view v2 as in v11. Inputs are game/bolt-no4-asset-pins-v2.json.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {nativeDelivery} from './rigid-native-delivery.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^﻿/,''));
const dir='evidence/bolt-v13-delivery';await fs.mkdir(dir,{recursive:true});
const browser=(await read('game/bolt-no4-asset-pins-v2.json')).assets,pins={gun:await read('authoring/firearm-bolt-v2-pins.json'),hands:await read('authoring/bolt-hands-v2-pins.json'),token:await read('authoring/bolt-charger-cue-v1-pins.json')};
const input={};
for(const [k,p]of Object.entries(browser)){const bytes=await fs.readFile(p.source);assert.equal(hash(bytes),p.sha256,`Pin bytes ${k}`);input[k]={glb:p.source,sha256:'sha256:'+p.sha256,assetId:p.assetId,revisionId:p.revisionId};
 if(k!=='hands')input[k]=await nativeDelivery(input[k],`${dir}/${k}.glb`,{reviewAnimations:k==='gun'?{Inspect_Bolt_Exterior:['Joint_BoltLift','Joint_BoltSlide.translation']}:{}});}
const files=['game/bolt-no4-game-contract.json','game/bolt-no4-motion-v1.json','game/bolt-no4-arm-rig-v2.json','game/bolt-no4-view-v2.json'];
const metadata={};for(const file of files){const b=await fs.readFile(file);metadata[file]={sha256:hash(b),data:JSON.parse(b)};}
const rig=metadata['game/bolt-no4-arm-rig-v2.json'].data;
for(const arm of Object.values(rig.arms)){const rest=solveArmIK(arm.shoulder,arm.wrist,arm.pole,arm.upperLength,arm.forearmLength);arm.lowerAxis=arm.wrist.map((x,i)=>(x-rest.elbow[i])/arm.forearmLength);}
const motion=metadata['game/bolt-no4-motion-v1.json'].data,rules=metadata['game/bolt-no4-game-contract.json'].data;
assert.equal(motion.clips.Fire.duration,rules.cooldown);assert.equal(motion.clips.Reload.duration,rules.reload);assert.equal(motion.reloadCommitPhase,rules.reloadCommitPhase);assert.equal(rig.bones,41);
for(const name of ['Joint_BoltSlide','Joint_BoltLift','Joint_FrontSight','Joint_RearSight','anchor_eye','anchor_interaction_bolt','anchor_sight_rear','anchor_sight_front','anchor_vfx_muzzle'])assert(input.gun.nodes.some(n=>n.semantic===name),'Missing '+name);
assert(input.gun.meshes.some(m=>input.gun.nodes.find(n=>n.key===m.parent)?.semantic==='Joint_BoltLift'),'Bolt lift owns meshes');
const payload={schemaVersion:1,destination:'/Game/Qualification/BoltV13',input,metadata,pins,performance:'DIRTY'};
await fs.writeFile(`${dir}/manifest.json`,JSON.stringify(payload,null,2));console.log(JSON.stringify({manifest:`${dir}/manifest.json`,parts:input.gun.meshes.length,tokenParts:input.token.meshes.length,sources:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v.sha256]))}));
