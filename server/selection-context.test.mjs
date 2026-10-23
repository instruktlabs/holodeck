import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSelectionContext} from './selection-context.mjs';

const world={revision:8,scene:{assets:[{id:'gate-kit',file:'assets/imports/gate.glb',provenance:{assetId:'gate-source',revisionId:'r2',collection:'project'}}],objects:[
  {id:'oak',label:'Garden oak',shape:{type:'tree',size:[4,6,4]},position:[2,0,-4],rotation:[0,0,0],scale:[1,1,1],collider:{type:'box',size:[.5,3,.5],offset:[0,1.5,0]}},
  {id:'gate',asset:'gate-kit',position:[0,1,-7],rotation:[0,0,0],scale:[1,1,1],collider:null,behavior:{type:'hinge',angle:1.5,speed:1}}
]}};
test('agent context resolves multiple references from accepted records and pins their asset identity',()=>{
  const refs=[{id:'oak',part:'canopy'},{id:'gate',part:null}];
  const context=resolveSelectionContext(world,{selectedRefs:refs,assets:{'gate-kit':{hash:'a'.repeat(64),triangles:80,bytes:4000}}});
  assert.equal(context.acceptedRevision,8);assert.deepEqual(context.selectedRefs,refs);
  assert.equal(context.entities[0].label,'Garden oak');assert.equal(context.entities[0].scope,'canopy');
  assert.deepEqual(context.entities[0].placement.position,[2,0,-4]);
  assert.equal(context.entities[1].asset.hash,'a'.repeat(64));
  assert.equal(context.entities[1].asset.provenance.revisionId,'r2');
  assert.equal(context.entities[1].behavior.type,'hinge');
  context.entities[0].placement.position[0]=100;
  assert.equal(world.scene.objects[0].position[0],2);
});
test('legacy selection resolves one whole entity and explicit empty refs clear it',()=>{
  assert.deepEqual(resolveSelectionContext(world,{selection:'gate'}).selectedRefs,[{id:'gate',part:null}]);
  assert.deepEqual(resolveSelectionContext(world,{selectedRefs:[],selection:'gate'}).entities,[]);
  assert.throws(()=>resolveSelectionContext(world,{selectedRefs:[{id:'gone',part:null}]}),/no longer exists/);
  assert.throws(()=>resolveSelectionContext(world,{selectedRefs:[{id:'gate',part:'canopy'}]}),/part/);
});

test('a scatter instance is referenced as its scatter record with the placed count',()=>{
  const terrain={type:'heightfield',bounds:[-20,20,-20,20],segments:[16,16],baseHeight:1,stamps:[]};
  const scatter={id:'ferns',label:'Fern bed',seed:3,variants:[{asset:'gate-kit'}],region:{polygon:[[-10,-10],[10,-10],[10,10],[-10,10]]},density:5,maxCount:12,minSpacing:1};
  const scattered={...world,scene:{...world.scene,terrain,scatters:[scatter]}};
  const context=resolveSelectionContext(scattered,{selectedRefs:[{id:'ferns',part:null}]});
  assert.deepEqual(context.entities,[{id:'ferns',label:'Fern bed',scope:'whole',availableParts:[],scatter:{...scatter,placed:12}}]);
  assert.throws(()=>resolveSelectionContext(scattered,{selectedRefs:[{id:'ferns',part:'canopy'}]}),/Unsupported selected part/);
});
