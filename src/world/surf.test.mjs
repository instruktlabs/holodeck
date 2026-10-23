import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSurfMap,resolveSurf,validateSurf,SURF_DEFAULTS} from './surf.mjs';

// A cross-section along x, the same for every z: open water, a reef rim at
// 20-24 m rising to a 0.6 m deep flat, a 4 m lagoon from 40 m, and a beach
// rising from 70 m out of the water at about 83 m.
const profile=x=>x<20?-10:x<24?-10+(x-20)/4*9.4:x<40?-.6:x<44?-.6-(x-40)/4*3.4:x<70?-4:-4+(x-70)*.3;
const size=100,bounds=[0,100,0,100],surf={...SURF_DEFAULTS,direction:[1,0]};
const build=(options={})=>buildSurfMap({bounds,heightAt:x=>profile(x),level:0,surf,size,...options});
const at=(map,x,channel)=>map[(50*size+Math.floor(x))*4+channel]/255;

test('surf settings validate their ranges and fill defaults from the first wave',()=>{
  assert.equal(validateSurf({breakDepth:1.2,runUp:.35}).breakDepth,1.2);
  assert.throws(()=>validateSurf({breakDepth:0}),/breakDepth/);
  assert.throws(()=>validateSurf({direction:[1,1]}),/unit vector/);
  assert.throws(()=>validateSurf({foam:1}),/Unknown water surf field foam/);
  const resolved=resolveSurf({waves:[{direction:[0,-1],wavelength:58,speed:4.6,amplitude:.07}],surf:{}});
  assert.ok(Math.abs(resolved.period-58/4.6)<1e-9);assert.deepEqual(resolved.direction,[0,-1]);assert.equal(resolved.runUp,.35);
  assert.deepEqual(resolveSurf({waves:[{direction:[1,0],wavelength:20,speed:-4}],surf:{}}).direction,[-1,0],'a wave running backwards sets the swell direction');
  assert.equal(resolveSurf({waves:[],surf:{}}).period,9);
});

test('the swell breaks at the reef rim, not in open water or at the map edge',()=>{
  const map=build(),strength=x=>at(map,x,0);
  const rim=Math.max(...[20,21,22,23,24].map(strength));
  assert.ok(rim>.9,`rim strength ${rim}`);
  for(const x of [0,5,15])assert.equal(strength(x),0,`open water at ${x} m`);
  assert.ok(at(map,30,1)<1,'whitewater carries over the reef flat');
  assert.equal(at(map,60,1),1,'and fades before the far side of the lagoon');
});

test('the lagoon behind the reef keeps low energy, so its beach gets small swash',()=>{
  const map=build(),open=build({heightAt:x=>x<70?-4:-4+(x-70)*.3});
  assert.ok(at(map,55,2)<.7,`lagoon energy ${at(map,55,2)}`);
  assert.ok(at(map,84,2)<at(open,84,2)*.75,'the sheltered beach gets less swash than an exposed one');
  assert.ok(at(open,84,2)>.3,'an exposed beach still has swell at the waterline');
  assert.ok(at(open,99,2)<at(open,84,2),'energy dies inland');
});

// The capability text promises this: after the rim, the swell breaks again only
// where the lagoon gets shallower than the rim flat (plus slow recovery).
test('the swell breaks again at a lagoon beach shallower than the reef flat, not over the deeper lagoon',()=>{
  const map=build(),strength=x=>at(map,x,0);
  for(const x of [50,60,72,79])assert.equal(strength(x),0,`no break over the lagoon at ${x} m (depth ${(-profile(x)).toFixed(1)} m)`);
  assert.ok(Math.max(...[81,82,83].map(strength))>.3,'the beach face shallower than the rim breaks again');
  assert.equal(at(map,82,1),0,'whitewater restarts from the beach break');
});

test('the map is deterministic and follows the swell direction',()=>{
  assert.deepEqual(build(),build());
  const reversed=build({surf:{...surf,direction:[-1,0]}});
  assert.ok(Math.max(...[20,21,22,23].map(x=>at(reversed,x,0)))<.5,'approaching from the beach side, the rim is sheltered by the island');
});
