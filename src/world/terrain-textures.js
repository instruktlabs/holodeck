// Browser-only: decodes pinned terrain PNGs to RGBA bytes for the layer texture
// arrays and the mask texture. Colour values stay as authored (no colour space
// conversion or alpha premultiplication); the material decides sRGB or linear.
const cache=new Map();
async function decode(url,signal){
 const response=await fetch(url,{signal});if(!response.ok)throw new Error('A terrain texture could not be loaded.');
 const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
 try{
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(bitmap,0,0);
  return {width:bitmap.width,height:bitmap.height,data:new Uint8Array(context.getImageData(0,0,bitmap.width,bitmap.height).data.buffer)};
 }finally{bitmap.close();}
}
// entries: {file:{url,...}}. Pinned URLs name their content hash, so decoded
// images are reused across revisions; ones no longer listed are released.
export async function loadTerrainTextures(entries={},{signal}={}){
 const wanted=new Set(Object.values(entries).map(entry=>entry.url));
 for(const url of cache.keys())if(!wanted.has(url))cache.delete(url);
 const result={};
 await Promise.all(Object.entries(entries).map(async([file,entry])=>{
  if(!cache.has(entry.url))cache.set(entry.url,decode(entry.url,signal).catch(error=>{cache.delete(entry.url);throw error;}));
  result[file]=await cache.get(entry.url);
 }));
 return result;
}
