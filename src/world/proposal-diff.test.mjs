import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diffProposal,summarizeProposal,placementGroup} from './proposal-diff.mjs';

const place=(id,asset,x=0)=>({id,asset,position:[x,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,layer:'world'});
const world=(objects,extra={})=>({schemaVersion:2,revision:5,bible:{title:'Cove',intent:'Explore',rules:'Walk the beach.\nKeep the jetty clear.',referenceIds:['a']},references:[{id:'a',kind:'note',title:'Brief',page:0,layout:{x:40,y:120,w:200,h:150}},{id:'b',kind:'note',title:'Palette',notes:'warm',page:0,layout:{x:300,y:120,w:200,h:150}}],scene:{environment:{type:'construct',fogColor:'#ffffff'},assets:[{id:'cove',file:'assets/imports/cove.glb'}],objects,...extra}});

test('a large asset pass reads as a few grouped lines with full detail kept',()=>{
  // Shaped like the dogfood turn 4 proposal: 28 new assets, 394 new placements.
  const base=world([place('cove-1','cove'),...Array.from({length:109},(_,i)=>place(`palm-${i}`,`palm-${i%4}`,i))]);
  const assets=Array.from({length:28},(_,i)=>({id:`kit-${String(i).padStart(2,'0')}`,file:`assets/imports/kit-${i}.glb`}));
  const added=Array.from({length:394},(_,i)=>place(`ground-${i}`,assets[i%28].id,i));
  const next={...base,revision:5,scene:{...base.scene,assets:[...base.scene.assets,...assets],objects:[...base.scene.objects,...added],terrain:{appearance:{sandColor:'#cdb994',rockSlope:.56}}}};
  base.scene.terrain={appearance:{sandColor:'#d8c49a',rockSlope:.62}};
  const diff=diffProposal(base,next),lines=summarizeProposal(diff);
  assert.deepEqual(lines,[
    'Placements: +394 across 28 asset groups (110 → 504)',
    'Assets: +28 (kit-00, kit-01, kit-02, kit-03 and 24 more)',
    'Terrain: appearance (rockSlope, sandColor)',
  ]);
  assert.equal(diff.scene.placements.groups.length,28);
  assert.equal(diff.scene.placements.groups.reduce((n,g)=>n+g.added.length,0),394);
  assert.ok(diff.scene.placements.groups.every(g=>g.added.length===14||g.added.length===15));
});

test('placements split into added, removed, moved and changed by asset group',()=>{
  const before=world([place('a','rock'),place('b','rock'),place('c','fern'),place('d','fern'),{id:'s',shape:{type:'box',size:[1,1,1],color:'#888888',offset:[0,0,0]},position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null}]);
  const after=world([{...place('a','rock'),position:[2,0,0]},{...place('b','rock'),collider:{type:'box',size:[1,1,1],offset:[0,0,0]}},place('c','palm'),place('e','fern'),before.scene.objects[4]]);
  const diff=diffProposal(before,after),groups=Object.fromEntries(diff.scene.placements.groups.map(g=>[g.key,g]));
  assert.deepEqual(groups.rock.moved,['a']);
  assert.deepEqual(groups.rock.changed,[{id:'b',fields:['collider']}]);
  assert.deepEqual(groups.palm.changed,[{id:'c',fields:['asset']}],'an asset swap is a change, not a move');
  assert.deepEqual(groups.fern.added,['e']);assert.deepEqual(groups.fern.removed,['d']);
  assert.equal(groups['shape:box'],undefined,'unchanged placements are not listed');
  assert.equal(placementGroup(before.scene.objects[4]),'shape:box');
  assert.deepEqual(diff.scene.placements.totals,{added:1,removed:1,moved:1,changed:2,before:5,after:5});
});

test('bible fields compare side by side and rules compare line by line',()=>{
  const before=world([]),after=world([]);
  after.bible={...before.bible,title:'Crescent Cove',rules:'Walk the beach.\nShade the grove.',referenceIds:['a','b']};
  const diff=diffProposal(before,after);
  assert.deepEqual(diff.bible.map(f=>f.field),['title','rules','referenceIds']);
  assert.deepEqual(diff.bible[0],{field:'title',before:'Cove',after:'Crescent Cove'});
  assert.deepEqual([diff.bible[1].added,diff.bible[1].removed],[['Shade the grove.'],['Keep the jetty clear.']]);
  assert.deepEqual(summarizeProposal(diff),['Bible: title, rules +1 −1, pinned references +1 −0']);
});

test('board cards moved, edited, added and removed are told apart',()=>{
  const before=world([]),after=world([]);
  after.references=[{...before.references[0],page:1},{...before.references[1],notes:'cool'},{id:'c',kind:'note',title:'Layout',page:0,layout:{x:40,y:300,w:200,h:150}}];
  before.references.push({id:'d',kind:'note',title:'Old'});
  const {board}=diffProposal(before,after);
  assert.deepEqual(board.moved.map(c=>c.id),['a']);
  assert.deepEqual(board.changed.map(c=>[c.id,c.fields]),[['b',['notes']]]);
  assert.deepEqual(board.added,[{id:'c',title:'Layout'}]);assert.deepEqual(board.removed,[{id:'d',title:'Old'}]);
  assert.deepEqual(summarizeProposal(diffProposal(before,after)),['Mood board cards: +1, −1, 1 moved, 1 edited']);
});

test('scene settings and terrain stamps are summarized, and no change says so',()=>{
  const before=world([],{terrain:{type:'heightfield',baseHeight:0,stamps:[{id:'hill',height:2},{id:'bay',height:-1}]}});
  const after=world([],{terrain:{type:'heightfield',baseHeight:-1,stamps:[{id:'hill',height:3},{id:'reef',height:1}]},water:{type:'ocean',level:0}});
  after.scene.environment={...before.scene.environment,fogColor:'#c5d9dd'};
  assert.deepEqual(summarizeProposal(diffProposal(before,after)),['Environment: fogColor','Water: level, type','Terrain: stamps +1 −1 ~1; baseHeight']);
  assert.deepEqual(summarizeProposal(diffProposal(before,structuredClone(before))),['No differences from the accepted world.']);
});

test('lighting changes and removal remain visible in proposal review',()=>{
 const before=world([]),after=structuredClone(before);
 Object.assign(after.scene.environment,{hemisphere:{skyColor:'#c9d9ed',intensity:.9},exposure:1.05});
 assert.deepEqual(summarizeProposal(diffProposal(before,after)),['Environment: exposure, hemisphere']);
 const revised=structuredClone(after);revised.scene.environment.hemisphere.intensity=0;
 assert.deepEqual(summarizeProposal(diffProposal(after,revised)),['Environment: hemisphere']);
 assert.deepEqual(summarizeProposal(diffProposal(after,before)),['Environment: exposure, hemisphere']);
});

test('a heightmap change reads as its hash, sample size and bounds, never its samples',()=>{
  const sampledHash='b1d9e0c4a7f2'+'3'.repeat(52),eroded='1a2b3c4d5e6f'+'7'.repeat(52);
  const heightmap=(sha256,extra={})=>({type:'heightmap',bounds:[-64,64,-48,80],size:[257,257],height:{file:`assets/imports/terrain/site-${sha256.slice(0,8)}.r32`,sha256,format:'r32'},stamps:[],...extra});
  const stamped=world([],{terrain:{type:'heightfield',bounds:[-40,40,-40,40],segments:[80,80],baseHeight:0,stamps:[{id:'basin',height:-6}]}});
  const sampled=world([],{terrain:heightmap(sampledHash)});
  const span='257×257 samples over x -64…64, z -48…80 m';
  const diff=diffProposal(stamped,sampled);
  assert.deepEqual(summarizeProposal(diff),[`Terrain: heightmap b1d9e0c4a7f2, ${span} (was heightfield 80×80 cells); stamps +0 −1 ~0`]);
  assert.deepEqual(diff.scene.settings[0].source,{before:{type:'heightfield',bounds:[-40,40,-40,40],segments:[80,80]},after:{type:'heightmap',sha256:sampledHash,size:[257,257],bounds:[-64,64,-48,80],segments:[256,256],scale:1,offset:0}});
  // New samples under a new file name say which samples they replace.
  assert.deepEqual(summarizeProposal(diffProposal(sampled,world([],{terrain:heightmap(eroded)}))),[`Terrain: heightmap 1a2b3c4d5e6f, ${span} (samples were b1d9e0c4a7f2)`]);
  // The same samples on a coarser lattice with a build pad name only what changed.
  const padded=world([],{terrain:heightmap(sampledHash,{segments:[128,128],stamps:[{id:'build-pad',operation:'flatten',center:[10,-12],radius:[12,9],height:0,plateau:.9}]})});
  assert.deepEqual(summarizeProposal(diffProposal(sampled,padded)),[`Terrain: heightmap b1d9e0c4a7f2, ${span} (segments changed); stamps +1 −0 ~0`]);
  // A renamed copy of the same bytes is the same source; only the file differs.
  const renamed=world([],{terrain:{...heightmap(sampledHash),height:{file:'assets/imports/terrain/restored.r32',sha256:sampledHash,format:'r32'}}});
  assert.deepEqual(summarizeProposal(diffProposal(sampled,renamed)),['Terrain: height']);
  assert.deepEqual(summarizeProposal(diffProposal(sampled,stamped)),[`Terrain: heightfield 80×80 cells (was heightmap b1d9e0c4a7f2, ${span}); stamps +1 −0 ~0`]);
  // The diff is a summary: the record and its hash, never sample data.
  assert.ok(JSON.stringify(diff).length<1500);
});
