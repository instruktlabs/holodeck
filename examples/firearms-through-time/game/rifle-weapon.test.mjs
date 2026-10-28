import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeapon,command,step,attach,specFor} from './weapon.mjs';
const advance=(s,seconds)=>{for(let i=0;i<Math.round(seconds*100);i++)step(s,.01);};
test('rifle profile is explicit, preserves pistol defaults and rejects unknown profiles',()=>{
 const r=createWeapon('rifle1866'),p=createWeapon();assert.equal(r.ammo,6);assert.equal(r.reserve,24);assert.equal(p.ammo,7);assert.equal(p.reserve,28);assert.throws(()=>createWeapon('unknown'));
 assert(!attach(r,'grip','charcoal'));assert(!attach(r,'optic','red-dot'));assert(!attach(r,'muzzle','suppressor'));assert(attach(r,'finish','satin-brass'));assert(attach(p,'grip','charcoal'));
});
test('lever cycle gates repeated fire and competing actions without consuming ammunition',()=>{
 const s=createWeapon('rifle1866');assert(command(s,'fire',{hit:true}));for(const a of ['fire','aim','reload','inspect'])assert(!command(s,a));assert.equal(s.ammo,5);assert.equal(s.shots,1);assert.equal(s.hits,1);advance(s,1);assert(command(s,'aim'));assert(s.aim);
});
test('reload transfers one round at the gate contact event, then repeats with conserved inventory',()=>{
 const s=createWeapon('rifle1866');s.ammo=3;const total=s.ammo+s.reserve;assert(command(s,'reload'));advance(s,1.55);assert.equal(s.ammo,3);advance(s,.01);assert.equal(s.ammo,4);assert.equal(s.reloadCommits,1);advance(s,.84);assert.equal(s.ammo,4);assert.equal(s.mode,'reload');assert.equal(s.reloadCommitted,false);
 advance(s,4.8);assert.equal(s.mode,'idle');assert.equal(s.ammo,6);assert.equal(s.reloadCommits,3);assert.equal(s.ammo+s.reserve,total);advance(s,10);assert.equal(s.reloadCommits,3);assert(!command(s,'reload'));
});
test('partial reserve ends a reload cleanly, with no early or duplicate commit',()=>{
 const s=createWeapon('rifle1866');s.ammo=0;s.reserve=1;assert(command(s,'reload'));for(const a of ['aim','inspect','fire','reload'])assert(!command(s,a));advance(s,2.4);assert.equal(s.ammo,1);assert.equal(s.reserve,0);assert.equal(s.mode,'idle');assert(!command(s,'reload'));assert(command(s,'fire'));advance(s,1);assert(!command(s,'fire'));assert.equal(s.shots,1);
});
test('inspection preserves rifle ammunition and finish and returns to ready',()=>{
 const s=createWeapon('rifle1866');assert(command(s,'aim'));assert(command(s,'inspect'));assert(!s.aim);assert(!command(s,'reload'));assert(!command(s,'fire'));advance(s,specFor(s).inspect);assert.equal(s.mode,'idle');assert.equal(s.ammo,6);assert.equal(s.finish,'satin-brass');
});
test('invalid time and paused caller do not advance a round commit',()=>{
 const s=createWeapon('rifle1866');s.ammo=2;command(s,'reload');advance(s,1.5);const old=structuredClone(s);for(const dt of [0,-1,NaN,Infinity])step(s,dt);assert.deepEqual(s,old);step(s,1000);assert.equal(s.ammo,3);assert.equal(s.reloadCommits,1);assert.equal(s.ammo+s.reserve,26);
});
