// Authored sky (H23): a horizon-to-zenith gradient, a sun disc and optional
// procedural clouds. Without environment.sky the analytic daylight dome stays.
// horizonColor defaults to fogColor so the distant fog meets the sky.
import {linearHex} from './water-optics.mjs';

export const SKY_DEFAULTS={curve:.45,sunDisc:1};
export const CLOUD_DEFAULTS={coverage:.35,density:.5,height:.5,scale:1,drift:[.6,.2]};
// Below the horizon the dome turns to the fog colour over this much elevation:
// a finite ocean seen from above ends in fully fogged water, which is fogColor,
// so the dome past its edge must match it rather than the horizon colour.
export const BELOW_HORIZON=.02;
// The cloud plane divides by elevation, floored here; under the floor clouds
// smear into vertical streaks, so they fade in only above it.
export const CLOUD_FLOOR=.02;
const SKY_KEYS=['zenithColor','horizonColor','curve','sunDisc','clouds'],CLOUD_KEYS=Object.keys(CLOUD_DEFAULTS);
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
  if(sky.clouds!==undefined){
    const c=sky.clouds;record(c,'sky clouds');
    for(const key of Object.keys(c))if(!CLOUD_KEYS.includes(key))fail(`Unknown sky clouds field ${key}`);
    for(const key of ['coverage','density','height'])if(c[key]!==undefined)finite(c[key],0,1,`clouds ${key}`);
    if(c.scale!==undefined)finite(c.scale,.25,4,'clouds scale');
    if(c.drift!==undefined){if(!Array.isArray(c.drift)||c.drift.length!==2)fail('clouds drift must be [x,z] metres per second');c.drift.forEach(v=>finite(v,-5,5,'clouds drift'));}
  }
  return sky;
}

export function resolveSky(environment){
  const sky=environment.sky;if(!sky)return null;
  return {...SKY_DEFAULTS,...sky,horizonColor:sky.horizonColor??environment.fogColor,clouds:sky.clouds?{...CLOUD_DEFAULTS,...sky.clouds}:null};
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
