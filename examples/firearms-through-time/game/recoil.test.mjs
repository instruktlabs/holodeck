import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {profiles,fnv1a32,mulberry32,recoilProfile,kickFor,createRecoil,fireRecoil,stepRecoil} from './recoil.mjs';
import {specFor} from './weapon.mjs';
// Recoil v1 (docs/recoil-v1.md): learnable per-gun kick, slight seeded variation, partial recovery the player corrects.
const PLAYABLE=['pistol','rifle1866','boltNo4','carbineM4','flintlock1742'],KEYS=['value','units','provenanceClass','referenceIds','configurationScope','uncertainty','tuningReason','approvedBy','revision'];
const fixtures=JSON.parse(await readFile('game/recoil-fixtures-v1.json','utf8'));
const fields=o=>Object.values(o).flatMap(v=>v&&typeof v==='object'&&!Array.isArray(v)?('provenanceClass' in v?[v]:fields(v)):[]);
const close=(a,b,tol)=>Math.abs(a-b)<=tol;
const run=(id,shots,end,dt)=>{const s=createRecoil(id),aim=[0,0],out=[],kicks=[];let t=0,n=0;const queue=[...shots];while(t<end-1e-12){if(queue.length&&queue[0]<=t+1e-12){queue.shift();kicks.push(fireRecoil(s,'run',`run:shot:${++n}`).kick);}const d=stepRecoil(s,Math.min(dt,end-t));aim[0]+=d[0];aim[1]+=d[1];t+=Math.min(dt,end-t);out.push([t,...aim]);}return {s,aim,out,kicks};};

test('every playable gun has its own recoil profile with labelled provenance',()=>{
 assert.deepEqual(Object.keys(profiles.profiles).sort(),[...PLAYABLE].sort());
 for(const id of PLAYABLE){
  const p=recoilProfile(id),all=fields(p);assert.ok(all.length>=17,id);
  for(const f of all){assert.deepEqual(Object.keys(f).filter(k=>KEYS.includes(k)).sort(),[...KEYS].sort(),id);assert.ok(['estimated','gameplay-tuned'].includes(f.provenanceClass),id);assert.equal(f.revision,p.revision);assert.equal(f.approvedBy,null);}
  for(const f of Object.values(p.physics))assert.equal(f.provenanceClass,'estimated');
  for(const f of fields(p.response))assert.equal(f.provenanceClass,'gameplay-tuned');
  for(const f of fields(p.physics))for(const ref of f.referenceIds)assert.ok(profiles.references[ref]?.url,ref);
 }
 assert.notDeepEqual(recoilProfile('pistol').response.pattern.value,recoilProfile('boltNo4').response.pattern.value);
});

test('kick size follows each gun\'s cartridge and mass',()=>{
 for(const id of PLAYABLE){
  const {physics:x,response:r}=recoilProfile(id),v=x.muzzleVelocity.value,impulse=x.projectileMass.value/1000*v+x.chargeMass.value/1000*x.gasVelocityFactor.value*v,speed=impulse/x.gunMass.value,energy=x.gunMass.value*speed**2/2;
  assert.ok(close(x.impulse.value,impulse,impulse*1e-4)&&close(x.recoilVelocity.value,speed,speed*1e-4)&&close(x.freeRecoilEnergy.value,energy,energy*2e-4),id);
  assert.ok(close(r.baseKick.value,r.holdGain.value*Math.sqrt(x.freeRecoilEnergy.value),1e-5),id);
 }
 const e=id=>recoilProfile(id).physics.freeRecoilEnergy.value;assert.ok(e('boltNo4')>e('pistol')&&e('pistol')>e('rifle1866'));
 execFileSync(process.execPath,['pipeline/build-recoil-profiles-v1.mjs','--check']);
});

test('patterns cover a full load and the action keeps a string going',()=>{
 for(const id of PLAYABLE){
  const r=recoilProfile(id).response,spec=specFor(id);
  assert.ok(r.pattern.value.length>=spec.capacity,id);assert.ok(r.pattern.value.every(([p,y])=>p>0&&Number.isFinite(y)),id);
  assert.ok(r.residual.value>0&&r.residual.value<1&&r.rise.value<r.recovery.value&&r.resetAfter.value>spec.cooldown,id);
 }
});

test('FNV-1a matches its published vectors and the fixture and native header generators are current',()=>{
 assert.equal(fnv1a32(''),0x811c9dc5);assert.equal(fnv1a32('a'),0xe40c292c);assert.equal(fnv1a32('foobar'),0xbf9cf968);
 for(const v of fixtures.hashVectors)assert.equal(fnv1a32(v.text),v.fnv1a32);
 for(const v of fixtures.prngVectors){const next=mulberry32(v.seed);assert.deepEqual(v.raw.map(()=>next()*4294967296),v.raw);}
 execFileSync(process.execPath,['pipeline/generate-recoil-fixtures-v1.mjs','--check']);execFileSync(process.execPath,['pipeline/generate-recoil-header.mjs','--check']);
});

test('shared fixtures replay at any frame rate',()=>{
 for(const [id,sc] of Object.entries(fixtures.scenarios))for(const hz of [30,60,144,251]){
  const s=createRecoil(id),aim=[0,0],shots=new Map(sc.shots.map(x=>[x.ms,x])),samples=new Map(sc.samples.map(x=>[x.ms,x]));let now=0;
  for(const ms of [...new Set([...shots.keys(),...samples.keys()])].sort((a,b)=>a-b)){
   let left=(ms-now)/1000;while(left>1e-12){const dt=Math.min(1/hz,left),d=stepRecoil(s,dt);aim[0]+=d[0];aim[1]+=d[1];left-=dt;}now=ms;
   if(samples.has(ms))samples.get(ms).aim.forEach((v,i)=>assert.ok(close(aim[i],v,1e-9),`${id} ${hz} Hz at ${ms} ms`));
   if(shots.has(ms)){const x=shots.get(ms),fired=fireRecoil(s,sc.sessionId,x.shotId);assert.equal(fired.index,x.index);fired.kick.forEach((v,i)=>assert.ok(close(v,x.kick[i],1e-12)));}
  }
 }
});

test('variation is seeded, slight and bounded',()=>{
 for(const id of PLAYABLE){
  const r=recoilProfile(id).response,base=r.baseKick.value,dp=[],dy=[];
  assert.deepEqual(kickFor(id,2,'session-x','session-x:shot:3'),kickFor(id,2,'session-x','session-x:shot:3'));
  assert.notDeepEqual(kickFor(id,2,'session-x','session-x:shot:3'),kickFor(id,2,'session-y','session-y:shot:3'));
  for(let i=1;i<=500;i++){const [p,y]=kickFor(id,0,'bounds','bounds:shot:'+i),[rp,ry]=r.pattern.value[0];dp.push(p/(base*rp)-1);dy.push(y/base-ry);}
  const lim=(xs,b)=>xs.every(v=>Math.abs(v)<=b+1e-12)&&Math.max(...xs)>.8*b&&Math.min(...xs)<-.8*b;
  assert.ok(lim(dp,r.variation.pitchScale.value)&&lim(dy,r.variation.yawScale.value),id);
 }
 const other=fixtures.otherSession.shots,same=fixtures.scenarios.pistol.shots;other.forEach((x,i)=>{assert.equal(x.index,same[i].index);assert.notDeepEqual(x.kick,same[i].kick);assert.deepEqual(kickFor('pistol',x.index,'fixture-session-b',x.shotId),x.kick);});
});

test('consecutive shots walk the pattern and a pause restarts it',()=>{
 for(const id of PLAYABLE){
  const r=recoilProfile(id).response,cycle=specFor(id).cooldown,s=createRecoil(id),rows=r.pattern.value.length,seen=[];
  for(let i=0;i<rows+2;i++){seen.push(fireRecoil(s,'walk','walk:shot:'+i).index);stepRecoil(s,cycle);}
  assert.deepEqual(seen,[...Array(rows).keys(),rows,rows+1]);
  assert.deepEqual(kickFor(id,rows+1,'walk','walk:shot:x'),kickFor(id,rows-1,'walk','walk:shot:x'));
  stepRecoil(s,r.resetAfter.value);assert.equal(fireRecoil(s,'walk','walk:shot:late').index,0);
 }
});

test('a kick rises without a jump, peaks, and settles at the residual the player corrects',()=>{
 for(const id of PLAYABLE){
  const r=recoilProfile(id).response,s=createRecoil(id),{kick}=fireRecoil(s,'run','run:shot:1');
  assert.deepEqual(stepRecoil(s,0),[0,0]);const first=stepRecoil(s,1e-6);assert.ok(Math.abs(first[0])<1e-3*kick[0],id);
  const {out}=run(id,[0],30*r.recovery.value,1/240),pitch=out.map(x=>x[1]),peak=Math.max(...pitch),at=pitch.indexOf(peak);
  assert.ok(peak>.6*kick[0]&&peak<kick[0],id);assert.ok(pitch.slice(at).every((v,i,a)=>i===0||v<=a[i-1]+1e-12),id);
  const settled=out.at(-1);assert.ok(close(settled[1],r.residual.value*kick[0],1e-6)&&close(settled[2],r.residual.value*kick[1],1e-6),id);
 }
});

test('each accepted shot kicks once; rejected or replayed input does nothing',()=>{
 const s=createRecoil('pistol');assert.equal(fireRecoil(s,'once',''),null);assert.equal(s.shots,0);
 assert.ok(fireRecoil(s,'once','once:shot:1'));const copy=structuredClone(s);assert.equal(fireRecoil(s,'once','once:shot:1'),null);assert.deepEqual(s,copy);
 for(const dt of [NaN,-1,0,Infinity])assert.deepEqual(stepRecoil(s,dt),[0,0]);assert.deepEqual(s,copy);
 assert.throws(()=>createRecoil('unknown'),/No recoil profile/);
});
