// environment.shadow (H75): the half-width in metres of the sun's shadow box,
// which follows the walker or the view. Kept free of three so the server can
// validate worlds with it.
export const SHADOW_EXTENT={min:12,max:120,default:24};
export function validateShadow(shadow){
 if(!shadow||typeof shadow!=='object'||Array.isArray(shadow))throw new Error('Shadow must be an object');
 for(const key of Object.keys(shadow))if(key!=='extent')throw new Error(`Unknown shadow field ${key}`);
 if(shadow.extent!==undefined&&(!Number.isFinite(shadow.extent)||shadow.extent<SHADOW_EXTENT.min||shadow.extent>SHADOW_EXTENT.max))throw new Error(`Shadow extent must be ${SHADOW_EXTENT.min}–${SHADOW_EXTENT.max} m`);
 return shadow;
}
