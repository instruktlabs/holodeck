// Author-side posing of the carbine hands (pipeline/carbine-hand-author.mjs): finger centrelines, palm samples and
// sleeve tubes in the gun frame for a set of channel values, replicating the hands program's bones. Each finger's three
// bones turn about one flexion axis (gun-frame at bind, which is bone-local at rest because every bone binds with an
// identity rotation); the wrist follows the clip channels (world rotation = Euler XYZ of the hand channels, position =
// rig wrist + channel delta, as the browser adapter keeps it). Centreline evidence for authoring; the saved GLB is
// measured separately by pipeline/measure-carbine-grip.mjs.
import * as THREE from '../../../holodeck/node_modules/three/build/three.module.js';
import {anatomy,catmull,tubeRadius,vec,rotateAbout} from './carbine-hand-design.mjs';
import {atnToGun} from './support-grip-v13-design.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';
import {fastSigned,insideTester,nearest} from './carbine-hand-geometry.mjs';
const {add,sub,mul,len}=vec,deg=Math.PI/180;
export const JOINTS=[0,.43,.74];
export const quat=e=>new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0],e[1],e[2],'XYZ'));
export const qrot=(q,v)=>new THREE.Vector3(...v).applyQuaternion(q).toArray();
export const eulerOf=q=>{const e=new THREE.Euler().setFromQuaternion(q,'XYZ');return [e.x,e.y,e.z];};
export const angleBetween=(q1,q2)=>{const d=Math.abs(q1.dot(q2));return 2*Math.acos(Math.min(1,d))/deg;};

// Degrees per segment (base, mid, tip) for one finger (0-3) or the thumb (4) at channel values p.
export function fingerAngles(t,side,f,p){
 if(side==='left'){if(f<4){const c=-p.open;return [0,1,2].map(s=>c>=0?c*t.leftClose[f][s]:c*t.leftOpen[s]);}return [0,1,2].map(s=>p.thumb>=0?p.thumb*t.leftThumb[s]:p.thumb*t.leftThumbOut[s]);}
 if(f===0)return [0,1,2].map(s=>p.rightIndex>=0?p.rightIndex*t.rightPress[s]:p.rightIndex*t.rightExtend[s]);
 if(f<4){const c=-p.rightOpen;return [0,1,2].map(s=>c>=0?c*t.rightClose[s]:c*t.rightOpen[s]);}
 return [0,1,2].map(s=>p.rightThumb>=0?p.rightThumb*t.rightThumb[s]:p.rightThumb*t.rightThumbOut[s]);}

export function makePoser({rig,grips,fingerFlex}){
 const delta=(side,p)=>side==='left'?[p.handX,p.handY,p.handZ]:[p.rightHandX,p.rightHandY,p.rightHandZ];
 const euler=(side,p)=>side==='left'?[p.handPitch,p.handYaw,p.handRoll]:[p.rightHandPitch,p.rightHandYaw,p.rightHandRoll];
 const wristPose=(side,p)=>({W:add(rig.arms[side].wrist,delta(side,p)),Q:quat(euler(side,p))});
 const place=(side,p)=>{const {W,Q}=wristPose(side,p),W0=rig.arms[side].wrist;return q=>add(W,qrot(Q,sub(q,W0)));};
 // Centreline samples {t, p, r} of finger f (0-3) or the thumb (4). Rotating a distal point about each joint in turn
 // (tip, mid, then base) equals the bone chain because a finger's three joints share one axis.
 function finger(side,f,p,samples=48){const g=grips[side],pts=f===4?g.thumb:g.fingers[f],c=catmull(pts),w=g.axes[f],ang=fingerAngles(fingerFlex,side,f,p).map(a=>a*deg),J=JOINTS.map(t=>c(t)),to=place(side,p),R=f===4?anatomy.thumbR:g.fingerRadii[f],out=[];
  for(let i=0;i<=samples;i++){const t=i/samples;let q=c(t);for(let k=2;k>=0;k--)if(t>=JOINTS[k]&&ang[k])q=rotateAbout(q,J[k],w,ang[k]);out.push({t,p:to(q),r:tubeRadius(R,t)});}
  return out;}
 // Palm and thenar ellipsoid samples (palmar half of the palm, all of the thenar), as the design measures them.
 function palm(side,p,res=12){const F=grips[side].handFrame,W0=rig.arms[side].wrist,to=place(side,p),A=anatomy,out=[];
  for(let i=0;i<=res;i++)for(let j=0;j<2*res;j++){const th=Math.PI*i/res,ph=Math.PI*j/res,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];
   const h=d.map((v,k)=>A.palm[k]+v*A.palmR[k]);if(h[2]>=A.palm[2])out.push({part:'palm',p:to(atnToGun(W0,F,h))});out.push({part:'thenar',p:to(atnToGun(W0,F,d.map((v,k)=>A.thenar[k]+v*A.thenarR[k])))});}
  return out;}
 // The arm from the live IK: shoulder, elbow, wrist; the sleeve is a tube that tapers from 42 mm at the elbow to 20 mm
 // at the wrist (the program's sleeve radii), sampled along the forearm.
 function arm(side,p){const a=rig.arms[side],target=add(a.wrist,delta(side,p)),ik=solveArmIK(a.shoulder,target,a.pole,a.upperLength,a.forearmLength);
  const fore=[];for(let i=0;i<=20;i++){const t=i/20;fore.push({t,p:add(ik.elbow,mul(sub(ik.wrist,ik.elbow),t)),r:.042+(.020-.042)*t});}
  const upper=[];for(let i=0;i<=20;i++){const t=i/20;upper.push({t,p:add(a.shoulder,mul(sub(ik.elbow,a.shoulder),t)),r:.052+(.042-.052)*t});}
  return {...ik,fore,upper,reachMargin:a.upperLength+a.forearmLength-len(sub(target,a.shoulder))};}
 // Deepest penetration of the posed hand (tubes on the centreline, palm samples inside) into the given surfaces.
 function penetration(side,p,surfs,{sleeve=true}={}){let worst={mm:0,part:null,mesh:null};const note=(mm,part,mesh)=>{if(mm>worst.mm)worst={mm,part,mesh};};
  const near=(q,s,m)=>q[0]>s.min[0]-m&&q[0]<s.max[0]+m&&q[1]>s.min[1]-m&&q[1]<s.max[1]+m&&q[2]>s.min[2]-m&&q[2]<s.max[2]+m;
  for(let f=0;f<5;f++)for(const c of finger(side,f,p,32))for(const s of surfs){if(!near(c.p,s,c.r))continue;const d=fastSigned(c.p,s),depth=c.r-d.gap;if(depth>0)note(depth*1000,(f===4?'thumb':'finger'+f),s.name);}
  for(const q of palm(side,p,8))for(const s of surfs){if(!near(q.p,s,0))continue;if(insideTester(s)(q.p))note(nearest(q.p,s).d*1000,q.part,s.name);}
  if(sleeve){const A=arm(side,p);for(const c of A.fore.slice(0,-3))for(const s of surfs){if(!near(c.p,s,c.r))continue;const d=fastSigned(c.p,s),depth=c.r*.7-d.gap;if(depth>0)note(depth*1000,'forearm',s.name);}}
  return worst;}
 return {wristPose,place,finger,palm,arm,penetration,fingerAngles:(side,f,p)=>fingerAngles(fingerFlex,side,f,p)};}
