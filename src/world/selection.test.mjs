import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_SELECTED_REFS,selectionParts,toggleSelectedRef,pruneSelectedRefs,validateSelectedRefs} from './selection.mjs';

const scene={objects:[{id:'oak',shape:{type:'tree'}},{id:'gate',asset:'gate-kit'}]};
test('selection groups a tree and replaces its scope when drilling into a part',()=>{
  assert.deepEqual(selectionParts(scene.objects[0]).map(p=>p.id),['trunk','canopy']);
  assert.deepEqual(selectionParts(scene.objects[1]),[]);
  let refs=toggleSelectedRef([],{id:'oak'});
  refs=toggleSelectedRef(refs,{id:'gate'},{additive:true});
  assert.deepEqual(refs,[{id:'oak',part:null},{id:'gate',part:null}]);
  refs=toggleSelectedRef(refs,{id:'oak',part:'canopy'},{additive:true});
  assert.deepEqual(refs,[{id:'oak',part:'canopy'},{id:'gate',part:null}]);
  assert.deepEqual(toggleSelectedRef(refs,{id:'gate'},{additive:true}),[{id:'oak',part:'canopy'}]);
});
test('selection pruning drops deleted entities and returns invalidated parts to their whole asset',()=>{
  assert.deepEqual(pruneSelectedRefs(scene,[{id:'removed',part:null},{id:'oak',part:'trunk'},{id:'gate',part:'canopy'}]),[{id:'oak',part:'trunk'},{id:'gate',part:null}]);
  assert.throws(()=>validateSelectedRefs(scene,[{id:'gate',part:'trunk'}]),/part/);
  assert.throws(()=>validateSelectedRefs(scene,[{id:'removed',part:null}]),/no longer exists/);
  assert.throws(()=>validateSelectedRefs(scene,[{id:'oak',part:null},{id:'oak',part:'trunk'}]),/Duplicate/);
  assert.throws(()=>validateSelectedRefs(scene,[{id:'oak',part:null,file:'anything.glb'}]),/fields/);
});
test('selection caps accumulated references and preserves input arrays',()=>{
  const refs=Array.from({length:MAX_SELECTED_REFS},(_,i)=>({id:`object-${i}`,part:null}));
  assert.throws(()=>toggleSelectedRef(refs,{id:'extra'},{additive:true}),/16/);
  assert.equal(refs.length,MAX_SELECTED_REFS);
  assert.deepEqual(toggleSelectedRef(refs,{id:'oak'}),[{id:'oak',part:null}]);
});
