import {createTerrain,sampleWater} from './terrain.mjs';

export const INHABITANT_DEFAULTS=Object.freeze({preset:'maker',camera:'first',walkSpeed:2.6,runSpeed:4.5,swimSpeed:1.8,thirdPerson:Object.freeze({distance:3.6,height:1.3})});
const EYE_HEIGHT=1.72,HEIGHT=1.82,SWIM_EYE_HEIGHT=1.25,SWIM_HEIGHT=1.35;
const MAX_SLOPE=Math.PI/4,MAX_STEP=.35,MAX_DELTA=.1,MOVE_STEP=.06,GRAVITY=18,JUMP_SPEED=5.4;
export const INHABITANT_LIMITS=Object.freeze({maxSlope:MAX_SLOPE,maxStep:MAX_STEP,maxDelta:MAX_DELTA,moveStep:MOVE_STEP,gravity:GRAVITY,jumpSpeed:JUMP_SPEED,eyeHeight:EYE_HEIGHT});
// The maker stays an explicit, versioned record in each world. New worlds start
// with it; an older world gains it only through a revision that adds it here.
export const MAKER_POSSESSION=Object.freeze({preset:'maker',camera:'first'});
export function withMaker(scene){
 const r=scene.runtime;if(r.possession)return scene;
 return {...scene,runtime:{...r,modules:r.modules.includes('inhabitant.maker@1')?r.modules:[...r.modules,'inhabitant.maker@1'],possession:{...MAKER_POSSESSION}}};
}
const inputAxis=value=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;

// Support is the terrain or the highest walkable collider top (context.walkable)
// not above reference: one step above the feet on foot, the feet themselves in
// the air, so a jump lands only on a surface it falls past.
function supportAt(actor,x,z,{terrain,water,time=0,walkable}={},reference=actor.position[1]+(actor.mode==='airborne'?1e-6:MAX_STEP)){
 const sampled=terrain?.sample(x,z)||{height:actor.groundHeight,normal:[0,1,0],slope:0,inBounds:true};
 const top=walkable?.(x,z,reference),onTop=!!top&&top.height>sampled.height;
 const ground=onTop?{height:top.height,normal:[0,1,0],slope:0,inBounds:sampled.inBounds}:sampled;
 const surface=water?sampleWater(water,x,z,time):null;
 const depth=surface?.inBounds?Math.max(0,surface.height-ground.height):0;
 const swimming=actor.mode==='swimming'?depth>.9:depth>=1.25;
 const mode=swimming?'swimming':depth>.08?'wading':'grounded';
 return {mode,ground,terrain:sampled,supportId:onTop?top.id:null,depth,surfaceHeight:surface?.inBounds?surface.height:null,feet:swimming?Math.max(ground.height,surface.height-1):ground.height,height:swimming?SWIM_HEIGHT:HEIGHT,eyeHeight:swimming?SWIM_EYE_HEIGHT:EYE_HEIGHT};
}
// Read-only support query, shared by the controller and advisory probes. The
// caller supplies the prior mode when it needs swimming-depth hysteresis, and
// may pass the highest top to consider.
export {supportAt as sampleInhabitantSupport};
// The context a WorldRuntime gives the controller: terrain, water, walkable tops
// and box collision with the step rule for treads.
export const inhabitantContext=(runtime,radius)=>({terrain:runtime.terrain,water:runtime.scene.water,time:runtime.time,walkable:(x,z,maxTop)=>runtime.walkableAt(x,z,maxTop),blocked:(x,z,feetY,height,stepUp)=>runtime.blocked(x,z,radius,feetY,height,null,stepUp)});

function adoptSupport(actor,support){
 actor.position[1]=support.feet;actor.mode=support.mode;actor.height=support.height;actor.eyeHeight=support.eyeHeight;
 actor.supportHeight=support.ground.height;actor.surfaceHeight=support.surfaceHeight;actor.waterDepth=support.depth;
 actor.grounded=support.mode!=='swimming';actor.verticalVelocity=0;
}

function airborne(actor,support){
 actor.mode='airborne';actor.grounded=false;actor.height=HEIGHT;actor.eyeHeight=EYE_HEIGHT;
 actor.supportHeight=support.ground.height;actor.surfaceHeight=support.surfaceHeight;actor.waterDepth=support.depth;
}

// Position is always the support/feet anchor. Cameras and the visual body consume
// this same mutable record; neither owns a second movement simulation.
export function createInhabitant(runtime,possession=runtime.scene.runtime.possession){
 const r=runtime.scene.runtime,config={...INHABITANT_DEFAULTS,...possession,thirdPerson:{...INHABITANT_DEFAULTS.thirdPerson,...possession?.thirdPerson}};
 const actor={position:[r.spawn[0],r.spawn[1]-EYE_HEIGHT,r.spawn[2]],yaw:r.look[0],velocity:[0,0,0],movementVelocity:[0,0],verticalVelocity:0,grounded:true,jumpHeld:false,speed:0,mode:'grounded',camera:config.camera,eyeHeight:EYE_HEIGHT,height:HEIGHT,radius:.22,distance:0,gaitPhase:0,groundHeight:r.spawn[1]-EYE_HEIGHT,config};
 const terrain=runtime.terrain||(runtime.scene.terrain?createTerrain(runtime.scene.terrain):null);
 adoptSupport(actor,supportAt(actor,actor.position[0],actor.position[2],{terrain,water:runtime.scene.water,time:runtime.time||0,walkable:runtime.walkableAt?(x,z,maxTop)=>runtime.walkableAt(x,z,maxTop):null}));
 return actor;
}

export function stepInhabitant(actor,input,seconds,context={}){
 actor.velocity.fill(0);actor.speed=0;
 if(!Number.isFinite(seconds)||seconds<=0)return actor;
 const dt=Math.min(seconds,MAX_DELTA),before=[...actor.position];
 if(Number.isFinite(input.yaw))actor.yaw=input.yaw;
 const initial=supportAt(actor,before[0],before[2],context);
 if(actor.mode!=='airborne')adoptSupport(actor,initial);else airborne(actor,initial);
 const jump=!!input.jump&&!actor.jumpHeld;actor.jumpHeld=!!input.jump;
 if(jump&&actor.grounded&&initial.ground.inBounds&&initial.ground.slope<=MAX_SLOPE){airborne(actor,initial);actor.verticalVelocity=JUMP_SPEED;}
 const forward=inputAxis(input.forward),strafe=inputAxis(input.strafe),length=Math.max(1,Math.hypot(forward,strafe));
 const speed=actor.mode==='swimming'?actor.config.swimSpeed:(input.sprint?actor.config.runSpeed:actor.config.walkSpeed)*(actor.mode==='wading'?.7:1);
 const c=Math.cos(actor.yaw),s=Math.sin(actor.yaw),velocity=actor.movementVelocity??(actor.movementVelocity=[0,0]);
 const targetX=(strafe*c-forward*s)*speed/length,targetZ=(-forward*c-strafe*s)*speed/length;
 const accelerating=!!(forward||strafe),acceleration=actor.mode==='swimming'?(accelerating?4:5):actor.mode==='airborne'?(accelerating?7:3):(accelerating?16:20);
 let dx=0,dz=0;
 if(input.stop){velocity[0]=0;velocity[1]=0;}
 else{
  const changeX=targetX-velocity[0],changeZ=targetZ-velocity[1],change=Math.hypot(changeX,changeZ),ramp=Math.min(dt,change/acceleration),fraction=change>0?Math.min(1,acceleration*dt/change):1;
  const nextX=velocity[0]+changeX*fraction,nextZ=velocity[1]+changeZ*fraction;
  // Integrate the constant acceleration ramp, then the remaining cruise time.
  // This keeps starts/stops consistent across coarse and fine render frames.
  dx=(velocity[0]+nextX)*.5*ramp+nextX*(dt-ramp);dz=(velocity[1]+nextZ)*.5*ramp+nextZ*(dt-ramp);
  velocity[0]=nextX;velocity[1]=nextZ;
 }
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/MOVE_STEP),Math.ceil((Math.abs(actor.verticalVelocity)+GRAVITY*dt)*dt/MOVE_STEP)),tick=dt/steps;
 const move=(x,z)=>{
  const support=supportAt(actor,x,z,context);
  if(!support.ground.inBounds)return false;
  const inAir=actor.mode==='airborne',fall=!inAir&&support.mode!=='swimming'&&actor.position[1]-support.feet>MAX_STEP;
  if(inAir){if(support.ground.height>actor.position[1]+1e-6)return false;}
  else if(support.mode!=='swimming'&&(support.ground.slope>MAX_SLOPE||support.feet-actor.position[1]>MAX_STEP))return false;
  const feet=inAir||fall?actor.position[1]:support.feet,height=inAir||fall?HEIGHT:support.height;
  if(context.blocked?.(x,z,feet,height,inAir||fall?0:MAX_STEP))return false;
  actor.position[0]=x;actor.position[2]=z;
  if(inAir||fall)airborne(actor,support);else adoptSupport(actor,support);return true;
 };
 // Axis-separated small steps preserve sliding while bounding thin-wall crossing.
 for(let i=0;i<steps;i++){
  if(dx&&!move(actor.position[0]+dx/steps,actor.position[2]))velocity[0]=0;
  if(dz&&!move(actor.position[0],actor.position[2]+dz/steps))velocity[1]=0;
  if(actor.mode==='airborne'){
   const support=supportAt(actor,actor.position[0],actor.position[2],context),previousY=actor.position[1];
   let nextY=previousY+actor.verticalVelocity*tick-GRAVITY*tick*tick/2;
   actor.verticalVelocity-=GRAVITY*tick;
   if(nextY<=support.feet&&actor.verticalVelocity<=0&&support.ground.inBounds)adoptSupport(actor,support);
   else{
    if(nextY>previousY&&context.blocked?.(actor.position[0],actor.position[2],nextY,actor.height)){nextY=previousY;actor.verticalVelocity=0;}
    actor.position[1]=nextY;airborne(actor,support);
   }
  }
 }
 for(let i=0;i<3;i++)actor.velocity[i]=(actor.position[i]-before[i])/dt;
 const traveled=Math.hypot(actor.position[0]-before[0],actor.position[2]-before[2]);
 actor.speed=traveled/dt;actor.distance+=traveled;actor.gaitPhase=(actor.gaitPhase+traveled*Math.PI*2/1.5)%(Math.PI*2);
 return actor;
}
