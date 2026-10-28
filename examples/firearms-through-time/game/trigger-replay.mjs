// Replay an input script ([[seconds, 'pull'|'release'|'mode'|'reload'], ...]) through the trigger, the rules and the recoil, with
// a host that accepts every round the gun allows (no range, no camera). This is the shared fixture semantics: the Node tests and
// game/trigger-fixtures-v1.json use it, and the native checks reproduce it. Hosts apply input at frame starts; here each frame
// is cut at an input's exact time, so every frame rate sees the same timeline. `split` also cuts every piece unevenly.
// Each event records its time, the burst cam before it and the aim: [pitch up, yaw right] degrees from the starting look.
import {createWeapon,specFor,shoot,ignite,command} from './weapon.mjs';
import {createRecoil,fireRecoil} from './recoil.mjs';
import {pullTrigger,releaseTrigger,cycleFireMode} from './trigger.mjs';
import {runFireFrame} from './fire-frame.mjs';
export function replayTrigger(profile,inputs,{rate=60,until=2,split=false,initialAmmo=null,sessionId='trigger-fixture',refuse=()=>false}={}){
 const w=createWeapon(profile),fire=specFor(profile).fire,r=createRecoil(profile),events=[];let look=[0,0],next=0;
 if(initialAmmo!==null)w.ammo=initialAmmo;
 const queue=inputs.map(([at,what])=>({at,what})).sort((a,b)=>a.at-b.at);
 const apply=i=>{if(i.what==='pull')pullTrigger(w.trigger);else if(i.what==='release')releaseTrigger(w.trigger);else if(i.what==='mode')cycleFireMode(w.trigger,fire);else if(i.what==='reload')command(w,'reload');else throw Error('Unknown input '+i.what);};
 const act=(type,turn)=>{
  const t=w.trigger.time,aim=[look[0]+turn[0],look[1]+turn[1]];
  if(type==='ignite'){ignite(w);const shotId=`${sessionId}:shot:${w.shots}`;fireRecoil(r,sessionId,shotId);events.push({type,t,aim,shotId});return true;}
  if(refuse(type,t,w))return false;
  const cam=w.trigger.cam;if(!shoot(w))return false;
  if(type==='shot'){const shotId=`${sessionId}:shot:${w.shots}`;fireRecoil(r,sessionId,shotId);events.push({type,t,aim,cam,shotId});}else events.push({type,t,aim,cam});
  return true;};
 const frame=span=>{for(const f of split?[.37,.21,.42]:[1]){const turn=runFireFrame(w,fire,r,span*f,act);look=[look[0]+turn[0],look[1]+turn[1]];}};
 for(let f=0,frames=Math.ceil(until*rate-1e-9);f<frames;f++){
  const end=Math.min((f+1)/rate,until);let at=f/rate;
  while(next<queue.length&&queue[next].at<end-1e-12){const i=queue[next++];if(i.at>at+1e-12){frame(i.at-at);at=i.at;}apply(i);}
  frame(end-at);
 }
 return {w,events,look};
}
