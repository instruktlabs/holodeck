// Re-pin every packaged example that places a Kiln asset to a repaired revision of that asset.
// Usage: node scripts/repin-example-asset.mjs <Kiln revision directory> [example ID ...]
// The revision directory holds asset.glb and its kiln.asset.v1 manifest.json. Examples that do
// not place the asset are left alone. Starter modules are reported, not changed: see
// docs/example-world-bundles.md, "Repairing a pinned asset".
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {repinExampleAsset} from '../server/example-bundle.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),[revisionDir,...only]=process.argv.slice(2);
if(!revisionDir)throw new Error('Usage: node scripts/repin-example-asset.mjs <Kiln revision directory> [example ID ...]');
const manifest=JSON.parse(await readFile(path.join(revisionDir,'manifest.json'),'utf8')),bytes=await readFile(path.join(revisionDir,'asset.glb'));
if(manifest.version!=='kiln.asset.v1'||!manifest.assetId||!manifest.revisionId)throw new Error('Not a Kiln asset revision manifest');
if(`sha256:${createHash('sha256').update(bytes).digest('hex')}`!==manifest.files?.['asset.glb']?.sha256||bytes.length!==manifest.files['asset.glb'].bytes)throw new Error('asset.glb does not match its revision manifest');
const examples=path.join(root,'examples'),ids=only.length?only:(await readdir(examples,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
for(const id of ids){
 const result=await repinExampleAsset(path.join(examples,id),{assetId:manifest.assetId,revisionId:manifest.revisionId,bytes});
 console.log(result?`${id}: ${result.changed?`${result.from.join(', ')} -> ${result.revisionId}`:'already pinned'} (${result.assets.join(', ')})`:`${id}: does not place ${manifest.assetId}`);
}
const modules=JSON.parse(await readFile(path.join(root,'assets/cove/modules/manifest.json'),'utf8'));
for(const module of modules.filter(m=>m.assetId===manifest.assetId&&m.revisionId!==manifest.revisionId))console.log(`starter module ${module.id} still pins ${module.revisionId}; update it by hand`);
