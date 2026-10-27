// Shared, image-free surface queries. Authored records never contain code.
// Terrain has two sources over one lattice and one set of stamps:
//  heightfield: {type:'heightfield', bounds:[xmin,xmax,zmin,zmax], segments:[nx,nz],
//   baseHeight, stamps, appearance?}, an analytic surface;
//  heightmap: {type:'heightmap', bounds, size:[nx,nz], height:{file,sha256,format:'r32'},
//   scale?, offset?, segments?, stamps, appearance?}, a sampled one. Its samples are
//   a pinned little-endian float32 file, row-major, row 0 at zmin and column 0 at
//   xmin, with the outermost samples on the bounds. A sample s is at height
//   s*scale+offset. Segments default to one cell per sample interval, so the
//   lattice vertices are the samples; other segments resample them bilinearly.
// Stamps: [{id,center:[x,z],radius:[rx,rz],height,operation?:'add'|'flatten',
// plateau?:0..less-than-1,falloff?:1..8}], applied in order over the source.
// Add uses a height delta; flatten uses an absolute height.
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
const pair=(value,min,max)=>Array.isArray(value)&&value.length===2&&value.every(n=>Number.isInteger(n)&&n>=min&&n<=max);

// Samples per axis, lattice cells per axis, file bytes (little-endian float32)
// and the elevation range of the sampled base after scale and offset.
export const HEIGHTMAP_LIMITS=Object.freeze({samples:1025,segments:1024,bytes:1025*1025*4,height:1000});
export const heightPath=file=>typeof file==='string'&&/^assets\/imports\/[-a-zA-Z0-9_/.]+\.r32$/.test(file)&&!file.split('/').some(p=>p==='..'||p==='.'||p==='');
const SHA256=/^[a-f0-9]{64}$/;

function validateStamps(stamps){
 assert(Array.isArray(stamps)&&stamps.length<=32,'Terrain allows at most 32 stamps');
 const ids=new Set();
 for(const stamp of stamps){
  record(stamp,['id','operation','center','radius','height','plateau','falloff'],'terrain stamp');
  assert(typeof stamp.id==='string'&&/^[-\w]{1,64}$/.test(stamp.id)&&!ids.has(stamp.id),'Invalid or duplicate terrain stamp ID');ids.add(stamp.id);
  assert(stamp.operation===undefined||['add','flatten'].includes(stamp.operation),'Unsupported terrain stamp operation');
  vector(stamp.center,2,'terrain stamp center');vector(stamp.radius,2,'terrain stamp radius');assert(stamp.radius.every(n=>n>0),'Terrain stamp radius must be positive');
  finite(stamp.height,-1000,1000,'terrain stamp height');finite(stamp.plateau??0,0,.999,'terrain stamp plateau');finite(stamp.falloff??2,1,8,'terrain stamp falloff');
 }
}
function validateAppearance(a){
 if(a===undefined)return;
 record(a,['sandColor','wetSandColor','grassColor','rockColor','grassStart','grassEnd','rockSlope','textureScale','layers'],'terrain appearance');
 for(const key of ['sandColor','wetSandColor','grassColor','rockColor'])if(a[key]!==undefined)tint(a[key],key);
 for(const key of ['grassStart','grassEnd'])if(a[key]!==undefined)finite(a[key],-1000,1000,key);
 if(a.grassStart!==undefined&&a.grassEnd!==undefined)assert(a.grassStart<a.grassEnd,'Grass end must be above grass start');
 if(a.rockSlope!==undefined)finite(a.rockSlope,0,Math.PI/2,'rock slope');
 if(a.textureScale!==undefined){finite(a.textureScale,0,100,'texture scale');assert(a.textureScale>0,'Texture scale must be positive');}
 if(a.layers!==undefined)validateTerrainLayers(a.layers);
}
function validateHeightmap(terrain){
 record(terrain,['type','bounds','size','height','scale','offset','segments','stamps','appearance'],'terrain');
 bounds(terrain.bounds,'terrain bounds');
 assert(pair(terrain.size,2,HEIGHTMAP_LIMITS.samples),`Heightmap size must be two integers from 2 to ${HEIGHTMAP_LIMITS.samples} samples`);
 record(terrain.height,['file','sha256','format'],'terrain height');
 assert(heightPath(terrain.height.file),'Terrain height file must be an .r32 file inside assets/imports');
 assert(typeof terrain.height.sha256==='string'&&SHA256.test(terrain.height.sha256),'Terrain height sha256 must be 64 lowercase hexadecimal digits');
 assert(terrain.height.format==='r32','Terrain height format must be "r32" (little-endian float32)');
 if(terrain.scale!==undefined){finite(terrain.scale,0,1000,'terrain height scale');assert(terrain.scale>0,'Terrain height scale must be positive');}
 if(terrain.offset!==undefined)finite(terrain.offset,-1000,1000,'terrain height offset');
 if(terrain.segments!==undefined)assert(pair(terrain.segments,1,HEIGHTMAP_LIMITS.segments),`Heightmap segments must be integers from 1 to ${HEIGHTMAP_LIMITS.segments}`);
 validateStamps(terrain.stamps);validateAppearance(terrain.appearance);
 return terrain;
}

export function validateTerrain(terrain){
 if(terrain?.type==='heightmap')return validateHeightmap(terrain);
 record(terrain,['type','bounds','segments','baseHeight','stamps','appearance'],'terrain');
 assert(terrain.type==='heightfield','Unsupported terrain type');bounds(terrain.bounds,'terrain bounds');
 assert(Array.isArray(terrain.segments)&&terrain.segments.length===2&&terrain.segments.every(n=>Number.isInteger(n)&&n>=1&&n<=256),'Terrain segments must be integers from 1 to 256');
 finite(terrain.baseHeight,-1000,1000,'terrain base height');
 validateStamps(terrain.stamps);validateAppearance(terrain.appearance);
 return terrain;
}

// Lattice cells per axis: a heightfield names them; a heightmap defaults to
// one cell per sample interval.
export const terrainSegments=terrain=>terrain.type==='heightmap'?terrain.segments??terrain.size.map(n=>n-1):terrain.segments;
// Everything that shapes support and geometry, and nothing that only shades it.
// A heightmap is identified by its content hash, never by its file name.
export function terrainSignature(terrain){
 if(!terrain)return null;
 return JSON.stringify(terrain.type==='heightmap'?[terrain.type,terrain.bounds,terrain.size,terrain.height.sha256,terrain.scale??1,terrain.offset??0,terrainSegments(terrain),terrain.stamps]:[terrain.type,terrain.bounds,terrain.segments,terrain.baseHeight,terrain.stamps]);
}

// Height samples by content hash. A host or viewer verifies a height file
// against its record's sha256, decodes it and registers the samples here;
// createTerrain reads them back by that hash, so every copy of a record (a
// staged proposal, a history snapshot, an export) resolves to the same
// samples. Samples in use by an accepted world, a staged proposal or a loaded
// bundle are retained until released; of the rest, the few most recently used
// stay. A built lattice keeps its own heights either way.
const RECENT_HEIGHTS=8,retainedHeights=new Map(),recentHeights=new Map();
export function registerHeightSamples(sha256,samples){
 assert(typeof sha256==='string'&&SHA256.test(sha256)&&samples instanceof Float32Array,'Register decoded Float32 samples under their sha256');
 const held=retainedHeights.get(sha256);if(held){held.samples=samples;return samples;}
 recentHeights.delete(sha256);recentHeights.set(sha256,samples);
 while(recentHeights.size>RECENT_HEIGHTS)recentHeights.delete(recentHeights.keys().next().value);
 return samples;
}
export function heightSamples(sha256){
 const held=retainedHeights.get(sha256);if(held)return held.samples;
 const samples=recentHeights.get(sha256);if(!samples)return null;
 recentHeights.delete(sha256);recentHeights.set(sha256,samples);return samples;
}
// Keeps registered samples resident until the matching release. Returns false
// when the samples are not registered (load them first).
export function retainHeightSamples(sha256){
 const held=retainedHeights.get(sha256);if(held){held.count++;return true;}
 const samples=recentHeights.get(sha256);if(!samples)return false;
 recentHeights.delete(sha256);retainedHeights.set(sha256,{samples,count:1});return true;
}
export function releaseHeightSamples(sha256){
 const held=retainedHeights.get(sha256);if(!held||--held.count>0)return;
 retainedHeights.delete(sha256);registerHeightSamples(sha256,held.samples);
}
// r32: nx*nz little-endian float32 values. Every sample must be finite.
export function decodeHeightSamples(bytes,size){
 assert(pair(size,2,HEIGHTMAP_LIMITS.samples),`Heightmap size must be two integers from 2 to ${HEIGHTMAP_LIMITS.samples} samples`);
 const view=ArrayBuffer.isView(bytes)?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength):new DataView(bytes),[nx,nz]=size,count=nx*nz;
 assert(view.byteLength===count*4,`Terrain height data has ${view.byteLength} bytes; size [${nx},${nz}] needs ${count*4} (little-endian float32)`);
 const samples=new Float32Array(count);
 for(let i=0;i<count;i++){
  const value=view.getFloat32(i*4,true);
  assert(Number.isFinite(value),`Terrain height sample at column ${i%nx}, row ${Math.floor(i/nx)} is not a finite number`);
  samples[i]=value;
 }
 return samples;
}
// Samples against their record: count and the elevation range of the base.
export function checkHeightSamples(terrain,samples){
 const [nx,nz]=terrain.size,scale=terrain.scale??1,offset=terrain.offset??0,label=terrain.height.sha256.slice(0,12);
 assert(samples.length===nx*nz,`Terrain height ${label} has ${samples.length} samples; size [${nx},${nz}] needs ${nx*nz}`);
 let min=Infinity,max=-Infinity;for(const value of samples){if(value<min)min=value;if(value>max)max=value;}
 const low=min*scale+offset,high=max*scale+offset;
 assert(low>=-HEIGHTMAP_LIMITS.height&&high<=HEIGHTMAP_LIMITS.height,`Terrain height ${label} spans ${low.toFixed(2)} to ${high.toFixed(2)} m after scale and offset; keep it within ±${HEIGHTMAP_LIMITS.height} m`);
 return {min:low,max:high};
}
// The sampled base at lattice vertex (i,j). With one cell per sample interval
// the vertex index is the sample index, so heights are the samples exactly.
function sampledBase(terrain,[nx,nz]){
 const samples=heightSamples(terrain.height.sha256);
 assert(samples,`Terrain height ${terrain.height.sha256.slice(0,12)} is not loaded; its pinned samples must be loaded before the terrain is built`);
 checkHeightSamples(terrain,samples);
 const [sx,sz]=terrain.size,scale=terrain.scale??1,offset=terrain.offset??0;
 return (i,j)=>{
  const u=i*(sx-1)/nx,v=j*(sz-1)/nz,i0=Math.min(sx-2,Math.floor(u)),j0=Math.min(sz-2,Math.floor(v)),fu=u-i0,fv=v-j0,k=j0*sx+i0;
  return ((samples[k]*(1-fu)+samples[k+1]*fu)*(1-fv)+(samples[k+sx]*(1-fu)+samples[k+sx+1]*fu)*fv)*scale+offset;
 };
}

function stampedHeight(stamps,x,z,height){
 for(const stamp of stamps){
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

// One lattice for both sources: the renderer draws these triangles and every
// support, aim, scatter and clearance query interpolates the same ones.
export function createTerrain(terrain){
 validateTerrain(terrain);
 const [nx,nz]=terrainSegments(terrain),xs=axisCoordinates(terrain.bounds[0],terrain.bounds[1],nx),zs=axisCoordinates(terrain.bounds[2],terrain.bounds[3],nz);
 const base=terrain.type==='heightmap'?sampledBase(terrain,[nx,nz]):null;
 const count=(nx+1)*(nz+1),heights=new Float32Array(count),positions=new Float32Array(count*3),normals=new Float32Array(count*3),indices=new Uint32Array(nx*nz*6);
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
  const index=z*(nx+1)+x;heights[index]=stampedHeight(terrain.stamps,xs[x],zs[z],base?base(x,z):terrain.baseHeight);
  positions[index*3]=xs[x];positions[index*3+1]=heights[index];positions[index*3+2]=zs[z];
 }
 // Row-major vertices, increasing z then x; both triangles face upwards.
 // Cell a,b / c,d uses [a,c,b] and [b,c,d]. This diagonal is also used below.
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const a=z*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1,o=(z*nx+x)*6;
  indices[o]=a;indices[o+1]=c;indices[o+2]=b;indices[o+3]=b;indices[o+4]=c;indices[o+5]=d;
 }
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  const n0=uy*vz-uz*vy,n1=uz*vx-ux*vz,n2=ux*vy-uy*vx;
  normals[a]+=n0;normals[a+1]+=n1;normals[a+2]+=n2;normals[b]+=n0;normals[b+1]+=n1;normals[b+2]+=n2;normals[c]+=n0;normals[c+1]+=n1;normals[c+2]+=n2;
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
// One lattice per terrain signature, shared by validation, scatter expansion
// and tools that do not own a runtime. Records are treated as immutable.
let sharedLattice={signature:null,terrain:null};
export function sharedTerrain(terrain){
 const signature=terrainSignature(terrain);
 if(sharedLattice.signature!==signature)sharedLattice={signature,terrain:createTerrain(terrain)};
 return sharedLattice.terrain;
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
