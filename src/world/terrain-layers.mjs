// Terrain material layers: authored records, mask maths and PNG admission.
// appearance.layers=[{id, maps:{albedo,normal,roughness?}, scale?, projection?,
// strength?, tint?, mask?:{height?:[min,max,fade], slope?:[minDeg,maxDeg,fade],
// water?:[min,max,fade], near?:{assets?,scatters?,radius,fade?}, paint?}}].
// Layers draw in order over the eight base settings. Masks multiply; each band
// is 1 inside [min,max] and fades to 0 over `fade` outside it. Map files are PNG
// under assets/imports; the host pins their bytes by hash like GLBs. The shader
// in landscape.jsx mirrors bandWeight and slopeDegrees; tests cover both here.

export const TERRAIN_LAYER_LIMITS=Object.freeze({layers:4,mapSize:2048,maskSize:1024,textureBytes:32*1024*1024,nearRadius:100});
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const record=(value,keys,label)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key)),`Invalid ${label} fields`);
const finite=(value,min,max,label)=>assert(Number.isFinite(value)&&value>=min&&value<=max,`Invalid ${label}`);
export const pngPath=file=>typeof file==='string'&&/^assets\/imports\/[-a-zA-Z0-9_/.]+\.png$/.test(file)&&!file.split('/').some(p=>p==='..'||p==='.'||p==='');
const band=(value,min,max,label)=>{
 assert(Array.isArray(value)&&value.length===3,`Invalid ${label}: use [min,max,fade]`);
 finite(value[0],min,max,label);finite(value[1],min,max,label);finite(value[2],0,max-min,label);assert(value[0]<=value[1],`Invalid ${label}: minimum exceeds maximum`);
};
const ids=(value,label)=>{assert(Array.isArray(value)&&value.length>=1&&value.length<=64&&value.every(id=>typeof id==='string'&&/^[-\w]{1,64}$/.test(id)),`Invalid ${label}`);};

export function validateTerrainLayers(layers){
 assert(Array.isArray(layers)&&layers.length<=TERRAIN_LAYER_LIMITS.layers,`Terrain appearance allows at most ${TERRAIN_LAYER_LIMITS.layers} layers`);
 const seen=new Set();
 for(const layer of layers){
  record(layer,['id','maps','scale','projection','strength','tint','mask'],'terrain layer');
  assert(typeof layer.id==='string'&&/^[-\w]{1,64}$/.test(layer.id)&&!seen.has(layer.id),'Invalid or duplicate terrain layer ID');seen.add(layer.id);
  const label=`terrain layer ${layer.id}`;
  record(layer.maps,['albedo','normal','roughness'],`${label} maps`);
  for(const key of ['albedo','normal'])assert(pngPath(layer.maps[key]),`${label} needs a ${key} PNG inside assets/imports`);
  if(layer.maps.roughness!==undefined)assert(pngPath(layer.maps.roughness),`${label} roughness must be a PNG inside assets/imports`);
  if(layer.scale!==undefined)finite(layer.scale,.1,100,`${label} scale (metres per texture repeat)`);
  if(layer.projection!==undefined)assert(['planar','triplanar'].includes(layer.projection),`${label} projection must be planar or triplanar`);
  if(layer.strength!==undefined)finite(layer.strength,0,1,`${label} strength`);
  if(layer.tint!==undefined)assert(typeof layer.tint==='string'&&/^#[a-f0-9]{6}$/i.test(layer.tint),`Invalid ${label} tint`);
  if(layer.mask!==undefined){
   const m=layer.mask;record(m,['height','slope','water','near','paint'],`${label} mask`);
   if(m.height!==undefined)band(m.height,-1000,1000,`${label} height mask`);
   if(m.slope!==undefined)band(m.slope,0,90,`${label} slope mask (degrees)`);
   if(m.water!==undefined)band(m.water,-1000,1000,`${label} water mask`);
   if(m.near!==undefined){
    record(m.near,['assets','scatters','radius','fade'],`${label} near mask`);
    assert(m.near.assets!==undefined||m.near.scatters!==undefined,`${label} near mask needs assets or scatters`);
    if(m.near.assets!==undefined)ids(m.near.assets,`${label} near assets`);
    if(m.near.scatters!==undefined)ids(m.near.scatters,`${label} near scatters`);
    finite(m.near.radius,.01,TERRAIN_LAYER_LIMITS.nearRadius,`${label} near radius`);
    if(m.near.fade!==undefined)finite(m.near.fade,0,TERRAIN_LAYER_LIMITS.nearRadius,`${label} near fade`);
   }
   if(m.paint!==undefined)assert(pngPath(m.paint),`${label} paint mask must be a PNG inside assets/imports`);
  }
 }
 return layers;
}
// References that need the whole scene: placements, scatters and water.
export function validateTerrainLayerReferences(scene){
 const layers=scene.terrain?.appearance?.layers||[],assets=new Set((scene.assets||[]).map(a=>a.id)),scatters=new Set((scene.scatters||[]).map(s=>s.id));
 for(const layer of layers){
  const m=layer.mask||{};
  if(m.water)assert(scene.water,`Terrain layer ${layer.id} water mask requires scene.water`);
  for(const id of m.near?.assets||[])assert(assets.has(id),`Terrain layer ${layer.id} near mask names missing asset ${id}`);
  for(const id of m.near?.scatters||[])assert(scatters.has(id),`Terrain layer ${layer.id} near mask names missing scatter ${id}`);
 }
}
// Every PNG a terrain needs, each listed once, with how it is used.
export function terrainTextureFiles(terrain){
 const files=new Map();
 for(const layer of terrain?.appearance?.layers||[]){
  for(const key of ['albedo','normal','roughness'])if(layer.maps[key]&&!files.has(layer.maps[key]))files.set(layer.maps[key],'map');
  if(layer.mask?.paint)files.set(layer.mask.paint,files.get(layer.mask.paint)==='map'?'map':'paint');
 }
 return files;
}

// 1 inside [min,max]; smooth fall-off over `fade` beyond each end.
export function bandWeight(value,[min,max,fade]){
 const ramp=(edge0,edge1,x)=>{if(edge0===edge1)return x<edge0?0:1;const t=Math.max(0,Math.min(1,(x-edge0)/(edge1-edge0)));return t*t*(3-2*t);};
 return ramp(min-fade,min,value)*(1-ramp(max,max+fade,value));
}
export const slopeDegrees=normalY=>Math.acos(Math.max(-1,Math.min(1,normalY)))*180/Math.PI;
// The masks evaluated per fragment; near and paint arrive through the mask texture.
export function surfaceMask(layer,{height,normalY,waterLevel}){
 const m=layer.mask||{};let w=layer.strength??1;
 if(m.height)w*=bandWeight(height,m.height);
 if(m.slope)w*=bandWeight(slopeDegrees(normalY),m.slope);
 if(m.water)w*=bandWeight(height-waterLevel,m.water);
 return w;
}

// PNG admission: signature, IHDR size and an 8-bit or 16-bit image type.
export function pngInfo(bytes){
 const signature=[137,80,78,71,13,10,26,10];
 assert(bytes.length>=33&&signature.every((b,i)=>bytes[i]===b),'Terrain texture is not a PNG');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert(view.getUint32(8)===13&&String.fromCharCode(...bytes.subarray(12,16))==='IHDR','Terrain texture has no PNG header');
 const width=view.getUint32(16),height=view.getUint32(20),depth=bytes[24],type=bytes[25];
 assert(width>=1&&height>=1&&width<=TERRAIN_LAYER_LIMITS.mapSize&&height<=TERRAIN_LAYER_LIMITS.mapSize,`Terrain textures are limited to ${TERRAIN_LAYER_LIMITS.mapSize} pixels per side`);
 assert([0,2,3,4,6].includes(type)&&[1,2,4,8,16].includes(depth),'Unsupported PNG image type');
 return {width,height};
}
// Layer maps share one power-of-two size so they pack into texture arrays.
export function checkTerrainTextures(terrain,infos){
 const files=terrainTextureFiles(terrain);let size=null,bytes=0;
 for(const [file,use] of files){
  const info=infos[file];assert(info,`Terrain texture ${file} is missing`);bytes+=info.bytes;
  if(use!=='map')continue;
  assert(info.width===info.height&&(info.width&(info.width-1))===0,`Terrain map ${file} must be square with a power-of-two size`);
  if(size===null)size=info.width;assert(info.width===size,`Terrain maps must share one size; ${file} is ${info.width} pixels, others ${size}`);
 }
 assert(bytes<=TERRAIN_LAYER_LIMITS.textureBytes,'Terrain textures exceed 32 MiB of PNG files');
 return {size,bytes};
}

// One RGBA8 mask texture over the terrain bounds: channel i is layer i's near
// mask times its paint mask (255 where a layer uses neither). Placements are
// splatted into their own neighbourhood, so cost follows placements, not texels.
// paints: {file:{width,height,data:RGBA bytes}} sampled bilinearly from red;
// image columns run +x and rows run +z, row 0 at the terrain zmin edge.
export function rasterizeLayerMasks({terrain,placements=[],paints={},size=256}){
 const layers=terrain.appearance?.layers||[],[xmin,xmax,zmin,zmax]=terrain.bounds,data=new Uint8Array(size*size*4).fill(255);
 const cellX=(xmax-xmin)/size,cellZ=(zmax-zmin)/size;
 layers.forEach((layer,channel)=>{
  const near=layer.mask?.near,paint=layer.mask?.paint&&paints[layer.mask.paint];
  if(!near&&!paint)return;
  const weight=new Float32Array(size*size).fill(near?0:1);
  if(near){
   const assets=new Set(near.assets||[]),scatters=new Set(near.scatters||[]),fade=near.fade??0,reach=near.radius+fade;
   for(const p of placements){
    if(!assets.has(p.asset)&&!scatters.has(p.scatter))continue;
    const [x,,z]=p.position,i0=Math.max(0,Math.floor((x-reach-xmin)/cellX)),i1=Math.min(size-1,Math.floor((x+reach-xmin)/cellX)),j0=Math.max(0,Math.floor((z-reach-zmin)/cellZ)),j1=Math.min(size-1,Math.floor((z+reach-zmin)/cellZ));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
     const d=Math.hypot(xmin+(i+.5)*cellX-x,zmin+(j+.5)*cellZ-z),w=bandWeight(d,[0,near.radius,fade]),k=j*size+i;
     if(w>weight[k])weight[k]=w;
    }
   }
  }
  if(paint)for(let j=0;j<size;j++)for(let i=0;i<size;i++){
   const u=(i+.5)/size*paint.width-.5,v=(j+.5)/size*paint.height-.5,x0=Math.max(0,Math.floor(u)),y0=Math.max(0,Math.floor(v)),x1=Math.min(paint.width-1,x0+1),y1=Math.min(paint.height-1,y0+1),fx=Math.max(0,Math.min(1,u-x0)),fy=Math.max(0,Math.min(1,v-y0));
   const at=(x,y)=>paint.data[(y*paint.width+x)*4]/255,value=(at(x0,y0)*(1-fx)+at(x1,y0)*fx)*(1-fy)+(at(x0,y1)*(1-fx)+at(x1,y1)*fx)*fy;
   weight[j*size+i]*=value;
  }
  for(let k=0;k<size*size;k++)data[k*4+channel]=Math.round(weight[k]*255);
 });
 return data;
}
// Points layer maps and paint masks at other files (restored or exported
// copies). rename(file) returns the new path; the record is copied, not changed.
export function renameTerrainTextures(terrain,rename){
 if(!terrain?.appearance?.layers)return terrain;
 const copy=structuredClone(terrain);
 for(const layer of copy.appearance.layers){
  for(const key of Object.keys(layer.maps))layer.maps[key]=rename(layer.maps[key]);
  if(layer.mask?.paint)layer.mask.paint=rename(layer.mask.paint);
 }
 return copy;
}
