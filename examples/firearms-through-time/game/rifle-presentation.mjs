import timeline from './rifle-motion-v2.json' with {type:'json'};
import {sampleTimeline} from './animation-sampler.mjs';
export {timeline as rifleTimeline};
export function sampleRiflePose(s){
 const clip=s.mode==='reload'?'Reload':s.mode==='inspect'?'Inspect':s.cooldown>0?'Fire':'Ready';
 const duration=timeline.clips[clip].duration,remaining=clip==='Reload'||clip==='Inspect'?s.timer:clip==='Fire'?s.cooldown:duration;
 const clipTime=Math.max(0,Math.min(duration,duration-remaining)),p=sampleTimeline(timeline,clip,clipTime/duration);
 return {...p,clip,clipTime,aim:s.aim?1:0,recoil:s.flash/.09,slide:0,magX:0,magZ:0};
}
