import timeline from './animation-v3.json' with {type:'json'};
import {sampleTimeline} from './animation-sampler.mjs';
export const reloadDuration=timeline.clips.Reload.duration,inspectDuration=timeline.clips.Inspect.duration;
export const sampleReload=t=>sampleTimeline(timeline,'Reload',t);
export function sampleWeaponPose(s){
 const clip=s.mode==='reload'?'Reload':s.mode==='inspect'?'Inspect':s.cooldown>0?'Fire':'Ready';
 const duration=timeline.clips[clip].duration,remaining=clip==='Reload'||clip==='Inspect'?s.timer:clip==='Fire'?s.cooldown:duration;
 const clipTime=Math.max(0,Math.min(duration,duration-remaining)),q=sampleTimeline(timeline,clip,clipTime/duration),k=s.flash/.09;
 return {...q,clip,clipTime,aim:s.aim?1:0,reload:q.lift/.16,recoil:k,slide:-.027*k,magX:0,magZ:0};
}
