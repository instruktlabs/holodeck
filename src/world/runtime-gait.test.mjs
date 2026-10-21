import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRuntime} from './runtime.mjs';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';

function world(){
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;
 w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','motion.patrol@1','motion.gait@1'],spawn:[4,1.72,4],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-10,10,-10,10],blockers:[]};
 w.scene.objects=[{id:'walker',asset:'cove',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,behavior:{type:'patrol',path:[[2,0],[-2,0]],speed:1,waitSeconds:0,waterPolicy:'avoid',gait:{stride:.8,channels:[{node:'hip_left',axis:'z',amplitude:.35,phase:0}]}}}];
 return w;
}
test('gait is optional, requires a patrol and imported unbatched asset, and rejects unknown fields',()=>{
 assert.doesNotThrow(()=>validateWorld(world()));
 const missing=world();missing.scene.runtime.modules.pop();assert.throws(()=>validateWorld(missing),/gait.*requires motion.gait/);
 const noPatrol=world();noPatrol.scene.runtime.modules.splice(2,1);assert.throws(()=>validateWorld(noPatrol),/Behavior requires motion.patrol/);
 for(const patch of [{shape:{type:'sphere'}},{materialStyle:'cove'}]){const w=world();Object.assign(w.scene.objects[0],patch);assert.throws(()=>new WorldRuntime(w.scene),/gait requires an imported/);}
 const unknown=world();unknown.scene.objects[0].behavior.gait.joints=[];assert.throws(()=>validateWorld(unknown),/gait fields/);
 const legacy=world();legacy.scene.runtime.modules.pop();delete legacy.scene.objects[0].behavior.gait;assert.doesNotThrow(()=>validateWorld(legacy));
});
test('patrol interpolation is bounded between simulation states and leaves authoritative queries unchanged',()=>{
 const w=world(),runtime=new WorldRuntime(w.scene),item=w.scene.objects[0];runtime.step(1/60+1/120);
 const authoritative=runtime.position(item),rendered=runtime.renderMotion(item);
 assert.ok(rendered.position[0]>0&&rendered.position[0]<authoritative[0]);assert.ok(Math.abs(rendered.position[0]-authoritative[0]/2)<1e-8);
 assert.ok(Math.abs(rendered.distance-runtime.states.get(item.id).distance/2)<1e-8);
 rendered.position[0]=99;assert.notEqual(runtime.position(item)[0],99);
 const before=runtime.renderMotion(item);runtime.paused=true;runtime.step(.1);assert.deepEqual(runtime.renderMotion(item),before);
 runtime.reset();assert.deepEqual(runtime.renderMotion(item).position,[0,0,0]);
});
test('gait diagnostics are advisory snapshots and cannot mutate retained reports',()=>{
 const runtime=new WorldRuntime(world().scene);runtime.gaitDiagnostics.set('walker',['Missing joint.']);
 const snapshot=runtime.snapshot();assert.deepEqual(snapshot.gaitDiagnostics,{walker:['Missing joint.']});snapshot.gaitDiagnostics.walker[0]='changed';assert.equal(runtime.gaitDiagnostics.get('walker')[0],'Missing joint.');
});
