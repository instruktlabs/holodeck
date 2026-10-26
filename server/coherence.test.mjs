import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkWorld,sampleWorldPoints} from './coherence.mjs';
import {withMaker} from '../src/world/inhabitant.mjs';
import {validateRuntimeScene} from '../src/world/runtime.mjs';
const template=JSON.parse(await readFile(new URL('../test/fixtures/courtyard-template.json',import.meta.url)));
const world={revision:4,schemaVersion:2,scene:{...template,assets:[],origin:'cove'}};
test('advisory findings never mutate, accept or reject a world revision',()=>{
 const before=JSON.stringify(world),r=checkWorld(world,{routes:[{id:'gate-route',from:[.5,1.72,-5],to:[.5,1.72,-9]}],now:1000});
 assert.equal(r.advisory,true);assert.equal(r.observation.status,'missing');assert.equal(r.checks.find(c=>c.id==='route:gate-route').status,'attention');assert.equal(JSON.stringify(world),before);assert.equal('coherent' in r,false);
});
test('fresh matching activity observations inform probes; stale observations do not',()=>{
 const observation={revision:4,receivedAt:new Date(1000).toISOString(),position:[.5,1.72,-5],originVisible:true,activity:{states:{'garden-gate':{angle:1.55,open:true}}}};
 const options={observation,routes:[{id:'gate-route',from:[.5,1.72,-5],to:[.5,1.72,-9]}],now:2000};
 assert.equal(checkWorld(world,options).checks.find(c=>c.id==='route:gate-route').status,'clear');
 const stale=checkWorld(world,{...options,now:20000});assert.equal(stale.observation.status,'stale');assert.equal(stale.checks.find(c=>c.id==='route:gate-route').status,'attention');
 const mismatch=checkWorld(world,{...options,observation:{...observation,revision:3}});assert.equal(mismatch.observation.status,'different-revision');
});
test('probe work is bounded and ground-plane limitations are explicit',()=>{
 assert.throws(()=>checkWorld(world,{routes:Array(9).fill({})}),/eight/);
 const r=checkWorld(world,{routes:[{id:'long',from:[-900,1.72,0],to:[900,1.72,0]}]});
 assert.ok(r.checks.find(c=>c.id==='route:long').evidence.samples<=65);assert.match(r.limits.join(' '),/not a traversal/);
});

test('fresh articulation and flock diagnostics are bounded advisory evidence, never a stale verdict',()=>{
 const observation={revision:4,receivedAt:new Date(1000).toISOString(),activity:{gaitDiagnostics:{bird:['Missing wing joint.']},states:{flock:{mode:'disabled',diagnostics:['Flight volume intersects terrain.']}}}};
 const report=checkWorld(world,{observation,now:2000}),finding=report.checks.find(c=>c.id==='runtime-bindings');
 assert.equal(finding.status,'attention');assert.deepEqual(finding.evidence.messages.map(m=>m.id),['bird','flock']);assert.equal(report.advisory,true);
 assert.equal(checkWorld(world,{observation,now:20000}).checks.some(c=>c.id==='runtime-bindings'),false);
 observation.activity.gaitDiagnostics=Object.fromEntries(Array.from({length:100},(_,i)=>[`entity-${i}`,Array(100).fill('x'.repeat(2000))]));
 const bounded=checkWorld(world,{observation,now:2000}).checks.find(c=>c.id==='runtime-bindings').evidence.messages;
 assert.ok(bounded.length<=32);assert.ok(bounded.every(row=>row.messages.length<=4&&row.messages.every(message=>message.length<=300)));
});

function terrainWorld(height=5,{water=null,terrain=null}={}){
 const value=structuredClone(world);value.scene.objects=[];
 value.scene.terrain=terrain||{type:'heightfield',bounds:[-10,10,-10,10],segments:[8,8],baseHeight:height,stamps:[]};
 value.scene.runtime={...value.scene.runtime,spawn:[0,1.72,0],bounds:[-10,10,-10,10],blockers:[],modules:['collision.boxes@1','camera.walk-orbit@1','terrain.heightfield@1','inhabitant.maker@1'],possession:{preset:'maker',camera:'first'}};
 if(water){value.scene.water=water;value.scene.runtime.modules.push('water.ocean@1');}
 return value;
}
const box=(id,position)=>({id,position,rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:{type:'box',size:[1,1.5,1],offset:[0,0,0]}});

test('terrain probes use supported actor feet for elevated blockers and preserve authored data',()=>{
 const value=terrainWorld();value.scene.objects=[box('raised-box',[0,5.75,0]),box('below-ground',[3,.75,0])];
 const before=JSON.stringify(value),report=sampleWorldPoints(value,{points:[{id:'raised',position:[0,1.72,0]},{id:'below',position:[3,9,0]}],time:0});
 assert.equal(report.driver,'terrain-heightfield');assert.equal(report.advisory,true);
 const [raised,below]=report.samples;
 assert.equal(raised.blockerId,'raised-box');assert.deepEqual(raised.feetPosition,[0,5,0]);assert.deepEqual(raised.eyePosition,[0,6.72,0]);
 assert.equal(raised.terrainHeight,5);assert.equal(raised.slopeRadians,0);assert.equal(raised.supportSource,'terrain-heightfield');
 assert.equal(below.blockerId,null);assert.deepEqual(below.requestedPosition,[3,9,0]);assert.deepEqual(below.feetPosition,[3,5,0]);
 assert.equal(JSON.stringify(value),before);
 const route=checkWorld(value,{routes:[{id:'high',from:[-2,6.72,0],to:[2,6.72,0]}]}).checks.find(c=>c.id==='route:high');
 assert.equal(route.status,'attention');assert.equal(route.evidence.firstHit.blockerId,'raised-box');assert.equal(route.evidence.firstHit.feetPosition[1],5);
});

test('terrain reports steep support and out-of-bounds samples without treating them as accepted traversal',()=>{
 const value=terrainWorld(0,{terrain:{type:'heightfield',bounds:[-10,10,-10,10],segments:[40,40],baseHeight:0,stamps:[{id:'hill',center:[0,0],radius:[3,3],height:8}]}});
 const report=sampleWorldPoints(value,{points:[{id:'slope',position:[1.5,0,0]},{id:'outside',position:[11,0,0]}]});
 assert.ok(report.samples[0].slopeRadians>Math.PI/4);assert.ok(report.samples[0].issues.includes('slope-limit'));
 assert.equal(report.samples[1].inBounds,false);assert.ok(report.samples[1].issues.includes('outside-terrain'));
 const route=checkWorld(value,{routes:[{id:'hill',from:[1.5,0,0],to:[2,0,0]}]}).checks.find(c=>c.id==='route:hill');
 assert.equal(route.status,'attention');assert.ok(route.evidence.firstProblem.issues.includes('slope-limit'));
 assert.match(report.limits.join(' '),/not a traversal/);
});

test('water probes share floating height and use explicit or fresh observed time',()=>{
 const water={type:'ocean',bounds:[-10,10,-10,10],level:0,waves:[{direction:[1,0],amplitude:.2,wavelength:4,speed:1}]};
 const value=terrainWorld(-3,{water}),points=[{id:'sea',position:[0,1.72,0]}];
 const observation={revision:value.revision,receivedAt:new Date(1000).toISOString(),activity:{time:1}};
 const report=sampleWorldPoints(value,{points,observation,now:2000});
 assert.equal(report.time,1);assert.equal(report.samples[0].mode,'swimming');
 assert.ok(Math.abs(report.samples[0].waterHeight+.2)<1e-8);assert.ok(Math.abs(report.samples[0].feetPosition[1]+1.2)<1e-8);
 assert.ok(Math.abs(report.samples[0].waterDepth-2.8)<1e-8);
 assert.equal(sampleWorldPoints(value,{points,observation,now:20000}).time,0);
 assert.equal(sampleWorldPoints(value,{points,observation,now:2000,time:2}).time,2);
});

test('legacy and possession ground-plane assumptions remain explicit',()=>{
 const report=sampleWorldPoints(world,{points:[{id:'flat',position:[0,1.72,0]}]});
 assert.equal(report.driver,'legacy-ground-plane');assert.equal(report.samples[0].supportSource,'assumed-ground-plane');assert.match(report.limits.join(' '),/no terrain support/i);
 const value=terrainWorld();delete value.scene.terrain;value.scene.runtime.modules=value.scene.runtime.modules.filter(m=>m!=='terrain.heightfield@1');
 const possessed=sampleWorldPoints(value,{points:[{id:'flat',position:[0,1.72,0]}]});
 assert.equal(possessed.driver,'inhabitant-ground-plane');assert.equal(possessed.samples[0].terrainHeight,0);
 const unsupported=checkWorld(world,{routes:[{id:'flying',from:[0,5,0],to:[1,5,0]}]}).checks.find(c=>c.id==='route:flying');assert.equal(unsupported.status,'unsupported');
});

test('legacy worlds get an explicit maker suggestion and are never migrated',()=>{
 const before=JSON.stringify(world),legacy=checkWorld(world),upgrade=legacy.checks.find(c=>c.id==='inhabitant-upgrade');
 assert.equal(upgrade.status,'suggestion');assert.equal(upgrade.evidence.driver,'legacy-ground-plane');
 assert.deepEqual(upgrade.evidence.possession,{preset:'maker',camera:'first'});assert.ok(upgrade.evidence.modules.includes('inhabitant.maker@1'));
 assert.match(legacy.next.join(' '),/Add the maker/);assert.equal(JSON.stringify(world),before);assert.equal(world.scene.runtime.possession,undefined);
 // The suggested revision is the one withMaker produces, and the maker then walks the same ground plane.
 const added={...world,scene:withMaker(world.scene)};validateRuntimeScene(added.scene);assert.equal(withMaker(added.scene),added.scene);
 const possessed=checkWorld(added);assert.equal(possessed.driver,'inhabitant-ground-plane');assert.equal(possessed.checks.some(c=>c.id==='inhabitant-upgrade'),false);
 assert.equal(possessed.checks.find(c=>c.id==='spawn-clearance').evidence.feetPosition[1],0);
});

test('point samples bound IDs, positions, work and explicit time',()=>{
 assert.throws(()=>sampleWorldPoints(world,{points:Array.from({length:65},(_,i)=>({id:`p${i}`,position:[0,0,0]}))}),/64/);
 assert.throws(()=>sampleWorldPoints(world,{points:[{id:'same',position:[0,0,0]},{id:'same',position:[1,0,0]}]}),/unique/);
 assert.throws(()=>sampleWorldPoints(world,{points:[{id:'nan',position:[NaN,0,0]}]}),/bounded/);
 assert.throws(()=>sampleWorldPoints(world,{points:[],time:-1}),/time/);
 const report=checkWorld(terrainWorld(),{routes:[{id:'long-terrain',from:[-900,0,0],to:[900,0,0]}]});
 assert.ok(report.checks.find(c=>c.id==='route:long-terrain').evidence.samples<=65);
});

test('fresh patrol observations move advisory colliders while stale and invalid poses stay initial',()=>{
 const value=terrainWorld(0);value.scene.runtime.modules.push('motion.patrol@1');
 value.scene.objects=[{...box('patroller',[0,0,0]),collider:{type:'box',size:[.4,.8,.4],offset:[0,.4,0]},behavior:{type:'patrol',path:[[0,0],[4,0]],speed:1,waitSeconds:0,waterPolicy:'avoid'}}];
 const points=[{id:'initial',position:[0,1.72,0]},{id:'observed',position:[3,1.72,0]}],observation={revision:value.revision,receivedAt:new Date(1000).toISOString(),activity:{states:{patroller:{position:[3,0,0],angle:0}}}};
 const current=sampleWorldPoints(value,{points,observation,now:2000});assert.equal(current.samples[0].blockerId,null);assert.equal(current.samples[1].blockerId,'patroller');
 const stale=sampleWorldPoints(value,{points,observation,now:20000});assert.equal(stale.samples[0].blockerId,'patroller');assert.equal(stale.samples[1].blockerId,null);
 observation.activity.states.patroller.position=[Infinity,0,0];const invalid=sampleWorldPoints(value,{points,observation,now:2000});assert.equal(invalid.samples[0].blockerId,'patroller');
});
