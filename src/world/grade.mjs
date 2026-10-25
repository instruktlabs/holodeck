// environment.grade (H77): how scene light becomes display colour. Every world
// otherwise renders with ACES, which at the default exposure compresses sunlit white
// toward grey (about 0.87 at the top of a bright scene), shifts warm highlights
// toward pink and desaturates blues. 'neutral' (Khronos PBR Neutral) keeps hue
// and saturation and lets sunlit white reach white; 'agx' rolls highlights off
// filmically toward white. Kept free of three so the server can validate it.
// Exposure is environment.exposure (lighting.mjs); the grade only picks the curve.
export const GRADE_DEFAULTS=Object.freeze({toneMapping:'aces'});
export const TONE_MAPPINGS=['aces','neutral','agx'];
export function validateGrade(grade){
 if(!grade||typeof grade!=='object'||Array.isArray(grade))throw new Error('Grade must be an object');
 // Legacy: revisions saved before environment.exposure (the marble sanctuary's) set
 // exposure here. They still read, so history and undo keep working; new worlds use
 // environment.exposure, and a world may not set both (contract.mjs).
 for(const key of Object.keys(grade))if(!['toneMapping','exposure'].includes(key))throw new Error(`Unknown grade field ${key}`);
 if(grade.exposure!==undefined&&(typeof grade.exposure!=='number'||!Number.isFinite(grade.exposure)||grade.exposure<.5||grade.exposure>2))throw new Error('Grade exposure must be 0.5–2');
 if(grade.toneMapping!==undefined&&!TONE_MAPPINGS.includes(grade.toneMapping))throw new Error(`Grade toneMapping must be one of ${TONE_MAPPINGS.join(', ')}`);
 return grade;
}
export function resolveGrade(environment){return {toneMapping:environment?.grade?.toneMapping??GRADE_DEFAULTS.toneMapping};}
