import {readFile,writeFile,mkdir,readdir,lstat,realpath,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readRevisionBundle} from './history.mjs';
import {validateWorld,validateGlb,MAX_ASSET_BYTES} from '../src/world/contract.mjs';

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

// A static artifact is an explicit scene-only projection of an accepted receipt.
// It never opens a WorldStore, loads host plugins or copies a workspace/public dir.
export async function exportStaticWorld(root,{out,revision}={}){
 if(typeof out!=='string'||!out.trim())throw new Error('Choose a new export directory with --out');
 const output=path.resolve(out);await absent(output);
 if(revision==null)try{await lstat(path.join(root,'.holodeck/accepted-bundle.json'));}catch(error){if(error.code==='ENOENT')throw new Error('Open this world with holodeck dev first to create an accepted snapshot.');throw error;}
 let receipt;
 try{receipt=await readRevisionBundle(root,revision);}catch(error){
  if(error.code==='ENOENT')throw new Error('That accepted revision or a pinned dependency is unavailable.');
  throw error;
 }
 if(receipt.world.schemaVersion!==2)throw new Error('Static export currently requires a schema v2 world with a registered runtime.');
 const world=structuredClone(receipt.world),scene=world.scene;
 world.bible={title:'Holodeck world',intent:'',rules:''};world.references=[];delete scene.moodboard;
 const needed=new Set([scene.origin,...scene.objects.map(o=>o.asset).filter(Boolean)]),assets={},blobs=new Map();
 scene.assets=scene.assets.filter(asset=>needed.has(asset.id)).map(asset=>{
  const hash=receipt.assets[asset.id].hash,file=`assets/imports/${hash}.glb`,provenance=publicProvenance(asset.provenance);
  assets[asset.id]={hash,url:`./${file}`};return {id:asset.id,file,...(provenance?{provenance}:{}),...(asset.foliage?{foliage:asset.foliage}:{})};
 });
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
 await mkdir(path.join(output,'assets/imports'),{recursive:true});
 for(const [hash,bytes] of blobs)await writeFile(path.join(output,`assets/imports/${hash}.glb`),bytes,{flag:'wx'});
 await writeFile(path.join(output,'scene.json'),JSON.stringify({format:'holodeck-view-v1',world,assets},null,2)+'\n',{flag:'wx'});
 await writeFile(path.join(output,'README.txt'),'Holodeck static scene\n\nUpload the entire directory to any static HTTP(S) host. Keep relative paths intact; subdirectory deployment is supported. No Node server, account, agent, or API endpoint is required. Open index.html through the host, not file://. HTTPS enables WebGPU where available; WebGL2 is the fallback. Add ?backend=webgl to force it.\n\nEnter world: WASD move, Shift run, Space jump and V first/third person when the scene has an inhabitant. G toggles free camera; Q/E descend/ascend there. E interacts while walking. Escape stops mouse capture and returns to the overlook. Right-drag works without mouse capture. The toolbar controls cove visibility, activity pause and return to arrival.\n\nThis artifact contains an accepted scene revision and exact pinned GLB bytes. Authoring prose, board references, agent history, credentials and source workspace files are excluded. Asset metadata embedded in the original GLBs is retained unchanged; publication rights remain the asset owner\'s responsibility. The manifest records SHA-256 hashes of every delivered file except itself.\n',{flag:'wx'});
 const files=(await fileInventory(output)).filter(entry=>entry.file!=='EXPORT-INCOMPLETE.txt'),manifest={format:'holodeck-static-v1',revision:world.revision,scope:'scene-only',assets:scene.assets.map(a=>({id:a.id,sha256:assets[a.id].hash,file:a.file,...(a.provenance?{provenance:a.provenance}:{})})),files};
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 await unlink(path.join(output,'EXPORT-INCOMPLETE.txt'));
 return {path:output,revision:world.revision,files:files.length+1,assets:scene.assets.length};
}
