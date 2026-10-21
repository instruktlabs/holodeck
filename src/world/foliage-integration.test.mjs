import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD,validateWorld,validateGlb} from './contract.mjs';
const foliage={nodes:['leaf'],translucency:.18,wind:{amplitude:.08,frequency:1.2,direction:[1,0],weight:'uv-y'}};
const world=()=>({...structuredClone(DEFAULT_WORLD),schemaVersion:2,scene:{...structuredClone(DEFAULT_WORLD.scene),runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}});
function glb(){const json=JSON.stringify({asset:{version:'2.0'},nodes:[{name:'leaf',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1}}]}],accessors:[{count:3,type:'VEC3',componentType:5126},{count:3,type:'VEC2',componentType:5126}]});const data=Buffer.from(json.padEnd(Math.ceil(json.length/4)*4,' ')),out=Buffer.alloc(20+data.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(data.length,12);out.writeUInt32LE(0x4e4f534a,16);data.copy(out,20);return out;}
test('schema two validates explicit foliage and disallows conflicting cove derivation',()=>{
 const w=world();w.scene.assets.push({id:'plant',file:'assets/imports/plant.glb',foliage});w.scene.objects.push({id:'plant-one',asset:'plant',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null});
 assert.doesNotThrow(()=>validateWorld(w));w.scene.objects[0].materialStyle='cove';assert.throws(()=>validateWorld(w),/foliage.*cove/i);
 const legacy=structuredClone(DEFAULT_WORLD);legacy.scene.assets[0].foliage=foliage;assert.throws(()=>validateWorld(legacy),/foliage.*schema|asset fields/i);
});
test('GLB entry validates binding before acceptance rather than only in browser',()=>{
 assert.equal(validateGlb(glb(),{foliage}).triangles,1);
 assert.throws(()=>validateGlb(glb(),{foliage:{...foliage,nodes:['absent']}}),/exactly one mesh/);
});
