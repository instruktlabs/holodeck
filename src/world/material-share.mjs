// Shared materials across assets (H100). Kiln saves each asset with its own copy
// of a material, so a world built from one stone kit loads the same travertine
// as many materials, one per GLB. Identical copies are found by content: every
// texture image gets a key from its bytes (or from the host's content-addressed
// URL), and a material's signature is its type, its parameters and the keys and
// settings of its textures. Materials with equal signatures render the same, so
// one of them can stand for all, and static merging can then draw every piece in
// that material together.

const sourceKeys=new WeakMap();
// The host moves embedded images out under their SHA-256 (../textures/<hex>.png).
const HOST_TEXTURE=/^([a-f0-9]{64})\.(?:png|jpe?g|webp)$/;

async function digest(bytes){
 const subtle=globalThis.crypto?.subtle;if(!subtle)return null;
 const hash=new Uint8Array(await subtle.digest('SHA-256',bytes));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
function imageIndex(textureDef){
 if(!textureDef)return undefined;
 if(textureDef.source!==undefined)return textureDef.source;
 for(const extension of Object.values(textureDef.extensions??{}))if(extension?.source!==undefined)return extension.source;
 return undefined;
}
// Key every texture image of a loaded glTF by the SHA-256 of its bytes: from the
// file name the host gave it, or computed for an embedded image. Worlds admit only
// self-contained GLBs, so any other URI is unexpected and stays unkeyed, as do
// embedded images without Web Crypto (an insecure origin); their materials are
// never shared.
export async function tagGltfTextures(gltf){
 const parser=gltf?.parser,json=parser?.json;if(!json?.images?.length)return gltf;
 const keys=await Promise.all(json.images.map(async image=>{
  try{
   if(typeof image.uri==='string'&&!image.uri.startsWith('data:')){const match=HOST_TEXTURE.exec(image.uri.split(/[?#]/)[0].split('/').pop());return match?`sha256:${match[1]}`:null;}
   if(image.bufferView!==undefined){const bytes=await parser.getDependency('bufferView',image.bufferView);const hash=await digest(bytes);return hash?`sha256:${hash}`:null;}
  }catch{return null;}
  return null;
 }));
 for(const [object,reference] of parser.associations){
  if(!object?.isTexture||reference?.textures===undefined)continue;
  const key=keys[imageIndex(json.textures?.[reference.textures])];
  if(key&&object.source)sourceKeys.set(object.source,key);
 }
 return gltf;
}
export function textureKey(texture){return texture?.source?sourceKeys.get(texture.source)??null:null;}
export function setTextureKey(texture,key){sourceKeys.set(texture.source,key);}

const SKIP=new Set(['uuid','id','name','userData','version','uniformsNeedUpdate','needsUpdate','_listeners','isMaterial','type','defines','onBuild','onBeforeRender','onBeforeCompile','customProgramCacheKey']);
const TEXTURE_FIELDS=['wrapS','wrapT','magFilter','minFilter','anisotropy','flipY','colorSpace','channel','generateMipmaps','premultiplyAlpha','unpackAlignment','format','type','mapping','matrixAutoUpdate'];
function textureSignature(texture){
 const key=textureKey(texture);if(!key)return undefined;
 const value={key};for(const field of TEXTURE_FIELDS)value[field]=texture[field];
 for(const field of ['offset','repeat','center'])value[field]=texture[field].toArray();
 value.rotation=texture.rotation;if(!texture.matrixAutoUpdate)value.matrix=texture.matrix.toArray();
 return value;
}
// The signature of a plain three material, or null when it cannot be shared: node
// materials (their graphs carry behaviour, such as foliage, flow or reflections),
// transparency and transmission, and textures without a content key.
export function materialSignature(material){
 if(!material?.isMaterial||material.isNodeMaterial||material.isShaderMaterial||material.transparent||material.transmission>0)return null;
 const value={type:material.type};
 for(const field in material){
  // Private fields stay in: physical extensions keep their values behind accessors (_clearcoat, _sheen, _alphaTest).
  if(SKIP.has(field))continue;
  const v=material[field];
  if(typeof v==='function')continue;
  if(v?.isNode)return null;
  if(v?.isTexture){const t=textureSignature(v);if(!t)return null;value[field]=t;continue;}
  if(v?.isColor){value[field]=v.getHexString();continue;}
  if(v?.isVector2||v?.isVector3||v?.isEuler||v?.isMatrix3||v?.isMatrix4){value[field]=v.toArray();continue;}
  if(v===null||['number','boolean','string','undefined'].includes(typeof v)){value[field]=v;continue;}
  if(Array.isArray(v)&&v.every(x=>x===null||typeof x!=='object')){value[field]=v;continue;}
  return null;
 }
 return JSON.stringify(value);
}

// Copies of the loaded models whose identical materials are one instance across
// assets. The loader keeps owning every material; nothing here is disposed.
export function shareMaterials(models){
 const canonical=new Map(),out={},per=new Map();let shared=0;
 const pick=material=>{
  if(per.has(material))return per.get(material);
  const signature=materialSignature(material);let chosen=material;
  if(signature){if(canonical.has(signature)){chosen=canonical.get(signature);shared++;}else canonical.set(signature,material);}
  per.set(material,chosen);return chosen;
 };
 for(const [id,model] of Object.entries(models)){
  if(!model?.scene){out[id]=model;continue;}
  let changed=false;
  model.scene.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&pick(o.material)!==o.material)changed=true;});
  if(!changed){out[id]=model;continue;}
  const scene=model.scene.clone(true);
  scene.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material))o.material=pick(o.material);});
  out[id]={...model,scene};
 }
 return {models:out,shared,distinct:canonical.size};
}
