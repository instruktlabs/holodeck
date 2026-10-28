import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readGLB,poseGLB} from '../pipeline/glb-analysis.mjs';
import {solveArmIK} from './arm-ik.mjs';
// Support grip v13 (owner report 27 Oct: the support hand cupped the front of the fore-end). Each rifle ships hands rebuilt from the rig it is paired with.
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,''));
const RIFLES={rifle1866:['game/rifle-asset-pins-v3.json','game/rifle-arm-rig-v2.json'],boltNo4:['game/bolt-no4-asset-pins-v2.json','game/bolt-no4-arm-rig-v2.json']};
for(const [profile,[pinsFile,rigFile]] of Object.entries(RIFLES))test(`${profile} support hand wraps the fore-end, and the hands rest skeleton is built from ${rigFile}`,async()=>{
 const pin=(await json(pinsFile)).assets.hands,rig=await json(rigFile),g=await readGLB(pin.alias),rest=poseGLB(g,'Ready',0),at=n=>rest.get(n).p,d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 assert.equal(createHash('sha256').update(g.b).digest('hex'),pin.sha256);assert.equal(rig.profile,profile);assert.equal(rig.derivation.hands,pin.alias);assert.equal(rig.right,'+Z');
 const browser=await readFile('game/weapon-browser-profiles.mjs','utf8');for(const f of [pinsFile.replace('game/','./'),rigFile.replace('game/','./'),'../'+pin.alias])assert(browser.includes(`'${f}`),'browser profile loads '+f);
 for(const [side,a] of Object.entries(rig.arms)){const ik=solveArmIK(a.shoulder,a.wrist,a.pole,a.upperLength,a.forearmLength);
  assert(d(at(`Joint_${side}Arm_${side}_shoulder`),a.shoulder)<1e-4,side+' shoulder bone at the rig shoulder');assert(d(at(`Joint_${side}Arm_${side}_elbow`),ik.elbow)<1e-4,side+' elbow bone at the rig rest elbow');assert(d(at(`Joint_${side}_${side}_wrist`),a.wrist)<1e-4,side+' wrist bone at the rig wrist');}
 // +Z is the far side from the support hand. The fore-ends are about 40 mm wide about the bore plane.
 const tip=f=>at(`Joint_leftFinger${f}_left_finger${f}_tip`);for(const f of [0,1,2,3])assert(tip(f)[2]>.02,'finger '+f+' round the far side: z '+tip(f)[2].toFixed(4));assert(tip(4)[2]<-.02,'thumb along the near side: z '+tip(4)[2].toFixed(4));
 const a=rig.arms.left,elbow=solveArmIK(a.shoulder,a.wrist,a.pole,a.upperLength,a.forearmLength).elbow,knuckles=[0,1,2,3].map(f=>at(`Joint_leftFinger${f}_left_finger${f}_base`)).reduce((s,p)=>s.map((v,i)=>v+p[i]/4),[0,0,0]),hand=knuckles.map((v,i)=>v-a.wrist[i]),fore=a.wrist.map((v,i)=>v-elbow[i]);
 assert(Math.acos(Math.min(1,hand.reduce((s,v,i)=>s+v*fore[i],0)/Math.hypot(...hand)/Math.hypot(...fore)))*180/Math.PI<5,'support wrist bend under 5 degrees at Ready');
});
