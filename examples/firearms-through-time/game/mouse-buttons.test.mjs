import test from 'node:test';
import assert from 'node:assert/strict';
import {createMouseButtons,readMouseButtons} from './mouse-buttons.mjs';

// Events as a browser delivers them under pointer lock: [type, button that changed, buttons mask after the event].
const aimThenFire=[['pointerdown',2,2],['pointermove',0,3],['pointermove',0,2],['pointerup',2,0]];
const fireThenAim=[['pointerdown',0,1],['pointermove',2,3],['pointermove',2,1],['pointerup',0,0]];
const run=events=>{const s=createMouseButtons();return events.map(([,,buttons])=>Object.entries(readMouseButtons(s,buttons)).filter(([,v])=>v).map(([k])=>k));};

test('a left click while the right button holds aim pulls the trigger (chorded pointermove)',()=>{
 assert.deepEqual(run(aimThenFire),[['aimDown'],['triggerDown'],['triggerUp'],['aimUp']]);
 assert.deepEqual(run(fireThenAim),[['triggerDown'],['aimDown'],['aimUp'],['triggerUp']]);
});

test('hip fire, and moves without a button change, read as before',()=>{
 assert.deepEqual(run([['pointerdown',0,1],['pointermove',-1,1],['pointerup',0,0],['pointermove',-1,0]]),[['triggerDown'],[],['triggerUp'],[]]);
 assert.deepEqual(run([['pointerdown',1,4],['pointerup',1,0]]),[[],[]],'the middle button is not bound');
});

// The controls v12 handler keyed on pointerdown's button and pointerup's button only (evidence/aim-fire-v12c/browser-before).
test('the pre-fix handler misses the trigger while aiming',()=>{
 const old=events=>{let fired=0,aim=false;for(const [type,button] of events){if(type==='pointerdown'){if(button===0)fired++;else if(button===2)aim=true;}else if(type==='pointerup'&&button===2)aim=false;}return {fired,aim};};
 assert.deepEqual(old(aimThenFire),{fired:0,aim:false});
 assert.deepEqual(old(fireThenAim),{fired:1,aim:false},'and it never saw the right button pressed after a left one');
});
