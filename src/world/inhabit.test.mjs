import test from 'node:test';
import assert from 'node:assert/strict';
test('H hides or restores hints only while inhabiting, without consuming text input',()=>{
 assert.deepEqual(resolveWorldKey({code:'KeyH',mode:'inhabit'}),{type:'toggle-hud'});
 assert.equal(resolveWorldKey({code:'KeyH',mode:'author'}),null);
 assert.equal(resolveWorldKey({code:'KeyH',mode:'inhabit',editable:true}),null);
 assert.equal(resolveWorldKey({code:'KeyH',mode:'inhabit',repeat:true}),null);
});
import { resolveWorldKey,createFreeCamera,stepFreeCamera,isWorldInputTarget,stepCameraLook,firstPersonEyePosition } from './inhabit.mjs';

test('first-person eye leans forward when looking down without moving feet or crossing an eye blocker',()=>{
 const feet=[3,2,4],level=firstPersonEyePosition(feet,1.72,0,0),down=firstPersonEyePosition(feet,1.72,0,-1.5);
 assert.equal(level[0],3);assert.ok(Math.abs(level[1]-3.72)<1e-12);assert.equal(level[2],3.84);assert.ok(Math.abs(down[2]-3.74)<1e-12);
 assert.equal(down[1],level[1]);assert.deepEqual(feet,[3,2,4]);
 const turned=firstPersonEyePosition(feet,1.72,Math.PI/2,-1.5);assert.ok(Math.abs(turned[0]-2.74)<1e-12);assert.equal(turned[2],4);
 const blocked=firstPersonEyePosition(feet,1.72,0,-1.5,(x,z,radius,y,height)=>{assert.equal(radius,.04);assert.equal(height,.12);return z<3.82;});
 assert.ok(blocked[2]>=3.82&&blocked[2]<3.86,'camera retracts to the last clear sample');
 assert.deepEqual(firstPersonEyePosition(feet,1.72,0,-1.5,()=>true),[3,level[1],4]);
});

test('held arrow look works in walk and free camera while focused controls retain their keys',()=>{
 for(const cameraMode of ['walk','free'])for(const code of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']){
  assert.deepEqual(resolveWorldKey({code,cameraMode,repeat:true}),{type:'look',code});
  for(const tagName of ['INPUT','TEXTAREA','SELECT','BUTTON'])assert.equal(resolveWorldKey({code,cameraMode,editable:isWorldInputTarget({tagName})}),null,`${tagName} owns ${code}`);
  assert.equal(resolveWorldKey({code,cameraMode,editable:isWorldInputTarget({tagName:'DIV',isContentEditable:true})}),null);
 }
 assert.equal(isWorldInputTarget({tagName:'CANVAS'}),false);assert.equal(isWorldInputTarget(null),false);
 assert.equal(resolveWorldKey({code:'ArrowDown',cameraMode:'overview'}),null);
});

test('keyboard look is rate based, clamps pitch and bounds a delayed frame',()=>{
 const view={yaw:0,pitch:0};stepCameraLook(view,{turn:1,tilt:-1},.1);
 assert.ok(view.yaw<0);assert.ok(view.pitch<0);
 const fine={yaw:0,pitch:0};for(let i=0;i<10;i++)stepCameraLook(fine,{turn:1,tilt:-1},.01);
 assert.ok(Math.abs(view.yaw-fine.yaw)<1e-12);assert.ok(Math.abs(view.pitch-fine.pitch)<1e-12);
 const delayed={yaw:0,pitch:0};stepCameraLook(delayed,{turn:1,tilt:-1},5);assert.deepEqual(delayed,view);
 for(let i=0;i<100;i++)stepCameraLook(view,{tilt:-1},.1);assert.equal(view.pitch,-1.5);
 for(let i=0;i<100;i++)stepCameraLook(view,{tilt:1},.1,{maxPitch:1.45});assert.equal(view.pitch,1.45);
 const before={...view};stepCameraLook(view,{turn:1,tilt:1},NaN);assert.deepEqual(view,before);
});

test('V switches the possessed camera without taking focus from text or overview',()=>{
 assert.deepEqual(resolveWorldKey({code:'KeyV',mode:'inhabit',possessed:true}),{type:'toggle-person'});
 for(const extra of [{editable:true},{repeat:true},{cameraMode:'overview'},{possessed:false}])assert.equal(resolveWorldKey({code:'KeyV',mode:'inhabit',possessed:true,...extra}),null);
});

test('E operates available targets once; F is a separate authoring selection intent',()=>{
 const target={id:'gate',action:'open',available:true,reason:null};
 assert.deepEqual(resolveWorldKey({code:'KeyE',mode:'inhabit',target}),{type:'interact',id:'gate'});
 assert.equal(resolveWorldKey({code:'KeyE',mode:'inhabit',target,repeat:true}),null);
 assert.equal(resolveWorldKey({code:'KeyE',target:{id:'tree',action:null,available:false,reason:'not-interactive'}}),null);
 assert.deepEqual(resolveWorldKey({code:'KeyF',target:{id:'tree',action:null,available:false,reason:'not-interactive'}}),{type:'select',id:'tree'});
 assert.equal(resolveWorldKey({code:'KeyF',mode:'inhabit',target}),null);
 assert.equal(resolveWorldKey({code:'KeyF',target:{id:'tree',reason:'hidden'}}),null);
 assert.equal(resolveWorldKey({code:'KeyE',mode:'inhabit',target:{id:'tree',action:null,available:false,reason:'not-interactive'}}),null);
 assert.deepEqual(resolveWorldKey({code:'KeyE',mode:'inhabit',target:{...target,available:false,reason:'out-of-reach'}}),{type:'unavailable',id:'gate',reason:'out-of-reach'});
});
test('focused controls own normal keys while Escape can leave an inhabited world',()=>{
 for(const code of ['KeyE','KeyF','KeyW','Enter','Tab','ShiftLeft'])assert.equal(resolveWorldKey({code,mode:'inhabit',editable:true}),null);
 assert.deepEqual(resolveWorldKey({code:'Escape',mode:'inhabit',editable:true}),{type:'leave'});
 assert.deepEqual(resolveWorldKey({code:'Escape',mode:'author'}),{type:'release'});
 assert.equal(resolveWorldKey({code:'Escape',mode:'inhabit',repeat:true}),null);
});
test('composer shortcuts release habitation and overview does not walk or operate targets',()=>{
 assert.equal(resolveWorldKey({code:'Tab',mode:'author'}),null,'authoring preserves native Tab navigation');
 for(const code of ['Enter','Tab'])assert.deepEqual(resolveWorldKey({code,mode:'inhabit'}),{type:'compose'});
 assert.equal(resolveWorldKey({code:'KeyW',cameraMode:'orbit'}),null);
 assert.equal(resolveWorldKey({code:'KeyE',cameraMode:'orbit',target:{id:'gate',action:'open',available:true}}),null);
 assert.deepEqual(resolveWorldKey({code:'KeyW',mode:'inhabit'}),{type:'move',code:'KeyW'});
 assert.deepEqual(resolveWorldKey({code:'ShiftRight',repeat:true}),{type:'move',code:'ShiftRight'});
 assert.equal(resolveWorldKey({code:'KeyQ'}),null);
});

test('Space jumps only the possessed walker and freecam reserves Q/E for vertical flight',()=>{
 assert.deepEqual(resolveWorldKey({code:'Space',possessed:true}),{type:'jump'});
 for(const extra of [{editable:true},{repeat:true},{possessed:false},{cameraMode:'free'},{cameraMode:'overview'}])assert.equal(resolveWorldKey({code:'Space',possessed:true,...extra}),null);
 for(const code of ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft'])assert.deepEqual(resolveWorldKey({code,cameraMode:'free',target:{id:'gate',action:'open',available:true}}),{type:'move',code});
 for(const code of ['Space','KeyG','KeyV','KeyQ','KeyE'])assert.equal(resolveWorldKey({code,cameraMode:'free',editable:true,possessed:true}),null);
 assert.deepEqual(resolveWorldKey({code:'KeyG',cameraMode:'walk'}),{type:'toggle-free'});
 assert.deepEqual(resolveWorldKey({code:'KeyG',cameraMode:'free'}),{type:'toggle-free'});
 assert.equal(resolveWorldKey({code:'KeyG',repeat:true}),null);
 assert.equal(resolveWorldKey({code:'KeyV',cameraMode:'free',possessed:true}),null);
 assert.deepEqual(resolveWorldKey({code:'Escape',cameraMode:'free',mode:'inhabit'}),{type:'leave'});
 assert.deepEqual(resolveWorldKey({code:'Enter',cameraMode:'free',mode:'inhabit'}),{type:'compose'});
});

test('freecam copies its starting pose and flies along pitch with independent world-height controls',()=>{
 const actorPosition=[2,3,4],view=createFreeCamera(actorPosition,[Math.PI/2,Math.PI/6]);
 stepFreeCamera(view,{forward:1},.1);assert.ok(view.position[0]<2);assert.ok(view.position[1]>3);assert.ok(Math.abs(view.position[2]-4)<1e-10);
 assert.deepEqual(actorPosition,[2,3,4],'camera flight must not mutate the inhabitant anchor');
 const before=[...view.position];stepFreeCamera(view,{up:1},.1);assert.equal(view.position[0],before[0]);assert.equal(view.position[2],before[2]);assert.ok(view.position[1]>before[1]);
 stepFreeCamera(view,{up:-1},.1);assert.ok(view.position.every((v,i)=>Math.abs(v-before[i])<1e-10));
});

test('freecam input is normalized, sprint is faster, and elapsed time is bounded',()=>{
 const straight=createFreeCamera([0,0,0]),diagonal=createFreeCamera([0,0,0]),fast=createFreeCamera([0,0,0]);
 stepFreeCamera(straight,{forward:1},.1);stepFreeCamera(diagonal,{forward:1,strafe:1,up:1},.1);stepFreeCamera(fast,{forward:1,sprint:true},.1);
 assert.ok(Math.abs(Math.hypot(...straight.position)-Math.hypot(...diagonal.position))<1e-10);assert.ok(Math.hypot(...fast.position)>Math.hypot(...straight.position));
 const capped=createFreeCamera([0,0,0]);stepFreeCamera(capped,{forward:1},10);assert.deepEqual(capped.position,straight.position);
 const before=[...capped.position];stepFreeCamera(capped,{forward:1},NaN);assert.deepEqual(capped.position,before);
});

test('T opens the emote wheel and 1-9 play slots, only while walking as the inhabitant',()=>{
 assert.deepEqual(resolveWorldKey({code:'KeyT',mode:'inhabit',possessed:true}),{type:'emote-wheel'});
 assert.deepEqual(resolveWorldKey({code:'KeyT',mode:'author',possessed:true}),{type:'emote-wheel'});
 for(let n=1;n<=9;n++){
  assert.deepEqual(resolveWorldKey({code:`Digit${n}`,mode:'inhabit',possessed:true}),{type:'emote',slot:n-1});
  assert.deepEqual(resolveWorldKey({code:`Numpad${n}`,mode:'inhabit',possessed:true}),{type:'emote',slot:n-1});
 }
 for(const code of ['KeyT','Digit1','Digit9'])for(const extra of [{editable:true},{repeat:true},{cameraMode:'free'},{cameraMode:'overview'},{possessed:false}])
  assert.equal(resolveWorldKey({code,mode:'inhabit',possessed:true,...extra}),null,`${code} ${JSON.stringify(extra)}`);
 assert.equal(resolveWorldKey({code:'Digit0',mode:'inhabit',possessed:true}),null);
 // The emote keys leave every existing binding where it was.
 const target={id:'gate',action:'open',available:true,reason:null};
 assert.deepEqual(resolveWorldKey({code:'KeyE',mode:'inhabit',possessed:true,target}),{type:'interact',id:'gate'});
 assert.deepEqual(resolveWorldKey({code:'KeyF',mode:'author',possessed:true,target}),{type:'select',id:'gate'});
 for(const [code,type] of [['KeyG','toggle-free'],['KeyV','toggle-person'],['KeyH','toggle-hud'],['Enter','compose'],['Tab','compose'],['Space','jump']])assert.equal(resolveWorldKey({code,mode:'inhabit',possessed:true})?.type,type,code);
 assert.deepEqual(resolveWorldKey({code:'KeyE',cameraMode:'free',possessed:true}),{type:'move',code:'KeyE'});
 assert.deepEqual(resolveWorldKey({code:'KeyQ',cameraMode:'free',possessed:true}),{type:'move',code:'KeyQ'});
});
