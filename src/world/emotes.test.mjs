import test from 'node:test';
import assert from 'node:assert/strict';
import {EMOTES,EMOTE_FADES,emoteById,emoteForSlot,canEmote,requestEmote,endEmote,stepEmote,emoteWeight,chooseSeat} from './emotes.mjs';
import {createInhabitant,stepInhabitant,inhabitantContext} from './inhabitant.mjs';
import {WorldRuntime} from './runtime.mjs';
import {DEFAULT_WORLD} from './contract.mjs';

const flat={sample:()=>({height:0,normal:[0,1,0],slope:0,inBounds:true})};
const walker=()=>createInhabitant({terrain:flat,scene:{runtime:{spawn:[0,1.72,0],look:[0,0],possession:{camera:'third'}}}});
const run=(actor,seconds,input={})=>{let held=false;for(let t=0;t<seconds-1e-9;t+=1/60)held=stepEmote(actor,input,1/60);return held;};
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const world=()=>{const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','inhabitant.maker@1'],spawn:[0,1.72,0],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[],possession:{preset:'maker',camera:'third'}};return w;};

test('nine emotes fill the wheel in slot order, with loops for dance, sit and lie',()=>{
 assert.deepEqual(EMOTES.map(e=>e.id),['wave','dance','clap','bow','point','shrug','cheer','sit','lie']);
 assert.deepEqual(EMOTES.filter(e=>e.loop).map(e=>e.id),['dance','sit','lie']);
 assert.equal(emoteForSlot(0).id,'wave');assert.equal(emoteForSlot(8).id,'lie');assert.equal(emoteForSlot(9),null);
 for(const e of EMOTES)assert.ok(e.loop||e.duration>EMOTE_FADES.in+EMOTE_FADES.out,e.id);
 assert.equal(emoteById('nope'),null);
});

test('a one-shot fades in, holds, fades out and returns the actor to idle',()=>{
 const a=walker();assert.equal(a.emote,null);
 assert.ok(requestEmote(a,'wave',{start:12}));assert.equal(a.emote.id,'wave');assert.equal(emoteWeight(a.emote),0);
 // Plain replicable data: what plays, whether it loops and when it began.
 assert.deepEqual({id:a.emote.id,loop:a.emote.loop,start:a.emote.start},{id:'wave',loop:false,start:12});assert.deepEqual(structuredClone(a.emote),a.emote);
 run(a,EMOTE_FADES.in);near(emoteWeight(a.emote),1,1e-6);
 run(a,1);assert.equal(emoteWeight(a.emote),1);
 const duration=emoteById('wave').duration;run(a,duration-EMOTE_FADES.in-1-1/60);assert.ok(emoteWeight(a.emote)<.05);
 run(a,2/60);assert.equal(a.emote,null);
});

test('movement or a jump cancels a one-shot or a dance, blending out from where it was',()=>{
 for(const id of ['clap','dance'])for(const input of [{forward:1},{strafe:-.4},{jump:true}]){
  const a=walker();requestEmote(a,id);run(a,1);
  const before=emoteWeight(a.emote);assert.equal(stepEmote(a,input,1/60),false,'only sitting holds movement');
  assert.equal(a.emote.stage,'exit');assert.ok(Math.abs(emoteWeight(a.emote)-before)<.12,'no pop on cancel');
  run(a,EMOTE_FADES.cancel+1/60,input);assert.equal(a.emote,null);
 }
 const a=walker();requestEmote(a,'dance');run(a,20);assert.equal(a.emote.id,'dance','a loop holds');
});

test('sitting and lying hold movement while standing up, then let the walker go',()=>{
 for(const id of ['sit','lie']){
  const a=walker(),{enter,exit}=emoteById(id).settle;requestEmote(a,id);run(a,enter+1);
  assert.equal(a.emote.settle,enter);assert.equal(emoteWeight(a.emote),1);
  const start=[...a.position];stepInhabitant(a,{forward:1},1/60,{terrain:flat});
  assert.equal(a.emote.stage,'exit');assert.deepEqual(a.position,start,'the first step waits');
  for(let t=0;t<exit-.05;t+=1/60)stepInhabitant(a,{forward:1},1/60,{terrain:flat});
  assert.deepEqual(a.position,start,'standing up');assert.ok(a.emote);
  for(let t=0;t<.2;t+=1/60)stepInhabitant(a,{forward:1},1/60,{terrain:flat});
  assert.equal(a.emote,null);assert.ok(a.position[2]<start[2]-.05,'walks off once up');
 }
});

test('picking another emote ends the current one first; picking a running loop again stops it',()=>{
 const a=walker();requestEmote(a,'wave');run(a,.5);requestEmote(a,'bow');
 assert.equal(a.emote.id,'wave');assert.equal(a.emote.stage,'exit');assert.equal(a.emote.pending.id,'bow');
 run(a,EMOTE_FADES.cancel+1/60);assert.equal(a.emote.id,'bow');assert.equal(a.emote.time,0);near(a.emote.start,.5+EMOTE_FADES.cancel+1/60,1e-9);
 requestEmote(a,'dance');requestEmote(a,'cheer');assert.equal(a.emote.pending.id,'cheer','the last pick wins');
 run(a,.3);assert.equal(a.emote.id,'cheer');
 const b=walker();requestEmote(b,'dance');run(b,1);requestEmote(b,'dance');assert.equal(b.emote.stage,'exit');assert.equal(b.emote.pending,null);
 run(b,.3);assert.equal(b.emote,null);
 const c=walker();requestEmote(c,'sit');run(c,2);requestEmote(c,'wave');run(c,emoteById('sit').settle.exit+.05);assert.equal(c.emote.id,'wave','stands, then waves');
});

test('emotes need footing: none in the air or swimming, sitting only on firm ground',()=>{
 const a=walker();
 for(const [mode,expected] of [['grounded',EMOTES.map(()=>true)],['wading',EMOTES.map(e=>!e.settle)],['airborne',EMOTES.map(()=>false)],['swimming',EMOTES.map(()=>false)]]){
  a.mode=mode;assert.deepEqual(EMOTES.map(e=>canEmote(a,e.id)),expected,mode);
 }
 a.mode='grounded';requestEmote(a,'cheer');run(a,.5);a.mode='airborne';stepEmote(a,{},1/60);assert.equal(a.emote,null,'a fall drops it at once');
 assert.equal(requestEmote(a,'wave'),false);assert.equal(endEmote(a),false);
});

test('emotes are transient actor state: stepping a world never records them',()=>{
 const w=world(),runtime=new WorldRuntime(w.scene),a=createInhabitant(runtime);
 requestEmote(a,'dance');
 for(let i=0;i<30;i++){runtime.step(1/60);stepInhabitant(a,{},1/60,inhabitantContext(runtime,a.radius));}
 assert.equal(a.emote.id,'dance');
 assert.ok(!JSON.stringify(runtime.snapshot()).includes('dance'));assert.ok(!JSON.stringify(w).includes('dance'));
});

// A yawed bench and a chair with a back, in an independent fixture world.
function seating(){
 const w=world();
 const box=(size,offset)=>({size,offset});
 w.scene.objects=[
  {id:'bench',position:[2,0,0],rotation:[0,.5,0],scale:[1,1,1],layer:'world',shape:{type:'box',size:[1.8,.45,.5],offset:[0,.225,0],color:'#8a6a4a'},collider:{type:'box',...box([1.8,.45,.5],[0,.225,0])}},
  {id:'chair',position:[-3,0,1],rotation:[0,0,0],scale:[1,1,1],layer:'world',shape:{type:'box',size:[.5,.46,.46],offset:[0,.23,0],color:'#8a6a4a'},collider:{type:'compound',boxes:[box([.5,.46,.46],[0,.23,0]),box([.5,.4,.07],[0,.66,.2])]}},
  {id:'table',position:[0,0,-4],rotation:[0,0,0],scale:[1,1,1],layer:'world',shape:{type:'box',size:[1,.76,1],offset:[0,.38,0],color:'#8a6a4a'},collider:{type:'box',...box([1,.76,1],[0,.38,0])}},
 ];
 return new WorldRuntime(w.scene);
}

test('a sitter backs onto the nearest seat edge between knee and hip height',()=>{
 const runtime=seating(),at=(x,z)=>({position:[x,0,z]});
 // In front of the yawed bench: its local +z edge, 0.2 m inside, facing out across it.
 const c=Math.cos(.5),s=Math.sin(.5),front=[2+s*.55,1*0,c*.55];
 const seat=chooseSeat(runtime.colliderTops(front[0],front[2]),at(front[0],front[2]));
 assert.equal(seat.id,'bench');near(seat.point[1],.45);near(seat.height,.45);
 near(seat.point[0],2+s*.05,1e-9);near(seat.point[2],c*.05,1e-9);
 const forward=[-Math.sin(seat.yaw),-Math.cos(seat.yaw)];near(forward[0],s,1e-9);near(forward[1],c,1e-9);
 // Along the bench the seat point follows the sitter, kept 0.2 m from the ends.
 const along=chooseSeat(runtime.colliderTops(2+c*2,-s*2),at(2+c*.95+s*.4,-s*.95+c*.4));assert.equal(along.id,'bench');
 // The chair is chosen from the front, not its back; the table is too high and far seats are ignored.
 const chair=chooseSeat(runtime.colliderTops(-3,.4),at(-3,.4));assert.equal(chair.id,'chair');near(chair.height,.46);near(chair.point[2],1-.03,1e-9);near(Math.cos(chair.yaw),1,1e-9);
 assert.equal(chooseSeat(runtime.colliderTops(0,-3.3),at(0,-3.3)),null,'tables are not seats');
 assert.equal(chooseSeat(runtime.colliderTops(8,8),at(8,8)),null);
 assert.equal(chooseSeat(runtime.colliderTops(front[0],front[2]),{position:[front[0],.3,front[2]]}),null,'too low from a raised floor');
});
