// Exercise the exact browser adapter with the consumer's pinned Three build.
// Only module specifiers change for Node resolution; adapter code is unchanged.
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {readGLB,poseGLB} from './glb-analysis.mjs';
import rig from '../game/arm-rig-v5.json' with {type:'json'};
import motion from '../game/animation-v3.json' with {type:'json'};
import {sampleTimeline} from '../game/animation-sampler.mjs';
const threeUrl=new URL('../../../holodeck/node_modules/three/build/three.webgpu.js',import.meta.url).href;
const THREE=await import(threeUrl),adapterSource=await readFile(new URL('../game/arm-ik-three-v5.mjs',import.meta.url),'utf8');
const adapter=await import('data:text/javascript;base64,'+Buffer.from(adapterSource.replace("'three/webgpu'",JSON.stringify(threeUrl)).replace("'./arm-ik.mjs'",JSON.stringify(new URL('../game/arm-ik.mjs',import.meta.url).href)).replace("'./forearm-twist.mjs'",JSON.stringify(new URL('../game/forearm-twist.mjs',import.meta.url).href))).toString('base64'));
const g=await readGLB('authoring/first-hands.glb'),boneIds=new Set(g.j.skins[0].joints),nodes=g.j.nodes.map((n,i)=>{const o=boneIds.has(i)?new THREE.Bone():new THREE.Group();o.name=n.name;o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);return o;});
for(const [i,n]of g.j.nodes.entries())for(const c of n.children??[])nodes[i].add(nodes[c]);const root=new THREE.Group();for(const i of g.j.scenes[g.j.scene??0].nodes)root.add(nodes[i]);
root.position.set(3,5,-8);root.rotation.set(.2,.7,-.4);root.scale.setScalar(2);root.updateMatrixWorld(true);const chains=adapter.bindArmIK(root,rig);let maxError=0,maxLengthError=0,maxOrientationError=0,maxTwistError=0,maxTwistMotion=0;
const {twistAngle}=await import('../game/forearm-twist.mjs');
for(const [name,c]of Object.entries(motion.clips))for(let k=0;k<=20;k++){
 const phase=k/20,world=poseGLB(g,name,c.duration*phase),p=sampleTimeline(motion,name,phase);
 // Restore animation's local quaternions before each live IK evaluation.
 for(const o of nodes){const w=world.get(o.name);if(!w)continue;const parent=world.get(o.parent?.name);const q=new THREE.Quaternion().fromArray(w.q);if(parent)q.premultiply(new THREE.Quaternion().fromArray(parent.q).invert());o.quaternion.copy(q);}
 root.updateMatrixWorld(true);const before=chains.map(c=>c.wrist.getWorldQuaternion(new THREE.Quaternion()));
 const offsets={left:[0,0,.02],right:[.01,0,0]};adapter.applyArmIK(root,chains,p,offsets);
 for(const [i,c]of chains.entries()){
  const angle=twistAngle(c.wrist.quaternion.toArray(),c.lower.toArray());for(const t of c.twists){const expected=new THREE.Quaternion().setFromAxisAngle(c.lower,angle*t.fraction);maxTwistError=Math.max(maxTwistError,t.bone.quaternion.angleTo(expected));maxTwistMotion=Math.max(maxTwistMotion,t.bone.quaternion.angleTo(new THREE.Quaternion()));}
  const local=o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3())),w=local(c.wrist),e=local(c.elbow),s=local(c.shoulder),target=new THREE.Vector3(...c.spec.wrist.map((v,j)=>v+(c.side==='left'?[p.handX,p.handY,p.handZ][j]:0)+offsets[c.side][j]));
  maxError=Math.max(maxError,w.distanceTo(target));maxLengthError=Math.max(maxLengthError,Math.abs(s.distanceTo(e)-c.spec.upperLength),Math.abs(e.distanceTo(w)-c.spec.forearmLength));maxOrientationError=Math.max(maxOrientationError,before[i].angleTo(c.wrist.getWorldQuaternion(new THREE.Quaternion())));
 }
}
assert(maxTwistError<1e-6);assert(maxTwistMotion>.05);assert(maxError<1e-6);assert(maxLengthError<1e-6);assert(maxOrientationError<1e-6);const result={ok:true,threeRevision:THREE.REVISION,poses:84,armsPerPose:2,rootTranslatedRotatedAndScaled:true,offClipTargets:true,maxError,maxLengthError,maxOrientationError,maxTwistError,maxTwistMotion};await writeFile('evidence/weapon-v5-browser-ik-test.json',JSON.stringify(result,null,2));console.log(result);
