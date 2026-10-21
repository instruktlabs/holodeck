import {deltaAngle,wrapAngle,quat,vec3} from 'math';
import {fabrik3} from 'math/ik';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),TAU=Math.PI*2,DOWN=[0,-1,0],UP=[0,1,0];
const smooth=t=>t*t*(3-2*t);
const footState=()=>({planted:false,initialized:false,swing:false,progress:0,duration:.25,toeOff:0,lift:0,facingYaw:0,anchor:[0,0,0],offset:[0,0,0],target:[0,0,0],normal:[0,1,0],chain:null,local:[0,0,0],pole:[0,0,0],axis:[0,0,0],upper:[0,0,0,1],lower:[0,0,0,1],inverse:[0,0,0,1],rotation:[0,0,0,1]});
export const createMakerMotion=()=>({amount:0,swim:0,air:0,facingYaw:null,turnSpeed:0,pelvisY:.9,visualPhase:0,lastPhase:0,stride:1,leanForward:0,leanSide:0,previousVelocity:[0,0],previousPosition:[0,0,0],actor:null,feet:{left:footState(),right:footState()},bodyInverse:[0,0,0,1]});

function groundAt(terrain,x,z,actor){
 const sample=terrain?.sample(x,z),valid=sample?.inBounds&&Number.isFinite(sample.height);
 return {height:valid?sample.height:(actor.supportHeight??actor.position[1]),normal:valid?sample.normal:UP,inBounds:!terrain||!!valid};
}

// Each half-cycle has one supporting foot. The swing polynomial meets the
// stance with matching velocity; cached world offsets retain turning contacts.
function targetFoot(model,side,actor,terrain,motion,phase,reset,dt){
 const name=side<0?'left':'right',foot=motion.feet[name],hip=model.joints[`${name}Hip`],yaw=motion.facingYaw,c=Math.cos(yaw),s=Math.sin(yaw);
 const cycle=((phase/TAU)%1+1)%1,t=Math.max(0,cycle*2-1),moving=actor.speed>.08,amount=Math.min(1,motion.amount),r=motion.stride*.25;
 // The stance travels backwards relative to the pelvis at exactly root speed.
 // Swing joins both stance endpoints with equal velocity, including toe-off.
 const localZ=(cycle<.5?-r+4*r*cycle:r+2*r*t-12*r*t*t+8*r*t*t*t)*amount;
 const x=actor.position[0]+c*hip.position.x+s*localZ,z=actor.position[2]-s*hip.position.x+c*localZ;
 const support=groundAt(terrain,x,z,actor),y=actor.position[1]+clamp(support.height-actor.position[1],-.22,.22)+.09+Math.sin(Math.PI*t)**2*.09*amount;
 const stance=cycle<.5||amount<.03,wasStance=foot.planted,canPlant=stance&&moving&&amount>.985&&support.inBounds&&Math.abs(deltaAngle(foot.facingYaw,yaw))<.7;
 if(reset||!foot.initialized){foot.target[0]=x;foot.target[1]=y;foot.target[2]=z;vec3.copy(foot.anchor,foot.target);foot.initialized=true;foot.planted=false;foot.facingYaw=yaw;foot.offset.fill(0);foot.toeOff=0;foot.lift=0;}
 if(canPlant){
  if(!wasStance){foot.anchor[0]=x;foot.anchor[1]=y;foot.anchor[2]=z;foot.facingYaw=yaw;}
  vec3.copy(foot.target,foot.anchor);
 }else{
  if(wasStance){
   const continuation=(-r+4*r*cycle)*amount;
   foot.offset[0]=foot.target[0]-(moving&&!stance?actor.position[0]+c*hip.position.x+s*continuation:x);
   foot.offset[1]=foot.target[1]-foot.lift-(moving&&!stance?y-Math.sin(Math.PI*t)**2*.09*amount:y);
   foot.offset[2]=foot.target[2]-(moving&&!stance?actor.position[2]-s*hip.position.x+c*continuation:z);
  }
  const keep=moving&&!stance?1-smooth(t):Math.exp(-dt*16);
  if(!moving||stance)for(let i=0;i<3;i++)foot.offset[i]*=keep;
  foot.target[0]=x+foot.offset[0]*(moving&&!stance?keep:1);foot.target[1]=y+foot.offset[1]*(moving&&!stance?keep:1);foot.target[2]=z+foot.offset[2]*(moving&&!stance?keep:1);
 }
 foot.planted=canPlant;foot.swing=!stance&&amount>.03;foot.progress=t;foot.duration=motion.stride/Math.max(.2,actor.speed)*.5;
 const toeTarget=stance?Math.sin(Math.PI*clamp((cycle-.3)/.2,0,1))*.7*amount:-Math.sin(Math.PI*t)*.25*amount;
 foot.toeOff+=(toeTarget-foot.toeOff)*(1-Math.exp(-dt*24));
 foot.lift=Math.max(0,foot.toeOff)*.045;foot.target[1]+=foot.lift;
 const normal=support.normal??UP;for(let i=0;i<3;i++)foot.normal[i]+=(normal[i]-foot.normal[i])*(reset?1:1-Math.exp(-dt*18));
 return foot;
}

function createLegChain(model,name){
 const upper=model.joints[`${name}Knee`].position.length(),lower=model.joints[`${name}Foot`].position.length(),bend=Math.min(.04,upper*.1,lower*.1),firstY=-Math.sqrt(upper*upper-bend*bend),chain=fabrik3.createChain3();
 fabrik3.addBone(chain,[0,0,0],[0,firstY,-bend]);fabrik3.addBone(chain,[0,firstY,-bend],[0,firstY-Math.sqrt(lower*lower-bend*bend),0]);
 chain.maxIterations=12;chain.solveDistanceThreshold=.001;chain.minIterationChange=.00001;
 return chain;
}

// Two persistent FABRIK chains correct lateral contact as well as height. Their
// caller-owned arrays and iteration cap bound the visual solve to two legs.
function solveLeg(model,name,actor,motion){
 const foot=motion.feet[name],hip=model.joints[`${name}Hip`],knee=model.joints[`${name}Knee`],ankle=model.joints[`${name}Foot`];
 const chain=foot.chain??(foot.chain=createLegChain(model,name)),c=Math.cos(motion.facingYaw),s=Math.sin(motion.facingYaw),v=foot.local;
 const dx=foot.target[0]-actor.position[0],dz=foot.target[2]-actor.position[2];
 v[0]=c*dx-s*dz-model.body.position.x;v[1]=foot.target[1]-actor.position[1]-model.body.position.y;v[2]=s*dx+c*dz-model.body.position.z;
 vec3.transformQuat(v,v,motion.bodyInverse);v[0]-=hip.position.x;v[1]-=hip.position.y;v[2]-=hip.position.z;
 const length=Math.hypot(...v),bounded=clamp(length,.25,chain.length-.018);if(length>0)vec3.scale(v,v,bounded/length);
 // Seed the forward-knee branch in the target/pole plane. A global hinge keeps
 // FABRIK on that branch rather than flipping an unconstrained near-straight leg.
 const first=chain.bones[0],second=chain.bones[1],along=(first.length*first.length-second.length*second.length+bounded*bounded)/(2*bounded),bend=Math.sqrt(Math.max(0,first.length*first.length-along*along));
 foot.pole[0]=0;foot.pole[1]=0;foot.pole[2]=-1;vec3.transformQuat(foot.pole,foot.pole,motion.bodyInverse);
 const dot=vec3.dot(foot.pole,v)/(bounded*bounded);vec3.scaleAndAdd(foot.pole,foot.pole,v,-dot);vec3.normalize(foot.pole,foot.pole);
 vec3.scale(first.end,v,along/bounded);vec3.scaleAndAdd(first.end,first.end,foot.pole,bend);vec3.copy(second.start,first.end);vec3.copy(second.end,v);
 vec3.cross(foot.axis,v,foot.pole);vec3.normalize(foot.axis,foot.axis);
 fabrik3.setBaseboneHingeConstraint(chain,fabrik3.BaseboneConstraintType.GLOBAL_HINGE,foot.axis,Math.PI,Math.PI,v);
 fabrik3.setHingeJoint(second.joint,fabrik3.JointType.GLOBAL_HINGE,foot.axis,2.6,0,first.end);
 fabrik3.solve(chain,v);
 fabrik3.getBoneRotation(foot.upper,chain,0,DOWN);fabrik3.getBoneRotation(foot.lower,chain,1,DOWN);
 hip.quaternion.set(...foot.upper);quat.invert(foot.inverse,foot.upper);quat.multiply(foot.rotation,foot.inverse,foot.lower);knee.quaternion.set(...foot.rotation);
 const normal=foot.normal,nx=c*normal[0]-s*normal[2],nz=s*normal[0]+c*normal[2];
 v[0]=clamp(nx/Math.max(.1,normal[1]),-.4,.4);v[1]=1;v[2]=clamp(nz/Math.max(.1,normal[1]),-.4,.4);vec3.normalize(v,v);vec3.transformQuat(v,v,motion.bodyInverse);
 quat.rotationTo(foot.rotation,UP,v);quat.fromEuler(foot.upper,[-.4*foot.toeOff,0,0]);quat.multiply(foot.rotation,foot.rotation,foot.upper);quat.invert(foot.inverse,foot.lower);quat.multiply(foot.rotation,foot.inverse,foot.rotation);ankle.quaternion.set(...foot.rotation);
}

export function updateMakerPose(model,current,terrain,motion,seconds){
 const dt=Number.isFinite(seconds)?clamp(seconds,0,.1):0,blend=1-Math.exp(-dt*12),m=motion,j=model.joints;
 const reset=m.actor!==current||Math.hypot(...current.position.map((v,i)=>v-m.previousPosition[i]))>.6;
 if(reset){m.facingYaw=current.yaw;m.turnSpeed=0;m.amount=0;m.swim=0;m.air=0;m.leanForward=0;m.leanSide=0;m.previousVelocity[0]=current.velocity?.[0]??0;m.previousVelocity[1]=current.velocity?.[2]??0;for(const foot of Object.values(m.feet)){foot.planted=false;foot.initialized=false;foot.chain=null;}}
 m.actor=current;for(let i=0;i<3;i++)m.previousPosition[i]=current.position[i];
 const vx=current.velocity?.[0]??0,vz=current.velocity?.[2]??0,speed=Math.hypot(vx,vz),previousYaw=m.facingYaw;
 if(current.camera!=='third'){m.facingYaw=current.yaw;m.turnSpeed=0;}
 else if(speed>.04&&current.speed>.04){
  const error=deltaAngle(m.facingYaw,Math.atan2(-vx,-vz)),wanted=clamp(error*10,-6,6);
  m.turnSpeed+=clamp((wanted-m.turnSpeed)*blend,-30*dt,30*dt);
  const turn=m.turnSpeed*dt;m.facingYaw=wrapAngle(m.facingYaw+(Math.abs(turn)>Math.abs(error)?error:turn));
 }else m.turnSpeed=0;
 model.root.position.set(...current.position);model.root.rotation.y=m.facingYaw;
 const turn=dt>0?deltaAngle(previousYaw,m.facingYaw)/dt:0,c=Math.cos(m.facingYaw),s=Math.sin(m.facingYaw),forward=-s*vx-c*vz,right=c*vx-s*vz;
 const acceleration=dt>0?(-s*(vx-m.previousVelocity[0])-c*(vz-m.previousVelocity[1]))/dt:0;m.previousVelocity[0]=vx;m.previousVelocity[1]=vz;
 m.leanForward+=(clamp(-forward*.035-acceleration*.002,-.16,.12)-m.leanForward)*blend;
 m.leanSide+=(clamp(-right*.035+turn*Math.min(speed,4.5)*.008,-.14,.14)-m.leanSide)*blend;
 const airborne=current.mode==='airborne'||current.grounded===false&&current.mode!=='swimming';
 m.amount+=(Math.min(1.3,current.speed/current.config.walkSpeed)-m.amount)*blend;
 m.swim+=((current.mode==='swimming'?1:0)-m.swim)*blend;m.air+=((airborne?1:0)-m.air)*blend;
 const stride=clamp(.75+speed*.1,.8,1.2);m.stride=stride;if(reset){m.visualPhase=current.gaitPhase;m.lastPhase=current.gaitPhase;}const traveled=((current.gaitPhase-m.lastPhase+TAU)%TAU)*1.5/TAU;m.lastPhase=current.gaitPhase;m.visualPhase=(m.visualPhase+traveled*TAU/stride)%TAU;
 const phase=m.visualPhase,swing=Math.sin(phase),opposite=-swing,swim=m.swim,walk=(1-swim)*(1-m.air);
 model.body.rotation.set(-1.1*swim+m.leanForward*walk,0,m.leanSide*walk);
 model.body.position.y=.9-.075*Math.min(1,m.amount)*walk+Math.abs(Math.sin(phase*2))*.006*m.amount*walk;
 if(!airborne&&current.mode!=='swimming'&&swim<.1&&m.air<.1){
  targetFoot(model,-1,current,terrain,m,phase,reset,dt);targetFoot(model,1,current,terrain,m,phase+Math.PI,reset,dt);
  // A bounded pelvis drop gives each leg reach on cross slopes. It is visual
  // compensation only; controller feet, collision and camera height stay fixed.
  for(const name of ['left','right']){
   const foot=m.feet[name],hip=j[`${name}Hip`],dx=foot.target[0]-current.position[0]-c*hip.position.x,dz=foot.target[2]-current.position[2]+s*hip.position.x,horizontal=Math.hypot(dx,dz);
   const reach=j[`${name}Knee`].position.length()+j[`${name}Foot`].position.length()-.02;
   model.body.position.y=Math.min(model.body.position.y,foot.target[1]-current.position[1]+Math.sqrt(Math.max(.25,reach*reach-horizontal*horizontal)));
  }
  const targetY=Math.max(.68,model.body.position.y);m.pelvisY=reset?targetY:m.pelvisY+clamp((targetY-m.pelvisY)*blend,-.6*dt,.6*dt);model.body.position.y=m.pelvisY;
  model.body.quaternion.toArray(m.bodyInverse);quat.invert(m.bodyInverse,m.bodyInverse);
  solveLeg(model,'left',current,m);solveLeg(model,'right',current,m);
 }else{
  for(const foot of Object.values(m.feet)){foot.planted=false;foot.initialized=false;}
  j.leftHip.rotation.set(swing*m.amount*.17*swim-.16*m.air,0,0);j.rightHip.rotation.set(opposite*m.amount*.17*swim+.12*m.air,0,0);
  j.leftKnee.rotation.set(-(.15+Math.max(0,swing)*m.amount*.15)*swim-.35*m.air,0,0);j.rightKnee.rotation.set(-(.15+Math.max(0,opposite)*m.amount*.15)*swim-.25*m.air,0,0);
  j.leftFoot.rotation.set(.12*swim,0,0);j.rightFoot.rotation.set(.12*swim,0,0);
 }
 j.leftShoulder.rotation.set((.05-swing*m.amount*.29)*walk+(2.45+swing*m.amount*.43)*swim-.18*m.air,0,-.07-.27*swim-.13*m.air);
 j.rightShoulder.rotation.set((.05-opposite*m.amount*.29)*walk+(2.45+opposite*m.amount*.43)*swim-.18*m.air,0,.07+.27*swim+.13*m.air);
 j.leftElbow.rotation.x=.13+.13*m.amount+.18*swim+.18*m.air;j.rightElbow.rotation.x=.13+.13*m.amount+.18*swim+.18*m.air;
}
