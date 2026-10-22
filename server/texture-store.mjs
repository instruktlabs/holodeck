import {createHash} from 'node:crypto';

// Serving-time texture sharing. Kiln embeds a full copy of every library
// texture in each GLB, so a world with forty assets downloads the same few
// images dozens of times. The host serves each admitted GLB with its embedded
// images moved out to content-addressed URLs, so the browser fetches each
// distinct image once. Pinned GLB bytes, provenance, history and static export
// are unchanged; this is a derived form for the browser only, and the image
// bytes are identical, so decoding and rendering are too.
export const TEXTURE_TYPES=Object.freeze({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'});
export const TEXTURE_CONTENT_TYPES=Object.freeze(Object.fromEntries(Object.entries(TEXTURE_TYPES).map(([type,ext])=>[ext,type])));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// Extensions that address buffer views themselves; leave those GLBs whole.
const VIEW_EXTENSIONS=new Set(['EXT_meshopt_compression','KHR_draco_mesh_compression']);
const align=(n,to=16)=>Math.ceil(n/to)*to;

function readGlb(bytes){
  if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)return null;
  const jsonLength=bytes.readUInt32LE(12);if(bytes.readUInt32LE(16)!==0x4e4f534a)return null;
  const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  let bin=null,offset=20+jsonLength;
  if(offset+8<=bytes.length){const length=bytes.readUInt32LE(offset);if(bytes.readUInt32LE(offset+4)===0x004e4942)bin=bytes.subarray(offset+8,offset+8+length);}
  return {json,bin};
}
function writeGlb(json,bin){
  const text=Buffer.from(JSON.stringify(json),'utf8'),jsonChunk=Buffer.alloc(align(text.length,4),0x20);text.copy(jsonChunk);
  const binChunk=bin?Buffer.alloc(align(bin.length,4)):null;if(bin)bin.copy(binChunk);
  const total=12+8+jsonChunk.length+(binChunk?8+binChunk.length:0),out=Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
  out.writeUInt32LE(jsonChunk.length,12);out.writeUInt32LE(0x4e4f534a,16);jsonChunk.copy(out,20);
  if(binChunk){const at=20+jsonChunk.length;out.writeUInt32LE(binChunk.length,at);out.writeUInt32LE(0x004e4942,at+4);binChunk.copy(out,at+8);}
  return out;
}
// Buffer views may only be referenced from accessors, sparse accessors and
// images. Anything else means an extension we do not understand.
function viewReferences(json){
  const refs=[];
  const walk=(value,where)=>{
    if(Array.isArray(value)){value.forEach(item=>walk(item,where));return;}
    if(!value||typeof value!=='object')return;
    for(const [key,child] of Object.entries(value)){if(key==='bufferView')refs.push({where,view:child});else walk(child,where);}
  };
  for(const [key,value] of Object.entries(json))if(key!=='bufferViews')walk(value,key);
  return refs;
}

// Returns {glb, images:[{hash,ext,type,bytes}]} or null when the GLB has no
// embedded images to share or uses a layout this function does not rewrite.
export function shareGlbImages(bytes,{textureBase='../textures/'}={}){
  const glb=readGlb(bytes);if(!glb?.bin)return null;
  const {json,bin}=glb,images=json.images||[];
  if(!images.some(image=>Number.isInteger(image.bufferView)))return null;
  if((json.extensionsUsed||[]).some(name=>VIEW_EXTENSIONS.has(name))||json.buffers?.length!==1||json.buffers[0].uri!==undefined)return null;
  const refs=viewReferences(json),imageViews=new Set(images.filter(image=>Number.isInteger(image.bufferView)).map(image=>image.bufferView));
  if(refs.some(ref=>ref.where!=='accessors'&&ref.where!=='images'))return null;
  if(refs.some(ref=>ref.where==='accessors'&&imageViews.has(ref.view)))return null;
  if(images.some(image=>Number.isInteger(image.bufferView)&&!TEXTURE_TYPES[image.mimeType]))return null;
  const views=json.bufferViews||[],remap=new Map(),kept=[];let length=0;
  views.forEach((view,index)=>{
    if(imageViews.has(index))return;
    const start=view.byteOffset||0;if(view.buffer!==0||start+view.byteLength>bin.length)throw new Error('Invalid GLB buffer view');
    length=align(length);remap.set(index,kept.length);kept.push({view,start,at:length});length+=view.byteLength;
  });
  const shared=[],out={...json};
  out.images=images.map(image=>{
    if(!Number.isInteger(image.bufferView))return image;
    const view=views[image.bufferView],start=view.byteOffset||0,data=bin.subarray(start,start+view.byteLength),hash=digest(data),ext=TEXTURE_TYPES[image.mimeType];
    shared.push({hash,ext,type:image.mimeType,bytes:Buffer.from(data)});
    const {bufferView,...rest}=image;return {...rest,uri:`${textureBase}${hash}.${ext}`};
  });
  const newBin=Buffer.alloc(length);
  out.bufferViews=kept.map(({view,start,at})=>{bin.copy(newBin,at,start,start+view.byteLength);return {...view,byteOffset:at};});
  out.accessors=(json.accessors||[]).map(accessor=>{
    const next={...accessor};if(Number.isInteger(accessor.bufferView))next.bufferView=remap.get(accessor.bufferView);
    if(accessor.sparse)next.sparse={...accessor.sparse,indices:{...accessor.sparse.indices,bufferView:remap.get(accessor.sparse.indices.bufferView)},values:{...accessor.sparse.values,bufferView:remap.get(accessor.sparse.values.bufferView)}};
    return next;
  });
  if(!out.accessors.length)delete out.accessors;
  if(kept.length){out.buffers=[{...json.buffers[0],byteLength:length}];}
  else{delete out.buffers;delete out.bufferViews;}
  return {glb:writeGlb(out,kept.length?newBin:null),images:shared};
}

// Per-host memo of derived GLBs and the distinct images they reference.
export function createTextureStore(readPinned){
  const derived=new Map(),textures=new Map();
  async function glb(hash){
    if(!derived.has(hash))derived.set(hash,readPinned(hash).then(bytes=>{
      const result=shareGlbImages(bytes);if(!result)return bytes;
      for(const image of result.images)if(!textures.has(`${image.hash}.${image.ext}`))textures.set(`${image.hash}.${image.ext}`,{type:image.type,bytes:image.bytes});
      return result.glb;
    }).catch(error=>{derived.delete(hash);throw error;}));
    return derived.get(hash);
  }
  return {glb,texture:name=>textures.get(name)??null,stats:()=>({glbs:derived.size,textures:textures.size,textureBytes:[...textures.values()].reduce((n,t)=>n+t.bytes.length,0)})};
}
