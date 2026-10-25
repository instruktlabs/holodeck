import {Euler,Matrix4,Quaternion,Vector3} from 'three/webgpu';
import {MAKER_LIMBS} from './maker-model.mjs';
import {emoteWeight} from './emotes.mjs';

// The Maker's emote layer. It runs after the locomotion pose each frame and
// slerps keyed bone rotations over it by the emote's weight, so a cancelled
// emote eases back into whatever the legs are doing. Like the locomotion pose
// it is visual only: it reads actor.emote and never moves collision, support,
// the camera or input.
// Upper-body emotes keep the feet planted with their own leg solve; sitting and
// lying move the body onto its seat or the ground and place the feet by IK.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),TAU=Math.PI*2;
const ramp=(a,b,v)=>smooth(clamp((v-a)/(b-a),0,1));
// Rises over [a,b] and falls over [c,d].
const hold=(t,a,b,c,d)=>ramp(a,b,t)*(1-ramp(c,d,t));
const mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const {thigh:THIGH,shin:SHIN,upperArm:UPPER,forearm:FORE,ankleHeight:ANKLE}=MAKER_LIMBS,MAX_STEP=.35;
const SIDES=[['left',-1],['right',1]],FINGERS=['Index','Middle','Ring','Little'];

const q0=new Quaternion(),q1=new Quaternion(),q2=new Quaternion(),q3=new Quaternion(),e0=new Euler(),m0=new Matrix4();
const v0=new Vector3(),v1=new Vector3(),v2=new Vector3(),v3=new Vector3(),v4=new Vector3(),v5=new Vector3();
const fromEuler=(out,[x,y,z])=>out.setFromEuler(e0.set(x,y,z,'XYZ'));

// ---- Limb solving, in the upper bone's parent space ----
// Rotation taking a bone's rest axis (-y) onto dir with its local -z onto front.
function aim(out,dir,front){
 const y=v0.copy(dir).negate().normalize(),f=v1.copy(front).addScaledVector(y,-front.dot(y));
 if(f.lengthSq()<1e-10)f.set(0,0,-1).addScaledVector(y,-y.z);
 const z=f.normalize().negate(),x=v2.crossVectors(y,z);
 return out.setFromRotationMatrix(m0.makeBasis(x,y,z));
}
// Upper and lower rotations from the two segment directions. The lower bone
// folds toward local -z (an elbow, flex > 0) or +z (a knee, flex < 0). A nearly
// straight arm has no fold plane of its own, so it eases toward folding forward
// and up rather than spinning about itself.
const FOLD=new Vector3(0,.35,-1).normalize();
function limbFrom(upper,lower,upperDir,lowerDir,knee=null){
 const u=v3.copy(upperDir).normalize(),f=v4.copy(lowerDir).normalize(),flex=Math.acos(clamp(u.dot(f),-1,1));
 if(knee)aim(upper,u,knee);
 else{const own=ramp(.05,.6,flex);v5.copy(f).addScaledVector(u,-f.dot(u)).normalize().multiplyScalar(own).addScaledVector(v0.copy(FOLD).addScaledVector(u,-FOLD.dot(u)).normalize(),1-own);aim(upper,u,v5.clone());}
 return lower.setFromEuler(e0.set(knee?-flex:flex,0,0));
}
// Two-bone reach from origin toward target, the middle joint bending toward pole.
// Returns the two segment directions; reach eases in so a limb never snaps straight.
function reach(origin,target,pole,a,b){
 const n=new Vector3().subVectors(target,origin);let d=n.length();n.divideScalar(d||1);if(d<1e-6)n.set(0,-1,0);
 const full=a+b,soft=full*.965;if(d>soft)d=soft+(full-soft)*(1-Math.exp(-(d-soft)/(full-soft)));d=clamp(d,Math.abs(a-b)+1e-3,full-1e-4);
 const along=clamp((a*a+d*d-b*b)/(2*a*d),-1,1),side=new Vector3().copy(pole).addScaledVector(n,-pole.dot(n));
 if(side.lengthSq()<1e-10)side.set(0,0,-1).addScaledVector(n,-n.z);side.normalize();
 const upper=n.clone().multiplyScalar(along).addScaledVector(side,Math.sqrt(1-along*along));
 const lower=n.clone().multiplyScalar(d).addScaledVector(upper,-a).normalize();
 return {upper,lower,side};
}
const parentInverse=(bone,out)=>bone.parent.getWorldQuaternion(out).invert();

// ---- Hands ----
function hand(bones,side,curl,{spread=0,thumb=curl,index=curl}={}){
 FINGERS.forEach((f,i)=>{const c=i===0?index:curl;bones[side+f+'1']=[c*(.9+i*.06),0,(i-1.5)*spread];bones[side+f+'2']=[c*1.15,0,0];});
 bones[side+'Thumb1']=[thumb*.5,0,0];bones[side+'Thumb2']=[thumb*.8,0,0];
 return bones;
}
const breathing=t=>.012*Math.sin(t*TAU/4.4);

// ---- Emote poses ----
// Each returns a spec: bones (local XYZ euler before rest), body ({p} absolute or
// {dp} relative pelvis position, and {r} rotation), arms (segment directions or
// a hand target in clavicle space), hands (finger and palm directions in chest
// space), legs ('plant' or ankle targets in the anchored root frame) and root
// (move onto the anchor). Arm and hand x points toward the limb's own side.
const both=(f,bones={})=>{for(const [name,side] of SIDES)f(name,side,bones);return bones;};
const POSES={
 wave({t}){
  const up=hold(t,0,.45,1.9,2.4),wag=hold(t,.35,.6,1.75,2)*Math.sin((t-.35)*TAU*1.7),fore=[.16+.42*wag,.95,-.2];
  return {legs:'plant',bones:{...hand({},'right',.06,{spread:.14,thumb:.1}),chest:[0,-.06*up,.03*up],head:[.02,-.1,-.08]},
   arms:{right:{upper:[.6,.52,-.32],fore,weight:up}},hands:{right:{fingers:mix(fore,[.1,1,0],.3),palm:[0,0,-1],weight:up}}};
 },
 dance({t}){
  const bounce=.5-.5*Math.cos(TAU*2*t),sway=Math.sin(TAU*t),arms={},hands={};
  const bones=both((name,side,b)=>hand(b,name,1.1),{spine:[.03,-.1*sway,.04*sway],chest:[.02+.05*bounce,-.13*sway,.05*sway],neck:[.1*bounce-.04,.05*sway,0],head:[.06*bounce,.06*sway,-.07*sway]});
  for(const [name,side] of SIDES){const pump=Math.sin(TAU*t+(side<0?0:Math.PI)),fore=[.12,.3+.45*pump,-.95];arms[name]={upper:[.3,-.85+.3*Math.max(0,pump),-.25*pump],fore};hands[name]={fingers:fore,palm:[-1,0,0]};}
  return {legs:'plant',body:{dp:[.04*sway,-.04-.04*bounce,0],r:[-.05,.2*sway,-.06*sway]},bones,arms,hands};
 },
 clap({t}){
  const up=hold(t,0,.4,1.75,2.2),clapping=hold(t,.38,.5,1.62,1.78),open=.5+.5*Math.cos(TAU*2.4*(t-.45)),gap=lerp(.2,.035+.11*open,clapping),arms={},hands={};
  const bones=both((name,side,b)=>hand(b,name,.08,{thumb:.15}),{neck:[.05*clapping*(1-open),0,0],head:[.04,0,0]});
  for(const [name] of SIDES){arms[name]={hand:[gap-.07,-.16,-.27],pole:[.75,-.6,.25],weight:up};hands[name]={fingers:[-.2,.55,-1],palm:[-1,0,.1],weight:up};}
  return {legs:'plant',bones,arms,hands};
 },
 bow({t}){
  const b=hold(t,.15,.85,1.55,2.35);
  return {legs:'plant',body:{dp:[0,-.015*b,.05*b],r:[-.42*b,0,0]},
   bones:{...hand(hand({},'left',.35),'right',.12,{thumb:.2}),spine:[-.18*b,0,0],chest:[-.14*b,0,0],neck:[-.12*b,0,0],head:[-.14*b,0,0]},
   arms:{right:{hand:[-.12,-.2,-.24],pole:[.7,-.6,.1],weight:b},left:{hand:[-.08,-.42,.2],pole:[.7,-.4,.5],weight:b}},
   hands:{right:{fingers:[-1,.15,-.1],palm:[0,0,1],weight:b},left:{fingers:[-1,-.2,0],palm:[0,0,-1],weight:b}}};
 },
 point({t,actor,facing}){
  const up=hold(t,0,.35,1.7,2.2),turn=clamp(deltaAngle(facing,actor.yaw??facing),-1.1,1.1),pitch=clamp(actor.pitch??0,-.6,.8),yaw=facing+turn;
  const dir=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
  return {legs:'plant',bones:{...hand({},'right',1.35,{index:.02,thumb:.85}),spine:[0,.15*turn*up,0],chest:[0,.25*turn*up,0],neck:[.3*pitch*up,.2*turn*up,0],head:[.3*pitch*up,.25*turn*up,0]},
   arms:{right:{world:dir,weight:up}},hands:{right:{world:true,fingers:dir,palm:[0,-1,0],weight:up}}};
 },
 shrug({t}){
  const s=hold(t,.08,.4,1.05,1.65),arms={},hands={};
  const bones=both((name,side,b)=>{hand(b,name,.1,{spread:.18,thumb:.05});b[name+'Clavicle']=[0,0,side*.28*s];},{chest:[.04*s,0,0],neck:[-.08*s,0,0],head:[.05*s,0,.14*s]});
  for(const [name] of SIDES){arms[name]={upper:[.3,-.92,-.06],fore:[.62,.05,-.78],weight:s};hands[name]={fingers:[.55,.1,-.85],palm:[0,1,0],weight:s};}
  return {legs:'plant',bones,arms,hands};
 },
 cheer({t}){
  const up=hold(t,0,.45,1.85,2.4),pump=hold(t,.4,.55,1.6,1.8)*(.5-.5*Math.cos(TAU*2*(t-.45))),arms={},hands={};
  const bones=both((name,side,b)=>hand(b,name,1.25),{chest:[.12*up,0,0],neck:[.06*up,0,0],head:[.16*up,0,0]});
  for(const [name] of SIDES){const fore=mix([.4,.9,-.1],[.55,.25,-.75],pump*.6);arms[name]={upper:[.45,.88,-.05],fore,weight:up};hands[name]={fingers:fore,palm:[-.6,0,-1],weight:up};}
  return {legs:'plant',body:{dp:[0,-.035*pump,0],r:[0,0,0]},bones,arms,hands};
 },
 sit(context){return seated(context,0);},
 lie(context){return seated(context,smooth(clamp((context.settle-.85)/1.15,0,1)));},
};

// Sitting on a seat or the ground, and lying back from a ground sit (k = 1).
// The pelvis rests just above the surface; the feet stand on the ground ahead.
function seated({t,settle,anchor,ground},k){
 const h=anchor.seat?anchor.seat.height:0,chair=clamp(h/.45,0,1),down=Math.sin(Math.PI*clamp(settle/.9,0,1)),breath=breathing(t),reachOut=lerp(.52,.44,chair);
 // A lying body follows the ground's fall from head to feet.
 const slope=k>0?Math.atan2(ground(0,.85)-ground(0,-.85),1.7):0;
 const bones=both((name,side,b)=>hand(b,name,lerp(.3,.35,k)),{spine:[lerp(lerp(-.1,-.04,chair),-.02,k),0,0],chest:[lerp(-.04,0,k)+breath,0,0],neck:[lerp(.04,.22,k),0,0],head:[lerp(.06,-.12,k),0,lerp(0,.06,k)]});
 // Seated hands rest on the thighs or knees; lying hands cradle the head.
 const onLap=mix([.06,-.2,-.3],[.07,-.47,-.26],chair);
 const arms={},hands={},legs={};
 for(const [name,side] of SIDES){
  arms[name]={hand:mix(onLap,[-.12,.26,.12],k),pole:mix([.4,-.8,.2],[.6,.3,-1],k)};
  hands[name]={fingers:mix([-.1,-.45,-1],[-1,.1,0],k),palm:mix([0,-1,.1],[0,0,-1],k)};
  // Lying, the right knee stays up and the left leg stretches out.
  const ahead=lerp(reachOut,name==='right'?.56:.84,k);
  legs[name]={ankle:[side*lerp(.13,.12,k),lerp(ANKLE,.075,k),-ahead],pole:[0,lerp(.6,1,k),lerp(-1,-.2,k)],pitch:name==='left'?1.35*k:0};
 }
 return {root:true,cloth:1-k,legs,arms,hands,bones,
  body:{p:[0,lerp(h+.1,.13,k),lerp(0,-.02,k)],r:[lerp(lerp(.14,.06,chair)-.4*down*(1-k),Math.PI/2-.04-slope,k),0,0]}};
}

// ---- Layer state and application ----
export function createMakerEmoteLayer(){return {emote:null,anchor:null,weight:0};}
// Ground under x/z: the terrain or a walkable top within one step of the feet.
function groundAt(actor,terrain,walkable,x,z){
 const sample=terrain?.sample(x,z),valid=sample?.inBounds&&Number.isFinite(sample.height);
 let height=valid?sample.height:(actor.supportHeight??actor.position[1]);
 const top=walkable?.(x,z,actor.position[1]+MAX_STEP);if(top&&top.height>height)height=top.height;return height;
}
const down=new Vector3(0,-1,0);
function hang(bone,out){bone.getWorldQuaternion(q0).invert();const d=v0.copy(down).applyQuaternion(q0);out[0]=Math.atan2(-d.z,-d.y);out[1]=Math.atan2(d.x,-d.y);return out;}
const hipPitch=q=>Math.atan2(2*(q.w*q.x-q.y*q.z),1-2*(q.x*q.x+q.y*q.y));
function nudge(bone,pitch,roll,[minP,maxP],[minR,maxR]){e0.setFromQuaternion(bone.quaternion,'XYZ');bone.quaternion.setFromEuler(e0.set(clamp(e0.x+pitch,minP,maxP),e0.y,clamp(e0.z+roll,minR,maxR),'XYZ'));}

// Pose the emote over the locomotion pose already on the model. facing is the
// locomotion facing.
export function updateMakerEmote(model,actor,layer,{terrain=null,walkable=null,facing=model.root.rotation.y}={}){
 const e=actor?.emote;
 if(!e){layer.emote=null;layer.anchor=null;layer.weight=0;return layer;}
 // A seat or ground spot is fixed when the emote starts, so turning the camera
 // in first person does not swivel a sitter.
 if(layer.emote!==e){layer.emote=e;layer.anchor={seat:e.seat,yaw:e.seat?.yaw??facing,position:e.seat?[e.seat.point[0],actor.position[1],e.seat.point[2]]:[...actor.position]};}
 const w=emoteWeight(e);layer.weight=w;
 if(w<1e-4)return layer;
 const j=model.joints,root=model.root,anchor=layer.anchor,ca=Math.cos(anchor.yaw),sa=Math.sin(anchor.yaw);
 const ground=(x,z)=>groundAt(actor,terrain,walkable,anchor.position[0]+ca*x+sa*z,anchor.position[2]-sa*x+ca*z)-anchor.position[1];
 const spec=POSES[e.id]({t:e.time,settle:e.settle,actor,anchor,facing,ground});
 root.updateMatrixWorld(true);
 const before={chest:hang(j.chest,[0,0]),body:hang(model.body,[0,0]),hip:hipPitch(j.rightHip.quaternion)};
 // Remember where the locomotion pose put each ankle and knee: planted feet stay
 // there, and settling feet travel from there to their targets.
 const planted={};
 if(spec.legs)for(const [name] of SIDES)planted[name]={ankle:j[name+'Foot'].getWorldPosition(new Vector3()),knee:j[name+'Knee'].getWorldPosition(new Vector3()),hip:j[name+'Hip'].getWorldPosition(new Vector3()),foot:j[name+'Foot'].getWorldQuaternion(new Quaternion())};
 if(spec.root){
  root.position.set(lerp(actor.position[0],anchor.position[0],w),actor.position[1],lerp(actor.position[2],anchor.position[2],w));
  root.rotation.y=facing+deltaAngle(facing,anchor.yaw)*w;
 }
 if(spec.body){
  const b=spec.body,p=b.p?v0.set(...b.p):v0.copy(model.body.position).add(v1.set(...b.dp));
  model.body.position.lerp(p,w);if(b.r)model.body.quaternion.slerp(fromEuler(q1,b.r),w);
 }
 for(const [name,value] of Object.entries(spec.bones??{})){const bone=j[name];if(!bone)continue;fromEuler(q1,value);const rest=bone.userData?.rest;if(rest)q1.premultiply(rest);bone.quaternion.slerp(q1,w);}
 root.updateMatrixWorld(true);
 for(const [name,side] of SIDES){
  const arm=spec.arms?.[name];if(!arm)continue;
  const shoulder=j[name+'Shoulder'],elbow=j[name+'Elbow'],flip=v=>new Vector3(v[0]*side,v[1],v[2]);let upper,lower;
  if(arm.world){
   upper=new Vector3(...arm.world).applyQuaternion(parentInverse(shoulder,q0)).normalize();lower=upper.clone().add(v0.set(0,.06,0));
  }else if(arm.hand)({upper,lower}=reach(shoulder.position,flip(arm.hand),flip(arm.pole),UPPER,FORE));
  else{upper=flip(arm.upper);lower=flip(arm.fore);}
  // An arm's own weight raises it from wherever locomotion holds it.
  const t=w*(arm.weight??1);limbFrom(q2,q3,upper,lower);shoulder.quaternion.slerp(q2,t);elbow.quaternion.slerp(q3,t);
 }
 // Hands aim their fingers and palm in chest space (or the world), whatever the forearm does.
 for(const [name,side] of SIDES){
  const h=spec.hands?.[name];if(!h)continue;
  const wrist=j[name+'Wrist'],frame=h.world?q0.identity():j.chest.getWorldQuaternion(q0),flip=v=>new Vector3(h.world?v[0]:v[0]*side,v[1],v[2]).applyQuaternion(frame);
  aim(q2,flip(h.fingers),flip(h.palm));wrist.parent.getWorldQuaternion(q1).invert();wrist.quaternion.slerp(q1.multiply(q2),w*(h.weight??1));
 }
 if(spec.legs){
  root.updateMatrixWorld(true);
  for(const [name,side] of SIDES){
   const hip=j[name+'Hip'],knee=j[name+'Knee'],foot=j[name+'Foot'],leg=spec.legs==='plant'?null:spec.legs[name];
   const p=planted[name];let target=p.ankle,world=p.foot,pole=v0.subVectors(p.knee,v1.addVectors(p.hip,p.ankle).multiplyScalar(.5)).clone();
   if(pole.lengthSq()<1e-6)pole.set(-Math.sin(root.rotation.y),0,-Math.cos(root.rotation.y));pole.normalize();
   if(leg){
    const [x,y,z]=leg.ankle;target=target.clone().lerp(root.localToWorld(new Vector3(x,ground(x,z)+y,z)),w);
    pole.lerp(new Vector3(...leg.pole).normalize().applyAxisAngle(v0.set(0,1,0),root.rotation.y),w);
    world=world.clone().slerp(new Quaternion().setFromEuler(e0.set(0,root.rotation.y,0,'YXZ')).multiply(fromEuler(q1,[leg.pitch,0,0])),w);
   }
   // The solve is exact, so planted feet stay put and settling feet never dip below the ground.
   const inverse=parentInverse(hip,new Quaternion()),origin=hip.getWorldPosition(new Vector3());
   const solved=reach(new Vector3(),target.clone().sub(origin).applyQuaternion(inverse),pole.applyQuaternion(inverse),THIGH,SHIN);
   limbFrom(hip.quaternion,knee.quaternion,solved.upper,solved.lower,solved.side);
   hip.updateMatrixWorld(true);knee.getWorldQuaternion(q1).invert();foot.quaternion.copy(q1.multiply(world));
  }
 }
 root.updateMatrixWorld(true);
 // Cloth hangs again from the emote's torso: the shawl front and the sash follow
 // a bow or a sit; the back panel rides on the back.
 const cloth=spec.cloth??1;
 if(cloth>0&&j.capeFront){
  const chest=hang(j.chest,[0,0]),body=hang(model.body,[0,0]),dc=(chest[0]-before.chest[0])*cloth,dr=(chest[1]-before.chest[1])*cloth,db=(body[0]-before.body[0])*cloth;
  nudge(j.capeFront,dc*.85,dr*.5,[0,.95],[-.3,.3]);nudge(j.capeBack,dc*.85,dr*.6,[-.8,.06],[-.4,.4]);
  nudge(j.tie1,db*.9+Math.max(0,hipPitch(j.rightHip.quaternion)-before.hip)*.75*cloth,0,[-1.3,1.5],[-.4,.4]);nudge(j.sideTie1,db*.9,0,[-1.2,1.4],[-.4,.4]);
  root.updateMatrixWorld(true);
 }
 return layer;
}
export const MAKER_EMOTE_POSES=Object.freeze(Object.keys(POSES));
