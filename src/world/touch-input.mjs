// Touch gestures resolve to the same plain axes the keyboard produces. A finger
// that lands on the left of the scene in walk or free mode becomes a floating
// thumbstick; any other finger looks, and two looking fingers pinch. The
// controller owns the camera and pointer capture; no browser global is accessed here.
export const STICK_RADIUS=56;
const STICK_SIDE=.45,DEAD_ZONE=.15,RUN_AT=.95,TAP_MS=300,TAP_PX=12;

export function createTouchInput(){return {stick:null,looks:new Map(),pinch:null,pad:{jump:false,up:0},listeners:new Set()};}
export function subscribeTouch(state,listener){state.listeners.add(listener);return()=>state.listeners.delete(listener);}
const notify=state=>{for(const listener of state.listeners)listener(state);};
const spread=state=>{const [a,b]=[...state.looks.values()];return Math.hypot(a.x-b.x,a.y-b.y)||1;};

export function touchDown(state,{id,x,y,width,mode,time}){
 if(mode!=='overview'&&!state.stick&&x<width*STICK_SIDE){state.stick={id,origin:[x,y],current:[x,y]};notify(state);return {type:'stick'};}
 state.looks.set(id,{x,y,startX:x,startY:y,time,pinched:false});
 if(state.looks.size===2){state.pinch={distance:spread(state)};for(const look of state.looks.values())look.pinched=true;}
 return {type:'look'};
}
export function touchMove(state,{id,x,y}){
 if(state.stick?.id===id){state.stick.current=[x,y];notify(state);return null;}
 const look=state.looks.get(id);if(!look)return null;
 const dx=x-look.x,dy=y-look.y;look.x=x;look.y=y;
 if(state.pinch){const distance=spread(state),scale=state.pinch.distance/distance;state.pinch.distance=distance;return {type:'pinch',scale};}
 return {type:'look',dx,dy};
}
// A short, still touch that never joined a pinch is a tap.
export function touchUp(state,{id,x,y,time}){
 if(state.stick?.id===id){state.stick=null;notify(state);return null;}
 const look=state.looks.get(id);if(!look)return null;
 state.looks.delete(id);if(state.looks.size<2)state.pinch=null;
 return !look.pinched&&time-look.time<TAP_MS&&Math.hypot(x-look.startX,y-look.startY)<TAP_PX?{type:'tap',x,y}:null;
}
export function resetTouch(state){const had=!!state.stick;state.stick=null;state.looks.clear();state.pinch=null;state.pad.jump=false;state.pad.up=0;if(had)notify(state);}

// Deflection beyond the dead zone scales to 0..1; the stick's rim runs.
export function stickAxes(state){
 const s=state.stick;if(!s)return {forward:0,strafe:0,sprint:false};
 const dx=(s.current[0]-s.origin[0])/STICK_RADIUS,dy=(s.current[1]-s.origin[1])/STICK_RADIUS,length=Math.hypot(dx,dy);
 if(length<=DEAD_ZONE)return {forward:0,strafe:0,sprint:false};
 const scale=Math.min(1,(Math.min(1,length)-DEAD_ZONE)/(1-DEAD_ZONE))/length;
 return {forward:-dy*scale,strafe:dx*scale,sprint:length>=RUN_AT};
}
// Where the knob sits, clamped to the rim, for drawing the stick.
export function stickKnob(state){
 const s=state.stick;if(!s)return null;
 const dx=s.current[0]-s.origin[0],dy=s.current[1]-s.origin[1],length=Math.hypot(dx,dy),k=length>STICK_RADIUS?STICK_RADIUS/length:1;
 return {origin:s.origin,offset:[dx*k,dy*k]};
}
