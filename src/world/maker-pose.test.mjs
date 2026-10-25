import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three/webgpu';
import {createMakerRig} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';
import {createInhabitant,stepInhabitant} from './inhabitant.mjs';

const actor=(overrides={})=>({position:[2,1,3],yaw:0,speed:0,velocity:[0,0,0],camera:'first',gaitPhase:0,mode:'grounded',grounded:true,supportHeight:1,config:{walkSpeed:2.2},...overrides});
const rig=()=>createMakerRig();
const flat=(height=0)=>({sample:()=>({height,normal:[0,1,0],slope:0,inBounds:true})});
const walker=terrain=>createInhabitant({terrain,scene:{runtime:{spawn:[0,1.72,0],look:[0,0],possession:{camera:'third'}}}});
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const world=(model,name,point=[0,0,0])=>{model.root.updateMatrixWorld(true);return model.joints[name].localToWorld(new Vector3(...point));};
const ankle=(model,side)=>world(model,side+'Foot');
const heel=(model,side)=>world(model,side+'Foot',[0,-.09,.05]);

test('walking keeps a support foot, jogging alternates single support with brief flight, and knees stay continuous',()=>{
 for(const [forward,flight] of [[.55,0],[1,.16]]){
  const terrain=flat(),a=walker(terrain),model=rig(),m=createMakerMotion();
  let previous=null,maxAngle=0,airborneFrames=0,longestFlight=0;
  for(let i=0;i<900;i++){
   stepInhabitant(a,Math.floor(i/150)%2?{}:{forward,yaw:i<450?0:i/60*.8},1/60,{terrain});updateMakerPose(model,a,terrain,m,1/60);
   const both=m.feet.left.swing&&m.feet.right.swing;airborneFrames=both?airborneFrames+1:0;longestFlight=Math.max(longestFlight,airborneFrames/60);
   const now={};for(const side of ['left','right']){const knee=model.joints[side+'Knee'].quaternion.clone();if(previous)maxAngle=Math.max(maxAngle,knee.angleTo(previous[side]));now[side]=knee;}previous=now;
  }
  assert.ok(longestFlight<=flight+1e-9,`${forward}: flight lasted ${longestFlight}s`);
  // Early running swing folds the knee at up to ~20 rad/s; a contact reset snaps far faster.
  assert.ok(maxAngle<.35,`${forward}: maximum knee rotation/frame ${maxAngle}`);
 }
});

test('full walking cycles, starts, turns and stops do not pop feet or pelvis between frames',()=>{
 const terrain=flat(),a=walker(terrain),model=rig(),m=createMakerMotion();
 let previous=null,previousPelvis=0,maxFoot=0,maxPelvis=0;
 for(let i=0;i<720;i++){
  const input=i<60?{}:i<240?{forward:1}:i<360?{strafe:1}:i<480?{forward:-1}:i<600?{forward:1,sprint:true}:{};
  stepInhabitant(a,input,1/60,{terrain});updateMakerPose(model,a,terrain,m,1/60);
  const feet=[ankle(model,'left'),ankle(model,'right')];
  // A swing foot peaks near twice body speed plus its lift, and a stop's last step is quick;
  // a contact reset jumps far beyond either.
  if(previous){for(let side=0;side<2;side++)maxFoot=Math.max(maxFoot,feet[side].distanceTo(previous[side])/((3.2*a.speed+4.5)/60));maxPelvis=Math.max(maxPelvis,Math.abs(model.body.position.y-previousPelvis));}
  previous=feet;previousPelvis=model.body.position.y;
 }
 assert.ok(maxFoot<1,`ankle delta reached ${maxFoot} of its speed bound`);
 // Sprinting out of a 180 degree pivot dips the pelvis at up to ~1 m/s; a reset jumps it.
 assert.ok(maxPelvis<.02,`maximum pelvis delta ${maxPelvis}`);
 for(const side of ['left','right'])assert.ok(Math.abs(model.joints[side+'Knee'].rotation.x)>.1,'standing knee retains a small bend');
});

test('a stop mid-stride settles both feet under the hips, one step at a time',()=>{
 const terrain=flat(),a=walker(terrain),model=rig(),m=createMakerMotion();
 for(let i=0;i<150;i++){stepInhabitant(a,{forward:1},1/60,{terrain});updateMakerPose(model,a,terrain,m,1/60);}
 let simultaneous=0;
 for(let i=0;i<120;i++){stepInhabitant(a,{},1/60,{terrain});updateMakerPose(model,a,terrain,m,1/60);if(m.feet.left.swing&&m.feet.right.swing&&m.feet.left.timed&&m.feet.right.timed)simultaneous++;}
 assert.equal(simultaneous,0,'settling steps take turns');
 for(const side of ['left','right']){
  const foot=m.feet[side];assert.ok(foot.planted&&!foot.swing,`${side} foot settles`);
  const local=ankle(model,side).sub(new Vector3(...a.position)).applyAxisAngle(new Vector3(0,1,0),-m.facingYaw);
  assert.ok(Math.abs(local.x-(side==='left'?-.11:.11))<.08&&Math.abs(local.z)<.12,`${side} foot rests beside the hip: ${local.toArray()}`);
 }
});

test('third-person body faces actual forward, backward and strafe travel without changing controller yaw',()=>{
 for(const [velocity,wanted] of [[[0,0,-2.2],0],[[0,0,2.2],Math.PI],[[2.2,0,0],-Math.PI/2],[[-2.2,0,0],Math.PI/2]]){
  const model=rig(),a=actor({camera:'third',velocity,speed:2.2,yaw:.4}),m=createMakerMotion();
  for(let i=0;i<120;i++)updateMakerPose(model,a,null,m,1/60);
  assert.ok(Math.abs(angleDifference(model.root.rotation.y,wanted))<.002);
  assert.equal(a.yaw,.4);assert.deepEqual(a.velocity,velocity);
  const facing=model.root.rotation.y;a.speed=0;a.velocity=[0,0,0];a.yaw=-2;updateMakerPose(model,a,null,m,.1);
  assert.equal(model.root.rotation.y,facing,'idle third-person facing remains where travel left it');
 }
});

test('visual turn takes the short route across pi and first-person body immediately follows the camera',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',yaw:Math.PI-.02});
 updateMakerPose(model,a,null,m,.016);a.speed=2.2;a.velocity=[Math.sin(.02)*2.2,0,Math.cos(.02)*2.2];
 updateMakerPose(model,a,null,m,.016);
 assert.ok(angleDifference(model.root.rotation.y,a.yaw)>0&&angleDifference(model.root.rotation.y,a.yaw)<.04);
 a.camera='first';a.yaw=-1.1;updateMakerPose(model,a,null,m,.016);assert.equal(model.root.rotation.y,-1.1);
 a.yaw=1.2;updateMakerPose(model,a,null,m,.016);assert.equal(model.root.rotation.y,1.2);
});

test('velocity and turning produce bounded lean which settles to idle breathing at rest',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',speed:4.5,velocity:[0,0,-4.5]});
 for(let i=0;i<40;i++)updateMakerPose(model,a,null,m,.016);
 assert.ok(model.body.rotation.x<-.04&&model.body.rotation.x>-.2);
 a.velocity=[4.5,0,0];updateMakerPose(model,a,null,m,.016);
 assert.ok(Math.abs(model.body.rotation.z)>.001&&Math.abs(model.body.rotation.z)<.2);
 a.velocity=[0,0,0];a.speed=0;for(let i=0;i<100;i++)updateMakerPose(model,a,null,m,.016);
 assert.ok(Math.abs(m.leanForward.value)<.001&&Math.abs(m.leanSide.value)<.001,'travel lean releases');
 assert.ok(Math.abs(model.body.rotation.x)<.04&&Math.abs(model.body.rotation.z)<.04,'only breathing and weight shift remain');
});

test('stance foot stays planted in world space through bounded translation and body turning',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',speed:2.2,velocity:[0,0,-2.2],gaitPhase:.1*Math.PI*2}),terrain=flat(1);
 for(let i=0;i<30;i++)updateMakerPose(model,a,terrain,m,.016);
 const anchor=[...m.feet.left.anchor],start=heel(model,'left');
 for(let i=0;i<5;i++){a.position[2]-=.04;a.gaitPhase+=.04*Math.PI*2/1.5;updateMakerPose(model,a,terrain,m,.04);}
 // The sole rolls about its heel at touchdown, so the heel contact is what stays put.
 let end=heel(model,'left');assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<.004,'stance heel must not slide with the root');
 assert.deepEqual(m.feet.left.anchor,anchor);
 a.velocity=[.7,0,-2.1];a.position[0]+=.015;updateMakerPose(model,a,terrain,m,.04);end=heel(model,'left');
 assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<.006,'turning must solve lateral contact too');
 const at=ankle(model,'left');assert.ok(at.y>=1.088&&at.y<1.14,'trailing heel may lift while the toe rolls off');
});

test('slope, unsupported edge, airborne and swim transitions retain finite bounded leg poses',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',speed:2.2,velocity:[1.3,0,-1.8]}),normal=new Vector3(-.16,1,-.09).normalize().toArray();
 const terrain={sample:(x,z)=>({height:1+.16*(x-2)+.09*(z-3),normal,inBounds:x<3})};
 for(let i=0;i<100;i++){
  a.position[0]+=.015;a.position[2]-=.02;a.position[1]=terrain.sample(a.position[0],a.position[2]).height;a.supportHeight=a.position[1];a.gaitPhase=(a.gaitPhase+.025*Math.PI*2/1.5)%(Math.PI*2);
  updateMakerPose(model,a,terrain,m,.016);model.root.updateMatrixWorld(true);
  model.root.traverse(part=>assert.ok([...part.position,...part.quaternion].every(Number.isFinite)));
  for(const side of ['left','right'])assert.ok(ankle(model,side).distanceTo(new Vector3(...a.position))<1.3);
 }
 for(const mode of ['airborne','swimming','grounded']){a.mode=mode;a.grounded=mode==='grounded';for(let i=0;i<20;i++)updateMakerPose(model,a,terrain,m,.016);model.root.traverse(part=>assert.ok([...part.position,...part.quaternion].every(Number.isFinite)));}
});

test('large first-person turns and a new actor release old foot contacts',()=>{
 const model=rig(),m=createMakerMotion(),a=actor();updateMakerPose(model,a,null,m,.1);
 a.yaw=Math.PI;for(let i=0;i<8;i++)updateMakerPose(model,a,null,m,.016);
 assert.ok(ankle(model,'left').x>a.position[0],'feet follow the turned stance instead of crossing through each other');
 const replacement=actor({position:[20,4,-8],supportHeight:4});updateMakerPose(model,replacement,null,m,.1);
 assert.ok(ankle(model,'left').distanceTo(new Vector3(...replacement.position))<.3);
 replacement.mode='airborne';replacement.grounded=false;updateMakerPose(model,replacement,null,m,1/120);
 assert.equal(m.feet.left.planted,false);assert.equal(m.feet.right.planted,false);
});

test('feet stand on walkable collider tops above the terrain',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({position:[2,1.6,3],supportHeight:1.6}),walkable=(x,z,maxTop)=>maxTop>=1.6?{height:1.6,id:'deck'}:null;
 updateMakerPose(model,a,flat(0),m,.1,walkable);
 for(const side of ['left','right'])assert.ok(Math.abs(ankle(model,side).y-1.69)<.003,`${side} ankle stands on the deck`);
});

test('landing sinks the pelvis in proportion to the fall, then recovers',()=>{
 const drops=[];
 for(const impact of [-3,-9]){
  const model=rig(),m=createMakerMotion(),a=actor({camera:'third'}),terrain=flat(1);
  for(let i=0;i<30;i++)updateMakerPose(model,a,terrain,m,1/60);const rest=model.body.position.y;
  a.mode='airborne';a.grounded=false;a.verticalVelocity=impact;for(let i=0;i<20;i++)updateMakerPose(model,a,terrain,m,1/60);
  a.mode='grounded';a.grounded=true;a.verticalVelocity=0;let lowest=Infinity;
  for(let i=0;i<60;i++){updateMakerPose(model,a,terrain,m,1/60);lowest=Math.min(lowest,model.body.position.y);}
  drops.push(rest-lowest);assert.ok(Math.abs(model.body.position.y-rest)<.01,'the landing recovers within a second');
  for(const side of ['left','right'])assert.ok(Math.abs(ankle(model,side).y-1.09)<.02,'both feet touch down');
 }
 assert.ok(drops[0]>.01&&drops[1]>drops[0]&&drops[1]<=.25,`landing drops ${drops}`);
});

test('the front crawl alternates strokes half a cycle apart with body roll and a flutter kick',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',mode:'swimming',grounded:false,speed:1.8,velocity:[0,0,-1.8],surfaceHeight:2,supportHeight:-3,position:[0,1,0],config:{walkSpeed:2.6,swimSpeed:1.8}});
 for(let i=0;i<120;i++)updateMakerPose(model,a,null,m,1/60);
 let rolls=[],gaps=[],kicks=[];
 for(let i=0;i<90;i++){
  updateMakerPose(model,a,null,m,1/60);
  const left=world(model,'leftWrist'),right=world(model,'rightWrist'),forward=p=>-p.z;
  gaps.push(forward(left)-forward(right));rolls.push(model.body.rotation.y);kicks.push(model.joints.leftHip.rotation.x-model.joints.rightHip.rotation.x);
  assert.ok(model.body.rotation.x<-1.2,'the body lies flat in the water');
 }
 assert.ok(Math.max(...gaps)>.5&&Math.min(...gaps)<-.5,'one hand reaches forward while the other pulls back');
 assert.ok(Math.max(...rolls)>.25&&Math.min(...rolls)<-.25,'the body rolls to both sides');
 assert.ok(Math.max(...kicks)>.3&&Math.min(...kicks)<-.3,'the legs flutter in opposition');
});

test('treading water holds the head above the surface and the feet off a shallow bed',()=>{
 for(const [bed,name] of [[-5,'deep'],[.75,'shallow']]){
  const model=rig(),m=createMakerMotion(),a=actor({camera:'third',mode:'swimming',grounded:false,surfaceHeight:2,supportHeight:bed,position:[0,1,0]});
  for(let i=0;i<180;i++){
   updateMakerPose(model,a,null,m,1/60);
   assert.ok(world(model,'head',[0,.122,0]).y>2.05,`${name}: eyes stay above the surface`);
   if(i>60)for(const side of ['left','right'])assert.ok(world(model,side+'Foot').y>bed+.05,`${name}: ${side} foot clears the bed`);
  }
 }
});

test('the head turns toward the third-person camera look and lets go when the camera is behind its face',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third'});
 updateMakerPose(model,a,null,m,1/60);a.yaw=.8;
 for(let i=0;i<90;i++)updateMakerPose(model,a,null,m,1/60);
 assert.ok(m.lookYaw.value>.6,'looks toward the camera direction');
 a.yaw=Math.PI;for(let i=0;i<120;i++)updateMakerPose(model,a,null,m,1/60);
 assert.ok(Math.abs(m.lookYaw.value)<.35,'does not wrench around to face a camera in front of it');
});
