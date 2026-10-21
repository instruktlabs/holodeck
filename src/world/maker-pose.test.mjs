import assert from 'node:assert/strict';
import test from 'node:test';
import {Group,Vector3} from 'three/webgpu';
import {createMakerModel} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';
import {createInhabitant,stepInhabitant} from './inhabitant.mjs';

const actor=(overrides={})=>({position:[2,1,3],yaw:0,speed:0,velocity:[0,0,0],camera:'first',gaitPhase:0,mode:'grounded',grounded:true,supportHeight:1,config:{walkSpeed:2.2},...overrides});
function rig(){
 const root=new Group(),body=new Group(),joints={};root.add(body);body.position.y=.9;
 for(const [side,x] of [['left',-.105],['right',.105]]){
  for(const name of ['Hip','Knee','Foot','Shoulder','Elbow'])joints[side+name]=new Group();
  const hip=joints[side+'Hip'],knee=joints[side+'Knee'],foot=joints[side+'Foot'];
  body.add(hip,joints[side+'Shoulder']);joints[side+'Shoulder'].add(joints[side+'Elbow']);hip.add(knee);knee.add(foot);
  hip.position.x=x;knee.position.y=-.405;foot.position.y=-.405;
 }
 return {root,body,joints};
}
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const ankle=(model,side)=>{model.root.updateMatrixWorld(true);return model.joints[side+'Foot'].getWorldPosition(new Vector3());};

test('walk contacts alternate without simultaneous lift and knee rotation stays continuous through stops',()=>{
 const terrain={sample:()=>({height:0,normal:[0,1,0],slope:0,inBounds:true})},a=createInhabitant({terrain,scene:{runtime:{spawn:[0,1.72,0],look:[0,0],possession:{camera:'third'}}}}),model=rig(),m=createMakerMotion();
 let previous=null,maxAngle=0,maxAcceleration=0;
 for(let i=0;i<1200;i++){
  stepInhabitant(a,Math.floor(i/120)%2?{}:{forward:1,yaw:i<480?0:i/60*.8},1/60,{terrain});updateMakerPose(model,a,terrain,m,1/60);
  assert.ok(!(m.feet.left.swing&&m.feet.right.swing),'walking keeps one support foot');
  const now={};for(const side of ['left','right']){const foot=ankle(model,side),knee=model.joints[side+'Knee'].quaternion.clone(),delta=previous?foot.clone().sub(previous[side].foot):new Vector3();if(previous){maxAngle=Math.max(maxAngle,knee.angleTo(previous[side].knee));maxAcceleration=Math.max(maxAcceleration,delta.clone().sub(previous[side].delta).length());}now[side]={foot,knee,delta};}previous=now;
 }
 assert.ok(maxAngle<.3,`maximum knee rotation/frame ${maxAngle}`);
 // At the default brisk walk the continuous cubic permits 24*v^2/stride
 // acceleration. Include controller braking, rather than treating swing speed
 // itself as a discontinuity. This bound still catches the old contact resets.
 const accelerationBound=(24*a.config.walkSpeed**2/(.75+a.config.walkSpeed*.1)+20)/60**2;
 assert.ok(maxAcceleration<accelerationBound,`maximum ankle second difference ${maxAcceleration}`);
});

test('full walking cycles, starts, turns and stops do not pop feet or pelvis between frames',()=>{
 const terrain={sample:()=>({height:0,normal:[0,1,0],slope:0,inBounds:true})},a=createInhabitant({terrain,scene:{runtime:{spawn:[0,1.72,0],look:[0,0],possession:{camera:'third'}}}}),model=rig(),m=createMakerMotion();
 let previous=null,previousPelvis=0,maxFoot=0,maxPelvis=0;
 for(let i=0;i<600;i++){
  const input=i<60?{}:i<240?{forward:1}:i<360?{strafe:1}:i<480?{forward:-1}:{};
  stepInhabitant(a,input,1/60,{terrain});updateMakerPose(model,a,terrain,m,1/60);
  const feet=[ankle(model,'left'),ankle(model,'right')];
  if(previous){for(let side=0;side<2;side++)maxFoot=Math.max(maxFoot,feet[side].distanceTo(previous[side]));maxPelvis=Math.max(maxPelvis,Math.abs(model.body.position.y-previousPelvis));}
  previous=feet;previousPelvis=model.body.position.y;
 }
 assert.ok(maxFoot<.16,`maximum ankle delta ${maxFoot}`);assert.ok(maxPelvis<.013,`maximum pelvis delta ${maxPelvis}`);
 for(const side of ['left','right'])assert.ok(Math.abs(model.joints[side+'Knee'].rotation.x)>.1,'standing knee retains a small bend');
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

test('velocity and turning produce bounded lean which settles at rest',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',speed:4.5,velocity:[0,0,-4.5]});
 for(let i=0;i<40;i++)updateMakerPose(model,a,null,m,.016);
 assert.ok(model.body.rotation.x<-.04&&model.body.rotation.x>-.2);
 a.velocity=[4.5,0,0];updateMakerPose(model,a,null,m,.016);
 assert.ok(Math.abs(model.body.rotation.z)>.001&&Math.abs(model.body.rotation.z)<.2);
 a.velocity=[0,0,0];a.speed=0;for(let i=0;i<100;i++)updateMakerPose(model,a,null,m,.016);
 assert.ok(Math.abs(model.body.rotation.x)<.001&&Math.abs(model.body.rotation.z)<.001);
});

test('stance foot stays planted in world space through bounded translation and body turning',()=>{
 const model=rig(),m=createMakerMotion(),a=actor({camera:'third',speed:2.2,velocity:[0,0,-2.2],gaitPhase:.1*Math.PI*2}),terrain={sample:()=>({height:1,normal:[0,1,0],inBounds:true})};
 for(let i=0;i<30;i++)updateMakerPose(model,a,terrain,m,.016);
 const start=ankle(model,'left');
 for(let i=0;i<5;i++){a.position[2]-=.04;a.gaitPhase+=.04*Math.PI*2/1.5;updateMakerPose(model,a,terrain,m,.04);}
 let end=ankle(model,'left');assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<.012,'stance ankle must not slide with the root');
 a.velocity=[.7,0,-2.1];a.position[0]+=.015;updateMakerPose(model,a,terrain,m,.04);end=ankle(model,'left');
 assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<.015,'turning must solve lateral contact too');
 assert.ok(end.y>=1.088&&end.y<1.14,'trailing heel may lift while the toe rolls off');
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
test('visual two-bone solve places each ankle above its sampled terrain support',()=>{
 const model=createMakerModel(),a=actor(),motion=createMakerMotion();
 const terrain={sample:(x,z)=>({height:x<2?1:1.12,normal:[0,1,0],inBounds:true})};
 updateMakerPose(model,a,terrain,motion,.1);model.root.updateMatrixWorld(true);
 for(const [name,height] of [['leftFoot',1.09],['rightFoot',1.21]]){
  const position=model.joints[name].getWorldPosition(new Vector3());
  assert.ok(Math.abs(position.y-height)<.003,`${name} support ${position.y}`);
 }
 assert.deepEqual(a.position,[2,1,3],'visual IK never changes controller position');model.dispose();
});

test('walk, swim and airborne transitions retain finite distinct modular poses',()=>{
 const model=createMakerModel(),a=actor({speed:2.2,gaitPhase:Math.PI/2}),motion=createMakerMotion();
 updateMakerPose(model,a,null,motion,1);
 assert.notEqual(model.joints.leftShoulder.rotation.x,model.joints.rightShoulder.rotation.x);
 a.mode='swimming';a.grounded=false;for(let i=0;i<10;i++)updateMakerPose(model,a,null,motion,.1);
 assert.ok(model.body.rotation.x<-1);assert.ok(model.joints.leftShoulder.rotation.x>1.5);
 a.mode='airborne';a.verticalVelocity=3;for(let i=0;i<10;i++)updateMakerPose(model,a,null,motion,.1);
 assert.ok(Math.abs(model.body.rotation.x)<.01);assert.ok(model.joints.leftKnee.rotation.x<-.25);
 model.root.traverse(part=>assert.ok([...part.position,...part.quaternion,...part.scale].every(Number.isFinite)));
 model.dispose();
});
