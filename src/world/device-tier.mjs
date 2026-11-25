// Device quality tiering for Holodeck scenes (high / medium / low).
// Scales fillrate-heavy knobs (DPR ceiling, shadow map size, planar mirror
// resolution or probe fallback, and screen-space post-effects) to keep mid-
// and low-tier GPUs smooth while preserving exact authored settings on high
// tier and during ?benchmark=1 sessions.

export const QUALITY_TIERS=Object.freeze({
 high:Object.freeze({
  id:'high',
  label:'High',
  dpr:[1,1.5],
  shadowMapSize:2048,
  mirrorResolutionScale:0.5,
  planarMirror:true,
  allowOcclusion:true,
  allowSunShafts:true,
  allowProbeGrid:true,
  bloomScale:0.5,
 }),
 medium:Object.freeze({
  id:'medium',
  label:'Medium',
  dpr:[1,1.25],
  shadowMapSize:1024,
  mirrorResolutionScale:0.35,
  planarMirror:true,
  allowOcclusion:false,
  allowSunShafts:false,
  allowProbeGrid:true,
  bloomScale:0.5,
 }),
 low:Object.freeze({
  id:'low',
  label:'Low',
  dpr:[1,1],
  shadowMapSize:1024,
  mirrorResolutionScale:0.25,
  planarMirror:false,
  allowOcclusion:false,
  allowSunShafts:false,
  allowProbeGrid:false,
  bloomScale:0.25,
 }),
});

export const TIER_ORDER=Object.freeze(['high','medium','low']);

const LOW_GPU_RE=/swiftshader|llvmpipe|software|basic render|microsoft basic|warp|mali-4|mali-t|adreno\s*[345]\d\d|powervr|intel.*hd graphics|uhd graphics\s*[6]\d\d/i;
const MID_GPU_RE=/gtx\s*(?:9\d\d|10[56]\d|16[356]\d)|rtx\s*(?:2050|3050)|mx\d\d\d|intel.*(?:iris|uhd|arc a3)|radeon.*(?:vega|rx\s*5[56]0|rx\s*6[45]00)|mali-g|adreno\s*[67]\d\d|max-q/i;
const HIGH_GPU_RE=/rtx\s*(?:20[678]\d|30[6789]\d|40\d\d|50\d\d)|rx\s*(?:6[789]\d\d|7[789]\d\d|90\d\d)|apple m[1-9]|quadro rtx|rtx a[2-6]000/i;
const PHONE_UA_RE=/iphone|ipod|android.*mobile|windows phone|mobile safari/i;

export function parseQualityOverride(search=''){
 try{
  const raw=new URLSearchParams(search).get('quality')?.trim().toLowerCase();
  return raw&&QUALITY_TIERS[raw]?QUALITY_TIERS[raw]:null;
 }catch{return null;}
}

export function rendererIdentityText({adapter,renderer}={}){
 const parts=[];
 if(typeof renderer==='string'&&renderer.trim())parts.push(renderer.trim());
 if(adapter&&typeof adapter==='object'){
  for(const k of ['vendor','architecture','device','description']){
   if(typeof adapter[k]==='string'&&adapter[k].trim())parts.push(adapter[k].trim());
  }
 }
 return parts.join(' ');
}

export function detectDeviceTier({
 search='',
 benchmark=false,
 coarsePointer=false,
 screenWidth=1920,
 screenHeight=1080,
 hardwareConcurrency=8,
 deviceMemory=8,
 userAgent='',
 adapter=null,
 renderer='',
 forcedWebGL=false,
}={}){
 if(benchmark)return QUALITY_TIERS.high;
 const forced=parseQualityOverride(search);
 if(forced)return forced;

 const gpuText=rendererIdentityText({adapter,renderer});
 const minDim=Math.min(Number(screenWidth)||1920,Number(screenHeight)||1080);
 const cores=Number(hardwareConcurrency)||0;
 const mem=Number(deviceMemory)||0;

 if(adapter?.isFallbackAdapter===true||LOW_GPU_RE.test(gpuText))return QUALITY_TIERS.low;
 if(PHONE_UA_RE.test(userAgent)||(coarsePointer&&minDim<=640))return QUALITY_TIERS.low;
 if((mem>0&&mem<=2)||(cores>0&&cores<=2))return QUALITY_TIERS.low;

 if(gpuText&&MID_GPU_RE.test(gpuText))return QUALITY_TIERS.medium;
 if(coarsePointer)return QUALITY_TIERS.medium;
 if((mem>0&&mem<=4)||(cores>0&&cores<=4))return QUALITY_TIERS.medium;
 if(gpuText&&HIGH_GPU_RE.test(gpuText))return QUALITY_TIERS.high;
 if(forcedWebGL&&!HIGH_GPU_RE.test(gpuText))return QUALITY_TIERS.medium;
 return QUALITY_TIERS.high;
}

export function browserDeviceSignals(search=typeof location!=='undefined'?location.search:''){
 const coarsePointer=typeof matchMedia==='function'?matchMedia('(pointer: coarse)').matches:false;
 const screenWidth=typeof screen!=='undefined'?screen.width:1920;
 const screenHeight=typeof screen!=='undefined'?screen.height:1080;
 const hardwareConcurrency=typeof navigator!=='undefined'?navigator.hardwareConcurrency:8;
 const deviceMemory=typeof navigator!=='undefined'?navigator.deviceMemory:undefined;
 const userAgent=typeof navigator!=='undefined'?navigator.userAgent:'';
 return {search,coarsePointer,screenWidth,screenHeight,hardwareConcurrency,deviceMemory,userAgent};
}

export function readRendererHardware(gl){
 const backend=gl?.backend,info=backend?.device?.adapterInfo,ctx=backend?.gl;
 const adapter=info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description,isFallbackAdapter:info.isFallbackAdapter}:null;
 let renderer='';
 if(ctx){
  try{
   const ext=ctx.getExtension('WEBGL_debug_renderer_info');
   renderer=String(ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER)||'');
  }catch{renderer='';}
 }
 return {adapter,renderer,forcedWebGL:!backend?.isWebGPUBackend};
}

export function applyQualityToEffects(effects,tier=QUALITY_TIERS.high){
 if(!effects||!tier||(tier.allowOcclusion&&tier.allowSunShafts))return effects;
 const next={...effects};
 if(!tier.allowOcclusion)delete next.occlusion;
 if(!tier.allowSunShafts)delete next.sunShafts;
 return next;
}

export function applyQualityToWater(water,tier=QUALITY_TIERS.high){
 if(!water||!tier)return water;
 const next={...water};
 if(next.reflection==='planar'){
  if(!tier.planarMirror)delete next.reflection;
  else next.mirrorResolutionScale=tier.mirrorResolutionScale;
 }
 return next;
}

export function applyQualityToShadow(shadowConfig,tier=QUALITY_TIERS.high){
 if(!shadowConfig||!tier||shadowConfig.mapSize<=tier.shadowMapSize)return shadowConfig;
 return Object.freeze({...shadowConfig,mapSize:tier.shadowMapSize});
}

export function applyQualityToEnvironment(environment,tier=QUALITY_TIERS.high){
 if(!environment||!tier||tier.allowProbeGrid!==false||!environment.sky?.light?.grid)return environment;
 const light={...environment.sky.light};
 delete light.grid;
 return {...environment,sky:{...environment.sky,light}};
}
