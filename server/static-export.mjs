import {readFile,writeFile,mkdir,readdir,lstat,realpath,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readRevisionBundle} from './history.mjs';
import {validateWorld,validateGlb,MAX_ASSET_BYTES} from '../src/world/contract.mjs';
import {renameTerrainTextures,pngInfo,TERRAIN_LAYER_LIMITS} from '../src/world/terrain-layers.mjs';

const packageRoot=fileURLToPath(new URL('../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function absent(file){try{await lstat(file);throw new Error('Export destination already exists; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}}
function publicProvenance(value){
 if(!value)return undefined;
 const entries=Object.entries(value).filter(([key,v])=>['assetId','revisionId','collection'].includes(key)&&typeof v==='string'&&/^[a-zA-Z0-9_.@ -]{1,160}$/.test(v));
 return entries.length?Object.fromEntries(entries):undefined;
}
async function pinnedBytes(root,hash){
 const base=await realpath(root),file=await realpath(path.join(base,`.holodeck/blobs/${hash}.glb`)),relative=path.relative(base,file);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Pinned asset escapes workspace');
 const info=await stat(file);if(!info.isFile()||info.size>MAX_ASSET_BYTES)throw new Error('Pinned asset exceeds the export size limit');
 const bytes=await readFile(file);if(digest(bytes)!==hash)throw new Error('Pinned asset hash mismatch during export');validateGlb(bytes);return bytes;
}
async function pinnedTexture(root,hash){
 const base=await realpath(root),file=await realpath(path.join(base,`.holodeck/blobs/${hash}.png`)),relative=path.relative(base,file);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Pinned terrain texture escapes workspace');
 const info=await stat(file);if(!info.isFile()||info.size>TERRAIN_LAYER_LIMITS.textureBytes)throw new Error('Pinned terrain texture exceeds the export size limit');
 const bytes=await readFile(file);if(digest(bytes)!==hash)throw new Error('Pinned terrain texture hash mismatch during export');pngInfo(bytes);return bytes;
}
async function fileInventory(root,relative=''){
 const result=[];
 for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
  const file=relative?`${relative}/${entry.name}`:entry.name;
  if(entry.isDirectory())result.push(...await fileInventory(root,file));
  else if(entry.isFile()){const bytes=await readFile(path.join(root,file));result.push({file,bytes:bytes.length,sha256:digest(bytes)});}
  else throw new Error('Unexpected non-file in static output');
 }
 return result.sort((a,b)=>a.file.localeCompare(b.file));
}

// Page metadata is explicit public text supplied at export time; the world's own
// bible and references never reach the page head.
const MAX_PAGE_IMAGE_BYTES=8*1024*1024;
const escapeHtml=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pageText(value,max,label){
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw new Error(`Invalid page ${label}`);
 if(/(?:^|[\s"'=(])(?:[a-z]:[\\/]|\\\\|file:\/\/)|\/(?:home|Users)\//i.test(value))throw new Error(`Page ${label} contains a local path; provide public metadata`);
 return value.trim();
}
function imageInfo(bytes){
 if(bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return {type:'png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8){
  // Walk JPEG segments to the first start-of-frame marker for its dimensions.
  for(let i=2;i+9<bytes.length;){if(bytes[i]!==0xff){i++;continue;}const marker=bytes[i+1],size=bytes.readUInt16BE(i+2);if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return {type:'jpg',width:bytes.readUInt16BE(i+7),height:bytes.readUInt16BE(i+5)};i+=2+size;}
 }
 throw new Error('Page image must be a PNG or JPEG');
}
async function pageMetadata(page){
 if(page==null)return null;
 if(typeof page!=='object'||Object.keys(page).some(key=>!['title','description','url','image','imageAlt','license'].includes(key)))throw new Error('Invalid page metadata fields');
 const result={title:pageText(page.title,100,'title'),description:pageText(page.description,300,'description')};
 for(const key of ['url','license'])if(page[key]!==undefined){
  let url;try{url=new URL(page[key]);}catch{throw new Error(`Page ${key} must be an absolute https URL`);}
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error(`Page ${key} must be an absolute https URL`);
  if(key==='url'&&!url.pathname.endsWith('/'))throw new Error('Page url must end with / so relative scene files resolve');result[key]=url.href;
 }
 if(page.image!==undefined){
  if(typeof page.image!=='string'||!page.image)throw new Error('Choose a local page image file');const info=await lstat(page.image);
  if(!info.isFile()||info.size>MAX_PAGE_IMAGE_BYTES)throw new Error('Page image must be a bounded regular file');
  const bytes=await readFile(page.image),size=imageInfo(bytes);if(![size.width,size.height].every(n=>Number.isInteger(n)&&n>=1&&n<=4096))throw new Error('Page image dimensions exceed 4096 pixels');
  result.image={bytes,file:`preview.${size.type}`,width:size.width,height:size.height,alt:pageText(page.imageAlt??result.title,300,'image alt')};
 }else if(page.imageAlt!==undefined)throw new Error('Page image alt needs a page image');
 return result;
}
export function pageHead(page){
 const meta=(attribute,name,content)=>`<meta ${attribute}="${name}" content="${escapeHtml(String(content))}">`;
 const image=page.image&&page.url?new URL(page.image.file,page.url).href:null,lines=[`<title>${escapeHtml(page.title)}</title>`,meta('name','description',page.description)];
 if(page.url)lines.push(`<link rel="canonical" href="${escapeHtml(page.url)}">`,meta('property','og:type','website'),meta('property','og:title',page.title),meta('property','og:description',page.description),meta('property','og:url',page.url));
 if(image)lines.push(meta('property','og:image',image),meta('property','og:image:width',page.image.width),meta('property','og:image:height',page.image.height),meta('property','og:image:alt',page.image.alt));
 if(page.url)lines.push(meta('name','twitter:card',image?'summary_large_image':'summary'),meta('name','twitter:title',page.title),meta('name','twitter:description',page.description),...(image?[meta('name','twitter:image',image),meta('name','twitter:image:alt',page.image.alt)]:[]));
 if(page.url){
  const data={'@context':'https://schema.org','@type':'CreativeWork',name:page.title,description:page.description,url:page.url,...(image?{image}:{}),...(page.license?{license:page.license}:{})};
  lines.push(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`);
 }
 return lines.join('');
}

// A static artifact is an explicit scene-only projection of an accepted receipt.
// It never opens a WorldStore, loads host plugins or copies a workspace/public dir.
export async function exportStaticWorld(root,{out,revision,page}={}){
 if(typeof out!=='string'||!out.trim())throw new Error('Choose a new export directory with --out');
 const output=path.resolve(out);await absent(output);const metadata=await pageMetadata(page);
 if(revision==null)try{await lstat(path.join(root,'.holodeck/accepted-bundle.json'));}catch(error){if(error.code==='ENOENT')throw new Error('Open this world with holodeck dev first to create an accepted snapshot.');throw error;}
 let receipt;
 try{receipt=await readRevisionBundle(root,revision);}catch(error){
  if(error.code==='ENOENT')throw new Error('That accepted revision or a pinned dependency is unavailable.');
  throw error;
 }
 if(receipt.world.schemaVersion!==2)throw new Error('Static export currently requires a schema v2 world with a registered runtime.');
 const world=structuredClone(receipt.world),scene=world.scene;
 world.bible={title:'Holodeck world',intent:'',rules:''};world.references=[];delete scene.moodboard;
 const needed=new Set([scene.origin,...scene.objects.map(o=>o.asset).filter(Boolean),...(scene.scatters||[]).flatMap(s=>s.variants.map(v=>v.asset))]),assets={},blobs=new Map();
 scene.assets=scene.assets.filter(asset=>needed.has(asset.id)).map(asset=>{
  const hash=receipt.assets[asset.id].hash,file=`assets/imports/${hash}.glb`,provenance=publicProvenance(asset.provenance);
  assets[asset.id]={hash,url:`./${file}`};return {id:asset.id,file,...(provenance?{provenance}:{}),...(asset.foliage?{foliage:asset.foliage}:{}),...(asset.flow?{flow:asset.flow}:{}),...(asset.reflection?{reflection:asset.reflection}:{})};
 });
 // Terrain textures move to content-addressed paths beside the GLBs.
 const textures={},textureBlobs=new Map();
 if(receipt.textures){
  scene.terrain=renameTerrainTextures(scene.terrain,file=>`assets/imports/terrain/${receipt.textures[file].hash}.png`);
  for(const pinned of Object.values(receipt.textures)){const file=`assets/imports/terrain/${pinned.hash}.png`;textures[file]={hash:pinned.hash,url:`./${file}`,width:pinned.width,height:pinned.height};if(!textureBlobs.has(pinned.hash))textureBlobs.set(pinned.hash,await pinnedTexture(root,pinned.hash));}
 }
 validateWorld(world);
 for(const entry of Object.values(assets))if(!blobs.has(entry.hash))blobs.set(entry.hash,await pinnedBytes(root,entry.hash));
 // Reserve exactly one fresh destination before writing; never clean or merge
 // user-owned output. An interrupted build remains visibly incomplete.
 await mkdir(path.dirname(output),{recursive:true});await mkdir(output);
 await writeFile(path.join(output,'EXPORT-INCOMPLETE.txt'),'Export did not finish. Do not deploy this directory. Choose a fresh directory to retry.\n',{flag:'wx'});
 const {build}=await import('vite');
 await build({configFile:false,envDir:false,root:path.join(packageRoot,'src/viewer'),base:'./',publicDir:false,logLevel:'warn',
  resolve:{alias:[{find:path.join(packageRoot,'src/world/moodboard.jsx').replaceAll('\\','/'),replacement:path.join(packageRoot,'src/viewer/excluded-board.jsx')}]},
  plugins:[{name:'scene-only-viewer',enforce:'pre',resolveId(source,importer){if(importer&&/\/(world\/runtime-scene|prototype\/scene)\.jsx$/.test(importer.replaceAll('\\','/'))&&source.endsWith('/moodboard.jsx'))return path.join(packageRoot,'src/viewer/excluded-board.jsx');}}],
  build:{outDir:output,emptyOutDir:false,sourcemap:false,target:'es2022',minify:true,assetsDir:'assets',chunkSizeWarningLimit:2500}});
 if(metadata){
  const index=path.join(output,'index.html'),html=await readFile(index,'utf8');if(!html.includes('<title>Holodeck world</title>'))throw new Error('Viewer page has no title to replace');
  await writeFile(index,html.replace('<title>Holodeck world</title>',()=>pageHead(metadata)));
  if(metadata.image)await writeFile(path.join(output,metadata.image.file),metadata.image.bytes,{flag:'wx'});
 }
 await mkdir(path.join(output,'assets/imports'),{recursive:true});
 for(const [hash,bytes] of blobs)await writeFile(path.join(output,`assets/imports/${hash}.glb`),bytes,{flag:'wx'});
 if(textureBlobs.size)await mkdir(path.join(output,'assets/imports/terrain'));
 for(const [hash,bytes] of textureBlobs)await writeFile(path.join(output,`assets/imports/terrain/${hash}.png`),bytes,{flag:'wx'});
 await writeFile(path.join(output,'scene.json'),JSON.stringify({format:'holodeck-view-v1',world,assets,...(textureBlobs.size?{textures}:{})},null,2)+'\n',{flag:'wx'});
 await writeFile(path.join(output,'README.txt'),'Holodeck static scene\n\nUpload the entire directory to any static HTTP(S) host. Keep relative paths intact; subdirectory deployment is supported. No Node server, account, agent, or API endpoint is required. Open index.html through the host, not file://. HTTPS enables WebGPU where available; WebGL2 is the fallback. Add ?backend=webgl to force it.\n\nEnter world: WASD move, Shift run, Space jump and V first/third person when the scene has an inhabitant. G toggles free camera; Q/E descend/ascend there. E interacts while walking. Escape stops mouse capture and returns to the overlook. Right-drag works without mouse capture. The toolbar controls cove visibility, activity pause and return to arrival.\n\nThis artifact contains an accepted scene revision and exact pinned GLB bytes. Authoring prose, board references, agent history, credentials and source workspace files are excluded. Asset metadata embedded in the original GLBs is retained unchanged; publication rights remain the asset owner\'s responsibility. The manifest records SHA-256 hashes of every delivered file except itself.\n',{flag:'wx'});
 const files=(await fileInventory(output)).filter(entry=>entry.file!=='EXPORT-INCOMPLETE.txt'),manifest={format:'holodeck-static-v1',revision:world.revision,scope:'scene-only',assets:scene.assets.map(a=>({id:a.id,sha256:assets[a.id].hash,file:a.file,...(a.provenance?{provenance:a.provenance}:{})})),files};
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 await unlink(path.join(output,'EXPORT-INCOMPLETE.txt'));
 return {path:output,revision:world.revision,files:files.length+1,assets:scene.assets.length};
}
