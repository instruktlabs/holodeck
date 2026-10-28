// Pattern 1742 musket (round v14): the motion and rig documents and their analytic checks at 60 Hz.
// The motion follows the fixed channel contract (pipeline/flintlock-hand-drill.mjs CHANNELS) and adds the musket's lock,
// ramrod, ramrod cue, cartridge cue and shoulder-shift blocks. The checks pose every clip as the hosts do (the shared
// smootherstep sampler, the weapon root, gun-frame wrist goals, the rig's two-bone IK from the shifted shoulder) and
// report reach, forearm twist, wrist bend, shoulders in view, camera clearance, hand/arm/cue clearance to the musket at
// the sampled lock and ramrod state, the cue swaps and the ram. Analysis only; nothing here ships.
import * as D from './flintlock-hand-design.mjs';
import * as P from './flintlock-hand-pose.mjs';
import {sampleTimeline} from '../game/animation-sampler.mjs';
import {CHANNELS,SHIFT_FIELDS,poseOf,armAt,camOf,gunOf,inView,cueOf,handSamples,fingerQ,place,rotDeg,angDeg,stateSurfaces,clearance,MUZZLE,RAMROD,I3} from './flintlock-hand-drill.mjs';
const {add,sub,mul,dot,len,unit}=D,deg=Math.PI/180,r=(v,d=2)=>+(+v).toFixed(d),rv=(v,d=4)=>v.map(x=>r(x,d));

// ---- documents ------------------------------------------------------------------------------------------------------
export const IDS={gun:{assetId:'a_0a31fd5eeb864b529202724a65de4623',revisionId:'r_f052d566fab74b82b005050758dd180a',glb:'authoring/flintlock-1742-v3.glb',pins:'authoring/firearm-flintlock-v3-pins.json'},
 cartridge:{assetId:'a_2741cba5bb43444aa2159f8be8738d0c',revisionId:'r_df84200b038e429db40500966fd0faab',glb:'authoring/flintlock-1742-cartridge-v1.glb',pins:'authoring/flintlock-1742-cartridge-v1-pins.json'}};
export function sampleShift(keys,t){t=Math.max(0,Math.min(1,t));let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;const a=keys[i],b=keys[i+1],x=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),u=x*x*x*(x*(x*6-15)+10);return a.v.map((v,j)=>v+(b.v[j]-v)*u);}
const shiftObj=v=>Object.fromEntries(SHIFT_FIELDS.map((k,i)=>[k,v[i]]));

export function buildRig(design,{leftPoleDir}){const arm=a=>({shoulder:a.shoulder,wrist:a.wrist,pole:a.pole,upperLength:a.upperLength,forearmLength:a.forearmLength});
 return {version:1,profile:'flintlock1742',units:'metres',forward:'+X',up:'+Y',right:'+Z',bones:41,maxReachMargin:.00001,twistFractions:[.4,.8],
  arms:{right:arm(design.arms.right),left:arm(design.arms.left)},restHandRotations:design.restEuler,poseFields:{right:['rightHandX','rightHandY','rightHandZ'],left:['handX','handY','handZ']},
  derivation:{source:'pipeline/flintlock-hand-author.mjs (round v14)',gun:IDS.gun,
   wrists:'Each wrist is the Ready glove wrist designed against the v3 musket (right on the stock wrist and trigger, left on the fore-end; pipeline/flintlock-hand-design.mjs), so the Ready clip has zero hand deltas.',
   shoulders:'From camera-space elbows at the hip view (sight-policy hipPosition [0.09,-0.25,-0.55]): elbow 0.31 m back along each forearm, shoulder 0.33 m from it toward a nominal camera-space shoulder; expressed in the gun frame.',
   rightPole:'0.2 m beyond the Ready elbow, away from the shoulder-wrist line (the Ready elbow is the pole-plane solution).',
   leftPole:{directionFromShoulder:leftPoleDir,length:.3,basis:'The Ready elbow direction alone leaves the left elbow pointing up once the musket is turned muzzle-up for loading; this gun-frame direction (back, down and to the near side) keeps it down and out at Ready, priming and loading.'},
   shoulderShift:'Per-key shoulder translations (gun frame) are in the motion (shoulderShift). The hands asset bakes them as shoulder-bone translation tracks; the browser IK solves from the rig shoulder and the baked translation carries the solved arm. Hosts that solve against absolute goals add the sampled shift to the wrist effector and to the pole goal.',
   restHandRotations:'Euler XYZ of each glove frame (x hand axis, y little-finger side for the right and thumb side for the left, z palmar) in gun axes; informational. The hands are built directly in the gun frame and every bone has an identity bind rotation.',
   elbows:{right:design.arms.right.elbow,left:design.arms.left.elbow}}};}

export function buildMotion({fin,built,design,rig}){const parts=built.parts,relB=parts.relB,cr=parts.cartRel;
 const clips={},shiftClips={};for(const [name,c]of Object.entries(fin)){clips[name]={duration:c.duration,loop:c.loop,...(c.commitPhase!==undefined?{commitPhase:c.commitPhase}:{}),keys:c.keys};shiftClips[name]={keys:c.shift};}
 const reload=clips.Reload.keys,phaseT=p=>reload.find(k=>k.phase===p)?.t??null;
 return {version:1,id:'flintlock-1742-motion-v1',profile:'flintlock1742',sampleRate:60,units:'metres and radians; normalized key times',channels:CHANNELS,
  reloadCommitPhase:.75,
  drill:{source:'Owner decisions, 27 Oct 2026: condensed loading drill of about 10 s (half-cock, prime, shut pan, charge, draw rammer, ram, return rammer, cock); lock delay, no misfires.',
   order:['fired','priming position','half-cock (right thumb)','pouch at the right hip','take cartridge','bite','prime at anchor_vfx_pan','shut pan (right fingers)','cast about (muzzle up forward of the left shoulder, left hand)','charge, then the cartridge hides','draw rammer (ramrod 0 to 1), swap to the rammer cue at full draw','turn rammer end over end','enter the muzzle','ram down the bore','rammed (commit 0.75)','withdraw and turn back','return rammer: swap back at full draw, ramrod 1 to 0','recover','full cock (0.5 to 1)','ready'],
   keyTimes:{halfCock:phaseT('half-cock'),takeCartridge:phaseT('take cartridge'),bite:phaseT('bite'),prime:phaseT('prime'),shutPan:phaseT('shut pan'),charge:phaseT('charge'),fullDraw:phaseT('full draw'),swapToCue:phaseT('swap to rammer cue'),enterMuzzle:phaseT('enter the muzzle'),rammed:phaseT('rammed (commit)'),swapToRamrod:phaseT('swap to ramrod'),fullCock:phaseT('full cock')},
   label:'Key times are the authored choreography (the owner times were guides); presentation, not a drill manual.'},
  lock:{contract:'flintlock-lock-v1',source:IDS.gun.pins+' lock block',frame:'gun',
   cock:{node:'Joint_Cock',channel:'cock',pivot:D.LOCK.cockPivot,axis:[0,0,1],degrees:{down:D.LOCK.down,half:D.LOCK.half,full:D.LOCK.full},meaning:'0 down (fired), 0.5 half cock, 1 full cock; the node rotates about local +Z (gun +Z through the pivot) piecewise-linearly in degrees: down + (half - down) x cock / 0.5 below 0.5, half + (full - half) x (cock - 0.5) / 0.5 above',label:'Estimate (measured on the v3 model); down is the flint\'s closest approach to the closed frizzen, 30.2 mm short: the modelled cock cannot reach the frizzen'},
   frizzen:{node:'Joint_Frizzen',channel:'frizzen',pivot:D.LOCK.frizzenPivot,axis:[0,0,1],degrees:{closed:D.LOCK.closed,open:D.LOCK.open},meaning:'0 closed (pan shut), 1 open; closed + (open - closed) x frizzen degrees about local +Z',label:'closed Model; open Estimate'}},
  ramrod:{node:'Joint_Ramrod',channel:'ramrod',origin:RAMROD.origin,axis:[1,0,0],drawMetres:RAMROD.draw,freeDrawMetres:RAMROD.freeDraw,lengthMetres:RAMROD.length,
   meaning:'Joint_Ramrod translates along local +X (gun +X) by ramrod x drawMetres; hidden while ramrodCue > 0.5',grasp:'anchor_interaction_ramrod [1.095,-0.04,0] at rest (RamrodTip centre); a root child that does not move, so add ramrod x drawMetres along +X',
   label:'drawMetres Model plus 18 mm margin (free of the front pipe at 0.912 m; 1.27 mm clear of the fore-end at full draw)'},
  ramrodCue:{source:'copy of the Joint_Ramrod subtree of the v3 musket (asset '+IDS.gun.assetId+', revision '+IDS.gun.revisionId+')',parent:'Joint_right_right_wrist',channel:'ramrodCue',visibility:'shown only when ramrodCue > 0.5',
   rightWristRelativeCenter:rv(relB.center,6),rightWristRelativeRotation:rv(P.matToEuler(relB.R),6),rotationOrder:'Euler XYZ, radians, in the right wrist joint frame',
   meaning:'replaces the copied Joint_Ramrod node\'s local position (its origin: the head end face on the rod axis) and rotation; scale stays 1; the rod runs back along the cue -X',
   grip:{fromHeadMetres:parts.g2,hold:'right fist (rightOpen -1, rightThumb 1) round the rod; the head leaves the little-finger side, so the ram is made thumb up after the rammer is turned end over end',rollAboutRodDeg:r(parts.phiB/deg,1)},
   swaps:'At "swap to rammer cue" (draw) and "swap to ramrod" (return) the hand holds still at full draw and the cue coincides with the drawn Joint_Ramrod (measured in evidence/flintlock-1742-v14/)'},
  cartridge:{source:'saved paper cartridge cue (asset '+IDS.cartridge.assetId+', revision '+IDS.cartridge.revisionId+', '+IDS.cartridge.glb+')',parent:'Joint_right_right_wrist',channel:'cartridge',visibility:'shown only when cartridge > 0.5',
   rightWristRelativeCenter:rv(cr.center,6),rightWristRelativeRotation:rv(P.matToEuler(cr.R),6),rotationOrder:'Euler XYZ, radians, in the right wrist joint frame',
   meaning:'replaces the cue root\'s local position and rotation; scale stays 1; visibility fraction, no ammunition-state authority',axis:'cue +X from the powder end (-0.042) to the ball end (+0.028); the ball end sits in the fist, the powder end leaves the thumb side',
   hold:{rightOpen:design.holds.cartridge.rightOpen,rightThumb:design.holds.cartridge.rightThumb}},
  shoulderShift:{fields:SHIFT_FIELDS,frame:'gun frame metres (the weapon root frame)',sampler:'the clip key times and smootherstep of game/animation-sampler.mjs',
   meaning:'Translation of each rig shoulder for this key. The hands asset bakes it on Joint_<side>Arm_<side>_shoulder. Browser: the live IK solves from rig.arms.<side>.shoulder and the baked translation carries the arm. Absolute-goal hosts (Unreal): add the sampled shift to the wrist effector and to the pole goal (the hand channels are relative to the unshifted rig wrist).',
   why:'The rig shoulders sit in the weapon root frame; turning the musket muzzle-up for priming and loading would otherwise carry them to the knees. Each key\'s shoulder is placed in camera space (to its own side, below the eyes, out of view) so that the arm reaches without stretch and the forearm meets the hand with a small wrist bend.',
   clips:shiftClips},
  fire:{panFlashSeconds:.03,shotSeconds:.06,phases:{'cock falls':.025,'pan flash':.05,shot:.10},meaning:'Fire clip: trigger at 0, cock down by 15 ms, frizzen open 15-30 ms (pan flash), the game fires the shot at 60 ms; the hands absorb it and the clip ends at Fired. No misfires.'},
  fingers:{right:'rightOpen +1 open, 0 Ready grip, -1 fist (rammer); rightIndex 1 presses the trigger (Ready pad gap closed); rightThumb +1 closes round the fist, -1 extends (cocking)',left:'open 0 Ready grip, +1 released, -1 loading grip (fore-end, muzzle up); thumb +1 lifts'},
  clips,
  cameraPlacementAuthority:'game/flintlock-1742-view-v1.json (pipeline/derive-sight-view.mjs from game/sight-policy-v1.json)'};}

// ---- analytic 60 Hz checks --------------------------------------------------------------------------------------------
// Rod sample points of a placed cue (origin O at the head end, rod back along -X of R) and of the cartridge.
// Measured on the v3 rod: tip radius 4.4 mm over its first 25 mm, shaft radius 2.6 mm.
const rodPoints=(O,R)=>{const out=[];for(let s=0;s<=RAMROD.length+1e-9;s+=.01)out.push({p:add(O,P.matV(R,[-s,0,0])),r:s<.025?.0044:.0026});return out;};
const cartPoints=(O,R)=>{const out=[];for(let x=-.042;x<=.0281;x+=.007)out.push({p:add(O,P.matV(R,[x,0,0])),r:.0075});return out;};
// Sleeve capsule samples (radius profile of the hands program's sleeve).
function armPoints(S,E,W){const out=[];for(let i=1;i<=10;i++){const t=i/10;out.push({p:add(S,mul(sub(E,S),t)),r:.052+(.042-.052)*t,part:'upper'});}for(let i=1;i<=10;i++){const t=i/10;out.push({p:add(E,mul(sub(W,E),t)),r:t<.85?.042+(.020-.042)*t:.020,part:'fore'});}return out;}
export async function checkMotion(ctx,motion,{hz=60,clips,rows=false}={}){const rel={ram:{center:motion.ramrodCue.rightWristRelativeCenter,R:P.eulerToMat(motion.ramrodCue.rightWristRelativeRotation)},cart:{center:motion.cartridge.rightWristRelativeCenter,R:P.eulerToMat(motion.cartridge.rightWristRelativeRotation)}};
 const out={method:'pipeline/flintlock-hand-motion.mjs checkMotion: clip channels and shoulder shifts sampled with the shared smootherstep sampler at '+hz+' Hz plus every key; the rig IK from the shifted shoulder (as the browser adapter after the baked translation); hand points are the design glove samples (palm, thenar, digit tubes), arms are sleeve capsules. Sampled evidence, not a continuous collision certificate.',clips:{},swaps:[],ram:null};
 const full=RAMROD.draw,drawO=d=>add(RAMROD.origin,[d,0,0]);
 for(const [name,clip]of Object.entries(motion.clips)){if(clips&&!clips.includes(name))continue;const n=Math.ceil(clip.duration*hz),ts=new Set();for(let i=0;i<=n;i++)ts.add(+(i/n).toFixed(7));for(const k of clip.keys)ts.add(k.t);const times=[...ts].sort((a,b)=>a-b);
  const res={samples:times.length,right:{minReachMarginM:Infinity,maxBendDeg:0,maxTwistDeg:0,maxTwistStepDeg:0,twistRangeDeg:[Infinity,-Infinity]},left:{minReachMarginM:Infinity,maxBendDeg:0,maxTwistDeg:0,maxTwistStepDeg:0,twistRangeDeg:[Infinity,-Infinity]},
   shouldersInView:0,stretched:0,worstHand:{gap:Infinity},worstArm:{gap:Infinity},worstCue:{gap:Infinity},camera:{minHandM:Infinity,minCueM:Infinity,minGunM:Infinity,cameraInsideGun:0},twistWraps:[],bendOver45:[]};
  const prevTw={};if(rows)res.rows=[];
  for(const t of times){const p=sampleTimeline(motion,name,t),sh=shiftObj(sampleShift(motion.shoulderShift.clips[name].keys,t)),pose=poseOf(ctx,p,sh),state={cock:p.cock,frizzen:p.frizzen,draw:p.ramrod*full,ramrodVisible:p.ramrodCue<=.5};
   const surf=await stateSurfaces(ctx,p.cock,p.frizzen),phase=p.phase,row=rows?{t:r(t,4),phase}:null;
   for(const side of ['right','left']){const h=pose[side],a=armAt(ctx,side,h.Sv,h.W,h.Q),o=res[side],margin=.64-a.reach;
    if(margin<o.minReachMarginM){o.minReachMarginM=margin;o.reachAt={t:r(t,4),phase};}if(margin<=1e-5)res.stretched++;
    if(a.bend>o.maxBendDeg){o.maxBendDeg=a.bend;o.bendAt={t:r(t,4),phase};}if(a.bend>45)res.bendOver45.push({side,t:r(t,4),phase,bend:r(a.bend,1)});
    if(Math.abs(a.twist)>o.maxTwistDeg){o.maxTwistDeg=Math.abs(a.twist);o.twistAt={t:r(t,4),phase};}o.twistRangeDeg=[Math.min(o.twistRangeDeg[0],a.twist),Math.max(o.twistRangeDeg[1],a.twist)];
    if(prevTw[side]!==undefined){const step=Math.abs(a.twist-prevTw[side]);if(step>o.maxTwistStepDeg){o.maxTwistStepDeg=step;o.twistStepAt={t:r(t,4),phase};}if(step>90)res.twistWraps.push({side,t:r(t,4),from:r(prevTw[side],1),to:r(a.twist,1)});}prevTw[side]=a.twist;
    const Sc=camOf(pose.pose,h.Sv);if(inView(Sc,0))res.shouldersInView++;if(row)row[side]={tw:r(a.twist,0),bend:r(a.bend,0),reach:r(a.reach,3),siv:inView(Sc,0)};
    // hand and arm against the musket at this lock and ramrod state
    const q=fingerQ(ctx,side,p),pts=handSamples(ctx,side,q).map(s=>({...s,p:place(ctx.H[side],h.W,h.Q,s.p)})),c=clearance(ctx,pts,surf,state);
    if(c.gap<res.worstHand.gap)res.worstHand={gap:c.gap,side,part:c.part,at:c.at,t:r(t,4),phase};if(row){row[side].hand=r(c.gap*1000,1);row[side].handPart=c.part+"/"+c.at;}
    for(const s of pts){const d=len(camOf(pose.pose,s.p))-s.r;if(d<res.camera.minHandM){res.camera.minHandM=d;res.camera.handAt={side,t:r(t,4),phase};}}
    const ap=armPoints(h.Sv,a.elbow,h.W),ca=clearance(ctx,ap.map(x=>({...x,part:x.part})),surf,state);if(ca.gap<res.worstArm.gap)res.worstArm={gap:ca.gap,side,part:ca.part,at:ca.at,t:r(t,4),phase};if(row){row[side].arm=r(ca.gap*1000,1);row[side].armPart=ca.part+"/"+ca.at;}}
   // cues
   const R=pose.right;let cuePts=[];
   if(p.ramrodCue>.5){const c=cueOf(rel.ram,R.W,R.Q);// Rod points inside the bore (within the 9 mm bore radius, behind the muzzle face) are hidden by the barrel; the v3
    // barrel models only a 45 mm blind visual cavity, so they are counted, not measured against the barrel solid.
    const all=rodPoints(c.O,c.R),inBore=x=>x.p[0]<MUZZLE[0]&&Math.hypot(x.p[1],x.p[2])<.009-x.r;cuePts=all.filter(x=>!inBore(x)).map(x=>({...x,part:'rammer cue'}));res.rodPointsInBore=(res.rodPointsInBore??0)+all.filter(inBore).length;
    // the bore: points inside the barrel cavity are outside the barrel solid, so the rod in the bore is measured as it is
   }
   if(p.cartridge>.5){const c=cueOf(rel.cart,R.W,R.Q);cuePts=cuePts.concat(cartPoints(c.O,c.R).map(x=>({...x,part:'cartridge'})));}
   if(cuePts.length){const cc=clearance(ctx,cuePts,surf,state,{skip:['Ramrod']});if(cc.gap<res.worstCue.gap)res.worstCue={gap:cc.gap,part:cc.part,at:cc.at,t:r(t,4),phase};if(row){row.cue=r(cc.gap*1000,1);row.cuePart=cc.part+"/"+cc.at;}
    for(const s of cuePts){const d=len(camOf(pose.pose,s.p))-s.r;if(d<res.camera.minCueM){res.camera.minCueM=d;res.camera.cueAt={t:r(t,4),phase,part:s.part};}}}
   // camera against the musket
   const cg=gunOf(pose.pose,[0,0,0]);let gmin=Infinity,inside=false;for(const s of ctx.S.penetration){const d=D.signedM(cg,s);gmin=Math.min(gmin,d.gap);if(d.gap<0)inside=true;}
   if(gmin<res.camera.minGunM){res.camera.minGunM=gmin;res.camera.gunAt={t:r(t,4),phase};}if(inside)res.camera.cameraInsideGun++;if(row)res.rows.push(row);}
  for(const side of ['right','left']){const o=res[side];o.minReachMarginM=r(o.minReachMarginM,4);o.maxBendDeg=r(o.maxBendDeg,1);o.maxTwistDeg=r(o.maxTwistDeg,1);o.maxTwistStepDeg=r(o.maxTwistStepDeg,1);o.twistRangeDeg=o.twistRangeDeg.map(x=>r(x,1));}
  for(const k of ['worstHand','worstArm','worstCue'])if(Number.isFinite(res[k].gap))res[k].gapMM=r(res[k].gap*1000,2);else res[k]=null;
  for(const k of ['minHandM','minCueM','minGunM'])res.camera[k]=Number.isFinite(res.camera[k])?r(res.camera[k],4):null;
  out.clips[name]=res;}
 // swaps: where ramrodCue crosses 0.5 (bisection), the cue against the drawn part
 if(motion.clips.Reload&&(!clips||clips.includes('Reload'))){const s=t=>sampleTimeline(motion,'Reload',t);const keys=motion.clips.Reload.keys;
  for(let i=0;i+1<keys.length;i++){const a=keys[i],b=keys[i+1],ia=CHANNELS.indexOf('ramrodCue');if((a.v[ia]-.5)*(b.v[ia]-.5)>=0)continue;let lo=a.t,hi=b.t;for(let k=0;k<50;k++){const m=(lo+hi)/2;if((s(m).ramrodCue-.5)*(a.v[ia]-.5)>0)lo=m;else hi=m;}
   const rows=[];for(const t of [a.t,(lo+hi)/2,b.t]){const p=s(t),sh=shiftObj(sampleShift(motion.shoulderShift.clips.Reload.keys,t)),pose=poseOf(ctx,p,sh),c=cueOf(rel.ram,pose.right.W,pose.right.Q),O=drawO(p.ramrod*full);
    rows.push({t:r(t,6),ramrod:r(p.ramrod,6),ramrodCue:r(p.ramrodCue,4),positionErrorMM:r(len(sub(c.O,O))*1000,4),angleErrorDeg:r(rotDeg(c.R,I3),4)});}
   out.swaps.push({between:[a.phase,b.phase],crossing:rows[1],window:rows,maxPositionErrorMM:Math.max(...rows.map(x=>x.positionErrorMM)),maxAngleErrorDeg:Math.max(...rows.map(x=>x.angleErrorDeg))});}
  // ram: every 60 Hz sample (and key) with the cue shown and its head below the muzzle face
  let worstAx=0,worstOff=0,count=0,deepest=null;const n=Math.ceil(motion.clips.Reload.duration*hz);
  for(let i=0;i<=n;i++){const t=i/n,p=s(t);if(p.ramrodCue<=.5)continue;const sh=shiftObj(sampleShift(motion.shoulderShift.clips.Reload.keys,t)),pose=poseOf(ctx,p,sh),c=cueOf(rel.ram,pose.right.W,pose.right.Q);if(c.O[0]>MUZZLE[0]-1e-4)continue;
   count++;const ax=angDeg(P.matV(c.R,[1,0,0]),[-1,0,0]),off=Math.hypot(c.O[1],c.O[2]);worstAx=Math.max(worstAx,ax);worstOff=Math.max(worstOff,off);if(!deepest||c.O[0]<deepest.x)deepest={x:r(c.O[0],4),depthM:r(MUZZLE[0]-c.O[0],4),t:r(t,4)};}
  out.ram={samplesInBore:count,maxAxisAngleDeg:r(worstAx,4),maxHeadOffBoreLineMM:r(worstOff*1000,4),deepest,targets:{axisDeg:2,lineMM:2}};}
 return out;}
