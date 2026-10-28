// Generate game/trigger-fixtures-v1.json from game/trigger-replay.mjs: input scripts and the events they must produce, for the
// Node tests and the native checks. Times are seconds; inputs land at their exact times (see trigger-replay.mjs). --check verifies only.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {replayTrigger} from '../game/trigger-replay.mjs';
const sha=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
const SCENARIOS={
 'm4-semi':{profile:'carbineM4',until:1,inputs:[[0.1,'pull'],[0.3,'release'],[0.4,'pull'],[0.41,'release'],[0.45,'pull'],[0.5,'release']],
  note:'One round per pull; the third pull comes 50 ms after a shot and waits for the 75 ms cycle.'},
 'm4-burst-cam':{profile:'carbineM4',until:3,inputs:[[0,'mode'],[0.1,'pull'],[0.62,'release'],[0.7,'pull'],[0.72,'release'],[0.9,'pull'],[1.4,'release'],[2.2,'pull'],[2.6,'release']],
  note:'A full burst; a 20 ms pull fires one round and leaves the cam; the next held pull fires the remaining two and stops; then a full burst.'},
 'm4-empty-burst-reload':{profile:'carbineM4',until:5.5,initialAmmo:4,inputs:[[0,'mode'],[0.1,'pull'],[0.5,'release'],[0.8,'pull'],[1.3,'release'],[1.4,'reload'],[4.0,'pull'],[4.05,'release'],[4.5,'pull'],[5.0,'release']],
  note:'The magazine runs dry one round into the second burst: the refused round leaves the cam. The empty reload (2.9 s, seat at half way) refills it. A pull at 4.0 s, after a standard 2.3 s reload would have finished, is refused because the empty reload is still running, and leaves the cam; the next pull fires the two rounds left in the burst.'},
 'musket-lock':{profile:'flintlock1742',until:12,inputs:[[0.2,'pull'],[0.21,'release'],[1,'pull'],[1.05,'release'],[1.2,'reload'],[11.5,'pull'],[11.52,'release']],
  note:'The lock falls on the pull and the ball leaves 60 ms later. The empty musket refuses the next pull; the 10 s drill rams a round at 75%, and the gun fires again.'},
};
const scenarios={};
for(const [name,sc] of Object.entries(SCENARIOS)){
 const {w,events,look}=replayTrigger(sc.profile,sc.inputs,{rate:1000,until:sc.until,initialAmmo:sc.initialAmmo??null,sessionId:'trigger-fixture'});
 scenarios[name]={profile:sc.profile,note:sc.note,sessionId:'trigger-fixture',until:sc.until,initialAmmo:sc.initialAmmo??null,inputs:sc.inputs,
  events:events.map(e=>({type:e.type,t:e.t,...('cam' in e?{camBefore:e.cam}:{}),...(e.shotId?{shotId:e.shotId}:{}),aim:e.aim})),
  final:{look,ammo:w.ammo,reserve:w.reserve,shots:w.shots,mode:w.mode,fireMode:w.trigger.mode,cam:w.trigger.cam}};
}
const out={schemaVersion:1,id:'trigger-fixtures-v1',generatedBy:'pipeline/generate-trigger-fixtures-v1.mjs',
 sources:Object.fromEntries(await Promise.all(['game/trigger.mjs','game/fire-frame.mjs','game/trigger-replay.mjs','game/weapon.mjs','game/carbine-m4-game-contract.json','game/flintlock-1742-game-contract.json','game/recoil-profiles-v1.json'].map(async f=>[f,await sha(f)]))),
 note:'Replays must agree at any frame rate: event times within 1e-9 s, aims within 1e-9 degrees. aim is [pitch up, yaw right] from the starting look, including the recoil turned earlier in the same frame. Shot ids are <sessionId>:shot:<n>.',
 scenarios};
const file='game/trigger-fixtures-v1.json',text=JSON.stringify(out,null,1)+'\n',current=await readFile(file,'utf8').catch(()=>null);
if(current!==text){if(process.argv.includes('--check'))throw Error(file+' is stale');await writeFile(file,text);}
console.log(file+': '+Object.entries(scenarios).map(([n,s])=>`${n} ${s.events.length} events`).join('; '));
