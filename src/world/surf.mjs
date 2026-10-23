// Visual surf for an ocean over a terrain heightfield (H22). Physical waves in
// sampleWater are untouched; surf is a map of where an authored swell breaks,
// how far its whitewater carries, and how much swell reaches each shore.
export const SURF_DEFAULTS={breakDepth:1.2,intensity:.8,whitewater:18,runUp:.35};
export const SURF_MAP_SIZE=512;
const SURF_KEYS=['breakDepth','intensity','whitewater','runUp','period','direction'];
const fail=message=>{throw new Error(message);};
const finite=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(`${label} must be a number from ${min} to ${max}`);};

export function validateSurf(surf){
  if(!surf||typeof surf!=='object'||Array.isArray(surf))fail('water surf must be an object');
  for(const key of Object.keys(surf))if(!SURF_KEYS.includes(key))fail(`Unknown water surf field ${key}`);
  if(surf.breakDepth!==undefined)finite(surf.breakDepth,.1,10,'surf breakDepth');
  if(surf.intensity!==undefined)finite(surf.intensity,0,1,'surf intensity');
  if(surf.whitewater!==undefined)finite(surf.whitewater,1,80,'surf whitewater');
  if(surf.runUp!==undefined)finite(surf.runUp,0,3,'surf runUp');
  if(surf.period!==undefined)finite(surf.period,2,30,'surf period');
  if(surf.direction!==undefined){
    if(!Array.isArray(surf.direction)||surf.direction.length!==2||!surf.direction.every(Number.isFinite))fail('surf direction must be [x,z]');
    if(Math.abs(Math.hypot(...surf.direction)-1)>1e-6)fail('surf direction must be a unit vector');
  }
  return surf;
}

// Settings with defaults resolved: period and direction follow the first wave.
export function resolveSurf(water){
  const s=water.surf,first=water.waves[0];
  const period=s.period??(first&&first.speed?Math.min(30,Math.max(2,first.wavelength/Math.abs(first.speed))):9);
  const direction=s.direction??(first?first.direction.map(v=>v*Math.sign(first.speed||1)+0):[1,0]);
  return {...SURF_DEFAULTS,...s,period,direction,celerity:first?.speed?Math.abs(first.speed):5};
}

// Breaking cuts the swell to the depth-limited share (depth / breakDepth).
// Wherever it is actively breaking, foam scales with the arriving swell, from a
// base share on a gentle shoal up to full where the loss per metre is steep, as
// at a reef rim. Swell recovers slowly over deep water and dies within a few
// metres inland. Measured on the tropical island: loss per metre alone left 89%
// of breaking texels under 0.2, so the rim barely showed.
const RECOVERY=200,INLAND=10,DISSIPATION_SCALE=2.5,BREAKING_BASE=.6;

// Builds the surf map over the terrain bounds: per texel R break strength,
// G whitewater distance since the last break over `whitewater` (1 = none),
// B the swell that reached this shore: the energy in the last water at least
// breakDepth deep, so a lagoon beach gets the lagoon's small swell and an
// exposed beach the open sea's, each 0..255. The swell is marched along its direction, each
// texel inheriting from the texel one step upstream, so it visits every texel
// once. `heightAt(x,z)` gives terrain height; outside the bounds it is deep.
export function buildSurfMap({bounds,heightAt,level,surf,size=SURF_MAP_SIZE}){
  const [xmin,xmax,zmin,zmax]=bounds,dx=(xmax-xmin)/size,dz=(zmax-zmin)/size,step=Math.min(dx,dz);
  const [ux,uz]=surf.direction,count=size*size;
  const energy=new Float32Array(count),offshore=new Float32Array(count),distance=new Float32Array(count),order=new Uint32Array(count),key=new Float32Array(count);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const k=j*size+i;order[k]=k;key[k]=(xmin+(i+.5)*dx)*ux+(zmin+(j+.5)*dz)*uz;}
  order.sort((a,b)=>key[a]-key[b]);
  const out=new Uint8Array(count*4);
  for(const k of order){
    const i=k%size,j=(k-i)/size,x=xmin+(i+.5)*dx,z=zmin+(j+.5)*dz;
    const ui=Math.round((x-ux*step-xmin)/dx-.5),uj=Math.round((z-uz*step-zmin)/dz-.5),upstream=ui>=0&&ui<size&&uj>=0&&uj<size&&!(ui===i&&uj===j)?uj*size+ui:-1;
    const inE=upstream<0?1:energy[upstream],inO=upstream<0?1:offshore[upstream],inD=upstream<0?Infinity:distance[upstream];
    const depth=level-heightAt(x,z);
    let e,o=inO,strength=0;
    if(depth<=0){e=inE*Math.exp(-step/INLAND);o=inO*Math.exp(-step/INLAND);}
    else{
      const limit=Math.min(1,depth/surf.breakDepth);
      e=inE>limit?limit:Math.min(limit,inE+step/RECOVERY);
      if(inE>limit+1e-4)strength=inE*Math.min(1,BREAKING_BASE+(inE-e)/step*DISSIPATION_SCALE);
      if(depth>=surf.breakDepth)o=e;
    }
    const d=strength>.02?0:inD+step;
    energy[k]=e;offshore[k]=o;distance[k]=d;
    out[k*4]=Math.round(strength*255);out[k*4+1]=Math.round(Math.min(1,d/surf.whitewater)*255);out[k*4+2]=Math.round(Math.min(1,o)*255);out[k*4+3]=255;
  }
  return out;
}
