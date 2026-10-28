// Recoil v1 (docs/recoil-v1.md): each gun's learnable kick pattern plus slight seeded variation. Engine-neutral; Unreal mirrors it in WeaponRecoil.h.
// Angles are degrees, pitch up and yaw right positive. A host samples the shot along its current aim, then calls fireRecoil once for the
// accepted shot, and turns its look by the change stepRecoil returns each frame.
import profiles from './recoil-profiles-v1.json' with {type:'json'};
export {profiles};
const utf8=new TextEncoder();
export function fnv1a32(text){let h=0x811c9dc5;for(const b of utf8.encode(text))h=Math.imul(h^b,0x01000193)>>>0;return h;}
export function mulberry32(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function recoilProfile(id){const p=profiles.profiles[id];if(!p)throw Error('No recoil profile: '+id);return p;}
export const shotSeedKey=(sessionId,shotId,revision,channel='weapon-response')=>`${fnv1a32(String(sessionId))}|${shotId}|${revision}|${channel}`;
export function kickFor(id,index,sessionId,shotId){
 const p=recoilProfile(id),r=p.response,rows=r.pattern.value,row=rows[Math.min(Math.max(0,index),rows.length-1)],base=r.baseKick.value,next=mulberry32(fnv1a32(shotSeedKey(sessionId,shotId,p.revision))),a=2*next()-1,b=2*next()-1;
 return [base*row[0]*(1+r.variation.pitchScale.value*a),base*(row[1]+r.variation.yawScale.value*b)];
}
// pending: the part of the kicks still to recover; view: where the aim is now, relative to where it will settle. Both are [pitch, yaw].
export function createRecoil(id){recoilProfile(id);return {profile:id,time:0,index:-1,lastShotTime:null,lastShotId:null,shots:0,pending:[0,0],view:[0,0]};}
export function fireRecoil(s,sessionId,shotId){
 if(!shotId||shotId===s.lastShotId)return null;
 const r=recoilProfile(s.profile).response,keep=r.residual.value;s.index=s.lastShotTime===null||s.time-s.lastShotTime>=r.resetAfter.value?0:s.index+1;s.lastShotTime=s.time;s.lastShotId=shotId;s.shots++;
 const kick=kickFor(s.profile,s.index,sessionId,shotId);for(let i=0;i<2;i++){s.pending[i]+=(1-keep)*kick[i];s.view[i]-=keep*kick[i];}return {index:s.index,kick};
}
// Exact solution of view' = (pending - view) / rise with pending decaying at the recovery rate, so any frame split gives the same aim.
export function stepRecoil(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return [0,0];
 const r=recoilProfile(s.profile).response,tau=r.recovery.value,rise=r.rise.value,a=Math.exp(-dt/tau),b=Math.exp(-dt/rise),c=tau/(tau-rise),d=[0,0];s.time+=dt;
 for(let i=0;i<2;i++){const u=s.pending[i],v=s.view[i]*b+u*c*(a-b);d[i]=v-s.view[i];s.pending[i]=u*a;s.view[i]=v;}return d;
}
