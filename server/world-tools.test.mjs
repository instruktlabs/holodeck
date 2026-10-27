import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callWorldTool} from './world-tools.mjs';

// Reads every capabilities page and rebuilds the nested record.
async function read(schemaVersion){
  const world={schemaVersion,revision:1,scene:{runtime:null}},store={current:world,payload:()=>({world}),catalog:async()=>[]},out={};let cursor;
  do{const {data}=await callWorldTool('world_read',{section:'capabilities',...(cursor?{cursor}:{})},{store,propose:null,observe:()=>null});
    for(const [key,value] of Object.entries(data.capabilities)){if(key.startsWith('spatial.'))(out.spatial??={})[key.slice(8)]=value;else out[key]=value;}
    cursor=data.next;}while(cursor);
  return out;
}

// Facts the dogfood agents had to discover by trial or by reading engine
// sources. Each must reach the agent through world_read.
test('world_read states placement rotation order and units, including Kiln degrees',async()=>{
  for(const version of [1,2]){
    const {placements}=await read(version);
    assert.match(placements,/radians/);assert.match(placements,/Euler order XYZ/);assert.match(placements,/Kiln part rotation options are degrees/);
  }
});

test('world_read states the whole foliage wind contract and how Kiln part names bind',async()=>{
  const {foliage}=(await read(2)).spatial;
  for(const fact of ['TEXCOORD_0','UV.y0 at attachment to1 at tip','exactly one glTF node that carries a mesh','exactly one primitive','KHR_materials_unlit','Mesh_<name>','"Mesh_<name>"','.name to the exact binding name'])assert.ok(foliage.includes(fact),fact);
});

test('world_read lists every terrain appearance setting, what is fixed, and how texture layers reach terrain',async()=>{
  const {terrainAppearance,terrainRendering,terrainLayers,examples}=(await read(2)).spatial;
  for(const key of ['sandColor','wetSandColor','grassColor','rockColor','grassStart','grassEnd','rockSlope','textureScale'])assert.ok(terrainAppearance.includes(key),key);
  for(const fact of ['Fixed for this base blend','wet band','roughness','appearance.layers','Kiln materials and GLBs cannot reach the terrain'])assert.ok(terrainAppearance.includes(fact),fact);
  for(const fact of ['at most 4','PNG paths inside assets/imports','pins their bytes by hash','power-of-two size up to 2048','green up','32 MiB','128 MiB','metres per texture repeat','triplanar','near','scatter IDs','paint','row 0 at zmin','fades smoothly'])assert.ok(terrainLayers.includes(fact),fact);
  const {validateTerrainLayers}=await import('../src/world/terrain-layers.mjs');validateTerrainLayers([examples.terrainLayer]);
  assert.match(terrainRendering,/seabed/);
});

test('world_read says what each environment type renders',async()=>{
  const v2=await read(2),v1=await read(1);
  for(const text of [v2.environmentTypes,v2.spatial.environments])for(const fact of ['construct','meadow','With scene.terrain both types render identically','clearPath'])assert.ok(text.includes(fact),fact);
  assert.match(v1.environmentTypes,/woodland/);
});

test('world_read answers what can be set for terrain, water and sky without engine sources',async()=>{
  const {spatial}=await read(2),text=JSON.stringify(spatial);
  for(const field of ['bounds','segments','baseHeight','stamps','appearance','level','waves','color','shallowColor','foamWidth','sunPosition','sunColor','sunIntensity','fogColor','fogNear','fogFar'])assert.ok(text.includes(field),field);
  assert.match(spatial.waterRendering,/without it there is no reef-break surf or beach swash/);assert.match(spatial.waterRendering,/do not bake an underwater tint/);
  for(const field of ['breakDepth','whitewater','runUp','period'])assert.ok(spatial.surf.includes(field),field);
  assert.match(spatial.sky,/no environment.sky/);assert.match(spatial.sky,/default fogColor/);for(const field of ['zenithColor','coverage','drift'])assert.ok(spatial.sky.includes(field),field);
  const {validateSky}=await import('../src/world/sky.mjs'),{validateWater}=await import('../src/world/terrain.mjs');
  assert.equal(validateSky(spatial.examples.sky),spatial.examples.sky);assert.equal(validateWater(spatial.examples.water),spatial.examples.water);
});

test('world_read states proposal size limits and how to stage large scenes',async()=>{
  for(const version of [1,2]){
    const {proposals}=await read(version);
    for(const fact of ['complete scene','sceneFile naming a JSON file under assets/source','one pending proposal','4 MiB','output limit','220 bytes per placement','proposalId','one asset family per proposal'])assert.ok(proposals.includes(fact),fact);
  }
});

test('world_read advertises optional lighting defaults and bounds with a valid example',async()=>{
 const {spatial}=await read(2);
 for(const text of ['hemisphere','skyColor','groundColor','0..8','#f1eee2','#95806d','1.8','exposure','0.1..4','1.12','no shadows','schema2'])assert.ok(spatial.lighting.includes(text),text);
 assert.doesNotMatch(spatial.sky,/fixed hemisphere/);
 const {validateLighting,resolveLighting}=await import('../src/world/lighting.mjs');
 assert.equal(validateLighting(spatial.examples.lighting),spatial.examples.lighting);
 assert.deepEqual(resolveLighting({}),{hemisphere:{skyColor:'#f1eee2',groundColor:'#95806d',intensity:1.8},exposure:1.12});
 assert.equal((await read(1)).spatial,null);
});

test('world_read gives a budget strategy that leaves room for modular kits',async()=>{
  const {budgetStrategy,limits}=await read(2),{MAX_ASSETS,MAX_PLACEMENTS}=await import('../src/world/asset-budget.mjs');
  for(const fact of [`${MAX_ASSETS} unique assets`,`${MAX_PLACEMENTS} placements`,'modular kit','one draw per mesh part','one shared set of saved materials','two or three shaped variants per family','yaw','scale','lean'])assert.ok(budgetStrategy.includes(fact),fact);
  assert.ok(!/cap usually binds|leave a few asset slots/.test(budgetStrategy),'the asset cap is no longer the budget to plan around');
  assert.ok(limits.startsWith(`${MAX_ASSETS} assets (64 for schema 1), ${MAX_PLACEMENTS} placements, 32 MiB per GLB, 128 MiB per scene`),limits);
});

test('world_read describes scatter records, and its example expands on the example terrain',async()=>{
  const spatial=(await read(2)).spatial,{expandScatters}=await import('../src/world/scatter.mjs');
  assert.ok(spatial.modules.includes('scatter.seeded@1'));assert.match(spatial.activation,/scene.scatters requires scatter.seeded@1/);
  for(const fact of ['<scatter id>#<n>','per 100 m²','maxCount','minSpacing','waterDepth is water.level minus terrain height','keepOut','avoid lists earlier scatter IDs','removed lists instance indices','1200 placements and 2M placed triangles','selecting an instance selects its scatter record'])assert.ok(spatial.scatter.includes(fact),fact);
  const {placements}=expandScatters({terrain:spatial.examples.terrain,water:spatial.examples.water,scatters:[spatial.examples.scatter]});
  assert.ok(placements.length>=10,`${placements.length} example placements`);
  assert.doesNotMatch((await read(2)).budgetStrategy,/no scatter primitive/);
});
