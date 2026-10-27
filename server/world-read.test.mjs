import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_READ_LIMIT,WORLD_READ_SECTIONS,worldReadSection} from './world-read.mjs';
import {callWorldTool} from './world-tools.mjs';
import {MAX_ASSETS,MAX_PLACEMENTS} from '../src/world/asset-budget.mjs';

// A world well past the dogfood island: 2,000 objects over 64 assets, long
// asset metadata and a full mood board.
function bigWorld(){
  const assets=Array.from({length:64},(_,i)=>({id:`asset-${i}`,file:`assets/imports/asset-${i}-with-a-long-descriptive-name.glb`,materialStyle:'default'}));
  const objects=Array.from({length:2000},(_,i)=>({id:`piece-${i}`,asset:`asset-${i%64}`,position:[i%97*1.137,-2.5+i%11*.31,Math.floor(i/97)*2.413],rotation:[0,i*.0131%6.28,0],scale:[1.08,1.08,1.08],layer:i%3?'world':'origin',...(i%50===0?{collider:{type:'box',size:[1,2,1],offset:[0,1,0]}}:{})}));
  objects.push({id:'marker',shape:{type:'box',size:[1,1,1],color:'#ffffff'},position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
  const references=Array.from({length:200},(_,i)=>({id:`ref-${i}`,kind:'note',title:`Reference ${i}`,notes:'Warm light on wet sand. '.repeat(8),group:'Mood',status:'exploring',page:i%34,layout:{x:40,y:120,w:200,h:160}}));
  return {schemaVersion:2,revision:12,scene:{environment:{type:'construct',fogColor:'#d6e5ec'},runtime:{modules:['terrain.heightfield@1']},assets,objects},bible:{title:'Isle',intent:'Calm',rules:'Keep the reef visible. '.repeat(40)},references};
}
const source=(world=bigWorld())=>({world,hashes:Object.fromEntries(world.scene.assets.map(a=>[a.file,'f'.repeat(64)])),files:world.scene.assets.map(a=>a.file),workspace:'/w',diagnostic:null,capabilities:{schemaVersion:2,spatial:{a:'x'.repeat(9000),b:'y'.repeat(9000),c:'z'.repeat(9000)},limits:'64 assets'}});
const bytes=value=>JSON.stringify(value).length;
function all(src,section,extra={}){
  const pages=[];let cursor;
  do{const data=worldReadSection(src,{section,...extra,...(cursor?{cursor}:{})});pages.push(data);cursor=data.next;}while(cursor);
  return pages;
}

test('every world_read section stays under the measured tool output limit',()=>{
  const src=source();
  for(const section of WORLD_READ_SECTIONS)for(const data of all(src,section))assert.ok(bytes(data)<=WORLD_READ_LIMIT,`${section} page ${data.start} is ${bytes(data)} bytes`);
});

test('the overview groups objects by asset and carries no object list',()=>{
  const src=source(),overview=worldReadSection(src);
  assert.equal(overview.section,'overview');assert.equal(overview.revision,12);
  assert.equal(overview.scene.objects,undefined);assert.equal(overview.scene.assets,undefined);
  assert.deepEqual(overview.counts,{objects:2001,scatters:0,assets:64,files:64,references:200});
  assert.equal(overview.objectsByAsset.reduce((sum,g)=>sum+g.count,0),2001);
  const first=overview.objectsByAsset.find(g=>g.asset==='asset-0');
  assert.equal(first.count,32);assert.deepEqual(first.layers.sort(),['origin','world']);assert.equal(first.colliders,2,'pieces 0 and 1600');
  assert.ok(overview.objectsByAsset.some(g=>g.asset==='shape:box'));
  assert.equal(overview.bible.title,'Isle');assert.match(overview.sections,/world\/world\.json/);
});

test('objects page in scene order, each exactly once, and filter by asset',()=>{
  const src=source(),pages=all(src,'objects'),ids=pages.flatMap(p=>p.items.map(o=>o.id));
  assert.deepEqual(ids,src.world.scene.objects.map(o=>o.id));
  assert.ok(pages.length>1);assert.equal(pages.at(-1).next,null);assert.equal(pages[0].total,2001);
  const reef=all(src,'objects',{asset:'asset-3'}).flatMap(p=>p.items);
  assert.equal(reef.length,32);assert.ok(reef.every(o=>o.asset==='asset-3'));
  assert.equal(all(src,'objects',{asset:'shape:box'})[0].items[0].id,'marker');
});

test('asset entries carry their pinned hash, and other sections return their records',()=>{
  const src=source(),assets=all(src,'assets').flatMap(p=>p.items);
  assert.equal(assets.length,64);assert.equal(assets[0].hash,'f'.repeat(64));
  assert.equal(all(src,'references').flatMap(p=>p.items).length,200);
  const capabilities=Object.assign({},...all(src,'capabilities').map(p=>p.capabilities));
  assert.deepEqual(Object.keys(capabilities),['schemaVersion','spatial.a','spatial.b','spatial.c','limits']);
  assert.equal(worldReadSection(src,{section:'bible'}).bible.title,'Isle');
  assert.equal(worldReadSection(src,{section:'scene'}).settings.environment.fogColor,'#d6e5ec');
});

test('an oversized bible moves out of the overview instead of breaking the limit',()=>{
  const world=bigWorld();world.bible.rules='Long rule. '.repeat(3000);
  const overview=worldReadSection(source(world));
  assert.match(overview.bible,/read section bible/);assert.ok(bytes(overview)<=WORLD_READ_LIMIT);
});

test('a modular kit at the asset cap keeps every section under the limit and accounts for every object',()=>{
  const world=bigWorld();
  world.scene.assets=Array.from({length:MAX_ASSETS},(_,i)=>({id:`kit-piece-${i}`,file:`assets/imports/kit-piece-${i}-with-a-long-descriptive-name.glb`}));
  world.scene.objects=Array.from({length:MAX_PLACEMENTS},(_,i)=>({id:`p-${i}`,asset:`kit-piece-${i<MAX_ASSETS?i:i%7}`,position:[i%40*2.5,0,Math.floor(i/40)*2.5],rotation:[0,0,0],scale:[1,1,1],layer:'world'}));
  const src=source(world);
  for(const section of WORLD_READ_SECTIONS)for(const data of all(src,section))assert.ok(bytes(data)<=WORLD_READ_LIMIT,`${section} page ${data.start} is ${bytes(data)} bytes`);
  const overview=worldReadSection(src),shown=overview.objectsByAsset.reduce((n,g)=>n+g.count,0);
  assert.equal(shown+(overview.objectsByAssetOmitted?.objects??0),MAX_PLACEMENTS);
  assert.equal(overview.objectsByAsset.length+(overview.objectsByAssetOmitted?.groups??0),Math.min(MAX_ASSETS,MAX_PLACEMENTS));
  // The most-placed groups stay: the seven reused pieces carry most of the placements.
  for(let i=0;i<7;i++)assert.ok(overview.objectsByAsset.some(g=>g.asset===`kit-piece-${i}`),`kit-piece-${i}`);
  assert.equal(worldReadSection(src,{section:'objects',asset:`kit-piece-${Math.min(MAX_ASSETS,MAX_PLACEMENTS)-1}`}).total,1);
});

test('bad sections, assets and cursors give clear errors',()=>{
  const src=source(),next=worldReadSection(src,{section:'objects'}).next;
  assert.throws(()=>worldReadSection(src,{section:'everything'}),/Unknown world_read section/);
  assert.throws(()=>worldReadSection(src,{section:'objects',asset:'palm'}),/No objects use asset palm/);
  assert.throws(()=>worldReadSection(src,{section:'files',asset:'asset-1'}),/asset filters only the objects section/);
  assert.throws(()=>worldReadSection(src,{section:'bible',cursor:next}),/has no pages/);
  assert.throws(()=>worldReadSection(src,{section:'objects',cursor:'page-2'}),/Invalid world_read cursor/);
  assert.throws(()=>worldReadSection(src,{section:'objects',cursor:'r12:99999'}),/Invalid world_read cursor/);
  const moved={...src,world:{...src.world,revision:13}};
  assert.throws(()=>worldReadSection(moved,{section:'objects',cursor:next}),/changed to revision 13/);
});

test('world_read through the shared tool returns the overview by default',async()=>{
  const world=bigWorld(),store={current:world,payload:()=>({world,assets:{},textures:{},workspace:'/w',diagnostic:null}),catalog:async()=>[]};
  const {data}=await callWorldTool('world_read',{},{store});
  assert.equal(data.section,'overview');assert.ok(bytes(data)<=WORLD_READ_LIMIT);
  // The real capability text pages under the limit too.
  let cursor,pages=0;
  do{const caps=(await callWorldTool('world_read',{section:'capabilities',...(cursor?{cursor}:{})},{store})).data;pages++;
    assert.ok(bytes(caps)<=WORLD_READ_LIMIT,`capabilities page ${pages} is ${bytes(caps)} bytes`);
    assert.equal(caps.capabilities.runtime,undefined,'scene.runtime is in the overview, not repeated');cursor=caps.next;}while(cursor);
  assert.ok(pages>=2);
});
