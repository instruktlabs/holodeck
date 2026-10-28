// Held-trigger fire for profiles with a `fire` block: semi, burst with the M16A2/M4 non-resetting cam, auto, and delayed
// ignition (a flintlock's lock falls on the pull and the shot leaves after the ignition delay). Engine-neutral and exact:
// events carry absolute times, so any frame split gives the same shot times. Hosts apply input at frame start.
export function createTrigger(fire){return {mode:fire.initialMode??fire.modes[0],down:false,latched:false,engaged:false,cam:0,readyAt:0,time:0,pending:[],pulls:0,fired:0};}
// A pull is latched, so a click shorter than a frame still fires once.
export function pullTrigger(t){if(t.down)return false;t.down=true;t.latched=true;t.pulls++;return true;}
export function releaseTrigger(t){if(!t.down)return false;t.down=false;if(!t.latched)t.engaged=false;return true;}
export function cycleFireMode(t,fire){if(t.down||t.latched||t.engaged||fire.modes.length<2)return false;t.mode=fire.modes[(fire.modes.indexOf(t.mode)+1)%fire.modes.length];return true;}
// Rounds the next pull fires in burst: the cam keeps its place when a burst is cut short.
export const burstLeft=(t,fire)=>t.mode==='burst'?fire.burst.rounds-t.cam:null;
// The next event within `horizon` seconds of t.time: {type:'ignite'|'lock'|'shot', at (absolute), in}. An ignition due at
// the same time as a sear release goes first.
export function nextTriggerEvent(t,fire,horizon){
 const ignite=t.pending.length?t.pending[0]:Infinity,sear=t.latched||(t.engaged&&t.down)?Math.max(t.time,t.readyAt):Infinity,at=Math.min(ignite,sear);
 if(!(at-t.time<=horizon))return null;
 return {type:ignite<=sear?'ignite':fire.ignitionDelaySeconds>0?'lock':'shot',at,in:Math.max(0,at-t.time)};
}
// `fired` is the host's answer: false when the gun or the range refused, which ends the pull (a refused burst round leaves the cam).
export function completeTriggerEvent(t,fire,e,fired){
 t.time=Math.max(t.time,e.at);
 if(e.type==='ignite'){t.pending.shift();return;}
 t.latched=false;if(!fired){t.engaged=false;return;}
 t.fired++;t.readyAt=e.at+(fire.cycleSeconds??0);
 if(e.type==='lock'){t.pending.push(e.at+fire.ignitionDelaySeconds);t.engaged=false;return;}
 if(t.mode==='burst'){t.cam=(t.cam+1)%fire.burst.rounds;t.engaged=t.down&&t.cam!==0;}else t.engaged=t.mode==='auto'&&t.down;
}
