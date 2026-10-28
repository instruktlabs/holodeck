import * as THREE from '../../../holodeck/node_modules/three/build/three.module.js';import {readGLB,poseGLB} from './glb-analysis.mjs';import {writeFile} from 'node:fs/promises';
const g=await readGLB('authoring/first-hands-v5.glb'),ready=poseGLB(g,'Ready',0),grasp=poseGLB(g,'Reload',3.2*.26),w=grasp.get('Joint_left_left_wrist'),wrist=new THREE.Matrix4().compose(new THREE.Vector3(...w.p),new THREE.Quaternion(...w.q),new THREE.Vector3(1,1,1)),targets=[[-.051,-.057,.017],[-.054,-.073,.017],[-.059,-.088,.017],[-.060,-.100,.021],[-.044,-.052,-.019]],ends=[[-.022,-.033,.037],[-.022,-.050,.037],[-.022,-.067,.037],[-.022,-.084,.037],[-.018,-.009,-.027]],result=[];
for(let f=0;f<5;f++){
 const names=['base','mid','tip'].map(s=>'Joint_leftFinger'+f+'_left_finger'+f+'_'+s),nodes=names.map(n=>g.j.nodes.find(o=>o.name===n)),last=ready.get(names[2]).p,end=new THREE.Vector3(...ends[f].map((v,i)=>v-last[i])),target=new THREE.Vector3(...targets[f]);
 const pose=angles=>{let m=wrist.clone();const joints=[];for(let j=0;j<3;j++){const n=nodes[j],q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles.slice(j*3,j*3+3).map(v=>v*Math.PI/180)));m.multiply(new THREE.Matrix4().compose(new THREE.Vector3(...n.translation),q,new THREE.Vector3(1,1,1)));joints.push(new THREE.Vector3().setFromMatrixPosition(m));}return {end:end.clone().applyMatrix4(m),joints};};
 let a=f<4?[0,-65,0,0,20,0,0,-45,0]:[-8,-10,-28,0,0,-28,0,0,-18];const prior=[...a];
 const limits=f<4?[[-25,25],[-100,30],[-35,35],[0,0],[-100,50],[0,0],[0,0],[-110,30],[0,0]]:[[-60,60],[-70,70],[-80,45],[0,0],[0,0],[-65,40],[0,0],[0,0],[-70,20]];
 const score=v=>{const p=pose(v);let cost=p.end.distanceToSquared(target);cost+=v.reduce((s,x,i)=>s+(x-prior[i])**2,0)*1e-9;return cost;};let best=score(a);
 for(const step of [20,10,5,2,1,.5,.2])for(let it=0;it<25;it++){let changed=false;for(let k=0;k<9;k++){for(const sign of [-1,1]){const b=[...a];b[k]=Math.max(limits[k][0],Math.min(limits[k][1],b[k]+step*sign));const s=score(b);if(s<best){a=b;best=s;changed=true;}}}if(!changed)break;}
 const p=pose(a);result.push({finger:f,angles:a,target:targets[f],end:p.end.toArray(),errorMM:p.end.distanceTo(target)*1000,joints:p.joints.map(v=>v.toArray())});
}
await writeFile('evidence/hands-v5-grasp-fit.json',JSON.stringify({status:'candidate-fingertip-center-fit-needs-surface-and-render-review',result},null,2));console.log(result.map(r=>({finger:r.finger,errorMM:r.errorMM,angles:r.angles})));



