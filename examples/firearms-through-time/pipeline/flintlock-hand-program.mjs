// Pattern 1742 musket (round v14): text of the hands program and of its fitting-only review assembly.
// The hands program follows the 1866 hands v2 program (next-firearm-v1 asset a_e22b20538f204e1ca7a86886cf630a89,
// revision r_7269e881c7664cb68deb34bbd441f7f8): the same 41-bone rig naming, IK bake, twist bones, glove material,
// implicit glove surfaces and sleeves. Differences: the gloves are the Pattern 1742 designs (built in a hand-local frame
// from the gun-frame design and placed back by one matrix, so every bone keeps an identity bind rotation); fingers use
// the shared per-bone pose function (pipeline/flintlock-hand-pose.mjs); each clip also bakes the shoulder shift as a
// translation track on the shoulder bones.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as D from './flintlock-hand-design.mjs';
import * as P from './flintlock-hand-pose.mjs';
const {add,sub,mul,dot,len,unit}=D;
export const HANDS_1866='assets/next-firearm-v1/a_e22b20538f204e1ca7a86886cf630a89/revisions/r_7269e881c7664cb68deb34bbd441f7f8/source.kiln.js';
export const GUN_SOURCE='authoring/assets/kiln/a_0a31fd5eeb864b529202724a65de4623/revisions/r_f052d566fab74b82b005050758dd180a/source.kiln.js';
export const CART_SOURCE='authoring/assets/kiln/a_2741cba5bb43444aa2159f8be8738d0c/revisions/r_df84200b038e429db40500966fd0faab/source.kiln.js';
const r6=v=>Array.isArray(v)?v.map(r6):Math.round(v*1e6)/1e6;

// Hand data for the program: gun-frame wrist, frame and digits; hand-local bounds for the implicit surface.
export function handData(design,rig){const A=D.anatomy,out={anatomy:{palm:A.palm,palmR:A.palmR,thenar:A.thenar,thenarR:A.thenarR,wristBack:A.wristBack,wristEnd:A.wristEnd,wristR:A.wristR,wristDepth:A.wristDepth}};
 for(const side of ['right','left']){const d=design[side],F=d.frame,s=side==='right'?-1:1,ty=mul(F.t,s),W=d.wrist,toLocal=p=>{const q=sub(p,W);return [dot(q,F.a),dot(q,ty),dot(q,F.n)];},atn=q=>[q[0],s*q[1],q[2]];
  const spec=rig.arms[side],rest=D.solveArmIK(spec.shoulder,spec.wrist,spec.pole,spec.upperLength,spec.forearmLength),back=toLocal(add(W,mul(unit(sub(W,rest.elbow)),-A.wristBack)));
  const lo=[1,1,1],hi=[-1,-1,-1],grow=(p,m)=>{for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]-m);hi[k]=Math.max(hi[k],p[k]+m);}};
  for(const g of d.digits)for(let i=0;i<=40;i++){const t=i/40;grow(toLocal(D.catmull(g.points)(t)),D.tubeRadius(g.radius,t)+.004);}
  for(const [c,rr]of [[atn(A.palm),A.palmR],[atn(A.thenar),A.thenarR]])for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])grow([c[0]+sx*rr[0],c[1]+sy*rr[1],c[2]+sz*rr[2]],.004);
  grow(back,.026);grow(atn(A.wristEnd),.026);
  out[side]={wrist:W,frame:{a:F.a,t:F.t,n:F.n},digits:d.digits.map(g=>({points:g.points,radius:g.radius,J:g.J})),bounds:{min:r6(lo),max:r6(hi)}};}
 return out;}

export async function handsProgram({motion,rig,design,name}){const base=(await readFile(HANDS_1866,'utf8')).replace(/^﻿/,'');
 const cut=(a,b)=>{const i=base.indexOf(a),j=base.indexOf(b,i);assert(i>=0&&j>i,'1866 anchor '+a);return base.slice(i,j);};
 const sampler=cut('function sampleTimeline','\n'),ikText=cut('// Extract only axial rotation','\nfunction animate'),matLine=cut(' const mat=await compilePortableMaterialSpecV2',"\n const clamp=");
 const hands=handData(design,rig),tables=design.poseTables;
 return `const motion=${JSON.stringify(motion)};
${sampler}
function sampleShift(keys,t){t=Math.max(0,Math.min(1,t));let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;const a=keys[i],b=keys[i+1],x=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),u=x*x*x*(x*(x*6-15)+10);return a.v.map((v,j)=>v+(b.v[j]-v)*u);}

const rig=${JSON.stringify(rig)};
${ikText}
// Finger articulation, shared with pipeline/flintlock-hand-pose.mjs: per-bone quaternions from the pose tables.
${P.quatSource}
${P.fingerPoseSource}
const poseTables=${JSON.stringify(tables)};

// Clips: the hosts' sampler at motion.sampleRate; the arm IK as the browser adapter solves it (rig shoulder, wrist goal
// = rig wrist + hand channels, rig pole), twist bones, finger bones, and the shoulder shift as a shoulder-bone translation.
function animate(root){const bones=[];root.traverse(n=>{if(n.isBone)bones.push(n);});const deg=q=>{const e=new THREE.Euler().setFromQuaternion(q,'XYZ');return [e.x,e.y,e.z].map(x=>x*180/Math.PI);};
 return Object.entries(motion.clips).map(([name,clip])=>{const tracks=[],count=Math.ceil(clip.duration*motion.sampleRate),shiftKeys=motion.shoulderShift.clips[name].keys,samples=Array.from({length:count+1},(_,i)=>{const p=sampleTimeline(motion,name,i/count),sh=sampleShift(shiftKeys,i/count),arms={};
  for(const [side,spec]of Object.entries(rig.arms)){const rest=solveArmIK(spec.shoulder,spec.wrist,spec.pole,spec.upperLength,spec.forearmLength),target=spec.wrist.map((v,j)=>v+(side==='left'?[p.handX,p.handY,p.handZ]:[p.rightHandX,p.rightHandY,p.rightHandZ])[j]),pose=solveArmIK(spec.shoulder,target,spec.pole,spec.upperLength,spec.forearmLength),vec=(a,b)=>new THREE.Vector3(...a).sub(new THREE.Vector3(...b)).normalize(),sq=new THREE.Quaternion().setFromUnitVectors(vec(rest.elbow,spec.shoulder),vec(pose.elbow,spec.shoulder)),eq=new THREE.Quaternion().setFromUnitVectors(vec(spec.wrist,rest.elbow),vec(pose.wrist,pose.elbow)),wq=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(side==='left'?[p.handPitch,p.handYaw,p.handRoll]:[p.rightHandPitch,p.rightHandYaw,p.rightHandRoll])));const wr=eq.clone().invert().multiply(wq),axis=vec(spec.wrist,rest.elbow),angle=twistAngle(wr.toArray(),axis.toArray());
   arms[side]={shoulder:sq,elbow:sq.clone().invert().multiply(eq),wrist:wr,twist:rig.twistFractions.map(f=>new THREE.Quaternion().setFromAxisAngle(axis,angle*f)),shift:side==='right'?sh.slice(0,3):sh.slice(3,6)};}
  const fingers={right:fingerPose(poseTables.right,'right',p),left:fingerPose(poseTables.left,'left',p)};return {time:i/count*clip.duration,p,arms,fingers};});
 for(const bone of bones){const n=bone.name,m=n.match(/^Joint_(left|right)Finger(\\d)_.*_(base|mid|tip)$/),rotation=samples.map(({time,arms,fingers})=>{let quat=null;for(const side of ['right','left']){if(n==='Joint_'+side+'Arm_'+side+'_shoulder')quat=arms[side].shoulder;if(n==='Joint_'+side+'Arm_'+side+'_elbow')quat=arms[side].elbow;if(n==='Joint_'+side+'_'+side+'_wrist')quat=arms[side].wrist;for(let t=0;t<rig.twistFractions.length;t++)if(n==='Joint_'+side+'Twist'+t+'_'+side+'_forearm_twist'+t)quat=arms[side].twist[t];}
   if(m)quat=new THREE.Quaternion(...fingers[m[1]][Number(m[2])][['base','mid','tip'].indexOf(m[3])]);return {time,rotation:quat?deg(quat):[0,0,0]};});tracks.push(rotationTrack(n,rotation,'LINEAR'));
  const s=n.match(/^Joint_(left|right)Arm_(?:left|right)_shoulder$/);if(s){const spec=rig.arms[s[1]];tracks.push(positionTrack(n,samples.map(({time,arms})=>({time,position:spec.shoulder.map((v,j)=>v+arms[s[1]].shift[j])})),'LINEAR'));}}
 return createClip(name,-1,tracks,{loop:clip.loop});});}

const meta={name:${JSON.stringify(name??'Pattern 1742 gloves - stock wrist, fore-end and loading drill v1')},role:'character'};
// Pattern 1742 grips, designed in the gun frame against the v3 musket by pipeline/flintlock-hand-author.mjs
// (pipeline/flintlock-hand-design.mjs): right palm on the stock wrist, fingers wrapped under it, thumb over the top,
// index pad before the trigger; left palm under the fore-end, fingers round the far side, thumb along the near side.
// Each glove is evaluated in its hand-local frame (x hand axis, y little-finger side for the right and thumb side for
// the left, z palmar) and placed back by one matrix, so bones keep identity bind rotations.
const hands=${JSON.stringify(hands)};
async function build(){
 const root=createRoot('CollectionHands01'),common=createBoneChain('Hands',[{role:'hands.root',offset:[0,0,0]}],{parent:root}),bones=[...common.nodes],gloves=[],sleeves=[];
${matLine}
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],unit=a=>mul(a,1/Math.hypot(...a));
 const capsule=(p,a,b,ra,rb)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],qx=p[0]-a[0],qy=p[1]-a[1],qz=p[2]-a[2],t=clamp((qx*dx+qy*dy+qz*dz)/(dx*dx+dy*dy+dz*dz)),x=qx-dx*t,y=qy-dy*t,z=qz-dz*t;return {field:ra+(rb-ra)*t-Math.sqrt(x*x+y*y+z*z),t};};
 const ellipsoid=(p,c,r)=>{const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];return (1-Math.sqrt(x*x+y*y+z*z))*Math.min(r[0],r[1],r[2]);};
 const A=hands.anatomy;
 for(const side of [1,-1]){
  const right=side===1,name=right?'right':'left',spec=rig.arms[name],h=hands[name],rest=solveArmIK(spec.shoulder,spec.wrist,spec.pole,spec.upperLength,spec.forearmLength);
  const s=right?-1:1,F=h.frame,ty=mul(F.t,s),toLocal=p=>{const q=sub(p,h.wrist);return [dot(q,F.a),dot(q,ty),dot(q,F.n)];},atn=q=>[q[0],s*q[1],q[2]];
  const handMatrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...F.a),new THREE.Vector3(...ty),new THREE.Vector3(...F.n)).setPosition(...h.wrist);
  const chain=createBoneChain(name+'Arm',[{role:name+'.shoulder',offset:spec.shoulder},{role:name+'.elbow',offset:sub(rest.elbow,spec.shoulder)}],{parent:common.root}),si=bones.length;bones.push(...chain.nodes);
  const hand=createBoneChain(name,[{role:name+'.wrist',offset:sub(spec.wrist,rest.elbow)}],{parent:chain.end}),wi=bones.length;bones.push(...hand.nodes);
  const ti=bones.length,twists=rig.twistFractions.map((f,i)=>createBoneChain(name+'Twist'+i,[{role:name+'.forearm.twist'+i,offset:sub(spec.wrist,rest.elbow).map(v=>v*f)}],{parent:chain.end}).root);bones.push(...twists);
  const fingers=[];
  for(let finger=0;finger<5;finger++){const g=h.digits[finger],J=g.J,bi=bones.length,fc=createBoneChain(name+'Finger'+finger,[{role:name+'.finger'+finger+'.base',offset:sub(J[0],spec.wrist)},{role:name+'.finger'+finger+'.mid',offset:sub(J[1],J[0])},{role:name+'.finger'+finger+'.tip',offset:sub(J[2],J[1])}],{parent:hand.root});bones.push(...fc.nodes);
   const curve=new THREE.CatmullRomCurve3(g.points.map(p=>new THREE.Vector3(...toLocal(p)))),radius=g.radius,rad=t=>radius*(1-.25*t+.07*Math.sin(Math.PI*t)),segments=Array.from({length:12},(_,i)=>{const t=i/12,u=(i+1)/12;return {a:curve.getPoint(t).toArray(),b:curve.getPoint(u).toArray(),ra:rad(t),rb:rad(u),start:t,end:u};});
   fingers.push({bi,segments,base:toLocal(g.points[0]),radius});}
  // Palm and thenar pads, the oval wrist (a continuation of the forearm) and knuckle pads joining the palm to each finger.
  const palm=atn(A.palm),thenar=atn(A.thenar),back=toLocal(add(spec.wrist,mul(unit(sub(spec.wrist,rest.elbow)),-A.wristBack))),wend=atn(A.wristEnd),dz=A.wristDepth;
  function wristField(p){return capsule([p[0],p[1],p[2]/dz],[back[0],back[1],back[2]/dz],[wend[0],wend[1],wend[2]/dz],A.wristR[0],A.wristR[1]).field*dz;}
  function body(p){let d=ellipsoid(p,palm,A.palmR);d=smoothUnion(d,ellipsoid(p,thenar,A.thenarR),.008);d=smoothUnion(d,wristField(p),.006);for(let f=0;f<4;f++){const b=fingers[f].base;d=smoothUnion(d,capsule(p,[palm[0],b[1],b[2]*.5],b,.0085,fingers[f].radius).field,.005);}return d;}
  function fingerAt(p,f){let best={field:-1,t:0};for(const seg of f.segments){const v=capsule(p,seg.a,seg.b,seg.ra,seg.rb);if(v.field>best.field)best={field:v.field,t:seg.start+(seg.end-seg.start)*v.t};}return best;}
  function sample(p){let d=body(p);for(const f of fingers)d=smoothUnion(d,fingerAt(p,f).field,.0026);return d;}
  const geo=await implicitSurface(sample,{bounds:h.bounds,edgeLength:.00265,maxCells:1000000,maxEvaluations:8000000,smooth:true});
  const g=geo.index?geo.toNonIndexed():geo,pos=g.attributes.position,uv=[],indices=[],weights=[];
  for(let tri=0;tri<pos.count;tri+=3){const us=[0,1,2].map(k=>Math.atan2(pos.getZ(tri+k)-palm[2],pos.getY(tri+k)-palm[1])/(2*Math.PI)+.5);if(Math.max(...us)-Math.min(...us)>.5)for(let k=0;k<3;k++)if(us[k]<.5)us[k]+=1;
   for(let k=0;k<3;k++){const i=tri+k,p=[pos.getX(i),pos.getY(i),pos.getZ(i)];uv.push(us[k],p[0]/.16);
    let best={field:-1,t:0,bi:wi};for(const f of fingers){const q=fingerAt(p,f);if(q.field>best.field)best={...q,bi:f.bi};}const affinity=ease((best.field-body(p)+.003)/.006),t=best.t;let a,b,w;if(t<.6){a=best.bi;b=a+1;w=ease((t-.35)/.16);}else{a=best.bi+1;b=a+1;w=ease((t-.66)/.16);}indices.push(wi,a,b,0);weights.push(1-affinity,affinity*(1-w),affinity*w,0);
   }
  }g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.applyMatrix4(handMatrix);gloves.push({g,indices,weights});
  // One sleeve surface follows the upper arm and forearm, with joint-local weights.
  const curve=new THREE.CatmullRomCurve3([spec.shoulder,rest.elbow,spec.wrist].map(p=>new THREE.Vector3(...p))),pp=[],uu=[],ii=[],ww=[],face=[],rings=48,sides=20,axis=new THREE.Vector3(0,0,1);
  for(let i=0;i<=rings;i++){const t=i/rings,p=curve.getPoint(t),d=curve.getTangent(t).normalize(),n=axis.clone().addScaledVector(d,-axis.dot(d)).normalize(),bin=new THREE.Vector3().crossVectors(d,n).normalize(),radius=t<.5?.052+(.042-.052)*t*2:.042+(.020-.042)*(t-.5)*2,oval=1-.30*ease((t-.72)/.28);let a,b,w;if(t<.5){a=si;b=si+1;w=ease((t-.38)/.12);}else{const f=(t-.5)*2,stops=[0,...rig.twistFractions,1],ids=[si+1,ti,ti+1,wi];let k=0;while(k<2&&f>stops[k+1])k++;a=ids[k];b=ids[k+1];w=ease((f-stops[k])/(stops[k+1]-stops[k]));}for(let j=0;j<=sides;j++){const angle=2*Math.PI*j/sides,v=p.clone().addScaledVector(n,Math.cos(angle)*radius*oval).addScaledVector(bin,Math.sin(angle)*radius);pp.push(...v.toArray());uu.push(j/sides,t*(spec.upperLength+spec.forearmLength)/.16);ii.push(a,b,0,0);ww.push(1-w,w,0,0);if(i<rings&&j<sides){const v=i*(sides+1)+j;face.push(v,v+1,v+sides+1,v+1,v+sides+2,v+sides+1);}}}
  for(const end of [0,1]){const v=pp.length/3,p=curve.getPoint(end);pp.push(...p.toArray());uu.push(.25,.75);ii.push(end?wi:si,0,0,0);ww.push(1,0,0,0);const base=end*rings*(sides+1);for(let j=0;j<sides;j++)face.push(v,base+j+(end?0:1),base+j+(end?1:0));}
  const sleeve=new THREE.BufferGeometry();sleeve.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));sleeve.setAttribute('uv',new THREE.Float32BufferAttribute(uu,2));sleeve.setIndex(face);sleeve.computeVertexNormals();sleeves.push({g:sleeve,indices:ii,weights:ww});
 }
 function bind(name,parts){const pos=[],normal=[],uv=[],idx=[],weights=[],faces=[];let offset=0;for(const p of parts){for(const v of p.g.attributes.position.array)pos.push(v);for(const v of p.g.attributes.normal.array)normal.push(v);for(const v of p.g.attributes.uv.array)uv.push(v);for(const v of p.indices)idx.push(v);for(const v of p.weights)weights.push(v);if(p.g.index)for(const i of p.g.index.array)faces.push(i+offset);else for(let i=0;i<p.g.attributes.position.count;i++)faces.push(i+offset);offset+=p.g.attributes.position.count;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(faces);createSkinnedPart(name,geo,mat,{parent:root,bones,indices:idx,weights});}
 bind('Gloves',gloves);bind('Sleeves',sleeves);return root;
}
`;}

// Fitting-only review: the hands, the saved v3 musket (lock, frizzen and ramrod tracks), the rammer cue (a copy of the
// musket's Joint_Ramrod subtree) and the saved cartridge cue on the right wrist, all under a camera-space WeaponRoot
// posed from the root channels as weapon-extension.jsx poses the weapon (position hip + [side, lift, -forward]; rotation
// Euler XYZ (pitch, yaw, roll) x RotY(+90 deg)). The camera of the first-person review shots sits at the origin.
export async function assemblyProgram({hands,motion,hip}){const gun=(await readFile(GUN_SOURCE,'utf8')).replace(/^﻿/,''),cart=(await readFile(CART_SOURCE,'utf8')).replace(/^﻿/,'');
 const swap=(s,a,b)=>{assert(s.includes(a),'anchor '+a.slice(0,60));return s.replace(a,b);};
 let code=swap(hands,'async function build(){','async function buildHands(){');
 code=swap(code,"const meta={name:\"Pattern 1742 gloves - stock wrist, fore-end and loading drill v1\",role:'character'};","const meta={name:'Pattern 1742 hands v1 fitting evidence only',role:'character'};");
 const L=D.LOCK,rm=motion.ramrod;
 code=swap(code,'return createClip(name,-1,tracks,{loop:clip.loop});});}',`const hip=${JSON.stringify(hip)},cockDeg=c=>c<=.5?${L.down}+(${L.half}-${L.down})*c/.5:${L.half}+(${L.full}-${L.half})*(c-.5)/.5,rootQ=p=>new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch,p.yaw,p.roll,'XYZ')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2));
 tracks.push(positionTrack('WeaponRoot',samples.map(({time,p})=>({time,position:[hip[0]+p.side,hip[1]+p.lift,hip[2]-p.forward]})),'LINEAR'),rotationTrack('WeaponRoot',samples.map(({time,p})=>({time,rotation:deg(rootQ(p))})),'LINEAR'));
 tracks.push(rotationTrack('Joint_Cock',samples.map(({time,p})=>({time,rotation:[0,0,cockDeg(p.cock)]})),'LINEAR'),rotationTrack('Joint_Frizzen',samples.map(({time,p})=>({time,rotation:[0,0,${L.closed}+(${L.open}-${L.closed})*p.frizzen]})),'LINEAR'));
 tracks.push(positionTrack('Joint_Ramrod',samples.map(({time,p})=>({time,position:[${rm.origin[0]}+p.ramrod*${rm.drawMetres},${rm.origin[1]},${rm.origin[2]}]})),'LINEAR'),scaleTrack('Joint_Ramrod',samples.map(({time,p})=>({time,scale:[1,1,1].map(()=>p.ramrodCue>.5?.001:1)})),'LINEAR'));
 tracks.push(scaleTrack('Cue_Joint_Ramrod',samples.map(({time,p})=>({time,scale:[1,1,1].map(()=>p.ramrodCue>.5?1:.001)})),'LINEAR'),scaleTrack('CartridgeCue',samples.map(({time,p})=>({time,scale:[1,1,1].map(()=>p.cartridge>.5?1:.001)})),'LINEAR'));
 return createClip(name,-1,tracks,{loop:clip.loop});});}`);
 code+=`\nasync function buildGun(){${gun}\nreturn build();}\nasync function buildCartridge(){${cart}\nreturn build();}\nasync function build(){const root=createRoot('FlintlockHandsFittingOnly'),weapon=new THREE.Group();weapon.name='WeaponRoot';root.add(weapon);const hands=await buildHands(),gun=await buildGun(),cart=await buildCartridge();
 const cue=gun.getObjectByName('Joint_Ramrod').clone(true);cue.traverse(o=>{o.name='Cue_'+o.name;});cue.position.fromArray(motion.ramrodCue.rightWristRelativeCenter);cue.rotation.set(...motion.ramrodCue.rightWristRelativeRotation,'XYZ');cue.scale.setScalar(.001);
 cart.name='CartridgeCue';cart.position.fromArray(motion.cartridge.rightWristRelativeCenter);cart.rotation.set(...motion.cartridge.rightWristRelativeRotation,'XYZ');cart.scale.setScalar(.001);
 const wrist=hands.getObjectByName('Joint_right_right_wrist');wrist.add(cue);wrist.add(cart);weapon.add(hands,gun);return root;}\n`;
 return code;}
