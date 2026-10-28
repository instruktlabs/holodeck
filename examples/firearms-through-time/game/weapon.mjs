// Engine-neutral game rules. All timing/ammunition values are prototype tuning.
import {reloadDuration,inspectDuration,sampleWeaponPose} from './presentation.mjs';
import rifleContract from './rifle-game-contract.json' with {type:'json'};
import {sampleRiflePose} from './rifle-presentation.mjs';
import boltContract from './bolt-no4-game-contract.json' with {type:'json'};
import {sampleBoltPose} from './bolt-presentation.mjs';
import carbineContract from './carbine-m4-game-contract.json' with {type:'json'};
import flintlockContract from './flintlock-1742-game-contract.json' with {type:'json'};
import {createTrigger} from './trigger.mjs';
import {sampleProfilePose} from './profile-presentation.mjs';
export const spec=Object.freeze({id:'collection-pistol-01',capacity:7,reserve:28,cooldown:.22,reload:reloadDuration,inspect:inspectDuration,grips:['walnut','charcoal'],slots:{grip:['walnut','charcoal'],optic:[],muzzle:[]}});
export const rifleSpec=Object.freeze({...rifleContract,grips:[]});
export const boltSpec=Object.freeze({...boltContract,grips:[]});
export const carbineSpec=Object.freeze({...carbineContract,grips:[]});
export const flintlockSpec=Object.freeze({...flintlockContract,grips:[]});
const specs={pistol:spec,rifle1866:rifleSpec,boltNo4:boltSpec,carbineM4:carbineSpec,flintlock1742:flintlockSpec};
export function specFor(s){const id=typeof s==='string'?s:s?.profile??'pistol',p=specs[id];if(!p)throw Error('Unknown weapon profile: '+id);return p;}
export function createWeapon(profile='pistol'){const p=specFor(profile);return {profile,ammo:p.capacity,reserve:p.reserve,shots:0,hits:0,mode:'idle',timer:0,aim:false,cooldown:0,flash:0,grip:'walnut',finish:p.initialFinish??null,reloadCommitted:false,reloadCommits:0,reloadKind:null,trigger:p.fire?createTrigger(p.fire):null,message:'Ready'};}
// Long guns cycle a manual action after each shot (and the musket runs its lock); the pistol's and the M4's cooldown only limits the trigger.
const cycling=s=>(specFor(s).cycleBlocksActions??s.profile!=='pistol')&&s.cooldown>0;
const perCycle=p=>p.reloadPolicy==='one-round-per-cycle-until-full'||p.reloadPolicy==='charger-per-cycle-until-full';
const swap=p=>p.reloadPolicy==='magazine-swap';
// The M4 reloads from empty with a longer clip (the charging handle after the seat).
const reloadTiming=(p,s)=>s.reloadKind==='empty'?[p.reloadEmpty,p.reloadEmptyCommitPhase]:[p.reload,p.reloadCommitPhase];
export function attach(s,slot,id){const p=specFor(s);if(!p.slots[slot]?.includes(id)){s.message='Incompatible attachment';return false;}if(s.mode!=='idle'||cycling(s)){s.message='Finish the current action first';return false;}s[slot]=id;s.message=(slot==='finish'?'Finish: ':'Grip: ')+id;return true;}
export function command(s,action,{hit=false}={}){
 const spec=specFor(s);if(cycling(s))return false;
 if(action==='aim'){if(s.mode!=='idle')return false;s.aim=!s.aim;s.message=s.aim?'Aim':'Ready';return true;}
 if(action==='inspect'){if(s.mode!=='idle')return false;s.mode='inspect';s.timer=spec.inspect;s.aim=false;s.message='Inspect';return true;}
 if(action==='reload'){if(s.mode!=='idle'||s.ammo===spec.capacity||!s.reserve)return false;s.mode='reload';s.reloadKind=spec.reloadEmpty&&!s.ammo?'empty':'standard';s.timer=reloadTiming(spec,s)[0];s.reloadCommitted=false;s.aim=false;s.message='Reload';return true;}
 if(action==='fire'){if(s.mode!=='idle'||s.cooldown>0)return false;if(!s.ammo){s.message='Empty — reload';return false;}s.ammo--;s.shots++;s.hits+=Number(hit);s.cooldown=spec.cooldown;s.flash=.09;s.message=hit?'Target hit':'Shot';return true;}
 return false;
}
// A round from the trigger (profiles with a fire block). The trigger owns the cadence, so only the gun's own state refuses.
// A flintlock commits on the lock; its kick (flash) starts at the ignition.
export function shoot(s,{hit=false}={}){
 const p=specFor(s);if(!p.fire)throw Error('shoot needs a fire block: '+s.profile);
 if(s.mode!=='idle'||cycling(s)){s.message='Finish the current action first';return false;}if(!s.ammo){s.message='Empty — reload';return false;}
 s.ammo--;s.shots++;s.hits+=Number(hit);s.cooldown=p.cooldown;s.flash=p.fire.ignitionDelaySeconds>0?0:.09;s.message=hit?'Target hit':'Shot';return true;
}
export function ignite(s){s.flash=.09;}
export function step(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);const p=specFor(s);
 s.cooldown=Math.max(0,s.cooldown-dt);s.flash=Math.max(0,s.flash-dt);
 if(s.timer<=0)return;s.timer=Math.max(0,s.timer-dt);if(s.timer<1e-9)s.timer=0;
 const [duration,commitPhase]=reloadTiming(p,s);
 if(s.mode==='reload'&&(perCycle(p)||swap(p))&&!s.reloadCommitted&&s.timer<=duration*(1-commitPhase)+1e-9){
  const n=Math.min(swap(p)?p.capacity:p.roundsPerCommit??1,p.capacity-s.ammo,s.reserve);if(n>0){s.ammo+=n;s.reserve-=n;s.reloadCommits++;}s.reloadCommitted=true;s.message=swap(p)?'Magazine seated':n>1?n+' rounds stripped':p.reloadPolicy==='one-round-per-cycle-until-full'&&p.fire?'Rammed':'Round seated';
 }
 if(s.timer)return;
 if(s.mode==='reload'){
  if(perCycle(p)){
   if(s.ammo<p.capacity&&s.reserve>0){s.timer=p.reload;s.reloadCommitted=false;s.message=p.roundsPerCommit>1?'Load next charger':'Load next round';return;}
  }else if(!swap(p)){const n=Math.min(p.capacity-s.ammo,s.reserve);s.ammo+=n;s.reserve-=n;s.reloadCommits++;}
  s.reloadKind=null;
 }
 s.mode='idle';s.message='Ready';
}
// The trigger-driven profiles sample the delivered motion passed by the host (browser profile or test).
export const pose=(s,timeline)=>s.profile==='rifle1866'?sampleRiflePose(s):s.profile==='boltNo4'?sampleBoltPose(s):s.profile==='carbineM4'||s.profile==='flintlock1742'?sampleProfilePose(s,timeline):sampleWeaponPose(s);
// Target-local intersection (metres). No ballistics or real-world operating model.
export function targetHit(origin,dir,target=[24,1.70,0],angle=0){const n=[Math.cos(angle),0,-Math.sin(angle)],den=dir[0]*n[0]+dir[2]*n[2];if(Math.abs(den)<1e-6)return false;const t=((target[0]-origin[0])*n[0]+(target[2]-origin[2])*n[2])/den;if(t<=0||t>100)return false;const p=origin.map((v,i)=>v+dir[i]*t-target[i]);return Math.abs(p[1])<=.335&&Math.abs(p[0]*Math.sin(angle)+p[2]*Math.cos(angle))<=.295;}
