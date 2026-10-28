// Browser-only: loads a heightmap terrain's pinned samples before the world
// that names them is built. entry: {hash, url, bytes, size}. The bytes are
// checked against the hash where the page can compute SHA-256 (secure
// contexts, which include localhost and HTTPS), decoded and registered by
// hash, so the renderer and every support query build the same lattice.
import {decodeHeightSamples,registerHeightSamples,heightSamples,retainHeightSamples,releaseHeightSamples} from './terrain.mjs';

const pending=new Map();
async function sha256(buffer){
 const subtle=globalThis.crypto?.subtle;if(!subtle)return null;
 return [...new Uint8Array(await subtle.digest('SHA-256',buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function fetchSamples(entry,signal){
 const response=await fetch(entry.url,{signal});if(!response.ok)throw new Error('The terrain height samples could not be loaded.');
 const buffer=await response.arrayBuffer(),actual=await sha256(buffer);
 if(actual!==null&&actual!==entry.hash)throw new Error('The terrain height samples do not match their pinned sha256.');
 registerHeightSamples(entry.hash,decodeHeightSamples(buffer,entry.size));
}
// Resolves to a release function once the samples are registered and retained.
export async function loadTerrainHeight(entry,{signal}={}){
 if(!entry)return ()=>{};
 if(!heightSamples(entry.hash)){
  if(!pending.has(entry.hash))pending.set(entry.hash,fetchSamples(entry,signal).finally(()=>pending.delete(entry.hash)));
  await pending.get(entry.hash);
 }
 if(!retainHeightSamples(entry.hash))throw new Error('The terrain height samples were released before use.');
 let released=false;return ()=>{if(!released){released=true;releaseHeightSamples(entry.hash);}};
}
