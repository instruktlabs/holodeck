// No.4 bolt profile: game-owned motion and rig, a hands program derived from the accepted rifle v10 hands,
// and a fitting-only assembly (hands + saved No.4 + charger cue) for review renders.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),text=async p=>(await readFile(new URL(p,root),'utf8')).replace(/^﻿/,'');
const channels=['lift','roll','yaw','pitch','forward','side','magY','handX','handY','handZ','handPitch','handYaw','handRoll','open','thumb','rightIndex','rightHandX','rightHandY','rightHandZ','rightHandPitch','rightHandYaw','rightHandRoll','rightOpen','rightThumb','boltLift','boltSlide','cartridge'];
const key=(t,phase,p={})=>({t,phase,v:channels.map(c=>{const v=p[c]??0;return Math.round(v*1e6)/1e6;})}),ready=()=>key(0,'ready'),end=()=>key(1,'ready');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
// Saved No.4 contracts (authoring/firearm-bolt-v1-pins.json): gun frame metres, +X muzzle, +Y up, +Z right.
const gun={handRight:[-.205,.047,.026],handLeft:[.24,.071,-.028],boltPivot:[-.14,.11,0],knob:[-.156,.073,.056],sightRear:[-.116,.151,0],sightFront:[.578,.152,0]};
// The rifle v10 hands hold the same wrist-to-anchor offsets on the No.4 anchors.
const rifle={wristRight:[-.21,.042,.04],anchorRight:[-.147,.089,.019],wristLeft:[.165,.073,.032],anchorLeft:[.215,.106,-.02]};
const round=a=>a.map(v=>Math.round(v*1e4)/1e4);
const wristRight=round(add(gun.handRight,sub(rifle.wristRight,rifle.anchorRight))),wristLeft=round(add(gun.handLeft,sub(rifle.wristLeft,rifle.anchorLeft)));
const lift=-50*Math.PI/180,slide=-.07;
// Handle knob after the bolt's own lift (about +X through the pivot) and draw.
const knobAt=(l,s)=>{const r=sub(gun.knob,gun.boltPivot),c=Math.cos(l),n=Math.sin(l);return add(gun.boltPivot,[r[0]+s,r[1]*c-r[2]*n,r[1]*n+r[2]*c]);};
// Thumb/index pinch relative to the right wrist with no extra hand rotation (rifle v10 hand geometry).
const pinch=[.10,.06,-.019],grasp=k=>round(sub(sub(k,pinch),wristRight));
const handle={rest:grasp(knobAt(0,0)),lifted:grasp(knobAt(lift,0)),drawn:grasp(knobAt(lift,slide))};
// Charger: the thumb pad rests on the top round just ahead of the spine; the fingers curl behind the charger, clear of the rounds.
// The hand turns thumb-down over the guide (wrist bend kept within ~40 deg of the stock-wrist rest), and the cue is fixed to the wrist
// so that at this hand rotation it stands upright in the guide with the rounds pointing to the muzzle.
const charger={seated:[-.016,.19,0],press:.03};
const deg=d=>d*Math.PI/180,Rx=t=>[[1,0,0],[0,Math.cos(t),-Math.sin(t)],[0,Math.sin(t),Math.cos(t)]],Ry=t=>[[Math.cos(t),0,Math.sin(t)],[0,1,0],[-Math.sin(t),0,Math.cos(t)]],Rz=t=>[[Math.cos(t),-Math.sin(t),0],[Math.sin(t),Math.cos(t),0],[0,0,1]];
const mm=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j])),mv=(A,v)=>A.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]),tr=A=>[0,1,2].map(i=>[0,1,2].map(j=>A[j][i]));
const euler=([x,y,z])=>mm(mm(Rx(x),Ry(y)),Rz(z)),toEuler=m=>[Math.atan2(-m[1][2],m[2][2]),Math.asin(Math.max(-1,Math.min(1,m[0][2]))),Math.atan2(-m[0][1],m[0][0])];
const thumbTip=[.072,.089,-.0182];// right thumb tip relative to the wrist joint (hands program thumb points)
const pressRot=[35,50,-105].map(deg),pressR=euler(pressRot),thumbOnRound=[.013,.007,0];
const seat=round(sub(sub(add(charger.seated,thumbOnRound),mv(pressR,thumbTip)),wristRight)),press=round(add(seat,[0,-charger.press,0]));
const cueCenter=round(sub(thumbTip,mv(tr(pressR),thumbOnRound))),cueRotation=toEuler(tr(pressR)).map(v=>Math.round(v*1e6)/1e6);
const hold={rightOpen:.2,rightThumb:.6},r=(d,extra={})=>({rightHandX:d[0],rightHandY:d[1],rightHandZ:d[2],...hold,...extra});
const rot=(e,extra={})=>({rightHandPitch:e[0],rightHandYaw:e[1],rightHandRoll:e[2],...extra});
const cant={roll:-.10,lift:.015};
// Charger pouch at the right hip (wrist offset), and the flick-away rotation after the strip.
const pouch=[-.02,-.15,.12],raise=[.148,.15,.163],pouchRot=[35,20,-95].map(deg),tossRot=[20,35,-75].map(deg);
const motion={version:1,id:'bolt-no4-motion-v1',profile:'boltNo4',sampleRate:60,units:'metres and radians; normalized key times',channels,
 reloadCommitPhase:.6,
 cartridge:{delivery:'separate saved original charger cue (authoring/bolt-charger-cue-v1.kiln.js)',channel:'cartridge',meaning:'visibility fraction; no ammunition-state authority',rightWristRelativeCenter:cueCenter,rightWristRelativeRotation:cueRotation,sourceAxis:'+X rounds, -Y stack',length:.078,assetPins:'game/bolt-no4-asset-pins-v1.json',visibility:'Show only when channel > 0.5; parent owns hide on cancel/complete'},
 boltAction:{pivot:gun.boltPivot,liftAxis:[1,0,0],liftRadians:lift,slideAxis:[1,0,0],slideMetres:slide,knob:gun.knob,chargerGuide:charger.seated,scope:'Presentation travel on the saved pivots; not a calibrated operating cycle.'},
 clips:{
  Ready:{duration:1,loop:true,keys:[ready(),end()]},
  Inspect:{duration:3.6,loop:false,keys:[ready(),key(.22,'left view',{lift:.035,yaw:.45,roll:.10,pitch:.02}),key(.42,'left hold',{lift:.035,yaw:.45,roll:.10,pitch:.02}),key(.64,'right view',{lift:.04,yaw:-.38,roll:-.12,pitch:-.02}),key(.78,'right hold',{lift:.04,yaw:-.38,roll:-.12,pitch:-.02}),end()]},
  Fire:{duration:1.25,loop:false,keys:[ready(),key(.05,'press and recoil',{pitch:.05,forward:-.03,rightIndex:1}),key(.14,'settle',{pitch:.015,forward:-.008,rightIndex:.2}),
   key(.26,'grasp handle',r(handle.rest)),key(.36,'lift handle',r(handle.lifted,{boltLift:lift})),key(.50,'draw bolt',r(handle.drawn,{boltLift:lift,boltSlide:slide})),key(.56,'bolt back',r(handle.drawn,{boltLift:lift,boltSlide:slide})),
   key(.70,'drive bolt',r(handle.lifted,{boltLift:lift})),key(.80,'turn down',r(handle.rest)),key(.92,'return to grip',{rightOpen:.1}),end()]},
  Reload:{duration:3,loop:false,commitPhase:.6,repeat:'game-state controlled charger cycles',keys:[ready(),
   key(.07,'grasp handle',r(handle.rest)),key(.13,'lift handle',r(handle.lifted,{boltLift:lift})),key(.19,'draw bolt',r(handle.drawn,{boltLift:lift,boltSlide:slide,...cant})),
   key(.27,'reach pouch',r(pouch,rot(pouchRot,{boltLift:lift,boltSlide:slide,rightOpen:.45,rightThumb:.2,...cant}))),
   key(.31,'take charger',r(add(pouch,[0,.012,0]),rot(pressRot,{boltLift:lift,boltSlide:slide,rightOpen:-1,rightThumb:.4,cartridge:1,...cant}))),
   key(.37,'raise charger',r(raise,rot(add(pressRot,[deg(10),0,deg(10)]),{boltLift:lift,boltSlide:slide,rightOpen:-.5,rightThumb:.4,cartridge:1,...cant}))),
   key(.45,'present charger',r(add(seat,[0,.045,.03]),rot(add(pressRot,[deg(8),0,0]),{boltLift:lift,boltSlide:slide,rightOpen:-.4,rightThumb:.4,cartridge:1,...cant}))),
   key(.52,'seat charger',r(seat,rot(pressRot,{boltLift:lift,boltSlide:slide,rightOpen:-.7,rightThumb:.4,cartridge:1,...cant}))),
   key(.60,'strip rounds (commit)',r(press,rot(pressRot,{boltLift:lift,boltSlide:slide,rightOpen:-1,rightThumb:.6,cartridge:1,...cant}))),
   key(.655,'pull charger',r(add(seat,[0,.03,.015]),rot(pressRot,{boltLift:lift,boltSlide:slide,rightOpen:-1,rightThumb:.4,cartridge:1,...cant}))),
   key(.70,'discard charger',r(add(seat,[-.02,.05,.10]),rot(tossRot,{boltLift:lift,boltSlide:slide,rightOpen:-.6,rightThumb:.4,cartridge:1,...cant}))),
   key(.725,'released',r(add(seat,[-.035,.03,.15]),rot(tossRot,{boltLift:lift,boltSlide:slide,rightOpen:.2,rightThumb:.4,...cant}))),
   key(.79,'back to handle',r(handle.drawn,{boltLift:lift,boltSlide:slide,...cant})),key(.86,'drive bolt',r(handle.lifted,{boltLift:lift})),key(.92,'turn down',r(handle.rest)),end()]}},
 cameraPlacementAuthority:'game/bolt-no4-view-v1.json (parent-owned)'};
const rig={version:1,profile:'boltNo4',units:'metres',forward:'+X',up:'+Y',right:'+Z',bones:41,maxReachMargin:.00001,twistFractions:[.4,.8],
 arms:{right:{shoulder:[-.47,-.025,.2],wrist:wristRight,pole:[-.39,-.35,.36],upperLength:.33,forearmLength:.31},left:{shoulder:[-.37,-.02,-.2],wrist:wristLeft,pole:[-.26,-.335,-.34],upperLength:.33,forearmLength:.31}},
 restHandRotations:{right:[0,0,0],left:[-Math.PI/2,0,0]},poseFields:{right:['rightHandX','rightHandY','rightHandZ'],left:['handX','handY','handZ']}};
const view={schemaVersion:1,space:'camera-local metres, +X right, +Y up, -Z forward',hipPosition:[.09,-.2,-.58],aimPosition:[0,-round([(gun.sightRear[1]+gun.sightFront[1])/2])[0],-.58],assetForwardRotationY:Math.PI/2,recoilBack:.04,recoilPitch:.08,scope:'Prototype first-person framing; sight alignment is checked against the delivered sight anchors.'};
// Contract checks: cue at the pressed guide at the commit, visibility bounds, bolt drawn through the strip, arm reach, Fire pinch on the knob.
{const sample=(name,t)=>{const c=motion.clips[name];let i=0;while(i<c.keys.length-2&&t>c.keys[i+1].t)i++;const a=c.keys[i],b=c.keys[i+1],x=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),u=x*x*x*(x*(x*6-15)+10);return Object.fromEntries(channels.map((k,j)=>[k,a.v[j]+(b.v[j]-a.v[j])*u]));};
 const wristAt=p=>({w:add(wristRight,[p.rightHandX,p.rightHandY,p.rightHandZ]),R:euler([p.rightHandPitch,p.rightHandYaw,p.rightHandRoll])});
 const at=(name,t)=>{const p=sample(name,t),{w,R}=wristAt(p);return {p,w,R,cue:add(w,mv(R,motion.cartridge.rightWristRelativeCenter))};};
 const c=at('Reload',.6),target=[charger.seated[0],charger.seated[1]-charger.press,charger.seated[2]],cueError=Math.hypot(...sub(c.cue,target));
 assert(cueError<.025,'cue at commit '+c.cue);assert(c.p.cartridge>.5&&sample('Ready',0).cartridge<=.5&&sample('Reload',1).cartridge<=.5);
 const keys=motion.clips.Reload.keys,t0=keys.find(k=>k.phase==='draw bolt').t,t1=keys.find(k=>k.phase==='back to handle').t;
 for(let t=t0;t<=t1+1e-9;t+=.005){const p=sample('Reload',t);assert(Math.abs(p.boltSlide-slide)<1e-6&&Math.abs(p.boltLift-lift)<1e-6,'bolt drawn at '+t);}
 let reach=0;for(const name of Object.keys(motion.clips))for(let t=0;t<=1;t+=.005){const {w}=wristAt(sample(name,t));reach=Math.max(reach,Math.hypot(...sub(w,rig.arms.right.shoulder)));}
 assert(reach<rig.arms.right.upperLength+rig.arms.right.forearmLength-.01,'right arm reach '+reach);
 const fireDraw=motion.clips.Fire.keys.find(k=>k.phase==='draw bolt').t,f=at('Fire',fireDraw),knobError=Math.hypot(...sub(add(f.w,mv(f.R,pinch)),knobAt(lift,slide)));
 assert(knobError<.005,'Fire pinch on knob');
 console.log('checks',JSON.stringify({cueAtCommit:round(c.cue),cueErrorMm:+(cueError*1000).toFixed(1),maxRightReach:+reach.toFixed(3),fireKnobErrorMm:+(knobError*1000).toFixed(1)}));}
await writeFile(new URL('game/bolt-no4-motion-v1.json',root),JSON.stringify(motion,null,2)+'\n');
await writeFile(new URL('game/bolt-no4-arm-rig-v1.json',root),JSON.stringify(rig,null,2)+'\n');
await writeFile(new URL('game/bolt-no4-view-v1.json',root),JSON.stringify(view,null,2)+'\n');
if(process.argv.includes('--metadata-only')){console.log('bolt metadata written',JSON.stringify({wristRight,wristLeft,handle,seat,press}));process.exit(0);}
// Hands: the accepted rifle v10 hands program with the bolt motion and rig embedded.
const base=await text('authoring/rifle-hands-v1-final2-exact.kiln.js');
const swap=(s,a,b)=>{assert(s.includes(a),'Missing anchor '+String(a).slice(0,80));return s.replace(a,b);};
let hands=swap(base,base.slice(0,base.indexOf('function sampleTimeline')),'const motion='+JSON.stringify(motion)+';\n');
hands=swap(hands,hands.slice(hands.indexOf('const rig='),hands.indexOf('// Extract only axial')),'const rig='+JSON.stringify(rig)+';\n');
hands=swap(hands,"name:'Rifle gloves - stock wrist and foreend support v1'","name:'No.4 gloves - stock wrist, bolt and charger v1'");
// Adult glove proportions: the pistol-derived wrap ran ~16 cm (right) and ~11 cm (left) past the knuckles.
// Keep the same contact path but end each finger at a natural knuckle-to-tip length (metres).
const fingerLengths={right:[0,.084,.080,.066],left:[.078,.084,.080,.066]};
hands=swap(hands,'const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),joint=',
 'const full=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),keep=thumb?0:fingerLengths[name][finger],cut=keep?Math.min(1,keep/full.getLength()):1,curve=cut<1?new THREE.CatmullRomCurve3([0,.2,.4,.6,.8,1].map(u=>full.getPointAt(u*cut))):full,joint=');
hands=swap(hands,'if(thumb)points=right?[[-.083,-.023,.032],[-.064,.004,.025],[-.039,.010,.0225],[-.018,.010,.0213]]','if(thumb)points=right?[[-.083,-.023,.032],[-.064,.004,.025],[-.046,.0085,.0232],[-.033,.0100,.0218]]');
// A closing fist (negative rightOpen) curls the index with the other fingers so the hand reads as one grip and the webs do not tear.
hands=swap(hands,'if(finger===0)v=[0,p.rightIndex*[16,12,2][segment],-p.rightIndex*[18,8,2][segment]];','if(finger===0)v=[0,p.rightIndex*[16,12,2][segment]+Math.max(0,-p.rightOpen)*[18,50,40][segment],-p.rightIndex*[18,8,2][segment]];');
hands=swap(hands,'else v=[0,-p.rightOpen*[25,35,20][segment],0];','else v=[0,p.rightOpen>0?-p.rightOpen*[25,35,20][segment]:-p.rightOpen*[18,50,40][segment],0];');
hands=swap(hands,'async function build(){','const fingerLengths='+JSON.stringify(fingerLengths)+';\nasync function build(){');
await writeFile(new URL('authoring/bolt-hands-v1.kiln.js',root),hands);
// Fitting-only assembly: the saved No.4 bolt pivots and charger cue follow the same motion samples.
const gunSource=await text('authoring/firearm-bolt-v1-final-qualified.kiln.js'),cue=await text('authoring/bolt-charger-cue-v1.kiln.js');
let code=swap(hands,'async function build(){','async function buildHands(){');code=swap(code,"name:'No.4 gloves - stock wrist, bolt and charger v1'","name:'No.4 hands v1 fitting evidence only'");
code=swap(code,'return createClip(name,-1,tracks,{loop:clip.loop});',"tracks.push(rotationTrack('Joint_BoltLift',samples.map(({time,p})=>({time,rotation:[p.boltLift*180/Math.PI,0,0]})),'LINEAR'));tracks.push(positionTrack('Joint_BoltSlide',samples.map(({time,p})=>({time,position:["+gun.boltPivot[0]+"+p.boltSlide,"+gun.boltPivot[1]+","+gun.boltPivot[2]+"]})),'LINEAR'));tracks.push(scaleTrack('BoltChargerCue',samples.map(({time,p})=>({time,scale:[1,1,1].map(()=>p.cartridge>.5?1:.001)})),'LINEAR'));return createClip(name,-1,tracks,{loop:clip.loop});");
code+=`\nasync function buildGun(){${gunSource}\nreturn build();}\nasync function buildCue(){${cue}\nreturn build();}\nasync function build(){const root=createRoot('BoltHandsFittingOnly'),hands=await buildHands(),gun=await buildGun(),cue=await buildCue();cue.name='BoltChargerCue';cue.position.fromArray(motion.cartridge.rightWristRelativeCenter);cue.rotation.set(...motion.cartridge.rightWristRelativeRotation);cue.scale.setScalar(.001);hands.getObjectByName('Joint_right_right_wrist').add(cue);root.add(hands,gun);return root;}\n`;
await writeFile(new URL('authoring/bolt-hands-v1-assembly.kiln.js',root),code);
console.log(JSON.stringify({wristRight,wristLeft,handle,seat,press}));
