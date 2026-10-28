// Generate game/recoil-fixtures-v1.json from game/recoil.mjs: hash and PRNG vectors plus one timed string per gun. The Node tests, the
// independent Python check (pipeline/check-recoil-fixtures.py) and the native checks (WeaponRecoilData.h) all replay it. --check verifies only.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fnv1a32,mulberry32,createRecoil,fireRecoil,stepRecoil,shotSeedKey,recoilProfile,kickFor} from '../game/recoil.mjs';
const profilesFile='game/recoil-profiles-v1.json',profileBytes=await readFile(profilesFile);
// Times are whole milliseconds so every host reaches the same instants; gaps avoid each gun's resetAfter exactly.
const SCENARIOS={
 pistol:{sessionId:'fixture-session-a',shots:[0,250,500,750,1000,1250,1500,1750,3000],sampleEvery:50,end:4000},
 rifle1866:{sessionId:'fixture-session-a',shots:[0,1000,2000,3000,4000,5000,6000,9000],sampleEvery:100,end:10000},
 boltNo4:{sessionId:'fixture-session-a',shots:[0,1300,2600,3900,5200,6500,7800,9100,10400,11700,13000,16000],sampleEvery:100,end:17000},
 // Round v14: M4 bursts at the 75 ms cycle with 300 ms pauses (the pattern runs on), then a 1 s pause that restarts it; musket shots one drill apart.
 carbineM4:{sessionId:'fixture-session-a',shots:[0,75,150,450,525,600,900,975,1050,1350,1425,1500,2500,2575,2650],sampleEvery:25,end:3500},
 flintlock1742:{sessionId:'fixture-session-a',shots:[0,10600,21200],sampleEvery:100,end:23000},
};
const raw=seed=>{const next=mulberry32(seed);return Array.from({length:4},()=>next()*4294967296);};
const scenarios={};
for(const [id,sc] of Object.entries(SCENARIOS)){
 const s=createRecoil(id),events=new Set([...sc.shots]);for(let t=0;t<=sc.end;t+=sc.sampleEvery)events.add(t);
 const shots=[],samples=[],aim=[0,0];let now=0,n=0;
 for(const t of [...events].sort((a,b)=>a-b)){
  const d=stepRecoil(s,(t-now)/1000);aim[0]+=d[0];aim[1]+=d[1];now=t;
  if(t%sc.sampleEvery===0)samples.push({ms:t,aim:[...aim]});
  if(sc.shots.includes(t)){const shotId=`${sc.sessionId}:shot:${++n}`,fired=fireRecoil(s,sc.sessionId,shotId);shots.push({ms:t,shotId,seedKey:shotSeedKey(sc.sessionId,shotId,recoilProfile(id).revision),index:fired.index,kick:fired.kick});}
 }
 scenarios[id]={revision:recoilProfile(id).revision,sessionId:sc.sessionId,sessionSeed:fnv1a32(sc.sessionId),sampleEveryMs:sc.sampleEvery,endMs:sc.end,shots,samples};
}
const otherSession=Array.from({length:3},(_,index)=>{const shotId=`fixture-session-b:shot:${index+1}`;return {shotId,index,kick:kickFor('pistol',index,'fixture-session-b',shotId)};});
const out={schemaVersion:1,id:'recoil-fixtures-v1',generatedBy:'pipeline/generate-recoil-fixtures-v1.mjs',profiles:{file:profilesFile,sha256:createHash('sha256').update(profileBytes).digest('hex')},
 note:'Steps are taken from event to event (shot or sample) in one exact step; hosts may split them into any frames. aim is the summed change stepRecoil returned, in degrees.',
 hashVectors:['','a','foobar','native-0f1e2d3c4b5a69788796a5b4c3d2e1f0:shot:12','café→range'].map(text=>({text,fnv1a32:fnv1a32(text)})),
 prngVectors:[0,1,3735928559,4294967295].map(seed=>({seed,raw:raw(seed)})),
 otherSession:{profile:'pistol',sessionId:'fixture-session-b',shots:otherSession},
 scenarios};
const file='game/recoil-fixtures-v1.json',text=JSON.stringify(out,null,1)+'\n',current=await readFile(file,'utf8').catch(()=>null);
if(current!==text){if(process.argv.includes('--check'))throw Error(file+' is stale');await writeFile(file,text);}
console.log(file+': '+Object.entries(scenarios).map(([id,s])=>`${id} ${s.shots.length} shots, ${s.samples.length} samples`).join('; '));
