import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRuntime,WALKABLE_MARGIN} from './runtime.mjs';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';
import {createInhabitant,stepInhabitant,inhabitantContext} from './inhabitant.mjs';

// An independent jetty: two decks 0.6 m above still water over a 0.5 m deep
// seabed, joined by a 2 cm seam, then three stair treads down to the seabed.
// Every piece is yawed so the boxes are tested in their local frame.
const YAW=.6,c=Math.cos(YAW),s=Math.sin(YAW);
const along=(d,y=0,side=0)=>[d*c+side*s,y,-d*s+side*c];
const deckBox={size:[3,.3,1.8],offset:[0,-.15,0],walkable:true};
const post={size:[.26,1.6,.26],offset:[-1.5,-.2,1.03]};
const tread=(x,top)=>({size:[.3,top+.5,1.2],offset:[x,(top-.5)/2,0],walkable:true});
const piece=(id,d,y,collider)=>({id,position:along(d,y),rotation:[0,YAW,0],scale:[1,1,1],layer:'world',shape:{type:'box',size:[3,.3,1.8],offset:[0,-.15,0],color:'#8a6a4a'},collider:structuredClone(collider)});
function jetty({seabed=-.5,flags=true}={}){
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;
 w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','inhabitant.maker@1','terrain.heightfield@1','water.ocean@1'],spawn:[...along(1.5,.6+1.72)],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[],possession:{preset:'maker',camera:'first'}};
 w.scene.terrain={type:'heightfield',bounds:[-20,20,-20,20],segments:[8,8],baseHeight:seabed,stamps:[]};
 w.scene.water={type:'ocean',bounds:[-20,20,-20,20],level:0,waves:[]};
 w.scene.objects=[
  piece('deck-a',1.5,.6,{type:'compound',boxes:[deckBox,post]}),
  piece('deck-b',4.52,.6,{type:'compound',boxes:[deckBox]}),
  piece('stair',6.02,0,{type:'compound',boxes:[tread(.17,.3),tread(.47,0),tread(.77,-.3)]}),
 ];
 if(!flags)for(const o of w.scene.objects)for(const b of o.collider.boxes)delete b.walkable;
 return w;
}
const walkerAt=(runtime,position)=>{const a=createInhabitant(runtime);a.position=[...position];a.mode='grounded';a.verticalVelocity=0;return a;};
const yawToward=(dx,dz)=>Math.atan2(-dx,-dz);
// Walks for a number of seconds and records each frame's feet, mode and support.
function walk(runtime,actor,input,seconds){
 const trace=[],context=inhabitantContext(runtime,actor.radius);
 for(let t=0;t<seconds;t+=1/60){stepInhabitant(actor,input,1/60,context);trace.push({x:actor.position[0],y:actor.position[1],z:actor.position[2],mode:actor.mode,depth:actor.waterDepth});}
 return trace;
}
const distanceAlong=p=>p.x*c-p.z*s;
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);

test('walkable flags validate only as booleans on schema 2 colliders without a behavior',()=>{
 assert.doesNotThrow(()=>validateWorld(jetty()));
 const wrong=jetty();wrong.scene.objects[0].collider.boxes[0].walkable='yes';assert.throws(()=>validateWorld(wrong),/walkable must be true or false/);
 const moving=jetty();moving.scene.runtime.modules.push('motion.spin@1');moving.scene.objects[1].behavior={type:'spin',speed:1};assert.throws(()=>validateWorld(moving),/Walkable colliders cannot move/);
 const tilted=jetty();tilted.scene.objects[1].rotation=[.1,YAW,0];assert.throws(()=>validateWorld(tilted),/yaw rotation only/);
 const legacy=structuredClone(DEFAULT_WORLD);legacy.scene.objects=[{id:'step',asset:legacy.scene.origin,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:{type:'box',size:[1,1,1],offset:[0,0,0],walkable:true}}];assert.throws(()=>validateWorld(legacy),/schema version 2/);
 const single=jetty();single.scene.objects[1].collider={type:'box',size:[3,.3,1.8],offset:[0,-.15,0],walkable:true};assert.doesNotThrow(()=>validateWorld(single));
});

test('walkable tops are found in the yawed frame, grown by the seam margin and capped by maxTop',()=>{
 const r=new WorldRuntime(jetty().scene);
 assert.deepEqual(r.walkableAt(...along(1.5).filter((_,i)=>i!==1),10),{height:.6,id:'deck-a'});
 const [sx,,sz]=along(3.01);assert.ok(r.walkableAt(sx,sz,10),'the 2 cm seam between decks is covered');
 const [ex,,ez]=along(1.5,0,.9+WALKABLE_MARGIN-.01),[fx,,fz]=along(1.5,0,.9+WALKABLE_MARGIN+.01);
 assert.equal(r.walkableAt(ex,ez,10)?.id,'deck-a');assert.equal(r.walkableAt(fx,fz,10),null);
 assert.equal(r.walkableAt(sx,sz,.5),null,'a top above maxTop is not support');
 assert.deepEqual(r.walkableLevels(...along(6.19).filter((_,i)=>i!==1)).map(l=>+l.height.toFixed(6)),[.3]);
});

test('a tread within one step is footing, not a wall; posts and decks out of reach still block',()=>{
 // Standing on the bottom tread (-0.3), next to the middle one (0).
 const r=new WorldRuntime(jetty().scene),[x,,z]=along(6.74);
 assert.equal(r.collisionAt(x,z,.22,-.3,1.82),'stair','without the step rule the next tread blocks');
 assert.equal(r.collisionAt(x,z,.22,-.3,1.82,null,.35),null);
 const [px,,pz]=along(0,0,1.03);assert.equal(r.collisionAt(px,pz,.22,.6,1.82,null,.35),'deck-a','a post .6 m above the deck is a wall');
 const [wx,,wz]=along(4.5,0,1.05);assert.equal(r.collisionAt(wx,wz,.22,-.5,1.82,null,.35),'deck-b','a deck 1.1 m above the seabed is a wall');
});

test('the walker climbs the stair onto the decks, crosses the seam dry and walks back down',()=>{
 const r=new WorldRuntime(jetty().scene),a=walkerAt(r,along(8,-.5));
 const up=walk(r,a,{forward:1,yaw:yawToward(-c,s)},2.6);
 const end=up.at(-1);assert.ok(distanceAlong(end)>.5&&distanceAlong(end)<2.9,'reached deck-a');near(end.y,.6);assert.equal(end.mode,'grounded');assert.equal(end.depth,0);
 const heights=[...new Set(up.map(p=>+p.y.toFixed(3)))];for(const h of [-.5,-.3,0,.3,.6])assert.ok(heights.includes(h),`stood at ${h}`);
 for(let i=1;i<up.length;i++)assert.ok(up[i].y-up[i-1].y<=.35+1e-9,'never rose more than one step');
 assert.ok(up.filter(p=>distanceAlong(p)>2.5&&distanceAlong(p)<3.5).every(p=>Math.abs(p.y-.6)<1e-9),'the seam does not drop the walker');
 const down=walk(r,a,{forward:1,yaw:yawToward(c,-s)},4).at(-1);assert.ok(distanceAlong(down)>7);near(down.y,-.5);assert.equal(down.mode,'wading');
});

test('stepping off a side falls to the seabed, and a jump lands back on the deck',()=>{
 const r=new WorldRuntime(jetty().scene),a=walkerAt(r,along(4.5,.6));
 const trace=walk(r,a,{forward:1,yaw:yawToward(s,c)},1.5);
 assert.ok(trace.some(p=>p.mode==='airborne'),'the walker fell');near(trace.at(-1).y,-.5);assert.equal(trace.at(-1).mode,'wading');
 const b=walkerAt(r,along(4.5,.6));walk(r,b,{jump:true},.05);assert.equal(b.mode,'airborne');
 const landed=walk(r,b,{},1).at(-1);near(landed.y,.6);assert.equal(landed.mode,'grounded');
});

test('a wader beside the jetty cannot pass under a deck too low for its body',()=>{
 const r=new WorldRuntime(jetty().scene),a=walkerAt(r,along(4.5,-.5,3));
 const end=walk(r,a,{forward:1,yaw:yawToward(-s,-c)},3).at(-1);
 const side=end.x*s+end.z*c;assert.ok(side>.9+.22-1e-6,'stopped at the deck edge');near(end.y,-.5);assert.equal(end.mode,'wading');
});

test('a swimmer passes under a deck with room above the water and not under a low one',()=>{
 const swim=(underside)=>{
  const w=jetty({seabed:-3});w.scene.objects=[piece('high',0,underside+.3,{type:'box',size:[3,.3,1.8],offset:[0,-.15,0],walkable:true})];
  const r=new WorldRuntime(w.scene),a=walkerAt(r,along(0,-1,4));a.mode='swimming';
  const trace=walk(r,a,{forward:1,yaw:yawToward(-s,-c)},4);return {trace,end:trace.at(-1)};
 };
 const high=swim(.4);assert.ok(high.end.x*s+high.end.z*c<-1,'swam through under the high deck');assert.ok(high.trace.every(p=>p.mode==='swimming'));
 const low=swim(.3);assert.ok(low.end.x*s+low.end.z*c>.9,'the low deck stops the swimmer');
});

test('a patrol authored on a deck walks along it across the seam; without flags it starts on the seabed',()=>{
 const w=jetty();w.scene.runtime.modules.push('motion.patrol@1');
 w.scene.objects.push({id:'gull',position:along(.5,.6),rotation:[0,0,0],scale:[1,1,1],layer:'world',shape:{type:'sphere',size:[.3,.3,.3],offset:[0,.15,0],color:'#eeeeee'},collider:null,behavior:{type:'patrol',path:[[along(5.5)[0],along(5.5)[2]],[along(.5)[0],along(.5)[2]]],speed:2,waitSeconds:0,waterPolicy:'avoid'}});
 assert.doesNotThrow(()=>validateWorld(w));
 const r=new WorldRuntime(w.scene);near(r.states.get('gull').position[1],.6);
 for(let i=0;i<150;i++)r.step(1/60);const s0=r.states.get('gull');
 assert.equal(s0.blockedBy,null);assert.ok(distanceAlong({x:s0.position[0],z:s0.position[2]})>4,'crossed the seam');near(s0.position[1],.6);
 const flat=jetty({flags:false});flat.scene.runtime.modules.push('motion.patrol@1');flat.scene.objects.push(structuredClone(w.scene.objects.at(-1)));
 const ground=new WorldRuntime(flat.scene);near(ground.states.get('gull').position[1],-.5,1e-6);
});

test('without walkable flags the same colliders only block, as before',()=>{
 const r=new WorldRuntime(jetty({flags:false}).scene),a=walkerAt(r,along(8,-.5));
 const end=walk(r,a,{forward:1,yaw:yawToward(-c,s)},4).at(-1);assert.ok(distanceAlong(end)>6.5,'the stair blocks');near(end.y,-.5);
 assert.equal(r.walkableAt(...along(1.5).filter((_,i)=>i!==1),10),null);
});
