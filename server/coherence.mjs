import {WorldRuntime} from '../src/world/runtime.mjs';
import {expandScatters} from '../src/world/scatter.mjs';
import {createInhabitant,sampleInhabitantSupport,withMaker,INHABITANT_LIMITS} from '../src/world/inhabitant.mjs';

const vec=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
const validId=id=>typeof id==='string'&&/^[-\w]{1,64}$/.test(id);
function observationInfo(world,observation,now){
 const age=observation?now-Date.parse(observation.receivedAt):null;
 const status=!observation?'missing':observation.revision!==world.revision?'different-revision':!Number.isFinite(age)||age<0||age>10000?'stale':'current';
 return {status,revision:observation?.revision??null,ageMs:Number.isFinite(age)?age:null};
}
function probeTime(time,observation,current){
 if(time!==null&&(!Number.isFinite(time)||time<0||time>1e9))throw new Error('Probe time must be null or finite seconds from zero to 1e9');
 if(time!==null)return time;
 const observed=current?observation?.activity?.time:null;
 return Number.isFinite(observed)&&observed>=0&&observed<=1e9?observed:0;
}
const probeLimits=driver=>[
 'Support and box samples are not a traversal test, physics certification or visual review.',
 'Samples freeze moving objects and water at the reported pose and time; they do not simulate motion along a path.',
 driver==='terrain-heightfield'?'Terrain support uses the rendered heightfield triangles. Collider boxes marked walkable add their tops as support; other placed mesh surfaces are not ground support.':'No terrain support is present; this driver assumes a flat ground plane at the declared spawn ground height.',
 'Input x/z is projected onto controller support. Input y is an eye height: where walkable tops overlap, it picks the highest level at or below y - 1.72 + 0.35 (one step), as the walker does at spawn; levels lists every one. It is not an alternative flight height.',
 'No global quality score or universal performance threshold is inferred.',
];
function makeProbe(world,observation,current,time){
 const runtime=new WorldRuntime(world.scene);
 runtime.originVisible=current&&typeof observation.originVisible==='boolean'?observation.originVisible:true;
 if(current)for(const o of world.scene.objects){
  if(!o.behavior)continue;const state=observation.activity?.states?.[o.id],retained=runtime.states.get(o.id);
  if(state&&Number.isFinite(state.angle)&&Math.abs(state.angle)<=Math.PI*2)retained.angle=state.angle;
  if(o.behavior.type==='patrol'&&vec(state?.position))retained.position=[...state.position];
 }
 const driver=runtime.terrain?'terrain-heightfield':world.scene.runtime.possession?'inhabitant-ground-plane':'legacy-ground-plane';
 const actor=driver==='legacy-ground-plane'?null:createInhabitant(runtime);
 const poseSource=current?'matching browser observation (when available)':'initial behavior state';
 // maxTop is the highest walkable top to stand on; by default one step above the
 // feet implied by an eye-height y. Samples gain supportId and levels only where
 // walkable tops exist, so worlds without them read as before.
 const sample=(position,previousMode='grounded',maxTop=position[1]-INHABITANT_LIMITS.eyeHeight+INHABITANT_LIMITS.maxStep)=>{
  const [x,,z]=position;if(actor)actor.mode=previousMode;
  const support=actor?sampleInhabitantSupport(actor,x,z,{terrain:runtime.terrain,water:world.scene.water,time,walkable:(x,z,top)=>runtime.walkableAt(x,z,top)},maxTop):{feet:0,height:1.72,eyeHeight:1.72,mode:'grounded',depth:0,surfaceHeight:null,ground:{height:0,normal:[0,1,0],slope:0,inBounds:true}};
  const terrain=support.terrain??support.ground,blockerId=runtime.collisionAt(x,z,.22,support.feet,support.height,null,actor?INHABITANT_LIMITS.maxStep:0),issues=[];
  if(!support.ground.inBounds)issues.push('outside-terrain');
  if(support.mode!=='swimming'&&support.ground.slope>INHABITANT_LIMITS.maxSlope)issues.push('slope-limit');
  if(blockerId)issues.push('blocker');
  const tops=actor?runtime.walkableLevels(x,z):[],levels=tops.length?[...tops.map(t=>({source:'collider',id:t.id,height:t.height})),{source:runtime.terrain?'terrain-heightfield':'assumed-ground-plane',id:null,height:terrain.height}]:null;
  return {requestedPosition:[...position],feetPosition:[x,support.feet,z],eyePosition:[x,support.feet+support.eyeHeight,z],supportSource:support.supportId?'collider':runtime.terrain?'terrain-heightfield':'assumed-ground-plane',...(support.supportId?{supportId:support.supportId,supportHeight:support.ground.height}:{}),...(levels?{levels}:{}),terrainHeight:terrain.height,terrainNormal:[...terrain.normal],slopeRadians:support.ground.slope,inBounds:support.ground.inBounds,waterHeight:support.surfaceHeight,waterDepth:support.depth,mode:support.mode,blockerId,issues};
 };
 return {runtime,driver,poseSource,time,sample};
}

// Bounded read-only point observations. Every point starts outside swimming;
// routes below carry the previous sampled mode to expose depth hysteresis.
export function sampleWorldPoints(world,{points=[],observation=null,now=Date.now(),time=null}={}){
 if(!Array.isArray(points)||points.length>64)throw new Error('A sample request accepts at most 64 points');
 const ids=new Set();for(const p of points){if(!p||!validId(p.id)||ids.has(p.id)||!vec(p.position))throw new Error('Each point needs a unique ID and bounded position vector');ids.add(p.id);}
 const info=observationInfo(world,observation,now),current=info.status==='current',clock=probeTime(time,observation,current);
 if(world.schemaVersion!==2)return {protocol:'holodeck.samples/1',advisory:true,worldRevision:world.revision,observation:info,driver:null,poseSource:null,time:clock,samples:[],limits:['This world has no registered spatial probe driver; no support or collision result is inferred.']};
 const probe=makeProbe(world,observation,current,clock);
 return {protocol:'holodeck.samples/1',advisory:true,worldRevision:world.revision,observation:info,driver:probe.driver,poseSource:probe.poseSource,time:clock,samples:points.map(p=>({id:p.id,...probe.sample(p.position)})),limits:[...probeLimits(probe.driver),'Points classify swimming independently at the entry-depth threshold; they do not inherit an observed actor mode.']};
}

// Read-only advisory protocol. It never participates in world admission.
export function checkWorld(world,{observation=null,assets={},routes=[],now=Date.now(),time=null}={}){
 if(!Array.isArray(routes)||routes.length>8)throw new Error('A check accepts at most eight routes');
 const ids=new Set();for(const r of routes){if(!r||typeof r.id!=='string'||!/^[-\w]{1,64}$/.test(r.id)||ids.has(r.id)||!vec(r.from)||!vec(r.to))throw new Error('Each route needs a unique ID and bounded from/to vectors');ids.add(r.id);}
 const info=observationInfo(world,observation,now),{status}=info;
 const current=status==='current';
 const clock=probeTime(time,observation,current);
 const result={protocol:'holodeck.coherence/1',advisory:true,worldRevision:world.revision,observation:info,inventory:{entities:world.scene.objects.length,...(world.scene.scatters?.length?{scatters:expandScatters(world.scene).stats.map(({id,target,placed,removed})=>({id,target,placed,removed}))}:{}),assets:world.scene.assets.length,assetBytes:Object.values(assets).reduce((n,a)=>n+(a.bytes||0),0),modules:world.scene.runtime?.modules||[]},checks:[],metrics:current?{backend:observation.backend??null,frameP95Ms:observation.frameP95Ms??null,drawCalls:observation.drawCalls??null,triangles:observation.triangles??null}:null,limits:probeLimits('legacy-ground-plane'),next:[]};
 result.checks.push({id:'loaded-revision',status:current?'observed':'unknown',evidence:{accepted:world.revision,displayed:observation?.revision??null},message:current?'The browser recently reported this revision.':'Open or refresh the world and request a new observation before judging live behavior.'});
 if(current&&observation.loadError)result.checks.push({id:'loading',status:'attention',evidence:{error:String(observation.loadError).slice(0,1000)},message:'The browser reported a loading problem; inspect the retained world and candidate.'});
 if(current){
  const messages=[],append=(id,values)=>{if(messages.length>=32||!validId(id)||!Array.isArray(values)||!values.length)return;messages.push({id,messages:values.slice(0,4).map(value=>String(value).slice(0,300))});};
  for(const [id,values] of Object.entries(observation.activity?.gaitDiagnostics||{}))append(id,values);
  for(const [id,state] of Object.entries(observation.activity?.states||{}))append(id,state?.diagnostics);
  if(messages.length)result.checks.push({id:'runtime-bindings',status:'attention',evidence:{messages},message:'The browser reported articulation or flight-volume constraints. Inspect these entities; a moving root does not establish working limb animation.'});
 }
 if(world.schemaVersion!==2){result.next.push('This world has no registered spatial probe driver. Inspect it in the browser; no collision result is inferred.');return result;}
 const probe=makeProbe(world,observation,current,clock),{runtime,poseSource}=probe;
 result.driver=probe.driver;result.time=clock;result.limits=probeLimits(probe.driver);
 const spawn=probe.sample(world.scene.runtime.spawn);
 result.checks.push({id:'spawn-clearance',status:spawn.issues.length?'attention':'clear',evidence:{...spawn,position:spawn.eyePosition,originVisible:runtime.originVisible,poseSource},message:spawn.issues.length?'The declared spawn has a reported support or blocker constraint. Inspect the intended entry sequence.':'No support or blocker constraint was found at the declared spawn in this query.'});
 // A world without possession still walks bodyless. Suggest the maker; never add it.
 if(probe.driver==='legacy-ground-plane'){
  const {modules,possession}=withMaker(world.scene).runtime;
  result.checks.push({id:'inhabitant-upgrade',status:'suggestion',evidence:{driver:probe.driver,addModule:'inhabitant.maker@1',modules,possession},message:'This world uses the legacy bodyless walk. Adding the maker is a new revision: add inhabitant.maker@1 and runtime.possession, then walk the spawn, routes and walkable tops again. Nothing is migrated automatically.'});
  result.next.push('To walk this world as the maker, propose (or use Add the maker in Observe) a revision with inhabitant.maker@1 and runtime.possession {preset:"maker",camera:"first"}, then check it again.');
 }
 for(const route of routes){
  if(probe.driver==='legacy-ground-plane'&&(route.from[1]!==1.72||route.to[1]!==1.72)){result.checks.push({id:`route:${route.id}`,status:'unsupported',evidence:{from:route.from,to:route.to},message:'This driver only samples a 1.72 metre eye height on flat ground; no terrain support is present.'});continue;}
  const length=Math.hypot(route.to[0]-route.from[0],route.to[2]-route.from[2]),segments=Math.max(1,Math.min(64,Math.ceil(length/.1)));
  let firstHit=null,firstProblem=null,mode='grounded',feet=null,maxSlopeRadians=0,maxWaterDepth=0,outOfBoundsSamples=0;const modes=new Set();
  // Later samples stand on what is within one step of the previous feet, as the
  // walker does, so a route along a walkable deck stays on it.
  for(let i=0;i<=segments;i++){
   const t=i/segments,p=route.from.map((x,j)=>x+(route.to[j]-x)*t),sample=feet===null?probe.sample(p,mode):probe.sample(p,mode,feet+INHABITANT_LIMITS.maxStep);mode=sample.mode;modes.add(mode);
   if(feet!==null&&feet-sample.feetPosition[1]>INHABITANT_LIMITS.maxStep)sample.issues.push('drop');feet=sample.feetPosition[1];
   maxSlopeRadians=Math.max(maxSlopeRadians,sample.slopeRadians);maxWaterDepth=Math.max(maxWaterDepth,sample.waterDepth);if(!sample.inBounds)outOfBoundsSamples++;
   if(sample.blockerId&&!firstHit)firstHit={...sample,position:sample.eyePosition};if(sample.issues.length&&!firstProblem)firstProblem={...sample,position:sample.eyePosition};
  }
  result.checks.push({id:`route:${route.id}`,status:firstProblem?'attention':'clear',evidence:{samples:segments+1,sampleSpacing:length/segments,firstHit,firstProblem,maxSlopeRadians,maxWaterDepth,outOfBoundsSamples,modes:[...modes],poseSource,time:clock},message:firstProblem?'A sampled point meets a support, slope or blocker constraint; inspect whether it matches the intended route.':'Sampled support and blocker queries are clear; gaps between samples and dynamic traversal remain untested.'});
 }
 if(result.checks.some(c=>c.status==='attention'))result.next.push('Inspect the reported IDs and positions against the world bible. Keep intentional constraints; revise unintended ones and check again.');
 result.next.push('Walk the intended route and inspect the result at user eye height. Use an actual interaction check for moving objects.');
 return result;
}
