import {sharedTerrain} from './terrain.mjs';
// Seeded scatter: authored records that expand into ordinary static placements.
// Scatter: {id, layer?, label?, seed, variants:[{asset,weight?}], region:{polygon:[[x,z]...]},
// limits?:{height?:[min,max], slope?:[minDeg,maxDeg], waterDepth?:[min,max]},
// density (instances per 100 m² of region), maxCount, minSpacing,
// jitter?:{scale?:[min,max], yaw?:[min,max] radians, lean?:[min,max] radians},
// conform?:0..1, yOffset?, keepOut?:[{path,width}|{circle:[x,z,r]}|{polygon}],
// avoid?:[earlier scatter IDs], removed?:[instance indices], collider?:null|box}.
// waterDepth is the water rest level minus terrain height (negative above water).
// The same record, terrain and water level always expand to the same placements.
// Changing a parameter may reshuffle instances; removing one never does.

export const SCATTER_LIMITS=Object.freeze({scatters:32,variants:8,polygon:64,keepOut:64,path:32,attemptsPerInstance:30});
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const record=(value,keys,label)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)),`Invalid ${label} fields`);
const finite=(value,min,max,label)=>assert(Number.isFinite(value)&&value>=min&&value<=max,`Invalid ${label}`);
const point=(value,label)=>assert(Array.isArray(value)&&value.length===2&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000),`Invalid ${label}`);
const range=(value,min,max,label)=>{assert(Array.isArray(value)&&value.length===2,`Invalid ${label}`);finite(value[0],min,max,label);finite(value[1],min,max,label);assert(value[0]<=value[1],`Invalid ${label}: minimum exceeds maximum`);};
const points=(value,min,max,label)=>{assert(Array.isArray(value)&&value.length>=min&&value.length<=max,`${label} needs ${min} to ${max} points`);value.forEach(p=>point(p,label));};
const polygonArea=polygon=>Math.abs(polygon.reduce((n,[x,z],i)=>{const [x2,z2]=polygon[(i+1)%polygon.length];return n+x*z2-x2*z;},0))/2;
const vec3=(value,label,positive=false)=>assert(Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000&&(!positive||n>0)),`Invalid ${label}`);

export function validateScatters(scene){
 const list=scene.scatters;
 assert(Array.isArray(list)&&list.length<=SCATTER_LIMITS.scatters,`A scene allows at most ${SCATTER_LIMITS.scatters} scatters`);
 const assets=new Set((scene.assets||[]).map(a=>a.id)),objects=new Set((scene.objects||[]).map(o=>o.id)),seen=new Set();
 for(const s of list){
  record(s,['id','layer','label','seed','variants','region','limits','density','maxCount','minSpacing','jitter','conform','yOffset','keepOut','avoid','removed','collider'],'scatter');
  assert(typeof s.id==='string'&&/^[-\w]{1,64}$/.test(s.id)&&!seen.has(s.id),'Invalid or duplicate scatter ID');
  assert(!objects.has(s.id),`Scatter ${s.id} shares an ID with a placement`);
  const label=`scatter ${s.id}`;
  if(s.layer!==undefined)assert(['world','origin'].includes(s.layer),`Unknown ${label} layer`);
  if(s.label!==undefined)assert(typeof s.label==='string'&&s.label.length<=100,`Invalid ${label} label`);
  assert(Number.isInteger(s.seed)&&s.seed>=0&&s.seed<=0xffffffff,`${label} seed must be an integer from 0 to 4294967295`);
  assert(Array.isArray(s.variants)&&s.variants.length>=1&&s.variants.length<=SCATTER_LIMITS.variants,`${label} needs 1 to ${SCATTER_LIMITS.variants} variants`);
  for(const v of s.variants){
   record(v,['asset','weight'],`${label} variant`);
   assert(assets.has(v.asset),`Missing asset ${v.asset} for ${label}`);
   assert(v.asset!==scene.origin&&v.asset!==scene.moodboard?.asset,`${label} cannot scatter the origin or mood board asset`);
   if(v.weight!==undefined)finite(v.weight,.001,1000,`${label} variant weight`);
  }
  record(s.region,['polygon'],`${label} region`);points(s.region.polygon,3,SCATTER_LIMITS.polygon,`${label} region polygon`);
  assert(polygonArea(s.region.polygon)>0,`${label} region polygon has no area`);
  if(s.limits!==undefined){
   record(s.limits,['height','slope','waterDepth'],`${label} limits`);
   if(s.limits.height!==undefined)range(s.limits.height,-1000,1000,`${label} height limit`);
   if(s.limits.slope!==undefined)range(s.limits.slope,0,90,`${label} slope limit (degrees)`);
   if(s.limits.waterDepth!==undefined)range(s.limits.waterDepth,-1000,1000,`${label} water depth limit`);
  }
  finite(s.density,.001,100,`${label} density (instances per 100 m²)`);
  assert(Number.isInteger(s.maxCount)&&s.maxCount>=1&&s.maxCount<=1200,`${label} maxCount must be an integer from 1 to 1200`);
  finite(s.minSpacing,0,100,`${label} minSpacing`);
  if(s.jitter!==undefined){
   record(s.jitter,['scale','yaw','lean'],`${label} jitter`);
   if(s.jitter.scale!==undefined)range(s.jitter.scale,.01,100,`${label} scale jitter`);
   if(s.jitter.yaw!==undefined)range(s.jitter.yaw,-Math.PI*2,Math.PI*2,`${label} yaw jitter`);
   if(s.jitter.lean!==undefined)range(s.jitter.lean,0,Math.PI/4,`${label} lean jitter`);
  }
  if(s.conform!==undefined)finite(s.conform,0,1,`${label} conform`);
  if(s.yOffset!==undefined)finite(s.yOffset,-100,100,`${label} yOffset`);
  if(s.keepOut!==undefined){
   assert(Array.isArray(s.keepOut)&&s.keepOut.length<=SCATTER_LIMITS.keepOut,`${label} allows at most ${SCATTER_LIMITS.keepOut} keep-out shapes`);
   for(const k of s.keepOut){
    if(k?.path!==undefined){record(k,['path','width'],`${label} keep-out path`);points(k.path,2,SCATTER_LIMITS.path,`${label} keep-out path`);finite(k.width,.01,200,`${label} keep-out path width`);}
    else if(k?.circle!==undefined){record(k,['circle'],`${label} keep-out circle`);assert(Array.isArray(k.circle)&&k.circle.length===3&&k.circle.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000)&&k.circle[2]>0,`Invalid ${label} keep-out circle`);}
    else {record(k,['polygon'],`${label} keep-out polygon`);points(k.polygon,3,SCATTER_LIMITS.polygon,`${label} keep-out polygon`);}
   }
  }
  if(s.avoid!==undefined){
   assert(Array.isArray(s.avoid)&&s.avoid.length<=SCATTER_LIMITS.scatters,`Invalid ${label} avoid list`);
   for(const id of s.avoid)assert(seen.has(id),`${label} can only avoid scatters listed before it`);
  }
  if(s.removed!==undefined){
   assert(Array.isArray(s.removed)&&s.removed.length<=s.maxCount&&s.removed.every(n=>Number.isInteger(n)&&n>=0&&n<s.maxCount)&&new Set(s.removed).size===s.removed.length,`${label} removed must list unique instance indices below maxCount`);
  }
  if(s.collider!==undefined&&s.collider!==null){record(s.collider,['type','size','offset'],`${label} collider`);assert(s.collider.type==='box',`${label} supports a box collider only`);vec3(s.collider.size,`${label} collider size`,true);vec3(s.collider.offset,`${label} collider offset`);}
  seen.add(s.id);
 }
 return list;
}

// mulberry32: small, fast and identical in every JavaScript engine.
export function seededRandom(seed){
 let a=seed>>>0;
 return ()=>{a=a+0x6d2b79f5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
function insidePolygon(polygon,x,z){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,zi]=polygon[i],[xj,zj]=polygon[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}
 return inside;
}
function segmentDistance(x,z,[ax,az],[bx,bz]){
 const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length)):0;
 return Math.hypot(x-ax-t*dx,z-az-t*dz);
}
export function insideKeepOut(k,x,z){
 if(k.circle)return Math.hypot(x-k.circle[0],z-k.circle[1])<k.circle[2];
 if(k.path){for(let i=1;i<k.path.length;i++)if(segmentDistance(x,z,k.path[i-1],k.path[i])<k.width/2)return true;return false;}
 return insidePolygon(k.polygon,x,z);
}
// A uniform grid of cell size >= radius answers spacing queries from 3x3 cells.
function spacingGrid(cell){
 const cells=new Map(),key=(i,j)=>`${i},${j}`;
 return {
  add(x,z){const k=key(Math.floor(x/cell),Math.floor(z/cell));if(!cells.has(k))cells.set(k,[]);cells.get(k).push([x,z]);},
  near(x,z,radius){
   if(radius<=0)return false;const i=Math.floor(x/cell),j=Math.floor(z/cell),reach=Math.ceil(radius/cell);
   for(let a=i-reach;a<=i+reach;a++)for(let b=j-reach;b<=j+reach;b++)for(const [px,pz] of cells.get(key(a,b))||[])if(Math.hypot(px-x,pz-z)<radius)return true;
   return false;
  },
 };
}
// Rotation that tilts world up onto `up`, after a yaw about world up, as three.js
// Euler XYZ radians (matrix = Rx*Ry*Rz). Upright results stay [0,yaw,0].
export function tiltedRotation(up,yaw){
 const [ux,uy,uz]=up,angle=Math.acos(Math.max(-1,Math.min(1,uy))),axisLength=Math.hypot(uz,ux);
 if(axisLength<=1e-9||angle<=1e-9)return [0,yaw,0];
 // Rodrigues matrix about the horizontal axis [0,1,0] x up.
 const kx=uz/axisLength,kz=-ux/axisLength,c=Math.cos(angle),s=Math.sin(angle),v=1-c;
 const r=[[c+kx*kx*v,-kz*s,kx*kz*v],[kz*s,c,-kx*s],[kz*kx*v,kx*s,c+kz*kz*v]];
 const cy=Math.cos(yaw),sy=Math.sin(yaw),yawMatrix=[[cy,0,sy],[0,1,0],[-sy,0,cy]];
 const m=r.map(row=>[0,1,2].map(j=>row.reduce((n,value,k)=>n+value*yawMatrix[k][j],0)));
 const y=Math.asin(Math.max(-1,Math.min(1,m[0][2])));
 return Math.abs(m[0][2])<.9999999?[Math.atan2(-m[1][2],m[2][2]),y,Math.atan2(-m[0][1],m[0][0])]:[Math.atan2(m[2][1],m[1][1]),y,0];
}
const lerp=([a,b],t)=>a+(b-a)*t;

function expandOne(s,{terrain,waterLevel,avoided}){
 const random=seededRandom(s.seed),polygon=s.region.polygon,area=polygonArea(polygon);
 const target=Math.min(s.maxCount,Math.round(s.density*area/100));
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]),[x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];
 const weights=s.variants.map(v=>v.weight??1),total=weights.reduce((a,b)=>a+b,0);
 const grid=spacingGrid(Math.max(s.minSpacing,1)),limits=s.limits||{},jitter=s.jitter||{},removed=new Set(s.removed||[]);
 const placements=[];let accepted=0,attempts=0;
 const maxAttempts=Math.max(target*SCATTER_LIMITS.attemptsPerInstance,100);
 while(accepted<target&&attempts<maxAttempts){
  attempts++;
  // Every attempt draws the same two numbers, so later candidates do not shift.
  const x=x0+(x1-x0)*random(),z=z0+(z1-z0)*random();
  if(!insidePolygon(polygon,x,z)||(s.keepOut||[]).some(k=>insideKeepOut(k,x,z)))continue;
  if(grid.near(x,z,s.minSpacing)||avoided.near(x,z,s.minSpacing))continue;
  const ground=terrain.sample(x,z);if(!ground.inBounds)continue;
  if(limits.height&&(ground.height<limits.height[0]||ground.height>limits.height[1]))continue;
  const slope=ground.slope*180/Math.PI;if(limits.slope&&(slope<limits.slope[0]||slope>limits.slope[1]))continue;
  if(limits.waterDepth){const depth=waterLevel===null?-Infinity:waterLevel-ground.height;if(depth<limits.waterDepth[0]||depth>limits.waterDepth[1])continue;}
  let pick=random()*total,variant=0;while(variant<weights.length-1&&pick>=weights[variant])pick-=weights[variant++];
  const scale=lerp(jitter.scale||[1,1],random()),yaw=lerp(jitter.yaw||[0,0],random()),lean=lerp(jitter.lean||[0,0],random()),leanDirection=random()*Math.PI*2;
  grid.add(x,z);const index=accepted++;
  if(removed.has(index))continue;
  // Blend world up toward the support normal, then lean about a random horizontal axis.
  const conform=s.conform??0,n=ground.normal;let up=[n[0]*conform,1-conform+n[1]*conform,n[2]*conform];
  const length=Math.hypot(...up);up=up.map(v=>v/length);
  if(lean>0){const ax=Math.cos(leanDirection),az=Math.sin(leanDirection),c=Math.cos(lean),si=Math.sin(lean),dot=ax*up[0]+az*up[2];
   // Rodrigues rotation of `up` about the horizontal axis [ax,0,az].
   up=[up[0]*c+(-az*up[1])*si+ax*dot*(1-c),up[1]*c+(az*up[0]-ax*up[2])*si,up[2]*c+(ax*up[1])*si+az*dot*(1-c)];}
  placements.push({id:`${s.id}#${index}`,asset:s.variants[variant].asset,position:[x,ground.height+(s.yOffset??0),z],rotation:tiltedRotation(up,yaw),yaw,scale:[scale,scale,scale],collider:s.collider??null,...(s.layer?{layer:s.layer}:{}),...(s.label?{label:s.label}:{}),scatter:s.id});
 }
 return {placements,stats:{id:s.id,target,placed:placements.length,removed:accepted-placements.length,attempts}};
}

const expansions=new WeakMap();
// Expanded placements and per-scatter counts. Results are cached per scene
// object, so scene records are treated as immutable once expanded.
export function expandScatters(scene,{terrain}={}){
 if(!scene?.scatters?.length)return {placements:[],stats:[]};
 if(expansions.has(scene))return expansions.get(scene);
 assert(scene.terrain,'Scatters require scene.terrain');
 const surface=terrain||sharedTerrain(scene.terrain),waterLevel=scene.water?.level??null,byId=new Map(),placements=[],stats=[];
 for(const s of scene.scatters){
  const avoided=spacingGrid(Math.max(s.minSpacing,1));
  for(const id of s.avoid||[])for(const p of byId.get(id)||[])avoided.add(p.position[0],p.position[2]);
  const result=expandOne(s,{terrain:surface,waterLevel,avoided});
  byId.set(s.id,result.placements);placements.push(...result.placements);stats.push(result.stats);
 }
 const result={placements,stats};expansions.set(scene,result);return result;
}
// Authored placements followed by expanded scatter placements. Expanded ones
// carry `scatter` (their record ID) and `yaw`, the collision heading before tilt.
export function placedObjects(scene,options){
 return scene?.scatters?.length?[...scene.objects,...expandScatters(scene,options).placements]:scene?.objects||[];
}
