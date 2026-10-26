// environment.effects (H83): opt-in screen-space passes for a world, all off by
// default. occlusion is ground-truth ambient occlusion (GTAO) from the scene's
// depth and normals; temporalAA replaces multisampling with temporal
// reprojection anti-aliasing (TRAA), which settles sub-pixel detail that
// shimmers; sunShafts raymarches the sun's shadow map for light shafts (needs
// the sun's shadows, so it shows within the shadow box); bloom tunes the glow every
// world has (strength, radius, and the linear luminance it starts from, before tone
// mapping). GTAO reads the depth of
// a single-sampled pass (with multisampling it finds almost nothing), so
// occlusion brings temporalAA with it. Kept free of three so the server can
// validate worlds with it.
export const EFFECT_DEFAULTS=Object.freeze({occlusion:{intensity:.7,radius:3},sunShafts:{intensity:.5},bloom:{strength:.13,radius:.25,threshold:1.8}});
const fail=message=>{throw new Error(message);};
const object=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);};
const keys=(value,allowed,label)=>{for(const key of Object.keys(value))if(!allowed.includes(key))fail(`Unknown ${label} field ${key}`);};
const finite=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`${label} must be ${min}–${max}`);};
export function validateEffects(effects){
 object(effects,'Effects');keys(effects,['occlusion','temporalAA','sunShafts','bloom'],'effects');
 if(effects.occlusion!==undefined){const o=effects.occlusion;object(o,'Effects occlusion');keys(o,['intensity','radius'],'occlusion');if(o.intensity!==undefined)finite(o.intensity,0,1,'Occlusion intensity');if(o.radius!==undefined)finite(o.radius,.1,10,'Occlusion radius');}
 if(effects.temporalAA!==undefined&&typeof effects.temporalAA!=='boolean')fail('temporalAA must be a boolean');
 if(effects.sunShafts!==undefined){const s=effects.sunShafts;object(s,'Effects sunShafts');keys(s,['intensity'],'sunShafts');if(s.intensity!==undefined)finite(s.intensity,0,2,'Sun shafts intensity');}
 if(effects.bloom!==undefined){const b=effects.bloom;object(b,'Effects bloom');keys(b,['strength','radius','threshold'],'bloom');if(b.strength!==undefined)finite(b.strength,0,1,'Bloom strength');if(b.radius!==undefined)finite(b.radius,0,1,'Bloom radius');if(b.threshold!==undefined)finite(b.threshold,0,10,'Bloom threshold');}
 return effects;
}
export function resolveEffects(effects){
 const bloom={...EFFECT_DEFAULTS.bloom,...effects?.bloom};
 if(!effects)return {occlusion:null,temporalAA:false,sunShafts:null,bloom};
 return {occlusion:effects.occlusion?{...EFFECT_DEFAULTS.occlusion,...effects.occlusion}:null,temporalAA:effects.temporalAA===true||!!effects.occlusion,sunShafts:effects.sunShafts?{...EFFECT_DEFAULTS.sunShafts,...effects.sunShafts}:null,bloom};
}
