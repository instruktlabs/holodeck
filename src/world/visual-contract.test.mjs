import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateWorld} from './contract.mjs';
const template=JSON.parse(await readFile(new URL('../../test/fixtures/courtyard-template.json',import.meta.url),'utf8'));
function world(){return {schemaVersion:2,revision:0,bible:{title:template.title,intent:template.intent,rules:template.rules},scene:{environment:template.environment,bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'}],objects:structuredClone(template.objects),runtime:structuredClone(template.runtime)}};}
test('textured trees retain one authored identity and a separate trunk collider',()=>{
 const w=world();assert.doesNotThrow(()=>validateWorld(w));const trees=w.scene.objects.filter(o=>o.shape?.type==='tree'&&o.shape.size[1]>3);assert.ok(trees.length>=4);assert.ok(trees.every(o=>o.collider?.type==='box'));
});
test('visual capabilities stay bounded and explicit',()=>{
 const w=world();w.scene.objects[0].shape.surface='remote-shader';assert.throws(()=>validateWorld(w),/surface/);
});
