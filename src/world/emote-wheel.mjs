import {EMOTES} from './emotes.mjs';

// The emote wheel's input state, shared by the controller (keys and a locked
// mouse), the touch button and the wheel overlay. A pick becomes a one-frame
// request the controller hands to the inhabitant. No browser global is accessed here.
export const WHEEL_RADIUS=120,WHEEL_DEAD_ZONE=36;
const TAU=Math.PI*2;

export function createEmoteInput(){return {open:false,source:null,cursor:[0,0],highlight:null,request:null,listeners:new Set()};}
export function subscribeEmotes(state,listener){state.listeners.add(listener);return()=>state.listeners.delete(listener);}
const notify=state=>{for(const listener of state.listeners)listener(state);};

// Slice i is centred i/count of a turn clockwise from straight up; the centre is no slice.
export function wheelSlice(dx,dy,count=EMOTES.length,deadZone=WHEEL_DEAD_ZONE){
 if(!(Math.hypot(dx,dy)>=deadZone))return null;
 const turn=Math.atan2(dx,-dy)/TAU;return ((Math.round(turn*count)%count)+count)%count;
}
export function sliceCentre(index,count=EMOTES.length,radius=WHEEL_RADIUS){const a=index/count*TAU;return [Math.sin(a)*radius,-Math.cos(a)*radius];}
const aimAt=(state,x,y)=>{const length=Math.hypot(x,y),k=length>WHEEL_RADIUS?WHEEL_RADIUS/length:1;state.cursor=[x*k,y*k];state.highlight=wheelSlice(x,y);notify(state);};

// source: 'keys' (released with T), 'drag' (a finger lifting plays) or 'tap'
// (stays open until a slice or the centre is tapped).
export function openWheel(state,source='keys'){state.open=true;state.source=source;state.cursor=[0,0];state.highlight=null;notify(state);}
// A locked mouse moves a virtual cursor, clamped to the rim.
export function moveWheel(state,dx,dy){if(state.open)aimAt(state,state.cursor[0]+dx,state.cursor[1]+dy);}
// A visible pointer or a finger aims by its offset from the centre (or from where it pressed).
export function pointWheel(state,dx,dy){if(state.open)aimAt(state,dx,dy);}
// Arrow keys step round the ring.
export function stepWheel(state,step,count=EMOTES.length){
 if(!state.open)return;
 state.highlight=state.highlight==null?(step>0?0:count-1):((state.highlight+step)%count+count)%count;
 state.cursor=sliceCentre(state.highlight,count,WHEEL_RADIUS*.7);notify(state);
}
// A touch that lifts without choosing leaves the wheel open for a tap.
export function holdWheel(state){if(!state.open)return;state.source='tap';state.highlight=null;state.cursor=[0,0];notify(state);}
// Closing plays the highlighted slice unless play is false; the centre cancels.
export function closeWheel(state,{play=true}={}){
 if(!state.open)return null;
 const id=play&&state.highlight!=null?EMOTES[state.highlight]?.id??null:null;
 state.open=false;state.source=null;state.highlight=null;state.cursor=[0,0];if(id)state.request=id;notify(state);return id;
}
// Keys 1-9 and slice clicks play a slot directly.
export function playSlot(state,slot){
 const id=EMOTES[slot]?.id;if(!id)return null;
 state.request=id;if(state.open){state.open=false;state.source=null;state.highlight=null;state.cursor=[0,0];}notify(state);return id;
}
export function takeEmoteRequest(state){const id=state?.request??null;if(state)state.request=null;return id;}
