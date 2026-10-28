import { EventEmitter } from 'node:events';
import { watch } from 'node:fs';
import { mkdir, readFile, writeFile, rename, realpath, stat, unlink, open, readdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WORLD, MAX_ASSET_BYTES, validateWorld, validateGlb } from '../src/world/contract.mjs';
import {MAX_PLACED_TRIANGLES,placedSourceTriangles} from '../src/world/asset-budget.mjs';
import {terrainTextureFiles,checkTerrainTextures,pngInfo,renameTerrainTextures,TERRAIN_LAYER_LIMITS} from '../src/world/terrain-layers.mjs';
import {retainHeightSamples,releaseHeightSamples} from '../src/world/terrain.mjs';
import {heightmapOf,admitHeight,heightBlob,HEIGHT_FILE_BYTES} from './terrain-heights.mjs';
import { installStarter } from './starter.mjs';
import { KILN_GUIDE } from './world-guide.mjs';
const packageRoot=fileURLToPath(new URL('../',import.meta.url));
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// "references/files/tropical/02-eye-level.png" becomes "Eye level".
export function referenceTitle(file){
  const stem=path.basename(file,path.extname(file)),words=stem.replace(/^\d+[-_. ]+/,'').replace(/[-_]+/g,' ').trim()||stem;
  return (words.charAt(0).toUpperCase()+words.slice(1)).slice(0,160);
}
export async function atomicJson(file,value){
  await mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.${randomUUID()}.tmp`;
  try{await writeFile(tmp,JSON.stringify(value,null,2)+'\n');await rename(tmp,file);}finally{await unlink(tmp).catch(()=>{});}
}
export class WorldStore extends EventEmitter {
  constructor(root){super();this.root=path.resolve(root);this.queue=Promise.resolve();this.hashes={};this.textures={};this.height=null;this.retainedHeight=null;this.diagnostic=null;this.closed=false;}
  static async open(root){const s=new WorldStore(root);await s.init();return s;}
  snapshot(){return structuredClone(this.current);}
  payload(){return {world:this.snapshot(),assets:this.hashes,textures:this.textures,height:this.height,workspace:this.root,diagnostic:this.diagnostic};}
  serial(work){const next=this.queue.then(work);this.queue=next.catch(()=>{});return next;}
  async init(){
    for(const dir of ['world','assets/imports','assets/source','references/files','reviews','.holodeck/history','.holodeck/blobs','.holodeck/session'])await mkdir(path.join(this.root,dir),{recursive:true});
    this.file=path.join(this.root,'world/world.json');this.accepted=path.join(this.root,'.holodeck/accepted.json');
    this.lockfile=path.join(this.root,'.holodeck/host.lock');
    try{const pid=Number(await readFile(this.lockfile,'utf8'));let running=false;try{process.kill(pid,0);running=true;}catch(e){if(e.code!=='ESRCH')running=true;}if(running)throw new Error('This world is already open in another local host');await unlink(this.lockfile);}catch(e){if(e.code!=='ENOENT')throw e;}
    const lock=await open(this.lockfile,'wx');await lock.writeFile(String(process.pid));await lock.close();
    try{
      let cached;try{cached=JSON.parse(await readFile(path.join(this.root,'.holodeck/accepted-bundle.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
      if(cached){
        // Height samples load before validation: scatter counts need the terrain.
        const cachedHeight=heightmapOf(cached.world);
        if(cachedHeight){
          if(cached.height?.hash!==cachedHeight.height.sha256)throw new Error('Cached accepted terrain height receipt is invalid');
          admitHeight(cachedHeight,await readFile(await this.contained(heightBlob(cached.height.hash))));
        }
        validateWorld(cached.world);
        for(const asset of cached.world.scene.assets){
          const hash=cached.assets?.[asset.id]?.hash;if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('Cached accepted asset receipt is invalid');
          const bytes=await readFile(await this.contained(`.holodeck/blobs/${hash}.glb`));validateGlb(bytes,{foliage:asset.foliage,flow:asset.flow});if(digest(bytes)!==hash)throw new Error('Cached accepted asset is corrupt');
        }
        for(const [file,texture] of Object.entries(cached.textures||{})){
          if(!/^[a-f0-9]{64}$/.test(texture?.hash))throw new Error('Cached accepted terrain texture receipt is invalid');
          const bytes=await readFile(await this.contained(`.holodeck/blobs/${texture.hash}.png`));pngInfo(bytes);if(digest(bytes)!==texture.hash)throw new Error(`Cached accepted terrain texture is corrupt: ${file}`);
        }
      }
      let w,hashes,textures,height,offlineError;
      try{
        try{w=JSON.parse(await readFile(this.file,'utf8'));}catch(e){
          if(e.code!=='ENOENT'||cached)throw e;
          w=await installStarter(this.root);await atomicJson(this.file,w);
        }
        ({assets:hashes,textures,height}=await this.prepareBundle(w));
      }catch(e){if(!cached)throw e;offlineError=e;}
      if(cached){
        // Reopening cannot rewrite the historical binding of an accepted revision.
        // Valid offline edits are a new commit; incomplete writes retain the cache.
        this.current=cached.world;this.hashes=cached.assets;this.textures=cached.textures||{};await this.adoptHeight(cached.world,cached.height??null);
        if(offlineError)this.diagnostic=`${offlineError.message}; showing cached accepted revision`;
        else if(JSON.stringify({...w,revision:cached.world.revision})!==JSON.stringify(cached.world)||JSON.stringify(hashes)!==JSON.stringify(cached.assets)||JSON.stringify(textures)!==JSON.stringify(cached.textures||{})||JSON.stringify(height)!==JSON.stringify(cached.height??null)){
          const scene=structuredClone(w.scene);for(const asset of scene.assets)if(hashes[asset.id].hash!==cached.assets[asset.id]?.hash)delete asset.provenance;
          await this.apply({baseRevision:cached.world.revision,scene,bible:w.bible,references:w.references||[]});
        }else if(w.revision!==cached.world.revision)await atomicJson(this.file,cached.world);
      }else{
        this.current=w;this.hashes=hashes;this.textures=textures;await this.adoptHeight(w,height);await atomicJson(this.accepted,w);await atomicJson(path.join(this.root,`.holodeck/history/${w.revision}.json`),w);await this.checkpoint(w,hashes,textures,height);
      }
      this.lastRead=digest(await readFile(this.file).catch(e=>{if(e.code==='ENOENT')return Buffer.alloc(0);throw e;}));
      await writeFile(path.join(this.root,'AGENTS.md'),`# Holodeck world workspace\n\nUse the Holodeck world_read and world_propose tools for scene and bible edits.\nworld/world.json is the coherent scene and bible document. Proposals carry its base revision.\nAssets must be self-contained GLBs in assets/imports. Never edit installed Holodeck or Kiln engine code.\nPreserve accepted bible rules, stable object IDs and pinned Kiln provenance.\nOnly construct, meadow, woodland, static GLB placements and box blockers are supported initially.\nUse world_observe for displayed revision and browser measurements. A saved revision is not proof of browser acceptance.\n${KILN_GUIDE}\n`,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
      this.watcher=watch(path.join(this.root,'world'),()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.readExternal().catch(e=>{this.diagnostic=e.message;this.emit('diagnostic',e.message);}),300);});
      this.assetWatcher=watch(path.join(this.root,'assets/imports'),{recursive:true},()=>{clearTimeout(this.assetTimer);this.assetTimer=setTimeout(()=>this.refreshAssets().catch(e=>{this.diagnostic=e.message;this.emit('diagnostic',e.message);}),500);});
    }catch(e){await unlink(this.lockfile).catch(()=>{});throw e;}
  }
  async contained(file){
    const target=await realpath(path.resolve(this.root,file)),root=await realpath(this.root),rel=path.relative(root,target);
    if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Asset resolves outside the world workspace');return target;
  }
  async prepare(world){return (await this.prepareBundle(world)).assets;}
  // Pins every GLB, terrain texture and terrain height file by hash and checks
  // the shared budgets.
  async prepareBundle(world){
    // A heightmap's samples load first: validating scatters builds the terrain.
    const heightmap=heightmapOf(world);let height=null,heightBytes=null;
    if(heightmap){
      const file=await this.contained(heightmap.height.file),info=await stat(file);
      if(!info.isFile()||info.size>HEIGHT_FILE_BYTES)throw new Error(`Terrain height ${heightmap.height.file} is not a file of at most ${HEIGHT_FILE_BYTES} bytes`);
      heightBytes=await readFile(file);height=admitHeight(heightmap,heightBytes);
    }
    validateWorld(world);const assets={},textures={};let total=0;
    for(const reference of world.references||[]){if(reference.kind==='note')continue;const file=await this.contained(reference.file),info=await stat(file);if(info.size>12*1024*1024)throw new Error('Reference exceeds 12 MiB');const bytes=await readFile(file);if(digest(bytes)!==path.parse(reference.file).name)throw new Error('Pinned reference content changed; import a new revision');}
    for(const a of world.scene.assets){
      const file=await this.contained(a.file),info=await stat(file);if(!info.isFile()||info.size>MAX_ASSET_BYTES)throw new Error('Asset exceeds 32 MiB');
      const bytes=await readFile(file),metrics=validateGlb(bytes,{foliage:a.foliage,flow:a.flow});total+=bytes.length;if(total>128*1024*1024)throw new Error('World exceeds 128 MiB of asset files');
      const hash=digest(bytes),cached=path.join(this.root,`.holodeck/blobs/${hash}.glb`);
      await writeFile(cached,bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
      assets[a.id]={hash,url:`/api/assets/${hash}.glb`,...metrics};
    }
    if(placedSourceTriangles(world.scene,assets)>MAX_PLACED_TRIANGLES)throw new Error('Placed world exceeds two million source triangles');
    // Terrain textures count inside the 128 MiB world budget, at most 32 MiB of it.
    for(const file of terrainTextureFiles(world.scene.terrain).keys()){
      const target=await this.contained(file),info=await stat(target);if(!info.isFile()||info.size>TERRAIN_LAYER_LIMITS.textureBytes)throw new Error('Terrain textures exceed 32 MiB of PNG files');
      const bytes=await readFile(target),{width,height}=pngInfo(bytes);total+=bytes.length;if(total>128*1024*1024)throw new Error('World exceeds 128 MiB of asset files');
      const hash=digest(bytes);await writeFile(path.join(this.root,`.holodeck/blobs/${hash}.png`),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
      textures[file]={hash,url:`/api/textures/${hash}.png`,width,height,bytes:bytes.length};
    }
    checkTerrainTextures(world.scene.terrain,textures);
    // The height file counts inside the same 128 MiB world budget.
    if(height){
      total+=height.bytes;if(total>128*1024*1024)throw new Error('World exceeds 128 MiB of asset files');
      await writeFile(path.join(this.root,heightBlob(height.hash)),heightBytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    }
    return {assets,textures,height};
  }
  // The accepted world's height samples stay resident while it is current.
  async adoptHeight(world,height){
    const next=height?.hash??null;
    if(next!==this.retainedHeight){
      if(next&&!retainHeightSamples(next)){admitHeight(heightmapOf(world),await readFile(path.join(this.root,heightBlob(next))));retainHeightSamples(next);}
      if(this.retainedHeight)releaseHeightSamples(this.retainedHeight);
      this.retainedHeight=next;
    }
    this.height=height;
  }
  async checkpoint(world,assets,textures={},height=null){const bundle={world,assets,...(Object.keys(textures).length?{textures}:{}),...(height?{height}:{})};await atomicJson(path.join(this.root,`.holodeck/history/${world.revision}.bundle.json`),bundle);await atomicJson(path.join(this.root,'.holodeck/accepted-bundle.json'),bundle);}
  commit(change){return this.serial(()=>this.apply(change));}
  async apply({baseRevision,scene,bible,references}){
    if(baseRevision!==this.current.revision)throw new Error('World changed; reload the latest revision before saving');
    const next={schemaVersion:this.current.schemaVersion,revision:this.current.revision+1,scene:scene??this.current.scene,bible:bible??this.current.bible,references:references??this.current.references??[]};
    const {assets,textures,height}=await this.prepareBundle(next);
    await atomicJson(path.join(this.root,`.holodeck/history/${next.revision}.json`),next);
    await atomicJson(this.file,next);await atomicJson(this.accepted,next);
    await this.checkpoint(next,assets,textures,height);
    this.lastRead=digest(await readFile(this.file));this.current=next;this.hashes=assets;this.textures=textures;await this.adoptHeight(next,height);this.diagnostic=null;
    this.emit('world',this.payload());return this.payload();
  }
  readExternal(){return this.serial(async()=>{
    const raw=await readFile(this.file),hash=digest(raw);if(hash===this.lastRead)return;
    this.lastRead=hash;const value=JSON.parse(raw);validateWorld(value);
    return this.apply({baseRevision:value.revision,scene:value.scene,bible:value.bible,references:value.references});
  });}
  refreshAssets(){return this.serial(async()=>{
    const {assets:hashes,textures,height}=await this.prepareBundle(this.current);
    if(JSON.stringify(hashes)!==JSON.stringify(this.hashes)||JSON.stringify(textures)!==JSON.stringify(this.textures)||JSON.stringify(height)!==JSON.stringify(this.height)){
      const scene=structuredClone(this.current.scene);for(const asset of scene.assets)if(hashes[asset.id].hash!==this.hashes[asset.id]?.hash)delete asset.provenance;
      return this.apply({baseRevision:this.current.revision,scene});
    }
  });}
  undo(baseRevision){return this.serial(async()=>{
    if(baseRevision!==this.current.revision)throw new Error('World changed; reload before undo');
    const prev=JSON.parse(await readFile(path.join(this.root,`.holodeck/history/${baseRevision-1}.json`),'utf8'));
    const receipt=await readFile(path.join(this.root,`.holodeck/history/${baseRevision-1}.bundle.json`),'utf8').then(JSON.parse).catch(()=>null);
    if(receipt)for(const asset of prev.scene.assets){const hash=receipt.assets[asset.id].hash;const bytes=await readFile(path.join(this.root,`.holodeck/blobs/${hash}.glb`));asset.file=`assets/imports/restored-${hash}.glb`;await writeFile(path.join(this.root,asset.file),bytes);}
    // A heightmap names its own hash; its pinned blob is restored under that hash.
    if(prev.scene.terrain?.type==='heightmap'){
      const hash=prev.scene.terrain.height.sha256,file=`assets/imports/terrain/restored-${hash}.r32`;
      await mkdir(path.join(this.root,'assets/imports/terrain'),{recursive:true});
      await writeFile(path.join(this.root,file),await readFile(path.join(this.root,heightBlob(hash))));
      prev.scene.terrain={...prev.scene.terrain,height:{...prev.scene.terrain.height,file}};
    }
    if(receipt?.textures&&prev.scene.terrain){
      await mkdir(path.join(this.root,'assets/imports/terrain'),{recursive:true});
      for(const texture of Object.values(receipt.textures)){const bytes=await readFile(path.join(this.root,`.holodeck/blobs/${texture.hash}.png`));await writeFile(path.join(this.root,`assets/imports/terrain/restored-${texture.hash}.png`),bytes);}
      prev.scene.terrain=renameTerrainTextures(prev.scene.terrain,file=>`assets/imports/terrain/restored-${receipt.textures[file].hash}.png`);
    }
    return this.apply({baseRevision,scene:prev.scene,bible:prev.bible,references:prev.references||[]});
  });}
  async importAsset(bytes,name='asset.glb'){
    validateGlb(bytes);const hash=digest(bytes),safe=name.replace(/\.glb$/i,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,40)||'asset';
    const file=`assets/imports/${safe}-${hash.slice(0,12)}.glb`;
    await writeFile(path.join(this.root,file),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    return {id:`asset-${hash.slice(0,12)}`,file};
  }
  async importReference(bytes,name='Reference'){
    if(bytes.length<33||bytes.length>12*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)>4096||bytes.readUInt32BE(20)>4096||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20))throw new Error('Import a PNG up to 4096 pixels and 12 MiB');
    const hash=digest(bytes),file=`references/files/${hash}.png`;await writeFile(path.join(this.root,file),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    return {id:`ref-${hash.slice(0,12)}`,file,title:name.slice(0,160),notes:''};
  }
  async importFile(bytes,name){
    const ext=path.extname(name).toLowerCase();if(!['.md','.txt','.json','.pdf','.glb'].includes(ext)||!bytes.length||bytes.length>12*1024*1024)throw new Error('Attach MD, TXT, JSON, PDF or GLB up to 12 MiB');
    const hash=digest(bytes),file=`references/files/${hash}${ext}`;await writeFile(path.join(this.root,file),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    return {id:`ref-${hash.slice(0,12)}`,kind:'file',file,title:name.slice(0,160),notes:''};
  }
  async linkReference(file){
    if(typeof file!=='string'||! /^(assets\/(source|imports)|references\/files)\/[-a-zA-Z0-9_./ ]+$/.test(file)||file.split('/').includes('..'))throw new Error('Choose a file inside assets/source, assets/imports or references/files');
    const target=await this.contained(file);if((await stat(target)).size>12*1024*1024)throw new Error('Reference exceeds 12 MiB');
    const bytes=await readFile(target),ref=file.endsWith('.png')?await this.importReference(bytes,path.basename(file)):await this.importFile(bytes,path.basename(file));return {...ref,title:referenceTitle(file),source:file};
  }
  async readReference(id){
    const ref=this.current.references?.find(r=>r.id===id);if(!ref)throw new Error('Reference is not on the accepted board');
    if(ref.kind==='note')return {reference:ref,text:ref.notes};
    const bytes=await readFile(await this.contained(ref.file));if(digest(bytes)!==path.parse(ref.file).name)throw new Error('Reference revision changed');
    if((ref.kind||'image')==='image')return {reference:ref,imageUrl:`data:image/png;base64,${bytes.toString('base64')}`};
    if(/\.(md|txt|json)$/.test(ref.file))return {reference:ref,text:bytes.subarray(0,128*1024).toString('utf8'),truncated:bytes.length>128*1024};
    return {reference:ref,bytes:bytes.length,note:'Binary attachment. Inspect the workspace file with a compatible tool; no text extraction is provided.'};
  }
  async catalog(){const files=await readdir(path.join(this.root,'assets/imports'));return files.filter(f=>f.endsWith('.glb')).map(f=>`assets/imports/${f}`);}
  async close(){if(this.closed)return;this.closed=true;clearTimeout(this.timer);clearTimeout(this.assetTimer);this.watcher?.close();this.assetWatcher?.close();await this.queue;if(this.retainedHeight){releaseHeightSamples(this.retainedHeight);this.retainedHeight=null;}await unlink(this.lockfile).catch(()=>{});}
}
