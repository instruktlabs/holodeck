import {validateRuntimeScene} from './runtime.mjs';
import {validateFoliage,validateFoliageBinding} from './foliage-contract.mjs';
import {MAX_PLACEMENTS} from './asset-budget.mjs';
export const MAX_ASSET_BYTES=32*1024*1024;
// Describes current host delivery, not every feature an authoring tool can export.
export const ASSET_DELIVERY_PROFILE=Object.freeze({
  id:'static-rigid-v1',version:1,container:'GLB',gltfVersion:'2.0',selfContained:true,
  supportedRequiredExtensions:Object.freeze(['KHR_mesh_quantization','KHR_materials_unlit','KHR_materials_emissive_strength','EXT_mesh_gpu_instancing']),
  embeddedClips:false,skinning:false,automaticLOD:false,
  hostGait:Object.freeze({module:'motion.gait@1',binding:'named-rest-joints',schemaVersion:2}),
});
export const DEFAULT_WORLD={
  schemaVersion:1,revision:0,
  bible:{title:'Hearth Cove',intent:'A quiet place to make worlds. Warm clay, linen, moss and a living ember at the origin.',rules:'Keep a clear walking route.\nThe cove can always be recalled.\nPreview changes before applying them.'},
  scene:{environment:{type:'construct',clearPath:true,groundColor:'#abb492',fogColor:'#eee2c9',sunColor:'#ffd6a0',sunIntensity:3.3},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/hearth-cove.glb'}],objects:[]},
};
const fail=message=>{throw new Error(message);};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys,label)=>{if(!record(x)||Object.keys(x).some(k=>!keys.includes(k)))fail(`Unknown or invalid ${label} fields`);};
const str=(x,max,label)=>{if(typeof x!=='string'||x.length>max)fail(`Invalid ${label}`);};
const id=x=>{if(typeof x!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(x))fail('Invalid object or asset ID');};
const vec=(x,label,positive=false)=>{if(!Array.isArray(x)||x.length!==3||x.some(n=>!Number.isFinite(n)||Math.abs(n)>1000||(positive&&n<=0)))fail(`Invalid ${label}`);};
export function validateWorld(w){
  exact(w,['schemaVersion','revision','bible','scene','references'],'world');
  if(![1,2].includes(w.schemaVersion)||!Number.isSafeInteger(w.revision)||w.revision<0)fail('Unsupported world version or revision');
  exact(w.bible,['title','intent','rules','referenceIds'],'bible');
  str(w.bible.title,120,'title');str(w.bible.intent,8000,'intent');str(w.bible.rules,8000,'rules');
  const refs=w.references||[];if(!Array.isArray(refs)||refs.length>200)fail('Mood board is limited to 200 references');
  const refIds=new Set();for(const r of refs){
    exact(r,['id','kind','file','title','notes','group','status','layout','page','source','generation'],'reference');id(r.id);if(refIds.has(r.id))fail('Duplicate reference ID');refIds.add(r.id);
    if(r.generation){exact(r.generation,['provider','model','prompt','threadId','turnId','referenceIds'],'image generation');if(r.generation.provider!=='codex')fail('Unknown image provider');for(const key of ['model','threadId','turnId'])str(r.generation[key],160,key);str(r.generation.prompt,12000,'image prompt');if(!Array.isArray(r.generation.referenceIds)||r.generation.referenceIds.length>5)fail('Invalid image references');for(const refId of r.generation.referenceIds)id(refId);}
    const kind=r.kind||'image';if(!['image','note','file'].includes(kind))fail('Unknown reference kind');
    if(kind!=='note'&&!/^references\/files\/[a-f0-9]{64}\.(png|md|txt|json|pdf|glb)$/.test(r.file))fail('References must point to imported file revisions');
    if(kind==='image'&&!r.file.endsWith('.png'))fail('Image references must be PNG');
    if(kind==='note'&&(r.file!==undefined||r.source!==undefined))fail('Notes cannot contain file pointers');
    if(r.source!==undefined&&!/^(assets\/(source|imports)|references\/files)\/[-a-zA-Z0-9_./ ]+$/.test(r.source))fail('Invalid reference source');
    if(r.source?.split('/').includes('..'))fail('Invalid reference source');
    str(r.title,160,'reference title');str(r.notes,2000,'reference notes');
    if(r.group!==undefined)str(r.group,64,'reference group');
    if(r.status!==undefined&&!['exploring','approved','rejected'].includes(r.status))fail('Invalid reference status');
    if(r.page!==undefined&&(!Number.isInteger(r.page)||r.page<0||r.page>33))fail('Invalid reference page');
    if(r.layout){exact(r.layout,['x','y','w','h'],'card layout');const {x,y,w,h}=r.layout;if(![x,y,w,h].every(Number.isFinite)||x<0||y<100||w<160||h<120||x+w>1200||y+h>720)fail('Invalid card layout');}
  }
  if(w.bible.referenceIds&&(!Array.isArray(w.bible.referenceIds)||w.bible.referenceIds.some(x=>!refIds.has(x))))fail('Pinned bible references must exist on the board');
  const s=w.scene;exact(s,['environment','bridge','origin','assets','objects','moodboard',...(w.schemaVersion===2?['runtime','terrain','water']:[])],'scene');
  exact(s.environment,['type','clearPath','groundColor','fogColor','sunColor','sunIntensity',...(w.schemaVersion===2?['sunPosition','fogNear','fogFar']:[])],'environment');
  if(!['construct','meadow','woodland'].includes(s.environment.type))fail('Unsupported environment capability');
  if(typeof s.environment.clearPath!=='boolean')fail('clearPath must be a boolean');
  for(const k of ['groundColor','fogColor','sunColor'])if(!/^#[0-9a-f]{6}$/i.test(s.environment[k]))fail(`Invalid ${k}`);
  if(!Number.isFinite(s.environment.sunIntensity)||s.environment.sunIntensity<0||s.environment.sunIntensity>8)fail('Sun intensity must be 0–8');
  if(s.environment.sunPosition!==undefined){vec(s.environment.sunPosition,'sun position');if(Math.hypot(...s.environment.sunPosition)===0)fail('Sun position must be nonzero');}
  const fogNear=s.environment.fogNear===undefined?28:s.environment.fogNear,fogFar=s.environment.fogFar===undefined?85:s.environment.fogFar;
  if(!Number.isFinite(fogNear)||!Number.isFinite(fogFar)||fogNear<0||fogFar>2000||fogNear>=fogFar)fail('Invalid fog distances');
  if(![null,'low','high'].includes(s.bridge)||s.bridge&&s.environment.type!=='woodland')fail('Bridge requires the woodland crossing');
  const placementLimit=w.schemaVersion===2?MAX_PLACEMENTS:200;
  if(!Array.isArray(s.assets)||s.assets.length>64||!Array.isArray(s.objects)||s.objects.length>placementLimit)fail(`Scene exceeds 64 assets or ${placementLimit} placements`);
  const ids=new Set();for(const a of s.assets){
    exact(a,['id','file','provenance','foliage'],'asset');id(a.id);if(ids.has(a.id))fail('Duplicate asset ID');ids.add(a.id);
    if(a.foliage!==undefined){if(w.schemaVersion!==2)fail('Foliage requires schema version 2');validateFoliage(a.foliage);if(a.id===s.origin||a.id===s.moodboard?.asset)fail('Foliage is only supported on ordinary imported placements');}
    if(typeof a.file!=='string'||!/^assets\/imports\/[-a-zA-Z0-9_/.]+\.glb$/.test(a.file)||a.file.split('/').some(p=>p==='..'||p===''))fail('Asset must be a GLB inside assets/imports');
    if(a.provenance!==undefined){exact(a.provenance,['assetId','revisionId','collection'],'provenance');for(const v of Object.values(a.provenance))str(v,160,'provenance');}
  }
  if(!ids.has(s.origin))fail('Origin asset is missing');
  const objects=new Set();for(const o of s.objects){
    exact(o,['id','asset','position','rotation','scale','collider','layer','materialStyle','light',...(w.schemaVersion===2?['shape','behavior','label']:[])],'placement');id(o.id);if(objects.has(o.id))fail('Duplicate placement ID');objects.add(o.id);
    if(o.light){exact(o.light,['color','intensity','distance','offset'],'light');if(!/^#[a-f0-9]{6}$/i.test(o.light.color)||!Number.isFinite(o.light.intensity)||o.light.intensity<0||o.light.intensity>20||!Number.isFinite(o.light.distance)||o.light.distance<=0||o.light.distance>20)fail('Invalid local light');vec(o.light.offset,'light offset');}
    if(o.layer!==undefined&&!['origin','world'].includes(o.layer))fail('Unknown scene layer');
    if(o.materialStyle!==undefined&&!['kiln','cove'].includes(o.materialStyle))fail('Unknown material style');
    if(o.materialStyle==='cove'&&s.assets.find(a=>a.id===o.asset)?.foliage)fail('Foliage cannot be combined with cove material derivation');
    if(o.behavior?.type==='flock'&&s.assets.find(a=>a.id===o.asset)?.foliage)fail('Foliage is not supported by the flock renderer');
    if(o.shape&&w.schemaVersion===2){
      if(o.asset!==undefined)fail('Choose either asset or shape');
      exact(o.shape,['type','size','color','offset','surface'],'shape');
      if(!['box','cylinder','sphere','torus','tree'].includes(o.shape.type)||!/^#[a-f0-9]{6}$/i.test(o.shape.color))fail('Unsupported shape');
      if(o.shape.surface!==undefined&&!['stone','wood','soil','water'].includes(o.shape.surface))fail('Unsupported surface');
      vec(o.shape.size,'shape size',true);vec(o.shape.offset,'shape offset');
    }else if(!ids.has(o.asset))fail(`Missing asset for ${o.id}`);
    if(o.label!==undefined)str(o.label,100,'object label');
    vec(o.position,'position');vec(o.rotation,'rotation');vec(o.scale,'scale',true);
    if(o.collider!==null){
      if(o.collider?.type==='compound'){exact(o.collider,['type','boxes'],'compound collider');if(!Array.isArray(o.collider.boxes)||o.collider.boxes.length>16)fail('Compound colliders allow up to 16 boxes');for(const b of o.collider.boxes){exact(b,['size','offset'],'box');vec(b.size,'box size',true);vec(b.offset,'box offset');}}
      else {exact(o.collider,['type','size','offset'],'collider');if(o.collider.type!=='box')fail('Only box or compound colliders are supported');vec(o.collider.size,'collider size',true);vec(o.collider.offset,'collider offset');}
    }
  }
  if(s.moodboard){exact(s.moodboard,['asset','position','rotation','page','title','theme',...(w.schemaVersion===2?['collider']:[])],'mood board');if(!ids.has(s.moodboard.asset))fail('Mood board frame is missing');vec(s.moodboard.position,'board position');vec(s.moodboard.rotation,'board rotation');if(!Number.isInteger(s.moodboard.page)||s.moodboard.page<0||s.moodboard.page>33)fail('Invalid board page');if(s.moodboard.title!==undefined)str(s.moodboard.title,120,'board title');if(s.moodboard.theme!==undefined&&!['linen','charcoal','clay'].includes(s.moodboard.theme))fail('Invalid board theme');}
  if(w.schemaVersion===2){if(s.bridge!==null||s.environment.type==='woodland')fail('Version 2 uses authored world geometry instead of the legacy crossing');validateRuntimeScene(s);}
  return w;
}

export function validateGlb(bytes,{foliage}={}){
  if(bytes.byteLength<20||bytes.byteLength>MAX_ASSET_BYTES)fail('GLB is empty or exceeds 32 MiB');
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(data.getUint32(0,true)!==0x46546c67||data.getUint32(4,true)!==2||data.getUint32(8,true)!==bytes.byteLength)fail('Invalid GLB header or incomplete write');
  let offset=12,doc,bin=0;
  while(offset<bytes.byteLength){
    if(offset+8>bytes.byteLength)fail('Truncated GLB chunk');
    const n=data.getUint32(offset,true),type=data.getUint32(offset+4,true);offset+=8;
    if(n%4||offset+n>bytes.byteLength)fail('Invalid GLB chunk length');
    if(type===0x4e4f534a){if(doc||offset!==20)fail('GLB requires one initial JSON chunk');doc=JSON.parse(new TextDecoder().decode(bytes.subarray(offset,offset+n)));}
    else if(type===0x004e4942){bin+=n;}else fail('Unsupported GLB chunk');
    offset+=n;
  }
  if(doc?.asset?.version!=='2.0')fail('Expected glTF 2.0');
  if(doc.skins?.length)fail('Skinned GLBs require a registered skeletal controller; static-rigid-v1 does not provide one. Deliver a static rest pose with named child joints for motion.gait@1.');
  if(doc.animations?.length)fail('Embedded animation clips are not supported by static-rigid-v1. Keep QA clips in a separate artifact; deliver a static rest pose with named child joints for host motion.gait@1.');
  if((doc.buffers||[]).some(b=>b.uri)||(doc.images||[]).some(i=>i.uri))fail('GLB must be self-contained; external resources are not loaded');
  const unsupported=(doc.extensionsRequired||[]).filter(e=>!ASSET_DELIVERY_PROFILE.supportedRequiredExtensions.includes(e));
  if(unsupported.length){
    const names=unsupported.slice(0,6).map(extension=>{
      const name=typeof extension==='string'?extension.replace(/[\u0000-\u001f\u007f-\u009f]/g,'?'):'<invalid extension name>';
      const quoted=JSON.stringify(name);return quoted.length>82?`${quoted.slice(0,78)}..."`:quoted;
    }).join(', ');
    fail(`Unsupported required glTF extensions for ${ASSET_DELIVERY_PROFILE.id}: ${names}${unsupported.length>6?` (+${unsupported.length-6} more)`:''}. Export using the advertised extensions, or explicitly install/configure and validate the needed loader/decoder in Holodeck before changing this profile; installing Kiln alone does not add support.`);
  }
  if((doc.buffers||[]).length>1||(doc.buffers?.[0]?.byteLength||0)>bin)fail('Invalid GLB binary buffer');
  for(const v of doc.bufferViews||[])if(v.buffer!==0||!Number.isSafeInteger(v.byteLength)||v.byteLength<0||(v.byteOffset||0)+v.byteLength>bin)fail('GLB buffer view is out of bounds');
  const nodes=doc.nodes||[];if(nodes.length>10000||(doc.meshes||[]).length>2000)fail('Asset exceeds node or mesh budget');
  const active=new Set(),done=new Set();
  function visit(i,depth=0){if(!Number.isInteger(i)||!nodes[i]||depth>64||active.has(i))fail('Invalid, cyclic or overly deep GLB hierarchy');if(done.has(i))return;active.add(i);for(const c of nodes[i].children||[])visit(c,depth+1);active.delete(i);done.add(i);}
  nodes.forEach((_,i)=>visit(i));
  validateFoliageBinding(doc,foliage);
  const meshTriangles=(doc.meshes||[]).map(m=>{let n=0;for(const p of m.primitives||[]){if(p.mode!==undefined&&p.mode!==4)fail('Only triangle meshes are supported');const a=doc.accessors?.[p.indices??p.attributes?.POSITION];if(!a||!Number.isSafeInteger(a.count)||a.count<0)fail('Invalid primitive accessor');n+=a.count/3;}return n;});
  let triangles=0;for(const node of nodes){if(node.mesh===undefined)continue;if(meshTriangles[node.mesh]===undefined)fail('Invalid mesh index');const attrs=node.extensions?.EXT_mesh_gpu_instancing?.attributes;let instances=1;if(attrs){const counts=Object.values(attrs).map(i=>doc.accessors?.[i]?.count);if(!counts.length||counts.some(n=>!Number.isSafeInteger(n)||n<0||n!==counts[0]))fail('Invalid instance count');instances=counts[0];}triangles+=meshTriangles[node.mesh]*instances;}
  if(triangles>1000000)fail('Asset exceeds one million triangles');
  return {nodes:nodes.length,triangles:Math.ceil(triangles),bytes:bytes.byteLength};
}
