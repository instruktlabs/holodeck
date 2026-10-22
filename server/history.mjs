import {readFile,readdir,stat,realpath,mkdir,writeFile,cp,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateWorld,validateGlb,MAX_ASSET_BYTES} from '../src/world/contract.mjs';
import {SKILLS_GUIDE,KILN_GUIDE} from './world-guide.mjs';
import {terrainTextureFiles,checkTerrainTextures,pngInfo,renameTerrainTextures,TERRAIN_LAYER_LIMITS} from '../src/world/terrain-layers.mjs';

const packageRoot=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const revisionId=value=>{if(!Number.isSafeInteger(value)||value<0)throw new Error('Choose a non-negative integer revision');return value;};
async function containedBytes(root,file,limit){
 const base=await realpath(root),target=await realpath(path.resolve(base,file)),relative=path.relative(base,target);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Snapshot dependency escapes the workspace');
 const info=await stat(target);if(!info.isFile()||info.size>limit)throw new Error('Snapshot dependency exceeds its size limit');
 return readFile(target);
}
function validateReceipt(receipt,revision){
 validateWorld(receipt.world);
 if(revision!==undefined&&receipt.world.revision!==revision)throw new Error('Snapshot revision does not match its receipt');
 if(!receipt.assets||typeof receipt.assets!=='object')throw new Error('Snapshot has no pinned asset receipt');
 for(const asset of receipt.world.scene.assets)if(!/^[a-f0-9]{64}$/.test(receipt.assets[asset.id]?.hash))throw new Error('Snapshot asset hash is missing or invalid');
 for(const file of terrainTextureFiles(receipt.world.scene.terrain).keys())if(!/^[a-f0-9]{64}$/.test(receipt.textures?.[file]?.hash))throw new Error('Snapshot terrain texture hash is missing or invalid');
}
// Accepted receipts bind a scene revision to its actual imported bytes, even
// when a mutable import path has subsequently been replaced or removed.
export async function readRevisionBundle(root,revision){
 const selected=revision==null?undefined:revisionId(revision);
 const file=selected===undefined?'.holodeck/accepted-bundle.json':`.holodeck/history/${selected}.bundle.json`;
 const receipt=JSON.parse((await containedBytes(root,file,8*1024*1024)).toString('utf8'));
 validateReceipt(receipt,selected);
 let total=0;const assets={};
 for(const asset of receipt.world.scene.assets){
  const pinned=receipt.assets[asset.id],bytes=await containedBytes(root,`.holodeck/blobs/${pinned.hash}.glb`,MAX_ASSET_BYTES);
  if(hash(bytes)!==pinned.hash)throw new Error(`Pinned asset hash mismatch: ${asset.id}`);
  total+=bytes.length;if(total>128*1024*1024)throw new Error('Snapshot exceeds the asset byte budget');
  assets[asset.id]={hash:pinned.hash,url:`/api/assets/${pinned.hash}.glb`,...validateGlb(bytes,{foliage:asset.foliage})};
 }
 const textures={};
 for(const file of terrainTextureFiles(receipt.world.scene.terrain).keys()){
  const pinned=receipt.textures[file],bytes=await containedBytes(root,`.holodeck/blobs/${pinned.hash}.png`,TERRAIN_LAYER_LIMITS.textureBytes);
  if(hash(bytes)!==pinned.hash)throw new Error(`Pinned terrain texture hash mismatch: ${file}`);
  total+=bytes.length;if(total>128*1024*1024)throw new Error('Snapshot exceeds the asset byte budget');
  textures[file]={hash:pinned.hash,url:`/api/textures/${pinned.hash}.png`,...pngInfo(bytes),bytes:bytes.length};
 }
 checkTerrainTextures(receipt.world.scene.terrain,textures);
 for(const reference of receipt.world.references||[]){
  if(reference.kind==='note')continue;
  const bytes=await containedBytes(root,reference.file,12*1024*1024);
  if(hash(bytes)!==path.parse(reference.file).name)throw new Error('Pinned reference content changed');
 }
 return {world:structuredClone(receipt.world),assets,...(Object.keys(textures).length?{textures}:{})};
}
export async function listRevisions(root){
 const files=await readdir(path.join(root,'.holodeck/history'));
 const revisions=files.filter(f=>/^\d+\.bundle\.json$/.test(f)).map(f=>Number(f.split('.')[0])).filter(Number.isSafeInteger).sort((a,b)=>b-a);
 const rows=[];
 for(const revision of revisions){
  const file=`.holodeck/history/${revision}.bundle.json`;
  try{
   const receipt=JSON.parse((await containedBytes(root,file,8*1024*1024)).toString('utf8'));validateReceipt(receipt,revision);
   rows.push({revision,title:receipt.world.bible.title,objects:receipt.world.scene.objects.length,assets:receipt.world.scene.assets.length,savedAt:(await stat(path.join(root,file))).mtime.toISOString()});
  }catch{rows.push({revision,unavailable:true,title:'Unreadable snapshot'});}
 }
 return rows;
}
async function materializeAssets(source,destination,bundle){
 const world=structuredClone(bundle.world),base=await realpath(destination);let directory=base;
 for(const name of ['assets','imports']){
  const candidate=path.join(directory,name);await mkdir(candidate).catch(error=>{if(error.code!=='EEXIST')throw error;});
  directory=await realpath(candidate);const relative=path.relative(base,directory);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Asset destination escapes the workspace');
 }
 for(const asset of world.scene.assets){
  const pinned=bundle.assets[asset.id],bytes=await containedBytes(source,`.holodeck/blobs/${pinned.hash}.glb`,MAX_ASSET_BYTES);
  if(hash(bytes)!==pinned.hash)throw new Error(`Pinned asset changed during copy: ${asset.id}`);
  asset.file=`assets/imports/snapshot-${pinned.hash}.glb`;
  try{await writeFile(path.join(directory,path.basename(asset.file)),bytes,{flag:'wx'});}catch(error){
   if(error.code!=='EEXIST')throw error;
   if(hash(await containedBytes(destination,asset.file,MAX_ASSET_BYTES))!==pinned.hash)throw new Error('Existing snapshot asset is corrupt');
  }
 }
 if(bundle.textures){
  const candidate=path.join(directory,'terrain');await mkdir(candidate).catch(error=>{if(error.code!=='EEXIST')throw error;});
  const textures=await realpath(candidate),relative=path.relative(base,textures);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Asset destination escapes the workspace');
  for(const pinned of Object.values(bundle.textures)){
   const bytes=await containedBytes(source,`.holodeck/blobs/${pinned.hash}.png`,TERRAIN_LAYER_LIMITS.textureBytes),file=`assets/imports/terrain/snapshot-${pinned.hash}.png`;
   if(hash(bytes)!==pinned.hash)throw new Error('Pinned terrain texture changed during copy');
   try{await writeFile(path.join(textures,path.basename(file)),bytes,{flag:'wx'});}catch(error){
    if(error.code!=='EEXIST')throw error;
    if(hash(await containedBytes(destination,file,TERRAIN_LAYER_LIMITS.textureBytes))!==pinned.hash)throw new Error('Existing snapshot terrain texture is corrupt');
   }
  }
  world.scene.terrain=renameTerrainTextures(world.scene.terrain,file=>`assets/imports/terrain/snapshot-${bundle.textures[file].hash}.png`);
 }
 return world;
}
export function restoreRevision(store,{baseRevision,revision}){
 return store.serial(async()=>{
  if(baseRevision!==store.current.revision)throw new Error('World changed; reload before restoring');
  const bundle=await readRevisionBundle(store.root,revisionId(revision));
  const world=await materializeAssets(store.root,store.root,bundle);
  return store.apply({baseRevision,scene:world.scene,bible:world.bible,references:world.references||[]});
 });
}
export async function remixRevision(root,revision,destination){
 const bundle=await readRevisionBundle(root,revisionId(revision));
 // mkdir without recursive refuses any existing destination, including symlinks.
 const output=path.resolve(destination);await mkdir(output);
 await writeFile(path.join(output,'REMIX-INCOMPLETE.txt'),'Remix did not finish. Do not open this workspace. Choose a fresh folder name to retry.\n',{flag:'wx'});
 const world=await materializeAssets(root,output,bundle);world.revision=0;
 for(const dir of ['world','assets/source','references/files'])await mkdir(path.join(output,dir),{recursive:true});
 const copiedReferences=new Set();
 for(const reference of world.references||[]){
  if(reference.kind==='note')continue;
  delete reference.source; // The pinned file is copied; its mutable source is not.
  if(copiedReferences.has(reference.file))continue;
  const bytes=await containedBytes(root,reference.file,12*1024*1024);
  if(hash(bytes)!==path.parse(reference.file).name)throw new Error('Pinned reference changed during remix');
  await writeFile(path.join(output,reference.file),bytes,{flag:'wx'});
  copiedReferences.add(reference.file);
 }
 await writeFile(path.join(output,'world/world.json'),JSON.stringify(world,null,2)+'\n');
 await cp(path.join(packageRoot,'skills'),path.join(output,'.agents/skills'),{recursive:true});
 await writeFile(path.join(output,'AGENTS.md'),`# Remixed Holodeck world\n\nUse the installed Holodeck skills and world_read/world_propose. ${SKILLS_GUIDE} This scene starts a new revision history. Imported assets retain exact saved bytes and source provenance; their external Kiln library and unversioned source files are not copied. Never edit installed engine packages.\n${KILN_GUIDE}\n`);
 await writeFile(path.join(output,'REMIX.json'),JSON.stringify({format:'holodeck-remix-v1',sourceRevision:bundle.world.revision,title:world.bible.title,assets:bundle.assets,...(bundle.textures?{textures:bundle.textures}:{}),includes:'Scene, bible, board references, pinned GLBs and terrain textures. No agent sessions, credentials, external Kiln library or unversioned source.'},null,2)+'\n');
 await unlink(path.join(output,'REMIX-INCOMPLETE.txt'));
 return {path:output,world};
}
