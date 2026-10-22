import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSky,skyGradient,validateSky} from './sky.mjs';
import {linearHex} from './water-optics.mjs';
import {validateWorld} from './contract.mjs';

const environment={type:'construct',clearPath:true,groundColor:'#c9b994',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3};

test('sky settings validate colours, ranges and unknown keys',()=>{
  assert.equal(validateSky({zenithColor:'#3d7fc4'}).zenithColor,'#3d7fc4');
  assert.throws(()=>validateSky({}),/zenithColor/);
  assert.throws(()=>validateSky({zenithColor:'blue'}),/zenithColor/);
  assert.throws(()=>validateSky({zenithColor:'#3d7fc4',horizonColor:'#fff'}),/horizonColor/);
  assert.throws(()=>validateSky({zenithColor:'#3d7fc4',curve:3}),/curve/);
  assert.throws(()=>validateSky({zenithColor:'#3d7fc4',haze:1}),/Unknown environment sky field haze/);
  assert.throws(()=>validateSky({zenithColor:'#3d7fc4',clouds:{coverage:2}}),/coverage/);
  assert.throws(()=>validateSky({zenithColor:'#3d7fc4',clouds:{drift:[9,0]}}),/drift/);
  assert.throws(()=>validateSky({zenithColor:'#3d7fc4',clouds:{type:'cirrus'}}),/Unknown sky clouds field type/);
});

test('the horizon defaults to the fog colour, and clouds take their defaults',()=>{
  assert.equal(resolveSky(environment),null,'no sky keeps the analytic dome');
  const sky=resolveSky({...environment,sky:{zenithColor:'#3d7fc4',clouds:{coverage:.5}}});
  assert.equal(sky.horizonColor,'#d6e5ec');assert.equal(sky.curve,.45);
  assert.deepEqual(sky.clouds,{coverage:.5,density:.5,height:.5,scale:1,drift:[.6,.2]});
  assert.equal(resolveSky({...environment,sky:{zenithColor:'#3d7fc4'}}).clouds,null);
});

test('the gradient meets the fog at the horizon and reaches the zenith colour overhead',()=>{
  const sky=resolveSky({...environment,sky:{zenithColor:'#3d7fc4'}});
  assert.deepEqual(skyGradient(sky,0),linearHex('#d6e5ec'));assert.deepEqual(skyGradient(sky,-.3),linearHex('#d6e5ec'));
  skyGradient(sky,1).forEach((v,i)=>assert.ok(Math.abs(v-linearHex('#3d7fc4')[i])<1e-12));
  const low=skyGradient(sky,.1),steep=skyGradient({...sky,curve:1.5},.1);
  assert.ok(low[2]-linearHex('#d6e5ec')[2]<0&&Math.abs(steep[0]-linearHex('#d6e5ec')[0])<Math.abs(low[0]-linearHex('#d6e5ec')[0]),'a larger curve keeps the horizon colour higher');
});

test('worlds accept environment.sky on schema 2 only',()=>{
  const world=v=>({schemaVersion:v,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{...environment,sky:{zenithColor:'#3d7fc4'}},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/hearth-cove.glb'}],objects:[],moodboard:null,...(v===2?{runtime:{modules:['scene.static@1','collision.boxes@1','camera.walk-orbit@1'],spawn:[0,0,0],look:[0,0],overview:[0,10,10],target:[0,0,0],blockers:[]}}:{})}});
  assert.throws(()=>validateWorld(world(1)),/environment/);
  try{validateWorld(world(2));}catch(e){assert.doesNotMatch(e.message,/sky|environment/i,'any failure is unrelated to the sky');}
  const bad=world(2);bad.scene.environment.sky={zenithColor:'nope'};
  assert.throws(()=>validateWorld(bad),/zenithColor/);
});
