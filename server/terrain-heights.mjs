import {createHash} from 'node:crypto';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {validateTerrain,decodeHeightSamples,checkHeightSamples,registerHeightSamples,HEIGHTMAP_LIMITS} from '../src/world/terrain.mjs';

// Heightmap samples on the Node side. A heightmap record names its height file
// and that file's sha256; the host pins the bytes as .holodeck/blobs/<sha256>.r32,
// beside the GLB and terrain PNG blobs, and every reader verifies them against
// the record before the terrain is built from them.
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const heightBlob=hash=>`.holodeck/blobs/${hash}.r32`;
export const heightUrl=hash=>`/api/heights/${hash}.r32`;
export const HEIGHT_FILE_BYTES=HEIGHTMAP_LIMITS.bytes;

// The world's heightmap terrain record, structurally validated, or null.
export function heightmapOf(world){
 const terrain=world?.scene?.terrain;
 return terrain?.type==='heightmap'?validateTerrain(terrain):null;
}
// Admits the bytes a heightmap names: their count, their sha256 against the
// record, finite samples and the elevation range after scale and offset. The
// decoded samples are registered so the terrain can be built; the receipt
// records the pinned file like the GLB and texture receipts do.
export function admitHeight(terrain,bytes,url=heightUrl(terrain.height.sha256)){
 const {file,sha256}=terrain.height,[nx,nz]=terrain.size,expected=nx*nz*4;
 if(bytes.length!==expected)throw new Error(`Terrain height ${file} has ${bytes.length} bytes; size [${nx},${nz}] needs ${expected} (little-endian float32)`);
 const actual=digest(bytes);
 if(actual!==sha256)throw new Error(`Terrain height ${file} does not match terrain.height.sha256: the file hashes to ${actual.slice(0,12)}…, the record names ${sha256.slice(0,12)}…. Write new samples under a new file name and propose its sha256.`);
 const samples=decodeHeightSamples(bytes,terrain.size);checkHeightSamples(terrain,samples);registerHeightSamples(sha256,samples);
 return {file,hash:sha256,url,bytes:bytes.length,size:[nx,nz]};
}
// Loads a workspace world's height samples outside a running host (check,
// launch): the file the record names or, with pinnedFirst, its pinned blob.
export async function loadWorkspaceHeight(root,world,{pinnedFirst=false}={}){
 const terrain=heightmapOf(world);if(!terrain)return null;
 const base=await realpath(root),candidates=pinnedFirst?[heightBlob(terrain.height.sha256),terrain.height.file]:[terrain.height.file];
 for(const file of candidates){
  let target;try{target=await realpath(path.resolve(base,file));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const relative=path.relative(base,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Terrain height resolves outside the world workspace');
  const info=await stat(target);if(!info.isFile()||info.size>HEIGHT_FILE_BYTES)throw new Error(`Terrain height ${file} is not a file of at most ${HEIGHT_FILE_BYTES} bytes`);
  return admitHeight(terrain,await readFile(target));
 }
 throw new Error(`Terrain height ${terrain.height.file} is missing`);
}
