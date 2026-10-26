import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3} from 'three/webgpu';
import {createMakerRig} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';
import {createInhabitant,stepInhabitant} from './inhabitant.mjs';
import {EMOTES,emoteById,requestEmote,emoteWeight} from './emotes.mjs';
import {createMakerEmoteLayer,updateMakerEmote,MAKER_EMOTE_POSES} from './maker-emotes.mjs';

const flat=(height=0)=>({sample:()=>({height,normal:[0,1,0],slope:0,inBounds:true})});
// The real controller, locomotion pose and emote layer, stepped at 60 Hz.
function rig(terrain=flat()){
 const a=createInhabitant({terrain,scene:{runtime:{spawn:[0,1.72,0],look:[0,0],possession:{camera:'third'}}}}),model=createMakerRig(),motion=createMakerMotion(),layer=createMakerEmoteLayer();
 const step=(input={})=>{stepInhabitant(a,input,1/60,{terrain});updateMakerPose(model,a,terrain,motion,1/60);updateMakerEmote(model,a,layer,{terrain,facing:motion.facingYaw});model.root.updateMatrixWorld(true);};
 for(let i=0;i<90;i++)step();
 return {a,model,motion,layer,step,terrain};
}
const at=(model,name,point=[0,0,0])=>model.joints[name].localToWorld(new Vector3(...point));
const pose=model=>model.bones.map(b=>b.quaternion.clone());
const maxTurn=(a,b)=>Math.max(...a.map((q,i)=>q.angleTo(b[i])));

test('every emote has a pose, and none disturbs the body before it fades in or after it ends',()=>{
 assert.deepEqual(MAKER_EMOTE_POSES,EMOTES.map(e=>e.id));
 for(const {id} of EMOTES){
  const {a,model,step}=rig();step();const idle=pose(model);
  requestEmote(a,id);
  // The first frame is at weight ~0: the layer leaves the locomotion pose as it was.
  step();assert.ok(maxTurn(pose(model),idle)<.05,`${id} pops in`);
  for(let i=0;i<60;i++)step();
  for(const bone of model.bones)assert.ok([bone.quaternion.x,bone.quaternion.y,bone.quaternion.z,bone.quaternion.w].every(Number.isFinite),`${id} ${bone.name}`);
  assert.ok(maxTurn(pose(model),idle)>.3,`${id} visibly moves`);
 }
});

test('upper-body emotes and the dance keep both feet planted',()=>{
 for(const id of ['wave','dance','clap','bow','point','shrug','cheer']){
  const {a,model,step}=rig(),feet=()=>['left','right'].map(s=>at(model,s+'Foot'));step();const start=feet();
  requestEmote(a,id);let drift=0;
  for(let i=0;i<150;i++){step();feet().forEach((p,k)=>{drift=Math.max(drift,p.distanceTo(start[k]));});}
  assert.ok(drift<.002,`${id}: feet drifted ${drift}`);
 }
});

test('bones move continuously through a whole emote, a cancel and a loop',()=>{
 for(const {id,loop} of EMOTES){
  const {a,model,step}=rig();requestEmote(a,id);let previous=pose(model),worst=0;
  const frames=loop?240:Math.ceil(emoteById(id).duration*60)+10;
  for(let i=0;i<frames;i++){step(loop&&i===200?{forward:1}:{});const now=pose(model);worst=Math.max(worst,maxTurn(now,previous));previous=now;}
  // The fastest keyed motion (a clap, a wave) turns a joint well under 0.35 rad per frame.
  assert.ok(worst<.35,`${id}: ${worst} rad in one frame`);
 }
});

test('movement cancels an emote and blends back to walking',()=>{
 const {a,model,step}=rig();requestEmote(a,'cheer');for(let i=0;i<60;i++)step();
 assert.ok(at(model,'rightWrist').y>1.7,'arms up');
 step({forward:1});assert.equal(a.emote.stage,'exit');
 for(let i=0;i<20;i++)step({forward:1});
 assert.equal(a.emote,null);assert.ok(at(model,'rightWrist').y<1.1,'arms back down while walking');assert.ok(a.speed>.5);
});

test('sitting lowers the pelvis onto the ground or a seat and never puts a foot below the ground',()=>{
 for(const seat of [null,{id:'bench',point:[0,.45,.42],yaw:0,height:.45},{id:'log',point:[.4,.62,0],yaw:-Math.PI/2,height:.62}]){
  const {a,model,step,layer}=rig();requestEmote(a,'sit',{seat});let lowest=Infinity;
  for(let i=0;i<90;i++){step();for(const s of ['left','right'])lowest=Math.min(lowest,at(model,s+'Foot',[0,-.09,0]).y);}
  assert.ok(lowest>-.01,`soles stay on the ground (${lowest})`);
  const hips=at(model,'leftHip').add(at(model,'rightHip')).multiplyScalar(.5),h=seat?.height??0;
  assert.ok(Math.abs(hips.y-(h+.1))<.01,`pelvis at ${hips.y} for a ${h} m seat`);
  if(seat){assert.ok(Math.hypot(hips.x-seat.point[0],hips.z-seat.point[2])<.01,'onto the seat point');assert.ok(Math.abs(model.root.rotation.y-seat.yaw)<1e-6);}
  assert.equal(layer.weight,1);assert.ok(at(model,'eyes').y<h+1);assert.deepEqual(a.position.map(n=>+n.toFixed(6)),[0,0,0],'collision and support stay put');
 }
});

test('lying stretches out on the back along the ground, then stands back up',()=>{
 const {a,model,step,layer}=rig();requestEmote(a,'lie');
 for(let i=0;i<150;i++)step();
 assert.equal(emoteWeight(a.emote),1);
 const head=at(model,'head',[0,.1,0]),chest=at(model,'chest'),toes=at(model,'leftToe');
 assert.ok(head.y<.3&&chest.y<.3,`flat: head ${head.y}, chest ${chest.y}`);assert.ok(head.z>.6,'head behind the pelvis');assert.ok(toes.z<-.7,'legs out ahead');
 assert.ok(at(model,'eyes').y<.4);
 for(let i=0;i<20;i++)step({forward:1});assert.equal(a.emote.stage,'exit');assert.deepEqual(a.position.map(n=>+n.toFixed(6)),[0,0,0],'stands before walking');
 for(let i=0;i<70;i++)step({forward:1});assert.equal(a.emote,null);assert.ok(at(model,'head').y>1.4);
});

test('first person turning the camera does not swivel a sitter',()=>{
 const {a,model,step}=rig();a.camera='first';requestEmote(a,'sit');for(let i=0;i<90;i++)step();
 const yaw=model.root.rotation.y;for(let i=0;i<30;i++)step({yaw:a.yaw+.05});
 assert.ok(Math.abs(model.root.rotation.y-yaw)<1e-9);
});
