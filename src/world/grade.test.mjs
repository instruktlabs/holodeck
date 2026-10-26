import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NEUTRAL_DESATURATION,neutralTone,resolveGrade,validateGrade} from './grade.mjs';

// CIE L* of linear display RGB.
const lightness=([r,g,b])=>{const y=.2126*r+.7152*g+.0722*b;return y>.008856?116*Math.cbrt(y)-16:903.3*y;};
// The mid-tone input at which warm sunlit stone (1, .82, .6) reaches an output L*.
const inputFor=(target,desaturation)=>{let lo=.01,hi=200;for(let i=0;i<80;i++){const m=Math.sqrt(lo*hi);lightness(neutralTone([m,.82*m,.6*m],desaturation).map(v=>Math.min(1,Math.max(0,v))))<target?lo=m:hi=m;}return hi;};

test('grade highlights validate and resolve only with the Neutral curve (H126)',()=>{
  validateGrade({toneMapping:'neutral',highlights:1});
  assert.throws(()=>validateGrade({toneMapping:'aces',highlights:1}),/needs toneMapping neutral/);
  assert.throws(()=>validateGrade({toneMapping:'neutral',highlights:4}),/highlights must be 0–3/);
  assert.equal(resolveGrade({grade:{toneMapping:'neutral',highlights:1}}).highlights,1);
  assert.equal(resolveGrade({grade:{toneMapping:'neutral'}}).highlights,null,'unset keeps three\'s own curve');
  assert.equal(resolveGrade({}).highlights,null);
});

test('stronger highlight desaturation lets warm light roll to white, mid-tones unchanged',()=>{
  // Matches the plateau research's model of three's Neutral (Khronos) curve.
  assert.ok(Math.abs(inputFor(99,NEUTRAL_DESATURATION)-38)<.5,'Khronos Neutral: warm stone reaches L* 99 only near 38');
  assert.ok(Math.abs(inputFor(99,1)-8.6)<.1,'desaturation 1: near 8.6');
  assert.ok(Math.abs(inputFor(97,1)-3)<.1);
  for(const d of [.15,1,2])assert.deepEqual(neutralTone([.5,.41,.3],d),neutralTone([.5,.41,.3]),'below the compression start the curve is untouched');
  const khronos=neutralTone([1,.82,.6]),strong=neutralTone([1,.82,.6],1);
  assert.equal(khronos[0],strong[0]);assert.ok(strong[1]-khronos[1]<.02,'a warm input of 1 barely moves (g .708 to .720)');
});
