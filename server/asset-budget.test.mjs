import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorldStore} from './world-store.mjs';

function repeatedTriangleGlb(triangles){
 const vertices=Buffer.alloc(36),indices=Buffer.alloc(triangles*6);vertices.writeFloatLE(1,12);vertices.writeFloatLE(1,28);for(let i=0;i<triangles*3;i++)indices.writeUInt16LE(i%3,i*2);
 const binary=Buffer.concat([vertices,indices]),doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'body',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:indices.length}],accessors:[{bufferView:0,count:3,componentType:5126,type:'VEC3',min:[0,0,0],max:[1,1,0]},{bufferView:1,count:triangles*3,componentType:5123,type:'SCALAR'}]};
 const text=JSON.stringify(doc),json=Buffer.from(text.padEnd(Math.ceil(text.length/4)*4,' ')),bytes=Buffer.alloc(28+json.length+binary.length);bytes.writeUInt32LE(0x46546c67);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);bytes.writeUInt32LE(binary.length,20+json.length);bytes.writeUInt32LE(0x004e4942,24+json.length);binary.copy(bytes,28+json.length);return bytes;
}
test('world preparation enforces source triangle budget for all flock instances',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-flock-budget-')),store=await WorldStore.open(root);t.after(async()=>{await store.close();assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});});
 const world=store.snapshot();world.schemaVersion=2;delete world.scene.moodboard;world.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','motion.boids@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]};
 await mkdir(path.join(root,'assets/imports'),{recursive:true});await writeFile(path.join(root,'assets/imports/bird.glb'),repeatedTriangleGlb(100000));world.scene.assets.push({id:'bird',file:'assets/imports/bird.glb'});world.scene.objects=[{id:'flock',asset:'bird',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,behavior:{type:'flock',count:30,bounds:[-8,8,2,6,-8,8],speed:6,neighborRadius:4,separationRadius:1,terrainClearance:1,seed:42}}];
 await assert.rejects(store.prepare(world),/two million source triangles/);world.scene.objects[0].behavior.count=2;assert.ok((await store.prepare(world)).bird.triangles===100000);
});
