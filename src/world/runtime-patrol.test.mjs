import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRuntime} from './runtime.mjs';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';

const world=()=>{
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;
 w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','motion.patrol@1'],spawn:[4,1.72,4],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-10,10,-10,10],blockers:[]};
 w.scene.objects=[{id:'walker',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',shape:{type:'sphere',size:[.4,.8,.4],offset:[0,.4,0],color:'#bbaabb'},collider:{type:'box',size:[.4,.8,.4],offset:[0,.4,0]},behavior:{type:'patrol',path:[[0,0],[2,0]],speed:1,waitSeconds:.1,waterPolicy:'avoid'}}];
 return w;
};
const advance=(runtime,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)runtime.step(1/60);};

test('patrol data is bounded, explicit and admitted through the world contract',()=>{
 assert.doesNotThrow(()=>validateWorld(world()));
 for(const change of [{path:[[0,0]]},{path:Array(17).fill([0,0])},{path:[[0,0],[Infinity,0]]},{speed:5},{waitSeconds:-1},{waitSeconds:31},{waterPolicy:'swim'},{radius:0},{height:5},{heightOffset:-1},{code:'run()'}]){
  const w=world();Object.assign(w.scene.objects[0].behavior,change);assert.throws(()=>validateWorld(w));
 }
 const many=world();many.scene.objects=Array.from({length:17},(_,i)=>({...structuredClone(many.scene.objects[0]),id:`p${i}`}));assert.throws(()=>validateWorld(many),/16 patrol/);
 const missing=world();missing.scene.runtime.modules.pop();assert.throws(()=>validateWorld(missing),/requires motion.patrol/);
});

test('patrol waits at waypoints, advances deterministically, and never edits saved placement',()=>{
 const w=world(),before=JSON.stringify(w),a=new WorldRuntime(w.scene),b=new WorldRuntime(structuredClone(w.scene));
 advance(a,.1);assert.deepEqual(a.position(w.scene.objects[0]),[0,0,0]);
 advance(a,1);advance(b,1.1);assert.deepEqual(a.snapshot(),b.snapshot());
 assert.ok(a.position(w.scene.objects[0])[0]>.8);assert.ok(a.position(w.scene.objects[0])[0]<1.1);
 assert.equal(a.states.get('walker').mode,'moving');assert.ok(a.states.get('walker').distance>.8);
 advance(a,1.2);assert.equal(a.states.get('walker').targetIndex,0);
 assert.equal(JSON.stringify(w),before);
});

test('moving collider and interaction use runtime position while excluding patrol self-collision',()=>{
 const w=world(),r=new WorldRuntime(w.scene);advance(r,1.1);const p=r.position(w.scene.objects[0]);
 assert.ok(p[0]>.8);assert.equal(r.collisionAt(p[0],p[2]),'walker');assert.equal(r.collisionAt(-.5,0),null);
 const query=r.interaction('walker',[p[0]+3.6,1,0]);assert.equal(query.available,true);assert.equal(query.action,'stop');
 query.state.position[0]=99;assert.notEqual(r.position(w.scene.objects[0])[0],99);
 const saved=r.snapshot();saved.states.walker.position[0]=88;assert.notEqual(r.position(w.scene.objects[0])[0],88);
 assert.equal(r.act('walker',[p[0],1,1]),true);const stopped=[...p];advance(r,.5);assert.deepEqual(r.position(w.scene.objects[0]),stopped);
});

test('patrol stops at obstacles, retries after removal and follows elevated terrain',()=>{
 const w=world();w.scene.runtime.modules.push('terrain.heightfield@1');w.scene.terrain={type:'heightfield',bounds:[-10,10,-10,10],segments:[4,4],baseHeight:4,stamps:[]};
 w.scene.objects.push({id:'wall',position:[1,4.5,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',shape:{type:'box',size:[.1,1,2],offset:[0,0,0],color:'#bbbbbb'},collider:{type:'box',size:[.1,1,2],offset:[0,0,0]}});
 const r=new WorldRuntime(w.scene);advance(r,2);const s=r.states.get('walker');assert.equal(s.position[1],4);assert.ok(s.position[0]<.71);assert.equal(s.blockedBy,'wall');assert.equal(s.speed,0);
 const changed=structuredClone(w.scene);changed.objects.pop();r.reconcile(changed);advance(r,.5);assert.ok(r.position(changed.objects[0])[0]>.9);
});

test('water policy, slope and terrain bounds constrain patrol motion',()=>{
 const w=world();w.scene.runtime.modules.push('terrain.heightfield@1','water.ocean@1');w.scene.terrain={type:'heightfield',bounds:[-10,10,-10,10],segments:[4,4],baseHeight:-.4,stamps:[]};w.scene.water={type:'ocean',bounds:[-10,10,-10,10],level:0,waves:[]};
 const r=new WorldRuntime(w.scene);advance(r,.5);assert.equal(r.states.get('walker').blockedBy,'water-depth');
 const shallow=structuredClone(w.scene);shallow.objects[0].behavior.waterPolicy='wade';r.reconcile(shallow);advance(r,.5);assert.ok(r.states.get('walker').position[0]>.2);
 const deep=structuredClone(shallow);deep.terrain.baseHeight=-1;r.reconcile(deep);advance(r,.2);assert.equal(r.states.get('walker').blockedBy,'water-depth');
 const steep=world();steep.scene.runtime.modules.push('terrain.heightfield@1');steep.scene.terrain={type:'heightfield',bounds:[-10,10,-10,10],segments:[40,40],baseHeight:0,stamps:[{id:'hill',center:[0,0],radius:[3,3],height:8}]};steep.scene.objects[0].position=[1.5,0,0];steep.scene.objects[0].behavior.path=[[2,0],[3,0]];
 const slope=new WorldRuntime(steep.scene);advance(slope,.2);assert.equal(slope.states.get('walker').blockedBy,'slope-limit');
});

test('patrol state survives appearance edits, resets for placement/path edits, and respects hidden origins',()=>{
 const w=world(),r=new WorldRuntime(w.scene);advance(r,.7);const position=[...r.states.get('walker').position];
 const appearance=structuredClone(w.scene);appearance.objects[0].shape.color='#ffffff';r.reconcile(appearance);assert.deepEqual(r.position(appearance.objects[0]),position);
 appearance.objects[0].layer='origin';r.reconcile(appearance);r.originVisible=false;advance(r,.5);assert.deepEqual(r.position(appearance.objects[0]),position);
 const moved=structuredClone(appearance);moved.objects[0].position=[-2,0,0];r.reconcile(moved);assert.deepEqual(r.position(moved.objects[0]),[-2,0,0]);
 r.originVisible=true;advance(r,.3);r.reset();assert.deepEqual(r.position(moved.objects[0]),[-2,0,0]);
});
