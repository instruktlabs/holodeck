import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';
test('legacy scenes retain the 200 placement limit before the v2 batching renderer',()=>{
 const w=structuredClone(DEFAULT_WORLD);w.scene.objects=Array.from({length:201},(_,i)=>({id:`prop-${i}`,asset:'cove',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null}));assert.throws(()=>validateWorld(w),/200 placements/);w.scene.objects.pop();assert.doesNotThrow(()=>validateWorld(w));
});
test('foliage hints cannot silently disappear inside an unsupported flock renderer',()=>{
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','motion.boids@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]};w.scene.assets.push({id:'bird',file:'assets/imports/bird.glb',foliage:{nodes:['leaf']}});w.scene.objects=[{id:'flock',asset:'bird',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,behavior:{type:'flock',count:3,bounds:[-8,8,2,6,-8,8],speed:6,neighborRadius:4,separationRadius:1,terrainClearance:1,seed:42}}];assert.throws(()=>validateWorld(w),/foliage.*flock/i);
});
