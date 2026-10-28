import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createWeapon,specFor,shoot,command} from './weapon.mjs';
import {pullTrigger,cycleFireMode,burstLeft,createTrigger} from './trigger.mjs';
import {replayTrigger} from './trigger-replay.mjs';
const play=(profile,script,options)=>replayTrigger(profile,script,options);
const times=e=>e.map(x=>+x.t.toFixed(9));

test('semi fires once per pull, at the pull, and the cycle limits a fast re-pull',()=>{
 const {events,w}=play('carbineM4',[[0.1,'pull'],[0.3,'release'],[0.4,'pull'],[0.41,'release'],[0.45,'pull'],[0.5,'release']],{rate:100});
 assert.deepEqual(times(events),[0.1,0.4,0.475],'the third pull waits for the 75 ms cycle');
 assert.equal(w.ammo,27);
});

test('burst fires three rounds at the cycle while held, then needs a new pull',()=>{
 const {events}=play('carbineM4',[[0,'mode'],[0.1,'pull'],[0.6,'release'],[0.7,'pull'],[0.95,'release']],{rate:200});
 assert.deepEqual(times(events),[0.1,0.175,0.25,0.7,0.775,0.85]);
 assert.deepEqual(events.map(e=>e.cam),[0,1,2,0,1,2],'cam position before each round');
});

test('the burst cam does not reset: a short pull leaves the rest for the next pull',()=>{
 const {events,w}=play('carbineM4',[[0,'mode'],[0.1,'pull'],[0.16,'release'],[0.5,'pull'],[0.9,'release'],[1.2,'pull'],[1.6,'release']],{rate:200});
 assert.deepEqual(times(events),[0.1,0.5,0.575,1.2,1.275,1.35],'1 round, then the remaining 2, then a full 3');
 assert.equal(burstLeft(w.trigger,specFor('carbineM4').fire),3);
});

test('a click shorter than a frame still fires once; burst clicks walk the cam one round at a time',()=>{
 const {events,w}=play('carbineM4',[[0,'mode'],[0.1,'pull'],[0.1,'release'],[0.2,'pull'],[0.2,'release']],{rate:30});
 assert.equal(events.length,2);assert.equal(w.trigger.cam,2);
});

test('an empty magazine ends the burst without moving the cam, and the mode switch waits for the trigger',()=>{
 const w=createWeapon('carbineM4'),fire=specFor('carbineM4').fire;
 assert.equal(cycleFireMode(w.trigger,fire),true);assert.equal(w.trigger.mode,'burst');
 pullTrigger(w.trigger);assert.equal(cycleFireMode(w.trigger,fire),false,'no mode change with the trigger held');
 const {events,w:after}=play('carbineM4',[[0,'mode'],[0.1,'pull'],[0.6,'release']],{rate:120,refuse:(type,t,s)=>s.shots>=1});
 assert.equal(events.length,1);assert.equal(after.trigger.cam,1,'the refused round did not advance the cam');
});

test('a reload refuses the trigger, and an empty reload takes the longer clip',()=>{
 const w=createWeapon('carbineM4');w.ammo=0;assert.equal(command(w,'reload'),true);assert.equal(w.reloadKind,'empty');assert.equal(w.timer,2.9);
 const v=createWeapon('carbineM4');v.ammo=12;command(v,'reload');assert.equal(v.reloadKind,'standard');assert.equal(v.timer,2.3);
 assert.equal(shoot(v),false);assert.equal(v.ammo,12);
});

test('auto keeps firing at the cycle while held (engine support for later guns)',()=>{
 const fire={modes:['auto'],initialMode:'auto',cycleSeconds:.1,ignitionDelaySeconds:0},t=createTrigger(fire);
 assert.equal(t.mode,'auto');
});

test('the flintlock locks on the pull and the ball leaves 60 ms later',()=>{
 const {events,w}=play('flintlock1742',[[0.2,'pull'],[0.21,'release']],{rate:60});
 assert.deepEqual(events.map(e=>e.type),['lock','ignite']);
 assert.ok(Math.abs(events[0].t-0.2)<1e-9&&Math.abs(events[1].t-0.26)<1e-9,JSON.stringify(times(events)));
 assert.equal(w.ammo,0);assert.equal(w.shots,1);
});

test('the musket refuses a second pull until the drill reloads it',()=>{
 const {events}=play('flintlock1742',[[0.1,'pull'],[0.15,'release'],[1,'pull'],[1.05,'release']],{rate:60});
 assert.equal(events.filter(e=>e.type==='lock').length,1);
});

test('shot times and aims match at 30, 60, 144 and 251 Hz and with uneven splits',()=>{
 // A full burst, a short pull (one round) that leaves the cam, then a held pull that fires the remaining two and stops.
 const script=[[0,'mode'],[0.1,'pull'],[0.62,'release'],[0.7,'pull'],[0.72,'release'],[0.9,'pull'],[1.4,'release']];
 const ref=play('carbineM4',script,{rate:960,until:2.5});
 assert.deepEqual(times(ref.events),[0.1,0.175,0.25,0.7,0.9,0.975]);
 for(const [rate,split] of [[30,false],[60,false],[144,false],[251,false],[60,true],[144,true]]){
  const run=play('carbineM4',script,{rate,until:2.5,split});
  assert.equal(run.events.length,ref.events.length,'events at '+rate);
  run.events.forEach((e,i)=>{assert.ok(Math.abs(e.t-ref.events[i].t)<1e-9,`time ${rate} ${i}`);for(const k of [0,1])assert.ok(Math.abs(e.aim[k]-ref.events[i].aim[k])<1e-9,`aim ${rate} ${i} ${e.aim} ${ref.events[i].aim}`);});
  for(const k of [0,1])assert.ok(Math.abs(run.look[k]-ref.look[k])<1e-9,'settled look '+rate);
 }
});

test('the shared fixtures replay at 30, 90, 144 and 251 Hz, and the generator is current',async()=>{
 execFileSync(process.execPath,['pipeline/generate-trigger-fixtures-v1.mjs','--check']);
 const fixtures=JSON.parse(await readFile('game/trigger-fixtures-v1.json','utf8'));
 assert.deepEqual(Object.keys(fixtures.scenarios),['m4-semi','m4-burst-cam','m4-empty-burst-reload','musket-lock']);
 const cam=fixtures.scenarios['m4-empty-burst-reload'];
 assert.deepEqual(cam.events.map(e=>+e.t.toFixed(9)),[0.1,0.175,0.25,0.8,4.5,4.575],'dry one round into a burst; the pull at 4.0 s meets the empty reload; the next pull finishes the burst');
 assert.equal(cam.final.ammo,28);assert.equal(cam.final.reserve,60);
 const musket=fixtures.scenarios['musket-lock'];assert.deepEqual(musket.events.map(e=>e.type+'@'+e.t.toFixed(3)),['lock@0.200','ignite@0.260','lock@11.500','ignite@11.560']);
 for(const [name,sc] of Object.entries(fixtures.scenarios))for(const [rate,split] of [[30,false],[90,false],[144,true],[251,false]]){
  const run=replayTrigger(sc.profile,sc.inputs,{rate,until:sc.until,split,initialAmmo:sc.initialAmmo,sessionId:sc.sessionId});
  assert.equal(run.events.length,sc.events.length,name+' '+rate);
  run.events.forEach((e,i)=>{const x=sc.events[i];assert.equal(e.type,x.type);assert.ok(Math.abs(e.t-x.t)<1e-9,`${name} ${rate} t${i}`);for(const k of [0,1])assert.ok(Math.abs(e.aim[k]-x.aim[k])<1e-9,`${name} ${rate} aim${i}`);});
  for(const k of [0,1])assert.ok(Math.abs(run.look[k]-sc.final.look[k])<1e-9,`${name} ${rate} look`);
  assert.equal(run.w.ammo,sc.final.ammo);assert.equal(run.w.trigger.cam,sc.final.cam);
 }
});

test('each burst round leaves along the aim turned by the earlier rounds in the same frame',()=>{
 // At 10 Hz a frame holds a whole burst; the second and third rounds must see the first rounds' kick.
 const slow=play('carbineM4',[[0,'mode'],[0.1,'pull'],[0.5,'release']],{rate:10,until:1}),fast=play('carbineM4',[[0,'mode'],[0.1,'pull'],[0.5,'release']],{rate:1000,until:1});
 assert.equal(slow.events.length,3);
 slow.events.forEach((e,i)=>{for(const k of [0,1])assert.ok(Math.abs(e.aim[k]-fast.events[i].aim[k])<1e-9,`round ${i}`);});
 assert.ok(slow.events[2].aim[0]>slow.events[1].aim[0]&&slow.events[1].aim[0]>slow.events[0].aim[0],'the climb is visible within the frame');
});
