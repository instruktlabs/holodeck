import test from 'node:test';
import assert from 'node:assert/strict';
import {createTouchInput,subscribeTouch,touchDown,touchMove,touchUp,resetTouch,stickAxes,stickKnob,STICK_RADIUS} from './touch-input.mjs';

const W=400;
test('a finger on the left of the scene becomes the stick in walk and free mode; others look',()=>{
 const s=createTouchInput();
 assert.deepEqual(touchDown(s,{id:1,x:60,y:600,width:W,mode:'walk',time:0}),{type:'stick'});
 assert.deepEqual(touchDown(s,{id:2,x:50,y:300,width:W,mode:'walk',time:0}),{type:'look'},'only one stick at a time');
 assert.deepEqual(touchDown(s,{id:3,x:300,y:600,width:W,mode:'walk',time:0}),{type:'look'});
 const free=createTouchInput();assert.deepEqual(touchDown(free,{id:1,x:60,y:600,width:W,mode:'free',time:0}),{type:'stick'});
 const overview=createTouchInput();assert.deepEqual(touchDown(overview,{id:1,x:60,y:600,width:W,mode:'overview',time:0}),{type:'look'},'the overlook orbits with any finger');
});

test('stick deflection maps to keyboard-shaped axes with a dead zone, and the rim runs',()=>{
 const s=createTouchInput();touchDown(s,{id:1,x:100,y:500,width:W,mode:'walk',time:0});
 assert.deepEqual(stickAxes(s),{forward:0,strafe:0,sprint:false});
 touchMove(s,{id:1,x:100,y:500-STICK_RADIUS*.1});assert.deepEqual(stickAxes(s),{forward:0,strafe:0,sprint:false},'inside the dead zone');
 touchMove(s,{id:1,x:100,y:500-STICK_RADIUS*.575});let a=stickAxes(s);assert.ok(Math.abs(a.forward-.5)<1e-9);assert.equal(a.strafe,0);assert.equal(a.sprint,false);
 touchMove(s,{id:1,x:100+STICK_RADIUS*2,y:500});a=stickAxes(s);assert.ok(Math.abs(a.strafe-1)<1e-9,'clamped at full deflection');assert.ok(Math.abs(a.forward)<1e-9);assert.equal(a.sprint,true);
 touchMove(s,{id:1,x:100-STICK_RADIUS,y:500+STICK_RADIUS});a=stickAxes(s);assert.ok(Math.abs(Math.hypot(a.forward,a.strafe)-1)<1e-9,'a diagonal never exceeds one');assert.ok(a.forward<0&&a.strafe<0);
 assert.deepEqual(stickKnob(s).offset.map(v=>Math.round(Math.hypot(...stickKnob(s).offset))),[STICK_RADIUS,STICK_RADIUS],'the knob stays on the rim');
 touchUp(s,{id:1,x:0,y:0,time:50});assert.equal(s.stick,null);assert.deepEqual(stickAxes(s),{forward:0,strafe:0,sprint:false});assert.equal(stickKnob(s),null);
});

test('look fingers report pixel deltas, and a short still touch is a tap',()=>{
 const s=createTouchInput();touchDown(s,{id:7,x:300,y:300,width:W,mode:'walk',time:1000});
 assert.deepEqual(touchMove(s,{id:7,x:310,y:295}),{type:'look',dx:10,dy:-5});
 assert.deepEqual(touchMove(s,{id:7,x:306,y:300}),{type:'look',dx:-4,dy:5});
 assert.deepEqual(touchUp(s,{id:7,x:306,y:300,time:1200}),{type:'tap',x:306,y:300});
 touchDown(s,{id:8,x:300,y:300,width:W,mode:'walk',time:0});assert.equal(touchUp(s,{id:8,x:330,y:300,time:100}),null,'a drag is not a tap');
 touchDown(s,{id:9,x:300,y:300,width:W,mode:'walk',time:0});assert.equal(touchUp(s,{id:9,x:300,y:300,time:500}),null,'a long press is not a tap');
 assert.equal(touchMove(s,{id:42,x:1,y:1}),null,'unknown pointers are ignored');assert.equal(touchUp(s,{id:42,x:1,y:1,time:0}),null);
});

test('two look fingers pinch instead of looking, and neither ends as a tap',()=>{
 const s=createTouchInput();touchDown(s,{id:1,x:200,y:300,width:W,mode:'overview',time:0});touchDown(s,{id:2,x:300,y:300,width:W,mode:'overview',time:0});
 const pinch=touchMove(s,{id:2,x:400,y:300});assert.equal(pinch.type,'pinch');assert.ok(Math.abs(pinch.scale-.5)<1e-9,'spreading the fingers halves the distance');
 assert.equal(touchUp(s,{id:2,x:400,y:300,time:10}),null);
 assert.deepEqual(touchMove(s,{id:1,x:205,y:300}),{type:'look',dx:5,dy:0},'one finger left looks again');
 assert.equal(touchUp(s,{id:1,x:205,y:300,time:20}),null);
});

test('reset drops every finger and held button, and stick changes notify subscribers',()=>{
 const s=createTouchInput(),seen=[];const stop=subscribeTouch(s,state=>seen.push(!!state.stick));
 touchDown(s,{id:1,x:10,y:10,width:W,mode:'walk',time:0});touchMove(s,{id:1,x:20,y:10});touchDown(s,{id:2,x:300,y:10,width:W,mode:'walk',time:0});
 s.pad.jump=true;s.pad.up=1;resetTouch(s);
 assert.equal(s.stick,null);assert.equal(s.looks.size,0);assert.equal(s.pad.jump,false);assert.equal(s.pad.up,0);
 assert.deepEqual(seen,[true,true,false]);stop();resetTouch(s);assert.equal(seen.length,3);
});
