// Pattern 1742 musket hands (round v14): grips, rig, finger poses, loading drill, motion, hands program, assembly.
// Usage (workspace root): node pipeline/flintlock-hand-author.mjs [--metadata-only]
// Writes (new files): game/flintlock-1742-motion-v1.json, game/flintlock-1742-arm-rig-v1.json,
// authoring/flintlock-1742-hands-v1.kiln.js, authoring/flintlock-1742-hands-v1-assembly.kiln.js (fitting-only review),
// authoring/flintlock-1742-hands-v1-design.json (design record).
// Gun frame: metres, +X muzzle, +Y up, +Z right (the v3 musket, authoring/flintlock-1742-v3.glb). Camera space is the
// browser's (+X right, +Y up, -Z forward); the weapon root is posed as weapon-extension.jsx poses it.
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as D from './flintlock-hand-design.mjs';
import * as P from './flintlock-hand-pose.mjs';
const {add,sub,mul,dot,cross,len,unit}=D,deg=Math.PI/180,r5=v=>Array.isArray(v)?v.map(r5):Math.round(v*1e5)/1e5,r6=v=>Array.isArray(v)?v.map(r6):Math.round(v*1e6)/1e6;
const root=new URL('../',import.meta.url),text=async p=>(await readFile(new URL(p,root),'utf8')).replace(/^﻿/,'');
process.chdir(new URL('.',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const S=await D.musket({cock:1,frizzen:0});

// ---- 1. Ready grips ---------------------------------------------------------------------------------------
export const RIGHT={yaw:-63,pitch:-8,roll:-20,xp:-.165,below:.03,right:.05,palmGap:.0015,splay:[0,24,28,32],gap:.0012,thumb:{abd:-15,dx:-.012,gap:.0012},index:{aim:[-.086,-.082,.011],tilt:0,gap:.0018}};
export const LEFT={yaw:40,pitch:18,roll:-10,xp:.33,below:.03,palmZ:-.022,palmGap:.0015,splay:[28,28,28,28],gap:.0012,thumb:{gap:.0012,height:-.3,riseDeg:4,contact:.03,bulge:.004}};
let dr=D.designRight(S,RIGHT);dr=D.designRight(S,{...RIGHT,fixedWrist:r5(dr.wrist)});
let dl=D.designLeft(S,LEFT);dl=D.designLeft(S,{...LEFT,fixedWrist:r5(dl.wrist)});
const evalR=D.evaluate(S,dr),evalL=D.evaluate(S,dl);

// ---- 2. Rig: shoulders placed in the gun frame from camera-space elbows at the hip view ---------------------------
const VIEW={hip:[.09,-.25,-.55],aim:[0,-.0195,-.21]};// sight-policy hip (Target) and derived aim position
const gunToCam=(rootPos,R)=>p=>add(rootPos,P.matV(R,p)),R0=[[0,0,1],[0,1,0],[-1,0,0]];// RotY(+90): gun (x,y,z) -> cam (z,y,-x)
const camToGun0=(rootPos)=>c=>{const d=sub(c,rootPos);return [-d[2],d[1],d[0]];};
const nominalShoulderCam={right:[.20,-.22,.03],left:[-.20,-.22,.03]};
function armRig(d,side){const W=d.wrist,a=d.frame.a,E=sub(W,mul(a,.31)),Ec=gunToCam(VIEW.hip,R0)(E),toward=unit(sub(nominalShoulderCam[side],Ec)),Sc=add(Ec,mul(toward,.33)),Sg=r5(camToGun0(VIEW.hip)(Sc));
 const dir=unit(sub(W,Sg)),foot=add(Sg,mul(dir,dot(sub(E,Sg),dir))),pole=r5(add(E,mul(unit(sub(E,foot)),.2))),ik=D.solveArmIK(Sg,W,pole,.33,.31);
 return {shoulder:Sg,wrist:W,pole,upperLength:.33,forearmLength:.31,elbow:r5(ik.elbow),elbowError:len(sub(ik.elbow,E)),reach:len(sub(W,Sg))/.64};}
const armR=armRig(dr,'right'),armL=armRig(dl,'left');
// Left pole: the Ready elbow direction alone leaves the elbow pointing up once the musket is turned muzzle-up for loading.
// This gun-frame direction (back, down and to the near side) keeps the left elbow down and out at Ready, in the priming
// position and in the loading position (pipeline/flintlock-hand-drill.mjs steering, round v14).
export const LEFT_POLE_DIR=[-.2,-.6,-.75];
{const pole=add(armL.shoulder,mul(unit(LEFT_POLE_DIR),.3)),ik=D.solveArmIK(armL.shoulder,armL.wrist,pole,.33,.31);armL.pole=r5(pole);armL.elbow=r5(ik.elbow);armL.elbowError=null;armL.poleBasis='LEFT_POLE_DIR (gun frame, from the shoulder)';}
// Hand-local frames for the program: x = hand axis, y = thumb side (left) or little side (right), z = palmar; proper rotations.
const handBasis=(F,side)=>P.basis(F.a,side==='right'?mul(F.t,-1):F.t,F.n);
const restQ={right:P.matToQuat(handBasis(dr.frame,'right')),left:P.matToQuat(handBasis(dl.frame,'left'))};
const restEuler={right:r6(P.quatToEuler(restQ.right)),left:r6(P.quatToEuler(restQ.left))};

// ---- 3. Digits, joints and axes ------------------------------------------------------------------------------
function digits(d,side){const out=[];for(const g of [...d.fingers,d.thumb]){const c=D.catmull(g.points),J=P.joints(c);
 let w=g.plane?g.plane.w:null;if(!w){const dir=unit(sub(J[2],J[0]));w=unit(cross(dir,d.frame.n));}// left thumb: +angle flexes toward the wood
 out.push({points:g.points,radius:g.radius,J,w,curve:c,plane:g.plane??null});}return out;}
const DR=digits(dr,'right'),DL=digits(dl,'left');
console.log(JSON.stringify({wristR:dr.wrist,wristL:dl.wrist,armR,armL,restEuler,evalR:evalR.digits.map(x=>[x.name,x.padGapMM,x.minClearanceMM]),evalL:evalL.digits.map(x=>[x.name,x.padGapMM,x.minClearanceMM]),palmR:evalR.palmGapMM,palmL:evalL.palmGapMM}));

// ---- 4. Finger poses ---------------------------------------------------------------------------------------
// Right fist: fingers flex in their own wrap planes round a cylinder whose axis is the mean plane normal, passing
// palmar of the knuckles by finger radius + object radius + 1 mm. The index re-aims into the middle finger's plane
// (it leaves the trigger) before flexing. Angles are found by a coarse-to-fine grid on the posed centrelines.
const pad=(g,t)=>D.tubeRadius(g.radius,t),Wr=dr.wrist,Wl=dl.wrist;
const lineDist=(p,L)=>{const d=sub(p,L.p);return len(sub(d,mul(L.d,dot(d,L.d))));};
const meanW=unit([1,2,3].map(f=>DR[f].w).reduce((a,b)=>add(a,b)));
function gripLine(r){const pts=[1,2,3].map(f=>add(dr.fingers[f].mcp,mul(DR[f].plane.v,DR[f].radius+r+.0015)));const c=mul(pts.reduce((a,b)=>add(a,b)),1/3);return {p:c,d:meanW,r};}
const fistIndexQ0=(()=>{const i=DR[0].plane,m=DR[1].plane;return P.matToQuat(P.matMul(P.basis(m.u,m.v,m.w),P.matT(P.basis(i.u,i.v,i.w))));})();
// Penetration is scored over the whole digit (from t 1/12; the proximal phalanx flexes toward the object), the fit only distally.
function wrapScore(g,q,L,gap=.001){let e=0;for(let k=2;k<=24;k++){const t=k/24,p=P.posedPoint(g.J,q,g.curve(t),t),d=lineDist(p,L),want=L.r+pad(g,t)+gap,pen=Math.max(0,want-d);e+=pen*pen*1e4+(t>=.55?(d-want)**2:0);}return e;}
function fitFlex(g,L,q0pre=P.qId,ranges=[[-10,70],[0,100],[0,90]]){let best={e:Infinity};
 for(const step of [6,2,.5]){const c=best.a??ranges.map(([a,b])=>(a+b)/2),span=best.a?[step*4,step*4,step*4]:ranges.map(([a,b])=>(b-a)/2);
  for(let a0=c[0]-span[0];a0<=c[0]+span[0]+1e-9;a0+=step)for(let a1=Math.max(ranges[1][0],c[1]-span[1]);a1<=c[1]+span[1]+1e-9;a1+=step)for(let a2=Math.max(ranges[2][0],c[2]-span[2]);a2<=c[2]+span[2]+1e-9;a2+=step){
   const q=[P.qMul(q0pre,P.qAxis(g.w,a0*deg)),P.qAxis(g.w,a1*deg),P.qAxis(g.w,a2*deg)],e=wrapScore(g,q,L);if(e<best.e)best={e,a:[a0,a1,a2]};}}
 return best;}
const rodLine=gripLine(.0026),cartLine=gripLine(.009);
const fistFit=[0,1,2,3].map(f=>fitFlex(DR[f],rodLine,f===0?fistIndexQ0:P.qId));
// Thumb close: about its own wrap-plane normal, round the same rod line.
const thumbFit=fitFlex(DR[4],rodLine,P.qId,[[-20,80],[0,80],[0,70]]);
console.log('fist',JSON.stringify(fistFit.map(f=>({a:f.a,e:+f.e.toExponential(2)}))),'thumb',JSON.stringify(thumbFit));
// Trigger pull: equal extra flexion at the index PIP and DIP that closes the Ready pad gap to contact.
const padGapTo=(g,q,surf)=>{let best=Infinity;for(let k=0;k<=12;k++){const t=.76+.24*k/12,p=P.posedPoint(g.J,q,g.curve(t),t);best=Math.min(best,D.signedM(p,surf).gap-pad(g,t));}return best;};
let pull=0;{let lo=0,hi=20;for(let k=0;k<30;k++){const m=(lo+hi)/2,g=padGapTo(DR[0],[P.qId,P.qAxis(DR[0].w,m*deg),P.qAxis(DR[0].w,m*deg)],S.trigger);if(g>0)lo=m;else hi=m;}pull=+((lo+hi)/2).toFixed(2);}
// Pose tables. Right: fist (rightOpen -1), open (rightOpen +1), pull (rightIndex 1), thumb close (+1) / extend (-1).
// Left: grasp (open -1) / release (open +1), thumb lift (thumb +1).
const TR={digits:[0,1,2,3].map(f=>({w:r6(DR[f].w),fist:fistFit[f].a,open:f===0?[25,45,30]:[45,55,30],pull:f===0?[0,pull,pull]:[0,0,0],...(f===0?{fistQ0:r6(fistIndexQ0)}:{})})).concat([{w:r6(DR[4].w),closeQ0:r6(P.qAxis(DR[4].w,thumbFit.a[0]*deg)),close:[thumbFit.a[0],thumbFit.a[1],thumbFit.a[2]],ext:[40,30,20]}])};
// Left: release (open +1) and thumb lift (thumb +1) about each digit's axis; open -1 is the loading grip (section 4b).
const TL={digits:[0,1,2,3].map(f=>({w:r6(DL[f].w),release:[22,30,16],graspQ:[P.qId,P.qId,P.qId]})).concat([{w:r6(DL[4].w),lift:[18,10,6],graspQ:[P.qId,P.qId,P.qId]}])};
const poseR=p=>P.fingerPose(TR,'right',p),poseL=p=>P.fingerPose(TL,'left',p);
// ---- 4b. Left loading grip: the left hand slides up the fore-end and turns for the muzzle-up loading position --------
// Designed with the same v13 method at x .55 with the hand axis turned back along the fore-end, then reached from the
// Ready bind by the wrist (LOADGRIP.W, LOADGRIP.Q) and per-bone rotations (TL graspQ, open -1) that align each bone with
// the designed digit (a chain of shortest-arc rotations; the bind and loading wraps share each digit's plane).
export const LOAD_LEFT={...LEFT,yaw:120,pitch:30,roll:-10,xp:.55,palmZ:-.022};
const dLoad=D.designLeft(S,LOAD_LEFT),evalLoad=D.evaluate(S,dLoad);
const HbL=P.basis(dl.frame.a,dl.frame.t,dl.frame.n),HlL=P.basis(dLoad.frame.a,dLoad.frame.t,dLoad.frame.n),QloadL=P.matMul(HlL,P.matT(HbL));
const LOADGRIP={W:r6(dLoad.wrist),Q:r6(QloadL),euler:r6(P.matToEuler(QloadL)),params:LOAD_LEFT,evaluation:evalLoad,fitMaxErrorMM:[]};
{const toBind=p=>add(Wl,P.matV(P.matT(QloadL),sub(p,dLoad.wrist))),qFromTo=(a,b)=>{a=unit(a);b=unit(b);const r=dot(a,b)+1;if(r<1e-8)return P.qAxis(unit(cross(a,Math.abs(a[0])<.9?[1,0,0]:[0,1,0])),Math.PI);const c=cross(a,b),q=[c[0],c[1],c[2],r],l=Math.hypot(...q);return q.map(v=>v/l);};
 for(let f=0;f<5;f++){const g=DL[f],tc=D.catmull((f<4?dLoad.fingers[f].points:dLoad.thumb.points).map(toBind)),Jt=[tc(0),tc(.43),tc(.74),tc(1)],Jb=[...g.J,g.curve(1)];
  const W0=qFromTo(sub(Jb[1],Jb[0]),sub(Jt[1],Jt[0])),W1=P.qMul(qFromTo(P.qRot(W0,sub(Jb[2],Jb[1])),sub(Jt[2],Jt[1])),W0),W2=P.qMul(qFromTo(P.qRot(W1,sub(Jb[3],Jb[2])),sub(Jt[3],Jt[2])),W1);
  TL.digits[f].graspQ=[W0,P.qMul(P.qConj(W0),W1),P.qMul(P.qConj(W1),W2)].map(r6);
  let e=0;for(let k=4;k<=20;k++){const t=k/20;e=Math.max(e,len(sub(P.posedPoint(g.J,TL.digits[f].graspQ,g.curve(t),t),tc(t))));}LOADGRIP.fitMaxErrorMM.push(+(e*1000).toFixed(2));}}
console.log('load grip',JSON.stringify({W:LOADGRIP.W,euler:LOADGRIP.euler,fit:LOADGRIP.fitMaxErrorMM,min:evalLoad.digits.map(g=>g.minClearanceMM),pads:evalLoad.digits.map(g=>g.padGapMM),palm:evalLoad.palmGapMM}));
// Cartridge hold: the fist scaled to the cartridge diameter (rightOpen = -cart.open, rightThumb = cart.thumb).
const fistScore=(L,s,st)=>{const q=poseR({rightOpen:-s,rightIndex:0,rightThumb:st});let e=0;for(let f=0;f<4;f++)e+=wrapScore(DR[f],q[f],L);return e+wrapScore(DR[4],q[4],L);};
const cart={open:0,thumb:0};{let best=Infinity;for(let s=.2;s<=1.0001;s+=.02)for(let st=0;st<=1.0001;st+=.05){const e=fistScore(cartLine,s,st);if(e<best){best=e;cart.open=+s.toFixed(2);cart.thumb=+st.toFixed(2);}}cart.score=best;}
const rod={open:1,thumb:1,score:fistScore(rodLine,1,1)};
console.log('pull',pull,'cart',JSON.stringify(cart),'rod',rod.score.toExponential(2));

// ---- 5. Cues relative to the right wrist bone (bind frame = wrist-local frame) -------------------------------
// Tunnel ends: projections of the index and little knuckles on the grip line; +X of each cue runs into the fist
// (cartridge: toward the ball end) or out of the thumb side (ramrod: toward its head).
const along=(L,p)=>dot(sub(p,L.p),L.d),onLine=(L,s)=>add(L.p,mul(L.d,s));
const sIdx=along(cartLine,dr.fingers[0].mcp),sLit=along(cartLine,dr.fingers[3].mcp),intoFist=Math.sign(sLit-sIdx);
const perpFrame=(x,ref)=>{const y=unit(sub(ref,mul(x,dot(ref,x))));return [x,y,cross(x,y)];};
const CART={length:.070,powderEnd:-.042,ballEnd:.028};
const cartOrigin=onLine(cartLine,sIdx-intoFist*.006),cartX=mul(cartLine.d,intoFist),cartF=perpFrame(cartX,dr.frame.n);
const cartRel={center:r6(sub(cartOrigin,Wr)),R:P.basis(...cartF)};cartRel.euler=r6(P.matToEuler(cartRel.R));
const RAM={origin:[1.1055,-.04,0],draw:.93,length:.9605,grip:.44,headGrip:.0105};
const rodCentre=onLine(rodLine,(along(rodLine,dr.fingers[1].mcp)+along(rodLine,dr.fingers[2].mcp))/2),rodX=mul(rodLine.d,-intoFist);
// The roll of the cue about the rod is chosen by the swap pose (section 6); the wrist-relative frame is X = rodX.
function ramRel(phi){const [x,y0,z0]=perpFrame(rodX,dr.frame.n),y=add(mul(y0,Math.cos(phi)),mul(z0,Math.sin(phi))),z=cross(x,y);const R=P.basis(x,y,z);return {grip:RAM.grip,center:r6(sub(add(rodCentre,mul(rodX,RAM.grip)),Wr)),R,euler:r6(P.matToEuler(R)),phi};}

// ---- Design record (input to the drill, program and measurement modules) ------------------------------------
const digitRecord=g=>({points:r6(g.points),radius:g.radius,J:r6(g.J),w:r6(g.w),plane:g.plane?{u:r6(g.plane.u),v:r6(g.plane.v),w:r6(g.plane.w)}:null});
const frameRecord=F=>({a:r6(F.a),t:r6(F.t),n:r6(F.n),handed:F.handed});
export const design={schemaVersion:1,source:'pipeline/flintlock-hand-author.mjs',gun:D.GUN,frame:'gun frame metres, +X muzzle, +Y up, +Z right',
 params:{right:RIGHT,left:LEFT},
 right:{wrist:dr.wrist,frame:frameRecord(dr.frame),digits:DR.map(digitRecord),mcp:dr.fingers.map(f=>r6(f.mcp)),thumbBase:r6(dr.thumb.base),evaluation:evalR},
 left:{wrist:dl.wrist,frame:frameRecord(dl.frame),digits:DL.map(digitRecord),mcp:dl.fingers.map(f=>r6(f.mcp)),thumbBase:r6(dl.thumb.base),evaluation:evalL},
 arms:{right:armR,left:armL},restEuler,poseTables:{right:TR,left:TL},triggerPullDeg:pull,loadGripLeft:LOADGRIP,
 holds:{cartridge:{rightOpen:-cart.open,rightThumb:cart.thumb,score:cart.score},ramrod:{rightOpen:-1,rightThumb:1,score:rod.score}},
 lines:{rod:{p:r6(rodLine.p),d:r6(rodLine.d),r:rodLine.r},cartridge:{p:r6(cartLine.p),d:r6(cartLine.d),r:cartLine.r}},
 cues:{cartridge:{center:cartRel.center,rotation:cartRel.euler,R:r6(cartRel.R),dimensions:CART,origin:'index/thumb end of the fist tunnel, 6 mm outside the index knuckle line; +X into the fist toward the little finger (ball end inside, powder end out of the thumb side)'},
  ramrod:{rodCentre:r6(rodCentre),rodX:r6(rodX),palmarN:r6(dr.frame.n),...RAM,origin:'head end face of the drawn ramrod; +X toward the head (out of the thumb side of the fist)'}}};
await writeFile(new URL('authoring/flintlock-1742-hands-v1-design.json',root),JSON.stringify(design,null,1)+'\n');
console.log('cartRel',JSON.stringify({center:cartRel.center,euler:cartRel.euler}),'ramRel0',JSON.stringify(ramRel(0).center),'intoFist',intoFist);
export {S,dr,dl,evalR,evalL,armR,armL,DR,DL,restQ,restEuler,VIEW,R0,gunToCam,camToGun0,handBasis,TR,TL,poseR,poseL,rodLine,cartLine,cart,rod,cartRel,ramRel,rodCentre,rodX,RAM,CART};

// ---- 6. Clips, motion, rig and their checks ---------------------------------------------------------------------
// Clips: pipeline/flintlock-hand-clips.mjs (key states) and pipeline/flintlock-hand-drill.mjs (channels, steering).
const X=await import('./flintlock-hand-drill.mjs'),C=await import('./flintlock-hand-clips.mjs'),MO=await import('./flintlock-hand-motion.mjs'),PG=await import('./flintlock-hand-program.mjs');
const ctx=await X.loadContext();ctx.hip=VIEW.hip;
const built=await C.buildClips(ctx,{log:(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)))}),fin=C.finalizeClips(ctx,built);
const rig=MO.buildRig(design,{leftPoleDir:LEFT_POLE_DIR}),motion=MO.buildMotion({fin,built,design,rig});
// Keys must be strictly increasing and the swap holds must be exact; channel ranges per the contract.
for(const [name,c]of Object.entries(motion.clips)){for(let i=1;i<c.keys.length;i++)assert(c.keys[i].t>c.keys[i-1].t,name+' key times at '+i);assert(c.keys[0].t===0&&c.keys[c.keys.length-1].t===1,name+' ends');
 const ix=k=>X.CHANNELS.indexOf(k);for(const k of c.keys){for(const ch of ['cock','frizzen','ramrod','ramrodCue','cartridge'])assert(k.v[ix(ch)]>=-1e-9&&k.v[ix(ch)]<=1+1e-9,name+' '+ch+' range');}}
const at=(clip,t)=>motion.clips[clip].keys.find(k=>Math.abs(k.t-t)<1e-9),chv=(k,ch)=>k.v[X.CHANNELS.indexOf(ch)];
assert(chv(at('Ready',0),'cock')===1&&chv(at('Ready',0),'frizzen')===0&&chv(at('Fired',0),'cock')===0&&chv(at('Fired',0),'frizzen')===1,'Ready/Fired lock states');
assert(chv(at('Reload',0),'cock')===0&&chv(at('Reload',1),'cock')===1&&chv(at('Reload',1),'frizzen')===0,'Reload Fired to Ready');
const fireKeys=motion.clips.Fire.keys;assert(Math.abs(fireKeys.find(k=>k.phase==='cock falls').t*motion.clips.Fire.duration-.015)<1e-9&&Math.abs(fireKeys.find(k=>k.phase==='pan flash').t*motion.clips.Fire.duration-.03)<1e-9&&Math.abs(fireKeys.find(k=>k.phase==='shot').t*motion.clips.Fire.duration-.06)<1e-9,'Fire timing');
const checks=await MO.checkMotion(ctx,motion);
for(const s of checks.swaps)assert(s.maxPositionErrorMM<=1&&s.maxAngleErrorDeg<=1,'swap '+JSON.stringify(s));
assert(checks.ram&&checks.ram.maxAxisAngleDeg<=2&&checks.ram.maxHeadOffBoreLineMM<=2,'ram '+JSON.stringify(checks.ram));
for(const [name,c]of Object.entries(checks.clips))assert(c.stretched===0,name+' stretched');
console.log('checks',JSON.stringify({swaps:checks.swaps.map(s=>({between:s.between,mm:s.maxPositionErrorMM,deg:s.maxAngleErrorDeg})),ram:checks.ram,clips:Object.fromEntries(Object.entries(checks.clips).map(([n,c])=>[n,{reachR:c.right.minReachMarginM,reachL:c.left.minReachMarginM,bendR:c.right.maxBendDeg,bendL:c.left.maxBendDeg,twistR:c.right.twistRangeDeg,twistStepR:c.right.maxTwistStepDeg,twistL:c.left.twistRangeDeg,wraps:c.twistWraps.length,shouldersInView:c.shouldersInView,hand:c.worstHand&&[c.worstHand.gapMM,c.worstHand.side,c.worstHand.part,c.worstHand.at,c.worstHand.phase],arm:c.worstArm&&[c.worstArm.gapMM,c.worstArm.side,c.worstArm.part,c.worstArm.at,c.worstArm.phase],cue:c.worstCue&&[c.worstCue.gapMM,c.worstCue.part,c.worstCue.phase],camera:c.camera}]))}));
await writeFile(new URL('game/flintlock-1742-motion-v1.json',root),JSON.stringify(motion,null,1)+'\n');
await writeFile(new URL('game/flintlock-1742-arm-rig-v1.json',root),JSON.stringify(rig,null,2)+'\n');
await writeFile(new URL('evidence/flintlock-1742-v14/motion-checks.json',root),JSON.stringify({schemaVersion:1,generated:new Date().toISOString(),motion:'game/flintlock-1742-motion-v1.json',rig:'game/flintlock-1742-arm-rig-v1.json',hip:VIEW.hip,...checks,keyDiagnostics:Object.fromEntries(Object.entries(fin).map(([n,c])=>[n,c.diag]))},null,1)+'\n');
if(process.argv.includes('--metadata-only')){console.log('metadata written');process.exit(0);}

// ---- 7. Hands program and fitting-only assembly ------------------------------------------------------------------
const handsSource=await PG.handsProgram({motion,rig,design});
await writeFile(new URL('authoring/flintlock-1742-hands-v1.kiln.js',root),handsSource);
await writeFile(new URL('authoring/flintlock-1742-hands-v1-assembly.kiln.js',root),await PG.assemblyProgram({hands:handsSource,motion,hip:VIEW.hip}));
console.log('programs written',handsSource.length);
