import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';
import {createTerrain} from './terrain.mjs';
import {expandScatters,placedObjects,insideKeepOut,tiltedRotation,seededRandom} from './scatter.mjs';
import {placedSourceTriangles,MAX_PLACEMENTS} from './asset-budget.mjs';
import {WorldRuntime} from './runtime.mjs';
import {diffProposal,summarizeProposal} from './proposal-diff.mjs';

// An independent island fixture: a 6 m rise in a 120 m sea at level 0.
const terrain={type:'heightfield',bounds:[-60,60,-60,60],segments:[96,96],baseHeight:-4,stamps:[{id:'island',center:[0,0],radius:[46,40],height:10,plateau:.3,falloff:2}]};
const water={type:'ocean',bounds:[-60,60,-60,60],level:0,waves:[]};
const assets=['palm-tall','palm-lean','palm-arch','fern','shrub','rock'].map(id=>({id,file:`assets/imports/${id}.glb`}));
// Routes, the shelter, the jetty and a sightline, as a hand-written planner would avoid them.
const keepOut=[{path:[[-30,0],[-6,2],[10,-4],[34,-2]],width:3},{circle:[-4,12,6]},{polygon:[[24,-8],[40,-8],[40,-4],[24,-4]]},{path:[[0,-30],[0,30]],width:4}];
const grove={id:'grove-palms',seed:1207,variants:[{asset:'palm-tall',weight:3},{asset:'palm-lean',weight:2},{asset:'palm-arch',weight:1}],region:{polygon:[[-34,-26],[30,-26],[34,24],[-30,28]]},limits:{height:[.6,12],slope:[0,24],waterDepth:[-99,-.3]},density:3.2,maxCount:110,minSpacing:3.2,jitter:{scale:[.85,1.15],yaw:[0,6.283],lean:[0,.12]},keepOut};
const undergrowth={id:'undergrowth',seed:44,variants:[{asset:'fern',weight:3},{asset:'shrub',weight:1}],region:{polygon:[[-34,-26],[30,-26],[34,24],[-30,28]]},limits:{height:[.4,12],slope:[0,30]},density:9,maxCount:300,minSpacing:1.2,jitter:{scale:[.7,1.3],yaw:[0,6.283]},conform:.6,keepOut,avoid:['grove-palms']};
const scene=(scatters,objects=[])=>({environment:{type:'construct',clearPath:true,groundColor:'#abb492',fogColor:'#eee2c9',sunColor:'#ffd6a0',sunIntensity:3.3},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'},...assets],objects,terrain,water,scatters,
 runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1','terrain.heightfield@1','water.ocean@1','scatter.seeded@1'],spawn:[0,1.72,0],look:[0,0],overview:[10,15,20],target:[0,0,0],bounds:[-60,60,-60,60],blockers:[]}});
const world=s=>({...structuredClone(DEFAULT_WORLD),schemaVersion:2,scene:s});
const surface=createTerrain(terrain);

test('the same record always expands to the same placements',()=>{
 const a=expandScatters(scene([grove,undergrowth])),b=expandScatters(structuredClone(scene([grove,undergrowth])));
 assert.notEqual(a,b);assert.deepEqual(a.placements,b.placements);
 // A fixed snapshot guards against accidental changes to the sampling order.
 const first=a.placements.slice(0,3).map(p=>[p.id,p.asset,...p.position.map(v=>Math.round(v*1e4)/1e4)]);
 assert.deepEqual(first,SNAPSHOT);
 const r=seededRandom(7);assert.deepEqual([r(),r()].map(v=>Math.round(v*1e9)),[SEEDED[0],SEEDED[1]]);
});

test('a grove and its undergrowth are two records with the same keep-outs',()=>{
 const s=scene([grove,undergrowth]),{placements,stats}=expandScatters(s);
 const palms=placements.filter(p=>p.scatter==='grove-palms'),ground=placements.filter(p=>p.scatter==='undergrowth');
 assert.equal(stats[0].placed,palms.length);assert.equal(stats[1].placed,ground.length);
 // Turn 3 listed 103 palms; turn 4 added a few hundred ground plants.
 assert.ok(palms.length>=95&&palms.length<=110,`palms ${palms.length}`);
 assert.ok(ground.length>=250&&ground.length<=300,`undergrowth ${ground.length}`);
 for(const p of placements){
  const [x,y,z]=p.position,g=surface.sample(x,z);
  assert.ok(!keepOut.some(k=>insideKeepOut(k,x,z)),`${p.id} is inside a keep-out`);
  assert.ok(Math.abs(y-g.height)<1e-9,`${p.id} is not on the terrain`);
  assert.ok(g.height>=(p.scatter==='grove-palms'?.6:.4)&&g.slope*180/Math.PI<=(p.scatter==='grove-palms'?24:30));
  if(p.scatter==='grove-palms')assert.ok(water.level-g.height<=-.3);
  assert.ok(new Set(['palm-tall','palm-lean','palm-arch','fern','shrub']).has(p.asset));
 }
 const spaced=(list,other,min)=>{for(const p of list)for(const q of other)if(p!==q)assert.ok(Math.hypot(p.position[0]-q.position[0],p.position[2]-q.position[2])>=min-1e-9,`${p.id} and ${q.id} are closer than ${min}`);};
 spaced(palms,palms,grove.minSpacing);spaced(ground,ground,undergrowth.minSpacing);spaced(ground,palms,undergrowth.minSpacing);
 assert.ok(placements.every(p=>/^(grove-palms|undergrowth)#\d+$/.test(p.id)));
 assert.equal(new Set(placements.map(p=>p.id)).size,placements.length);
 // Two records replace the hand-listed placements, in a small fraction of the JSON.
 assert.ok(JSON.stringify([grove,undergrowth]).length*20<JSON.stringify(placements).length);
});

test('removing an instance keeps every other instance in place',()=>{
 const before=expandScatters(scene([grove])).placements,after=expandScatters(scene([{...grove,removed:[3,17]}])).placements;
 assert.equal(after.length,before.length-2);
 assert.deepEqual(after,before.filter(p=>!['grove-palms#3','grove-palms#17'].includes(p.id)));
 assert.equal(expandScatters(scene([{...grove,removed:[3,17]}])).stats[0].removed,2);
});

test('density is primary and maxCount is a hard cap; limits can empty a region',()=>{
 const count=extra=>expandScatters(scene([{...grove,keepOut:[],...extra}])).stats[0];
 const sparse=count({density:.1,maxCount:1200}),capped=count({density:5,maxCount:40});
 assert.equal(sparse.target,Math.round(.1*3336/100));assert.equal(sparse.placed,sparse.target);
 assert.equal(capped.target,40);assert.equal(capped.placed,40);
 assert.equal(count({limits:{height:[20,30]}}).placed,0);
 // Underwater only: depth measured from the water level down to the terrain.
 const sea=expandScatters(scene([{...grove,id:'reef-rocks',keepOut:[],region:{polygon:[[-58,-58],[58,-58],[58,58],[-58,58]]},limits:{waterDepth:[1,3]},variants:[{asset:'rock'}],minSpacing:2}]));
 assert.ok(sea.placements.length>20);
 for(const p of sea.placements){const d=water.level-surface.sample(p.position[0],p.position[2]).height;assert.ok(d>=1&&d<=3);}
});

test('expanded placements count against the shared placement and triangle budgets',()=>{
 const s=scene([grove,undergrowth]),{placements}=expandScatters(s);
 validateWorld(world(s));
 const triangles=Object.fromEntries([['cove',{triangles:1000}],...assets.map(a=>[a.id,{triangles:a.id.startsWith('palm')?2000:100}])]);
 const palms=placements.filter(p=>p.scatter==='grove-palms').length;
 assert.equal(placedSourceTriangles(s,triangles),1000+palms*2000+(placements.length-palms)*100);
 assert.equal(placedObjects(s).length,placements.length);
 const listed=Array.from({length:MAX_PLACEMENTS-placements.length+1},(_,i)=>({id:`stone-${i}`,asset:'rock',position:[50,0,50],rotation:[0,0,0],scale:[1,1,1],collider:null}));
 assert.throws(()=>validateWorld(world(scene([grove,undergrowth],listed))),new RegExp(`exceeds ${MAX_PLACEMENTS} placements: ${listed.length} authored plus scatters grove-palms \\d+, undergrowth \\d+`));
});

test('scatter records are validated before expansion',()=>{
 const bad=(extra,pattern,modules)=>{const s=scene([{...grove,...extra}]);if(modules)s.runtime.modules=modules;assert.throws(()=>validateWorld(world(s)),pattern);};
 bad({variants:[{asset:'missing'}]},/Missing asset missing/);
 bad({variants:[{asset:'cove'}]},/cannot scatter the origin/);
 bad({maxCount:1201},/maxCount/);
 bad({density:0},/density/);
 bad({avoid:['undergrowth']},/only avoid scatters listed before it/);
 bad({removed:[200]},/removed/);
 bad({region:{polygon:[[0,0],[1,1],[2,2]]}},/no area/);
 bad({keepOut:[{circle:[0,0,-1]}]},/keep-out circle/);
 bad({extra:true},/Invalid scatter fields/);
 bad({},/scene.scatters requires scatter.seeded@1/,['collision.boxes@1','camera.walk-orbit@1','terrain.heightfield@1','water.ocean@1']);
 const s=scene([grove],[{id:'grove-palms',asset:'rock',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null}]);
 assert.throws(()=>validateWorld(world(s)),/shares an ID with a placement/);
});

test('tilted rotations are three.js XYZ Euler angles with the requested up and heading',()=>{
 const matrix=([x,y,z])=>{const [cx,sx,cy,sy,cz,sz]=[Math.cos(x),Math.sin(x),Math.cos(y),Math.sin(y),Math.cos(z),Math.sin(z)];
  // three.js Euler XYZ: Rx * Ry * Rz.
  return [[cy*cz,-cy*sz,sy],[cx*sz+sx*sy*cz,cx*cz-sx*sy*sz,-sx*cy],[sx*sz-cx*sy*cz,sx*cz+cx*sy*sz,cx*cy]];};
 assert.deepEqual(tiltedRotation([0,1,0],2.5),[0,2.5,0]);
 for(const [up,yaw] of [[[.1,.99,0],.3],[[0,.95,.31],2.8],[[-.2,.9,-.2],-1.4],[[.05,.998,.03],4.6]]){
  const n=Math.hypot(...up),u=up.map(v=>v/n),m=matrix(tiltedRotation(u,yaw));
  [0,1,2].forEach(i=>assert.ok(Math.abs(m[i][1]-u[i])<1e-9,'up column'));
  // Heading: tilt about a horizontal axis keeps +X close to the yawed direction.
  const heading=Math.atan2(-m[2][0],m[0][0]),delta=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw));
  assert.ok(Math.abs(delta)<.35,`heading ${heading} for yaw ${yaw}`);
 }
});

test('scatter colliders block the runtime with each instance heading',()=>{
 const s=scene([{...grove,collider:{type:'box',size:[.6,4,.6],offset:[0,2,0]}}]),runtime=new WorldRuntime(s),p=runtime.placed.find(o=>o.scatter==='grove-palms');
 assert.equal(runtime.placed.length,expandScatters(s).placements.length);
 assert.equal(runtime.collisionAt(p.position[0],p.position[2],.22,p.position[1],1.72),p.id);
 assert.equal(runtime.yaw(p),p.yaw);
});

test('the proposal diff reports scatter records with their instance counts',()=>{
 const accepted={bible:{},references:[],scene:scene([grove])},proposed={bible:{},references:[],scene:scene([{...grove,density:.4},undergrowth])};
 const diff=diffProposal(accepted,proposed),lines=summarizeProposal(diff);
 assert.deepEqual(diff.scene.scatters.added.map(s=>s.id),['undergrowth']);
 assert.deepEqual(diff.scene.scatters.changed[0].fields,['density']);
 assert.ok(diff.scene.scatters.changed[0].before>diff.scene.scatters.changed[0].after);
 assert.ok(lines.some(l=>/^Scatters: \+undergrowth \(\d+\); grove-palms density \(\d+ → \d+\)$/.test(l)),lines.join('\n'));
});

const SNAPSHOT=[['grove-palms#0','palm-arch',3.1738,5.4956,16.2305],['grove-palms#1','palm-tall',3.0344,4.0767,20.7224],['grove-palms#2','palm-tall',-15.7462,5.8643,-3.9704]];
const SEEDED=[11704753,61958258];
