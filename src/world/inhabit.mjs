import {spring} from 'math/time';

const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight']);
const lookKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);

export function isWorldInputTarget(target){return !!target&&(!!target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName));}

// Return an intent only. The controller owns focus, pointer lock, held-key state,
// ray visibility and dispatch; no browser global is accessed here.
export function resolveWorldKey({code,repeat=false,editable=false,mode='author',cameraMode='walk',target=null,possessed=false}){
 if(code==='Escape')return repeat?null:{type:mode==='inhabit'?'leave':'release'};
 if(editable)return null;
 if(lookKeys.has(code))return ['walk','free'].includes(cameraMode)?{type:'look',code}:null;
 if(movementKeys.has(code)||cameraMode==='free'&&['KeyQ','KeyE'].includes(code))return ['walk','free'].includes(cameraMode)?{type:'move',code}:null;
 if(repeat)return null;
 if(code==='Space'&&possessed&&cameraMode==='walk')return {type:'jump'};
 // T holds the emote wheel open; 1-9 play its slots directly.
 if(possessed&&cameraMode==='walk'){
  if(code==='KeyT')return {type:'emote-wheel'};
  const slot=/^(?:Digit|Numpad)([1-9])$/.exec(code);if(slot)return {type:'emote',slot:Number(slot[1])-1};
 }
 if(code==='KeyG')return {type:'toggle-free'};
 if(code==='KeyV'&&possessed&&cameraMode==='walk')return {type:'toggle-person'};
 if(code==='KeyH'&&mode==='inhabit')return {type:'toggle-hud'};
 if(code==='Enter'||code==='Tab'&&mode==='inhabit')return {type:'compose'};
 if(code==='KeyF'&&mode==='author'&&target?.id&&!['hidden','missing'].includes(target.reason))return {type:'select',id:target.id};
 if(code!=='KeyE'||cameraMode!=='walk'||!target?.action)return null;
 return target.available?{type:'interact',id:target.id}:{type:'unavailable',id:target.id,reason:target.reason};
}

// Held keys integrate at a fixed angular rate, independent of OS key repeat.
export function stepCameraLook(view,input,seconds,{minPitch=-1.5,maxPitch=1.3}={}){
 if(!Number.isFinite(seconds)||seconds<=0)return view;
 const axis=value=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0,angle=1.6*Math.min(seconds,.1);
 view.yaw-=axis(input.turn)*angle;
 view.pitch=Math.max(minPitch,Math.min(maxPitch,view.pitch+axis(input.tilt)*angle));
 return view;
}

// A small head lean exposes the same body's legs when looking down. Sample the
// short eye path so the lean retracts before a nearby collider instead of clipping.
export function firstPersonEyePosition(position,eyeHeight,yaw,pitch,blocked=()=>false){
 const t=Math.max(0,Math.min(1,(-pitch-.8)/.6)),distance=.16+.1*t*t*(3-2*t),steps=Math.ceil(distance/.04);
 const eye=[position[0],position[1]+eyeHeight,position[2]],dx=-Math.sin(yaw)*distance,dz=-Math.cos(yaw)*distance;
 for(let i=1;i<=steps;i++){
  const x=position[0]+dx*i/steps,z=position[2]+dz*i/steps;
  if(blocked(x,z,.04,eye[1]-.06,.12))break;
  eye[0]=x;eye[2]=z;
 }
 return eye;
}

// Third-person follow camera. The boom pivots on a sprung copy of the eye: critically
// damped springs, exact for any frame time, ease steps, collider tops and the swim eye
// height vertically and barely trail horizontally. The boom retracts at once before
// terrain or a box and eases back out. A fresh state, or an eye that jumps several
// metres (spawn, recall), snaps instead of sweeping across the world.
export const FOLLOW_SMOOTHING=Object.freeze({horizontal:.04,vertical:.14,extend:.3,snap:3});
export const createFollowCamera=()=>({pivot:null,extend:null,position:[0,0,0],focus:[0,0,0]});
export const resetFollowCamera=state=>{state.pivot=null;state.extend=null;return state;};
// vertical:'lock' copies the eye height. The pose already eased that height; a second
// spring would lag every slope change and the body would bob in the frame.
export function stepFollowCamera(state,{eye,yaw,pitch,distance,height,ground=()=>null,blocked=()=>false,vertical='spring'},seconds){
 const dt=Number.isFinite(seconds)?Math.max(0,Math.min(seconds,.1)):0,S=FOLLOW_SMOOTHING;
 if(!state.pivot||Math.hypot(...eye.map((v,i)=>v-state.pivot[i].value))>S.snap){state.pivot=eye.map(v=>spring.create(v));state.extend=null;}
 else state.pivot.forEach((s,i)=>{
  if(i===1&&vertical==='lock'){s.velocity=dt>0?(eye[1]-s.value)/dt:0;s.value=eye[1];}
  else spring.update(s,eye[i],i===1?S.vertical:S.horizontal,1,dt);
 });
 const pivot=state.pivot.map(s=>s.value),cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 const back=height*sp+distance*cp,offset=[back*sy,height*cp-distance*sp,back*cy],steps=Math.ceil(Math.hypot(...offset)/.08);
 // Clear fraction of the boom: march to the first terrain or box obstruction, then bisect it.
 const clear=t=>{const x=pivot[0]+offset[0]*t,y=pivot[1]+offset[1]*t,z=pivot[2]+offset[2]*t,g=ground(x,z);return !(g&&y<g.height+.18)&&!blocked(x,z,.14,y-.14,.28);};
 let safe=1;
 for(let i=1;i<=steps;i++)if(!clear(i/steps)){let lo=(i-1)/steps,hi=i/steps;for(let k=0;k<5;k++){const mid=(lo+hi)/2;if(clear(mid))lo=mid;else hi=mid;}safe=lo;break;}
 if(!state.extend||safe<state.extend.value)state.extend=spring.create(safe);else spring.update(state.extend,safe,S.extend,1,dt);
 for(let i=0;i<3;i++)state.position[i]=pivot[i]+offset[i]*state.extend.value;
 // Frame the full inhabitant while keeping a forward point for looking.
 state.focus[0]=pivot[0]-1.4*cp*sy;state.focus[1]=pivot[1]-.6+1.4*sp;state.focus[2]=pivot[2]-1.4*cp*cy;
 return state;
}

// A free camera owns a copied pose, never the inhabitant's position array.
export function createFreeCamera(position,look=[0,0]){return {position:[...position],yaw:look[0],pitch:look[1]};}
export function stepFreeCamera(view,input,seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return view;
 const axis=v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
 const forward=axis(input.forward),strafe=axis(input.strafe),up=axis(input.up),c=Math.cos(view.yaw),s=Math.sin(view.yaw),pitch=Math.cos(view.pitch);
 const delta=[strafe*c-forward*s*pitch,up+forward*Math.sin(view.pitch),-strafe*s-forward*c*pitch],length=Math.max(1,Math.hypot(...delta)),distance=(input.sprint?24:8)*Math.min(seconds,.1)/length;
 for(let i=0;i<3;i++)view.position[i]+=delta[i]*distance;
 return view;
}
