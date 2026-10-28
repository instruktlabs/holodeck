import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeapon,command,step,attach,specFor,pose} from './weapon.mjs';
const advance=(s,seconds)=>{for(let i=0;i<Math.round(seconds*100);i++)step(s,.01);};
test('bolt profile is explicit and keeps an empty attachment allowlist',()=>{
 const b=createWeapon('boltNo4');assert.equal(b.ammo,10);assert.equal(b.reserve,30);assert.equal(b.finish,'restored-furniture');
 for(const [slot,id]of [['grip','charcoal'],['optic','red-dot'],['muzzle','suppressor'],['sling','web-sling']])assert(!attach(b,slot,id),slot);assert(attach(b,'finish','restored-furniture'));
 assert.equal(createWeapon('rifle1866').ammo,6);assert.equal(createWeapon().ammo,7);
});
test('bolt cycle gates repeated fire and competing actions without consuming ammunition',()=>{
 const s=createWeapon('boltNo4');assert(command(s,'fire',{hit:true}));for(const a of ['fire','aim','reload','inspect'])assert(!command(s,a));assert.equal(s.ammo,9);
 assert.equal(pose(s).clip,'Fire');advance(s,.6);const p=pose(s);assert(p.boltLift< -.5&&p.boltSlide< -.05,'bolt is lifted and drawn mid-cycle');assert(!command(s,'fire'));
 advance(s,.7);assert.equal(pose(s).clip,'Ready');assert.equal(pose(s).boltSlide,0);assert(command(s,'aim'));assert(command(s,'fire'));assert.equal(s.ammo,8);
});
test('each charger cycle strips up to five rounds at the commit, then repeats until full',()=>{
 const s=createWeapon('boltNo4');s.ammo=3;const total=s.ammo+s.reserve;assert(command(s,'reload'));
 advance(s,1.79);assert.equal(s.ammo,3);assert.equal(s.reloadCommits,0);advance(s,.02);assert.equal(s.ammo,8);assert.equal(s.reloadCommits,1);assert.equal(s.message,'5 rounds stripped');
 advance(s,1.2);assert.equal(s.mode,'reload');assert.equal(s.reloadCommitted,false);advance(s,1.8);assert.equal(s.ammo,10);assert.equal(s.reloadCommits,2);
 advance(s,1.3);assert.equal(s.mode,'idle');assert.equal(s.ammo+s.reserve,total);assert(!command(s,'reload'));
});
test('a short reserve strips only what remains and ends cleanly',()=>{
 const s=createWeapon('boltNo4');s.ammo=0;s.reserve=3;assert(command(s,'reload'));for(const a of ['aim','inspect','fire','reload'])assert(!command(s,a));
 advance(s,3);assert.equal(s.ammo,3);assert.equal(s.reserve,0);assert.equal(s.mode,'idle');assert.equal(s.reloadCommits,1);assert(!command(s,'reload'));
});
test('the charger cue is visible only around the commit',()=>{
 const s=createWeapon('boltNo4');s.ammo=0;command(s,'reload');const seen=[];for(let i=0;i<300;i++){step(s,.01);seen.push((pose(s).cartridge??0)>.5);}
 assert(!seen[0]);assert(seen[Math.round(.6*300)-2]);assert(!seen.at(-1));
});
test('emptying the magazine refuses fire and inspection keeps the finish',()=>{
 const s=createWeapon('boltNo4');for(let i=0;i<10;i++){assert(command(s,'fire'));advance(s,specFor(s).cooldown+.01);}assert.equal(s.ammo,0);assert(!command(s,'fire'));assert.equal(s.message,'Empty — reload');
 assert(command(s,'inspect'));advance(s,specFor(s).inspect);assert.equal(s.mode,'idle');assert.equal(s.finish,'restored-furniture');
});
