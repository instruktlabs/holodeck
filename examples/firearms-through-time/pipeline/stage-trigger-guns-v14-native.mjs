// Round v14 held-trigger guns (Colt M4 now; the Pattern 1742 joins once its assets are delivered): native derivatives and game metadata
// from the browser pins (game/<profile>-asset-pins-v1.json). The M4's magazine in hand is a copy of the gun's own magazine meshes, so the
// gun and the hands are its only inputs. Usage: node pipeline/stage-trigger-guns-v14-native.mjs [profile ...]
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {nativeDelivery} from './rigid-native-delivery.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^﻿/,''));
const plans={
 carbineM4:{dir:'evidence/carbine-v14-delivery',destination:'/Game/Qualification/CarbineV14',pins:'game/carbine-m4-asset-pins-v1.json',
  roles:{rules:'game/carbine-m4-game-contract.json',motion:'game/carbine-m4-motion-v1.json',rig:'game/carbine-m4-arm-rig-v1.json',view:'game/carbine-m4-view-v1.json'},
  nodes:['Joint_Magazine','Joint_ChargingHandle','Joint_FrontSight','Joint_RearSight','anchor_eye','anchor_interaction_magazine','anchor_sight_rear','anchor_sight_front','anchor_vfx_muzzle'],
  owners:['Joint_Magazine','Joint_ChargingHandle','Joint_RearSight']}
};
const near=(a,b,tolerance=1e-9)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=tolerance);
for(const profile of process.argv.length>2?process.argv.slice(2):Object.keys(plans)){
 const plan=plans[profile];assert(plan,'Unknown profile '+profile);await fs.mkdir(plan.dir,{recursive:true});
 const browser=(await read(plan.pins)).assets,pins={},input={};
 for(const [k,p] of Object.entries(browser)){const bytes=await fs.readFile(p.source);assert.equal(hash(bytes),p.sha256,`Pin bytes ${k}`);pins[k]=await read(p.receipt);input[k]={glb:p.source,sha256:'sha256:'+p.sha256,assetId:p.assetId,revisionId:p.revisionId};
  if(k!=='hands')input[k]=await nativeDelivery(input[k],`${plan.dir}/${k}.glb`);}
 const metadata={};for(const file of Object.values(plan.roles)){const b=await fs.readFile(file);metadata[file]={sha256:hash(b),data:JSON.parse(b)};}
 const {rules,motion,rig,view}=Object.fromEntries(Object.entries(plan.roles).map(([role,file])=>[role,metadata[file].data]));
 for(const arm of Object.values(rig.arms)){const rest=solveArmIK(arm.shoulder,arm.wrist,arm.pole,arm.upperLength,arm.forearmLength);arm.lowerAxis=arm.wrist.map((x,i)=>(x-rest.elbow[i])/arm.forearmLength);}
 assert.equal(rig.bones,41);for(const d of [rules,motion,view])assert.equal(d.profile,profile);
 for(const [name,seconds] of Object.entries(rules.clips))assert.equal(motion.clips[name]?.duration,seconds,'Clip '+name);
 assert.equal(motion.clips.Reload.duration,rules.reload);assert.equal(motion.clips.Inspect.duration,rules.inspect);assert.equal(motion.reloadCommitPhase,rules.reloadCommitPhase);
 const gun=input.gun,node=s=>gun.nodes.find(n=>n.semantic===s);
 for(const name of plan.nodes)assert(node(name),'Missing '+name);
 for(const owner of plan.owners)assert(gun.meshes.some(m=>gun.nodes.find(n=>n.key===m.parent)?.semantic===owner),owner+' owns meshes');
 if(profile==='carbineM4'){
  assert.equal(motion.clips.ReloadEmpty.duration,rules.reloadEmpty);assert.equal(motion.reloadEmptyCommitPhase,rules.reloadEmptyCommitPhase);
  // The motion moves these nodes from their delivered rest positions, and the cue is a copy of the magazine subtree.
  assert(near(node(motion.magazine.node).localPosition,motion.magazine.seatedPosition),'Magazine rest');
  // Both pivots hang off the gun root at its origin, so the browser's local offsets are the native pivots' frame.
  for(const n of [motion.magazine.node,motion.chargingHandle.node])assert(near(node(n).position,node(n).localPosition),n+' sits under the root');
  assert.equal(motion.magazineCue.parent,'Joint_left_left_wrist');
  for(const k of ['magOut','magCue','chargingHandle'])assert(motion.channels.includes(k),'Channel '+k);
 }
 const payload={schemaVersion:1,profile,destination:plan.destination,roles:plan.roles,input,metadata,pins,performance:'DIRTY'};
 await fs.writeFile(`${plan.dir}/manifest.json`,JSON.stringify(payload,null,2));
 console.log(JSON.stringify({profile,manifest:`${plan.dir}/manifest.json`,parts:gun.meshes.length,sources:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,v.sha256]))}));
}
