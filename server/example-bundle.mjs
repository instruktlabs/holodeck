import {readFile,writeFile,mkdir,readdir,lstat,realpath,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readRevisionBundle} from './history.mjs';
import {SKILLS_GUIDE,KILN_GUIDE} from './world-guide.mjs';
import {installWorldSkills} from './world-skills.mjs';
import {validateWorld,validateGlb,MAX_ASSET_BYTES} from '../src/world/contract.mjs';
import {placedSourceTriangles,MAX_ASSETS,MAX_PLACED_TRIANGLES} from '../src/world/asset-budget.mjs';
import {terrainTextureFiles,checkTerrainTextures,renameTerrainTextures,pngInfo,TERRAIN_LAYER_LIMITS} from '../src/world/terrain-layers.mjs';
import {HEIGHTMAP_LIMITS} from '../src/world/terrain.mjs';
import {heightmapOf,admitHeight,heightBlob,HEIGHT_FILE_BYTES} from './terrain-heights.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
const MAX_PREVIEW_BYTES=8*1024*1024;
const fail=message=>{throw new Error(message);};
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys,label)=>{if(!record(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(`Invalid ${label} fields`);};
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(record(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail(`Invalid ${label}`);};
function portableMetadata(value){
 if(typeof value==='string'){
  if(/(?:^|[\s"'=()])(?:[a-z]:[\\/]|\\\\|file:\/\/|\/[^\s/]+\/)/i.test(value)||value.startsWith('/'))fail('Example metadata contains an absolute path; provide portable public metadata');
 }else if(Array.isArray(value)){for(const entry of value)portableMetadata(entry);}
 else if(record(value)){for(const [key,entry] of Object.entries(value)){portableMetadata(key);portableMetadata(entry);}}
}
function publicProvenance(value){
 if(!value)return undefined;const entries=Object.entries(value).filter(([key,v])=>['assetId','revisionId','collection'].includes(key)&&typeof v==='string'&&/^[a-zA-Z0-9_.@ -]{1,160}$/.test(v));return entries.length?Object.fromEntries(entries):undefined;
}
async function absent(file){try{await lstat(file);fail('Destination already exists; choose a new directory');}catch(error){if(error.code!=='ENOENT')throw error;}}
async function containedBytes(root,file,limit){
 const base=await realpath(root),lexical=path.resolve(base,file),target=await realpath(lexical),relative=path.relative(base,target);
 if(relative.startsWith('..')||path.isAbsolute(relative))fail('Example dependency escapes its directory');
 const info=await lstat(lexical);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)fail('Example dependency is not a bounded regular file');return readFile(target);
}
function inspectGlb(bytes,foliage,flow){
 const metrics=validateGlb(bytes,{foliage,flow});const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));portableMetadata(doc);return metrics;
}
function inspectPng(bytes){
 if(bytes.length<33||bytes.length>MAX_PREVIEW_BYTES||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(8)!==13||bytes.subarray(12,16).toString()!=='IHDR')fail('Example preview must be a bounded PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(width<1||height<1||width>4096||height>4096)fail('Example preview dimensions exceed 4096 pixels');return {width,height};
}
function validateManifest(manifest){
 exact(manifest,['format','id','title','description','sourceRevision','capabilities','world','assets','textures','height','preview','integrity'],'example manifest');
 if(manifest.format!=='holodeck-example-v1'||typeof manifest.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(manifest.id))fail('Invalid example format or id');
 text(manifest.title,100,'example title');text(manifest.description,1200,'example description');if(!Number.isSafeInteger(manifest.sourceRevision)||manifest.sourceRevision<0)fail('Invalid example source revision');
 exact(manifest.capabilities,['schemaVersion','runtimeVersion','modules'],'example capabilities');const capabilities=manifest.capabilities;if(capabilities.schemaVersion!==2||capabilities.runtimeVersion!==1||!Array.isArray(capabilities.modules)||capabilities.modules.length>64||new Set(capabilities.modules).size!==capabilities.modules.length||capabilities.modules.some(value=>typeof value!=='string'||value.length>80))fail('Invalid example capabilities');
 exact(manifest.world,['file','sha256','bytes'],'example world');if(manifest.world.file!=='world/world.json'||!hashPattern.test(manifest.world.sha256)||!Number.isSafeInteger(manifest.world.bytes)||manifest.world.bytes<1||manifest.world.bytes>8*1024*1024)fail('Invalid example world receipt');
 if(!Array.isArray(manifest.assets)||!manifest.assets.length||manifest.assets.length>MAX_ASSETS)fail(`Example requires 1–${MAX_ASSETS} assets`);const ids=new Set();
 for(const asset of manifest.assets){exact(asset,['id','file','sha256','bytes'],'example asset');if(typeof asset.id!=='string'||!/^[-\w]{1,64}$/.test(asset.id)||ids.has(asset.id)||!hashPattern.test(asset.sha256)||asset.file!==`assets/imports/${asset.sha256}.glb`||!Number.isSafeInteger(asset.bytes)||asset.bytes<20||asset.bytes>MAX_ASSET_BYTES)fail('Invalid example asset receipt');ids.add(asset.id);}
 // Terrain layer PNGs are optional and content-addressed like the GLBs.
 if(manifest.textures!==undefined){
  if(!Array.isArray(manifest.textures)||!manifest.textures.length||manifest.textures.length>16)fail('Example textures require 1–16 terrain PNG receipts');const files=new Set();
  for(const t of manifest.textures){exact(t,['file','sha256','bytes','width','height'],'example texture');if(!hashPattern.test(t.sha256)||t.file!==`assets/imports/terrain/${t.sha256}.png`||files.has(t.file)||!Number.isSafeInteger(t.bytes)||t.bytes<33||t.bytes>TERRAIN_LAYER_LIMITS.textureBytes||![t.width,t.height].every(n=>Number.isInteger(n)&&n>=1&&n<=TERRAIN_LAYER_LIMITS.mapSize))fail('Invalid example texture receipt');files.add(t.file);}
 }
 // A heightmap's samples are optional and content-addressed like the GLBs.
 if(manifest.height!==undefined){const h=manifest.height;exact(h,['file','sha256','bytes','size'],'example height');if(!hashPattern.test(h.sha256)||h.file!==`assets/imports/terrain/${h.sha256}.r32`||!Array.isArray(h.size)||h.size.length!==2||!h.size.every(n=>Number.isInteger(n)&&n>=2&&n<=HEIGHTMAP_LIMITS.samples)||h.bytes!==h.size[0]*h.size[1]*4)fail('Invalid example height receipt');}
 if(manifest.preview!==undefined){const p=manifest.preview;exact(p,['file','sha256','bytes','width','height'],'example preview');if(p.file!=='preview.png'||!hashPattern.test(p.sha256)||!Number.isSafeInteger(p.bytes)||p.bytes<33||p.bytes>MAX_PREVIEW_BYTES||![p.width,p.height].every(n=>Number.isInteger(n)&&n>=1&&n<=4096))fail('Invalid example preview receipt');}
 portableMetadata(manifest);const {integrity,...body}=manifest;if(!hashPattern.test(integrity)||digest(canonical(body))!==integrity)fail('Example manifest integrity mismatch');return manifest;
}
export async function readExampleManifest(directory){
 for(const marker of ['EXAMPLE-INCOMPLETE.txt','INSTALL-INCOMPLETE.txt','REMIX-INCOMPLETE.txt']){try{await lstat(path.join(directory,marker));fail('Example bundle is incomplete');}catch(error){if(error.code!=='ENOENT')throw error;}}
 return validateManifest(JSON.parse((await containedBytes(directory,'example.json',256*1024)).toString('utf8')));
}
async function verifiedPreview(directory,receipt){
 const bytes=await containedBytes(directory,receipt.file,MAX_PREVIEW_BYTES),size=inspectPng(bytes);
 if(bytes.length!==receipt.bytes||digest(bytes)!==receipt.sha256||size.width!==receipt.width||size.height!==receipt.height)fail('Example preview hash or dimensions mismatch');
 return {bytes,sha256:receipt.sha256,...size};
}
export async function readExamplePreview(directory){
 const manifest=await readExampleManifest(directory);return manifest.preview?verifiedPreview(directory,manifest.preview):null;
}
// A top-level README.md documents the bundle in the repository. It is not a receipt
// and is never installed.
async function verifyInventory(root,expected){
 const directories=new Set(['']);for(const file of expected){let directory=path.posix.dirname(file);while(directory!=='.'){directories.add(directory);directory=path.posix.dirname(directory);}}
 async function visit(relative){for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const file=relative?`${relative}/${entry.name}`:entry.name;if(file==='README.md'&&entry.isFile())continue;if(entry.isDirectory()&&directories.has(file))await visit(file);else if(!entry.isFile()||!expected.has(file))fail(`Unexpected bundle file: ${file}`);}}
 await visit('');
}
// Metadata-only listing is cheap. Installation uses this full, bounded check,
// retaining verified bytes so a later filesystem edit cannot race the copy.
export async function readExampleBundle(directory){
 const manifest=await readExampleManifest(directory),worldBytes=await containedBytes(directory,manifest.world.file,8*1024*1024);
 if(worldBytes.length!==manifest.world.bytes||digest(worldBytes)!==manifest.world.sha256)fail('Example world hash or size mismatch');
 const world=JSON.parse(worldBytes.toString('utf8'));
 // Height samples load before validation: counting scatters builds the terrain.
 const heightmap=heightmapOf(world);let heightBytes=null;
 if(heightmap||manifest.height){
  if(!heightmap||!manifest.height||heightmap.height.file!==manifest.height.file||heightmap.height.sha256!==manifest.height.sha256||canonical(heightmap.size)!==canonical(manifest.height.size))fail('Example terrain height does not match its world');
  heightBytes=await containedBytes(directory,manifest.height.file,HEIGHT_FILE_BYTES);if(heightBytes.length!==manifest.height.bytes)fail('Example terrain height size mismatch');
  admitHeight(heightmap,heightBytes);
 }
 validateWorld(world);portableMetadata(world);
 if(canonical(manifest.capabilities)!==canonical({schemaVersion:world.schemaVersion,runtimeVersion:world.scene.runtime.version,modules:[...world.scene.runtime.modules].sort()}))fail('Example capability receipt does not match its world');
 if(world.schemaVersion!==2||world.revision!==0||world.bible.title!==manifest.title||(world.references||[]).length||world.bible.referenceIds?.length)fail('Example must be an independent schema-v2 revision-zero world without references');
 if(world.scene.moodboard&&(world.scene.moodboard.page!==0||world.scene.moodboard.title!=='World board'))fail('Example mood board must start empty');
 const byId=new Map(manifest.assets.map(asset=>[asset.id,asset]));if(byId.size!==world.scene.assets.length)fail('Example assets do not match its world');
 let total=heightBytes?.length??0,previewBytes;const assets=Object.create(null),blobs=new Map(),expected=new Set(['example.json',manifest.world.file,...(heightBytes?[manifest.height.file]:[])]);
 if(manifest.preview){previewBytes=(await verifiedPreview(directory,manifest.preview)).bytes;expected.add(manifest.preview.file);}
 for(const asset of world.scene.assets){
  const pinned=byId.get(asset.id);if(!pinned||asset.file!==pinned.file)fail('Example asset mapping mismatch');expected.add(pinned.file);
  let bytes=blobs.get(pinned.sha256);if(!bytes){bytes=await containedBytes(directory,pinned.file,MAX_ASSET_BYTES);if(bytes.length!==pinned.bytes||digest(bytes)!==pinned.sha256)fail('Example asset hash or size mismatch');blobs.set(pinned.sha256,bytes);}else if(bytes.length!==pinned.bytes)fail('Example asset size mismatch');
  total+=bytes.length;if(total>128*1024*1024)fail('Example exceeds 128 MiB of assets');assets[asset.id]={hash:pinned.sha256,file:pinned.file,...inspectGlb(bytes,asset.foliage,asset.flow),bytes};
 }
 const wanted=terrainTextureFiles(world.scene.terrain),listed=new Map((manifest.textures||[]).map(t=>[t.file,t])),textures=Object.create(null);
 if(wanted.size!==listed.size||[...wanted.keys()].some(file=>!listed.has(file)))fail('Example terrain textures do not match its world');
 for(const pinned of listed.values()){
  const bytes=await containedBytes(directory,pinned.file,TERRAIN_LAYER_LIMITS.textureBytes),size=pngInfo(bytes);
  if(bytes.length!==pinned.bytes||digest(bytes)!==pinned.sha256||size.width!==pinned.width||size.height!==pinned.height)fail('Example terrain texture hash or size mismatch');
  total+=bytes.length;if(total>128*1024*1024)fail('Example exceeds 128 MiB of assets');expected.add(pinned.file);textures[pinned.file]={...size,bytes:bytes.length,content:bytes};
 }
 if(wanted.size)checkTerrainTextures(world.scene.terrain,textures);
 if(placedSourceTriangles(world.scene,assets)>MAX_PLACED_TRIANGLES)fail('Example exceeds two million placed source triangles');await verifyInventory(directory,expected);return {manifest,world,assets,textures,height:heightBytes?{...manifest.height,content:heightBytes}:null,previewBytes};
}
export async function createExampleBundle(root,{out,revision,id,title,description,authoring={intent:'',rules:''},preview}={}){
 if(typeof out!=='string'||!out.trim())fail('Choose a new example bundle directory');const output=path.resolve(out);await absent(output);exact(authoring,['intent','rules'],'public authoring');
 if(typeof authoring.intent!=='string'||typeof authoring.rules!=='string')fail('Supply public intent and rules as strings');
 const accepted=await readRevisionBundle(root,revision);if(accepted.world.schemaVersion!==2)fail('Example bundles require schema version 2');
 const world=structuredClone(accepted.world);world.revision=0;world.bible={title,intent:authoring.intent,rules:authoring.rules};world.references=[];
 if(world.scene.moodboard){world.scene.moodboard.page=0;world.scene.moodboard.title='World board';}
 // Terrain layer PNGs come from their pinned blobs under content-addressed names, as GLBs do.
 const textureBlobs=new Map();
 if(terrainTextureFiles(world.scene.terrain).size){
  world.scene.terrain=renameTerrainTextures(world.scene.terrain,file=>{const pinned=accepted.textures?.[file];if(!hashPattern.test(pinned?.hash))fail(`Terrain texture ${file} has no pinned receipt`);return `assets/imports/terrain/${pinned.hash}.png`;});
  for(const pinned of Object.values(accepted.textures)){
   if(textureBlobs.has(pinned.hash))continue;const bytes=await containedBytes(root,`.holodeck/blobs/${pinned.hash}.png`,TERRAIN_LAYER_LIMITS.textureBytes);
   if(digest(bytes)!==pinned.hash)fail('Pinned terrain texture changed before example copy');textureBlobs.set(pinned.hash,{bytes,...pngInfo(bytes)});
  }
 }
 const textures=[...textureBlobs].map(([hash,t])=>({file:`assets/imports/terrain/${hash}.png`,sha256:hash,bytes:t.bytes.length,width:t.width,height:t.height})).sort((a,b)=>a.file.localeCompare(b.file));
 // A heightmap's samples come from their pinned blob under their hash.
 let heightBytes=null,heightReceipt=null;
 if(world.scene.terrain?.type==='heightmap'){
  const hash=world.scene.terrain.height.sha256,file=`assets/imports/terrain/${hash}.r32`;
  heightBytes=await containedBytes(root,heightBlob(hash),HEIGHT_FILE_BYTES);if(digest(heightBytes)!==hash)fail('Pinned terrain height changed before example copy');
  world.scene.terrain={...world.scene.terrain,height:{...world.scene.terrain.height,file}};heightReceipt={file,sha256:hash,bytes:heightBytes.length,size:[...world.scene.terrain.size]};
 }
 const needed=new Set([world.scene.origin,...world.scene.objects.map(item=>item.asset).filter(Boolean),...(world.scene.scatters||[]).flatMap(s=>s.variants.map(v=>v.asset)),...(world.scene.moodboard?[world.scene.moodboard.asset]:[])]),assets=[],blobs=new Map();
 world.scene.assets=world.scene.assets.filter(asset=>needed.has(asset.id)).map(asset=>{
  const hash=accepted.assets[asset.id].hash,file=`assets/imports/${hash}.glb`,provenance=publicProvenance(asset.provenance);assets.push({id:asset.id,file,sha256:hash,bytes:accepted.assets[asset.id].bytes});return {id:asset.id,file,...(provenance?{provenance}:{}),...(asset.foliage?{foliage:structuredClone(asset.foliage)}:{}),...(asset.flow?{flow:structuredClone(asset.flow)}:{}),...(asset.reflection?{reflection:asset.reflection}:{})};
 });
 validateWorld(world);portableMetadata(world);const worldBytes=Buffer.from(JSON.stringify(world,null,2)+'\n');
 let previewBytes,previewReceipt;if(preview!==undefined){if(typeof preview!=='string'||!preview)fail('Choose a local runtime preview PNG');const info=await lstat(preview);if(!info.isFile()||info.size>MAX_PREVIEW_BYTES)fail('Example preview must be a bounded PNG file');previewBytes=await readFile(preview);previewReceipt={file:'preview.png',sha256:digest(previewBytes),bytes:previewBytes.length,...inspectPng(previewBytes)};}
 const body={format:'holodeck-example-v1',id,title,description,sourceRevision:accepted.world.revision,capabilities:{schemaVersion:2,runtimeVersion:world.scene.runtime.version,modules:[...world.scene.runtime.modules].sort()},world:{file:'world/world.json',sha256:digest(worldBytes),bytes:worldBytes.length},assets:assets.sort((a,b)=>a.id.localeCompare(b.id)),...(textures.length?{textures}:{}),...(heightReceipt?{height:heightReceipt}:{}),...(previewReceipt?{preview:previewReceipt}:{})},manifest={...body,integrity:digest(canonical(body))};validateManifest(manifest);
 for(const asset of world.scene.assets){const pinned=accepted.assets[asset.id];let bytes=blobs.get(pinned.hash);if(!bytes){bytes=await containedBytes(root,`.holodeck/blobs/${pinned.hash}.glb`,MAX_ASSET_BYTES);if(bytes.length!==pinned.bytes||digest(bytes)!==pinned.hash)fail('Pinned asset changed before example copy');blobs.set(pinned.hash,bytes);}inspectGlb(bytes,asset.foliage);}
 if(placedSourceTriangles(world.scene,accepted.assets)>MAX_PLACED_TRIANGLES)fail('Example exceeds two million placed source triangles');
 await mkdir(output);await writeFile(path.join(output,'EXAMPLE-INCOMPLETE.txt'),'Example bundle creation did not finish. Choose a fresh output directory.\n',{flag:'wx'});await mkdir(path.join(output,'world'));await mkdir(path.join(output,'assets/imports'),{recursive:true});
 for(const [hash,bytes] of blobs)await writeFile(path.join(output,`assets/imports/${hash}.glb`),bytes,{flag:'wx'});
 if(textureBlobs.size||heightBytes)await mkdir(path.join(output,'assets/imports/terrain'));
 for(const [hash,t] of textureBlobs)await writeFile(path.join(output,`assets/imports/terrain/${hash}.png`),t.bytes,{flag:'wx'});
 if(heightBytes)await writeFile(path.join(output,heightReceipt.file),heightBytes,{flag:'wx'});
 if(previewBytes)await writeFile(path.join(output,'preview.png'),previewBytes,{flag:'wx'});
 await writeFile(path.join(output,'world/world.json'),worldBytes,{flag:'wx'});await writeFile(path.join(output,'example.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});await unlink(path.join(output,'EXAMPLE-INCOMPLETE.txt'));return manifest;
}
// A repaired revision of an asset the bundle already pins replaces it in place: the GLB, the world's
// pin and the receipts change, and sourceRevision stays, since the scene itself was not re-authored.
export async function repinExampleAsset(directory,{assetId,revisionId,bytes}={}){
 if(typeof assetId!=='string'||typeof revisionId!=='string'||!/^[a-zA-Z0-9_.@ -]{1,160}$/.test(revisionId)||!Buffer.isBuffer(bytes))fail('Supply the asset ID, its new revision ID and the GLB bytes');
 const bundle=await readExampleBundle(directory),{manifest,world}=bundle,entries=world.scene.assets.filter(asset=>asset.provenance?.assetId===assetId);
 if(!entries.length)return null;const sha256=digest(bytes),file=`assets/imports/${sha256}.glb`,from=[...new Set(entries.map(asset=>asset.provenance.revisionId))];
 if(entries.every(asset=>asset.file===file&&asset.provenance.revisionId===revisionId))return {id:manifest.id,assets:entries.map(asset=>asset.id),from,revisionId,sha256,bytes:bytes.length,changed:false};
 if(bytes.length>MAX_ASSET_BYTES)fail('Repaired GLB exceeds the asset size limit');const metrics={...bundle.assets};
 for(const asset of entries){metrics[asset.id]={hash:sha256,file,...inspectGlb(bytes,asset.foliage,asset.flow),bytes};asset.file=file;asset.provenance.revisionId=revisionId;}
 validateWorld(world);portableMetadata(world);if(placedSourceTriangles(world.scene,metrics)>MAX_PLACED_TRIANGLES)fail('Repaired asset takes the example past two million placed source triangles');
 const worldBytes=Buffer.from(JSON.stringify(world,null,2)+'\n'),ids=new Set(entries.map(asset=>asset.id)),{integrity,...body}=manifest;
 body.world={...body.world,sha256:digest(worldBytes),bytes:worldBytes.length};body.assets=body.assets.map(asset=>ids.has(asset.id)?{id:asset.id,file,sha256,bytes:bytes.length}:asset);
 const next={...body,integrity:digest(canonical(body))};validateManifest(next);const kept=new Set(next.assets.map(asset=>asset.file)),dropped=new Set(manifest.assets.map(asset=>asset.file).filter(old=>!kept.has(old)));
 const marker=path.join(directory,'EXAMPLE-INCOMPLETE.txt');await writeFile(marker,'An asset re-pin did not finish. Restore this bundle from version control and run it again.\n',{flag:'wx'});
 await writeFile(path.join(directory,file),bytes);await writeFile(path.join(directory,'world/world.json'),worldBytes);await writeFile(path.join(directory,'example.json'),JSON.stringify(next,null,2)+'\n');
 for(const old of dropped)await unlink(path.join(directory,old));await unlink(marker);await readExampleBundle(directory);
 return {id:manifest.id,assets:[...ids],from,revisionId,sha256,bytes:bytes.length,changed:true};
}
export async function installExampleBundle(directory,destination){
 const output=path.resolve(destination);await absent(output);const {manifest,world,assets,textures,height,previewBytes}=await readExampleBundle(directory);
 await mkdir(output);await writeFile(path.join(output,'INSTALL-INCOMPLETE.txt'),'Example installation did not finish. Choose a fresh workspace directory.\n',{flag:'wx'});
 for(const name of ['world','assets/imports','assets/source','references/files',...(Object.keys(textures).length||height?['assets/imports/terrain']:[])])await mkdir(path.join(output,name),{recursive:true});const copied=new Set();
 for(const asset of Object.values(assets)){if(copied.has(asset.file))continue;await writeFile(path.join(output,asset.file),asset.bytes,{flag:'wx'});copied.add(asset.file);}
 for(const [file,texture] of Object.entries(textures))await writeFile(path.join(output,file),texture.content,{flag:'wx'});
 if(height)await writeFile(path.join(output,height.file),height.content,{flag:'wx'});
 await installWorldSkills(output,world);
 await writeFile(path.join(output,'AGENTS.md'),`# Holodeck example workspace\n\nUse the installed Holodeck skills and world_read/world_propose. ${SKILLS_GUIDE} This is a new editable revision history. Exact GLBs and public scene guidance came from a validated local example bundle; sessions, reference attachments and source authoring files were not copied. Never edit installed packages.\n${KILN_GUIDE}\n`,{flag:'wx'});
 if(previewBytes)await writeFile(path.join(output,'EXAMPLE-preview.png'),previewBytes,{flag:'wx'});
 await writeFile(path.join(output,'EXAMPLE.json'),JSON.stringify({format:'holodeck-example-install-v1',id:manifest.id,integrity:manifest.integrity,sourceRevision:manifest.sourceRevision,...(manifest.preview?{preview:{...manifest.preview,file:'EXAMPLE-preview.png'}}:{})},null,2)+'\n',{flag:'wx'});
 await writeFile(path.join(output,'world/world.json'),JSON.stringify(world,null,2)+'\n',{flag:'wx'});await unlink(path.join(output,'INSTALL-INCOMPLETE.txt'));return world;
}
