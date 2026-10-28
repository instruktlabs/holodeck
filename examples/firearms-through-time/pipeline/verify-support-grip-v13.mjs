// Verify the saved v13 support-grip hands (v2) against their receipts, the v1 hands they replace and the v2 rigs.
// Usage: node pipeline/verify-support-grip-v13.mjs   (writes evidence/support-grip-v13/verification-<profile>.json)
//
// Checks: receipt and alias hashes; existing pins and v1 revisions untouched; the 41 semantic bones, hierarchy,
// materials and images equal to v1; closed glove and sleeve meshes with two components each; clip names,
// channels and durations against the motion and game contract; baked arm IK against the v2 rig in every clip;
// the rest skeleton built from the v2 rig with a straight support wrist; the right arm, right glove and every
// right-side clip channel unchanged from v1; and the delivery tests' reload-cue checks on the v2 hands.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readGLB,poseGLB,rotate,topology} from './glb-analysis.mjs';
import {sampleTimeline} from '../game/animation-sampler.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';

const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,'')),hash=b=>createHash('sha256').update(b).digest('hex');
const d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i])),deg=r=>r*180/Math.PI,r6=v=>+v.toFixed(6);
const jobs={
 rifle1866:{v1:'authoring/rifle-hands-v1.glb',v2:'authoring/rifle-hands-v2.glb',receipt:'authoring/rifle-hands-v2-pins.json',v1Receipt:'authoring/rifle-hands-v1-pins.json',
  rigV1:'game/rifle-arm-rig-v1.json',rigV2:'game/rifle-arm-rig-v2.json',motion:'game/rifle-motion-v2.json',contract:'game/rifle-game-contract.json',
  cue:m=>({name:'loading cue near the gate',target:[.024,.130,.024]})},
 boltNo4:{v1:'authoring/bolt-no4-hands-v1.glb',v2:'authoring/bolt-no4-hands-v2.glb',receipt:'authoring/bolt-hands-v2-pins.json',v1Receipt:'authoring/bolt-hands-v1-pins.json',
  rigV1:'game/bolt-no4-arm-rig-v1.json',rigV2:'game/bolt-no4-arm-rig-v2.json',motion:'game/bolt-no4-motion-v1.json',contract:'game/bolt-no4-game-contract.json',
  cue:m=>({name:'charger cue seated at the guide',target:[m.boltAction.chargerGuide[0],m.boltAction.chargerGuide[1]-.03,m.boltAction.chargerGuide[2]]})}};
const existingPins=['game/asset-pins.json','game/rifle-asset-pins-v1.json','game/rifle-asset-pins-v2.json','game/bolt-no4-asset-pins-v1.json'];

// Existing pins and the v1 hands revisions must be byte-identical to what they record.
const untouched=[];
for(const file of existingPins)for(const [key,p]of Object.entries((await json(file)).assets)){const sha=p.sha256.replace(/^sha256:/,'');
 for(const path of [p.alias??p.path,p.source].filter(Boolean)){assert.equal(hash(await readFile(path)),sha,file+' '+key+' '+path);untouched.push({pins:file,asset:key,path,sha256:sha});}}
for(const job of Object.values(jobs)){const r=await json(job.v1Receipt);for(const f of Object.values(r.files)){assert.equal(hash(await readFile(f.path)),f.sha256,f.path);untouched.push({receipt:job.v1Receipt,path:f.path,sha256:f.sha256});}}

const names=g=>g.j.skins[0].joints.map(i=>g.j.nodes[i].name);
const parents=g=>{const p={};g.j.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>p[g.j.nodes[c].name]=n.name));return names(g).map(n=>[n,p[n]??null]);};
const images=g=>(g.j.images??[]).map(i=>{const v=g.j.bufferViews[i.bufferView],start=28+g.b.readUInt32LE(12)+(v.byteOffset??0);return hash(g.b.subarray(start,start+v.byteLength));});
const side=n=>n.includes('right')?'right':n.includes('left')?'left':'root';

for(const [profile,job]of Object.entries(jobs)){
 const receipt=await json(job.receipt),g=await readGLB(job.v2),v1=await readGLB(job.v1),rig=await json(job.rigV2),rigV1=await json(job.rigV1),motion=await json(job.motion),contract=await json(job.contract);
 // Receipt: every saved file matches, the alias is the saved GLB, and the source path names the revision.
 for(const [n,f]of Object.entries(receipt.files)){const b=await readFile(f.path);assert.equal(hash(b),f.sha256,n);assert.equal(b.length,f.bytes,n);assert(f.path.includes(receipt.revisionId),n);}
 assert.equal(hash(g.b),receipt.files['asset.glb'].sha256,'alias is the saved asset.glb');assert.equal(receipt.alias,job.v2);
 const manifest=await json(receipt.files['asset.glb'].path.replace(/asset\.glb$/,'manifest.json'));
 assert.equal(manifest.parentRevision,receipt.parentRevision);assert.equal(manifest.preview.fidelity.materialFaithful,true);
 // Skeleton, materials and images.
 assert.equal(g.j.skins.length,1);assert.equal(names(g).length,41);assert.deepEqual(names(g),names(v1));assert.deepEqual(parents(g),parents(v1));
 assert.deepEqual(g.j.materials,v1.j.materials);assert.deepEqual(images(g),images(v1));
 const topo=['Mesh_Gloves','Mesh_Sleeves'].map(n=>topology(g,n));for(const t of topo){assert.equal(t.boundaryEdges,0,t.name);assert.equal(t.nonManifoldEdges,0,t.name);assert.equal(t.degenerate,0,t.name);assert.equal(t.components.length,2,t.name);}
 // Clips: names, channels and durations; right-side channels unchanged from v1.
 assert.deepEqual(g.j.animations.map(a=>a.name),v1.j.animations.map(a=>a.name));
 const clips=[];
 for(const [name,c]of Object.entries(motion.clips)){const a=g.j.animations.find(x=>x.name===name),b=v1.j.animations.find(x=>x.name===name);assert(a&&b,name);assert.equal(a.channels.length,41,name);
  const duration=Math.max(...a.samplers.flatMap(s=>g.data(s.input).flat()));assert(Math.abs(duration-c.duration)<1e-5,name);
  let rightDiff=0,leftDiff=0,rootDiff=0;
  for(const ch of a.channels){const node=g.j.nodes[ch.target.node].name,other=b.channels.find(x=>v1.j.nodes[x.target.node].name===node&&x.target.path===ch.target.path);assert(other,name+' '+node);
   const sa=a.samplers[ch.sampler],sb=b.samplers[other.sampler],ia=g.data(sa.input).flat(),ib=v1.data(sb.input).flat(),oa=g.data(sa.output).flat(),ob=v1.data(sb.output).flat();
   assert.equal(ia.length,ib.length);let m=0;ia.forEach((t,i)=>m=Math.max(m,Math.abs(t-ib[i])));oa.forEach((v,i)=>m=Math.max(m,Math.abs(v-ob[i])));
   const s=side(node);if(s==='right')rightDiff=Math.max(rightDiff,m);else if(s==='left')leftDiff=Math.max(leftDiff,m);else rootDiff=Math.max(rootDiff,m);}
  assert.equal(rightDiff,0,name+' right-side channels unchanged');assert.equal(rootDiff,0,name+' root channel unchanged');
  clips.push({name,duration:+duration.toFixed(6),loop:c.loop,channels:a.channels.length,rightChannelsMaxDiffFromV1:rightDiff,rootChannelMaxDiffFromV1:rootDiff,leftChannelsMaxDiffFromV1:r6(leftDiff)});}
 assert.equal(motion.clips.Reload.duration,contract.reload);assert.equal(motion.clips.Fire.duration,contract.cooldown);assert.equal(motion.reloadCommitPhase,contract.reloadCommitPhase);
 if(contract.inspect!==undefined)assert.equal(motion.clips.Inspect.duration,contract.inspect);
 assert.equal(rig.profile,profile);assert.equal(rig.bones,41);assert.deepEqual(rig.arms.right,rigV1.arms.right);assert.deepEqual(rig.arms.left.shoulder,rigV1.arms.left.shoulder);
 assert.equal(rig.arms.left.upperLength,rigV1.arms.left.upperLength);assert.equal(rig.arms.left.forearmLength,rigV1.arms.left.forearmLength);assert.deepEqual(rig.restHandRotations.right,rigV1.restHandRotations.right);
 // Baked arm IK in every clip (121 phases per clip, as the v1 verification sampled): v2 hands against the v2 rig and,
 // for comparison, v1 hands against the v1 rig. The support wrist must track its goal; the right arm must match v1
 // (the No.4 right wrist already carries a 2.2 mm 60 Hz baking residual mid-reload, which runtime IK removes).
 const bakedIK=(glb,r)=>{const out={poses:0,maxLengthError:0,maxReachError:0,wristErrorMM:{left:0,right:0}};
  for(const [name,c]of Object.entries(motion.clips))for(let i=0;i<=120;i++){const phase=i/120,p=sampleTimeline(motion,name,phase),pose=poseGLB(glb,name,phase*c.duration);out.poses++;
   for(const [s,spec]of Object.entries(r.arms)){const sh=pose.get(`Joint_${s}Arm_${s}_shoulder`).p,el=pose.get(`Joint_${s}Arm_${s}_elbow`).p,wr=pose.get(`Joint_${s}_${s}_wrist`).p,
    offset=(r.poseFields?.[s]??(s==='left'?['handX','handY','handZ']:['rightHandX','rightHandY','rightHandZ'])).map(f=>p[f]??0),target=spec.wrist.map((v,j)=>v+offset[j]),sol=solveArmIK(spec.shoulder,target,spec.pole,spec.upperLength,spec.forearmLength);
    out.maxLengthError=Math.max(out.maxLengthError,Math.abs(d(sh,el)-spec.upperLength),Math.abs(d(el,wr)-spec.forearmLength));out.wristErrorMM[s]=Math.max(out.wristErrorMM[s],d(wr,target)*1000);out.maxReachError=Math.max(out.maxReachError,sol.error??0);}}
  for(const s of ['left','right'])out.wristErrorMM[s]=+out.wristErrorMM[s].toFixed(4);return out;};
 const ikV2=bakedIK(g,rig),ikV1=bakedIK(v1,rigV1);
 assert(ikV2.maxLengthError<1e-6);assert(ikV2.maxReachError<1e-8);assert(ikV2.wristErrorMM.left<.5,'support wrist tracks the v2 rig');
 assert(ikV2.wristErrorMM.right<=ikV1.wristErrorMM.right+1e-6,'right wrist residual no worse than v1');
 // Rest skeleton from the v2 rig, and a straight support wrist at Ready (knuckle midpoint against the forearm).
 const rest=poseGLB(g,'Ready',0),rest1=poseGLB(v1,'Ready',0),at=n=>rest.get(n).p,skeleton={};
 for(const [s,a]of Object.entries(rig.arms)){const ik=solveArmIK(a.shoulder,a.wrist,a.pole,a.upperLength,a.forearmLength);
  assert(d(at(`Joint_${s}Arm_${s}_shoulder`),a.shoulder)<1e-4,s+' shoulder');assert(d(at(`Joint_${s}Arm_${s}_elbow`),ik.elbow)<1e-4,s+' elbow');assert(d(at(`Joint_${s}_${s}_wrist`),a.wrist)<1e-4,s+' wrist');
  const knuckles=[0,1,2,3].map(f=>at(`Joint_${s}Finger${f}_${s}_finger${f}_base`)).reduce((t,p)=>t.map((v,i)=>v+p[i]/4),[0,0,0]),hand=knuckles.map((v,i)=>v-a.wrist[i]),fore=a.wrist.map((v,i)=>v-ik.elbow[i]);
  const bend=deg(Math.acos(Math.min(1,hand.reduce((t,v,i)=>t+v*fore[i],0)/Math.hypot(...hand)/Math.hypot(...fore))));
  const a1=rigV1.arms[s],ik1=solveArmIK(a1.shoulder,a1.wrist,a1.pole,a1.upperLength,a1.forearmLength),k1=[0,1,2,3].map(f=>rest1.get(`Joint_${s}Finger${f}_${s}_finger${f}_base`).p).reduce((t,p)=>t.map((v,i)=>v+p[i]/4),[0,0,0]),h1=k1.map((v,i)=>v-a1.wrist[i]),f1=a1.wrist.map((v,i)=>v-ik1.elbow[i]);
  const bend1=deg(Math.acos(Math.min(1,h1.reduce((t,v,i)=>t+v*f1[i],0)/Math.hypot(...h1)/Math.hypot(...f1))));
  skeleton[s]={shoulder:a.shoulder,elbow:ik.elbow.map(r6),wrist:a.wrist,knuckleWristBendDeg:+bend.toFixed(2),v1KnuckleWristBendDeg:+bend1.toFixed(2),elbowInteriorDeg:+deg(Math.acos(Math.min(1,(()=>{const u=a.shoulder.map((v,i)=>v-ik.elbow[i]),w=a.wrist.map((v,i)=>v-ik.elbow[i]);return u.reduce((t,v,i)=>t+v*w[i],0)/Math.hypot(...u)/Math.hypot(...w);})()))).toFixed(1)};}
 assert(skeleton.left.knuckleWristBendDeg<5,'left wrist straight at Ready');
 let rightBoneDiff=0;for(const n of names(g).filter(n=>side(n)==='right')){const a=rest.get(n),b=rest1.get(n);rightBoneDiff=Math.max(rightBoneDiff,d(a.p,b.p),...a.q.map((v,i)=>Math.abs(v-b.q[i])));}
 assert(rightBoneDiff<1e-9,'right arm rest pose unchanged');
 // Right glove and sleeve geometry unchanged: bind-pose vertices dominated by right-side joints, compared as sets.
 const geometry={};
 for(const mesh of ['Mesh_Gloves','Mesh_Sleeves']){const collect=x=>{const jn=names(x),out={right:[],left:[]};for(const p of x.j.meshes[x.j.nodes.find(n=>n.name===mesh).mesh].primitives){const P=x.data(p.attributes.POSITION),J=x.data(p.attributes.JOINTS_0),W=x.data(p.attributes.WEIGHTS_0);
   P.forEach((v,i)=>{const k=W[i].indexOf(Math.max(...W[i])),s=side(jn[J[i][k]]);if(s!=='root')out[s].push(v.map(c=>c.toFixed(6)).join(',')+'|'+J[i].map((j,q)=>W[i][q]>0?jn[j]+':'+W[i][q].toFixed(5):'').filter(Boolean).sort().join(';'));});}
   for(const s of ['right','left'])out[s].sort();return out;};
  const a=collect(g),b=collect(v1);assert.deepEqual(a.right,b.right,mesh+' right side identical to v1');
  geometry[mesh]={rightVertices:a.right.length,rightIdenticalToV1:true,leftVertices:a.left.length,leftVerticesV1:b.left.length};}
 // The delivery tests' reload-cue check on the v2 hands (right wrist at the commit).
 const cue=job.cue(motion),w=poseGLB(g,'Reload',contract.reload*contract.reloadCommitPhase).get('Joint_right_right_wrist'),centre=w.p.map((v,i)=>v+rotate(w.q,motion.cartridge.rightWristRelativeCenter)[i]),cueDistance=d(centre,cue.target);
 assert(cueDistance<.025,cue.name);assert(sampleTimeline(motion,'Reload',contract.reloadCommitPhase).cartridge>.5);assert(sampleTimeline(motion,'Ready',0).cartridge<=.5);
 const result={ok:true,profile,generated:new Date().toISOString(),hands:{alias:job.v2,sha256:hash(g.b),assetId:receipt.assetId,revisionId:receipt.revisionId,parentRevision:receipt.parentRevision,programRef:receipt.programRef},
  replaces:{alias:job.v1,sha256:hash(v1.b),receipt:job.v1Receipt},rig:job.rigV2,rigReplaces:job.rigV1,motion:job.motion,contract:job.contract,
  bones:41,skinCount:1,semanticBoneNamesAndHierarchyPreserved:true,materialDefinitionsAndImageHashesPreserved:true,imageHashes:images(g),topology:topo,clips,
  IK:{v2HandsWithV2Rig:ikV2,v1HandsWithV1Rig:ikV1,fixedLengths:[rig.arms.left.upperLength,rig.arms.left.forearmLength]},restSkeleton:skeleton,rightArmRestPoseMaxDiffFromV1:rightBoneDiff,geometry,
  reloadCue:{check:cue.name,distanceMM:+(cueDistance*1000).toFixed(2),limitMM:25},existingPinsAndV1RevisionsUntouched:untouched.length,
  limitations:['Contacts and penetration are measured separately (evidence/support-grip-v13/after-'+profile+'.json) from sampled skinned vertices; not a continuous collision certificate.','Visual prototype art; no anatomical or historical technique claim.','Not wired into the browser or native game; no Unreal run.']};
 await writeFile(`evidence/support-grip-v13/verification-${profile}.json`,JSON.stringify(result,null,2)+'\n');
 console.log(profile,JSON.stringify({IK:result.IK,restSkeleton:skeleton,clips:clips.map(c=>c.name+':'+c.duration+' L'+c.leftChannelsMaxDiffFromV1),geometry,reloadCue:result.reloadCue}));
}
console.log('existing pins and v1 revisions verified:',untouched.length,'files');
