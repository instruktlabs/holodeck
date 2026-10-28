import {deltaAngle,wrapAngle,quat,vec3} from 'math';
import {spring,spring2,spring3} from 'math/time';
import {MAKER_LIMBS} from './maker-model.mjs';

// Procedural Maker animation. Three layers (ground, air, swim) each produce a
// full local pose; they blend by quaternion slerp, then look, blink and cloth
// are layered on top. The controller's actor record is read, never written:
// feet, pelvis and cloth are visual and never move collision. The third-person
// boom reads visualEye, which is the eased support height plus the eased eye.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),TAU=Math.PI*2,UP=[0,1,0];
const lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const ramp=(a,b,v)=>smooth(clamp((v-a)/(b-a),0,1));
const SPEEDS={walkSpeed:2.6,runSpeed:4.5,swimSpeed:1.8};
const THIGH=MAKER_LIMBS.thigh,SHIN=MAKER_LIMBS.shin,ANKLE=MAKER_LIMBS.ankleHeight,PELVIS=MAKER_LIMBS.pelvisHeight,HIP=.105;
const LEG=THIGH+SHIN,MAX_STEP=.35,SOFT_REACH=.95;
// Crossover guard: a foot keeps this far to its own side of the root (and the IK
// target of the pelvis), turns no further than FOOT_YAW from the body, and an idle
// foot inside STEP_SIDE steps back out.
const MIN_SIDE=.07,IK_SIDE=.065,STEP_SIDE=.08,FOOT_YAW=.8,POLE_YAW=.25,SLIDE=1.2;
// Heel and ball contact points in foot space: the sole rolls about these.
const HEEL=[0,-ANKLE,.05],BALL=[0,-ANKLE,-.085];
const SIDES=[['left',-1],['right',1]],FINGERS=['Index','Middle','Ring','Little'];
const POSED=['spine','chest','neck','head',...SIDES.flatMap(([s])=>['Clavicle','Shoulder','Elbow','Wrist','Hip','Knee','Foot','Toe','Thumb1','Thumb2',...FINGERS.flatMap(f=>[f+'1',f+'2'])].map(n=>s+n))];

const createPose=()=>({p:[0,PELVIS,0],q:Object.fromEntries(['body',...POSED].map(n=>[n,[0,0,0,1]]))});
const footState=()=>({planted:false,initialized:false,swing:false,timed:false,lifted:true,t:0,t0:0,h0:0,duty:.5,shape:0,lastPhase:0,rel:[0,0],rate:0,shown:spring3.create([0,0,0]),land:spring.create(0),floor:spring.create(0),carried:false,carry:[0,0,0],height:0,yaw:0,fromYaw:0,toYaw:0,pitch:0,toe:0,anchor:[0,0,0],from:[0,0,0],to:[0,0,0],target:[0,0,0],normal:[0,1,0]});
const scalar=()=>spring.create(0);
export const createMakerMotion=()=>({
 actor:null,facingYaw:null,turnSpeed:0,previousPosition:[0,0,0],previousVelocity:[0,0],previousMode:'grounded',previousVertical:0,
 time:0,phase:0,lastPhase:0,airTime:0,airLead:1,airSpeed:0,airVertical:0,swimPhase:0,treadPhase:0,moving:false,
 speed:scalar(),run:scalar(),warm:scalar(),travel:spring2.create([0,0]),accel:scalar(),turn:scalar(),wade:scalar(),air:scalar(),swim:scalar(),crawl:scalar(),
 leanForward:scalar(),leanSide:scalar(),reach:spring.create(0),land:scalar(),rise:scalar(),climb:scalar(),eye:spring.create(1.72),visualEye:0,
 lookYaw:scalar(),lookPitch:scalar(),blink:{next:2.2,start:-1},
 cloth:{backPitch:scalar(),backRoll:scalar(),frontPitch:scalar(),frontRoll:scalar(),tie1:scalar(),tie1Roll:scalar(),tie2:scalar(),tie3:scalar(),side1:scalar(),side2:scalar()},
 feet:{left:footState(),right:footState()},
 poses:{ground:createPose(),air:createPose(),swim:createPose(),out:createPose()},
});

// Shared scratch keeps the per-frame solve light.
const e3=[0,0,0,'xyz'],m3=new Float32Array(9),qa=[0,0,0,1],qb=[0,0,0,1],qc=[0,0,0,1],va=[0,0,0],vb=[0,0,0],vc=[0,0,0],vd=[0,0,0],ve=[0,0,0];
function euler(out,x,y,z){e3[0]=x;e3[1]=y;e3[2]=z;return quat.fromEuler(out,e3);}
const yawQuat=(out,yaw)=>euler(out,0,yaw,0);
// Rotation taking a limb's rest axis (-y) onto dir, with its local -z (the
// side a hinge folds toward, or a kneecap faces) onto front.
function aim(out,dir,front){
 const y=vec3.normalize(va,vec3.negate(va,dir));
 vec3.scaleAndAdd(vb,front,y,-vec3.dot(front,y));if(vec3.length(vb)<1e-5){vb[0]=0;vb[1]=0;vb[2]=-1;vec3.scaleAndAdd(vb,vb,y,-vec3.dot(vb,y));}
 const z=vec3.negate(vb,vec3.normalize(vb,vb)),x=vec3.cross(vc,y,z);
 m3[0]=x[0];m3[1]=x[1];m3[2]=x[2];m3[3]=y[0];m3[4]=y[1];m3[5]=y[2];m3[6]=z[0];m3[7]=z[1];m3[8]=z[2];
 return quat.normalize(out,quat.fromMat3(out,m3));
}
// Analytic two-bone solve in the parent's space. A leg's knee points toward
// pole and its shin folds back; an arm's elbow points away from pole and its
// forearm folds toward it.
function twoBone(upper,lower,target,a,b,pole,leg){
 let d=vec3.length(target);const n=d>1e-6?vec3.scale(vd,target,1/d):vec3.set(vd,0,-1,0);
 // Soft reach: the last few percent of extension ease in, so a limb never snaps straight.
 const reach=a+b,soft=reach*SOFT_REACH;if(d>soft)d=soft+(reach-soft)*(1-Math.exp(-(d-soft)/(reach-soft)));
 d=clamp(d,Math.abs(a-b)+1e-3,reach-1e-4);
 const along=clamp((a*a+d*d-b*b)/(2*a*d),-1,1),flex=Math.PI-Math.acos(clamp((a*a+b*b-d*d)/(2*a*b),-1,1));
 const side=vec3.scaleAndAdd(ve,pole,n,-vec3.dot(pole,n));if(vec3.length(side)<1e-5)vec3.set(side,0,0,leg?-1:1);vec3.normalize(side,side);if(!leg)vec3.negate(side,side);
 const sinA=Math.sqrt(1-along*along),u=[n[0]*along+side[0]*sinA,n[1]*along+side[1]*sinA,n[2]*along+side[2]*sinA];
 const front=vec3.scaleAndAdd([0,0,0],side,u,-vec3.dot(side,u));if(!leg)vec3.negate(front,front);
 aim(upper,u,front);return euler(lower,leg?-flex:flex,0,0);
}
// FK arm from an upper-arm and forearm direction in the shoulder's parent space.
function armFrom(shoulder,elbow,upperDir,foreDir){
 const u=vec3.normalize([0,0,0],upperDir),f=vec3.normalize([0,0,0],foreDir),flex=Math.acos(clamp(vec3.dot(u,f),-1,1));
 aim(shoulder,u,flex>.02?f:[0,0,-1]);return euler(elbow,flex,0,0);
}
function slerpPose(out,a,b,t){
 if(t<=0){copyPose(out,a);return out;}if(t>=1){copyPose(out,b);return out;}
 for(let i=0;i<3;i++)out.p[i]=lerp(a.p[i],b.p[i],t);
 for(const name in out.q)quat.slerp(out.q[name],a.q[name],b.q[name],t);return out;
}
function copyPose(out,a){vec3.copy(out.p,a.p);for(const name in out.q)quat.copy(out.q[name],a.q[name]);return out;}
function resetPose(pose){vec3.set(pose.p,0,PELVIS,0);for(const name in pose.q)quat.identity(pose.q[name]);return pose;}
function fingers(pose,side,curl,spread=0,thumb=curl){
 FINGERS.forEach((f,i)=>{euler(pose.q[side+f+'1'],curl*(.9+i*.06),0,(i-1.5)*spread);euler(pose.q[side+f+'2'],curl*1.15,0,0);});
 euler(pose.q[side+'Thumb1'],thumb*.5,0,0);euler(pose.q[side+'Thumb2'],thumb*.8,0,0);
}

// Feet stand on terrain or a walkable collider top within one step of the
// actor, like the controller's own support rule; a step landing ahead on a climb
// may look further up, to the tread the body will have reached. Past a ledge the
// body falls rather than steps, so no foot reaches more than a step below it.
function groundAt(context,x,z,above=MAX_STEP){
 const {terrain,walkable,actor}=context,sample=terrain?.sample(x,z),valid=sample?.inBounds&&Number.isFinite(sample.height);
 let height=valid?sample.height:(actor.supportHeight??actor.position[1]),normal=valid?sample.normal:UP;
 const top=walkable?.(x,z,actor.position[1]+above),onTop=!!top&&top.height>height-1e-6;if(onTop){height=top.height;normal=UP;}
 if(height<actor.position[1]-MAX_STEP){height=actor.position[1]-MAX_STEP;normal=UP;}
 return {height,normal,onTop,inBounds:!terrain||!!valid||!!top};
}

// ---- Ground: gait-driven stance and swing feet, pelvis and upper body ----
function gaitParameters(m,speeds,wade){
 const v=m.speed.value,run=m.run.value;
 const steps=lerp(clamp(1.3+.6*v,1.5,2.7),clamp(2.6+.16*v,2.9,3.6),run)*(1-.22*wade);
 // The first steps from a standstill lift lower while the gait establishes itself.
 return {v,run,steps,stride:2*Math.max(v,.35)/steps,duty:lerp(.6,.32,run),lift:(lerp(.075+.02*v,.13+.05*v,run)+.2*wade)*lerp(.45,1,m.warm.value),front:lerp(.44,.4,run)};
}
function restSpot(out,context,side,facing,stance=.11){
 const {actor}=context,c=Math.cos(facing),s=Math.sin(facing),fore=side<0?.03:-.015;
 out[0]=actor.position[0]+c*side*stance-s*fore;out[2]=actor.position[2]-s*side*stance-c*fore;out[1]=groundAt(context,out[0],out[2]).height+ANKLE;return out;
}
// Distance of a world point from the root toward a foot's own side.
function sideOf({root,m},p,side){return side*(Math.cos(m.facingYaw)*(p[0]-root[0])-Math.sin(m.facingYaw)*(p[2]-root[2]));}
// Moves a point out to at least min on its own side of the root, by at most limit.
function keepSide(context,p,side,min=MIN_SIDE,limit=Infinity){
 const gap=Math.min(min-sideOf(context,p,side),limit),f=context.m.facingYaw;if(gap>0){p[0]+=Math.cos(f)*gap*side;p[2]-=Math.sin(f)*gap*side;}return gap>0;
}
// A new swing's sprung heights start from the ground it leaves; a re-aimed one keeps them.
function beginSwing(foot,from,fromYaw,t=0){if(!foot.swing)for(const k of [foot.land,foot.floor]){k.value=from[1]-ANKLE;k.velocity=0;}vec3.copy(foot.from,from);foot.fromYaw=fromYaw;foot.swing=true;foot.planted=false;foot.t=t;foot.t0=t;}
// Ankle displacement when the sole rolls by pitch about its heel (toes up) or ball (heel up).
function pivotOffset(out,pitch,yaw){
 const pivot=pitch>0?HEEL:BALL,c=Math.cos(pitch),s=Math.sin(pitch),oz=pivot[2]-(pivot[1]*s+pivot[2]*c);
 out[0]=Math.sin(yaw)*oz;out[1]=pivot[1]-(pivot[1]*c-pivot[2]*s);out[2]=Math.cos(yaw)*oz;return out;
}
// Horizontal offset of a point from the root, in world axes.
function offset2(out,point,origin){out[0]=point[0]-origin[0];out[1]=point[2]-origin[2];return out;}
function plant(foot,at,yaw){vec3.copy(foot.anchor,at);foot.yaw=yaw;foot.swing=false;foot.planted=true;foot.timed=false;foot.initialized=true;foot.carried=false;vec3.copy(foot.target,at);}
// In the air the ground layer's feet ride with the body from where they left the
// ground, so a jump or a ledge never re-plants them below; the air pose blends over them.
function carryFoot(context,foot,side){
 const {root,m}=context,f=m.facingYaw;
 if(!foot.carried){foot.carried=true;if(foot.initialized&&!context.reset)vec3.subtract(foot.carry,foot.shown.value,root);else vec3.set(foot.carry,Math.cos(f)*side*.11,ANKLE,-Math.sin(f)*side*.11);}
 vec3.add(foot.target,root,foot.carry);return foot;
}
// Foot position and roll for one frame. A planted foot holds its world anchor;
// a swing aims at a landing point from the current velocity, so turns and stops
// re-aim the step rather than sliding a planted foot.
function stepFoot(context,name,side,g,dt){
 const {actor,m}=context,foot=m.feet[name],facing=m.facingYaw,toeOut=-side*.07;
 const offset=side<0?0:.5,fp=((m.phase+offset)%1+1)%1;foot.carried=false;
 if(!foot.initialized){const spot=restSpot(vb,context,side,facing);plant(foot,spot,facing+toeOut);}
 let progress=0;
 if(m.moving){
  const previous=foot.lastPhase,wrapped=fp<previous-.5;foot.lastPhase=fp;
  if(foot.swing&&!foot.timed){
   // A gait swing lands when its foot's cycle wraps; it keeps the duty it lifted off
   // with, so a gait that changes mid-step never jumps the step's progress.
   if(wrapped){const ground=groundAt(context,foot.target[0],foot.target[2]),o=pivotOffset(vc,foot.pitch,foot.yaw);plant(foot,[foot.target[0]-o[0],ground.height+ANKLE,foot.target[2]-o[2]],foot.toYaw);}
   else{foot.t=clamp((fp-foot.duty)/(1-foot.duty),foot.t,1);foot.toYaw=facing+toeOut;}
  }
  if(wrapped)foot.lifted=false;
  if(!foot.swing){
   // A planted foot lifts once a cycle, at or past its lift point: a gait whose stance
   // shortens mid-step (walk into run) still lifts it, from the start of its swing.
   if(foot.lifted||fp<g.duty)progress=Math.min(1,fp/g.duty);
   else{beginSwing(foot,foot.target,foot.yaw);offset2(foot.rel,foot.target,actor.position);foot.h0=foot.target[1]-foot.anchor[1];foot.from[1]=foot.anchor[1];foot.lifted=true;foot.duty=Math.min(fp,.9);foot.height=g.lift;foot.shape=g.run;foot.t=clamp((fp-foot.duty)/(1-foot.duty),0,1);foot.toYaw=facing+toeOut;}
  }
 }
 if(foot.swing&&foot.timed){foot.t=Math.min(1,foot.t+dt*foot.rate);}
 if(!m.moving&&foot.swing&&!foot.timed){
  // A stop mid-swing restarts the step's easing toward the rest spot, so what remains
  // of it is never covered in a frame; a short remainder barely lifts.
  restSpot(foot.to,context,side,facing);const distance=Math.hypot(foot.to[0]-foot.target[0],foot.to[2]-foot.target[2]);
  beginSwing(foot,foot.target,foot.yaw);foot.timed=true;foot.height=Math.min(g.lift,.07)*clamp(distance/.2,0,1);foot.toYaw=facing+toeOut;foot.rate=1/Math.max(.18,distance/1.8);
 }
 if(foot.swing){
  const t=foot.t;let e;
  if(foot.timed){
   // A settling step eases between two world points.
   const e0=smooth(foot.t0);e=(smooth(t)-e0)/Math.max(1e-4,1-e0);foot.target[0]=lerp(foot.from[0],foot.to[0],e);foot.target[2]=lerp(foot.from[2],foot.to[2],e);keepSide(context,foot.target,side);
   const arc=u=>Math.sin(Math.PI*u),lift=(arc(t)-arc(foot.t0)*(1-e))*foot.height,floor=spring.update(foot.floor,groundAt(context,foot.target[0],foot.target[2]).height,.03,1,dt).value;
   foot.target[1]=Math.max(lerp(foot.from[1],foot.to[1],e),floor+ANKLE)+lift;
  }else{
   // A gait step follows a Bezier that travels with the root: it leaves and lands at
   // zero ground speed, tucks the heel early when running and lands ahead of the hip.
   // Offsets are world-axis, so a sharp turn re-aims the landing without sweeping the foot.
   // Travel direction comes from smoothed velocity and fades when slow, so reversals stay continuous.
   e=smooth(t);const [vx,vz]=m.travel.value,speed=Math.max(.6,Math.hypot(vx,vz)),dx=vx/speed,dz=vz/speed,c=Math.cos(facing),s=Math.sin(facing);
   const duration=(1-foot.duty)*g.stride/Math.max(g.v,.35),pull=g.v*duration/3,ahead=g.front*g.duty*g.stride,width=side*lerp(.105,.08,g.run);
   // A strafe or a turn never lands a foot across the other: the landing keeps to its own side.
   let p3x=width*c+dx*ahead,p3z=-width*s+dz*ahead;const across=MIN_SIDE-side*(c*p3x-s*p3z);if(across>0){p3x+=c*across*side;p3z-=s*across*side;}
   const p0=foot.rel,p1x=p0[0]-dx*pull,p1z=p0[1]-dz*pull,p2x=p3x+dx*pull,p2z=p3z+dz*pull;
   const u=1-t,b0=u*u*u,b1=3*u*u*t,b2=3*u*t*t,b3=t*t*t;
   foot.target[0]=actor.position[0]+b0*p0[0]+b1*p1x+b2*p2x+b3*p3x;foot.target[2]=actor.position[2]+b0*p0[1]+b1*p1z+b2*p2z+b3*p3z;keepSide(context,foot.target,side);
   // Clearance peaks early (a heel tuck) when running and settles to the ground with zero vertical speed.
   const rise=Math.sin(Math.PI*Math.pow(t,lerp(.95,.62,foot.shape)))**2*foot.height+foot.h0*(1-e);
   // The step lands where the root will be by then, plus its landing offset. The landing
   // height and the ground under the foot are sprung, so re-aiming onto a tread or crossing
   // its edge eases the foot up or down instead of jumping it; a collider top ahead raises
   // the floor early so the foot clears its edge. The springs tighten as the step ends, so
   // the foot arrives on the ground it lands on; climbing, it may land a tread higher.
   const up=MAX_STEP+clamp(m.climb.value*duration,0,MAX_STEP),remaining=(1-t)*duration,lx=actor.position[0]+p3x+vx*remaining,lz=actor.position[2]+p3z+vz*remaining,lag=lerp(1,.25,t);
   const landing=groundAt(context,lx,lz,up),between=groundAt(context,(foot.target[0]+lx)/2,(foot.target[2]+lz)/2,up),land=spring.update(foot.land,landing.height,.05*lag,1,dt).value;
   const under=groundAt(context,foot.target[0],foot.target[2],up).height,edge=ground=>ground.onTop&&ground.height<=under+MAX_STEP?ground.height:under;
   const floor=spring.update(foot.floor,Math.max(edge(between),edge(landing)),.03*lag,1,dt).value;
   foot.target[1]=Math.max(lerp(foot.from[1],land+ANKLE,e),floor+ANKLE)+rise;
  }
  foot.yaw=foot.fromYaw+deltaAngle(foot.fromYaw,foot.toYaw)*e;
  const toeOff=-lerp(.7,.9,g.run);foot.pitch=lerp(toeOff,lerp(.25,.06,g.run),smooth(clamp(t*1.4,0,1)))+.18*Math.sin(Math.PI*t)*(1-g.run);
  foot.toe=Math.max(0,-foot.pitch)*(1-smooth(clamp(t*3,0,1)));
  vec3.lerp(foot.normal,foot.normal,UP,1-Math.exp(-dt*10));
  if(foot.timed&&t>=1)plant(foot,foot.to,foot.toYaw);
 }else{
  // Crossover guard: a stance foot the body turns over slides out to its own side and
  // pivots toward the body's heading, rather than crossing the other leg or twisting it.
  if(keepSide(context,foot.anchor,side,MIN_SIDE,SLIDE*dt))foot.anchor[1]=groundAt(context,foot.anchor[0],foot.anchor[2]).height+ANKLE;
  const twist=deltaAngle(facing,foot.yaw),held=clamp(twist,-FOOT_YAW,FOOT_YAW);foot.yaw+=clamp(held-twist,-8*dt,8*dt);
  vec3.copy(foot.target,foot.anchor);
  const strike=lerp(.26,.06,g.run),heelOff=lerp(.56,.3,g.run);
  const pitch=!m.moving?0:progress<.18?strike*(1-smooth(progress/.18)):progress>heelOff?-lerp(.72,.92,g.run)*smooth((progress-heelOff)/(1-heelOff)):0;
  foot.pitch+=(pitch-foot.pitch)*(1-Math.exp(-dt*(m.moving?40:14)));foot.toe=Math.max(0,-foot.pitch);
  const ground=groundAt(context,foot.anchor[0],foot.anchor[2]).normal;vec3.lerp(foot.normal,foot.normal,ground,1-Math.exp(-dt*18));
 }
 foot.swing=foot.swing&&!foot.planted;
 // Roll about the heel or ball so the sole pivots on its contact, never through the ground.
 if(!foot.swing&&Math.abs(foot.pitch)>1e-4){
  const o=pivotOffset(vc,foot.pitch,foot.yaw);foot.target[0]+=o[0];foot.target[1]+=o[1];foot.target[2]+=o[2];
 }
 return foot;
}
// Settling: with the gait stopped, feet that strayed from a comfortable stance
// (a stop mid-stride, a turn on the spot) step back one at a time.
function settleFeet(context,dt){
 const {m}=context,facing=m.facingYaw;let worst=null,error=0,swinging=false;
 for(const [name,side] of SIDES){
  const foot=m.feet[name];if(foot.swing){swinging=true;continue;}
  const spot=restSpot(vc,context,side,facing),distance=Math.hypot(spot[0]-foot.anchor[0],spot[2]-foot.anchor[2]),turn=Math.abs(deltaAngle(foot.yaw,facing-side*.07));
  if(turn>1.6){beginSwing(foot,foot.anchor,foot.yaw);foot.timed=true;foot.rate=1/.12;foot.height=.05;vec3.copy(foot.to,spot);foot.toYaw=facing-side*.07;continue;}
  // A foot the body has turned over toward the midline steps out first, and quickly.
  const crossed=sideOf(context,foot.anchor,side)<STEP_SIDE,score=Math.max(distance/.13,turn/.5,crossed?3:0);if(score>1&&score>error){error=score;worst=[foot,side,crossed];}
 }
 if(worst&&!swinging){const [foot,side,crossed]=worst;beginSwing(foot,foot.anchor,foot.yaw);foot.timed=true;foot.rate=crossed?1/.2:1/.3;foot.height=.06;restSpot(foot.to,context,side,facing);foot.toYaw=facing-side*.07;}
}
function groundPose(pose,context,g,dt){
 const {actor,m,root}=context,t=m.time,move=clamp(g.v/1.2,0,1),idle=1-move,run=g.run,wade=m.wade.value,phase=m.phase*TAU,c=Math.cos(phase);
 resetPose(pose);
 if(!m.moving)settleFeet(context,dt);
 for(const [name,side] of SIDES){
  const foot=context.airborne?carryFoot(context,m.feet[name],side):stepFoot(context,name,side,g,dt),shown=foot.shown;
  // Feet follow their path through a short critically damped filter (25 ms in swing, 12 ms
  // planted) that removes one-frame spikes at lift-off and touchdown.
  if(context.reset||!foot.initialized){vec3.copy(shown.value,foot.target);shown.velocity.fill(0);}else spring3.update(shown,foot.target,foot.swing?.025:.012,1,dt);
 }
 // Pelvis: crouch with speed, a bob twice per cycle (high mid-stance walking,
 // low mid-stance running), sway toward the support foot, and idle weight shifts.
 const breath=Math.sin(t*TAU/4.4),shift=Math.sin(t*.53)*Math.sin(t*.19+1),stance=g.duty/2;
 // The default walk is already a jog, so the gait blend is the run. A run-sized
 // hip bounce at that cadence reversed every step. The bounce stays a shallow
 // walk until the speed is actually a sprint.
 const bob=Math.cos(2*TAU*(m.phase-stance))*lerp(.01,-.016,ramp(3.1,4.4,m.speed.value))*move;
 const crouch=lerp(.022,lerp(.03+.01*g.v,.034+.007*g.v,run),move)+.05*wade;
 const base=PELVIS-crouch+bob+.003*breath*idle;
 pose.p[0]=(-Math.sin(phase)*lerp(.022,.008,run)*move+shift*.022*idle);pose.p[2]=0;
 // Reach: never ask a supporting leg for more than it has. The limit uses the sole's
 // contact, not the ankle: swing clearance and the heel/toe roll lift the ankle
 // several centimetres and were pulling the hips up, then dumping them at the plant.
 const cy=Math.cos(m.facingYaw),sy=Math.sin(m.facingYaw);let reach=base;
 for(const [name,side] of SIDES){
  const foot=m.feet[name];
  // A step fades in over its last 15% and out across the end of stance, so the
  // lower bound eases from one foot to the other instead of switching in a frame.
  let influence=1;
  if(foot.swing){if(foot.timed||foot.t<.85)continue;influence=smooth((foot.t-.85)/.15);}
  else if(m.moving)influence=1-ramp(g.duty*.72,Math.max(g.duty*.72+.04,g.duty),(m.phase+(side<0?0:.5))%1);
  if(influence<=0)continue;
  const dx=foot.target[0]-actor.position[0],dz=foot.target[2]-actor.position[2],lx=cy*dx-sy*dz-side*HIP-pose.p[0],lz=sy*dx+cy*dz,horizontal=Math.hypot(lx,lz);
  const contact=foot.swing?foot.land.value+ANKLE:foot.anchor[1],vertical=Math.sqrt(Math.max(0,(LEG*SOFT_REACH)**2-horizontal*horizontal));
  const hold=1-ramp(.55,.75,horizontal);reach=Math.min(reach,lerp(base,contact-root[1]+vertical,hold*influence));
 }
 // The gait height is already a cosine. Springing it made every reversal a
 // velocity kick. Only the extra crouch for a stretched leg is filtered, and it
 // cannot add height back.
 const dip=Math.min(0,reach-base),sink=m.reach.value-dt;
 spring.update(m.reach,dip,.16,1,dt);
 if(m.reach.value<sink){m.reach.value=sink;m.reach.velocity=Math.max(m.reach.velocity,-1);}
 if(context.reset){m.reach.value=dip;m.reach.velocity=0;}
 pose.p[1]=base+Math.min(0,m.reach.value)+m.land.value;
 // Torso: pelvis yaw follows the swinging leg, the chest counters it, the head stays level.
 const yawAmp=lerp(.07,.12,run)*move*(1+.6*wade),roll=-Math.sin(phase)*lerp(.05,.025,run)*move;
 const lean=m.leanForward.value,side=m.leanSide.value;
 euler(pose.q.body,lean*.55+.01*breath*idle,-yawAmp*c,side*.6+roll+shift*.025*idle);
 euler(pose.q.spine,lean*.25-.01*run*move,yawAmp*c*.6,-roll*.5);
 euler(pose.q.chest,lean*.2+.012*breath*idle-.03*run*move,yawAmp*c*.9,-roll*.4+side*.2);
 euler(pose.q.neck,-lean*.45-.006*breath*idle,-yawAmp*c*.7,-side*.4);
 euler(pose.q.head,-lean*.35+.02*idle,-yawAmp*c*.6,-shift*.02*idle-side*.25);
 // Arms counter the legs: walking swings loosely from the shoulder, running pumps from bent elbows.
 const swing=lerp(.26+.08*g.v,.5+.06*g.v,run)*move*(1-.5*wade),elbow=lerp(.22+.1*g.v*move,1.35+.12*Math.sin(phase*2),run*move);
 for(const [name,sideSign] of SIDES){
  // Running pumps further back than forward, and the elbow closes as the hand comes up.
  const arm=sideSign<0?-c:c,forward=arm*swing*(arm>0?lerp(1,.72,run):lerp(1,1.12,run)),pump=run*move;
  euler(pose.q[name+'Clavicle'],0,0,sideSign*(.01*breath*idle+.025*pump*Math.max(0,arm)));
  euler(pose.q[name+'Shoulder'],forward+.03-.08*pump+.18*wade+.02*Math.sin(t*.9+sideSign)*idle,sideSign*-.22*pump*Math.max(0,arm),sideSign*(.07+.07*pump+.42*wade)+sideSign*.012*breath*idle);
  euler(pose.q[name+'Elbow'],elbow+arm*lerp(.18,.32,pump)+Math.max(0,forward)*lerp(.3,0,pump)+.38*wade+.06*idle,0,0);
  euler(pose.q[name+'Wrist'],lerp(.08,-.12,run*move),0,sideSign*.06);
  fingers(pose,name,lerp(.42,1.15,run*move),.03*idle,lerp(.35,.9,run*move));
 }
 return pose;
}
function solveLegs(pose,context){
 const {root,m}=context,qBody=quat.copy(qa,pose.q.body),inverse=quat.invert(qb,qBody),c=Math.cos(m.facingYaw),s=Math.sin(m.facingYaw);
 for(const [name,side] of SIDES){
  const foot=m.feet[name],at=foot.shown.value,dx=at[0]-root[0],dy=at[1]-root[1],dz=at[2]-root[2];
  const local=[c*dx-s*dz-pose.p[0],dy-pose.p[1],s*dx+c*dz-pose.p[2]];vec3.transformQuat(local,local,inverse);
  // Last guard against crossing: the leg never reaches past the pelvis midline.
  if(side*local[0]<IK_SIDE)local[0]=side*IK_SIDE;local[0]-=side*HIP;
  // The knee points along the pelvis, turned a little out with a toed-out foot and
  // barely in with a toed-in one, so it never folds across toward the other leg.
  const relative=side*clamp(side*deltaAngle(m.facingYaw,foot.yaw),-POLE_YAW,.08),pole=[-Math.sin(relative)+side*.06,0,-Math.cos(relative)];vec3.transformQuat(pole,pole,inverse);
  twoBone(pose.q[name+'Hip'],pose.q[name+'Knee'],local,THIGH,SHIN,pole,true);
  // World foot orientation: planted yaw, ground tilt, then heel/toe roll.
  const world=yawQuat([0,0,0,1],foot.yaw),n=foot.normal,tilt=quat.rotationTo([0,0,0,1],UP,vec3.normalize([0,0,0],[clamp(n[0],-.45,.45),Math.max(.5,n[1]),clamp(n[2],-.45,.45)]));
  quat.multiply(world,tilt,world);quat.multiply(world,world,euler(qc,foot.pitch,0,0));
  const parent=yawQuat([0,0,0,1],m.facingYaw);quat.multiply(parent,parent,qBody);quat.multiply(parent,parent,pose.q[name+'Hip']);quat.multiply(parent,parent,pose.q[name+'Knee']);
  quat.multiply(pose.q[name+'Foot'],quat.invert(parent,parent),world);euler(pose.q[name+'Toe'],foot.toe,0,0);
 }
}

// ---- Air: a tucked rise and a reaching fall, leading with the stride leg ----
function airPose(pose,context){
 // A standing jump tucks both knees evenly; a running jump keeps the stride's lead leg.
 // The air pose fading out after touchdown keeps the vertical speed it last had.
 const {actor,m}=context,vy=context.airborne?actor.verticalVelocity??0:m.airVertical,rise=ramp(-2.5,2.5,vy),fall=1-rise,lead=m.airLead,flail=ramp(.55,1.1,m.airTime),stride=clamp(m.airSpeed/2,0,1);
 resetPose(pose);pose.p[1]=PELVIS-.03*rise;
 euler(pose.q.spine,-.05*rise+.04*fall-.06*(1-stride)*rise,0,0);euler(pose.q.chest,-.04*rise,0,0);euler(pose.q.neck,.04,0,0);euler(pose.q.head,.06*fall+.05*(1-stride)*rise,0,0);
 for(const [name,side] of SIDES){
  const leading=side===lead,arm=!leading,tuck=lerp(.85,1,stride);
  const hip=lerp(lerp(.25,.85,rise),leading?lerp(.32,1.0,rise):lerp(.12,-.22,rise),stride),knee=lerp(-lerp(.35,1.35,rise),leading?-lerp(.42,1.3,rise):-lerp(.3,.8,rise),stride);
  euler(pose.q[name+'Hip'],hip*tuck,0,side*lerp(.1,.04,rise));euler(pose.q[name+'Knee'],knee,0,0);
  euler(pose.q[name+'Foot'],lerp(-.2*rise,leading?-.12*rise:-.32*rise+.08*fall,stride),0,0);
  const wave=Math.sin(m.airTime*7+side)*.35*flail,swing=lerp(lerp(.15,1.25,rise),arm?lerp(.3,.85,rise):lerp(.2,-.25,rise),stride);
  euler(pose.q[name+'Shoulder'],swing+wave,0,side*(lerp(.55,.22,rise)+.3*flail));
  euler(pose.q[name+'Elbow'],lerp(.45,.75,rise),0,0);euler(pose.q[name+'Wrist'],.1,0,0);fingers(pose,name,lerp(.25,.5,rise),.12*fall);
 }
 return pose;
}

// ---- Swim: treading water at rest, a front crawl under way ----
// Crawl arm path, keyed by stroke phase from hand entry: upper-arm and forearm
// directions in chest space (x toward this arm's side, y toward the head,
// z toward the back). Entry, catch, pull, push, exit, lift, recovery, reach.
const CRAWL=[
 [0,[.08,.97,-.22],[.06,.97,-.24]],[.12,[.12,.82,-.56],[.02,.35,-.94]],[.26,[.1,.25,-.96],[-.12,-.25,-.96]],[.4,[.15,-.55,-.82],[.08,-.88,-.47]],
 [.5,[.28,-.88,.1],[.25,-.9,.3]],[.62,[.42,-.3,.85],[.2,-.55,-.8]],[.76,[.5,.35,.79],[.15,.25,-.95]],[.89,[.25,.82,.5],[.1,.88,-.45]],
];
function crawlArm(out,which,phase){
 const k=CRAWL.findLastIndex(([at])=>at<=phase),a=CRAWL[k],b=CRAWL[(k+1)%CRAWL.length],span=((b[0]-a[0])+1)%1||1,t=smooth((phase-a[0])/span);
 const p0=CRAWL[(k+CRAWL.length-1)%CRAWL.length],p3=CRAWL[(k+2)%CRAWL.length],s=t*t,cube=s*t;
 for(let i=0;i<3;i++)out[i]=.5*((2*a[which][i])+(-p0[which][i]+b[which][i])*t+(2*p0[which][i]-5*a[which][i]+4*b[which][i]-p3[which][i])*s+(-p0[which][i]+3*a[which][i]-3*b[which][i]+p3[which][i])*cube);
 return vec3.normalize(out,out);
}
function swimPose(pose,context){
 const {actor,m}=context,crawl=m.crawl.value,tread=1-crawl,surface=actor.surfaceHeight??actor.position[1]+1,ground=actor.supportHeight??-Infinity;
 const tp=m.treadPhase*TAU,stroke=((m.swimPhase%1)+1)%1;
 resetPose(pose);
 // Depth: the chest rides at the surface when treading; a crawl floats the body flat.
 const treadDepth=Math.max(.46,Math.min(.62,surface-ground-.82)),depth=lerp(treadDepth,.2,crawl)-.022*Math.sin(tp*2)*tread;
 pose.p[1]=surface-depth-context.root[1];pose.p[2]=.3*crawl;
 // The body rolls toward the pulling arm and the head turns to breathe on the recovering side.
 const rollAmp=.52*crawl,roll=-Math.sin(stroke*TAU+.6)*rollAmp,breathe=crawl*Math.max(0,Math.sin((stroke-.5)*TAU))**2;
 euler(pose.q.body,lerp(-.16,-1.42,crawl),roll*.7+.04*Math.sin(tp*.5)*tread,0);
 euler(pose.q.spine,lerp(-.02,.06,crawl),roll*.2,0);euler(pose.q.chest,lerp(.06,.04,crawl),roll*.25,0);
 euler(pose.q.neck,lerp(-.04,.42,crawl),.55*breathe,0);euler(pose.q.head,lerp(.1,.3,crawl),.45*breathe,0);
 const tuck=ramp(.62,.48,treadDepth);
 for(const [name,side] of SIDES){
  // Treading: an eggbeater kick and sculling hands just under the surface.
  const kick=tp+(side<0?0:Math.PI),scull=Math.sin(tp+side*.4);
  const treadArm=[[0,0,0,1],[0,0,0,1]];euler(treadArm[0],.5,side*.35*scull,side*(.82+.12*Math.sin(tp*1)));euler(treadArm[1],1.05+.12*scull,0,0);
  const treadHip=euler([0,0,0,1],.78+.25*Math.sin(kick)+.35*tuck,side*-.25,side*(.3+.08*Math.cos(kick))),treadKnee=euler([0,0,0,1],-(1.25+.35*Math.cos(kick+.6)+.4*tuck),0,0);
  // Crawl: authored stroke path for the arm, a six-beat flutter kick for the leg.
  const armPhase=(stroke+(side<0?0:.5))%1,upper=crawlArm([0,0,0],1,armPhase),fore=crawlArm([0,0,0],2,armPhase);upper[0]*=side;fore[0]*=side;
  const crawlPose=[[0,0,0,1],[0,0,0,1]];armFrom(crawlPose[0],crawlPose[1],upper,fore);
  const flutter=Math.sin(stroke*TAU*3+(side<0?0:Math.PI));
  const crawlHip=euler([0,0,0,1],.08+.26*flutter,0,side*.05),crawlKnee=euler([0,0,0,1],-(.18+.32*Math.max(0,Math.sin(stroke*TAU*3+(side<0?0:Math.PI)+.9))),0,0);
  quat.slerp(pose.q[name+'Shoulder'],treadArm[0],crawlPose[0],crawl);quat.slerp(pose.q[name+'Elbow'],treadArm[1],crawlPose[1],crawl);
  quat.slerp(pose.q[name+'Hip'],treadHip,crawlHip,crawl);quat.slerp(pose.q[name+'Knee'],treadKnee,crawlKnee,crawl);
  const reach=Math.max(0,Math.cos(armPhase*TAU))*crawl;
  euler(pose.q[name+'Clavicle'],0,0,side*.22*reach);
  euler(pose.q[name+'Foot'],lerp(.22,-1.05+.12*flutter,crawl),0,0);euler(pose.q[name+'Toe'],lerp(0,-.2,crawl),0,0);
  euler(pose.q[name+'Wrist'],lerp(.15,.12,crawl),lerp(-side*1.2,-side*Math.PI/2,crawl),0);
  fingers(pose,name,lerp(.18,.1,crawl),0,lerp(.2,.05,crawl));
 }
 return pose;
}

// ---- Layers over the blended pose ----
function lookAround(pose,context,dt){
 const {actor,m}=context,third=actor.camera==='third',offset=third?deltaAngle(m.facingYaw,actor.yaw):0,behind=1-ramp(1.7,2.5,Math.abs(offset));
 const free=(1-m.air.value*.6)*(1-m.crawl.value*m.swim.value),idle=1-clamp(m.speed.value/1.2,0,1);
 const wanderYaw=(.32*Math.sin(m.time*.23)*Math.sin(m.time*.071+2))*idle,wanderPitch=.06*Math.sin(m.time*.17+1)*idle;
 const yaw=third?clamp(offset,-1.15,1.15)*behind*free+wanderYaw*(1-behind*.7):0,pitch=third?clamp((actor.pitch??0)*.75,-.45,.35)*behind*free+wanderPitch:0;
 spring.update(m.lookYaw,yaw,.28,1,dt);spring.update(m.lookPitch,pitch,.3,1,dt);
 const ly=m.lookYaw.value,lp=-m.lookPitch.value;
 quat.multiply(pose.q.chest,pose.q.chest,euler(qc,0,ly*.15,0));quat.multiply(pose.q.neck,pose.q.neck,euler(qc,lp*.4,ly*.35,0));quat.multiply(pose.q.head,pose.q.head,euler(qc,lp*.6,ly*.5,0));
}
function blink(model,m){
 const eyes=model.joints.eyes;if(!eyes)return;
 if(m.time>=m.blink.next){m.blink.start=m.time;const r=Math.sin(m.time*91.7)*43758.5453;m.blink.next=m.time+2.4+3.2*(r-Math.floor(r));}
 const t=m.time-m.blink.start,closed=t<.06?t/.06:t<.15?1-(t-.06)/.09:0;eyes.scale.y=1-.92*clamp(closed,0,1);
 const core=model.palette?.ember;if(core)core.emissiveIntensity=1.05+.18*Math.sin(m.time*1.7)+.1*Math.sin(m.time*.43);
}
// Cloth: damped springs per panel and sash link, driven by travel, acceleration,
// turning and gravity against the torso's tilt; water slows and streams them.
function clothLayer(model,context,pose,dt){
 const {actor,m}=context,j=model.joints;if(!j.capeBack)return;
 const k=m.cloth,swim=m.swim.value,c=Math.cos(m.facingYaw),s=Math.sin(m.facingYaw),vx=actor.velocity?.[0]??0,vz=actor.velocity?.[2]??0;
 const forward=-s*vx-c*vz,right=c*vx-s*vz,accel=m.accel.value,turn=m.turn.value;
 quat.multiply(qc,pose.q.body,pose.q.spine);quat.multiply(qc,qc,pose.q.chest);
 const down=vec3.transformQuat(va,[0,-1,0],quat.invert(qb,qc)),hangPitch=Math.atan2(-down[2],-down[1]),hangRoll=Math.atan2(down[0],-down[1]);
 const smoothTime=lerp(.16,.45,swim),damping=lerp(.32,.9,swim),flutter=Math.sin(m.time*8.3)*.04*clamp(Math.abs(forward)/3,0,1)*(1-swim);
 const air=m.air.value*clamp(-(actor.verticalVelocity??0)*.05,-.2,.25);
 k.backPitch.velocity+=accel*.035*dt*60*(1-swim);k.frontPitch.velocity-=accel*.02*dt*60*(1-swim);
 spring.update(k.backPitch,clamp(lerp(hangPitch*.85,.05,swim)-.11*forward*(1-swim)-air+flutter,-.8,.06),smoothTime,damping,dt);
 spring.update(k.backRoll,clamp(hangRoll*.6-.06*right+turn*.08,-.4,.4),smoothTime,damping,dt);
 spring.update(k.frontPitch,clamp(hangPitch*.85*(1-.8*swim)+.04*Math.abs(right)+air*.4-flutter*.5,0,.7),smoothTime,damping,dt);
 spring.update(k.frontRoll,clamp(hangRoll*.5-.05*right,-.3,.3),smoothTime,damping,dt);
 euler(qa,k.backPitch.value,0,k.backRoll.value);j.capeBack.quaternion.set(...qa);euler(qa,k.frontPitch.value,0,k.frontRoll.value);j.capeFront.quaternion.set(...qa);
 // The sash hangs from the hip: gravity against the pelvis, the right thigh pushing it forward.
 const hip=pitchOf(pose.q.rightHip),pelvisDown=vec3.transformQuat(vb,[0,-1,0],quat.invert(qc,pose.q.body)),pelvisHang=Math.atan2(-pelvisDown[2],-pelvisDown[1]);
 k.tie1.velocity+=accel*.05*dt*60*(1-swim);
 spring.update(k.tie1,clamp(pelvisHang*.9-.1*forward*(1-swim)+Math.max(0,hip)*.75-.9*swim*m.crawl.value,-1.3,1.1),lerp(.14,.4,swim),lerp(.3,.85,swim),dt);
 spring.update(k.tie1Roll,clamp(-.08*right+turn*.06+Math.sin(m.time*3.1)*.03*(1-swim),-.4,.4),.2,.4,dt);
 spring.update(k.tie2,k.tie1.velocity*-.05+(k.tie1.value-pelvisHang)*-.25,.12,.35,dt);spring.update(k.tie3,k.tie2.velocity*-.05+k.tie2.value*.5,.1,.35,dt);
 spring.update(k.side1,clamp(pelvisHang*.9-.08*forward*(1-swim)+Math.max(0,hip)*.5-.8*swim*m.crawl.value,-1.2,1),.12,.32,dt);spring.update(k.side2,k.side1.velocity*-.04,.1,.35,dt);
 euler(qa,k.tie1.value,0,k.tie1Roll.value);j.tie1.quaternion.set(...qa);euler(qa,k.tie2.value,0,0);j.tie2.quaternion.set(...qa);euler(qa,k.tie3.value,0,0);j.tie3.quaternion.set(...qa);
 euler(qa,k.side1.value,0,k.tie1Roll.value*.7);j.sideTie1.quaternion.set(...qa);euler(qa,k.side2.value,0,0);j.sideTie2.quaternion.set(...qa);
}
// Euler X of an XYZ quaternion: how far a hip has swung forward.
const pitchOf=([x,y,z,w])=>Math.atan2(2*(w*x-y*z),1-2*(x*x+y*y));

function applyPose(model,pose){
 const j=model.joints;model.body.position.set(...pose.p);model.body.quaternion.set(...pose.q.body);
 for(const name of POSED){const bone=j[name];if(!bone)continue;const q=pose.q[name],rest=bone.userData?.rest;bone.quaternion.set(q[0],q[1],q[2],q[3]);if(rest&&(rest.x||rest.y||rest.z))bone.quaternion.premultiply(rest);}
}

export function updateMakerPose(model,current,terrain,motion,seconds,walkable=null){
 const dt=Number.isFinite(seconds)?clamp(seconds,0,.1):0,m=motion,speeds={...SPEEDS,...current.config};
 // A new actor, a recall or a teleport resets; a frame hitch while running or falling does not.
 const jump=current.position.map((v,i)=>v-m.previousPosition[i]),reset=m.actor!==current||Math.hypot(jump[0],jump[2])>1||Math.abs(jump[1])>.6+Math.abs(current.verticalVelocity??0)*dt;
 if(reset){
  m.facingYaw=current.yaw;m.turnSpeed=0;m.previousVelocity[0]=current.velocity?.[0]??0;m.previousVelocity[1]=current.velocity?.[2]??0;m.lastPhase=current.gaitPhase??0;m.phase=0;
  for(const key of ['speed','run','warm','accel','turn','wade','air','swim','crawl','leanForward','leanSide','reach','land','rise','lookYaw','lookPitch'])Object.assign(m[key],{value:0,velocity:0});
  m.swim.value=current.mode==='swimming'?1:0;m.air.value=current.mode==='airborne'?1:0;m.previousMode=current.mode;
  for(const foot of Object.values(m.feet)){foot.planted=false;foot.initialized=false;foot.swing=false;foot.timed=false;foot.carried=false;foot.lifted=true;}
 }
 // The feet anchor sits on the heightfield, so its height kinks on triangle edges
 // and steps a whole tread at once. Climb tracks the slope the feet also look
 // ahead with. Motion that matches it is followed exactly. A sharper change is
 // left in rise and eased; the old allowance let a several-degree crease through
 // in one frame, which read as a tick. A stale slope must not keep pushing that
 // ease past the ground: at a crest it held the body several centimetres high
 // until climb caught up. Climb is not cleared on a tread: the stepping foot
 // uses it to find the next step up.
 const along=Math.hypot(jump[0],jump[2]);
 if(!reset&&dt>0&&current.mode!=='airborne'&&m.previousMode!=='airborne'){
  const expected=m.climb.value*dt,allow=.0015+.01*along,followed=clamp(jump[1],expected-allow,expected+allow);
  const next=m.rise.value-(jump[1]-followed);
  // A real tread is a bigger step than the slope we believed, and has to be absorbed.
  // A crest is the opposite: the slope was steeper than the ground, and following
  // it would lift the body off the surface it has already reached.
  const milder=Math.abs(jump[1])<Math.abs(expected)-allow,floats=milder&&((next>0&&next>m.rise.value)||(next<0&&next<m.rise.value));
  if(!floats)m.rise.value=next;spring.update(m.climb,jump[1]/dt,.2,1,dt);
 }else{m.climb.value=0;m.climb.velocity=0;}
 spring.update(m.rise,0,.12,1,dt);m.rise.value=clamp(m.rise.value,-.4,.4);
 // Eye height changes with swimming. It eases on its own so a stroke does not
 // drop the view by the whole standing-to-swim difference in one frame.
 if(reset){m.eye.value=current.eyeHeight;m.eye.velocity=0;}else spring.update(m.eye,current.eyeHeight,.14,1,dt);
 const root=[current.position[0],current.position[1]+m.rise.value,current.position[2]];
 m.visualEye=root[1]+m.eye.value;
 m.actor=current;for(let i=0;i<3;i++)m.previousPosition[i]=current.position[i];m.time+=dt;
 const vx=current.velocity?.[0]??0,vz=current.velocity?.[2]??0,speed=Math.hypot(vx,vz),previousYaw=m.facingYaw;
 // Facing: first person follows the camera; third person turns toward travel at a bounded rate.
 if(current.camera!=='third'){m.facingYaw=current.yaw;m.turnSpeed=0;}
 else if(speed>.04&&current.speed>.04){
  const error=deltaAngle(m.facingYaw,Math.atan2(-vx,-vz)),rate=current.mode==='swimming'?4:10,blend=1-Math.exp(-dt*12),wanted=clamp(error*rate,-6,6);
  m.turnSpeed+=clamp((wanted-m.turnSpeed)*blend,-30*dt,30*dt);
  const turn=m.turnSpeed*dt;m.facingYaw=wrapAngle(m.facingYaw+(Math.abs(turn)>Math.abs(error)?error:turn));
 }else m.turnSpeed=0;
 model.root.position.set(...root);model.root.rotation.y=m.facingYaw;
 const c=Math.cos(m.facingYaw),s=Math.sin(m.facingYaw),forward=-s*vx-c*vz,right=c*vx-s*vz;
 const acceleration=dt>0?(-s*(vx-m.previousVelocity[0])-c*(vz-m.previousVelocity[1]))/dt:0;m.previousVelocity[0]=vx;m.previousVelocity[1]=vz;
 const turnRate=dt>0?deltaAngle(previousYaw,m.facingYaw)/dt:0;
 spring.update(m.accel,clamp(acceleration,-20,20),.12,1,dt);spring.update(m.turn,clamp(turnRate,-6,6),.15,1,dt);
 spring.update(m.speed,Math.min(speed,current.speed??speed),.1,1,dt);spring2.update(m.travel,[vx,vz],.1,1,dt);if(reset){m.travel.value[0]=vx;m.travel.value[1]=vz;m.travel.velocity.fill(0);}
 spring.update(m.run,ramp(1.9,2.5,m.speed.value),.1,1,dt);
 spring.update(m.leanForward,clamp(-forward*lerp(.025,.03,m.run.value)-m.accel.value*.012,-.2,.12),.14,1,dt);
 spring.update(m.leanSide,clamp(-right*.03+m.turn.value*Math.min(speed,4.5)*.035,-.16,.16),.16,1,dt);
 const airborne=current.mode==='airborne'||current.grounded===false&&current.mode!=='swimming',swimming=current.mode==='swimming';
 spring.update(m.air,airborne?1:0,.07,1,dt);spring.update(m.swim,swimming?1:0,.2,1,dt);if(reset){m.air.value=airborne?1:0;m.swim.value=swimming?1:0;}
 spring.update(m.wade,swimming?0:ramp(.12,1.15,current.waterDepth??0),.25,1,dt);
 spring.update(m.crawl,swimming?ramp(.25,.85,Math.max(speed,current.speed??0)/speeds.swimSpeed):0,.35,1,dt);
 const context={actor:current,m,terrain,walkable,reset,root,airborne};
 // Landing absorbs the fall in the knees: a sprung pelvis drop scaled by impact speed.
 if(m.previousMode==='airborne'&&!airborne){
  const impact=Math.max(0,-m.previousVertical);m.land.velocity-=Math.min(impact,14)*.16;
  // Feet touch down flat where the air pose left them.
  model.root.updateMatrixWorld(true);
  for(const [name,side] of SIDES){const e=model.joints[name+'Foot'].matrixWorld.elements,ground=groundAt(context,e[12],e[14]);const foot=m.feet[name];plant(foot,[e[12],ground.height+ANKLE,e[14]],m.facingYaw-side*.07);foot.pitch=foot.toe=0;}
 }
 if(airborne){if(m.previousMode!=='airborne'){m.airTime=0;m.airLead=Math.cos(m.phase*TAU)>0?-1:1;m.airSpeed=m.speed.value;}m.airTime+=dt;m.airVertical=current.verticalVelocity??0;}
 spring.update(m.land,0,.17,.48,dt);m.land.value=clamp(m.land.value,-.24,.04);
 m.previousMode=current.mode;m.previousVertical=current.verticalVelocity??0;
 // Gait phase advances with distance actually travelled, one cycle per stride.
 const g=gaitParameters(m,speeds,m.wade.value),traveled=((((current.gaitPhase??0)-m.lastPhase)%TAU+TAU)%TAU)*1.5/TAU;m.lastPhase=current.gaitPhase??0;
 const wasMoving=m.moving;m.moving=!airborne&&!swimming&&(current.speed??speed)>.12&&m.speed.value>.08;
 if(m.moving&&!wasMoving&&!reset&&m.feet.left.initialized&&m.feet.right.initialized){
  // Start with the foot that is furthest behind the direction of travel, or the one already stepping.
  const behind=([name,side])=>{const f=m.feet[name];return f.swing?-1e3:(f.anchor[0]-current.position[0])*vx+(f.anchor[2]-current.position[2])*vz;};
  const [first]=[...SIDES].sort((a,b)=>behind(a)-behind(b)),start=g.duty+.001;
  for(const [name] of SIDES){const foot=m.feet[name];if(!foot.timed)continue;foot.timed=false;const ground=groundAt(context,foot.target[0],foot.target[2]).height+ANKLE;beginSwing(foot,[foot.target[0],ground,foot.target[2]],foot.yaw);offset2(foot.rel,foot.target,current.position);foot.h0=foot.target[1]-ground;foot.duty=g.duty;foot.height=g.lift;foot.shape=g.run;}m.phase=((start-(first[1]<0?0:.5))%1+1)%1;
  // The first foot lifts now; the other waits for its cycle to come round if it lies past its lift point.
  for(const [name,side] of SIDES){const foot=m.feet[name];foot.lastPhase=name===first[0]?g.duty-1e-3:((m.phase+(side<0?0:.5))%1+1)%1;foot.lifted=name!==first[0]&&foot.lastPhase>=g.duty;}
 }
 if(m.moving)m.phase=(m.phase+traveled/g.stride)%1;
 spring.update(m.warm,m.moving?1:0,m.moving?.3:.15,1,dt);
 m.treadPhase+=dt*1.1;m.swimPhase+=dt*m.crawl.value*(.32+.5*clamp(Math.max(speed,current.speed??0)/speeds.swimSpeed,0,1.4));
 const p=m.poses,weights={air:m.air.value,swim:m.swim.value};
 if(weights.swim<.999&&weights.air<.999||!m.feet.left.initialized){groundPose(p.ground,context,g,dt);solveLegs(p.ground,context);}
 else for(const foot of Object.values(m.feet)){foot.planted=false;foot.initialized=false;foot.swing=false;}
 if(weights.air>.001||airborne)airPose(p.air,context);
 if(airborne)for(const foot of Object.values(m.feet)){foot.planted=false;foot.swing=false;foot.initialized=false;}
 if(weights.swim>.001)swimPose(p.swim,context);
 slerpPose(p.out,p.ground,p.air,weights.air);if(weights.swim>.001)slerpPose(p.out,p.out,p.swim,weights.swim);
 lookAround(p.out,context,dt);applyPose(model,p.out);clothLayer(model,context,p.out,dt);blink(model,m);
}
