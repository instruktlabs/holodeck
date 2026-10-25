// Aerial perspective (H124): environment.aerial replaces the smoothstep range fog with
// clear-air haze. Light from a surface d metres away reaches the eye attenuated per
// colour channel by T = exp(-τ), and the air in between adds its own light, (1 - T) times
// the air colour (fogColor, or the sky behind each surface with fogSky) plus a forward-
// scatter glow toward the sun. τ = β·d·ρ̄: β = 3.912/visibility (Koschmieder: contrast
// falls to 2% over the visibility in air at the haze base), and ρ̄ is the mean density
// along the ray, which falls by e every `falloff` metres above `base`. Blue scatters more
// than red, so shaded faces lift toward the blue air while sunlit faces keep their warmth,
// and since T never reaches 0, a far form fades but never vanishes.
export const AERIAL_DEFAULTS=Object.freeze({base:0,falloff:600,blue:.35,glow:1});
const AERIAL_KEYS=['visibility',...Object.keys(AERIAL_DEFAULTS)];
// Koschmieder's constant: -ln(0.02).
export const KOSCHMIEDER=3.912;
// Henyey-Greenstein asymmetry of the forward-scatter glow (hazy air).
export const AERIAL_GLOW_G=.76;
// Optical depths beyond this along a ray are treated as opaque air; keeps exp in range.
const MAX_SLOPE_TERM=60;
const fail=message=>{throw new Error(message);};
const finite=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(`${label} must be a number from ${min} to ${max}`);};

export function validateAerial(aerial){
  if(!aerial||typeof aerial!=='object'||Array.isArray(aerial))fail('environment aerial must be an object');
  for(const key of Object.keys(aerial))if(!AERIAL_KEYS.includes(key))fail(`Unknown environment aerial field ${key}`);
  finite(aerial.visibility,200,200000,'aerial visibility');
  if(aerial.base!==undefined)finite(aerial.base,-10000,10000,'aerial base');
  if(aerial.falloff!==undefined)finite(aerial.falloff,10,20000,'aerial falloff');
  if(aerial.blue!==undefined)finite(aerial.blue,0,1,'aerial blue');
  if(aerial.glow!==undefined)finite(aerial.glow,0,4,'aerial glow');
  return aerial;
}
export function resolveAerial(environment){
  const aerial=environment?.aerial;return aerial?{...AERIAL_DEFAULTS,...aerial}:null;
}
// Extinction per channel relative to green: grey haze at blue 0, toward Rayleigh air
// (λ⁻⁴ for 680, 550 and 450 nm) at blue 1.
export function aerialWeights(blue){return [1-.57*blue,1,1+1.2*blue];}
// The mean of exp(-k·s) over s in [0, 1], (1 - e^-k)/k, with its limit 1 - k/2 near k = 0.
export function meanDensity(k){
  const c=Math.max(-MAX_SLOPE_TERM,Math.min(MAX_SLOPE_TERM,k));
  return Math.abs(c)<1e-3?1-c/2:(1-Math.exp(-c))/c;
}
// Optical depth (green) from a camera at height cameraY along a unit direction with
// vertical component directionY, over distance metres.
export function aerialDepth(aerial,cameraY,directionY,distance){
  const a={...AERIAL_DEFAULTS,...aerial},beta=KOSCHMIEDER/a.visibility;
  return beta*distance*Math.exp(-(cameraY-a.base)/a.falloff)*meanDensity(distance*directionY/a.falloff);
}
// Transmittance [r,g,b] along that ray.
export function aerialTransmittance(aerial,cameraY,directionY,distance){
  const tau=aerialDepth(aerial,cameraY,directionY,distance);
  return aerialWeights({...AERIAL_DEFAULTS,...aerial}.blue).map(w=>Math.exp(-tau*w));
}
// Unnormalised Henyey-Greenstein lobe of the glow, scaled so the haze toward the sun
// carries 1.5 times the sun colour and a quarter turn away almost none.
export function aerialGlowLobe(cosine,g=AERIAL_GLOW_G){
  return .05*(1-g*g)/Math.pow(1+g*g-2*g*cosine,1.5);
}
