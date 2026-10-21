import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';

const world=()=>({...structuredClone(DEFAULT_WORLD),schemaVersion:2,scene:{...structuredClone(DEFAULT_WORLD.scene),runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}});
const landscape=()=>{
 const w=world();w.scene.terrain={type:'heightfield',bounds:[-20,20,-20,20],segments:[8,8],baseHeight:0,stamps:[]};
 w.scene.water={type:'ocean',bounds:[-30,30,-30,30],level:-1,waves:[]};
 w.scene.runtime.modules.push('terrain.heightfield@1','water.ocean@1','inhabitant.maker@1');w.scene.runtime.possession={preset:'maker',camera:'third',walkSpeed:3,runSpeed:5,swimSpeed:2,thirdPerson:{distance:4,height:1.5}};
 return w;
};

test('schema two admits bounded terrain, ocean and maker possession without changing legacy documents',()=>{
 const legacy=structuredClone(DEFAULT_WORLD),before=structuredClone(legacy);assert.equal(validateWorld(legacy),legacy);assert.deepEqual(legacy,before);
 assert.doesNotThrow(()=>validateWorld(world()));const w=landscape();assert.equal(validateWorld(w),w);
 w.schemaVersion=1;assert.throws(()=>validateWorld(w),/scene fields/);
});

test('landscape records and advertised capabilities must agree',()=>{
 for(const [key,module] of [['terrain','terrain.heightfield@1'],['water','water.ocean@1']]){
  const missingModule=landscape();missingModule.scene.runtime.modules=missingModule.scene.runtime.modules.filter(x=>x!==module);assert.throws(()=>validateWorld(missingModule),/requires/);
  const missingRecord=landscape();delete missingRecord.scene[key];assert.throws(()=>validateWorld(missingRecord),/requires/);
 }
 const w=landscape();w.scene.terrain.segments=[512,512];assert.throws(()=>validateWorld(w),/segments/);
 const badWater=landscape();badWater.scene.water.waves=[{direction:[0,0],amplitude:.2,wavelength:5,speed:1}];assert.throws(()=>validateWorld(badWater),/direction/);
});

test('maker possession rejects unsupported profiles, cameras and unbounded settings',()=>{
 for(const change of [{preset:'imported'},{camera:'orbit'},{walkSpeed:0},{runSpeed:13},{swimSpeed:Infinity},{thirdPerson:{distance:.1}},{thirdPerson:{height:5}},{thirdPerson:{unknown:2}},{unknown:true}]){
  const w=landscape();Object.assign(w.scene.runtime.possession,change);assert.throws(()=>validateWorld(w));
 }
 const w=landscape();w.scene.runtime.possession={preset:'maker',camera:'first'};assert.doesNotThrow(()=>validateWorld(w));
 w.scene.runtime.modules=w.scene.runtime.modules.filter(x=>x!=='inhabitant.maker@1');assert.throws(()=>validateWorld(w),/requires/);
 const missing=landscape();delete missing.scene.runtime.possession;assert.throws(()=>validateWorld(missing),/requires/);
});

test('landscape presentation accepts bounded lighting and fog with legacy defaults',()=>{
 const w=world();Object.assign(w.scene.environment,{sunPosition:[40,65,-30],fogNear:100,fogFar:600});assert.doesNotThrow(()=>validateWorld(w));
 for(const change of [{sunPosition:[0,0,0]},{sunPosition:[0,Infinity,0]},{fogNear:-1},{fogNear:null},{fogFar:null},{fogFar:100},{fogFar:2001}]){const bad=structuredClone(w);Object.assign(bad.scene.environment,change);assert.throws(()=>validateWorld(bad));}
 const partial=world();partial.scene.environment.fogNear=100;assert.throws(()=>validateWorld(partial),/fog/);
});
