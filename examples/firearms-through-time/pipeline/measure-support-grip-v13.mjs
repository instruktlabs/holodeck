// Measure the support (left) hand on the forend, posed as the browser adapter poses it.
// Usage: node pipeline/measure-support-grip-v13.mjs <rifle1866|boltNo4> <hands.glb> <rig.json> [out.json]
//
// Every clip key is sampled. The hands GLB clip is evaluated, then game/arm-ik-three-v5.mjs applies the live
// arm IK with the given rig, exactly as weapon-extension.jsx does. Glove vertices are skinned from those bone
// matrices and the inverse binds, in the shared root frame of hands and gun. The gun is posed at rest: its
// moving parts (lever, hammer, bolt) are more than 10 cm behind the support hand.
//
// Forend cross-section: the forend is sliced at the x of each measured point. Its vertical centre plane is
// the middle of the section's z extent. "far" is +Z (the right side for a right-handed shooter), "near" is -Z.
// Distal pad: the vertices weighted >0.8 to a finger's tip bone (the distal phalanx and fingertip); the pad
// point is the one nearest the wood. Gaps are signed: negative is inside the wood. Inside tests use the parity
// of three skew rays (majority) against each closed gun mesh. This is sampled-vertex evidence, not a
// continuous collision certificate.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readGLB,poseGLB} from './glb-analysis.mjs';
import {profiles,loadGun,nearest,isInside,signed,insideBox,section as cut} from './support-grip-v13-geometry.mjs';
import {sampleTimeline} from '../game/animation-sampler.mjs';

const [profileName,handsPath,rigPath,outPath]=process.argv.slice(2);
const profile=profiles[profileName];if(!profile||!handsPath||!rigPath)throw Error('Usage: measure-support-grip-v13.mjs <rifle1866|boltNo4> <hands.glb> <rig.json> [out.json]');
export const targets={fingerPadSide:'far',fingerPadGapMaxMM:3,thumbPadSide:'near',thumbPadGapMaxMM:3,palmGapMaxMM:5,penetrationMaxMM:1,readyWristBendMaxDeg:10};
const hash=b=>createHash('sha256').update(b).digest('hex'),r=(v,d=2)=>+v.toFixed(d),rv=(v,d=4)=>v.map(x=>r(x,d));
const rig=JSON.parse(await readFile(rigPath,'utf8')),motion=JSON.parse(await readFile(profile.motion,'utf8'));
const threeUrl=new URL('../../../holodeck/node_modules/three/build/three.webgpu.js',import.meta.url).href;
const THREE=await import(threeUrl),src=await readFile(new URL('../game/arm-ik-three-v5.mjs',import.meta.url),'utf8');
const adapter=await import('data:text/javascript;base64,'+Buffer.from(src.replace("'three/webgpu'",JSON.stringify(threeUrl)).replace("'./arm-ik.mjs'",JSON.stringify(new URL('../game/arm-ik.mjs',import.meta.url).href)).replace("'./forearm-twist.mjs'",JSON.stringify(new URL('../game/forearm-twist.mjs',import.meta.url).href))).toString('base64'));
const {twistAngle}=await import('../game/forearm-twist.mjs');

// ---- gun surfaces -------------------------------------------------------------------------------------
const {glb:gun,forend,surfaces:gunSurfaces}=await loadGun(profileName);
const section=x=>cut(forend,x);
function placeOnSection(p){const s=section(p[0]);if(!s)return {onForendSpan:false};const dz=p[2]-s.centreZ,dy=p[1]-s.centreY;let a=Math.atan2(dy,dz)*180/Math.PI;if(a<0)a+=360;
 return {onForendSpan:true,side:dz>=0?'far':'near',zFromCentreMM:r(dz*1000,1),sectionAngleDeg:r(a,0),sectionCentre:rv([s.centreY,s.centreZ])};}

// ---- hands scene graph, as the browser adapter sees it ----------------------------------------------------
const g=await readGLB(handsPath),skin=g.j.skins[0],jointNames=skin.joints.map(i=>g.j.nodes[i].name),bones=new Set(skin.joints);
const nodes=g.j.nodes.map((n,i)=>{const o=bones.has(i)?new THREE.Bone():new THREE.Group();o.name=n.name;o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);return o;});
for(const [i,n]of g.j.nodes.entries())for(const c of n.children??[])nodes[i].add(nodes[c]);const root=new THREE.Group();for(const i of g.j.scenes[g.j.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
const by=n=>root.getObjectByName(n),wp=o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
const restAxis={};for(const side of ['right','left']){const w=wp(by(`Joint_${side}_${side}_wrist`)),k=[0,1,2,3].map(f=>wp(by(`Joint_${side}Finger${f}_${side}_finger${f}_base`))).reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25);restAxis[side]=k.sub(w).normalize();}
const chains=adapter.bindArmIK(root,rig),inverse=g.data(skin.inverseBindMatrices).map(v=>new THREE.Matrix4().fromArray(v)),jointObjects=jointNames.map(n=>by(n));
// Unique left-hand glove vertices (the export is non-indexed). Part = dominant joint.
const leftVerts=[],seen=new Map();
for(const meshName of ['Mesh_Gloves','Mesh_Sleeves']){const mesh=g.j.meshes[g.j.nodes.find(n=>n.name===meshName).mesh];
 for(const p of mesh.primitives){const P=g.data(p.attributes.POSITION),J=g.data(p.attributes.JOINTS_0),W=g.data(p.attributes.WEIGHTS_0);
  for(let i=0;i<P.length;i++){let dom=0;for(let k=1;k<4;k++)if(W[i][k]>W[i][dom])dom=k;const jn=jointNames[J[i][dom]];if(!jn.includes('left'))continue;
   const key=meshName+P[i].map(v=>Math.round(v*1e6)).join(',')+J[i].join(',')+W[i].map(v=>Math.round(v*1e4)).join(',');if(seen.has(key))continue;seen.set(key,1);
   const m=jn.match(/leftFinger(\d)_left_finger\d_(base|mid|tip)$/),tipW=m?W[i].reduce((a,w,k)=>a+(jointNames[J[i][k]]===`Joint_leftFinger${m[1]}_left_finger${m[1]}_tip`?w:0),0):0,wristW=W[i].reduce((a,w,k)=>a+(jointNames[J[i][k]]==='Joint_left_left_wrist'?w:0),0);
   leftVerts.push({mesh:meshName,p:P[i],j:J[i],w:W[i],dominant:jn,finger:m?+m[1]:null,distal:!!m&&tipW>.8,palm:meshName==='Mesh_Gloves'&&!m&&wristW>=.9});}}}

function measurePose(clip,phase,p){
 const c=motion.clips[clip],world=poseGLB(g,clip,c.duration*phase);
 for(const o of nodes){const w=world.get(o.name);if(!w)continue;const parent=world.get(o.parent?.name),q=new THREE.Quaternion().fromArray(w.q);if(parent)q.premultiply(new THREE.Quaternion().fromArray(parent.q).invert());o.quaternion.copy(q);}
 root.updateMatrixWorld(true);const ik=adapter.applyArmIK(root,chains,p);
 const rootInverse=root.matrixWorld.clone().invert(),M=jointObjects.map((o,i)=>rootInverse.clone().multiply(o.matrixWorld).multiply(inverse[i])),e=new Float64Array(16);
 const skinned=leftVerts.map(v=>{const out=[0,0,0];for(let k=0;k<4;k++){const w=v.w[k];if(!w)continue;M[v.j[k]].toArray(e);const [x,y,z]=v.p;out[0]+=w*(e[0]*x+e[4]*y+e[8]*z+e[12]);out[1]+=w*(e[1]*x+e[5]*y+e[9]*z+e[13]);out[2]+=w*(e[2]*x+e[6]*y+e[10]*z+e[14]);}return {...v,q:out};});
 // Pose key: left joints relative to the root, so identical left-hand poses reuse one contact measurement.
 const poseKey=jointObjects.filter(o=>o.name.includes('left')).map(o=>{const m=rootInverse.clone().multiply(o.matrixWorld).toArray();return m.map(x=>Math.round(x*1e6)).join(',');}).join(';');
 const ch=chains.find(c=>c.side==='left'),s=wp(ch.shoulder),el=wp(ch.elbow),wr=wp(ch.wrist),fore=wr.clone().sub(el).normalize(),upper=el.clone().sub(s).normalize(),wq=ch.wrist.getWorldQuaternion(new THREE.Quaternion()),hand=restAxis.left.clone().applyQuaternion(wq),target=ch.spec.wrist.map((v,i)=>v+[p.handX,p.handY,p.handZ][i]);
 const wrist={wristBendDeg:r(fore.angleTo(hand)*180/Math.PI,1),forearmTwistDeg:r(twistAngle(ch.wrist.quaternion.toArray(),ch.lower.toArray())*180/Math.PI,1),elbowInteriorDeg:r((Math.PI-upper.angleTo(fore))*180/Math.PI,1),
  reach:r(Math.hypot(...target.map((v,i)=>v-ch.spec.shoulder[i]))/(ch.spec.upperLength+ch.spec.forearmLength),3),wristTargetErrorM:r(wr.distanceTo(new THREE.Vector3(...target)),5),reachError:ik.reachError,shoulder:rv(s.toArray()),elbow:rv(el.toArray()),wrist:rv(wr.toArray()),forearmDir:rv(fore.toArray()),handAxis:rv(hand.toArray())};
 return {skinned,poseKey,wrist};}

function contacts(skinned){
 const near=skinned.filter(v=>insideBox(v.q,forend,.03));
 const pad=(finger)=>{const distal=skinned.filter(v=>v.finger===finger&&v.distal);if(!distal.length)return {vertices:0};let best=null;for(const v of distal){if(!insideBox(v.q,forend,.03))continue;const d=signed(v.q,forend);if(!best||d.gap<best.gap)best={...d,p:v.q};}
  const centroid=[0,1,2].map(k=>distal.reduce((a,v)=>a+v.q[k],0)/distal.length);
  if(!best)return {vertices:distal.length,gapMM:null,note:'distal segment more than 30 mm from the forend',distalCentroid:rv(centroid),distalCentroidPlace:placeOnSection(centroid)};
  return {vertices:distal.length,padPoint:rv(best.p),gapMM:r(best.gap*1000),...placeOnSection(best.p),distalCentroid:rv(centroid),distalCentroidSide:placeOnSection(centroid).side??null};};
 const fingers=[0,1,2,3].map(f=>({finger:f,name:['index','middle','ring','little'][f],...pad(f)})),thumb={finger:4,name:'thumb',...pad(4)};
 let palm=null;for(const v of near){if(!v.palm)continue;const s=section(v.q[0]);if(!s||v.q[1]>s.centreY)continue;const d=signed(v.q,forend);if(!palm||d.gap<palm.gap)palm={...d,p:v.q};}
 const palmOut=palm?{gapMM:r(palm.gap*1000),point:rv(palm.p),...placeOnSection(palm.p)}:{gapMM:null,note:'no palm vertex under the forend span'};
 // Penetration: every left glove and sleeve vertex against every gun mesh.
 const pen={maxMM:0,mesh:null,part:null,point:null,vertices:0,byMesh:{}};
 for(const s of gunSurfaces){for(const v of skinned){if(!insideBox(v.q,s,.001))continue;if(!isInside(v.q,s))continue;const d=nearest(v.q,s).d*1000;pen.vertices++;pen.byMesh[s.name]=r(Math.max(pen.byMesh[s.name]??0,d));if(d>pen.maxMM){pen.maxMM=d;pen.mesh=s.name;pen.part=v.dominant.replace('Joint_','');pen.point=rv(v.q);}}}
 pen.maxMM=r(pen.maxMM);
 return {fingers,thumb,palm:palmOut,penetration:pen};}

function verdict(m,isReady){const f=m.contacts.fingers,t=m.contacts.thumb,checks={
 fingerPadsFarSide:f.every(x=>x.side==='far'),fingerPadGaps:f.every(x=>x.gapMM!==null&&x.gapMM<=targets.fingerPadGapMaxMM&&x.gapMM>=-targets.penetrationMaxMM),
 thumbPadNearSide:t.side==='near',thumbPadGap:t.gapMM!==null&&t.gapMM<=targets.thumbPadGapMaxMM&&t.gapMM>=-targets.penetrationMaxMM,
 palmUnderForend:m.contacts.palm.gapMM!==null&&m.contacts.palm.gapMM<=targets.palmGapMaxMM&&m.contacts.palm.gapMM>=-targets.penetrationMaxMM,
 penetration:m.contacts.penetration.maxMM<=targets.penetrationMaxMM};
 if(isReady)checks.readyWristBend=m.wrist.wristBendDeg<=targets.readyWristBendMaxDeg;return checks;}

const cache=new Map(),samples=[];
for(const [clip,c]of Object.entries(motion.clips))for(const [k,key]of c.keys.entries()){
 const p=sampleTimeline(motion,clip,key.t),left=['handX','handY','handZ','handPitch','handYaw','handRoll','open','thumb'].every(n=>Math.abs(p[n])<1e-12);
 const {skinned,poseKey,wrist}=measurePose(clip,key.t,p);if(!cache.has(poseKey))cache.set(poseKey,{id:'pose'+cache.size,contacts:contacts(skinned)});const hit=cache.get(poseKey);
 const m={clip,key:k,phase:key.phase,keyT:key.t,timeS:r(key.t*c.duration,4),leftHandChannelsAtRest:left,contactPose:hit.id,wrist,contacts:hit.contacts};m.checks=verdict(m,clip==='Ready');samples.push(m);}
const s0=samples.find(s=>s.clip==='Ready'&&s.key===0),worst=(get)=>samples.reduce((a,s)=>Math.max(a,get(s)??-Infinity),-Infinity);
const summary={readyT0:{wristBendDeg:s0.wrist.wristBendDeg,fingers:s0.contacts.fingers.map(f=>({name:f.name,side:f.side,gapMM:f.gapMM,sectionAngleDeg:f.sectionAngleDeg})),thumb:{side:s0.contacts.thumb.side,gapMM:s0.contacts.thumb.gapMM,sectionAngleDeg:s0.contacts.thumb.sectionAngleDeg},palmGapMM:s0.contacts.palm.gapMM,palmSectionAngleDeg:s0.contacts.palm.sectionAngleDeg,penetrationMaxMM:s0.contacts.penetration.maxMM,penetrationMesh:s0.contacts.penetration.mesh,penetrationPart:s0.contacts.penetration.part},
 sampledKeys:samples.length,distinctLeftHandContactPoses:cache.size,keysWithLeftHandChannelsAtRest:samples.filter(s=>s.leftHandChannelsAtRest).length,
 maxWristBendDeg:worst(s=>s.wrist.wristBendDeg),maxWristTargetErrorM:worst(s=>s.wrist.wristTargetErrorM),maxPenetrationMM:worst(s=>s.contacts.penetration.maxMM),
 allChecks:Object.fromEntries(Object.keys(samples[0].checks).map(k=>[k,samples.every(s=>s.checks[k]??true)])),
 failingKeys:samples.filter(s=>Object.values(s.checks).some(v=>!v)).map(s=>`${s.clip}#${s.key} ${s.phase}`)};
const report={schemaVersion:1,profile:profileName,generated:new Date().toISOString(),method:'pipeline/measure-support-grip-v13.mjs: clip pose + game/arm-ik-three-v5.mjs live IK; skinned glove/sleeve vertices vs posed gun triangles. Sampled vertices, not a continuous collision certificate.',
 hands:{path:handsPath,sha256:hash(g.b),bones:jointNames.length,leftVerticesMeasured:leftVerts.length},gun:{path:profile.gun,sha256:hash(gun.b),forend:profile.forendLabel,forendTriangles:forend.n,forendBounds:{min:rv(forend.min),max:rv(forend.max)}},
 rig:{path:rigPath,left:rig.arms.left,restHandRotations:rig.restHandRotations},motion:profile.motion,targets,summary,samples};
if(outPath)await writeFile(outPath,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({profile:profileName,hands:handsPath,rig:rigPath,summary},null,1));
