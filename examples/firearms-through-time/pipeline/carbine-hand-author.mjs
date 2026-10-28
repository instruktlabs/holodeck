// Colt M4 carbine profile (carbineM4): game-owned motion and arm rig, the hands program refitted from the No.4 hands v2
// (asset a_50e7dd03d75544139214de00422ee64e, revision r_77de43bccb58428b8307432b15af8ebb), and a fitting-only assembly
// (hands + saved M4 + magazine cue) for review renders.
// Usage: node pipeline/carbine-hand-author.mjs [--out <dir>] [--design-cache <json>] [--draft] [--replace-own]
//   writes <out>/game/carbine-m4-motion-v1.json, <out>/game/carbine-m4-arm-rig-v1.json,
//   <out>/authoring/carbine-m4-hands-v1.kiln.js, <out>/authoring/carbine-m4-hands-v1-assembly.kiln.js and
//   <out>/authoring/carbine-m4-hands-v1-design.json (out defaults to the workspace root). Existing files are never
//   replaced unless --replace-own is given for this script's own earlier outputs. --draft writes even when an authoring
//   check fails (for iteration outside the workspace). The gun, the No.4 hands and every pin stay untouched.
// Fixed contract (parent-owned): channel order, clip names and durations, commit phases, the meanings of magOut, magCue
// and chargingHandle. Everything else here is authored and measured.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from '../../../holodeck/node_modules/three/build/three.module.js';
import {loadCarbine,magazineAxis,gripAxis,insideTester,fastSigned,nearest,surface,insideBox,M4} from './carbine-hand-geometry.mjs';
import {designRight,designLeft,localBasis,anatomy,catmull,tubeRadius,vec} from './carbine-hand-design.mjs';
import {makePoser,quat,qrot,eulerOf,angleBetween} from './carbine-hand-pose.mjs';
import {atnToGun} from './support-grip-v13-design.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';
import {sampleTimeline} from '../game/animation-sampler.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2),flag=n=>args.includes(n),opt=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const outRoot=resolve(opt('--out',root)),text=async p=>(await readFile(resolve(root,p),'utf8')).replace(/^﻿/,'');
const {add,sub,mul,dot,cross,len,unit}=vec,deg=Math.PI/180,r4=v=>Array.isArray(v)?v.map(r4):Math.round(v*1e4)/1e4,r5=v=>Array.isArray(v)?v.map(r5):Math.round(v*1e5)/1e5,r6=v=>Array.isArray(v)?v.map(r6):Math.round(v*1e6)/1e6;
const SOURCE_HANDS='authoring/assets/kiln/a_50e7dd03d75544139214de00422ee64e/revisions/r_77de43bccb58428b8307432b15af8ebb/source.kiln.js';
const overrides=JSON.parse(opt('--set','{}'));

// ---- fixed contract ----------------------------------------------------------------------------------------------
const channels=['lift','roll','yaw','pitch','forward','side','handX','handY','handZ','handPitch','handYaw','handRoll','open','thumb','rightIndex','rightHandX','rightHandY','rightHandZ','rightHandPitch','rightHandYaw','rightHandRoll','rightOpen','rightThumb','magOut','magCue','chargingHandle'];
const CONTRACT={Ready:{duration:1,loop:true},Inspect:{duration:3.6,loop:false},Fire:{duration:.2,loop:false},Reload:{duration:2.3,loop:false,commitPhase:.62},ReloadEmpty:{duration:2.9,loop:false,commitPhase:.5}};

// ---- gun measurements -----------------------------------------------------------------------------------------------
const gun=await loadCarbine();
const magAxis=magazineAxis(gun),dropAxis=r6(unit(magAxis.dropAxis)),grip=gripAxis(gun.grip),DROP=.25;
const M0=gun.nodes.Joint_Magazine.world;assert.deepEqual(gun.nodes.Joint_Magazine.scale,[1,1,1],'Joint_Magazine rest scale is 1');assert.deepEqual(gun.nodes.Joint_Magazine.rotation,[0,0,0,1]);
const uniqueVerts=tris=>[...new Map(tris.flat().map(p=>[p.join(','),p])).values()];
// Charging-handle travel along -X: the handle mesh is swept back in 1 mm steps; at each step the overlap with the stock,
// carry handle and rear sight is the deepest handle vertex inside an obstacle or obstacle vertex inside the moved handle,
// and the clearance is the smallest handle-vertex distance to an obstacle. The handle sits in the receiver channel at
// rest, so the receiver is not an obstacle.
const chargingTravel=(()=>{const h=gun.chargingHandle,obst=gun.surfaces.filter(s=>/Stock|CarryHandle|RearAperture/.test(s.name)),hv=uniqueVerts(h.tris),rows=[];let contactMM=null;
 for(let mm=0;mm<=90;mm++){const d=mm/1000,moved=surface('handle moved',h.tris.map(t=>t.map(q=>[q[0]-d,q[1],q[2]])));let depth=0,mesh=null,gap=Infinity;
  for(const s of obst){for(const p0 of hv){const p=[p0[0]-d,p0[1],p0[2]];gap=Math.min(gap,nearest(p,s).d);if(insideBox(p,s)&&insideTester(s)(p)){const n=nearest(p,s).d;if(n>depth){depth=n;mesh=s.name;}}}
   for(const q of uniqueVerts(s.tris)){if(!insideBox(q,moved))continue;if(insideTester(moved)(q)){const n=nearest(q,moved).d;if(n>depth){depth=n;mesh=s.name;}}}}
  if(depth>0)gap=0;if(contactMM===null&&gap<1e-4)contactMM=mm;rows.push({mm,overlapMM:+(depth*1000).toFixed(3),clearanceMM:+(gap*1000).toFixed(3),mesh});}
 // sub-millimetre contact: bisect the first step with zero clearance, testing vertices both ways (handle vertices against
 // the obstacles and obstacle vertices against the moved handle), since the first touch is a stock edge entering the handle
 const obstVerts=obst.map(s=>uniqueVerts(s.tris)),touching=m=>{const moved=surface('handle moved',h.tris.map(t=>t.map(q=>[q[0]-m,q[1],q[2]])));
  for(const [i,s]of obst.entries()){for(const p0 of hv){const p=[p0[0]-m,p0[1],p0[2]];if(nearest(p,s).d<1e-5||insideBox(p,s)&&insideTester(s)(p))return true;}
   for(const q of obstVerts[i]){if(!insideBox(q,moved,1e-5))continue;if(nearest(q,moved).d<1e-5||insideTester(moved)(q))return true;}}return false;};
 let lo=Math.max(0,contactMM-1)/1000,hi=contactMM/1000;for(let k=0;k<20;k++){const m=(lo+hi)/2;if(touching(m))hi=m;else lo=m;}
 return {contactMM:+(hi*1000).toFixed(2),rows};})();
const TOL_MM=1.0,travelRow=[...chargingTravel.rows].reverse().find(r=>r.overlapMM<=TOL_MM&&chargingTravel.rows.filter(q=>q.mm<=r.mm).every(q=>q.overlapMM<=TOL_MM)),travelMetres=+(travelRow.mm/1000).toFixed(3);
// Magazine release button (right side of the lower receiver, above the trigger guard): steel faces at z > 16.3 mm.
const button=(()=>{const pts=gun.steel.tris.flat().filter(p=>p[2]>.0163&&p[0]>-.01&&p[0]<.01&&p[1]>.04&&p[1]<.047);const c=[0,1].map(k=>(Math.min(...pts.map(p=>p[k]))+Math.max(...pts.map(p=>p[k])))/2);return {centre:[c[0],c[1],Math.max(...pts.map(p=>p[2]))],normal:[0,0,1],radius:(Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0])))/2};})();
// Charging handle latch: the left wing of the T-handle (z < -13.5 mm).
const latch=(()=>{const pts=gun.chargingHandle.tris.flat().filter(p=>p[2]<-.0135);const mn=[0,1,2].map(k=>Math.min(...pts.map(p=>p[k]))),mx=[0,1,2].map(k=>Math.max(...pts.map(p=>p[k])));return {min:mn,max:mx,centre:mn.map((v,k)=>(v+mx[k])/2)};})();
// Magazine floorplate (area-weighted downward faces below y -0.085): centre and outward normal.
const floor=(()=>{let A=0,N=[0,0,0],C=[0,0,0];for(const t of gun.magazine.tris){const n=cross(sub(t[1],t[0]),sub(t[2],t[0])),a=len(n)/2;if(a<1e-12)continue;const u=mul(n,1/(2*a));if(u[1]<-.6&&Math.min(...t.map(p=>p[1]))<-.085){A+=a;N=add(N,mul(u,a));C=add(C,mul(mul(add(add(t[0],t[1]),t[2]),1/3),a));}}return {centre:mul(C,1/A),normal:unit(N)};})();

// ---- hand designs -------------------------------------------------------------------------------------------------
const supportKnuckles=[[.0905,.0295,0],[.0885,.0100,0],[.0835,-.0080,0],[.0745,-.0250,0]],gloveRadii=[.0070,.0078,.0071,.0061];
const choices={
 right:{yaw:15,pitch:0,roll:0,wrist:[-.19,-.0115,.0505],mcp:supportKnuckles,fingerL:anatomy.fingerL,fingerRadii:gloveRadii,fingerGap:.0012,fingerSplay:32,
  triggerY:.023,triggerGap:.0012,distalTiltDeg:0,thumbY:.04,thumbOverX:-.137,thumbOverY:.03,thumbOverZ:0,thumbOverLift:.004,thumbGap:.0016,curvePoints:8},
 left:{yaw:40,pitch:18,roll:0,wristX:.105,palmZ:-.018,palmGap:.0015,fingerGap:.0012,fingerSplay:28,fingerRadii:gloveRadii,mcp:supportKnuckles,thumbGap:.0025,thumbHeight:-.4,thumbRiseDeg:4,thumbContact:.03,thumbBulge:.004,curvePoints:8},
 shoulders:{leftYZ:[-.02,-.2],rightElbowInteriorDeg:135,rightUpperToward:[-.35,-.75,.55]}};
for(const k of ['right','left','shoulders'])Object.assign(choices[k],overrides[k]??{});
const cachePath=opt('--design-cache',null);let designs=null;
if(cachePath){try{const c=JSON.parse(await readFile(cachePath,'utf8'));if(JSON.stringify(c.choices)===JSON.stringify({right:choices.right,left:choices.left,leftYZ:choices.shoulders.leftYZ}))designs=c;}catch{}}
if(!designs){designs={choices:{right:choices.right,left:choices.left,leftYZ:choices.shoulders.leftYZ},R:designRight(gun,choices.right),L:designLeft(gun,choices.left,{shoulderYZ:choices.shoulders.leftYZ})};if(cachePath)await writeFile(cachePath,JSON.stringify(designs));}
const {R,L}=designs;

// ---- rig ------------------------------------------------------------------------------------------------------------
// Each forearm runs along its hand axis (wrist to the knuckle midpoint, as the measurement defines it), so both wrists
// are straight at Ready. The left shoulder x is solved by the design (elbow one upper arm from it); the right shoulder is
// placed one upper arm from the right elbow at the chosen elbow angle, back, down and out (off-screen, as pistol rig v6).
const meanMcp=supportKnuckles.reduce((s,m)=>add(s,mul(m,.25)),[0,0,0]),knuckleAxis=(W,F)=>unit(sub(atnToGun(W,F,meanMcp),W));
const poleFor=(S,E,W)=>{const d=unit(sub(W,S)),foot=add(S,mul(d,dot(sub(E,S),d)));return add(E,mul(unit(sub(E,foot)),.2));};
const rightArm=(()=>{const W=r5(R.wrist),fore=knuckleAxis(W,R.frame),E=sub(W,mul(fore,.31)),bend=(180-choices.shoulders.rightElbowInteriorDeg)*deg,toward=choices.shoulders.rightUpperToward;
 const side=unit(sub(toward,mul(fore,dot(toward,fore)))),dir=unit(add(mul(fore,-Math.cos(bend)),mul(side,Math.sin(bend)))),S=r5(add(E,mul(dir,.33)));
 return {shoulder:S,wrist:W,pole:r5(poleFor(S,E,W)),elbow:E,forearm:fore};})();
const leftArm=(()=>{const W=r5(L.rig.wrist),fore=knuckleAxis(W,L.frame),E=sub(W,mul(fore,.31)),yz=choices.shoulders.leftYZ,dy=E[1]-yz[0],dz=E[2]-yz[1],S=r5([E[0]-Math.sqrt(Math.max(0,.33*.33-dy*dy-dz*dz)),yz[0],yz[1]]);
 return {shoulder:S,wrist:W,pole:r5(poleFor(S,E,W)),elbow:E,forearm:fore};})();
const basisEuler=cols=>{const m=new THREE.Matrix4().makeBasis(...cols.map(c=>new THREE.Vector3(...c))),e=new THREE.Euler().setFromRotationMatrix(m,'XYZ');return [e.x,e.y,e.z];};
const rig={version:1,profile:'carbineM4',units:'metres',forward:'+X',up:'+Y',right:'+Z',bones:41,maxReachMargin:.00001,twistFractions:[.4,.8],
 arms:{right:{shoulder:rightArm.shoulder,wrist:rightArm.wrist,pole:rightArm.pole,upperLength:.33,forearmLength:.31},left:{shoulder:leftArm.shoulder,wrist:leftArm.wrist,pole:leftArm.pole,upperLength:.33,forearmLength:.31}},
 restHandRotations:{right:basisEuler(localBasis(R.frame,'right')),left:basisEuler(localBasis(L.frame,'left'))},
 poseFields:{right:['rightHandX','rightHandY','rightHandZ'],left:['handX','handY','handZ']}};
for(const side of ['right','left']){const a=rig.arms[side],ik=solveArmIK(a.shoulder,a.wrist,a.pole,a.upperLength,a.forearmLength),arm=side==='right'?rightArm:leftArm;assert(!ik.clamped,side+' rest wrist reachable');
 assert(len(sub(ik.elbow,arm.elbow))<1e-4,side+' rest elbow reproduces the designed elbow ('+len(sub(ik.elbow,arm.elbow))+')');}

// ---- program grip data ----------------------------------------------------------------------------------------------
// Glove-local frames: x = hand axis, y = thumb side, z = dorsal (right; the pistol glove's layout) or palmar (left; the
// support glove v13). Both gloves share the v13 anatomy: palm, thenar and wrist ellipsoids sit at the same hand
// coordinates, so the pair matches.
const LOCAL_WRIST={right:[-.105,-.079,.04],left:[-.105,-.079,-.040]};
function gripData(side,design,W){const F=design.frame,B=localBasis(F,side),lw=LOCAL_WRIST[side],A=anatomy;
 const fingers=side==='right'?[design.index,...design.fingers]:design.fingers,thumb=design.thumb,radii=fingers.map(f=>f.radius);
 const atn=p=>{const q=sub(p,W);return [dot(q,F.a),dot(q,F.t),dot(q,F.n)];};
 const ext={min:[1,1,1],max:[-1,-1,-1]},grow=(p,r)=>{for(let k=0;k<3;k++){ext.min[k]=Math.min(ext.min[k],p[k]-r);ext.max[k]=Math.max(ext.max[k],p[k]+r);}};
 for(const s of [1,-1])for(let k=0;k<3;k++){const p=[...A.palm];p[k]+=s*A.palmR[k];grow(p,0);const q=[...A.thenar];q[k]+=s*A.thenarR[k];grow(q,0);}
 grow([-A.wristBack,0,0],A.wristR[1]);grow(A.wristEnd,A.wristR[1]);
 for(const f of fingers){const c=catmull(f.points);for(let k=0;k<=48;k++)grow(atn(c(k/48)),tubeRadius(f.radius,k/48));}
 {const c=catmull(thumb.points);for(let k=0;k<=48;k++)grow(atn(c(k/48)),tubeRadius(A.thumbR,k/48));}
 const toLocal=h=>add(lw,[h[0],h[1],side==='right'?-h[2]:h[2]]),margin=.008,lo=toLocal(ext.min.map(v=>v-margin)),hi=toLocal(ext.max.map(v=>v+margin));
 const bounds={min:r5([0,1,2].map(k=>Math.min(lo[k],hi[k]))),max:r5([0,1,2].map(k=>Math.max(lo[k],hi[k])))},cells=[0,1,2].reduce((a,k)=>a*(bounds.max[k]-bounds.min[k])/.00265,1);
 assert(cells<1e6,side+' implicit-surface grid too large: '+cells);
 const splay=(choices[side].fingerSplay??0)*deg,u=[Math.cos(splay),-Math.sin(splay),0];
 const knuckles=supportKnuckles.map((m,f)=>[r5(toLocal([A.palm[0],.8*m[1]+.2*A.palm[1],.004])),r5(toLocal(sub(m,mul(u,.003)))),.0085,r5(radii[f]-.0008)]);
 // Flexion axes in the gun frame (bone-local at rest): fingers flex about their plane normals; the thumb toward the index knuckle.
 const thumbAxis=unit(cross(sub(catmull(thumb.points)(1),thumb.points[0]),sub(fingers[0].points[0],thumb.points[0])));
 return {wrist:lw,palm:r5(toLocal(A.palm)),bounds,cells:Math.round(cells),knuckles,fingerRadii:radii,fingers:fingers.map(f=>r5(f.points)),thumb:r5(thumb.points),axes:[...fingers.map(f=>r6(f.axis)),r6(thumbAxis)],
  handFrame:{a:r6(F.a),t:r6(F.t),n:r6(F.n)}};}
const grips={right:gripData('right',R,rig.arms.right.wrist),left:gripData('left',L,rig.arms.left.wrist)};
grips.frame='fingers and thumb are gun-frame metres at Ready (mapped to the glove frame with fromHand); axes are gun-frame flexion axes; handFrame is (a hand axis, t thumb side, n palmar normal)';

// Finger channels: degrees per segment (base, mid, tip) at channel value 1; each finger flexes about its own axis.
// Left closing is per finger: the index and little finger, which sit beside the narrow magazine, close further than the
// ring finger, which meets its front face first.
const fingerFlex={leftClose:[[60,70,40],[40,55,35],[22,40,26],[45,60,40]],leftOpen:[18,22,12],leftThumb:[16,14,8],leftThumbOut:[18,8,4],
 rightPress:[2.2,1.4,.8],rightExtend:[10,+(R.index.flexDeg.pipDeg*.8).toFixed(1),+(R.index.flexDeg.dipDeg*.8).toFixed(1)],rightClose:[12,24,18],rightOpen:[14,26,14],rightThumb:[10,10,6],rightThumbOut:[30,20,10],
 ...overrides.fingerFlex};
const poser=makePoser({rig,grips,fingerFlex});

// ---- gun pose helpers (the magazine and the charging handle move with their channels) --------------------------------
const fixed=gun.surfaces.filter(s=>!s.owner),movedCache=new Map();
const shifted=(s,d,key)=>{if(!movedCache.has(key))movedCache.set(key,{...surface(s.name,s.tris.map(t=>t.map(q=>add(q,d)))),owner:s.owner});return movedCache.get(key);};
function gunAt(p){const out=[...fixed],mo=Math.round((p.magOut??0)*2000)/2000,ch=Math.round((p.chargingHandle??0)*2000)/2000;
 if(mo<.999)for(const s of gun.surfaces.filter(s=>s.owner==='Joint_Magazine'))out.push(mo?shifted(s,mul(dropAxis,mo*DROP),s.name+mo):s);
 for(const s of gun.surfaces.filter(s=>s.owner==='Joint_ChargingHandle'))out.push(ch?shifted(s,[-ch*travelMetres,0,0],s.name+ch):s);return out;}
const magSurfaces=gun.surfaces.filter(s=>s.owner==='Joint_Magazine');

// ---- key poses ----------------------------------------------------------------------------------------------------
const zero=Object.fromEntries(channels.map(c=>[c,0])),pose=(o={})=>({...zero,...o});
// Rotation (world) that takes the rest hand frame (a, n) to the target (a2, n2).
const frameRotation=(F,a2,n2)=>{const m0=new THREE.Matrix4().makeBasis(...[F.a,F.n,cross(F.a,F.n)].map(v=>new THREE.Vector3(...v))),n2o=unit(sub(n2,mul(a2,dot(n2,a2)))),m1=new THREE.Matrix4().makeBasis(...[a2,n2o,cross(a2,n2o)].map(v=>new THREE.Vector3(...v)));return new THREE.Quaternion().setFromRotationMatrix(m1.multiply(m0.transpose()));};
const LF=grips.left.handFrame,RF=grips.right.handFrame,W0L=rig.arms.left.wrist,W0R=rig.arms.right.wrist;
// (1) Magazine seat: palm on the floorplate (palm normal against the plate normal), the hand axis turned `heading`
// degrees from the plate's forward line toward +Z, rolled `roll` degrees about itself; the palm centre is offset in the
// plate (forward, right) and the fingers and thumb close on the magazine body. The cue is fixed to the wrist so that at
// this pose it coincides with the seated magazine (Joint_Magazine at rest, identity rotation). palmGap is the centreline
// palm's gap; on the skinned glove (pipeline/measure-carbine-grip.mjs) 3 mm left the heel of the palm 1.27 mm inside the
// floorplate, so the seat keeps 4.7 mm.
const seatSpec={heading:0,roll:0,offset:[.002,0],palmGap:.0047,open:-.6,thumb:.3,...overrides.seat};
function seatPose(spec){const nP=mul(floor.normal,-1),fwd=unit(sub([1,0,0],mul(nP,dot([1,0,0],nP)))),right=unit(cross(fwd,nP));
 const h=spec.heading*deg,a2=unit(add(mul(fwd,Math.cos(h)),mul(right,Math.sin(h)))),n2=unit(add(mul(nP,Math.cos(spec.roll*deg)),mul(cross(a2,nP),Math.sin(spec.roll*deg)))),Q=frameRotation(LF,a2,n2);
 const palmRest=atnToGun(W0L,LF,anatomy.palm),P=add(add(floor.centre,add(mul(fwd,spec.offset[0]),mul(right,spec.offset[1]))),mul(nP,-(anatomy.palmR[2]+spec.palmGap)));
 const W=sub(P,qrot(Q,sub(palmRest,W0L))),d=sub(W,W0L),e=eulerOf(Q);return pose({handX:d[0],handY:d[1],handZ:d[2],handPitch:e[0],handYaw:e[1],handRoll:e[2],open:spec.open,thumb:spec.thumb});}
const seat=seatPose(seatSpec),seatWrist=poser.wristPose('left',seat),cueCenter=r6(qrot(seatWrist.Q.clone().invert(),sub(M0,seatWrist.W))),cueRotation=r6(eulerOf(seatWrist.Q.clone().invert()));
const along=(p,metres)=>pose({...p,handX:p.handX+dropAxis[0]*metres,handY:p.handY+dropAxis[1]*metres,handZ:p.handZ+dropAxis[2]*metres});
// (2) Magazine release. The right hand rings the grip (fingers round the front strap, thumb over the back strap), and the
// glove index is too short to reach the button from the grip (button 54 mm ahead of the trigger face), so the hand comes
// off: it opens and slides down the grip axis, swings out to the right, and the straightened index presses the button
// face 0.5 mm. The path keys (down, out, press) were found by a collision search over the posed centrelines (scratch
// search; values kept here) and are re-checked at 60 Hz below.
const releaseSpec={slide:.0377,slideOpen:.902,slideThumb:-1.181,slideEuler:[.0679,-.0504,.003],outZ:.0296,outOpen:1.336,outThumb:-.636,euler:[.2324,.5469,.2904],rightIndex:-1.2502,rightOpen:1.3144,rightThumb:-.7619,press:0,padT:.9105,...overrides.release};
function releasePose(spec){let q=pose({rightIndex:spec.rightIndex,rightOpen:spec.rightOpen,rightThumb:spec.rightThumb,rightHandPitch:spec.euler[0],rightHandYaw:spec.euler[1],rightHandRoll:spec.euler[2]});
 for(let it=0;it<8;it++){const c=poser.finger('right',0,q,50).reduce((a,x)=>Math.abs(x.t-spec.padT)<Math.abs(a.t-spec.padT)?x:a),target=add(button.centre,mul(button.normal,c.r-spec.press)),d=sub(target,c.p);
  q=pose({...q,rightHandX:q.rightHandX+d[0],rightHandY:q.rightHandY+d[1],rightHandZ:q.rightHandZ+d[2]});}return q;}
const lerpPose=(a,b,u)=>Object.fromEntries(channels.map(c=>[c,a[c]+(b[c]-a[c])*u]));
const release=releasePose(releaseSpec),gripDown=mul(grip.up,-1);
const offGrip=pose({rightHandX:gripDown[0]*releaseSpec.slide,rightHandY:gripDown[1]*releaseSpec.slide,rightHandZ:gripDown[2]*releaseSpec.slide,rightOpen:releaseSpec.slideOpen,rightThumb:releaseSpec.slideThumb,rightIndex:-1,rightHandPitch:releaseSpec.slideEuler[0],rightHandYaw:releaseSpec.slideEuler[1],rightHandRoll:releaseSpec.slideEuler[2]});
const outRight=pose({...lerpPose(offGrip,release,.5),rightHandZ:(offGrip.rightHandZ+release.rightHandZ)/2+releaseSpec.outZ,rightOpen:releaseSpec.outOpen,rightThumb:releaseSpec.outThumb,rightIndex:-1});
const rightOnly=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k.startsWith('right')));
// (3) Charging handle: the hand comes over the receiver from the left, index hooked in front of the latch wing, thumb
// behind it; the pinch point (thumb pad to the nearest index sample) sits on the latch. Solved for the wrist translation
// at the chosen frame (hand axis a, palmar normal n).
const pinchSpec={a:[.9348,-.1928,.2983],n:[.3889,-.826,-.408],open:-.6363,thumb:.1828,offset:[-.01055,.0077,.01324],...overrides.pinch};
function pinchMid(p){const th=poser.finger('left',4,p,40),ix=poser.finger('left',0,p,40),tp=th.find(x=>x.t>=.88).p;let best={d:Infinity};for(const s of ix)if(s.t>.6){const d=len(sub(s.p,tp));if(d<best.d)best={d,p:s.p};}return {thumb:tp,index:best.p,mid:mul(add(tp,best.p),.5),gap:best.d};}
function pinchPose(spec,handle){const Q=frameRotation(LF,unit(spec.a),unit(spec.n)),e=eulerOf(Q);let q=pose({handPitch:e[0],handYaw:e[1],handRoll:e[2],open:spec.open,thumb:spec.thumb,chargingHandle:handle});
 const target=add([latch.centre[0]-handle*travelMetres,latch.centre[1],latch.centre[2]],spec.offset);
 for(let it=0;it<6;it++){const d=sub(target,pinchMid(q).mid);q=pose({...q,handX:q.handX+d[0],handY:q.handY+d[1],handZ:q.handZ+d[2]});}return q;}
const pinchRest=pinchPose(pinchSpec,0),pinchFull=pinchPose(pinchSpec,1);

// ---- clips --------------------------------------------------------------------------------------------------------
// The sampler eases every channel to rest at each key (quintic), so a hand that should keep moving gets few keys, and a
// hand that waits holds the same values across the other hand's keys.
const key=(t,phase,p={})=>({t:+t.toFixed(5),phase,v:channels.map(c=>Math.round((p[c]??0)*1e6)/1e6)});
// Presentation (view-model channels, applied to gun and hands together): the reload raises and cants the gun so the
// well shows; for the charging handle the gun drops, moves out and turns its rear right, so the left forearm, which
// reaches back to the handle 0.25 m in front of the hip eye, does not cover the view.
const present={roll:-.38,lift:.05,forward:.02,pitch:.09,yaw:.16,side:-.02,...overrides.present},presentHandle={roll:-.3,lift:-.06,forward:.07,pitch:.12,yaw:.15,side:0,...overrides.presentHandle};
const gp=(f=1)=>Object.fromEntries(Object.entries(present).map(([k,v])=>[k,v*f])),gh=(f=1)=>Object.fromEntries(Object.entries(presentHandle).map(([k,v])=>[k,v*f]));
const leftPart=p=>Object.fromEntries(['handX','handY','handZ','handPitch','handYaw','handRoll','open','thumb'].map(k=>[k,p[k]??0]));
const leftOpen={handY:-.01,handZ:-.006,open:1.1,thumb:-.8,...overrides.leftOpen};
// The support hand drops out of the hip view (below and left, fingers relaxed) while the right hand works the release,
// then goes on to the pouch; at the shared key in between it is part way along that drop.
const leftAway={handX:-.13,handY:-.30,handZ:-.12,handPitch:.2,handYaw:.3,handRoll:.45,open:.1,thumb:-.2,...overrides.leftAway},leftDrop={...lerpPose(pose(leftOpen),pose(leftAway),.4),open:.45,thumb:-.45};
const pouch={handX:-.25,handY:-.40,handZ:-.16,handPitch:.35,handYaw:.45,handRoll:.55,open:.25,thumb:-.3,...overrides.pouch};
const below=along(seat,DROP),under={...leftPart(below),handX:below.handX-.07,handY:below.handY-.05,handZ:below.handZ-.09,handPitch:below.handPitch+.2,handYaw:below.handYaw+.15,handRoll:below.handRoll+.1,...overrides.under};
const pouchGrab={...pouch,handX:pouch.handX+.004,handY:pouch.handY+.015,open:seat.open,thumb:seat.thumb};
// After the press the right hand returns to the firing grip with the index on the trigger face (Ready): the straight
// index cannot swing back into the guard on its single flexion axis without crossing the receiver (measured 10 mm).
const indexed={rightIndex:0,rightOpen:0,...overrides.indexed};
const approach={handY:-.04,handZ:-.012,handX:-.006,open:1.0,thumb:-.6,...overrides.approach},belowGuard={handX:-.03,handY:-.09,handZ:-.07,handRoll:.15,open:.8,thumb:-.5,...overrides.belowGuard};
const seatL=leftPart(seat);
// Shared keys up to the commit; ReloadEmpty compresses them to its commit phase.
function toCommit(commit){const s=commit/.62,k=(t,phase,p)=>key(t*s,phase,p);return [
 key(0,'ready'),
 k(.035,'hands open',{...gp(.2),...rightOnly(offGrip),...leftOpen}),
 k(.065,'support hand off, right hand out',{...gp(.4),...rightOnly(outRight),...leftPart(leftDrop)}),
 k(.09,'press magazine release',{...gp(.6),...rightOnly(release),...leftAway}),
 k(.11,'magazine falls',{...gp(.7),...rightOnly(release),...leftAway,magOut:.4}),
 k(.135,'right hand back',{...gp(.8),...rightOnly(outRight),...leftAway,magOut:.8}),
 k(.16,'right hand on the grip',{...gp(.9),...rightOnly(offGrip),...leftAway,magOut:1}),
 k(.185,'right hand back on the grip',{...gp(1),...indexed,...leftAway,magOut:1}),
 k(.26,'reach pouch',{...gp(1),...indexed,...pouch,magOut:1}),
 k(.30,'grasp magazine',{...gp(1),...indexed,...pouchGrab,magOut:1}),
 k(.33,'draw magazine',{...gp(1),...indexed,...pouchGrab,handY:pouchGrab.handY+.04,magOut:1,magCue:1}),
 k(.43,'bring magazine under the well',{...gp(1),...indexed,...under,magOut:1,magCue:1}),
 k(.49,'align below the well',{...gp(1),...indexed,...leftPart(below),magOut:1,magCue:1}),
 k(.585,'insert and seat',{...gp(1),...indexed,...seatL,magOut:0,magCue:1}),
 k(.61,'seated (key before commit)',{...gp(1),...indexed,...seatL,magOut:0,magCue:1}),
 key(commit,'commit',{...gp(1),...indexed,...seatL,magOut:0,magCue:0})];}
const tug=leftPart(along(seat,.003)),letGo={...leftPart(along(seat,.045)),handZ:seat.handZ-.05,open:.5,thumb:-.4};
const reloadKeys=[...toCommit(.62),
 key(.66,'tug',{...gp(1),...indexed,...tug}),
 key(.70,'let go of the magazine',{...gp(.9),...indexed,...letGo}),
 key(.82,'under the handguard',{...gp(.25),...indexed,...approach}),
 key(.92,'grip the handguard',{}),
 key(1,'ready')];
const preGrasp=p=>({...leftPart(p),handX:p.handX+.01,handY:p.handY+.025,handZ:p.handZ-.02,open:.2,thumb:-.3});
const besideReceiver={...leftPart(pinchRest),handX:pinchRest.handX+.06,handY:pinchRest.handY-.08,handZ:pinchRest.handZ-.10,open:.05,thumb:-.15,...overrides.besideReceiver};
const emptyKeys=[...toCommit(.5),
 key(.535,'tug',{...gp(1),...indexed,...tug}),
 key(.565,'let go of the magazine',{...gp(.9),...indexed,...letGo}),
 key(.61,'beside the receiver',{...gh(.7),...indexed,...besideReceiver}),
 key(.645,'over the receiver',{...gh(1),...indexed,...preGrasp(pinchRest),handZ:pinchRest.handZ-.06,handY:pinchRest.handY+.01}),
 key(.67,'reach the charging handle',{...gh(1),...indexed,...preGrasp(pinchRest)}),
 key(.695,'grasp the latch',{...gh(1),...indexed,...leftPart(pinchRest)}),
 key(.76,'pull the charging handle',{...gh(1),...indexed,...leftPart(pinchFull),chargingHandle:1}),
 key(.78,'let go of the handle',{...gh(1),...indexed,...leftPart(pinchFull),handY:pinchFull.handY+.012,open:-.6,chargingHandle:1}),
 key(.80,'handle runs home',{...gh(.9),...indexed,...leftPart(pinchFull),handY:pinchFull.handY+.035,handZ:pinchFull.handZ-.03,open:.2,thumb:0,chargingHandle:0}),
 key(.84,'clear the receiver',{...gh(.6),...indexed,...besideReceiver}),
 key(.875,'below the handguard',{...gp(.25),...indexed,...belowGuard}),
 key(.92,'under the handguard',{...gp(.1),...indexed,...approach}),
 key(.96,'grip the handguard',{}),
 key(1,'ready')];
// Inspect: the left view turns the muzzle left so the left side faces the hip camera; the right view turns the muzzle
// right and up, rolls the gun counter-clockwise (top to the left) and pushes it out, so the right side and ejection port
// face the camera without the stock filling the view (chosen from nine candidate views rendered side by side).
const view={left:{lift:.035,yaw:.45,roll:.1,pitch:.02},right:{lift:-.05,yaw:-.55,roll:.7,pitch:.2,forward:.1,side:.03},...overrides.view};
const clips={
 Ready:{...CONTRACT.Ready,keys:[key(0,'ready'),key(1,'ready')]},
 Inspect:{...CONTRACT.Inspect,keys:[key(0,'ready'),key(.22,'left view',view.left),key(.42,'left hold',view.left),key(.64,'right view',view.right),key(.78,'right hold',view.right),key(1,'ready')]},
 Fire:{...CONTRACT.Fire,hold:'held while the trigger is down; recoil is procedural (parent-owned)',keys:[key(0,'trigger pressed',{rightIndex:1}),key(1,'trigger pressed',{rightIndex:1})]},
 Reload:{...CONTRACT.Reload,keys:reloadKeys},
 ReloadEmpty:{...CONTRACT.ReloadEmpty,keys:emptyKeys}};

const motion={version:1,id:'carbine-m4-motion-v1',profile:'carbineM4',sampleRate:60,units:'metres and radians; normalized key times',channels,
 reloadCommitPhase:CONTRACT.Reload.commitPhase,reloadEmptyCommitPhase:CONTRACT.ReloadEmpty.commitPhase,
 magazine:{node:'Joint_Magazine',channel:'magOut',meaning:'0 seated; Joint_Magazine translates by magOut x dropMetres along dropAxis (gun frame); hidden when magOut >= 0.999',
  dropAxis,dropAxisLabel:'Measured on the saved M4: least-squares lines through the front and rear faces of the seated magazine\'s straight section inside the well ('+magAxis.samples+' slices); rear face '+magAxis.rearFaceSlopeDegFromVertical.toFixed(2)+' and front face '+magAxis.frontFaceSlopeDegFromVertical.toFixed(2)+' degrees from vertical',
  dropMetres:DROP,dropMetresLabel:'Target presentation travel. The magazine clears the well after 0.015 m (measured: seated top 0.0125 m, well mouth -0.002 m). The reload inserts the cue from this point, so the gun magazine reappears exactly on the cue (both follow one key pair) out of the hip view, and only the cue hides at the commit.',
  seatedPosition:r6(M0),restScale:[1,1,1]},
 magazineCue:{source:'copy of the Joint_Magazine subtree of the saved M4 (asset '+M4.assetId+', revision '+M4.revisionId+')',parent:'Joint_left_left_wrist',channel:'magCue',visibility:'shown only when magCue > 0.5',
  leftWristRelativeCenter:cueCenter,leftWristRelativeRotation:cueRotation,rotationOrder:'Euler XYZ, radians, in the left wrist joint frame',
  meaning:'replaces the copied Joint_Magazine node\'s local position (its origin, not a geometric centre) and rotation; scale stays 1; visibility fraction, no ammunition-state authority',
  seat:'derived from the seat pose: at the keys "insert and seat" and "seated (key before commit)" the cue coincides with the seated Joint_Magazine (measured error in evidence/carbine-m4-hands-v1/)'},
 chargingHandle:{node:'Joint_ChargingHandle',channel:'chargingHandle',axis:[-1,0,0],travelMetres,meaning:'0 forward; Joint_ChargingHandle translates by chargingHandle x travelMetres along -X',
  travelLabel:'Measured on the saved M4 (1 mm sweep, contact bisected): the T-handle first touches the stock at '+chargingTravel.contactMM+' mm of pull, because the stock top at its front sits 0.2 mm above the handle\'s lower edge. '+travelMetres+' m is the longest pull whose overlap with the stock stays within '+TOL_MM+' mm ('+travelRow.overlapMM+' mm, under the handle); the 0.07 m estimate overlaps '+chargingTravel.rows.find(r=>r.mm===70).overlapMM+' mm. The carry handle and rear sight are never reached.',
  latch:{centre:r5(latch.centre),min:r5(latch.min),max:r5(latch.max)}},
 rightIndex:{meaning:'0 pad resting on the trigger face (Ready); 1 pressed (Fire); negative straightens the index (the magazine release press); after the press the pad returns to the trigger face, because the single-axis index cannot leave or re-enter the guard without crossing the receiver',magazineRelease:{centre:r5(button.centre),normal:button.normal}},
 clips,cameraPlacementAuthority:'game/carbine-m4-view-v1.json (pipeline/derive-sight-view.mjs)'};

// ---- authoring checks (centreline evidence; the saved GLB is measured by pipeline/measure-carbine-grip.mjs) --------------
const checks={},failures=[],check=(ok,msg)=>{if(!ok)failures.push(msg);};
{for(const [name,c]of Object.entries(CONTRACT)){const m=motion.clips[name];check(m.duration===c.duration&&!!m.loop===!!c.loop&&m.keys[0].t===0&&m.keys.at(-1).t===1,name+' duration, loop and key range');
  for(let i=1;i<m.keys.length;i++)check(m.keys[i].t>m.keys[i-1].t,name+' key times increase at '+i);
  if(name!=='Fire')check(m.keys[0].v.every(v=>v===0)&&m.keys.at(-1).v.every(v=>v===0),name+' starts and ends at Ready');
  else check(m.keys.every(k=>k.v.every((v,i)=>channels[i]==='rightIndex'?v===1:v===0)),'Fire is Ready with rightIndex 1 at every key');
  if(c.commitPhase){const k=m.keys.find(x=>Math.abs(x.t-c.commitPhase)<1e-9),i=m.keys.indexOf(k),pc=sampleTimeline(motion,name,c.commitPhase);check(k&&pc.magCue===0&&pc.magOut===0,name+' commit: magCue 0 and magOut 0');
   const before=m.keys[i-1],pb=Object.fromEntries(channels.map((ch,j)=>[ch,before.v[j]])),{W,Q}=poser.wristPose('left',pb),cue=add(W,qrot(Q,cueCenter)),cq=Q.clone().multiply(quat(cueRotation));
   const err=len(sub(cue,M0)),ang=angleBetween(cq,new THREE.Quaternion());check(err<.001&&ang<1,name+' cue on the seat before the commit');checks[name+'CueToSeat']={key:before.phase,t:before.t,positionErrorMM:+(err*1000).toFixed(4),angleErrorDeg:+ang.toFixed(4),magOutAtKey:pb.magOut};}}
 // the gun magazine is shown only where the cue is: wherever magOut < 0.999 while magCue > 0.5, the two coincide
 for(const name of ['Reload','ReloadEmpty']){const n=Math.ceil(motion.clips[name].duration*240);let worst=0;for(let i=0;i<=n;i++){const p=sampleTimeline(motion,name,i/n);if(p.magCue>.5&&p.magOut<.999){const {W,Q}=poser.wristPose('left',p),cue=add(W,qrot(Q,cueCenter)),mag=add(M0,mul(dropAxis,p.magOut*DROP));worst=Math.max(worst,len(sub(cue,mag)),angleBetween(Q.clone().multiply(quat(cueRotation)),new THREE.Quaternion())*1e-3);}}
  checks[name+'CueVsGunMagazineWhileBothShownMM']=+(worst*1000).toFixed(4);check(worst<.001,name+' cue and gun magazine coincide whenever both are shown');}
 // reach at every 60 Hz sample
 const reach={};for(const [name,c]of Object.entries(motion.clips)){const n=Math.ceil(c.duration*60);for(let i=0;i<=n;i++){const p=sampleTimeline(motion,name,i/n);for(const side of ['right','left']){const m=poser.arm(side,p).reachMargin,k=name+'.'+side;if(!reach[k]||m<reach[k].marginM)reach[k]={marginM:+m.toFixed(5),t:+(i/n).toFixed(4)};}}}
 for(const [k,v]of Object.entries(reach))check(v.marginM>rig.maxReachMargin,'no stretch: '+k);checks.reachMinMarginM=reach;
 // pinch at full pull
 const fullKey=motion.clips.ReloadEmpty.keys.find(k=>k.phase==='pull the charging handle'),pf=Object.fromEntries(channels.map((ch,i)=>[ch,fullKey.v[i]])),pm=pinchMid(pf);
 const handleAtFull=gunAt({chargingHandle:1}).find(s=>s.owner==='Joint_ChargingHandle'),pd=nearest(pm.mid,handleAtFull).d;
 checks.pinchAtFullPull={pinchToHandleMM:+(pd*1000).toFixed(2),thumbToIndexMM:+(pm.gap*1000).toFixed(2)};check(pd<.015,'pinch within 15 mm of the handle at full pull');
 // hand and sleeve penetration at every 60 Hz sample (centrelines; the gun posed by its channels), reported as intervals.
 // The cue is compared with the gun magazine at the same drop position: the saved magazine itself overlaps the receiver
 // where it sits in the well (measured below), so only the excess over that reference counts.
 const magVerts=magSurfaces.flatMap(s=>uniqueVerts(s.tris));
 const magOverlap=place=>{let worst=0,mesh=null;const pts=magVerts.map(place);for(const g of fixed)for(const q of pts){if(!insideBox(q,g))continue;if(insideTester(g)(q)){const d=nearest(q,g).d;if(d>worst){worst=d;mesh=g.name;}}}return {mm:worst*1000,mesh};};
 const refOverlap=new Map(),refAt=m=>{const k=Math.round(m*2000);if(!refOverlap.has(k))refOverlap.set(k,magOverlap(q=>add(q,mul(dropAxis,k/2000*DROP))).mm);return refOverlap.get(k);};
 checks.savedMagazineSeatedOverlapMM=+refAt(0).toFixed(2);
 if(!flag('--skip-penetration')){const pen={},intervals={},open={};
  const note=(k,t,w)=>{if(!pen[k]||w.mm>pen[k].mm)pen[k]={mm:+w.mm.toFixed(2),t:+t.toFixed(4),part:w.part??null,mesh:w.mesh??null};
   if(w.mm>1){if(!open[k])open[k]={from:+t.toFixed(4),to:+t.toFixed(4),mm:0};const o=open[k];o.to=+t.toFixed(4);if(w.mm>o.mm){o.mm=+w.mm.toFixed(2);o.part=w.part??null;o.mesh=w.mesh??null;}}
   else if(open[k]){(intervals[k]??=[]).push(open[k]);delete open[k];}};
  for(const [name,c]of Object.entries(motion.clips)){const n=Math.ceil(c.duration*60);for(let i=0;i<=n;i++){const t=i/n,p=sampleTimeline(motion,name,t),surfs=gunAt(p);
    for(const side of ['right','left'])note(name+'.'+side,t,poser.penetration(side,p,surfs));
    if(p.magCue>.5){const {W,Q}=poser.wristPose('left',p),Rc=quat(cueRotation),place=q=>add(W,qrot(Q,add(cueCenter,qrot(Rc,sub(q,M0))))),cue=magOverlap(place);
     // reference: the gun magazine at the cue's position along the drop axis, when the cue is on that axis
     const off=sub(add(W,qrot(Q,cueCenter)),M0),along=dot(off,dropAxis),offAxis=len(sub(off,mul(dropAxis,along))),ang=angleBetween(Q.clone().multiply(Rc),new THREE.Quaternion()),onAxis=offAxis<5e-4&&ang<.5;
     const ref=onAxis?refAt(Math.max(0,along/DROP)):0;note(name+'.cue',t,{mm:Math.max(0,cue.mm-ref),part:'cue (raw '+cue.mm.toFixed(2)+' mm, reference '+ref.toFixed(2)+' mm)',mesh:cue.mesh});}}
   for(const k of Object.keys(open))if(k.startsWith(name+'.')){(intervals[k]??=[]).push(open[k]);delete open[k];}}
  checks.penetrationMaxMM=pen;checks.penetrationOver1mm=intervals;for(const [k,list]of Object.entries(intervals))for(const v of list)check(false,'penetration '+k+' '+v.mm+' mm over t '+v.from+'-'+v.to+' ('+v.part+' in '+v.mesh+')');}
}

// ---- programs -------------------------------------------------------------------------------------------------------
const swap=(s,a,b)=>{assert.equal(s.split(a).length,2,'anchor must be unique: '+String(a).slice(0,90));return s.replace(a,()=>b);};
const base=await text(SOURCE_HANDS);
let hands=swap(base,base.slice(0,base.indexOf('function sampleTimeline')),'const motion='+JSON.stringify(motion)+';\n');
hands=swap(hands,hands.slice(hands.indexOf('const rig='),hands.indexOf('// Extract only axial')),'const rig='+JSON.stringify(rig)+';\n');
{const a=hands.indexOf('const match=n.match(/^Joint_(left|right)Finger'),end='}return {time,rotation:v};});',b=hands.indexOf(end,a);assert(a>0&&b>a);
 hands=hands.slice(0,a)+"const match=n.match(/^Joint_(left|right)Finger(\\d)_.*_(base|mid|tip)$/);if(match)v=fingerEuler(match[1],Number(match[2]),['base','mid','tip'].indexOf(match[3]),p);return {time,rotation:v};});"+hands.slice(b+end.length);}
hands=swap(hands,"name:'No.4 gloves - stock wrist, bolt, charger and forend wrap v2'","name:'M4 gloves - pistol grip, handguard wrap, magazine and charging handle v1'");
hands=swap(hands,hands.slice(hands.indexOf('const fingerLengths='),hands.indexOf('async function build(){')),
 '// M4 grips: right hand on the pistol grip (index pad on the trigger face, thumb along the left side), left hand round\n// the handguard. Authored in the gun frame by pipeline/carbine-hand-author.mjs (pipeline/carbine-hand-design.mjs).\nconst grips='+JSON.stringify(grips)+';\n'+
 '// Finger channels: each finger flexes about its own axis (gun frame at bind = bone-local at rest); degrees per segment.\nconst fingerFlex='+JSON.stringify(fingerFlex)+';\n'+
 "function fingerEuler(side,finger,segment,p){const t=fingerFlex,w=grips[side].axes[finger];let a=0;\n if(side==='left'){if(finger<4){const c=-p.open;a=c>=0?c*t.leftClose[finger][segment]:c*t.leftOpen[segment];}else a=p.thumb>=0?p.thumb*t.leftThumb[segment]:p.thumb*t.leftThumbOut[segment];}\n else{if(finger===0)a=p.rightIndex>=0?p.rightIndex*t.rightPress[segment]:p.rightIndex*t.rightExtend[segment];else if(finger<4){const c=-p.rightOpen;a=c>=0?c*t.rightClose[segment]:c*t.rightOpen[segment];}else a=p.rightThumb>=0?p.rightThumb*t.rightThumb[segment]:p.rightThumb*t.rightThumbOut[segment];}\n if(!a)return [0,0,0];const e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...w),a*Math.PI/180),'XYZ');return [e.x,e.y,e.z].map(x=>x*180/Math.PI);}\n");
hands=swap(hands,'wrist=right?[-.105,-.079,.04]:supportGrip.wrist,palm=right?[-.062,-.049,.031]:supportGrip.palm','wrist=grips[name].wrist,palm=grips[name].palm');
hands=swap(hands,'const thumb=finger===4,yy=right?[.006,-.029,-.047,-.065][finger]:[-.028,-.045,-.062,-.079][finger];let points;','const thumb=finger===4;let points;');
hands=swap(hands,'if(thumb)points=right?[[-.083,-.023,.032],[-.064,.004,.025],[-.046,.0085,.0232],[-.033,.0100,.0218]]:supportGrip.thumb.map(fromHand);','if(thumb)points=grips[name].thumb.map(fromHand);');
hands=swap(hands,'else if(right&&finger===0)points=[[-.034,-.012,.031],[-.014,-.025,.027],[.004,-.039,.023],[.017,-.048,.021]];','');
hands=swap(hands,'else if(right)points=[[-.035,yy,.035],[.014,yy-.002,.030],[.017,yy-.004,.004],[.014,yy-.005,-.026],[-.042,yy-.006,-.028]];','');
hands=swap(hands,'else points=supportGrip.fingers[finger].map(fromHand);','else points=grips[name].fingers[finger].map(fromHand);');
hands=swap(hands,'keep=thumb||!right?0:fingerLengths[name][finger]','keep=0');
hands=swap(hands,'(right?[.0070,.0078,.0071,.0061]:supportGrip.fingerRadii)[finger]','grips[name].fingerRadii[finger]');
hands=swap(hands,'if(right)d=smoothUnion(d,capsule(p,[-.064,-.030,.031],[-.034,-.012,.031],.014,.0078).field,.005);else for(const k of supportGrip.knuckles)d=smoothUnion(d,capsule(p,k[0],k[1],k[2],k[3]).field,.005);','for(const k of grips[name].knuckles)d=smoothUnion(d,capsule(p,k[0],k[1],k[2],k[3]).field,.005);');
hands=swap(hands,'const bounds=right?{min:[-.150,-.135,-.085],max:[.057,.029,.075]}:supportGrip.bounds;','const bounds=grips[name].bounds;');
assert(!hands.includes('supportGrip')&&!hands.includes('fingerLengths'),'every No.4 grip reference replaced');

// Fitting-only assembly: the hands, the saved M4 and a magazine cue (a copy of the M4's Joint_Magazine subtree) on the
// left wrist. A ViewModel group carries the presentation channels (forward, lift, side; pitch about Z, yaw about Y and
// roll about -X, about the gun origin) so a fixed camera at the hip or the aim eye sees the clip as the game does.
const gunSource=await text(M4.source);
let assembly=swap(hands,'async function build(){','async function buildHands(){');
assembly=swap(assembly,"name:'M4 gloves - pistol grip, handguard wrap, magazine and charging handle v1'","name:'M4 hands v1 fitting evidence only'");
assembly=swap(assembly,'return createClip(name,-1,tracks,{loop:clip.loop});',
 "const vm=samples.map(({time,p})=>{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),p.pitch).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1,0,0),p.roll)),e=new THREE.Euler().setFromQuaternion(q,'XYZ');return {time,position:[p.forward,p.lift,p.side],rotation:[e.x,e.y,e.z].map(x=>x*180/Math.PI)};});"+
 "tracks.push(positionTrack('ViewModel',vm.map(({time,position})=>({time,position})),'LINEAR'),rotationTrack('ViewModel',vm.map(({time,rotation})=>({time,rotation})),'LINEAR'));"+
 "tracks.push(positionTrack('Joint_Magazine',samples.map(({time,p})=>({time,position:"+JSON.stringify(r6(M0))+".map((v,i)=>v+"+JSON.stringify(dropAxis)+"[i]*p.magOut*"+DROP+")})),'LINEAR'),scaleTrack('Joint_Magazine',samples.map(({time,p})=>({time,scale:[1,1,1].map(()=>p.magOut>=.999?.001:1)})),'LINEAR'));"+
 "tracks.push(positionTrack('Joint_ChargingHandle',samples.map(({time,p})=>({time,position:"+JSON.stringify(gun.nodes.Joint_ChargingHandle.translation)+".map((v,i)=>i===0?v-p.chargingHandle*"+travelMetres+":v)})),'LINEAR'));"+
 "tracks.push(scaleTrack('Cue_Joint_Magazine',samples.map(({time,p})=>({time,scale:[1,1,1].map(()=>p.magCue>.5?1:.001)})),'LINEAR'));return createClip(name,-1,tracks,{loop:clip.loop});");
assembly+=`\nasync function buildGun(){${gunSource}\nreturn build();}\nasync function build(){const root=createRoot('CarbineHandsFittingOnly'),vm=new THREE.Group();vm.name='ViewModel';root.add(vm);const hands=await buildHands(),gun=await buildGun();
 const cue=gun.getObjectByName('Joint_Magazine').clone(true);cue.traverse(o=>{o.name='Cue_'+o.name;});cue.position.fromArray(motion.magazineCue.leftWristRelativeCenter);cue.rotation.set(...motion.magazineCue.leftWristRelativeRotation,'XYZ');cue.scale.setScalar(.001);
 hands.getObjectByName('Joint_left_left_wrist').add(cue);vm.add(hands,gun);return root;}\n`;

// ---- write ----------------------------------------------------------------------------------------------------------
const rigOut={...rig,derivation:{from:'game/bolt-no4-arm-rig-v2.json (41 bones, joint names, arm lengths and poseFields kept)',hands:'authoring/carbine-m4-hands-v1.glb',design:'pipeline/carbine-hand-author.mjs (pipeline/carbine-hand-design.mjs)',measurement:'pipeline/measure-carbine-grip.mjs',
 reason:'Hands refitted to the Colt M4 v3 ('+M4.revisionId+'): right hand on the pistol grip, left hand round the handguard. Each forearm runs along its hand axis (wrist to the knuckle midpoint), so both wrists are straight at Ready. The left shoulder is placed so the elbow sits one upper arm from it (support grip v13 method); the right shoulder sits off-screen back, below and out from a '+choices.shoulders.rightElbowInteriorDeg+' degree elbow, as the pistol rig v6. The hands revision is rebuilt from this exact rig, so use the two together.',
 rightElbow:r5(rightArm.elbow),leftElbow:r5(leftArm.elbow),restHandRotations:'Euler XYZ of each glove frame (x hand axis, y thumb side, z dorsal for the right, palmar for the left) in gun axes; used to author the bind pose. Runtime IK keeps the clip wrist orientation.',shoulderStatus:'Target view-model placement, not measured anatomy'}};
const summary={gun:{assetId:M4.assetId,revisionId:M4.revisionId,sha256:gun.sha256},grip:{axisSlopeDeg:+grip.axisSlopeDeg.toFixed(2)},dropAxis,floor:{centre:r5(floor.centre),normal:r5(floor.normal)},
 chargingHandle:{contactMM:chargingTravel.contactMM,travelMetres,overlapAtTravelMM:travelRow.overlapMM,at70mm:chargingTravel.rows.find(r=>r.mm===70)},button:{centre:r5(button.centre)},latch:r5(latch.centre),
 right:{palmGapMM:+R.palm.gapMM.toFixed(2),index:{padGapMM:+R.index.padGapMM.toFixed(2),pipDeg:+R.index.flexDeg.pipDeg.toFixed(1),dipDeg:+R.index.flexDeg.dipDeg.toFixed(1),minGapMM:+R.index.minGapMM.toFixed(2)},fingers:R.fingers.map(f=>({finger:f.finger,pad:+f.padGapMM.toFixed(2),side:f.padSide,minGap:+f.minGapMM.toFixed(2)})),thumb:{pad:+R.thumb.padGapMM.toFixed(2),side:R.thumb.padSide,minGap:+R.thumb.minGapMM.toFixed(2)},penetration:R.penetration},
 left:{palmGapMM:+L.palm.gapMM.toFixed(2),fingers:L.fingers.map(f=>({finger:f.finger,pad:+f.padGapMM.toFixed(2),side:f.padSide,minGap:+f.minGapMM.toFixed(2)})),thumb:{pad:+L.thumb.padGapMM.toFixed(2),side:L.thumb.padSide,minGap:+L.thumb.minGapMM.toFixed(2)},penetration:L.penetration},
 rig:{right:rig.arms.right,left:rig.arms.left,rightElbow:r5(rightArm.elbow),leftElbow:r5(leftArm.elbow)},cells:{right:grips.right.cells,left:grips.left.cells},
 cue:{center:cueCenter,rotation:cueRotation},seat:r5(['handX','handY','handZ','handPitch','handYaw','handRoll','open','thumb'].map(k=>seat[k])),release:r5(['rightHandX','rightHandY','rightHandZ'].map(k=>release[k])),
 pinchRest:r5(['handX','handY','handZ','handPitch','handYaw','handRoll'].map(k=>pinchRest[k])),checks,failures};
console.log(JSON.stringify(summary,null,1));
if(failures.length&&!flag('--draft'))throw Error('Authoring checks failed:\n - '+failures.join('\n - '));
const outputs={'game/carbine-m4-motion-v1.json':JSON.stringify(motion,null,2)+'\n','game/carbine-m4-arm-rig-v1.json':JSON.stringify(rigOut,null,2)+'\n','authoring/carbine-m4-hands-v1.kiln.js':hands,'authoring/carbine-m4-hands-v1-assembly.kiln.js':assembly,
 'authoring/carbine-m4-hands-v1-design.json':JSON.stringify({summary,choices,specs:{seat:seatSpec,release:releaseSpec,pinch:pinchSpec,present},fingerFlex,chargingTravel},null,1)+'\n'};
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
for(const [rel,body]of Object.entries(outputs)){const p=resolve(outRoot,rel);if(await exists(p)&&!flag('--replace-own'))throw Error('Refusing to replace existing '+p);await mkdir(dirname(p),{recursive:true});await writeFile(p,body);}
console.log('written to',outRoot);
