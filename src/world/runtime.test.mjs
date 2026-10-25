import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldRuntime, validateRuntimeScene } from './runtime.mjs';

const object=(id,extra={})=>({id,position:[0,1,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,...extra});
const fixture=()=>({runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1','interaction.hinge@1','motion.spin@1'],spawn:[0,1.72,4],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]},objects:[object('gate',{collider:{type:'box',size:[2,2,.2],offset:[1,0,0]},behavior:{type:'hinge',angle:Math.PI/2,speed:2}}),object('wheel',{behavior:{type:'spin',speed:.5}})]});
test('capability dependencies and unsupported combinations fail before adoption',()=>{
 const s=fixture();s.runtime.modules=s.runtime.modules.filter(x=>x!=='collision.boxes@1');
 assert.throws(()=>validateRuntimeScene(s),/requires collision/);
 s.runtime.modules.push('collision.boxes@1','magic.physics@1');assert.throws(()=>validateRuntimeScene(s),/Unknown module/);
});
test('a gate keeps identity/state across appearance and placement edits; collider follows motion',()=>{
 const s=fixture(),r=new WorldRuntime(s);assert.equal(r.blocked(1,0),true);
 r.act('gate',[0,1.72,2]);for(let i=0;i<90;i++)r.step(1/60);
 assert.equal(r.blocked(1,0),false);assert.equal(r.blocked(0,-1),true);
 const changed=structuredClone(s);changed.objects[0].asset='new-revision';changed.objects[0].position[0]=4;
 r.reconcile(changed);assert.equal(r.states.get('gate').open,true);assert.equal(r.blocked(4,-1),true);assert.equal(r.blocked(0,-1),false);
 changed.objects=[];r.reconcile(changed);assert.equal(r.states.size,0);
});
test('origin hiding removes collision and interaction; distance is enforced',()=>{
 const s=fixture();s.objects[0].layer='origin';const r=new WorldRuntime(s);
 assert.equal(r.act('gate',[15,1.72,15]),false);r.originVisible=false;
 assert.equal(r.blocked(1,0),false);assert.equal(r.act('gate',[0,1.72,2]),false);
});
test('simulation pause/reset and bounded catch-up are independent of authored state',()=>{
 const s=fixture(),r=new WorldRuntime(s);r.step(.1);assert.ok(r.states.get('wheel').angle>0);
 const a=r.states.get('wheel').angle;r.paused=true;r.step(.1);assert.equal(r.states.get('wheel').angle,a);
 r.reset();assert.equal(r.states.get('wheel').angle,0);assert.equal(s.objects[1].rotation[1],0);
 r.paused=false;r.step(10);assert.ok(r.droppedSeconds>9);assert.ok(r.states.get('wheel').angle<=.051);
});
test('controller collision uses rotated scaled boxes and authored origin blockers',()=>{
 const s=fixture();s.objects=[];s.runtime.blockers=[{id:'wall',layer:'origin',position:[3,1,0],rotation:[0,Math.PI/2,0],size:[4,2,.2]}];
 const r=new WorldRuntime(s);assert.equal(r.blocked(3,1.5),true);assert.equal(r.blocked(4,0),false);r.originVisible=false;assert.equal(r.blocked(3,1.5),false);
});
test('interaction describes the current action without exposing mutable activity state',()=>{
 const r=new WorldRuntime(fixture()),position=[0,1.72,2];
 const before=r.snapshot(),query=r.interaction('gate',position);
 assert.equal(query.available,true);assert.equal(query.action,'open');assert.equal(query.label,'Open gate');assert.equal(query.reason,null);
 query.state.open=true;assert.deepEqual(r.snapshot(),before);
 assert.equal(r.act('gate',position),true);assert.equal(r.interaction('gate',position).action,'close');
 assert.equal(r.interaction('wheel',position).action,'stop');r.act('wheel',position);assert.equal(r.interaction('wheel',position).action,'start');
});
test('interaction reach follows transformed extents and rejects missing, hidden or invalid targets',()=>{
 const s=fixture();s.objects[0].rotation[1]=Math.PI/2;s.objects[0].scale=[2,1,1];
 s.objects.push(object('scenery',{shape:{type:'box',size:[1,1,1],offset:[0,0,0]}}));
 const r=new WorldRuntime(s);
 // The gate spans z = 0 to -4 after scaling and rotation; its pivot is over 3.5 m away.
 assert.equal(r.interaction('gate',[0,1.72,-5]).available,true);
 assert.equal(r.interaction('gate',[0,1.72,-8]).reason,'out-of-reach');
 assert.equal(r.act('gate',[0,1.72,-8]),false);
 assert.equal(r.interaction('missing',[0,1.72,0]).reason,'missing');
 assert.equal(r.interaction('scenery',[0,1.72,0]).reason,'not-interactive');
 assert.equal(r.interaction('gate',[NaN,1.72,0]).reason,'invalid-position');
 s.objects[0].layer='origin';r.originVisible=false;assert.equal(r.interaction('gate',[0,1.72,0]).reason,'hidden');
});
test('interaction reach uses compound colliders or shape bounds and remains vertically bounded',()=>{
 const s=fixture();s.objects[0].collider={type:'compound',boxes:[{size:[1,1,1],offset:[0,0,0]},{size:[1,1,1],offset:[5,0,0]}]};
 s.objects[1].position=[0,10,0];s.objects[1].shape={type:'torus',size:[2,2,2],offset:[0,0,0]};
 const r=new WorldRuntime(s);
 assert.equal(r.interaction('gate',[6,1.72,0]).available,true);
 assert.equal(r.interaction('wheel',[0,1.72,0]).available,false);
 s.objects[1].position=[0,2,0];assert.equal(r.interaction('wheel',[4.4,1.72,0]).available,true);
});

const terrainScene=()=>{const s=fixture();s.terrain={type:'heightfield',bounds:[-20,20,-20,20],segments:[8,8],baseHeight:3,stamps:[]};s.runtime.modules.push('terrain.heightfield@1','inhabitant.maker@1');s.runtime.possession={preset:'maker',camera:'first'};return s;};

test('runtime retains its terrain lattice across appearance edits and rebuilds changed geometry',()=>{
 const scene=terrainScene(),runtime=new WorldRuntime(scene),first=runtime.terrain;assert.equal(first.sample(0,0).height,3);
 const appearance=structuredClone(scene);appearance.terrain.appearance={sandColor:'#ccbbaa'};runtime.reconcile(appearance);assert.equal(runtime.terrain,first);
 const changed=structuredClone(appearance);changed.terrain.baseHeight=4;runtime.reconcile(changed);assert.notEqual(runtime.terrain,first);assert.equal(runtime.terrain.sample(0,0).height,4);
 runtime.reconcile(fixture());assert.equal(runtime.terrain,null);
});

test('rejected landscape adoption preserves the last runtime and terrain',()=>{
 const scene=terrainScene(),runtime=new WorldRuntime(scene),first=runtime.terrain;
 const bad=structuredClone(scene);bad.terrain.segments=[0,8];assert.throws(()=>runtime.reconcile(bad));assert.equal(runtime.scene,scene);assert.equal(runtime.terrain,first);
});

test('collision uses the actual body interval at elevation while preserving legacy ground queries',()=>{
 const scene=fixture();scene.objects=[object('elevated',{position:[0,5,0],collider:{type:'box',size:[2,2,2],offset:[0,0,0]}}),object('low',{position:[4,.5,0],collider:{type:'box',size:[2,1,2],offset:[0,0,0]}})];
 const runtime=new WorldRuntime(scene);
 assert.equal(runtime.collisionAt(0,0),null);assert.equal(runtime.collisionAt(0,0,.22,4,1.82),'elevated');assert.equal(runtime.blocked(0,0,.22,4,1.82),true);
 assert.equal(runtime.collisionAt(4,0),'low');assert.equal(runtime.collisionAt(4,0,.22,4,1.82),null);
 assert.equal(runtime.collisionAt(0,0,.22,6,1.82),null);assert.equal(runtime.collisionAt(0,0,.22,2,2),null);
});

test('elevated compound boxes, rotated blockers and mood board share body interval queries',()=>{
 const scene=fixture();scene.objects=[object('compound',{position:[0,8,0],rotation:[0,Math.PI/2,0],scale:[2,1,1],collider:{type:'compound',boxes:[{size:[1,2,1],offset:[2,0,0]}]}})];
 scene.runtime.blockers=[{id:'wall',layer:'origin',position:[6,8,0],rotation:[0,Math.PI/2,0],size:[4,2,.2]}];
 scene.moodboard={position:[10,8,0],rotation:[0,0,0],collider:{size:[2,2,.2],offset:[0,0,0]}};
 const runtime=new WorldRuntime(scene);assert.equal(runtime.collisionAt(0,-4,.22,7,1.82),'compound');assert.equal(runtime.collisionAt(6,1,.22,7,1.82),'wall');assert.equal(runtime.collisionAt(10,0,.22,7,1.82),'moodboard');
 assert.equal(runtime.collisionAt(0,-4),null);runtime.originVisible=false;assert.equal(runtime.collisionAt(6,1,.22,7,1.82),null);assert.equal(runtime.collisionAt(10,0,.22,7,1.82),null);
});

test('maker permits authored vertical spawn while legacy walker retains its fixed eye rule',()=>{
 const scene=terrainScene();scene.runtime.spawn[1]=8;assert.doesNotThrow(()=>validateRuntimeScene(scene));
 const legacy=fixture();legacy.runtime.spawn[1]=8;assert.throws(()=>validateRuntimeScene(legacy),/eye height/);
});
test('drift bobs, spins and sways floating things out of step, without colliders and at any authored rotation',async()=>{
 const {driftPose,driftPhase}=await import('./runtime.mjs');
 const s=fixture();s.runtime.modules.push('motion.drift@1');
 s.objects=[object('cube-a',{rotation:[.6,0,.3],behavior:{type:'drift',bob:.8,period:24,spin:.05,sway:.06}}),object('cube-b',{rotation:[Math.PI,0,0],behavior:{type:'drift',bob:.8,period:24}})];
 validateRuntimeScene(s);
 const r=new WorldRuntime(s);for(let i=0;i<300;i++)r.step(1/60);
 const a=r.renderMotion(s.objects[0]),b=r.renderMotion(s.objects[1]);
 assert.ok(Math.abs(a.position[1]-1)<=.8+1e-9&&Math.abs(b.position[1]-1)<=.8+1e-9,'the bob stays within its height');
 assert.notEqual(a.position[1],b.position[1],'copies drift out of step');
 assert.ok(Math.abs(a.tilt[0])<=.06&&Math.abs(a.tilt[1])<=.06);assert.ok(b.tilt.every(v=>v===0),'no sway without a sway');assert.equal(b.angle,0,'no spin without a spin rate');
 assert.deepEqual(driftPose({bob:1,period:20},5,0),driftPose({bob:1,period:20},5,0));assert.ok(Math.abs(driftPose({bob:1,period:20},5,0).lift-1)<1e-12,'a quarter period lifts by the full bob');
 assert.equal(driftPhase('cube-a'),driftPhase('cube-a'));assert.notEqual(driftPhase('cube-a'),driftPhase('cube-b'));
 r.act('cube-a',[0,1,0]);const held=r.renderMotion(s.objects[0]).position[1];for(let i=0;i<30;i++)r.step(1/60);assert.equal(r.renderMotion(s.objects[0]).position[1],held,'E stops the drift');
 for(const [change,message] of [[{collider:{type:'box',size:[1,1,1],offset:[0,0,0]},rotation:[0,0,0]},/no collider/],[{behavior:{type:'drift'}},/needs a bob, spin or sway/],[{behavior:{type:'drift',bob:20}},/Drift bob/],[{behavior:{type:'drift',spin:2}},/Drift spin/],[{behavior:{type:'drift',bob:1,speed:1}},/behavior fields/]]){
  const bad=structuredClone(s);Object.assign(bad.objects[0],change);assert.throws(()=>validateRuntimeScene(bad),message);
 }
 const missing=structuredClone(s);missing.runtime.modules=missing.runtime.modules.filter(m=>m!=='motion.drift@1');assert.throws(()=>validateRuntimeScene(missing),/requires motion.drift@1/);
 const spinning=structuredClone(fixture());spinning.objects.push(object('tilted',{rotation:[.4,0,0],behavior:{type:'spin',speed:.2}}));assert.throws(()=>validateRuntimeScene(spinning),/yaw rotation only/,'spin stays yaw-only');
});
test('the far plane covers the landscape and every explicit placement',async()=>{
 const {viewFar}=await import('./runtime.mjs');
 assert.equal(viewFar({objects:[]}),160,'an empty construct keeps the near default');
 assert.equal(viewFar({terrain:{bounds:[-1000,1000,-1000,1000]},objects:[]}),6000,'a 2 km island as before');
 const far=viewFar({terrain:{bounds:[-60,60,-80,80]},objects:[object('monolith',{position:[900,120,-1200],scale:[30,30,30]})]});
 assert.ok(far>=Math.hypot(900,1200),'a far monolith is inside the far plane');
});
