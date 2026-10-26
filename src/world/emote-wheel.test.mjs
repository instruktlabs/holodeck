import test from 'node:test';
import assert from 'node:assert/strict';
import {EMOTES} from './emotes.mjs';
import {WHEEL_RADIUS,WHEEL_DEAD_ZONE,createEmoteInput,subscribeEmotes,wheelSlice,sliceCentre,openWheel,moveWheel,pointWheel,stepWheel,holdWheel,closeWheel,playSlot,takeEmoteRequest} from './emote-wheel.mjs';

test('slices run clockwise from straight up, and the centre is no slice',()=>{
 const n=EMOTES.length;
 assert.equal(wheelSlice(0,-100),0);assert.equal(wheelSlice(0,0),null);assert.equal(wheelSlice(WHEEL_DEAD_ZONE-1,0),null);
 for(let i=0;i<n;i++){const [x,y]=sliceCentre(i);assert.equal(wheelSlice(x,y),i);
  // Each slice spans half a slice either side of its centre.
  const a=(i+.45)/n*Math.PI*2,b=(i-.45)/n*Math.PI*2;assert.equal(wheelSlice(Math.sin(a)*80,-Math.cos(a)*80),i);assert.equal(wheelSlice(Math.sin(b)*80,-Math.cos(b)*80),i);}
 assert.equal(wheelSlice(NaN,NaN),null);
});

test('a locked mouse moves a clamped cursor; releasing plays the highlight, the centre cancels',()=>{
 const input=createEmoteInput(),seen=[];const stop=subscribeEmotes(input,s=>seen.push(s.highlight));
 moveWheel(input,50,0);assert.equal(input.highlight,null,'closed wheels ignore the mouse');
 openWheel(input,'keys');assert.equal(input.open,true);assert.equal(input.highlight,null);
 moveWheel(input,10,-10);assert.equal(input.highlight,null);
 moveWheel(input,0,-400);assert.ok(Math.hypot(...input.cursor)<=WHEEL_RADIUS+1e-9);assert.equal(input.highlight,0);
 moveWheel(input,600,400);assert.equal(input.highlight,wheelSlice(...input.cursor));
 const expected=EMOTES[input.highlight].id,id=closeWheel(input);assert.equal(id,expected);assert.equal(input.open,false);
 assert.equal(takeEmoteRequest(input),id);assert.equal(takeEmoteRequest(input),null,'a request is taken once');
 openWheel(input,'keys');moveWheel(input,0,-90);moveWheel(input,0,90);assert.equal(closeWheel(input),null,'back at the centre cancels');assert.equal(input.request,null);
 openWheel(input,'keys');moveWheel(input,0,-90);assert.equal(closeWheel(input,{play:false}),null,'Esc cancels');
 assert.ok(seen.length>4);stop();
});

test('arrow keys step round the ring and keys 1-9 play slots without the wheel',()=>{
 const input=createEmoteInput(),n=EMOTES.length;openWheel(input);
 stepWheel(input,1);assert.equal(input.highlight,0);stepWheel(input,-1);assert.equal(input.highlight,n-1);stepWheel(input,1);stepWheel(input,1);assert.equal(input.highlight,1);
 assert.equal(wheelSlice(...input.cursor),1,'the cursor follows the highlight');
 assert.equal(closeWheel(input),EMOTES[1].id);takeEmoteRequest(input);
 assert.equal(playSlot(input,7),'sit');assert.equal(takeEmoteRequest(input),'sit');assert.equal(input.open,false);
 openWheel(input);assert.equal(playSlot(input,0),'wave');assert.equal(input.open,false,'a click on a slice closes the wheel');
 assert.equal(playSlot(input,9),null);assert.equal(takeEmoteRequest(null),null);
});

test('a touch drags toward a slice and lifts to play, or lifts in place and taps',()=>{
 const input=createEmoteInput();openWheel(input,'drag');pointWheel(input,0,80);
 assert.equal(input.highlight,wheelSlice(0,80));assert.equal(closeWheel(input),EMOTES[wheelSlice(0,80)].id);takeEmoteRequest(input);
 openWheel(input,'drag');pointWheel(input,3,2);holdWheel(input);assert.equal(input.open,true);assert.equal(input.source,'tap');assert.equal(input.highlight,null);
 assert.equal(playSlot(input,3),'bow');assert.equal(input.open,false);
});
