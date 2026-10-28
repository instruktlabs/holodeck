import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_ASSETS,LEGACY_MAX_ASSETS,MAX_PLACEMENTS,placedSourceTriangles} from './asset-budget.mjs';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';
test('placed source budget counts origin, board, ordinary placements and every flock member',()=>{
 const scene={origin:'home',moodboard:{asset:'board'},objects:[{asset:'leaf'},{asset:'bird',behavior:{type:'flock',count:48}},{shape:{type:'box'}}]};
 assert.equal(placedSourceTriangles(scene,{home:{triangles:100},board:{triangles:20},leaf:{triangles:50},bird:{triangles:1000}}),48170);
});
test('world placement limit permits 1200 bounded records and rejects 1201',()=>{
 assert.equal(MAX_PLACEMENTS,1200);const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]};w.scene.objects=Array.from({length:1200},(_,i)=>({id:`prop-${i}`,asset:'cove',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null}));assert.doesNotThrow(()=>validateWorld(w));w.scene.objects.push({...w.scene.objects[0],id:'over-budget'});assert.throws(()=>validateWorld(w),/1200 placements/);
});
test('schema two admits MAX_ASSETS unique assets and rejects one more; legacy schema one keeps 64',()=>{
 assert.ok(Number.isSafeInteger(MAX_ASSETS)&&MAX_ASSETS>LEGACY_MAX_ASSETS);assert.equal(LEGACY_MAX_ASSETS,64);
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]};
 const kit=n=>Array.from({length:n},(_,i)=>({id:`kit-${i}`,file:`assets/imports/kit-${i}.glb`}));
 w.scene.assets=[...w.scene.assets,...kit(MAX_ASSETS-w.scene.assets.length)];w.scene.objects=w.scene.assets.map((a,i)=>({id:`piece-${i}`,asset:a.id,position:[i%40,0,Math.floor(i/40)],rotation:[0,0,0],scale:[1,1,1],collider:null}));
 assert.doesNotThrow(()=>validateWorld(w));w.scene.assets.push({id:'one-more',file:'assets/imports/one-more.glb'});assert.throws(()=>validateWorld(w),new RegExp(`${MAX_ASSETS} assets`));
 const legacy=structuredClone(DEFAULT_WORLD);legacy.scene.assets=[...legacy.scene.assets,...kit(LEGACY_MAX_ASSETS+1-legacy.scene.assets.length)];assert.throws(()=>validateWorld(legacy),/64 assets/);
});
