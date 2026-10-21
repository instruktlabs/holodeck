import test from 'node:test';import assert from 'node:assert/strict';
import {resetWorldProbe,completeWorldFrame,canObserveWorld} from './world-probe.mjs';
test('activation clears prior camera, actor and performance data without replacing the debug object',()=>{
 const errors=['retained diagnostic'],probe={ready:true,frames:[40],position:[88,9,70],actor:{mode:'swim'},runtime:{time:91},world:{revision:5},loadedRevision:5,assets:{old:{}},errors};
 const reference=probe;resetWorldProbe(probe,'island:e2');assert.equal(probe,reference);assert.equal(probe.ready,false);assert.deepEqual(probe.frames,[]);assert.deepEqual(probe.position,[0,0,0]);assert.equal(probe.actor,null);assert.equal(probe.runtime,null);assert.equal(probe.world,null);assert.equal(probe.loadedRevision,undefined);assert.equal(probe.errors,errors);assert.equal(canObserveWorld(probe,'island:e2',5),false);
});
test('observations require a completed controller frame with matching world epoch and revision',()=>{
 const probe={};resetWorldProbe(probe,'first:e1');probe.ready=true;assert.equal(canObserveWorld(probe,'first:e1',2),false,'mesh readiness is not a controller frame');
 probe.position=[1,2,3];probe.frames.push(16);assert.equal(completeWorldFrame(probe,'first:e1',2),true);assert.equal(canObserveWorld(probe,'first:e1',2),true);assert.equal(canObserveWorld(probe,'first:e1',3),false);assert.equal(canObserveWorld(probe,'first:e2',2),false);
 resetWorldProbe(probe,'second:e2');probe.position=[88,4,5];probe.frames.push(30);assert.equal(completeWorldFrame(probe,'first:e1',2),false,'late disposed-canvas frames cannot claim new activation');assert.deepEqual(probe.frames,[]);assert.equal(probe.ready,false);
 probe.position=[4,5,6];probe.frames.push(17);assert.equal(completeWorldFrame(probe,'second:e2',2),true);assert.equal(canObserveWorld(probe,'second:e2',2),true);
});
