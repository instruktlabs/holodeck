// Shared, image-free surface queries. Authored records never contain code.
// Terrain: {type:'heightfield', bounds:[xmin,xmax,zmin,zmax], segments:[nx,nz],
// baseHeight, stamps:[{id,center:[x,z],radius:[rx,rz],height,
// operation?:'add'|'flatten',plateau?:0..less-than-1,falloff?:1..8}], appearance?}.
// Stamps apply in order. Add uses a height delta; flatten uses an absolute height.
// Plateau is a fraction of elliptical radius; beyond it the radial weight is
// (1 - normalizedRadiusSquared)^falloff. The outer radius has zero influence.
// Ocean: {type:'ocean',bounds,level,waves:[{direction:[dx,dz],amplitude,
// wavelength,speed,phase?}],color?,shallowColor?,foamWidth?,surf?}; see surf.mjs.
// Distances are metres, speed is metres/second, time seconds, angles radians.
// Wave phase = (2*PI/wavelength)*(dot(direction,[x,z])-speed*time)+phase.
// Shaders must use this equation and the same elapsed runtime clock. These
// queries do not apply buoyancy, shoreline attenuation or visual-only detail.

import {validateTerrainLayers} from './terrain-layers.mjs';
import {validateSurf} from './surf.mjs';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const record=(value,keys,label)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)),`Invalid ${label} fields`);
const finite=(value,min,max,label)=>assert(Number.isFinite(value)&&value>=min&&value<=max,`Invalid ${label}`);
const vector=(value,length,label)=>assert(Array.isArray(value)&&value.length===length&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000),`Invalid ${label}`);
const bounds=(value,label)=>{vector(value,4,label);assert(value[0]<value[1]&&value[2]<value[3],`Invalid ${label}`);};
const tint=(value,label)=>assert(typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value),`Invalid ${label}`);

export function validateTerrain(terrain){
 record(terrain,['type','bounds','segments','baseHeight','stamps','appearance'],'terrain');
 assert(terrain.type==='heightfield','Unsupported terrain type');bounds(terrain.bounds,'terrain bounds');
 assert(Array.isArray(terrain.segments)&&terrain.segments.length===2&&terrain.segments.every(n=>Number.isInteger(n)&&n>=1&&n<=256),'Terrain segments must be integers from 1 to 256');
 finite(terrain.baseHeight,-1000,1000,'terrain base height');
 assert(Array.isArray(terrain.stamps)&&terrain.stamps.length<=32,'Terrain allows at most 32 stamps');
 const ids=new Set();
 for(const stamp of terrain.stamps){
  record(stamp,['id','operation','center','radius','height','plateau','falloff'],'terrain stamp');
  assert(typeof stamp.id==='string'&&/^[-\w]{1,64}$/.test(stamp.id)&&!ids.has(stamp.id),'Invalid or duplicate terrain stamp ID');ids.add(stamp.id);
  assert(stamp.operation===undefined||['add','flatten'].includes(stamp.operation),'Unsupported terrain stamp operation');
  vector(stamp.center,2,'terrain stamp center');vector(stamp.radius,2,'terrain stamp radius');assert(stamp.radius.every(n=>n>0),'Terrain stamp radius must be positive');
  finite(stamp.height,-1000,1000,'terrain stamp height');finite(stamp.plateau??0,0,.999,'terrain stamp plateau');finite(stamp.falloff??2,1,8,'terrain stamp falloff');
 }
 if(terrain.appearance!==undefined){
  const a=terrain.appearance;record(a,['sandColor','wetSandColor','grassColor','rockColor','grassStart','grassEnd','rockSlope','textureScale','layers'],'terrain appearance');
  for(const key of ['sandColor','wetSandColor','grassColor','rockColor'])if(a[key]!==undefined)tint(a[key],key);
  for(const key of ['grassStart','grassEnd'])if(a[key]!==undefined)finite(a[key],-1000,1000,key);
  if(a.grassStart!==undefined&&a.grassEnd!==undefined)assert(a.grassStart<a.grassEnd,'Grass end must be above grass start');
  if(a.rockSlope!==undefined)finite(a.rockSlope,0,Math.PI/2,'rock slope');
  if(a.textureScale!==undefined){finite(a.textureScale,0,100,'texture scale');assert(a.textureScale>0,'Texture scale must be positive');}
  if(a.layers!==undefined)validateTerrainLayers(a.layers);
 }
 return terrain;
}

function authoredHeight(terrain,x,z){
 let height=terrain.baseHeight;
 for(const stamp of terrain.stamps){
  const radius=Math.hypot((x-stamp.center[0])/stamp.radius[0],(z-stamp.center[1])/stamp.radius[1]);
  if(radius>=1)continue;
  const plateau=stamp.plateau??0,t=Math.max(0,(radius-plateau)/(1-plateau)),weight=(1-t*t)**(stamp.falloff??2);
  height+=((stamp.operation==='flatten'?stamp.height-height:stamp.height))*weight;
 }
 return height;
}

const normalFromGradient=(dx,dz)=>{const length=Math.hypot(dx,1,dz);return [dx===0?0:-dx/length,1/length,dz===0?0:-dz/length];};
// Coordinate rounding belongs to the geometry too. Queries interpolate using
// its actual Float32 vertex coordinates, not a parallel double-precision grid.
function axisCoordinates(min,max,segments){
 const axis=Float32Array.from({length:segments+1},(_,i)=>min+(max-min)*i/segments);
 for(let i=1;i<axis.length;i++)assert(axis[i]>axis[i-1],'Terrain cells collapse at Float32 precision; increase extent or reduce segments');
 return axis;
}
function cellAt(axis,value){
 const last=axis.length-1;let cell=Math.min(last-1,Math.max(0,Math.floor((value-axis[0])/(axis[last]-axis[0])*last)));
 while(cell>0&&value<axis[cell])cell--;
 while(cell<last-1&&value>axis[cell+1])cell++;
 return cell;
}

export function createTerrain(terrain){
 validateTerrain(terrain);
 const [nx,nz]=terrain.segments,xs=axisCoordinates(terrain.bounds[0],terrain.bounds[1],nx),zs=axisCoordinates(terrain.bounds[2],terrain.bounds[3],nz);
 const count=(nx+1)*(nz+1),heights=new Float32Array(count),positions=new Float32Array(count*3),normals=new Float32Array(count*3),indices=new Uint32Array(nx*nz*6);
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
  const index=z*(nx+1)+x;heights[index]=authoredHeight(terrain,xs[x],zs[z]);positions.set([xs[x],heights[index],zs[z]],index*3);
 }
 // Row-major vertices, increasing z then x; both triangles face upwards.
 // Cell a,b / c,d uses [a,c,b] and [b,c,d]. This diagonal is also used below.
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const a=z*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;indices.set([a,c,b,b,c,d],(z*nx+x)*6);
 }
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  const normal=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  for(const vertex of [a,b,c])for(let axis=0;axis<3;axis++)normals[vertex+axis]+=normal[axis];
 }
 for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);for(let axis=0;axis<3;axis++)normals[i+axis]/=length;}
 const meshBounds=[xs[0],xs[nx],zs[0],zs[nz]];
 function sample(x,z){
  assert(Number.isFinite(x)&&Number.isFinite(z),'Terrain query coordinates must be finite');
  const inBounds=x>=xs[0]&&x<=xs[nx]&&z>=zs[0]&&z<=zs[nz];
  x=Math.max(xs[0],Math.min(xs[nx],x));z=Math.max(zs[0],Math.min(zs[nz],z));
  const ix=cellAt(xs,x),iz=cellAt(zs,z),width=xs[ix+1]-xs[ix],depth=zs[iz+1]-zs[iz],fx=(x-xs[ix])/width,fz=(z-zs[iz])/depth;
  const a=iz*(nx+1)+ix,b=a+1,c=a+nx+1,d=c+1;let height,dx,dz;
  if(fx+fz<=1){height=heights[a]+(heights[b]-heights[a])*fx+(heights[c]-heights[a])*fz;dx=(heights[b]-heights[a])/width;dz=(heights[c]-heights[a])/depth;}
  else{height=heights[d]+(heights[c]-heights[d])*(1-fx)+(heights[b]-heights[d])*(1-fz);dx=(heights[d]-heights[c])/width;dz=(heights[d]-heights[b])/depth;}
  const normal=normalFromGradient(dx,dz);return {height,normal,slope:Math.atan(Math.hypot(dx,dz)),inBounds};
 }
 // Smooth vertex normals are for lighting. sample.normal is the supporting
 // triangle's face normal, appropriate for slope limits and contact queries.
 return {heights,positions,normals,indices,bounds:meshBounds,segments:[nx,nz],sample};
}

export function validateWater(water){
 record(water,['type','bounds','level','waves','color','shallowColor','foamWidth','surf','reflection'],'water');
 assert(water.type==='ocean','Unsupported water type');bounds(water.bounds,'water bounds');finite(water.level,-1000,1000,'water level');
 assert(Array.isArray(water.waves)&&water.waves.length<=4,'Water allows at most four waves');
 for(const wave of water.waves){
  record(wave,['direction','amplitude','wavelength','speed','phase'],'water wave');vector(wave.direction,2,'wave direction');
  assert(Math.abs(Math.hypot(...wave.direction)-1)<=1e-6,'Wave direction must be a unit vector');
  finite(wave.amplitude,0,10,'wave amplitude');finite(wave.wavelength,.1,1000,'wave wavelength');finite(wave.speed,-30,30,'wave speed');finite(wave.phase??0,-Math.PI*2,Math.PI*2,'wave phase');
 }
 for(const key of ['color','shallowColor'])if(water[key]!==undefined)tint(water[key],key);
 if(water.foamWidth!==undefined)finite(water.foamWidth,.001,20,'foam width');
 if(water.surf!==undefined)validateSurf(water.surf);
 assert(water.reflection===undefined||water.reflection==='planar','Water reflection must be "planar"');
 return water;
}

// Validate the record once at adoption. This hot-path sampler does not repeat
// schema validation. Outside bounds it still reports the mathematical surface,
// with inBounds:false; controllers decide whether water exists at the actor.
export function sampleWater(water,x,z,time){
 assert(Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(time),'Water query coordinates and time must be finite');
 let height=water.level,dx=0,dz=0;
 for(const wave of water.waves){
  const k=Math.PI*2/wave.wavelength,phase=k*(wave.direction[0]*x+wave.direction[1]*z-wave.speed*time)+(wave.phase??0),gradient=wave.amplitude*k*Math.cos(phase);
  height+=wave.amplitude*Math.sin(phase);dx+=gradient*wave.direction[0];dz+=gradient*wave.direction[1];
 }
 const b=water.bounds,normal=normalFromGradient(dx,dz);
 return {height,normal,slope:Math.atan(Math.hypot(dx,dz)),inBounds:x>=b[0]&&x<=b[1]&&z>=b[2]&&z<=b[3]};
}
