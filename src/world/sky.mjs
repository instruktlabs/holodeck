// Authored sky (H23): a horizon-to-zenith gradient, a sun disc and optional
// procedural clouds. Without environment.sky the analytic daylight dome stays.
// horizonColor defaults to fogColor so the distant fog meets the sky.
import {linearHex} from './water-optics.mjs';

export const SKY_DEFAULTS={curve:.45,sunDisc:1};
// sky.radiance (H123): 'display' (the default) draws the sky's colours as they are, so
// however strong the sun, its sky and clouds stay near a linear 1 while sunlit stone
// keeps climbing. 'sun' lights the sky with the sun: the dome's gradient, clouds,
// cumulus, cloud deck, sun disc and glow, the fog and haze, and the water's sky all take
// sunIntensity/π times their colours. A #ffffff sky is then as bright as white stone
// facing the sun, sunlit cloud tops a little brighter, and raising the sun raises both.
export const SKY_RADIANCE=['display','sun'];
export function skyRadianceScale(environment){
  return environment?.sky?.radiance==='sun'?(environment.sunIntensity??1)/Math.PI:1;
}
// Clouds, the cumulus bank and the cloud deck are lit in cloudLight, sunColor unless
// set: a whiter cloudLight keeps a golden sun on the stone and off the clouds (H109).
export const CLOUD_DEFAULTS={coverage:.35,density:.5,height:.5,scale:1,drift:[.6,.2]};
// Sky light: the dome is captured once into an environment map that lit
// materials reflect and are lit by, in place of the fixed hemisphere fill.
// A single unoccluded probe overfills shadowed faces, hence less than 1.
export const SKY_LIGHT_DEFAULTS={intensity:.6};
// sky.light.grid (H127, plateau plan step 5): a box of light probes, min to max in world
// metres, baked in the browser after the sky light's captures (three's LightProbeGrid, L2
// spherical harmonics, with bounces of light between surfaces). Lit surfaces take their
// diffuse fill from the probes around them, so shade under a lintel is lit warm by the
// sunlit stone it faces and recesses darken, where the single probe lit every face the
// same. The sky light's capture then serves reflections only. The grid's intensity is
// relative to the sky light's: 1 fills shade as brightly as the capture's diffuse term did.
export const GRID_DEFAULTS={spacing:8,bounces:1,intensity:1};
const GRID_KEYS=['min','max',...Object.keys(GRID_DEFAULTS)];
export const MAX_GRID_PROBES=1200;
// Probes per axis: one every spacing metres, at least 2.
export function gridResolution(grid){
  return [0,1,2].map(i=>Math.max(2,Math.round((grid.max[i]-grid.min[i])/grid.spacing)+1));
}
// A sunlit deck of cloud at a world height, seen below the horizon from above it.
// contrast scales the light and shade across the billows (.5 is the H81 look,
// 1 sinks the shaded sides to sky-lit lavender); haze is the ray elevation below
// which the deck dissolves into the horizon haze (H103).
export const CLOUD_SEA_DEFAULTS={coverage:.8,scale:1,drift:[1,.3],contrast:.5,haze:.3};
// Below this ray elevation the deck dissolves into the horizon haze; wide enough
// that the deck and the sky meet in haze rather than at a line (H74).
export const CLOUD_SEA_HAZE=.3;
// cloudSea.model (H125, plateau plan step 3): 'billows' is the deck above (gradient-noise
// billows shaded by slope and hazed by a downward-slope ramp). 'cumulus' builds the deck from
// rounded lobes at three scales (masses of a few hundred metres, billows, cauliflower
// detail), lights it through its own depth toward the sun (Beer's law over a few steps,
// a forward-scatter lobe, ambient by height), opens its gaps onto a darker, bluer layer
// below, hazes it with clear-air distance haze instead of the slope ramp, and with towers
// raises a few sparse taller domes that shadow and hide the deck behind them.
export const CLOUD_SEA_MODELS=['billows','cumulus'];
// Below the horizon the dome turns to the fog colour over this much elevation:
// a finite ocean seen from above ends in fully fogged water, which is fogColor,
// so the dome past its edge must match it rather than the horizon colour.
export const BELOW_HORIZON=.02;
// The cloud plane divides by elevation, floored here; under the floor clouds
// smear into vertical streaks, so they fade in only above it.
export const CLOUD_FLOOR=.02;
// A bank of towering cumulus along part of the horizon (H92), drawn in the dome
// like the rest of the sky: toward [x,z] is the horizontal direction of its middle,
// spread its half-width and height the elevation of its tallest tops, in degrees;
// scale sizes the towers and billows.
export const CUMULUS_DEFAULTS={spread:30,height:12,scale:1};
// Up to six banks, each on its own part of the horizon (H114); resolved as a list.
export const MAX_CUMULUS_BANKS=6;
const SKY_KEYS=['zenithColor','horizonColor','curve','sunDisc','cloudLight','radiance','clouds','light','cloudSea','cumulus'],CLOUD_KEYS=Object.keys(CLOUD_DEFAULTS),LIGHT_KEYS=['probe','bounce','grid',...Object.keys(SKY_LIGHT_DEFAULTS)],SEA_KEYS=['height','model','towers',...Object.keys(CLOUD_SEA_DEFAULTS)],CUMULUS_KEYS=['toward',...Object.keys(CUMULUS_DEFAULTS)];
const HEX=/^#[0-9a-f]{6}$/i;
const fail=message=>{throw new Error(message);};
const finite=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(`${label} must be a number from ${min} to ${max}`);};
const record=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);};

export function validateSky(sky){
  record(sky,'environment sky');
  for(const key of Object.keys(sky))if(!SKY_KEYS.includes(key))fail(`Unknown environment sky field ${key}`);
  if(!HEX.test(sky.zenithColor??''))fail('sky zenithColor must be a #rrggbb colour');
  if(sky.horizonColor!==undefined&&!HEX.test(sky.horizonColor))fail('sky horizonColor must be a #rrggbb colour');
  if(sky.curve!==undefined)finite(sky.curve,.1,2,'sky curve');
  if(sky.sunDisc!==undefined)finite(sky.sunDisc,0,2,'sky sunDisc');
  if(sky.cloudLight!==undefined&&!HEX.test(sky.cloudLight))fail('sky cloudLight must be a #rrggbb colour');
  if(sky.radiance!==undefined&&!SKY_RADIANCE.includes(sky.radiance))fail(`sky radiance must be one of ${SKY_RADIANCE.join(', ')}`);
  if(sky.clouds!==undefined){
    const c=sky.clouds;record(c,'sky clouds');
    for(const key of Object.keys(c))if(!CLOUD_KEYS.includes(key))fail(`Unknown sky clouds field ${key}`);
    for(const key of ['coverage','density','height'])if(c[key]!==undefined)finite(c[key],0,1,`clouds ${key}`);
    if(c.scale!==undefined)finite(c.scale,.25,4,'clouds scale');
    if(c.drift!==undefined){if(!Array.isArray(c.drift)||c.drift.length!==2)fail('clouds drift must be [x,z] metres per second');c.drift.forEach(v=>finite(v,-5,5,'clouds drift'));}
  }
  if(sky.light!==undefined){
    record(sky.light,'sky light');
    for(const key of Object.keys(sky.light))if(!LIGHT_KEYS.includes(key))fail(`Unknown sky light field ${key}`);
    if(sky.light.intensity!==undefined)finite(sky.light.intensity,0,3,'sky light intensity');
    if(sky.light.probe!==undefined){if(!Array.isArray(sky.light.probe)||sky.light.probe.length!==3)fail('sky light probe must be [x,y,z] metres');sky.light.probe.forEach(v=>finite(v,-1000,1000,'sky light probe'));}
    if(sky.light.bounce!==undefined){
      const b=sky.light.bounce;record(b,'sky light bounce');
      for(const key of Object.keys(b))if(!['color','intensity'].includes(key))fail(`Unknown sky light bounce field ${key}`);
      if(!HEX.test(b.color??''))fail('sky light bounce color must be a #rrggbb colour');
      finite(b.intensity,0,2,'sky light bounce intensity');
    }
    if(sky.light.grid!==undefined){
      const g=sky.light.grid;record(g,'sky light grid');
      for(const key of Object.keys(g))if(!GRID_KEYS.includes(key))fail(`Unknown sky light grid field ${key}`);
      for(const key of ['min','max']){if(!Array.isArray(g[key])||g[key].length!==3)fail(`sky light grid ${key} must be [x,y,z] metres`);g[key].forEach(v=>finite(v,-2000,2000,`sky light grid ${key}`));}
      if(g.min.some((v,i)=>v>=g.max[i]))fail('sky light grid min must be below max on every axis');
      if(g.spacing!==undefined)finite(g.spacing,2,50,'sky light grid spacing');
      if(g.bounces!==undefined&&![0,1,2].includes(g.bounces))fail('sky light grid bounces must be 0, 1 or 2');
      if(g.intensity!==undefined)finite(g.intensity,0,3,'sky light grid intensity');
      const probes=gridResolution({...GRID_DEFAULTS,...g}).reduce((a,b)=>a*b,1);
      if(probes>MAX_GRID_PROBES)fail(`sky light grid holds ${probes} probes; at most ${MAX_GRID_PROBES} (raise spacing or shrink the box)`);
    }
  }
  if(sky.cloudSea!==undefined){
    const s=sky.cloudSea;record(s,'sky cloudSea');
    for(const key of Object.keys(s))if(!SEA_KEYS.includes(key))fail(`Unknown sky cloudSea field ${key}`);
    finite(s.height,-1000,1000,'cloudSea height');
    if(s.coverage!==undefined)finite(s.coverage,0,1,'cloudSea coverage');
    if(s.scale!==undefined)finite(s.scale,.25,4,'cloudSea scale');
    if(s.drift!==undefined){if(!Array.isArray(s.drift)||s.drift.length!==2)fail('cloudSea drift must be [x,z] metres per second');s.drift.forEach(v=>finite(v,-5,5,'cloudSea drift'));}
    if(s.contrast!==undefined)finite(s.contrast,0,1,'cloudSea contrast');
    if(s.haze!==undefined)finite(s.haze,.02,1,'cloudSea haze');
    if(s.model!==undefined&&!CLOUD_SEA_MODELS.includes(s.model))fail(`cloudSea model must be one of ${CLOUD_SEA_MODELS.join(', ')}`);
    if(s.towers!==undefined){finite(s.towers,0,1,'cloudSea towers');if(s.model!=='cumulus')fail('cloudSea towers needs model cumulus');}
  }
  if(sky.cumulus!==undefined){
    if(Array.isArray(sky.cumulus)&&(sky.cumulus.length<1||sky.cumulus.length>MAX_CUMULUS_BANKS))fail(`sky cumulus must be one bank or a list of 1 to ${MAX_CUMULUS_BANKS}`);
    for(const c of [].concat(sky.cumulus)){record(c,'sky cumulus');
    for(const key of Object.keys(c))if(!CUMULUS_KEYS.includes(key))fail(`Unknown sky cumulus field ${key}`);
    if(!Array.isArray(c.toward)||c.toward.length!==2)fail('cumulus toward must be a horizontal direction [x,z]');
    c.toward.forEach(v=>finite(v,-1000,1000,'cumulus toward'));if(Math.hypot(...c.toward)<1e-6)fail('cumulus toward must not be [0,0]');
    if(c.spread!==undefined)finite(c.spread,3,90,'cumulus spread');
    if(c.height!==undefined)finite(c.height,2,45,'cumulus height');
    if(c.scale!==undefined)finite(c.scale,.25,4,'cumulus scale');
  }}
  return sky;
}

export function resolveSky(environment){
  const sky=environment.sky;if(!sky)return null;
  return {...SKY_DEFAULTS,...sky,horizonColor:sky.horizonColor??environment.fogColor,cloudLight:sky.cloudLight??environment.sunColor,clouds:sky.clouds?{...CLOUD_DEFAULTS,...sky.clouds}:null,
    light:sky.light?{...SKY_LIGHT_DEFAULTS,...sky.light}:null,cloudSea:sky.cloudSea?{...CLOUD_SEA_DEFAULTS,...sky.cloudSea}:null,
    cumulus:sky.cumulus?[].concat(sky.cumulus).map(bank=>({...CUMULUS_DEFAULTS,...bank})):null};
}

// Metres along a view ray from a camera at cameraY to the cloud deck, or
// Infinity when the ray never meets it (level or rising, or the camera is under it).
export function cloudSeaReach(cameraY,height,directionY){
  if(!(directionY<0)||!(cameraY>height))return Infinity;
  return (cameraY-height)/-directionY;
}

// Linear sky colour at an elevation (sine of the angle above the horizon),
// before sun and clouds. The shader in landscape.jsx uses the same curve.
export function skyGradient(resolved,elevation){
  const t=Math.max(0,Math.min(1,elevation))**resolved.curve,h=linearHex(resolved.horizonColor),z=linearHex(resolved.zenithColor);
  return h.map((v,i)=>v+(z[i]-v)*t);
}
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// The dome's colour before sun and clouds: the gradient above the horizon,
// blending to the fog colour just below it. The shader matches this.
export function skyBase(resolved,fogColor,elevation){
  const g=skyGradient(resolved,elevation),f=linearHex(fogColor),k=smoothstep(0,BELOW_HORIZON,-elevation);
  return g.map((v,i)=>v+(f[i]-v)*k);
}
// Cloud opacity factor by elevation: zero up to the plane floor (scaled by
// cloud height as in the shader), then rising over the authored horizon band.
export function cloudHorizonFade(height,elevation){
  const start=CLOUD_FLOOR/(1-.9*height);
  return smoothstep(start,start+.03+.06*height,elevation);
}
