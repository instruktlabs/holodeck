// What the viewer does about a renderer that can't serve a visitor. A benchmark uses none of it: it reports what it was given.
const newCanvas=()=>document.createElement('canvas');
const hasWebGL2=createCanvas=>{try{return !!createCanvas().getContext('webgl2');}catch{return false;}};

// A software adapter draws a few frames every several seconds, where WebGL2 usually runs well. This has to be settled before Three touches
// the canvas, which only ever holds one kind of context, and with the options Three asks with, so give it the powerPreference the renderer
// gets and this is the adapter Three would get. Browsers before GPUAdapterInfo had the flag report it on the adapter. A browser that doesn't
// report it stays on what it was given, and one with no WebGL2 either keeps the slow path, the only one that draws.
export async function avoidSoftwareWebGPU({powerPreference,gpu=globalThis.navigator?.gpu,createCanvas=newCanvas}={}){
 try{
  const adapter=await gpu?.requestAdapter({powerPreference,featureLevel:'compatibility'});
  return (adapter?.info?.isFallbackAdapter??adapter?.isFallbackAdapter)===true&&hasWebGL2(createCanvas);
 }catch{return false;}
}
