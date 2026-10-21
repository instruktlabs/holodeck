import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRuntime} from './runtime.mjs';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';
function world(){
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;
 w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','motion.boids@1','motion.gait@1'],spawn:[4,1.72,4],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-10,10,-10,10],blockers:[]};
 w.scene.objects=[{id:'flock',asset:'cove',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,behavior:{type:'flock',count:8,bounds:[-8,8,2,6,-8,8],speed:6,neighborRadius:4,separationRadius:1,terrainClearance:1,seed:42,gait:{stride:2,channels:[{node:'wing',axis:'x',amplitude:.6,phase:0}]}}}];return w;
}
test('flock contract permits articulated birds without patrol module and bounds total agents',()=>{
 assert.doesNotThrow(()=>validateWorld(world()));
 const missing=world();missing.scene.runtime.modules.splice(2,1);assert.throws(()=>validateWorld(missing),/requires motion.boids/);
 const many=world();many.scene.objects=Array.from({length:3},(_,i)=>({...structuredClone(many.scene.objects[0]),id:`f${i}`,behavior:{...many.scene.objects[0].behavior,count:40}}));assert.throws(()=>validateWorld(many),/96/);
 for(const change of [{collider:{type:'box',size:[1,1,1],offset:[0,0,0]}},{materialStyle:'cove'},{shape:{type:'sphere'}}]){const w=world();Object.assign(w.scene.objects[0],change);assert.throws(()=>new WorldRuntime(w.scene),/Flock requires/);}
});
test('flock uses shared clock, pause, hide, stop and deterministic reset',()=>{
 const w=world(),runtime=new WorldRuntime(w.scene),first=runtime.snapshot().states.flock.agents;
 runtime.step(.1);assert.notDeepEqual(runtime.snapshot().states.flock.agents,first);
 runtime.paused=true;const paused=runtime.snapshot();runtime.step(.1);assert.deepEqual(runtime.snapshot(),paused);runtime.paused=false;
 runtime.act('flock',[0,1,0]);const stopped=runtime.snapshot().states.flock.agents;runtime.step(.1);assert.deepEqual(runtime.snapshot().states.flock.agents,stopped);
 runtime.reset();assert.deepEqual(runtime.snapshot().states.flock.agents,first);
 const hidden=structuredClone(w.scene);hidden.objects[0].layer='origin';runtime.reconcile(hidden);runtime.originVisible=false;const before=runtime.snapshot().states.flock.agents;runtime.step(.1);assert.deepEqual(runtime.snapshot().states.flock.agents,before);
});
