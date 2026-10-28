// Pattern 1742 musket: clips, the condensed loading drill and its checks (round v14).
// Key poses are authored in camera space (the browser's: +X right, +Y up, -Z forward; camera at the origin) and
// converted to the fixed channel contract: root channels pose the weapon root as weapon-extension.jsx does
// (position = hip + [side, lift, -forward]; rotation = Euler XYZ(pitch, yaw, roll) * RotY(+90 deg)); hand channels are
// gun-frame wrist deltas and wrist rotations (Euler XYZ, relative to the bind).
// Shoulders: the rig shoulders sit in the gun-root frame, so turning the musket muzzle-up would carry them to the knees.
// Each key therefore also carries a virtual shoulder per arm (camera space), chosen so that the arm reaches without
// stretch and the forearm meets the hand with a small wrist bend; its gun-frame offset from the rig shoulder is the
// shoulder shift. The hands asset bakes it as a translation of the shoulder bones (the browser IK solves relative to the
// rig shoulder and the baked translation carries the solved arm with it); motion.shoulderShift lists it for hosts
// that solve against absolute goals (add it to the wrist effector and the pole).
import {readFile} from 'node:fs/promises';
import * as D from './flintlock-hand-design.mjs';
import * as P from './flintlock-hand-pose.mjs';
const {add,sub,mul,dot,cross,len,unit}=D,deg=Math.PI/180,M=P.matMul,T=P.matT,MV=P.matV;
export const CHANNELS=['lift','roll','yaw','pitch','forward','side','handX','handY','handZ','handPitch','handYaw','handRoll','open','thumb','rightIndex','rightHandX','rightHandY','rightHandZ','rightHandPitch','rightHandYaw','rightHandRoll','rightOpen','rightThumb','cock','frizzen','ramrod','ramrodCue','cartridge'];
export const SHIFT_FIELDS=['rightX','rightY','rightZ','leftX','leftY','leftZ'];
export const R0=[[0,0,1],[0,1,0],[-1,0,0]],I3=[[1,0,0],[0,1,0],[0,0,1]];
export const rootR=e=>M(P.eulerToMat(e),R0);
export const camOf=(pose,g)=>add(pose.pos,MV(pose.R,g)),gunOf=(pose,c)=>MV(T(pose.R),sub(c,pose.pos));
export const rotM=(axis,a)=>P.quatToMat(P.qAxis(unit(axis),a));
// Frame with columns X, Y (hint orthogonalised), Z = X x Y.
export const frameXY=(X,Yh)=>{const x=unit(X),y=unit(sub(Yh,mul(x,dot(Yh,x))));return P.basis(x,y,cross(x,y));};
export const frameXZ=(X,Zh)=>{const x=unit(X),z=unit(sub(Zh,mul(x,dot(Zh,x))));return P.basis(x,cross(z,x),z);};
export const col=(R,j)=>[R[0][j],R[1][j],R[2][j]];
export const angDeg=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))/deg;
export const rotDeg=(A,B)=>{const m=M(T(A),B);return Math.acos(Math.max(-1,Math.min(1,(m[0][0]+m[1][1]+m[2][2]-1)/2)))/deg;};
const r6=v=>Array.isArray(v)?v.map(r6):Math.round(v*1e6)/1e6;
// Smootherstep sampler shared with the hands program and the hosts (game/animation-sampler.mjs semantics).
export function sampleKeys(keys,fields,t){t=Math.max(0,Math.min(1,t));let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;const a=keys[i],b=keys[i+1],x=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),u=x*x*x*(x*(x*6-15)+10),o={};fields.forEach((c,j)=>o[c]=a.v[j]+(b.v[j]-a.v[j])*u);o.phase=t===1?'ready':b.phase;return o;}
// Euler XYZ nearest to the previous key's (both branches, 2 pi unwrapping), so channel interpolation takes the short way.
export function eulerNear(m,prev){const e=P.matToEuler(m),alt=[e[0]+Math.PI,Math.PI-e[1],e[2]+Math.PI];const fix=a=>a.map((v,i)=>{if(!prev)return v;let x=v;while(x-prev[i]>Math.PI)x-=2*Math.PI;while(x-prev[i]<-Math.PI)x+=2*Math.PI;return x;});
 if(!prev)return e;const c=[fix(e),fix(alt)],d=c.map(x=>x.reduce((s,v,i)=>s+(v-prev[i])**2,0));return d[0]<=d[1]?c[0]:c[1];}
export const qFromTo=(a,b)=>{a=unit(a);b=unit(b);const r=dot(a,b)+1;let q;if(r<1e-6)q=Math.abs(a[0])>Math.abs(a[2])?[-a[1],a[0],0,0]:[0,-a[2],a[1],0];else{const c=cross(a,b);q=[c[0],c[1],c[2],r];}const l=Math.hypot(...q);return q.map(v=>v/l);};
export function twistAngle(q,axis){const pr=q[0]*axis[0]+q[1]*axis[1]+q[2]*axis[2],l=Math.hypot(pr,q[3]);if(l<1e-8)return 0;let a=2*Math.atan2(pr/l,q[3]/l);if(a>Math.PI)a-=2*Math.PI;if(a<-Math.PI)a+=2*Math.PI;return a;}
// Nelder-Mead (small dimension).
export function nelderMead(f,x0,step=.02,iters=400){const n=x0.length;let s=[x0,...x0.map((_,i)=>x0.map((v,j)=>v+(i===j?step:0)))].map(x=>({x,f:f(x)}));
 for(let k=0;k<iters;k++){s.sort((a,b)=>a.f-b.f);const c=s.slice(0,n).reduce((a,p)=>a.map((v,i)=>v+p.x[i]/n),Array(n).fill(0)),w=s[n],pt=t=>c.map((v,i)=>v+t*(w.x[i]-v)),r={x:pt(-1)};r.f=f(r.x);
  if(r.f<s[0].f){const e={x:pt(-2)};e.f=f(e.x);s[n]=e.f<r.f?e:r;}else if(r.f<s[n-1].f)s[n]=r;else{const ct={x:pt(.5)};ct.f=f(ct.x);if(ct.f<w.f)s[n]=ct;else s=s.map((p,i)=>i===0?p:{x:p.x.map((v,j)=>s[0].x[j]+(v-s[0].x[j])*.5),f:NaN}).map(p=>Number.isNaN(p.f)?{x:p.x,f:f(p.x)}:p);}
  if(Math.abs(s[n].f-s[0].f)<1e-10&&k>40)break;}s.sort((a,b)=>a.f-b.f);return s[0];}

// ---- context ---------------------------------------------------------------------------------------------------
export async function loadContext(designPath='authoring/flintlock-1742-hands-v1-design.json'){
 const design=JSON.parse(await readFile(designPath,'utf8')),S=await D.musket({cock:1,frizzen:0});
 const hand=rec=>({Wb:rec.wrist,F:rec.frame,digits:rec.digits.map(g=>({...g,curve:D.catmull(g.points)}))});
 const H={right:hand(design.right),left:hand(design.left)},tables={right:design.poseTables.right,left:design.poseTables.left};
 const rig={arms:{right:{...design.arms.right},left:{...design.arms.left}}};
 for(const side of ['right','left']){const a=rig.arms[side];a.rest=D.solveArmIK(a.shoulder,a.wrist,a.pole,a.upperLength,a.forearmLength);a.lowerRest=unit(sub(a.wrist,a.rest.elbow));a.Prel=sub(a.pole,a.shoulder);}
 return {design,S,H,tables,rig,stateCache:new Map()};}
export const fingerQ=(ctx,side,ch)=>P.fingerPose(ctx.tables[side],side,side==='right'?{rightOpen:ch.rightOpen??0,rightIndex:ch.rightIndex??0,rightThumb:ch.rightThumb??0}:{open:ch.open??0,thumb:ch.thumb??0});
export const digitPt=(h,q,f,t)=>{const g=h.digits[f];return P.posedPoint(g.J,q[f],g.curve(t),t);};
export const place=(h,W,Q,p)=>add(W,MV(Q,sub(p,h.Wb)));
// Hand sample points (bind frame, wrist at the bind): palm + thenar ellipsoid shells and every digit tube.
export function handSamples(ctx,side,q){const h=ctx.H[side],A=D.anatomy,F=h.F,pts=[];
 for(let i=1;i<=8;i++)for(let j=0;j<12;j++){const th=Math.PI*i/9,ph=2*Math.PI*j/12,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];
  pts.push({p:D.atn(h.Wb,F,d.map((v,k)=>A.palm[k]+v*A.palmR[k])),r:0,part:'palm'});if(j%2===0)pts.push({p:D.atn(h.Wb,F,d.map((v,k)=>A.thenar[k]+v*A.thenarR[k])),r:0,part:'thenar'});}
 for(let f=0;f<5;f++)for(let k=1;k<=12;k++){const t=k/12;pts.push({p:digitPt(h,q,f,t),r:D.tubeRadius(h.digits[f].radius,t),part:['index','middle','ring','little','thumb'][f]});}
 return pts;}

// ---- gun state surfaces ------------------------------------------------------------------------------------------
export async function stateSurfaces(ctx,cock,frizzen){const k=Math.round(cock*20)+'/'+Math.round(frizzen*20);if(!ctx.stateCache.has(k)){const s=await D.musket({cock:Math.round(cock*20)/20,frizzen:Math.round(frizzen*20)/20});
 ctx.stateCache.set(k,{cock:s.cock,frizzen:s.frizzen});}return ctx.stateCache.get(k);}
// Signed clearance of points (with radii) to the gun at a state (surfaces from stateSurfaces): body parts, trigger, cock,
// frizzen, and the ramrod at draw d (skipped when hidden). Returns the worst gap and where.
export function clearance(ctx,pts,surf,state,{skip=[]}={}){const S=ctx.S;
 const parts=[...S.penetration.filter(s=>!['TriggerBlade','Cock','Frizzen','Ramrod'].includes(s.name)&&!skip.includes(s.name)),S.trigger,surf.cock,surf.frizzen];
 let worst={gap:Infinity};const box=(p,s,m)=>p[0]>=s.min[0]-m&&p[0]<=s.max[0]+m&&p[1]>=s.min[1]-m&&p[1]<=s.max[1]+m&&p[2]>=s.min[2]-m&&p[2]<=s.max[2]+m;
 for(const q of pts){const m=q.r+.004;for(const s of parts){if(!box(q.p,s,m))continue;const d=D.signedM(q.p,s),g=d.gap-q.r;if(g<worst.gap)worst={gap:g,part:s.name,at:q.part,p:q.p};}
  if(state.ramrodVisible!==false&&!skip.includes('Ramrod')){const p=[q.p[0]-(state.draw??0),q.p[1],q.p[2]];if(box(p,S.ramrod,m)){const d=D.signedM(p,S.ramrod),g=d.gap-q.r;if(g<worst.gap)worst={gap:g,part:'Ramrod',at:q.part,p:q.p};}}}
 return worst;}
export async function gunClearance(ctx,pts,state,opts){return clearance(ctx,pts,await stateSurfaces(ctx,state.cock,state.frizzen),state,opts);}

// ---- arm IK, diagnostics and virtual-shoulder steering ------------------------------------------------------------
// Arm at a pose: virtual shoulder Sv (gun frame), wrist W, hand rotation Q (gun frame, relative to the bind).
export function armAt(ctx,side,Sv,W,Q){const spec=ctx.rig.arms[side],ik=D.solveArmIK(Sv,W,add(Sv,spec.Prel),spec.upperLength,spec.forearmLength),fore=sub(W,ik.elbow),a=MV(Q,ctx.H[side].F.a);
 const eq=qFromTo(spec.lowerRest,fore),wr=P.qMul(P.qConj(eq),P.matToQuat(Q)),twist=twistAngle(wr,spec.lowerRest)/deg;
 return {elbow:ik.elbow,reach:len(sub(W,Sv)),stretch:ik.error,bend:angDeg(fore,a),twist};}
const TAN_V=Math.tan(31.5*deg),TAN_H=Math.tan(31.5*deg)*16/9;
export const inView=(c,margin=0)=>-c[2]>.02&&Math.abs(c[0])-margin<TAN_H*-c[2]&&Math.abs(c[1])-margin<TAN_V*-c[2];
// Elbow bend direction in camera space (unit, perpendicular to the shoulder-wrist line).
export function bendDir(Sc,Ec,Wc){const d=unit(sub(Wc,Sc)),e=sub(Ec,Sc);return unit(sub(e,mul(d,dot(e,d))));}
// Gun proxy for arm clearance while steering: spheres on cross-sections of the musket every 3 cm (tall sections split
// into several spheres), cock at full and frizzen closed. Conservative; the clip checks use the real triangles.
export function gunProxy(ctx){if(ctx.proxy)return ctx.proxy;const parts=ctx.S.penetration.filter(s=>!['Ramrod','TriggerBlade'].includes(s.name)),spheres=[];
 for(let x=-.395;x<=1.156;x+=.03){let y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;for(const s of parts){if(s.max[0]<x||s.min[0]>x)continue;const sec=D.sectionAt(s,x);if(!sec)continue;y0=Math.min(y0,sec.y[0]);y1=Math.max(y1,sec.y[1]);z0=Math.min(z0,sec.z[0]);z1=Math.max(z1,sec.z[1]);}
  if(y1<y0)continue;const hy=(y1-y0)/2,hz=Math.max(.004,(z1-z0)/2),cz=(z0+z1)/2,n=Math.max(1,Math.ceil(hy/hz-.01)),r=Math.max(hz,hy/n)*1.05;for(let i=0;i<n;i++)spheres.push({c:[x,y0+hy/n*(2*i+1),cz],r});}
 return ctx.proxy=spheres;}
export function armGunGap(ctx,S,E,W){const sp=gunProxy(ctx);let g=Infinity;for(let i=1;i<=12;i++){const up=i<=6,t=up?i/6:(i-6)/6,p=up?add(S,mul(sub(E,S),t)):add(E,mul(sub(W,E),t)),r=up?.052+(.042-.052)*t:(t<.85?.042+(.020-.042)*t:.020);for(const q of sp){const d=len(sub(p,q.c))-q.r-r;if(d<g)g=d;}}return g;}
export function steer(ctx,side,pose,W,Q,nominal,{move=.10,bend=18,maxReach=.60,gun=false}={}){const sgn=side==='right'?1:-1;
 const cost=c=>{const Sv=gunOf(pose,c),a=armAt(ctx,side,Sv,W,Q),Ec=camOf(pose,a.elbow),Wc=camOf(pose,W),b=bendDir(c,Ec,Wc);let f=(a.bend/bend)**2+(len(sub(c,nominal))/move)**2;
  if(a.reach>maxReach)f+=((a.reach-maxReach)/.005)**2;if(a.reach<.25)f+=((.25-a.reach)/.01)**2;f+=40*Math.max(0,b[1]-.3)**2+20*Math.max(0,-sgn*b[0]-.3)**2;if(Math.abs(a.twist)>110)f+=((Math.abs(a.twist)-110)/10)**2;
  if(inView(c,.06))f+=25;if(gun){const g=armGunGap(ctx,Sv,a.elbow,W);if(g<.01)f+=2e5*(.01-g)**2;}
  // Plausible shoulder region (camera space): to its own side, below the eyes, near the camera plane.
  const box=side==='right'?{x:[.10,.32],y:[-.42,-.12],z:[-.32,.12]}:{x:[-.32,-.10],y:[-.42,-.12],z:[-.34,.12]};
  for(const [k,i] of [['x',0],['y',1],['z',2]]){const [lo,hi]=box[k];if(c[i]<lo)f+=((lo-c[i])/.01)**2;if(c[i]>hi)f+=((c[i]-hi)/.01)**2;}
  return f;};
 const best=nelderMead(cost,nominal,.03,500),Sc=best.x,Sv=gunOf(pose,Sc),a=armAt(ctx,side,Sv,W,Q);return {Sc,Sv,arm:a,cost:best.f};}

// ---- key authoring -------------------------------------------------------------------------------------------------
// state: {pose:{pos,R}, right:{W,Q}, left:{W,Q}, ch:{fingers, lock, ramrod, cues}, shoulders:{right,left} (camera)}.
export function channelsOf(ctx,st,prevEuler){const v={},pe=prevEuler??{};const e=eulerNear(M(st.pose.R,T(R0)),pe.root);
 const hip=ctx.hip,o=sub(st.pose.pos,hip);Object.assign(v,{pitch:e[0],yaw:e[1],roll:e[2],side:o[0],lift:o[1],forward:-o[2]});
 const shift={};for(const side of ['right','left']){const spec=ctx.rig.arms[side],h=st[side],Sv=gunOf(st.pose,st.shoulders[side]),S=sub(Sv,spec.shoulder),dlt=sub(sub(h.W,S),spec.wrist),he=eulerNear(h.Q,pe[side]);shift[side]=S;
  if(side==='right')Object.assign(v,{rightHandX:dlt[0],rightHandY:dlt[1],rightHandZ:dlt[2],rightHandPitch:he[0],rightHandYaw:he[1],rightHandRoll:he[2]});else Object.assign(v,{handX:dlt[0],handY:dlt[1],handZ:dlt[2],handPitch:he[0],handYaw:he[1],handRoll:he[2]});
  pe[side]=he;}
 pe.root=e;Object.assign(v,st.ch);return {v:CHANNELS.map(c=>r6(v[c]??0)),shift:[...shift.right,...shift.left].map(r6),euler:pe};}
// Pose from channels (+ sampled shift): root pose, wrists, rotations, virtual shoulders (gun frame).
export function poseOf(ctx,p,shift){const pose={pos:add(ctx.hip,[p.side,p.lift,-p.forward]),R:rootR([p.pitch,p.yaw,p.roll])},o={pose};
 for(const side of ['right','left']){const spec=ctx.rig.arms[side],S=side==='right'?[shift.rightX,shift.rightY,shift.rightZ]:[shift.leftX,shift.leftY,shift.leftZ],d=side==='right'?[p.rightHandX,p.rightHandY,p.rightHandZ]:[p.handX,p.handY,p.handZ],e=side==='right'?[p.rightHandPitch,p.rightHandYaw,p.rightHandRoll]:[p.handPitch,p.handYaw,p.handRoll];
  o[side]={W:add(add(spec.wrist,d),S),Q:P.eulerToMat(e),Sv:add(spec.shoulder,S)};}return o;}

// ---- musket anchors and moving parts (gun frame) --------------------------------------------------------------------
export const PAN=[.0223,-.0073,.034],MUZZLE=[1.155,0,0],RAMROD={origin:[1.1055,-.04,0],draw:.93,length:.9605,freeDraw:.912};
const rotZAbout=(p,o,a)=>{const v=sub(p,o),c=Math.cos(a),s=Math.sin(a);return add(o,[v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]]);};
// Cock comb: the up-back extreme of the cock at full cock (+18 deg), carried round the cock pivot; the thumb pad centre
// sits above and behind it by the thumb radius plus 1 mm.
export const COMB_FULL=[-.1171,.0513,.036];
export const combTarget=c=>rotZAbout(add(COMB_FULL,[-.004,.0092,0]),D.LOCK.cockPivot,(D.cockDeg(c)-D.LOCK.full)*deg);
// Frizzen top-front point when open (-45 deg) and the finger target just in front of it, carried round the pivot.
export const FRIZ_OPEN=[.0735,.0408,.028];
export const frizzenTarget=f=>rotZAbout(add(FRIZ_OPEN,[.0085,.003,0]),D.LOCK.frizzenPivot,(D.frizzenDeg(f)-D.LOCK.open)*deg);
// Hand frames and placements.
export function handQcam(ctx,side,pose,a,n){const F=ctx.H[side].F,Hb=side==='right'?P.basis(F.a,mul(F.t,-1),F.n):P.basis(F.a,F.t,F.n);
 const ac=unit(a),nc=unit(sub(n,mul(ac,dot(n,ac)))),tc=side==='right'?cross(ac,nc):cross(nc,ac),Hc=side==='right'?P.basis(ac,mul(tc,-1),nc):P.basis(ac,tc,nc);return M(T(pose.R),M(Hc,T(Hb)));}
export const byContact=(h,Q,pBind,target)=>({W:sub(target,MV(Q,sub(pBind,h.Wb))),Q});
export const byCue=(rel,O,Rc)=>{const Q=M(Rc,T(rel.R));return {W:sub(O,MV(Q,rel.center)),Q};};
export const cueOf=(rel,W,Q)=>({O:add(W,MV(Q,rel.center)),R:M(Q,rel.R)});
// flip: the head leaves the little-finger side of the fist instead of the thumb side.
export function ramRel(ctx,g,phi,flip=false){const c=ctx.design.cues.ramrod,x=mul(unit(c.rodX),flip?-1:1),y0=unit(sub(c.palmarN,mul(x,dot(c.palmarN,x)))),z0=cross(x,y0),y=add(mul(y0,Math.cos(phi)),mul(z0,Math.sin(phi)));
 return {center:sub(add(c.rodCentre,mul(x,g)),ctx.H.right.Wb),R:P.basis(x,y,cross(x,y)),g,phi};}
export const cartRel=ctx=>({center:ctx.design.cues.cartridge.center,R:ctx.design.cues.cartridge.R});
// Root poses.
export function primePose(pan,X,beta){const x=unit(X),toCam=unit(mul(pan,-1)),w=unit(sub(toCam,mul(x,dot(toCam,x)))),xw=cross(x,w),b=beta*deg,Z=add(mul(w,Math.cos(b)),mul(xw,Math.sin(b))),R=P.basis(x,cross(Z,x),Z);return {pos:sub(pan,MV(R,PAN)),R};}
// psi: direction of the ramrod side (gun -Y) about the barrel, from camera forward toward camera right (degrees).
export function loadPose(muzzle,X,psi){const x=unit(X),e1=unit(sub([0,0,-1],mul(x,-x[2]))),e2=cross(e1,x),s=psi*deg,Y=mul(add(mul(e1,Math.cos(s)),mul(e2,Math.sin(s))),-1),R=P.basis(x,Y,cross(x,Y));return {pos:sub(muzzle,MV(R,MUZZLE)),R};}
// Best roll of a hand placement family: make(phi) -> {W,Q}; scored by the steered arm.
export function bestRoll(ctx,side,pose,make,nominal,{step=15,opts={}}={}){let best=null;for(let k=0;k<360/step;k++){const phi=k*step*deg,h=make(phi),s=steer(ctx,side,pose,h.W,h.Q,nominal,opts);if(!best||s.cost<best.s.cost)best={phi,h,s};}return best;}
