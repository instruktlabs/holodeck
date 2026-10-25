// Authored sky (H23): a horizon-to-zenith gradient, a sun disc and optional
// procedural clouds. Without environment.sky the analytic daylight dome stays.
// horizonColor defaults to fogColor so the distant fog meets the sky.
import {linearHex} from './water-optics.mjs';

export const SKY_DEFAULTS={curve:.45,sunDisc:1};
// Clouds, the cumulus bank and the cloud deck are lit in cloudLight, sunColor unless
// set: a whiter cloudLight keeps a golden sun on the stone and off the clouds (H109).
export const CLOUD_DEFAULTS={coverage:.35,density:.5,height:.5,scale:1,drift:[.6,.2]};
// Sky light: the dome is captured once into an environment map that lit
// materials reflect and are lit by, in place of the fixed hemisphere fill.
// A single unoccluded probe overfills shadowed faces, hence less than 1.
export const SKY_LIGHT_DEFAULTS={intensity:.6};
// A sunlit deck of cloud at a world height, seen below the horizon from above it.
// contrast scales the light and shade across the billows (.5 is the H81 look,
// 1 sinks the shaded sides to sky-lit lavender); haze is the ray elevation below
// which the deck dissolves into the horizon haze (H103).
export const CLOUD_SEA_DEFAULTS={coverage:.8,scale:1,drift:[1,.3],contrast:.5,haze:.3};
// Below this ray elevation the deck dissolves into the horizon haze; wide enough
// that the deck and the sky meet in haze rather than at a line (H74).
export const CLOUD_SEA_HAZE=.3;
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
const SKY_KEYS=['zenithColor','horizonColor','curve','sunDisc','cloudLight','clouds','light','cloudSea','cumulus'],CLOUD_KEYS=Object.keys(CLOUD_DEFAULTS),LIGHT_KEYS=['probe','bounce',...Object.keys(SKY_LIGHT_DEFAULTS)],SEA_KEYS=['height',...Object.keys(CLOUD_SEA_DEFAULTS)],CUMULUS_KEYS=['toward',...Object.keys(CUMULUS_DEFAULTS)];
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
