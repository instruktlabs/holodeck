// Measure first-person hands on the Colt M4 v3 carbine, posed as the browser adapter poses them.
// Usage: node pipeline/measure-carbine-grip.mjs <hands.glb> <rig.json> <motion.json> [--ready-only] [--hz <n>] [--out <json>] [--label <text>]
//
// Without --ready-only every clip is measured at each key, plus an n Hz grid with --hz: hand and sleeve penetration, arm
// reach margin, the magazine cue against the receiver (in excess of the saved magazine at the same drop position), the
// cue on the seat at the key before each commit, and the thumb-index pinch on the charging handle at full pull.
// The hands GLB clip is evaluated, then game/arm-ik-three-v5.mjs applies the live arm IK with the given rig and the
// motion's channel values, exactly as weapon-extension.jsx does. Glove and sleeve vertices are skinned from those bone
// matrices and the inverse binds, in the shared root frame of hands and gun (metres, +X muzzle, +Y up, +Z right). The gun
// is the saved M4 (asset a_b50808618ce54c1386d12212e186cc47, revision r_f0ad6458af8b40c48ca99eca88d48abe), with the
// magazine moved by magOut along the motion's drop axis (hidden at magOut >= 0.999) and the charging handle by
// chargingHandle along -X.
//
// Ready, per digit (distal pad = the vertices weighted > 0.8 to a finger's tip bone; the pad point is the one nearest the
// target surface; gaps are signed, negative inside):
//  right index  -> the trigger blade; correct side = its front face (face normal +X)
//  right middle, ring, little -> the pistol grip; correct side = left of the grip centre plane (wrapped round the front strap)
//  right thumb  -> the receiver and grip; correct side = the left side (z < 0)
//  right palm   -> the pistol grip (palm vertices: glove vertices weighted >= 0.9 to the wrist)
//  right web    -> the top 12 mm of the back strap (nearest palm, thumb-base or hand vertex; within 5 mm, as the palm)
//  left index..little -> the handguard; correct side = far (+Z of the handguard section centre)
//  left thumb   -> the handguard; correct side = near (-Z)
//  left palm    -> the handguard, below its centre
// Targets: pads within 3 mm on the correct side, palms within 5 mm, no vertex deeper than 1 mm in any gun mesh, wrist
// bend (forearm against wrist-to-knuckle-midpoint axis) at most 10 degrees. Inside tests use the majority of three skew-ray
// parities against each closed gun mesh. Sampled-vertex evidence, not a continuous collision certificate.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readGLB,poseGLB} from './glb-analysis.mjs';
import {loadCarbine,insideTester,nearest,nearestFace,surface,insideBox,section,M4} from './carbine-hand-geometry.mjs';
import {sampleTimeline} from '../game/animation-sampler.mjs';

const args=process.argv.slice(2),flag=n=>args.includes(n),opt=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const [handsPath,rigPath,motionPath]=args.filter((a,i)=>!a.startsWith('--')&&!['--out','--hz','--label'].includes(args[i-1]));
if(!handsPath||!rigPath||!motionPath)throw Error('Usage: measure-carbine-grip.mjs <hands.glb> <rig.json> <motion.json> [--ready-only] [--keys] [--hz <n>] [--out <json>]');
export const targets={padGapMaxMM:3,palmGapMaxMM:5,penetrationMaxMM:1,readyWristBendMaxDeg:10};
const hash=b=>createHash('sha256').update(b).digest('hex'),r=(v,d=2)=>+v.toFixed(d),rv=(v,d=4)=>v.map(x=>r(x,d));
const rig=JSON.parse(await readFile(rigPath,'utf8')),motion=JSON.parse(await readFile(motionPath,'utf8'));
const threeUrl=new URL('../../../holodeck/node_modules/three/build/three.webgpu.js',import.meta.url).href;
const THREE=await import(threeUrl),src=await readFile(new URL('../game/arm-ik-three-v5.mjs',import.meta.url),'utf8');
const adapter=await import('data:text/javascript;base64,'+Buffer.from(src.replace("'three/webgpu'",JSON.stringify(threeUrl)).replace("'./arm-ik.mjs'",JSON.stringify(new URL('../game/arm-ik.mjs',import.meta.url).href)).replace("'./forearm-twist.mjs'",JSON.stringify(new URL('../game/forearm-twist.mjs',import.meta.url).href))).toString('base64'));

// ---- gun --------------------------------------------------------------------------------------------------------------
const gun=await loadCarbine(),fixed=gun.surfaces.filter(s=>!s.owner);
const dropAxis=motion.magazine?.dropAxis??[0,-1,0],dropMetres=motion.magazine?.dropMetres??.25,travel=motion.chargingHandle?.travelMetres??0;
const shiftCache=new Map(),shifted=(s,d,k)=>{if(!shiftCache.has(k))shiftCache.set(k,{...surface(s.name,s.tris.map(t=>t.map(q=>q.map((v,i)=>v+d[i])))),owner:s.owner});return shiftCache.get(k);};
function gunAt(p){const out=[...fixed],mo=Math.round((p.magOut??0)*2000)/2000,ch=Math.round((p.chargingHandle??0)*2000)/2000;
 if(mo<.999)for(const s of gun.surfaces.filter(s=>s.owner==='Joint_Magazine'))out.push(mo?shifted(s,dropAxis.map(v=>v*mo*dropMetres),s.name+mo):s);
 for(const s of gun.surfaces.filter(s=>s.owner==='Joint_ChargingHandle'))out.push(ch?shifted(s,[-ch*travel,0,0],s.name+ch):s);return out;}
const signed=(p,s)=>{const n=nearest(p,s);return {gap:insideTester(s)(p)?-n.d:n.d,q:n.q};};

// ---- hands scene graph, as the browser adapter sees it ----------------------------------------------------------------
const g=await readGLB(handsPath),skin=g.j.skins[0],jointNames=skin.joints.map(i=>g.j.nodes[i].name),bones=new Set(skin.joints);
const nodes=g.j.nodes.map((n,i)=>{const o=bones.has(i)?new THREE.Bone():new THREE.Group();o.name=n.name;o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);return o;});
for(const [i,n]of g.j.nodes.entries())for(const c of n.children??[])nodes[i].add(nodes[c]);const root=new THREE.Group();for(const i of g.j.scenes[g.j.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
const by=n=>root.getObjectByName(n),wp=o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
const restAxis={};for(const side of ['right','left']){const w=wp(by(`Joint_${side}_${side}_wrist`)),k=[0,1,2,3].map(f=>wp(by(`Joint_${side}Finger${f}_${side}_finger${f}_base`))).reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25);restAxis[side]=k.sub(w).normalize();}
const chains=adapter.bindArmIK(root,rig),inverse=g.data(skin.inverseBindMatrices).map(v=>new THREE.Matrix4().fromArray(v)),jointObjects=jointNames.map(n=>by(n));
const verts={right:[],left:[]},seen=new Set();
for(const meshName of ['Mesh_Gloves','Mesh_Sleeves']){const node=g.j.nodes.find(n=>n.name===meshName);if(!node)continue;const mesh=g.j.meshes[node.mesh];
 for(const p of mesh.primitives){const P=g.data(p.attributes.POSITION),J=g.data(p.attributes.JOINTS_0),W=g.data(p.attributes.WEIGHTS_0);
  for(let i=0;i<P.length;i++){let dom=0;for(let k=1;k<4;k++)if(W[i][k]>W[i][dom])dom=k;const jn=jointNames[J[i][dom]],side=jn.includes('left')?'left':jn.includes('right')?'right':null;if(!side)continue;
   const key=meshName+P[i].map(v=>Math.round(v*1e6)).join(',')+J[i].join(',')+W[i].map(v=>Math.round(v*1e4)).join(',');if(seen.has(key))continue;seen.add(key);
   const m=jn.match(/(?:left|right)Finger(\d)_(?:left|right)_finger\d_(base|mid|tip)$/),tipW=m?W[i].reduce((a,w,k)=>a+(jointNames[J[i][k]]===`Joint_${side}Finger${m[1]}_${side}_finger${m[1]}_tip`?w:0),0):0,wristW=W[i].reduce((a,w,k)=>a+(jointNames[J[i][k]]===`Joint_${side}_${side}_wrist`?w:0),0);
   verts[side].push({mesh:meshName,p:P[i],j:J[i],w:W[i],dominant:jn,finger:m?+m[1]:null,distal:!!m&&tipW>.8,palm:meshName==='Mesh_Gloves'&&!m&&wristW>=.9});}}}
const clipNames=new Set((g.j.animations??[]).map(a=>a.name));

function pose(clip,phase,p){const c=motion.clips[clip],world=clipNames.has(clip)?poseGLB(g,clip,c.duration*phase):poseGLB(g,null,0);
 for(const o of nodes){const w=world.get(o.name);if(!w)continue;const parent=world.get(o.parent?.name),q=new THREE.Quaternion().fromArray(w.q);if(parent)q.premultiply(new THREE.Quaternion().fromArray(parent.q).invert());o.quaternion.copy(q);}
 root.updateMatrixWorld(true);const ik=adapter.applyArmIK(root,chains,p);
 const rootInverse=root.matrixWorld.clone().invert(),M=jointObjects.map((o,i)=>rootInverse.clone().multiply(o.matrixWorld).multiply(inverse[i])),e=new Float64Array(16),out={};
 for(const side of ['right','left'])out[side]=verts[side].map(v=>{const q=[0,0,0];for(let k=0;k<4;k++){const w=v.w[k];if(!w)continue;M[v.j[k]].toArray(e);const [x,y,z]=v.p;q[0]+=w*(e[0]*x+e[4]*y+e[8]*z+e[12]);q[1]+=w*(e[1]*x+e[5]*y+e[9]*z+e[13]);q[2]+=w*(e[2]*x+e[6]*y+e[10]*z+e[14]);}return {...v,q};});
 const wrist={};for(const side of ['right','left']){const ch=chains.find(c=>c.side===side),s=wp(ch.shoulder),el=wp(ch.elbow),wr=wp(ch.wrist),fore=wr.clone().sub(el).normalize(),upper=el.clone().sub(s).normalize(),wq=ch.wrist.getWorldQuaternion(new THREE.Quaternion()),hand=restAxis[side].clone().applyQuaternion(wq);
  const d=side==='left'?[p.handX,p.handY,p.handZ]:[p.rightHandX,p.rightHandY,p.rightHandZ],target=ch.spec.wrist.map((v,i)=>v+(d[i]??0));
  wrist[side]={wristBendDeg:r(fore.angleTo(hand)*180/Math.PI,1),elbowInteriorDeg:r((Math.PI-upper.angleTo(fore))*180/Math.PI,1),reachMarginM:r(ch.spec.upperLength+ch.spec.forearmLength-Math.hypot(...target.map((v,i)=>v-ch.spec.shoulder[i])),5),wristTargetErrorM:r(wr.distanceTo(new THREE.Vector3(...target)),6),shoulder:rv(s.toArray()),elbow:rv(el.toArray()),wrist:wr.toArray(),wristQuaternion:new THREE.Quaternion().setFromRotationMatrix(rootInverse.clone().multiply(ch.wrist.matrixWorld)).toArray()};}
 return {skinned:out,wrist,ik};}

// ---- contacts -----------------------------------------------------------------------------------------------------
const near=(q,s,m)=>insideBox(q,s,m);
function pad(skinned,finger,surfs,classify){const distal=skinned.filter(v=>v.finger===finger&&v.distal);if(!distal.length)return {vertices:0,gapMM:null};let best=null;
 for(const v of distal)for(const s of surfs){if(!near(v.q,s,.03))continue;const d=signed(v.q,s);if(!best||d.gap<best.gap)best={...d,p:v.q,mesh:s.name};}
 const centroid=[0,1,2].map(k=>distal.reduce((a,v)=>a+v.q[k],0)/distal.length);
 if(!best)return {vertices:distal.length,gapMM:null,note:'distal segment more than 30 mm from the target surface',distalCentroid:rv(centroid)};
 return {vertices:distal.length,padPoint:rv(best.p),gapMM:r(best.gap*1000),mesh:best.mesh,...classify(best.p,best),distalCentroid:rv(centroid)};}
const hg=gun.handguard,hgSide=p=>{const s=section(hg,p[0]);if(!s)return {side:null};const dz=p[2]-s.centreZ;return {side:dz>=0?'far':'near',zFromCentreMM:r(dz*1000,1)};};
const gripSide=p=>({side:p[2]<0?'left':'right',zMM:r(p[2]*1000,1)}),triggerSide=(p,best)=>{const f=nearestFace(p,gun.trigger);return {side:f.normal[0]>0?'trigger face':'trigger back or side',faceNormal:rv(f.normal,3)};};
function penetration(skinned,surfs){const pen={maxMM:0,mesh:null,part:null,point:null,vertices:0,byMesh:{}};
 for(const s of surfs)for(const v of skinned){if(!near(v.q,s,.001))continue;if(!insideTester(s)(v.q))continue;const d=nearest(v.q,s).d*1000;pen.vertices++;pen.byMesh[s.name]=r(Math.max(pen.byMesh[s.name]??0,d));if(d>pen.maxMM){pen.maxMM=d;pen.mesh=s.name;pen.part=v.dominant.replace('Joint_','');pen.point=rv(v.q);}}
 pen.maxMM=r(pen.maxMM);return pen;}
function rightContacts(sk,surfs){const grip=gun.grip,body=[gun.grip,gun.lower,gun.steel];
 const fingers=[{finger:0,name:'index',target:'trigger blade',...pad(sk,0,[gun.trigger],triggerSide)},...[1,2,3].map(f=>({finger:f,name:['','middle','ring','little'][f],target:'pistol grip',...pad(sk,f,[grip],gripSide)}))];
 const thumb={finger:4,name:'thumb',target:'receiver and grip, left side',...pad(sk,4,body,gripSide)};
 let palm=null;for(const v of sk){if(!v.palm||!near(v.q,grip,.02))continue;const d=signed(v.q,grip);if(!palm||d.gap<palm.gap)palm={...d,p:v.q};}
 // web: the nearest hand vertex (palm, thumb base or middle; no finger) to the back strap's top 12 mm (grip faces whose
 // normal points rearward), with the height of that strap point below the grip top
 let web=null;for(const v of sk){if(v.mesh!=='Mesh_Gloves'||v.finger!==null&&v.finger!==4||v.distal||!near(v.q,grip,.01))continue;const f=nearestFace(v.q,grip);if(f.normal[0]>-.5||f.q[1]<grip.max[1]-.012)continue;const gap=insideTester(grip)(v.q)?-f.d:f.d;if(!web||gap<web.gap)web={gap,p:v.q,q:[...f.q],part:v.dominant.replace('Joint_','')};}
 return {fingers,thumb,palm:palm?{gapMM:r(palm.gap*1000),point:rv(palm.p)}:{gapMM:null},web:web?{point:rv(web.p),part:web.part,gapMM:r(web.gap*1000),strapPointBelowGripTopMM:r((grip.max[1]-web.q[1])*1000,1)}:{gapMM:null,note:'no hand vertex within 10 mm of the top 12 mm of the back strap'},penetration:penetration(sk,surfs)};}
function leftContacts(sk,surfs){const fingers=[0,1,2,3].map(f=>({finger:f,name:['index','middle','ring','little'][f],target:'handguard',...pad(sk,f,[hg],hgSide)})),thumb={finger:4,name:'thumb',target:'handguard',...pad(sk,4,[hg],hgSide)};
 let palm=null;for(const v of sk){if(!v.palm||!near(v.q,hg,.02))continue;const s=section(hg,v.q[0]);if(!s||v.q[1]>s.centreY)continue;const d=signed(v.q,hg);if(!palm||d.gap<palm.gap)palm={...d,p:v.q};}
 return {fingers,thumb,palm:palm?{gapMM:r(palm.gap*1000),point:rv(palm.p)}:{gapMM:null,note:'no palm vertex under the handguard span'},penetration:penetration(sk,surfs)};}
const within=(x,max)=>x!==null&&x!==undefined&&x<=max&&x>=-targets.penetrationMaxMM;
function verdictRight(c,w){return {indexPadOnTriggerFace:c.fingers[0].side==='trigger face'&&within(c.fingers[0].gapMM,targets.padGapMaxMM),
 fingerPadsWrapFrontStrap:c.fingers.slice(1).every(f=>f.side==='left'&&within(f.gapMM,targets.padGapMaxMM)),thumbPadLeftSide:c.thumb.side==='left'&&within(c.thumb.gapMM,targets.padGapMaxMM),
 palmOnGrip:within(c.palm.gapMM,targets.palmGapMaxMM),webHighOnBackStrap:within(c.web.gapMM,targets.palmGapMaxMM),penetration:c.penetration.maxMM<=targets.penetrationMaxMM,wristBend:w.wristBendDeg<=targets.readyWristBendMaxDeg};}
function verdictLeft(c,w){return {fingerPadsFarSide:c.fingers.every(f=>f.side==='far'&&within(f.gapMM,targets.padGapMaxMM)),thumbPadNearSide:c.thumb.side==='near'&&within(c.thumb.gapMM,targets.padGapMaxMM),
 palmUnderHandguard:within(c.palm.gapMM,targets.palmGapMaxMM),penetration:c.penetration.maxMM<=targets.penetrationMaxMM,wristBend:w.wristBendDeg<=targets.readyWristBendMaxDeg};}
const table=(c)=>[...c.fingers,c.thumb].map(f=>({digit:f.name,target:f.target,side:f.side??null,gapMM:f.gapMM}));

// ---- Ready ----------------------------------------------------------------------------------------------------------
const zero=Object.fromEntries((motion.channels??[]).map(k=>[k,0]));
const readyPose=pose('Ready',0,{...zero}),readySurfs=gunAt(zero);
const ready={right:{contacts:rightContacts(readyPose.skinned.right,readySurfs),wrist:readyPose.wrist.right},left:{contacts:leftContacts(readyPose.skinned.left,readySurfs),wrist:readyPose.wrist.left}};
ready.right.checks=verdictRight(ready.right.contacts,ready.right.wrist);ready.left.checks=verdictLeft(ready.left.contacts,ready.left.wrist);
const summary={ready:{right:{digits:table(ready.right.contacts),palmGapMM:ready.right.contacts.palm.gapMM,web:ready.right.contacts.web,penetrationMaxMM:ready.right.contacts.penetration.maxMM,penetrationMesh:ready.right.contacts.penetration.mesh,wristBendDeg:ready.right.wrist.wristBendDeg,checks:ready.right.checks},
 left:{digits:table(ready.left.contacts),palmGapMM:ready.left.contacts.palm.gapMM,penetrationMaxMM:ready.left.contacts.penetration.maxMM,penetrationMesh:ready.left.contacts.penetration.mesh,wristBendDeg:ready.left.wrist.wristBendDeg,checks:ready.left.checks}},
 readyPasses:Object.values(ready.right.checks).every(Boolean)&&Object.values(ready.left.checks).every(Boolean)};

// ---- clips: penetration at every key (and optionally at n Hz), reach, cue and pinch -----------------------------------
const samples=[];let extra={};
if(!flag('--ready-only')){const hz=+opt('--hz','0'),cue=motion.magazineCue,magVerts=gun.surfaces.filter(s=>s.owner==='Joint_Magazine').flatMap(s=>[...new Map(s.tris.flat().map(p=>[p.join(','),p])).values()]),M0=gun.nodes.Joint_Magazine.world;
 const cueQ=cue?new THREE.Quaternion().setFromEuler(new THREE.Euler(...cue.leftWristRelativeRotation,'XYZ')):null;
 const overlap=pts=>{let worst=0,mesh=null;for(const s of fixed)for(const q of pts){if(!near(q,s,0))continue;if(insideTester(s)(q)){const d=nearest(q,s).d;if(d>worst){worst=d;mesh=s.name;}}}return {mm:worst*1000,mesh};};
 const refCache=new Map(),ref=m=>{const k=Math.round(m*2000);if(!refCache.has(k))refCache.set(k,overlap(magVerts.map(q=>q.map((v,i)=>v+dropAxis[i]*k/2000*dropMetres))).mm);return refCache.get(k);};
 const cueWorld=(wristPos,wristQ)=>{const Q=new THREE.Quaternion().fromArray(wristQ),pos=new THREE.Vector3(...cue.leftWristRelativeCenter).applyQuaternion(Q).add(new THREE.Vector3(...wristPos)),rot=Q.clone().multiply(cueQ);return {pos,rot};};
 const times=[];for(const [clip,c]of Object.entries(motion.clips)){const set=new Map();for(const [k,key]of c.keys.entries())set.set(key.t.toFixed(6),{t:key.t,key:k,phase:key.phase});if(hz){const n=Math.ceil(c.duration*hz);for(let i=0;i<=n;i++){const t=i/n,id=t.toFixed(6);if(!set.has(id))set.set(id,{t,key:null,phase:null});}}times.push(...[...set.values()].sort((a,b)=>a.t-b.t).map(x=>({clip,...x})));}
 const poseCache=new Map();
 for(const s of times){const c=motion.clips[s.clip],p=sampleTimeline(motion,s.clip,s.t),P=pose(s.clip,s.t,p),surfs=gunAt(p),row={clip:s.clip,t:r(s.t,5),timeS:r(s.t*c.duration,4),key:s.key,phase:s.phase??p.phase};
  for(const side of ['right','left']){const sig=side+JSON.stringify(P.skinned[side].filter((_,i)=>i%97===0).map(v=>v.q.map(x=>Math.round(x*1e5))))+JSON.stringify([p.magOut,p.chargingHandle].map(x=>Math.round(x*2000)));
   if(!poseCache.has(sig))poseCache.set(sig,penetration(P.skinned[side],surfs));const pen=poseCache.get(sig);row[side]={penetrationMM:pen.maxMM,mesh:pen.mesh,part:pen.part,point:pen.point,reachMarginM:P.wrist[side].reachMarginM,wristTargetErrorM:P.wrist[side].wristTargetErrorM};}
  if(cue&&p.magCue>.5){const w=cueWorld(P.wrist.left.wrist,P.wrist.left.wristQuaternion),pts=magVerts.map(q=>new THREE.Vector3(...q.map((v,i)=>v-M0[i])).applyQuaternion(w.rot).add(w.pos).toArray()),o=overlap(pts);
   const off=w.pos.clone().sub(new THREE.Vector3(...M0)),along=off.dot(new THREE.Vector3(...dropAxis)),offAxis=off.clone().sub(new THREE.Vector3(...dropAxis).multiplyScalar(along)).length(),ang=2*Math.acos(Math.min(1,Math.abs(w.rot.w)))*180/Math.PI,onAxis=offAxis<5e-4&&ang<.5,refMM=onAxis?ref(Math.max(0,along/dropMetres)):0;
   row.cue={overlapMM:r(o.mm),referenceMM:r(refMM),excessMM:r(Math.max(0,o.mm-refMM)),mesh:o.mesh,offAxisMM:r(offAxis*1000,3),angleDeg:r(ang,3)};}
  samples.push(row);}
 // cue on the seat at the key before each commit
 const seat={};for(const [clip,c]of Object.entries(motion.clips)){if(!c.commitPhase||!cue)continue;const i=c.keys.findIndex(k=>Math.abs(k.t-c.commitPhase)<1e-9),k=c.keys[i-1],p=sampleTimeline(motion,clip,k.t),P=pose(clip,k.t,p),w=cueWorld(P.wrist.left.wrist,P.wrist.left.wristQuaternion);
  seat[clip]={key:k.phase,t:k.t,positionErrorMM:r(w.pos.distanceTo(new THREE.Vector3(...M0))*1000,4),angleErrorDeg:r(2*Math.acos(Math.min(1,Math.abs(w.rot.w)))*180/Math.PI,4),magOut:p.magOut,magCue:p.magCue,commit:{magOut:sampleTimeline(motion,clip,c.commitPhase).magOut,magCue:sampleTimeline(motion,clip,c.commitPhase).magCue}};}
 // pinch at full pull: thumb distal pad to the nearest index distal or middle-phalanx vertex; midpoint distance to the moved handle
 let pinch=null;const ce=motion.clips.ReloadEmpty;if(ce&&travel){const k=ce.keys.find(k=>sampleTimeline(motion,'ReloadEmpty',k.t).chargingHandle>=.999&&/pull/.test(k.phase))??ce.keys.find(k=>sampleTimeline(motion,'ReloadEmpty',k.t).chargingHandle>=.999);
  if(k){const p=sampleTimeline(motion,'ReloadEmpty',k.t),P=pose('ReloadEmpty',k.t,p),sk=P.skinned.left,handle=gunAt(p).find(s=>s.owner==='Joint_ChargingHandle'),thumbV=sk.filter(v=>v.finger===4&&v.distal),indexV=sk.filter(v=>v.finger===0&&(v.distal||/finger0_mid$/.test(v.dominant)));
   let tp=null;for(const v of thumbV){const d=nearest(v.q,handle).d;if(!tp||d<tp.d)tp={d,q:v.q};}let ip=null;for(const v of indexV){const d=nearest(v.q,handle).d;if(!ip||d<ip.d)ip={d,q:v.q};}
   const mid=tp.q.map((v,i)=>(v+ip.q[i])/2);pinch={key:k.phase,t:k.t,chargingHandle:p.chargingHandle,thumbPadToHandleMM:r(tp.d*1000),indexToHandleMM:r(ip.d*1000),pinchMidpointToHandleMM:r(nearest(mid,handle).d*1000),thumbToIndexMM:r(Math.hypot(...tp.q.map((v,i)=>v-ip.q[i]))*1000),targetMM:15};}}
 const worst=(clip,side,f)=>samples.filter(s=>s.clip===clip&&s[side]).reduce((a,s)=>f(s[side])>f(a?.[side]??{})?s:a,null);
 const byClip={};for(const clip of Object.keys(motion.clips)){byClip[clip]={};for(const side of ['right','left']){const pw=samples.filter(s=>s.clip===clip).reduce((a,s)=>!a||s[side].penetrationMM>a[side].penetrationMM?s:a,null),rw=samples.filter(s=>s.clip===clip).reduce((a,s)=>!a||s[side].reachMarginM<a[side].reachMarginM?s:a,null);
   byClip[clip][side]={maxPenetrationMM:pw[side].penetrationMM,at:{t:pw.t,phase:pw.phase,mesh:pw[side].mesh,part:pw[side].part},minReachMarginM:rw[side].reachMarginM,reachAt:rw.t};}
  const cs=samples.filter(s=>s.clip===clip&&s.cue);if(cs.length){const cw=cs.reduce((a,s)=>!a||s.cue.excessMM>a.cue.excessMM?s:a,null);byClip[clip].cue={maxExcessMM:cw.cue.excessMM,rawMM:cw.cue.overlapMM,referenceMM:cw.cue.referenceMM,at:cw.t,samples:cs.length};}}
 const over=samples.filter(s=>s.right.penetrationMM>targets.penetrationMaxMM||s.left.penetrationMM>targets.penetrationMaxMM||(s.cue&&s.cue.excessMM>targets.penetrationMaxMM)).map(s=>`${s.clip} t ${s.t} ${s.phase}: right ${s.right.penetrationMM} left ${s.left.penetrationMM}${s.cue?' cue '+s.cue.excessMM:''}`);
 const stretch=samples.filter(s=>s.right.reachMarginM<=rig.maxReachMargin||s.left.reachMarginM<=rig.maxReachMargin).map(s=>`${s.clip} t ${s.t}`);
 extra={samplesMeasured:samples.length,rateHz:hz||'keys only',byClip,cueSeat:seat,pinch,overPenetration:over,stretched:stretch,savedMagazineSeatedOverlapMM:r(ref(0))};
 Object.assign(summary,{clips:byClip,cueSeat:seat,pinch,overPenetration:over.length,stretched:stretch.length});}

const report={schemaVersion:1,generated:new Date().toISOString(),method:'pipeline/measure-carbine-grip.mjs: clip pose + game/arm-ik-three-v5.mjs live IK; skinned glove and sleeve vertices against the posed M4 triangles. Sampled vertices, not a continuous collision certificate.',
 hands:{path:handsPath,sha256:hash(g.b),bones:jointNames.length,clips:[...clipNames],verticesMeasured:{right:verts.right.length,left:verts.left.length}},gun:{assetId:M4.assetId,revisionId:M4.revisionId,sha256:gun.sha256},rig:{path:rigPath,arms:rig.arms,restHandRotations:rig.restHandRotations},motion:{path:motionPath,id:motion.id??null},
 targets,summary,ready,...extra,samples};
const out=opt('--out',null);if(out)await writeFile(out,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({hands:handsPath,rig:rigPath,label:opt('--label',null),summary},null,1));
