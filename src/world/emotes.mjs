// Emotes are transient activity on the possessed inhabitant, like a door swing:
// they live on the runtime actor record only and never enter the world document
// or its revisions. actor.emote is plain data (id, loop, start, seat, time,
// stage), so another client could replicate it and play the same body. This
// module owns timing, cancelling and seat choice; the maker's pose layer
// (maker-emotes.mjs) reads actor.emote and never writes it. Neither touches the
// camera or input.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),smooth=t=>t*t*(3-2*t);

// Wheel order is slot order: keys 1-9 play slots 0-8. One-shots play once and
// return to idle; loops hold until movement, a jump or another emote. Settling
// emotes (sit, lie) blend down over `enter` seconds and retrace it to stand.
export const EMOTES=Object.freeze([
 {id:'wave',label:'Wave',duration:2.4},
 {id:'dance',label:'Dance',loop:true},
 {id:'clap',label:'Clap',duration:2.2},
 {id:'bow',label:'Bow',duration:2.6},
 {id:'point',label:'Point',duration:2.2},
 {id:'shrug',label:'Shrug',duration:1.8},
 {id:'cheer',label:'Cheer',duration:2.4},
 {id:'sit',label:'Sit',loop:true,settle:{enter:.9,exit:.55}},
 {id:'lie',label:'Lie down',loop:true,settle:{enter:2,exit:1.3}},
].map(Object.freeze));
const BY_ID=new Map(EMOTES.map(e=>[e.id,e]));
export const emoteById=id=>BY_ID.get(id)??null;
export const emoteForSlot=slot=>EMOTES[slot]??null;
// Fade times in seconds: a one-shot's own ends, a loop's start, and a cancel.
export const EMOTE_FADES=Object.freeze({in:.25,out:.35,loopIn:.4,cancel:.25,sit:.9});

// Sitting and lying need firm ground; the rest also play while wading.
export function canEmote(actor,id){
 const emote=emoteById(id);if(!emote||!actor)return false;
 return emote.settle?actor.mode==='grounded'&&actor.grounded!==false:['grounded','wading'].includes(actor.mode);
}
// start is the caller's clock (the world runtime's time) when the emote began.
const begin=({id,seat=null,start=0})=>({id,loop:!!emoteById(id).loop,start,seat,time:0,settle:0,stage:'play',exitTime:0,fade:1,pending:null});

// The blend weight of the emote over locomotion, 0..1.
export function emoteWeight(e){
 if(!e)return 0;const emote=emoteById(e.id),f=EMOTE_FADES;
 if(emote.settle)return smooth(clamp(e.settle/f.sit,0,1));
 const playing=emote.loop?smooth(clamp(e.time/f.loopIn,0,1)):smooth(clamp(e.time/f.in,0,1))*smooth(clamp((emote.duration-e.time)/f.out,0,1));
 return e.stage==='exit'?e.fade*(1-smooth(clamp(e.exitTime/f.cancel,0,1))):playing;
}
// Ending fades from the current weight; a settling emote retraces its way down.
export function endEmote(actor){
 const e=actor?.emote;if(!e||e.stage==='exit')return false;
 e.fade=emoteWeight(e);e.stage='exit';e.exitTime=0;return true;
}
// Picking the running loop again stops it. Picking another emote ends the current
// one first and starts the new one when it has finished ending.
export function requestEmote(actor,id,{seat=null,start=0}={}){
 if(!canEmote(actor,id))return false;
 const current=actor.emote;
 if(!current){actor.emote=begin({id,seat,start});return true;}
 if(current.id===id&&current.stage==='play'&&emoteById(id).loop){endEmote(actor);current.pending=null;return true;}
 endEmote(actor);current.pending={id,seat};return true;
}
// A pending emote starts when the last one has finished ending.
const finish=actor=>{const e=actor.emote,next=e.pending;actor.emote=next&&canEmote(actor,next.id)?begin({...next,start:e.start+e.time}):null;};

// Advance the actor's emote by one controller step. Movement or a jump ends it;
// falling or swimming drops it at once. Returns true while movement must wait:
// a sitter or lier stands up before walking off.
export function stepEmote(actor,input,seconds){
 const e=actor.emote;if(!e)return false;
 if(actor.mode==='airborne'||actor.mode==='swimming'){actor.emote=null;return false;}
 const emote=emoteById(e.id),dt=clamp(Number.isFinite(seconds)?seconds:0,0,.1),moved=!!(input?.forward||input?.strafe||input?.jump);
 if(e.stage==='play'&&moved){endEmote(actor);e.pending=null;}
 e.time+=dt;
 if(emote.settle){
  const {enter,exit}=emote.settle;
  if(e.stage==='play')e.settle=Math.min(enter,e.settle+dt);
  else{e.exitTime+=dt;e.settle=Math.max(0,e.settle-dt*enter/exit);if(e.settle<=0){finish(actor);return false;}}
  return e.stage==='exit';
 }
 if(e.stage==='exit'){e.exitTime+=dt;if(e.exitTime>=EMOTE_FADES.cancel)finish(actor);}
 else if(!emote.loop&&e.time>=emote.duration)finish(actor);
 return false;
}

// Seats are collider box tops between knee and hip height next to the actor:
// tops are {id,height,x,z,c,s,cx,cz,hx,hz}, a yawed rectangle in the
// WorldRuntime collider frame. The sitter backs onto the nearest edge, facing
// out across it, with its seat point `inset` inside that edge.
export const SEAT_LIMITS=Object.freeze({min:.25,max:.7,reach:.8,inset:.2});
export function chooseSeat(tops,actor,{min=SEAT_LIMITS.min,max=SEAT_LIMITS.max,reach=SEAT_LIMITS.reach,inset=SEAT_LIMITS.inset}={}){
 let best=null;
 for(const top of tops??[]){
  const height=top.height-actor.position[1];if(height<min||height>max)continue;
  const dx=actor.position[0]-top.x,dz=actor.position[2]-top.z,u=top.c*dx-top.s*dz-top.cx,v=top.s*dx+top.c*dz-top.cz;
  const iu=Math.max(0,top.hx-inset),iv=Math.max(0,top.hz-inset),acrossU=Math.abs(u)-top.hx>=Math.abs(v)-top.hz;
  const nu=acrossU?Math.sign(u)||1:0,nv=acrossU?0:Math.sign(v)||1,pu=acrossU?nu*iu:clamp(u,-iu,iu),pv=acrossU?clamp(v,-iv,iv):nv*iv;
  const lu=pu+top.cx,lv=pv+top.cz,x=top.x+top.c*lu+top.s*lv,z=top.z-top.s*lu+top.c*lv;
  const distance=Math.hypot(actor.position[0]-x,actor.position[2]-z);if(distance>reach)continue;
  const fx=top.c*nu+top.s*nv,fz=-top.s*nu+top.c*nv,score=distance+.5*Math.abs(height-.45);
  if(!best||score<best.score)best={id:top.id,point:[x,top.height,z],yaw:Math.atan2(-fx,-fz),height,score};
 }
 if(!best)return null;const {score,...seat}=best;return seat;
}
