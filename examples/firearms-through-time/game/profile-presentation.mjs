// Clip choice for the trigger-driven profiles (M4, Pattern 1742) from game state. Channel values come from the delivered motion.
import {sampleTimeline} from './animation-sampler.mjs';
export function clipFor(s,timeline){
 if(s.mode==='reload')return s.reloadKind==='empty'&&timeline.clips.ReloadEmpty?'ReloadEmpty':'Reload';
 if(s.mode==='inspect')return 'Inspect';
 // The M4 holds the trigger-pressed pose while the trigger is down; the musket's Fire clip runs the lock over its cooldown.
 if(s.cooldown>0||(s.profile==='carbineM4'&&s.trigger?.down))return 'Fire';
 return !s.ammo&&timeline.clips.Fired?'Fired':'Ready';
}
export function sampleProfilePose(s,timeline){
 const clip=clipFor(s,timeline),duration=timeline.clips[clip].duration;
 const remaining=clip==='Reload'||clip==='ReloadEmpty'||clip==='Inspect'?s.timer:clip==='Fire'&&s.profile==='flintlock1742'?s.cooldown:duration;
 const clipTime=Math.max(0,Math.min(duration,duration-remaining)),p=sampleTimeline(timeline,clip,clipTime/duration);
 return {...p,clip,clipTime,aim:s.aim?1:0,recoil:s.flash/.09,slide:0,magX:0,magZ:0};
}
