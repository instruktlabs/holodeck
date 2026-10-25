// Optional schema-v2 lighting. Resolve defaults without rewriting saved worlds.
export const HEMISPHERE_DEFAULTS=Object.freeze({skyColor:'#f1eee2',groundColor:'#95806d',intensity:1.8});
export const DEFAULT_EXPOSURE=1.12;
const finite=(value,min,max,label)=>{if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be a number from ${min} to ${max}`);};

export function validateLighting(environment){
 const h=environment.hemisphere;
 if(h!==undefined){
  if(!h||typeof h!=='object'||Array.isArray(h))throw new Error('environment hemisphere must be an object');
  for(const key of Object.keys(h))if(!Object.hasOwn(HEMISPHERE_DEFAULTS,key))throw new Error(`Unknown hemisphere field ${key}`);
  for(const key of ['skyColor','groundColor'])if(h[key]!==undefined&&(typeof h[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(h[key])))throw new Error(`hemisphere ${key} must be a #rrggbb colour`);
  if(h.intensity!==undefined)finite(h.intensity,0,8,'hemisphere intensity');
 }
 if(environment.exposure!==undefined)finite(environment.exposure,.1,4,'environment exposure');
 return environment;
}

// grade.exposure is the legacy home of exposure (see grade.mjs).
export function resolveLighting(environment){
 const h=environment.hemisphere;
 return {hemisphere:{skyColor:h?.skyColor??HEMISPHERE_DEFAULTS.skyColor,groundColor:h?.groundColor??HEMISPHERE_DEFAULTS.groundColor,intensity:h?.intensity??HEMISPHERE_DEFAULTS.intensity},exposure:environment.exposure??environment.grade?.exposure??DEFAULT_EXPOSURE};
}

// Exposure belongs to the renderer, not the scene. Release it on replacement or
// unmount so a later default/legacy scene cannot inherit another world's value.
export function applySceneExposure(renderer,exposure){
 const previous=renderer.toneMappingExposure;
 renderer.toneMappingExposure=exposure;
 return()=>{renderer.toneMappingExposure=previous;};
}
