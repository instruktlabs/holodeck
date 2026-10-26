// environment.grade (H77): how scene light becomes display colour. Every world
// otherwise renders with ACES, which at the default exposure compresses sunlit white
// toward grey (about 0.87 at the top of a bright scene), shifts warm highlights
// toward pink and desaturates blues. 'neutral' (Khronos PBR Neutral) keeps hue
// and saturation and lets sunlit white reach white; 'agx' rolls highlights off
// filmically toward white. Kept free of three so the server can validate it.
// Exposure is environment.exposure (lighting.mjs); the grade only picks the curve.
export const GRADE_DEFAULTS=Object.freeze({toneMapping:'aces'});
export const TONE_MAPPINGS=['aces','neutral','agx'];
// grade.highlights (H126, neutral only): how strongly the Neutral curve desaturates what
// it compresses. Khronos fixes it at 0.15, so a warm highlight such as sunlit golden
// stone keeps its hue all the way up and reaches white only at extreme inputs (L* 99 at
// about 38 times its mid-tone input). Raising it lets bright warm light roll to white
// (L* 99 near 8.6 at 1, 5.9 at 2) while mid-tones below the compression start are untouched.
export const NEUTRAL_DESATURATION=.15,NEUTRAL_START=.76;
export function validateGrade(grade){
 if(!grade||typeof grade!=='object'||Array.isArray(grade))throw new Error('Grade must be an object');
 // Legacy: revisions saved before environment.exposure (the marble sanctuary's) set
 // exposure here. They still read, so history and undo keep working; new worlds use
 // environment.exposure, and a world may not set both (contract.mjs).
 for(const key of Object.keys(grade))if(!['toneMapping','exposure','highlights'].includes(key))throw new Error(`Unknown grade field ${key}`);
 if(grade.exposure!==undefined&&(typeof grade.exposure!=='number'||!Number.isFinite(grade.exposure)||grade.exposure<.5||grade.exposure>2))throw new Error('Grade exposure must be 0.5–2');
 if(grade.toneMapping!==undefined&&!TONE_MAPPINGS.includes(grade.toneMapping))throw new Error(`Grade toneMapping must be one of ${TONE_MAPPINGS.join(', ')}`);
 if(grade.highlights!==undefined){
  if(typeof grade.highlights!=='number'||!Number.isFinite(grade.highlights)||grade.highlights<0||grade.highlights>3)throw new Error('Grade highlights must be 0–3');
  if(grade.toneMapping!=='neutral')throw new Error('Grade highlights needs toneMapping neutral');
 }
 return grade;
}
export function resolveGrade(environment){const grade=environment?.grade;return {toneMapping:grade?.toneMapping??GRADE_DEFAULTS.toneMapping,highlights:grade?.toneMapping==='neutral'?grade.highlights??null:null};}
// The Neutral curve with a chosen highlight desaturation, on linear RGB after exposure,
// as three's neutralToneMapping computes it (the shader in effects.jsx matches).
export function neutralTone([r,g,b],desaturation=NEUTRAL_DESATURATION){
 const x=Math.min(r,g,b),offset=x<.08?x-6.25*x*x:.04;let c=[r-offset,g-offset,b-offset];const peak=Math.max(...c);
 if(peak<NEUTRAL_START)return c;
 const d=1-NEUTRAL_START,newPeak=1-d*d/(peak+d-NEUTRAL_START);c=c.map(v=>v*newPeak/peak);
 const k=1-1/(desaturation*(peak-newPeak)+1);return c.map(v=>v*(1-k)+newPeak*k);
}
