import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BELOW_HORIZON,CLOUD_FLOOR,CLOUD_SEA_DEFAULTS,CUMULUS_DEFAULTS,MAX_GRID_PROBES,cloudHorizonFade,cloudSeaReach,gridResolution,resolveSky,skyBase,skyGradient,skyRadianceScale,validateSky} from './sky.mjs';
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

test('clouds are lit in the sun colour unless cloudLight sets their own (H109)',()=>{
  assert.equal(resolveSky({...environment,sky:{zenithColor:'#3d7fc4'}}).cloudLight,'#fff0d6');
  assert.equal(resolveSky({...environment,sky:{zenithColor:'#3d7fc4',cloudLight:'#fbf8f2'}}).cloudLight,'#fbf8f2');
  for(const cloudLight of ['white','#fff',null,7])assert.throws(()=>validateSky({zenithColor:'#3d7fc4',cloudLight}),/cloudLight must be a #rrggbb colour/);
});

test('the gradient meets the fog at the horizon and reaches the zenith colour overhead',()=>{
  const sky=resolveSky({...environment,sky:{zenithColor:'#3d7fc4'}});
  assert.deepEqual(skyGradient(sky,0),linearHex('#d6e5ec'));assert.deepEqual(skyGradient(sky,-.3),linearHex('#d6e5ec'));
  skyGradient(sky,1).forEach((v,i)=>assert.ok(Math.abs(v-linearHex('#3d7fc4')[i])<1e-12));
  const low=skyGradient(sky,.1),steep=skyGradient({...sky,curve:1.5},.1);
  assert.ok(low[2]-linearHex('#d6e5ec')[2]<0&&Math.abs(steep[0]-linearHex('#d6e5ec')[0])<Math.abs(low[0]-linearHex('#d6e5ec')[0]),'a larger curve keeps the horizon colour higher');
});

test('below the horizon the dome meets fully fogged water, so a finite ocean has no edge from above',()=>{
  // Crescent Cove: an authored horizon bluer than its fog. From 55 m up, its 2 km ocean ends below the horizon.
  const sky=resolveSky({...environment,sky:{zenithColor:'#1e5eba',horizonColor:'#b0cfea'}});
  assert.deepEqual(skyBase(sky,'#d6e5ec',.2),skyGradient(sky,.2),'the authored gradient is unchanged above the horizon');
  assert.deepEqual(skyBase(sky,'#d6e5ec',0),linearHex('#b0cfea'),'the horizon line keeps the authored colour');
  assert.deepEqual(skyBase(sky,'#d6e5ec',-BELOW_HORIZON),linearHex('#d6e5ec'));
  assert.deepEqual(skyBase(sky,'#d6e5ec',-.3),linearHex('#d6e5ec'),'past the ocean edge the dome is the fog colour');
  const half=skyBase(sky,'#d6e5ec',-BELOW_HORIZON/2);
  half.forEach((v,i)=>assert.ok(Math.abs(v-(linearHex('#b0cfea')[i]+linearHex('#d6e5ec')[i])/2)<1e-12,'a smooth blend, not a step'));
});

test('clouds fade in only above the plane floor, where they would smear into streaks',()=>{
  for(const height of [0,.5,1]){
    const floor=CLOUD_FLOOR/(1-.9*height);
    assert.equal(cloudHorizonFade(height,floor*.99),0,`height ${height}: nothing under the floor`);
    assert.equal(cloudHorizonFade(height,floor+.03+.06*height),1);
    assert.ok(cloudHorizonFade(height,floor+.015)>0&&cloudHorizonFade(height,floor+.015)<1);
  }
});

test('sky light and the cloud sea validate their fields and take defaults',()=>{
  const sky={zenithColor:'#2f6fc0',light:{intensity:1.4},cloudSea:{height:-60,coverage:.85,scale:1.5,drift:[1.2,-.4]}};
  assert.equal(validateSky(sky),sky);
  assert.doesNotThrow(()=>validateSky({zenithColor:'#2f6fc0',light:{},cloudSea:{height:-60}}));
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',light:true}),/sky light must be an object/);
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',light:{intensity:4}}),/sky light intensity/);
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',light:{ground:'#ffffff'}}),/Unknown sky light field ground/);
  assert.doesNotThrow(()=>validateSky({zenithColor:'#2f6fc0',light:{probe:[0,1.7,-20]}}));
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',light:{probe:[0,1.7]}}),/sky light probe/);
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',cloudSea:{}}),/cloudSea height/);
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',cloudSea:{height:-60,coverage:1.2}}),/cloudSea coverage/);
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',cloudSea:{height:-60,drift:[0]}}),/cloudSea drift/);
  assert.throws(()=>validateSky({zenithColor:'#2f6fc0',cloudSea:{height:-60,color:'#ffffff'}}),/Unknown sky cloudSea field color/);
  // Contrast and haze tune the deck (H103); the defaults are the H81 look.
  assert.doesNotThrow(()=>validateSky({zenithColor:'#2f6fc0',cloudSea:{height:-60,contrast:1,haze:.05}}));
  for(const change of [{contrast:-.1},{contrast:1.5},{haze:0},{haze:1.2},{contrast:'1'}])assert.throws(()=>validateSky({zenithColor:'#2f6fc0',cloudSea:{height:-60,...change}}),/cloudSea (contrast|haze)/,JSON.stringify(change));
  assert.equal(CLOUD_SEA_DEFAULTS.contrast,.5);assert.equal(CLOUD_SEA_DEFAULTS.haze,.3);
  const resolved=resolveSky({...environment,sky:{zenithColor:'#2f6fc0',light:{},cloudSea:{height:-60}}});
  assert.deepEqual(resolved.light,{intensity:.6});
  assert.deepEqual(resolved.cloudSea,{...CLOUD_SEA_DEFAULTS,height:-60});
  const plain=resolveSky({...environment,sky:{zenithColor:'#2f6fc0'}});
  assert.equal(plain.light,null);assert.equal(plain.cloudSea,null,'without the records the sky is unchanged');
});

test('a view ray meets the cloud deck only looking down from above it',()=>{
  assert.equal(cloudSeaReach(20,-60,-1),80,'straight down from 80 m above the deck');
  assert.ok(Math.abs(cloudSeaReach(20,-60,-.5)-160)<1e-9,'a 30 degree ray travels twice as far');
  assert.equal(cloudSeaReach(20,-60,0),Infinity,'level rays never meet it');
  assert.equal(cloudSeaReach(20,-60,.3),Infinity);
  assert.equal(cloudSeaReach(-80,-60,-1),Infinity,'from under the deck there is no deck below');
});

test('worlds accept environment.sky on schema 2 only',()=>{
  const world=v=>({schemaVersion:v,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{...environment,sky:{zenithColor:'#3d7fc4'}},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/hearth-cove.glb'}],objects:[],moodboard:null,...(v===2?{runtime:{modules:['scene.static@1','collision.boxes@1','camera.walk-orbit@1'],spawn:[0,0,0],look:[0,0],overview:[0,10,10],target:[0,0,0],blockers:[]}}:{})}});
  assert.throws(()=>validateWorld(world(1)),/environment/);
  try{validateWorld(world(2));}catch(e){assert.doesNotMatch(e.message,/sky|environment/i,'any failure is unrelated to the sky');}
  const bad=world(2);bad.scene.environment.sky={zenithColor:'nope'};
  assert.throws(()=>validateWorld(bad),/zenithColor/);
});

test('a sky light may add a warm ground bounce, validated and resolved (H76)',()=>{
  const sky={zenithColor:'#1a72d4',light:{intensity:.5,bounce:{color:'#e8c9a0',intensity:.4}}};
  assert.equal(validateSky(sky),sky);
  assert.deepEqual(resolveSky({fogColor:'#f2efe8',sky}).light.bounce,{color:'#e8c9a0',intensity:.4});
  for(const bounce of [{color:'warm',intensity:.4},{color:'#e8c9a0'},{color:'#e8c9a0',intensity:3},{color:'#e8c9a0',intensity:.4,spread:1},[1]])assert.throws(()=>validateSky({zenithColor:'#1a72d4',light:{bounce}}),/bounce/);
});

test('a world grade picks the tone mapping, and the default is unchanged (H77)',async()=>{
  const {GRADE_DEFAULTS,resolveGrade,validateGrade}=await import('./grade.mjs');
  assert.deepEqual(resolveGrade({}),{toneMapping:'aces',highlights:null});assert.deepEqual(GRADE_DEFAULTS,{toneMapping:'aces'});
  assert.deepEqual(resolveGrade({grade:{toneMapping:'neutral'}}),{toneMapping:'neutral',highlights:null});
  assert.deepEqual(validateGrade({toneMapping:'agx'}),{toneMapping:'agx'});
  for(const grade of [{toneMapping:'reinhard'},{exposure:3},{exposure:'1'},{contrast:1},[]])assert.throws(()=>validateGrade(grade),/[Gg]rade/);
  // Saved revisions with the legacy grade.exposure still read; environment.exposure wins and is the documented field.
  assert.deepEqual(validateGrade({toneMapping:'neutral',exposure:1.05}),{toneMapping:'neutral',exposure:1.05});
  assert.deepEqual(resolveGrade({grade:{toneMapping:'neutral',exposure:1.05}}),{toneMapping:'neutral',highlights:null});
  const {resolveLighting}=await import('./lighting.mjs');
  assert.equal(resolveLighting({grade:{exposure:1.05}}).exposure,1.05);assert.equal(resolveLighting({}).exposure,1.12);assert.equal(resolveLighting({exposure:.9}).exposure,.9);
});
test('a cumulus bank stands on part of the horizon, validated and resolved with defaults (H92)',()=>{
  const sky={zenithColor:'#1f8ad8',cumulus:{toward:[0,-1]}};
  assert.deepEqual(validateSky(sky),sky);
  assert.deepEqual(resolveSky({fogColor:'#f4ecdc',sky}).cumulus,[{...CUMULUS_DEFAULTS,toward:[0,-1]}],'one bank resolves to a list of one');
  assert.equal(resolveSky({fogColor:'#f4ecdc',sky:{zenithColor:'#1f8ad8'}}).cumulus,null);
  for(const cumulus of [{},{toward:[0,0]},{toward:[1]},{toward:[0,-1],spread:1},{toward:[0,-1],height:60},{toward:[0,-1],scale:9},{toward:[0,-1],colour:'#fff'},'north'])
    assert.throws(()=>validateSky({zenithColor:'#1f8ad8',cumulus}),/cumulus/);
});

test('up to six cumulus banks stand on different parts of the horizon (H114)',()=>{
  const ring=[{toward:[0,-1],spread:20,height:30},{toward:[1,0],spread:12},{toward:[-1,.3],height:20,scale:1.4}];
  assert.doesNotThrow(()=>validateSky({zenithColor:'#1f8ad8',cumulus:ring}));
  assert.deepEqual(resolveSky({fogColor:'#f4ecdc',sky:{zenithColor:'#1f8ad8',cumulus:ring}}).cumulus,ring.map(bank=>({...CUMULUS_DEFAULTS,...bank})));
  assert.throws(()=>validateSky({zenithColor:'#1f8ad8',cumulus:[]}),/one bank or a list of 1 to 6/);
  assert.throws(()=>validateSky({zenithColor:'#1f8ad8',cumulus:Array.from({length:7},()=>({toward:[0,-1]}))}),/one bank or a list of 1 to 6/);
  assert.throws(()=>validateSky({zenithColor:'#1f8ad8',cumulus:[{toward:[0,-1]},{toward:[0,0]}]}),/cumulus toward must not be/,'every bank is checked');
});

test('sky radiance sun lights the sky with the sun (H123)',()=>{
 const sky={zenithColor:'#3d7fc4'};
 assert.equal(skyRadianceScale({sunIntensity:3.6,sky}),1,'display by default: colours drawn as they are');
 assert.equal(skyRadianceScale({sunIntensity:3.6,sky:{...sky,radiance:'display'}}),1);
 assert.ok(Math.abs(skyRadianceScale({sunIntensity:Math.PI,sky:{...sky,radiance:'sun'}})-1)<1e-12,'a #ffffff sky matches white stone facing the sun');
 assert.ok(Math.abs(skyRadianceScale({sunIntensity:6,sky:{...sky,radiance:'sun'}})-6/Math.PI)<1e-12,'and rises with the sun');
 assert.equal(skyRadianceScale({sunIntensity:6}),1,'the analytic sky is unchanged');
 assert.equal(resolveSky({fogColor:'#d6e5ec',sky:{...sky,radiance:'sun'}}).radiance,'sun');
 validateSky({...sky,radiance:'sun'});
 assert.throws(()=>validateSky({...sky,radiance:'hdr'}),/sky radiance must be one of display, sun/);
});

test('cloudSea model cumulus and its towers validate (H125)',()=>{
 const sky=sea=>({zenithColor:'#3d7fc4',cloudSea:{height:-80,...sea}});
 validateSky(sky({model:'cumulus',towers:.5}));validateSky(sky({model:'billows'}));
 assert.throws(()=>validateSky(sky({model:'volume'})),/cloudSea model must be one of billows, cumulus/);
 assert.throws(()=>validateSky(sky({towers:.5})),/towers needs model cumulus/);
 assert.throws(()=>validateSky(sky({model:'cumulus',towers:2})),/cloudSea towers/);
 assert.equal(resolveSky({fogColor:'#d6e5ec',sky:sky({model:'cumulus'})}).cloudSea.model,'cumulus');
});

test('the sky light probe grid validates its box, spacing, bounces and probe count (H127)',()=>{
 const sky=grid=>({zenithColor:'#3d7fc4',light:{grid}});
 validateSky(sky({min:[-20,-2,-140],max:[48,30,6],spacing:8,bounces:2,intensity:1.2}));
 assert.deepEqual(gridResolution({min:[-20,-2,-140],max:[48,30,6],spacing:8}),[10,5,19],'one probe every spacing metres');
 assert.deepEqual(gridResolution({min:[0,0,0],max:[1,1,1],spacing:8}),[2,2,2],'at least two per axis');
 assert.throws(()=>validateSky(sky({min:[0,0,0],max:[0,10,10]})),/min must be below max/);
 assert.throws(()=>validateSky(sky({min:[0,0,0],max:[10,10,10],bounces:3})),/bounces must be 0, 1 or 2/);
 assert.throws(()=>validateSky(sky({min:[-500,-50,-500],max:[500,50,500],spacing:4})),new RegExp(`at most ${MAX_GRID_PROBES}`));
 assert.throws(()=>validateSky(sky({min:[0,0,0],max:[10,10,10],step:2})),/Unknown sky light grid field step/);
});
