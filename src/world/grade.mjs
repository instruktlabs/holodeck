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
 if(grade.exposure!==undefined)throw new Error('Set exposure with environment.exposure, not environment.grade');
 for(const key of Object.keys(grade))if(key!=='toneMapping')throw new Error(`Unknown grade field ${key}`);
 if(grade.toneMapping!==undefined&&!TONE_MAPPINGS.includes(grade.toneMapping))throw new Error(`Grade toneMapping must be one of ${TONE_MAPPINGS.join(', ')}`);
 return grade;
}
export function resolveGrade(environment){return {...GRADE_DEFAULTS,...(environment?.grade??{})};}
