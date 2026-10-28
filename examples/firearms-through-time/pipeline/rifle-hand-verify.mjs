import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {readGLB,poseGLB,topology} from './glb-analysis.mjs';import {sampleTimeline} from '../game/animation-sampler.mjs';import {solveArmIK} from '../game/arm-ik.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),g=await readGLB('authoring/rifle-hands-v1.glb'),base=await readGLB('authoring/assets/kiln/a_42eb15873bde4c8fad62f46d032f42d8/revisions/r_248b93182e044a78b525862b756fc663/asset.glb'),motion=await read('game/rifle-motion-v1.json'),rig=await read('game/rifle-arm-rig-v1.json'),gunPins=await read('authoring/rifle-1866-v2-pins.json');
const gun=await readGLB(gunPins.glb??gunPins.files['asset.glb'].path),matrix=p=>new THREE.Matrix4().compose(new THREE.Vector3(...p.p),new THREE.Quaternion(...p.q),new THREE.Vector3(1,1,1));
const names=x=>x.j.skins[0].joints.map(i=>x.j.nodes[i].name);assert.deepEqual(names(g),names(base));assert.equal(names(g).length,41);assert.equal(g.j.skins.length,1);assert.deepEqual(g.j.materials,base.j.materials);
const images=x=>x.j.images.map(i=>{const v=x.j.bufferViews[i.bufferView],start=28+x.b.readUInt32LE(12)+(v.byteOffset??0);return hash(x.b.subarray(start,start+v.byteLength));});assert.deepEqual(images(g),images(base));
const topo=['Mesh_Gloves','Mesh_Sleeves'].map(n=>topology(g,n));for(const t of topo){assert.equal(t.boundaryEdges,0);assert.equal(t.nonManifoldEdges,0);assert.equal(t.degenerate,0);assert.equal(t.components.length,2);}
const clips=[];let maxLengthError=0,maxWristError=0,maxReachError=0;
for(const [name,c]of Object.entries(motion.clips)){
 const anim=g.j.animations.find(a=>a.name===name);assert(anim);assert.equal(anim.channels.length,41);const end=Math.max(...anim.samplers.flatMap(s=>g.data(s.input).flat()));assert(Math.abs(end-c.duration)<1e-5);
 for(let i=0;i<=120;i++){const phase=i/120,p=sampleTimeline(motion,name,phase),pose=poseGLB(g,name,phase*c.duration);
  for(const [side,spec]of Object.entries(rig.arms)){const shoulder=pose.get(`Joint_${side}Arm_${side}_shoulder`).p,elbow=pose.get(`Joint_${side}Arm_${side}_elbow`).p,wrist=pose.get(`Joint_${side}_${side}_wrist`).p,offset=side==='left'?[p.handX,p.handY,p.handZ]:[p.rightHandX,p.rightHandY,p.rightHandZ],target=spec.wrist.map((v,j)=>v+offset[j]),solution=solveArmIK(spec.shoulder,target,spec.pole,spec.upperLength,spec.forearmLength);
   const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));maxLengthError=Math.max(maxLengthError,Math.abs(distance(shoulder,elbow)-spec.upperLength),Math.abs(distance(elbow,wrist)-spec.forearmLength));maxWristError=Math.max(maxWristError,distance(wrist,target));maxReachError=Math.max(maxReachError,solution.error);
  }
 }clips.push({name,duration:end,loop:c.loop,sampledPhases:121,channels:anim.channels.length});
}
console.log({maxLengthError,maxWristError,maxReachError});assert(maxLengthError<1e-6);assert(maxWristError<.0005); // 60 Hz baked interpolation stays within half a millimetre; runtime IK removes this residual.
assert(maxReachError<1e-8);
const skin=g.j.skins[0],inverse=g.data(skin.inverseBindMatrices).map(v=>new THREE.Matrix4().fromArray(v)),glove=g.j.meshes[g.j.nodes.find(n=>n.name==='Mesh_Gloves').mesh],vertices=[];
for(const p of glove.primitives){const positions=g.data(p.attributes.POSITION),joints=g.data(p.attributes.JOINTS_0),weights=g.data(p.attributes.WEIGHTS_0);positions.forEach((p,i)=>vertices.push({p,j:joints[i],w:weights[i]}));}
const gp=poseGLB(gun,null,0),surfaceGroups={};
for(const [side,parts]of [['left',['Furniture_Foreend']],['right',['Furniture_Stock','Receiver_BrassShell','Lever_Exterior','Trigger_Exterior']]]){
 const triangles=[];for(const n of gun.j.nodes.filter(n=>n.mesh!==undefined&&parts.some(s=>n.name.includes(s)))){const m=matrix(gp.get(n.name));for(const p of gun.j.meshes[n.mesh].primitives){const pts=gun.data(p.attributes.POSITION).map(v=>new THREE.Vector3(...v).applyMatrix4(m)),ix=p.indices===undefined?pts.map((_,i)=>i):gun.data(p.indices).flat();for(let i=0;i<ix.length;i+=3)triangles.push(new THREE.Triangle(...ix.slice(i,i+3).map(k=>pts[k])));}}surfaceGroups[side]=triangles;
}
const contacts=[];
for(const [clip,phase,side]of [['Ready',0,'left'],['Ready',0,'right'],['Reload',.65,'right']]){
 const pose=poseGLB(g,clip,phase*motion.clips[clip].duration),transforms=skin.joints.map((n,i)=>matrix(pose.get(g.j.nodes[n].name)).multiply(inverse[i]));
 for(const finger of clip==='Reload'?[0]:[0,1,2,3,4]){
  const name=`Joint_${side}Finger${finger}_${side}_finger${finger}_tip`,index=skin.joints.findIndex(i=>g.j.nodes[i].name===name),seen=new Set(),points=[];
  for(const v of vertices){if(!v.j.some((j,k)=>j===index&&v.w[k]>.8))continue;const p=new THREE.Vector3();for(let k=0;k<4;k++)if(v.w[k])p.addScaledVector(new THREE.Vector3(...v.p).applyMatrix4(transforms[v.j[k]]),v.w[k]);const key=p.toArray().map(v=>Math.round(v*1e5)).join(',');if(!seen.has(key)){seen.add(key);points.push(p);}}
  const target=clip==='Reload'?new THREE.Vector3(.024,.13,.024):null,closest=new THREE.Vector3(),distances=points.map(p=>target?p.distanceTo(target):Math.min(...surfaceGroups[side].map(t=>p.distanceTo(t.closestPointToPoint(p,closest))))).sort((a,b)=>a-b);
  contacts.push({clip,phase,side,finger,samples:points.length,target:target?'loading gate anchor':side==='left'?'foreend exterior':'stock/receiver/lever/trigger exteriors',minimumMM:distances[0]*1000,p05MM:distances[Math.floor(distances.length*.05)]*1000});
 }
}
const result={ok:true,sourceSha256:hash(await readFile('authoring/rifle-hands-v1-final2-exact.kiln.js')),glbSha256:hash(g.b),gunSha256:hash(gun.b),bones:41,skinCount:1,semanticBoneNamesPreserved:true,materialDefinitionsAndImageHashesPreserved:true,imageHashes:images(g),topology:topo,clips,IK:{maxLengthError,maxWristError,maxReachError,sampledPoses:484,fixedLengths:[.33,.31]},contacts,limitations:['Nearest sampled distal vertices are not continuous penetration or full-hand collision certification.','Visual candidate only; no generic anatomical or historical technique claim.','No native/destination test or clean-host performance verdict.']};
await writeFile('authoring/rifle-hands-v1-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:result.ok,IK:result.IK,contacts},null,2));



