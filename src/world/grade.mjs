// environment.grade (H77): how scene light becomes display colour. Every world
// otherwise renders with ACES at exposure 1.12, which compresses sunlit white
// toward grey (about 0.87 at the top of a bright scene), shifts warm highlights
// toward pink and desaturates blues. 'neutral' (Khronos PBR Neutral) keeps hue
// and saturation and lets sunlit white reach white; 'agx' rolls highlights off
// filmically toward white. Kept free of three so the server can validate it.
export const GRADE_DEFAULTS=Object.freeze({toneMapping:'aces',exposure:1.12});
export const TONE_MAPPINGS=['aces','neutral','agx'];
export function validateGrade(grade){
 if(!grade||typeof grade!=='object'||Array.isArray(grade))throw new Error('Grade must be an object');
 for(const key of Object.keys(grade))if(!['toneMapping','exposure'].includes(key))throw new Error(`Unknown grade field ${key}`);
 if(grade.toneMapping!==undefined&&!TONE_MAPPINGS.includes(grade.toneMapping))throw new Error(`Grade toneMapping must be one of ${TONE_MAPPINGS.join(', ')}`);
 if(grade.exposure!==undefined&&(typeof grade.exposure!=='number'||!Number.isFinite(grade.exposure)||grade.exposure<.5||grade.exposure>2))throw new Error('Grade exposure must be 0.5–2');
 return grade;
}
export function resolveGrade(environment){return {...GRADE_DEFAULTS,...(environment?.grade??{})};}
