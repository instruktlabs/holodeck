import test from 'node:test';
import assert from 'node:assert/strict';
import {checkWorld,sampleWorldPoints} from './coherence.mjs';
import {DEFAULT_WORLD,validateWorld} from '../src/world/contract.mjs';

// An independent fixture: one walkable deck 0.6 m above still water over a
// 0.5 m deep seabed, with a post that stays a wall.
function deckWorld({walkable=true}={}){
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;
 w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','inhabitant.maker@1','terrain.heightfield@1','water.ocean@1'],spawn:[0,.6+1.72,0],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[],possession:{preset:'maker',camera:'first'}};
 w.scene.terrain={type:'heightfield',bounds:[-20,20,-20,20],segments:[8,8],baseHeight:-.5,stamps:[]};
 w.scene.water={type:'ocean',bounds:[-20,20,-20,20],level:0,waves:[]};
 const deck={size:[6,.3,2],offset:[0,-.15,0],...(walkable?{walkable:true}:{})};
 w.scene.objects=[{id:'deck',position:[0,.6,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',shape:{type:'box',size:[6,.3,2],offset:[0,-.15,0],color:'#8a6a4a'},collider:{type:'compound',boxes:[deck,{size:[.26,1.6,.26],offset:[3,-.2,1.1]}]}}];
 return validateWorld(w);
}
const eye=feet=>feet+1.72;

test('world_sample stands on a walkable top, lists every level and reads y as an eye height',()=>{
 const w=deckWorld(),before=JSON.stringify(w);
 const {samples:[on,under,beside]}=sampleWorldPoints(w,{points:[{id:'on',position:[0,eye(.6),0]},{id:'under',position:[0,eye(-.5),0]},{id:'beside',position:[0,eye(-.5),3]}],time:0});
 assert.equal(on.supportSource,'collider');assert.equal(on.supportId,'deck');assert.equal(on.supportHeight,.6);
 assert.deepEqual(on.feetPosition,[0,.6,0]);assert.equal(on.mode,'grounded');assert.equal(on.waterDepth,0);assert.equal(on.terrainHeight,-.5);assert.deepEqual(on.issues,[]);
 assert.deepEqual(on.levels,[{source:'collider',id:'deck',height:.6},{source:'terrain-heightfield',id:null,height:-.5}]);
 assert.equal(under.supportSource,'terrain-heightfield');assert.equal(under.feetPosition[1],-.5);assert.equal(under.blockerId,'deck','a wader under the deck meets its underside');assert.equal(under.levels.length,2);
 assert.equal(beside.supportSource,'terrain-heightfield');assert.equal(beside.levels,undefined);assert.equal(beside.mode,'wading');
 assert.equal(JSON.stringify(w),before);
});

test('routes carry the previous feet along a deck and report a drop off its end',()=>{
 const w=deckWorld();
 const report=checkWorld(w,{routes:[{id:'along',from:[-2.5,eye(.6),0],to:[2.5,eye(.6),0]},{id:'off-the-end',from:[2,eye(.6),-.5],to:[4,eye(.6),-.5]}]});
 assert.equal(report.checks.find(c=>c.id==='spawn-clearance').status,'clear');
 const along=report.checks.find(c=>c.id==='route:along');assert.equal(along.status,'clear');assert.equal(along.evidence.maxWaterDepth,0);
 const off=report.checks.find(c=>c.id==='route:off-the-end');assert.equal(off.status,'attention');
 assert.ok(off.evidence.firstProblem.issues.includes('drop'));assert.equal(off.evidence.firstProblem.feetPosition[1],-.5);
});

test('without walkable flags the same samples read terrain support and add no fields',()=>{
 const flat=deckWorld({walkable:false}),{samples:[on]}=sampleWorldPoints(flat,{points:[{id:'on',position:[0,eye(.6),0]}],time:0});
 assert.equal(on.supportSource,'terrain-heightfield');assert.equal(on.feetPosition[1],-.5);assert.equal(on.blockerId,'deck');
 for(const key of ['supportId','supportHeight','levels'])assert.equal(key in on,false);
});
