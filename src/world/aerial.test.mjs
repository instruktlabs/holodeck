import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AERIAL_DEFAULTS,aerialDepth,aerialGlowLobe,aerialTransmittance,aerialWeights,meanDensity,resolveAerial,validateAerial} from './aerial.mjs';

const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('aerial settings validate ranges and unknown keys (H124)',()=>{
  validateAerial({visibility:20000});
  validateAerial({visibility:8000,base:-80,falloff:300,blue:.5,glow:2});
  assert.throws(()=>validateAerial({}),/aerial visibility/);
  assert.throws(()=>validateAerial({visibility:50}),/aerial visibility must be a number from 200/);
  assert.throws(()=>validateAerial({visibility:9000,falloff:1}),/aerial falloff/);
  assert.throws(()=>validateAerial({visibility:9000,tint:'#fff'}),/Unknown environment aerial field tint/);
  assert.deepEqual(resolveAerial({aerial:{visibility:9000}}),{...AERIAL_DEFAULTS,visibility:9000});
  assert.equal(resolveAerial({}),null);
});

test('visibility is the Koschmieder distance in level air at the haze base',()=>{
  const t=aerialTransmittance({visibility:10000,blue:0},0,0,10000);
  for(const v of t)near(v,.02,1e-4);
});

test('haze thins with height and never reaches full opacity',()=>{
  const a={visibility:8000,base:-80,falloff:300};
  const level=aerialDepth(a,0,0,4000),up=aerialDepth(a,0,.2,4000),down=aerialDepth(a,0,-.02,4000);
  assert.ok(up<level&&level<down,'rays climbing into thinner air keep more of the far form');
  const far=aerialTransmittance(a,0,.05,6000);
  assert.ok(far.every(v=>v>0&&v<1),'a form 6 km out fades but is still there');
  // A steep ray down into dense air stays finite instead of overflowing.
  const deep=aerialTransmittance({visibility:500,base:0,falloff:10},100,-1,20000);
  assert.ok(deep.every(Number.isFinite));
  near(meanDensity(0),1);near(meanDensity(1e-5),1-5e-6,1e-9);near(meanDensity(1),1-Math.exp(-1));
});

test('blue scatters more than red, so distant shade lifts toward the blue air',()=>{
  const [r,g,b]=aerialWeights(.35);
  assert.ok(r<g&&g<b);
  const [tr,tg,tb]=aerialTransmittance({visibility:9000,blue:.35},0,0,3000);
  assert.ok(tr>tg&&tg>tb,'red light from the form survives best');
  assert.deepEqual(aerialWeights(0),[1,1,1],'blue 0 is grey haze');
});

test('the forward-scatter glow peaks toward the sun and fades away from it',()=>{
  near(aerialGlowLobe(1),.05*(1-.76**2)/(1-.76)**3,1e-12);
  assert.ok(aerialGlowLobe(1)>1&&aerialGlowLobe(Math.cos(Math.PI/4))<.1&&aerialGlowLobe(0)<.02);
});
