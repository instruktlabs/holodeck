import {createTerrain,validateTerrain,validateWater,sampleWater} from './terrain.mjs';
import {INHABITANT_LIMITS} from './inhabitant.mjs';
import {validateGait} from './gait.mjs';
import {validateFlock,createFlock,stepFlock} from './boids.mjs';
import {validateScatters,placedObjects} from './scatter.mjs';
import {validateTerrainLayerReferences} from './terrain-layers.mjs';

// Authored data stays immutable. These built-ins own only transient runtime state.
const hinge={requires:['collision.boxes@1'],init:()=>({angle:0,open:false}),tick:(s,b,dt,runtime,o)=>{
 const target=s.open?b.angle:0,d=target-s.angle;if(!d)return;
 const next=s.angle+Math.sign(d)*Math.min(Math.abs(d),b.speed*dt);
 if(!hingeSweepBlocked(o,runtime.playerBody,s.angle,next))s.angle=next;
},act:s=>{s.open=!s.open;}};
const spin={requires:[],init:()=>({angle:0,running:true}),tick:(s,b,dt)=>{if(s.running)s.angle=(s.angle+b.speed*dt)%(Math.PI*2);},act:s=>{s.running=!s.running;}};
const patrol={
 requires:['collision.boxes@1'],
 // Authored Y is the starting feet, so a patrol placed on a walkable deck starts on it.
 init:(o,terrain,walkable)=>{const baseHeight=o.position[1]-(o.behavior.heightOffset??0),ground=terrain?.sample(o.position[0],o.position[2]).height??baseHeight,top=walkable?.(o.position[0],o.position[2],baseHeight+INHABITANT_LIMITS.maxStep);return {position:[o.position[0],Math.max(ground,top?.height??-Infinity)+(o.behavior.heightOffset??0),o.position[2]],baseHeight,angle:0,running:true,targetIndex:0,waitRemaining:0,blockedBy:null,mode:'waiting',speed:0,distance:0};},
 act:s=>{s.running=!s.running;},
 tick:(s,b,dt,runtime,o)=>{
  s.previousPosition=[...s.position];s.previousAngle=s.angle;s.previousDistance=s.distance;
  s.speed=0;s.blockedBy=null;const offset=b.heightOffset??0;
  // Patrols share the walker's support: terrain or a walkable top within one step of the current feet.
  const groundAt=(x,z)=>{const ground=runtime.terrain?.sample(x,z)||{height:s.baseHeight,slope:0,inBounds:true},top=runtime.walkableAt(x,z,s.position[1]-offset+INHABITANT_LIMITS.maxStep);return top&&top.height>ground.height?{height:top.height,slope:0,inBounds:ground.inBounds}:ground;};
  s.position[1]=groundAt(s.position[0],s.position[2]).height+offset;
  if(!s.running){s.mode='paused';return;}
  if(s.waitRemaining>0){s.waitRemaining=Math.max(0,s.waitRemaining-dt);s.mode='waiting';return;}
  const target=b.path[s.targetIndex],dx=target[0]-s.position[0],dz=target[1]-s.position[2],remaining=Math.hypot(dx,dz);
  if(remaining<1e-6){s.targetIndex=(s.targetIndex+1)%b.path.length;s.waitRemaining=b.waitSeconds;s.mode='waiting';return;}
  s.angle=Math.atan2(-dz,dx);const travel=Math.min(remaining,b.speed*dt),steps=Math.max(1,Math.ceil(travel/INHABITANT_LIMITS.moveStep));
  let traveled=0;
  for(let i=0;i<steps;i++){
   const x=s.position[0]+dx/remaining*travel/steps,z=s.position[2]+dz/remaining*travel/steps,ground=groundAt(x,z);
   const water=runtime.scene.water?sampleWater(runtime.scene.water,x,z,runtime.time):null,depth=water?.inBounds?Math.max(0,water.height-ground.height):0;
   const reason=!ground.inBounds?'outside-terrain':ground.slope>INHABITANT_LIMITS.maxSlope?'slope-limit':ground.height-(s.position[1]-offset)>INHABITANT_LIMITS.maxStep?'step-limit':depth>(b.waterPolicy==='wade'?.8:.08)?'water-depth':runtime.collisionAt(x,z,b.radius??.25,ground.height,b.height??1,o.id,INHABITANT_LIMITS.maxStep);
   if(reason){s.blockedBy=reason;break;}
   s.position[0]=x;s.position[1]=ground.height+offset;s.position[2]=z;traveled+=travel/steps;
  }
  s.distance+=traveled;s.speed=traveled/dt;s.mode=s.blockedBy?'blocked':'moving';
  if(!s.blockedBy&&remaining-traveled<1e-6){s.targetIndex=(s.targetIndex+1)%b.path.length;s.waitRemaining=b.waitSeconds;s.mode='waiting';}
 },
};
export const MODULES=Object.freeze({
 'collision.boxes@1':{requires:[]},'camera.walk-orbit@1':{requires:['collision.boxes@1']},
 'interaction.hinge@1':hinge,'motion.spin@1':spin,
 'motion.patrol@1':patrol,'motion.gait@1':{requires:[]},
 'motion.boids@1':{requires:[],init:createFlock,tick:stepFlock,act:s=>{s.running=!s.running;}},
 'terrain.heightfield@1':{requires:[]},'water.ocean@1':{requires:[]},
 'inhabitant.maker@1':{requires:['camera.walk-orbit@1','collision.boxes@1']},
 'scatter.seeded@1':{requires:['terrain.heightfield@1']},
});
const behaviorModule={hinge:'interaction.hinge@1',spin:'motion.spin@1',patrol:'motion.patrol@1',flock:'motion.boids@1'};
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const exact=(value,keys,label)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)),`Invalid ${label} fields`);
const vector=(v,n=3)=>Array.isArray(v)&&v.length===n&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=1000);
export const INTERACTION_REACH=3.5;
// A collider box marked walkable lends its top to the walker and patrols as
// support. Its footprint grows by this margin so seams between adjacent deck or
// stair pieces do not drop the walker through.
export const WALKABLE_MARGIN=.1;
const boxesOf=collider=>collider?(collider.type==='compound'?collider.boxes:[collider]):[];
function boxHitsBody(p,yaw,scale,box,x,z,radius,feetY,height){
 const dx=x-p[0],dz=z-p[2],c=Math.cos(yaw),s=Math.sin(yaw),lx=c*dx-s*dz,lz=s*dx+c*dz,off=box.offset||[0,0,0];
 return p[1]+(off[1]+box.size[1]/2)*scale[1]>feetY+.05&&p[1]+(off[1]-box.size[1]/2)*scale[1]<feetY+height&&Math.abs(lx-off[0]*scale[0])<=box.size[0]*scale[0]/2+radius&&Math.abs(lz-off[2]*scale[2])<=box.size[2]*scale[2]/2+radius;
}
function hingeSweepBlocked(o,body,from,to){
 if(!body)return false;
 const [x,y,z]=body.position,distance=Math.hypot(x-o.position[0],z-o.position[2]);
 // In the leaf's frame the body follows an arc. Enclose that entire arc
 // around its midpoint, not just the next pose: even a thin, fast leaf must
 // wait before crossing the player. This conservative bound needs no sampling.
 const sweep=2*distance*Math.sin(Math.abs(to-from)/4),yaw=(o.yaw??o.rotation[1])+(from+to)/2;
 return boxesOf(o.collider).some(box=>boxHitsBody(o.position,yaw,o.scale,box,x,z,body.radius+sweep,y,body.height));
}
// Walkable boxes never move (validation refuses them with a behavior), so their
// frames are fixed at reconcile.
function walkableBoxes(placed){
 const list=[];
 for(const o of placed)for(const box of boxesOf(o.collider)){
  if(!box.walkable)continue;const yaw=o.yaw??o.rotation[1],off=box.offset||[0,0,0];
  list.push({id:o.id,layer:o.layer,x:o.position[0],z:o.position[2],c:Math.cos(yaw),s:Math.sin(yaw),cx:off[0]*o.scale[0],cz:off[2]*o.scale[2],hx:Math.abs(box.size[0]*o.scale[0])/2+WALKABLE_MARGIN,hz:Math.abs(box.size[2]*o.scale[2])/2+WALKABLE_MARGIN,top:o.position[1]+(off[1]+box.size[1]/2)*o.scale[1]});
 }
 return list;
}
function walkableTops(list,x,z,originVisible){
 const tops=[];
 for(const w of list){if(w.layer==='origin'&&!originVisible)continue;const dx=x-w.x,dz=z-w.z;if(Math.abs(w.c*dx-w.s*dz-w.cx)<=w.hx&&Math.abs(w.s*dx+w.c*dz-w.cz)<=w.hz)tops.push({height:w.top,id:w.id});}
 return tops;
}
// The highest walkable top over x/z that is not above maxTop, or null.
const walkableTop=(list,x,z,maxTop,originVisible)=>walkableTops(list,x,z,originVisible).reduce((best,t)=>t.height<=maxTop+1e-9&&(!best||t.height>best.height)?t:best,null);
// Use the same yaw/scale frame as rendering and collision. This is a reach query;
// the controller still owns aiming, occlusion and camera eligibility.
const boxDistance=(position,object,yaw,box)=>{
 const dx=position[0]-object.position[0],dz=position[2]-object.position[2],c=Math.cos(yaw),s=Math.sin(yaw),offset=box.offset||[0,0,0];
 const local=[c*dx-s*dz,position[1]-object.position[1],s*dx+c*dz];
 return Math.hypot(...local.map((v,i)=>Math.max(0,Math.abs(v-offset[i]*object.scale[i])-box.size[i]*Math.abs(object.scale[i])/2)));
};
export function validateRuntimeScene(scene){
 const r=scene.runtime;exact(r,['version','modules','spawn','look','overview','target','bounds','blockers','possession'],'runtime');
 assert(r.version===1,'Unsupported runtime version');assert(Array.isArray(r.modules)&&r.modules.length<=16&&new Set(r.modules).size===r.modules.length,'Invalid module list');
 for(const name of r.modules){assert(Object.hasOwn(MODULES,name),`Unknown module ${name}`);for(const dep of MODULES[name].requires)assert(r.modules.includes(dep),`${name} requires ${dep}`);}
 for(const name of ['collision.boxes@1','camera.walk-orbit@1'])assert(r.modules.includes(name),`Runtime requires ${name}`);
 for(const [name,value,label] of [['terrain.heightfield@1',scene.terrain,'scene.terrain'],['water.ocean@1',scene.water,'scene.water'],['inhabitant.maker@1',r.possession,'runtime.possession'],['scatter.seeded@1',scene.scatters,'scene.scatters']]){
  if(value!==undefined)assert(r.modules.includes(name),`${label} requires ${name}`);
  if(r.modules.includes(name))assert(value!==undefined,`${name} requires ${label}`);
 }
 if(scene.terrain!==undefined)validateTerrain(scene.terrain);
 if(scene.water!==undefined)validateWater(scene.water);
 if(scene.scatters!==undefined)validateScatters(scene);
 if(scene.terrain!==undefined)validateTerrainLayerReferences(scene);
 if(r.possession!==undefined){
  const p=r.possession;exact(p,['preset','camera','walkSpeed','runSpeed','swimSpeed','thirdPerson'],'possession');
  assert(p.preset==='maker','Unsupported inhabitant preset');assert(['first','third'].includes(p.camera),'Unsupported possession camera');
  for(const key of ['walkSpeed','runSpeed','swimSpeed'])if(p[key]!==undefined)assert(Number.isFinite(p[key])&&p[key]>0&&p[key]<=12,`Invalid possession ${key}`);
  if(p.thirdPerson!==undefined){exact(p.thirdPerson,['distance','height'],'third person camera');for(const [key,min,max] of [['distance',.5,12],['height',.2,4]])if(p.thirdPerson[key]!==undefined)assert(Number.isFinite(p.thirdPerson[key])&&p.thirdPerson[key]>=min&&p.thirdPerson[key]<=max,`Invalid third person ${key}`);}
 }
 for(const key of ['spawn','overview','target'])assert(vector(r[key]),`Invalid ${key}`);
 if(!r.possession)assert(r.spawn[1]===1.72,'This walk controller requires a 1.72 metre eye height');
 assert(vector(r.look,2)&&Math.abs(r.look[1])<=1.15,'Invalid look angles');
 assert(vector(r.bounds,4)&&r.bounds[0]<r.bounds[1]&&r.bounds[2]<r.bounds[3],'Invalid movement bounds');
 assert(r.spawn[0]>r.bounds[0]&&r.spawn[0]<r.bounds[1]&&r.spawn[2]>r.bounds[2]&&r.spawn[2]<r.bounds[3],'Spawn is outside movement bounds');
 if(scene.moodboard){const b=scene.moodboard.collider;exact(b,['size','offset'],'board collider');assert(vector(b.size)&&b.size.every(n=>n>0)&&vector(b.offset),'Invalid board collider');assert(scene.moodboard.rotation[0]===0&&scene.moodboard.rotation[2]===0,'Board collision supports yaw only');}
 assert(Array.isArray(r.blockers)&&r.blockers.length<=128,'Invalid blocker count');const ids=new Set();
 for(const b of r.blockers){exact(b,['id','position','rotation','size','layer'],'blocker');assert(typeof b.id==='string'&&/^[-\w]{1,64}$/.test(b.id)&&!ids.has(b.id),'Invalid or duplicate blocker ID');ids.add(b.id);assert(['world','origin'].includes(b.layer)&&vector(b.position)&&vector(b.rotation)&&vector(b.size)&&b.size.every(n=>n>0),'Invalid blocker');assert(b.rotation[0]===0&&b.rotation[2]===0,'Box collision supports yaw rotation only');}
 let patrolCount=0,flockCount=0;
 for(const o of scene.objects){
  if(o.collider)assert(o.rotation[0]===0&&o.rotation[2]===0,'Box collision supports yaw rotation only');
  if(o.behavior&&boxesOf(o.collider).some(b=>b.walkable))throw new Error('Walkable colliders cannot move; remove walkable or the behavior');
  if(!o.behavior)continue;const b=o.behavior;assert(Object.hasOwn(behaviorModule,b.type),'Unknown behavior');
  exact(b,b.type==='hinge'?['type','angle','speed']:b.type==='patrol'?['type','path','speed','waitSeconds','waterPolicy','heightOffset','radius','height','gait']:b.type==='flock'?['type','count','bounds','speed','neighborRadius','separationRadius','terrainClearance','seed','gait']:['type','speed'],'behavior');
  assert(r.modules.includes(behaviorModule[b.type]),`Behavior requires ${behaviorModule[b.type]}`);
  if(b.type==='flock'){
   validateFlock(b);flockCount+=b.count;assert(flockCount<=96,'A scene allows at most 96 flock agents');
   assert(o.asset&&!o.shape&&o.materialStyle!=='cove'&&!o.collider,'Flock requires an imported unbatched asset without a collider');
  }else assert(Number.isFinite(b.speed)&&b.speed>0&&b.speed<=4,'Behavior speed must be greater than zero and at most four');
  if(b.gait!==undefined){assert(r.modules.includes('motion.gait@1'),'Behavior gait requires motion.gait@1');assert(o.asset&&!o.shape&&o.materialStyle!=='cove','Behavior gait requires an imported unbatched asset');validateGait(b.gait);}
  if(b.type==='hinge')assert(Number.isFinite(b.angle)&&Math.abs(b.angle)>=.1&&Math.abs(b.angle)<=Math.PI&&o.collider,'Hinge requires a box collider and bounded opening angle');
  if(b.type==='patrol'){
   assert(++patrolCount<=16,'A scene allows at most 16 patrol entities');
   assert(Array.isArray(b.path)&&b.path.length>=2&&b.path.length<=16&&b.path.every(p=>vector(p,2)),'Patrol path needs 2 to 16 bounded x/z points');
   assert(Number.isFinite(b.waitSeconds)&&b.waitSeconds>=0&&b.waitSeconds<=30,'Patrol wait must be zero to 30 seconds');
   assert(['avoid','wade'].includes(b.waterPolicy),'Patrol water policy must be avoid or wade');
   for(const [key,min,max] of [['heightOffset',0,3],['radius',.05,2],['height',.1,4]])if(b[key]!==undefined)assert(Number.isFinite(b[key])&&b[key]>=min&&b[key]<=max,`Invalid patrol ${key}`);
  }
  assert(o.rotation[0]===0&&o.rotation[2]===0,'Moving modules support yaw rotation only');
 }
 return scene;
}
export class WorldRuntime{
 constructor(scene){this.gaitDiagnostics=new Map();this.states=new Map();this.signatures=new Map();this.originVisible=true;this.paused=false;this.time=0;this.droppedSeconds=0;this.accumulator=0;this.reconcile(scene);}
 reconcile(scene){
  validateRuntimeScene(scene);
  // Appearance changes do not alter support geometry. Build a candidate before
  // replacing any retained state so a failed surface keeps the previous world.
  const t=scene.terrain,terrainSignature=t?JSON.stringify([t.type,t.bounds,t.segments,t.baseHeight,t.stamps]):null;
  const terrain=t?(terrainSignature===this.terrainSignature?this.terrain:createTerrain(t)):null;
  // Expanded scatter placements collide like authored ones; none carry behavior.
  const placed=placedObjects(scene,{terrain}),walkable=walkableBoxes(placed),support=(x,z,maxTop)=>walkableTop(walkable,x,z,maxTop,this.originVisible);
  const states=new Map(),signatures=new Map();for(const o of scene.objects){if(!o.behavior)continue;const signature=JSON.stringify(o.behavior.type==='patrol'?[o.behavior,o.position,walkable]:o.behavior.type==='flock'?[o.behavior,terrainSignature]:o.behavior),module=MODULES[behaviorModule[o.behavior.type]];states.set(o.id,this.signatures.get(o.id)===signature?this.states.get(o.id):module.init(o,terrain,support));signatures.set(o.id,signature);}
  this.placed=placed;this.walkable=walkable;this.scene=scene;this.states=states;this.signatures=signatures;this.terrain=terrain;this.terrainSignature=terrainSignature;
 }
 visible(o){return o.layer!=='origin'||this.originVisible;}
 position(o){return this.states.get(o.id)?.position||o.position;}
 renderMotion(o){
  const s=this.states.get(o.id);if(o.behavior?.type!=='patrol'||!s)return null;
  const t=Math.min(1,Math.max(0,this.accumulator*60)),previous=s.previousPosition??s.position,a=s.previousAngle??s.angle;
  const delta=Math.atan2(Math.sin(s.angle-a),Math.cos(s.angle-a));
  return {...s,position:s.position.map((v,i)=>previous[i]+(v-previous[i])*t),angle:a+delta*t,distance:(s.previousDistance??s.distance)+(s.distance-(s.previousDistance??s.distance))*t};
 }
 yaw(o){return (o.yaw??o.rotation[1])+(this.states.get(o.id)?.angle||0);}
 interaction(id,position){
  const o=this.scene.objects.find(o=>o.id===id),result={id,label:null,action:null,available:false,reason:null,distance:null,state:null};
  if(!o)return {...result,reason:'missing'};
  if(!this.visible(o))return {...result,reason:'hidden'};
  if(!o.behavior)return {...result,reason:'not-interactive'};
  const state=this.states.get(id),action=o.behavior.type==='hinge'?(state.open?'close':'open'):(state.running?'stop':'start');
  Object.assign(result,{action,label:`${action[0].toUpperCase()}${action.slice(1)} ${o.label||o.id}`,state:structuredClone(state)});
  if(!vector(position))return {...result,reason:'invalid-position'};
  const boxes=o.collider?(o.collider.type==='compound'?o.collider.boxes:[o.collider]):o.shape?[o.shape]:[];
  const posed={...o,position:this.position(o)},distance=boxes.length?Math.min(...boxes.map(box=>boxDistance(position,posed,this.yaw(o),box))):Math.hypot(...position.map((v,i)=>v-posed.position[i]));
  return {...result,distance,available:distance<=INTERACTION_REACH,reason:distance<=INTERACTION_REACH?null:'out-of-reach'};
 }
 act(id,position){if(!this.interaction(id,position).available)return false;const o=this.scene.objects.find(o=>o.id===id);MODULES[behaviorModule[o.behavior.type]].act(this.states.get(id));return true;}
 reset(){this.signatures.clear();this.reconcile(this.scene);this.time=0;this.droppedSeconds=0;this.accumulator=0;}
 step(seconds){if(this.paused||!Number.isFinite(seconds)||seconds<=0)return;this.droppedSeconds+=Math.max(0,seconds-.1);this.accumulator+=Math.min(seconds,.1);let ticks=0;while(this.accumulator>=1/60&&ticks++<6){for(const o of this.scene.objects)if(o.behavior&&this.visible(o))MODULES[behaviorModule[o.behavior.type]].tick(this.states.get(o.id),o.behavior,1/60,this,o);this.time+=1/60;this.accumulator-=1/60;}}
 // Walkable tops over x/z, highest first, and the highest one not above maxTop.
 walkableLevels(x,z){return walkableTops(this.walkable,x,z,this.originVisible).sort((a,b)=>b.height-a.height);}
 walkableAt(x,z,maxTop){return walkableTop(this.walkable,x,z,maxTop,this.originVisible);}
 blocked(x,z,radius=.22,feetY=0,height=1.72,ignoreId=null,stepUp=0){return this.collisionAt(x,z,radius,feetY,height,ignoreId,stepUp)!==null;}
 collisionAt(x,z,radius=.22,feetY=0,height=1.72,ignoreId=null,stepUp=0){
  const b=this.scene.runtime.bounds;if(x-radius<b[0]||x+radius>b[1]||z-radius<b[2]||z+radius>b[3])return 'movement-bounds';
  const hit=(p,yaw,scale,box)=>boxHitsBody(p,yaw,scale,box,x,z,radius,feetY,height);
  // A walkable top within stepUp of the feet is a tread to climb, not a wall.
  for(const o of this.placed){if(o.id===ignoreId||!this.visible(o)||!o.collider)continue;const p=this.position(o);for(const box of boxesOf(o.collider)){if(box.walkable&&p[1]+((box.offset?.[1]??0)+box.size[1]/2)*o.scale[1]<=feetY+stepUp)continue;if(hit(p,this.yaw(o),o.scale,box))return o.id;}}
  const board=this.scene.moodboard;if(this.originVisible&&board&&hit(board.position,board.rotation[1],[1,1,1],board.collider))return 'moodboard';
  return this.scene.runtime.blockers.find(b=>this.visible(b)&&hit(b.position,b.rotation[1],[1,1,1],b))?.id??null;
 }
 snapshot(){return {time:this.time,paused:this.paused,droppedSeconds:this.droppedSeconds,states:structuredClone(Object.fromEntries(this.states)),gaitDiagnostics:structuredClone(Object.fromEntries(this.gaitDiagnostics))};}
}
