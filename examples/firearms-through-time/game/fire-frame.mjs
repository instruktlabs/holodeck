// One frame for a profile with a `fire` block. The weapon timers, the trigger clock and the recoil filter advance together and
// split at each trigger event, so an event inside the frame sees the aim as it is at that moment.
// act(type, turn) performs the event in the host and returns whether it happened:
//  'shot'   autoloader round: gun and range checks, the ray, the record and the kick
//  'lock'   flintlock pull: gun and range checks and the commit; the ball leaves at the ignition
//  'ignite' the ball leaves: the ray, the record and the kick
// turn is the recoil turned so far in this frame, [pitch up, yaw right] in degrees; the shot's aim is the frame's starting
// aim turned by it. The return value is the frame's whole turn for the host look.
import {step} from './weapon.mjs';
import {stepRecoil} from './recoil.mjs';
import {nextTriggerEvent,completeTriggerEvent} from './trigger.mjs';
export function runFireFrame(w,fire,r,dt,act){
 if(!Number.isFinite(dt)||dt<=0)return [0,0];dt=Math.min(dt,.1);
 const t=w.trigger,turn=[0,0],end=t.time+dt;let left=dt;
 const advance=s=>{if(!(s>0))return;step(w,s);const d=stepRecoil(r,s);turn[0]+=d[0];turn[1]+=d[1];};
 // The trigger clock reaches the event before the host acts, so the host sees the event's own time.
 for(let e;(e=nextTriggerEvent(t,fire,left));){advance(e.in);left=Math.max(0,left-e.in);t.time=Math.max(t.time,e.at);completeTriggerEvent(t,fire,e,act(e.type,turn.slice())===true);}
 advance(left);t.time=Math.max(t.time,end);return turn;
}
