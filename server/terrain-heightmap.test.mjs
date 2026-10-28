import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,access,copyFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {scaffold} from './scaffold.mjs';
import {createHost} from './host.mjs';
import {readRevisionBundle,restoreRevision,remixRevision,listRevisions} from './history.mjs';
import {exportStaticWorld} from './static-export.mjs';
import {createExampleBundle,readExampleBundle,installExampleBundle} from './example-bundle.mjs';
import {WorldStore} from './world-store.mjs';
import {callWorldTool} from './world-tools.mjs';
import {loadWorkspaceHeight} from './terrain-heights.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createTerrain} from '../src/world/terrain.mjs';
import {diffProposal,summarizeProposal} from '../src/world/proposal-diff.mjs';

// An independent fixture landform: an angled ridge and a gully across a 24 m
// square, sampled every 0.75 m and written as little-endian float32.
const BOUNDS=[-12,12,-12,12],SIZE=[33,33];
const ridge=(x,z)=>1.5+1.2*Math.sin(.3*x+.2*z)-2*Math.exp(-((x-.6*z)**2)/6);
// Sample column i, row j: row 0 at zmin, column 0 at xmin, outermost samples on the bounds.
const at=(i,j)=>[BOUNDS[0]+(BOUNDS[1]-BOUNDS[0])*i/(SIZE[0]-1),BOUNDS[2]+(BOUNDS[3]-BOUNDS[2])*j/(SIZE[1]-1)];
function r32(height=ridge){
 const [nx,nz]=SIZE,bytes=Buffer.alloc(nx*nz*4);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)bytes.writeFloatLE(height(...at(i,j)),(j*nx+i)*4);
 return bytes;
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sampleAt=(bytes,i,j)=>bytes.readFloatLE((j*SIZE[0]+i)*4);
const eye=(id,[x,z])=>({id,position:[x,10,z]});
const heightmap=(file,bytes,extra={})=>({type:'heightmap',bounds:BOUNDS,size:SIZE,height:{file,sha256:sha(bytes),format:'r32'},stamps:[],...extra});
// A build pad flattened over the samples; its falloff reaches about 3 m from its centre.
const PAD={id:'build-pad',operation:'flatten',center:[4,-3],radius:[3,2.5],height:1.75,plateau:.7,falloff:2};
const UNSTAMPED=[[3,5],[20,25],[28,30]];
const tools={observe:()=>null,staged:()=>null};

async function fixture(t){
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-heightmap-')),root=path.join(parent,'world');await scaffold(root,'construct');
 t.after(()=>rm(parent,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 const host=await createHost(root,{agentFactory:()=>Object.assign(new EventEmitter(),{snapshot:()=>({connected:false}),close(){}})});
 const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];await session.json();
 let closed;const close=()=>closed??=(async()=>{await host.close();server.closeAllConnections();await new Promise(r=>server.close(r));})();t.after(close);
 await mkdir(path.join(root,'assets/imports/terrain'),{recursive:true});
 const bytes=r32(),file='assets/imports/terrain/site-v1.r32';await writeFile(path.join(root,file),bytes);
 const store=host.store,scene=store.current.scene,withTerrain=terrain=>({...scene,runtime:{...scene.runtime,modules:[...new Set([...scene.runtime.modules,'terrain.heightfield@1'])]},terrain});
 await store.commit({baseRevision:store.current.revision,scene:withTerrain(heightmap(file,bytes,{stamps:[PAD]}))});
 const post=(route,body)=>fetch(`${base}/api/${route}`,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {root,parent,host,store,bytes,file,withTerrain,get:route=>fetch(base+route,{headers:{cookie}}),post,close};
}

test('a heightmap round-trips through the store, the host, world tools and a reopened workspace',async t=>{
 const {root,store,bytes,file,get,close}=await fixture(t),hash=sha(bytes);
 const receipt={file,hash,url:`/api/heights/${hash}.r32`,bytes:bytes.length,size:SIZE};
 assert.deepEqual(store.height,receipt);
 assert.deepEqual(JSON.parse(await readFile(path.join(root,'.holodeck/accepted-bundle.json'),'utf8')).height,receipt);
 assert.deepEqual(JSON.parse(await readFile(path.join(root,`.holodeck/history/${store.current.revision}.bundle.json`),'utf8')).height,receipt,'history records the hash');
 assert.deepEqual(await readFile(path.join(root,`.holodeck/blobs/${hash}.r32`)),bytes);
 assert.equal('height' in JSON.parse(await readFile(path.join(root,'.holodeck/history/0.bundle.json'),'utf8')),false,'worlds without a heightmap keep the old receipt shape');
 // The browser receives the receipt and fetches the pinned bytes by hash.
 const session=await (await get('/api/session')).json();
 assert.ok(session.height.url.startsWith(receipt.url));assert.deepEqual({...session.height,url:receipt.url},receipt);
 const served=await get(receipt.url);assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'application/octet-stream');
 assert.deepEqual(Buffer.from(await served.arrayBuffer()),bytes);
 assert.equal((await get('/api/heights/not-a-hash.r32')).status,400);assert.equal((await get(`/api/heights/${'0'.repeat(64)}.r32`)).status,404);
 // world_sample stands on the samples themselves, and on the pad the stamp flattened.
 const {data:sampled}=await callWorldTool('world_sample',{points:[...UNSTAMPED.map(([i,j],n)=>eye(`s${n}`,at(i,j))),eye('pad',[4,-3])]},{store,...tools});
 assert.equal(sampled.driver,'terrain-heightfield');
 UNSTAMPED.forEach(([i,j],n)=>assert.equal(sampled.samples[n].terrainHeight,sampleAt(bytes,i,j)));
 assert.equal(sampled.samples[3].terrainHeight,1.75);
 // world_read lists the pinned file by hash and byte count, never the samples.
 const {data:assets}=await callWorldTool('world_read',{section:'assets'},{store,...tools});
 assert.deepEqual(assets.items.at(-1),{height:file,hash,bytes:bytes.length,size:SIZE});
 const {data:overview}=await callWorldTool('world_read',{},{store,...tools});
 assert.deepEqual(overview.scene.terrain.height,{file,sha256:hash,format:'r32'});
 // Reopening uses the cached accepted revision and its pinned samples.
 const revision=store.current.revision;await close();
 const reopened=await WorldStore.open(root);t.after(()=>reopened.close());
 assert.equal(reopened.current.revision,revision);assert.deepEqual(reopened.height,receipt);assert.equal(reopened.diagnostic,null);
 assert.equal(createTerrain(reopened.current.scene.terrain).sample(...at(20,25)).height,sampleAt(bytes,20,25));
 // The CLI check verifies the named file the same way.
 assert.deepEqual(await loadWorkspaceHeight(root,reopened.current),receipt);
 const stdout=execFileSync(process.execPath,[fileURLToPath(new URL('../bin/holodeck.mjs',import.meta.url)),'check',root],{encoding:'utf8'});
 assert.ok(stdout.includes(`Terrain height ${hash.slice(0,12)} (33×33 samples) verified.`),stdout);
});

test('corrupt, out-of-range, missing or mismatched height files are refused and the accepted world stays',async t=>{
 const {root,store,bytes,file,withTerrain,get}=await fixture(t),accepted=store.current.revision,write=(name,data)=>writeFile(path.join(root,'assets/imports/terrain',name),data);
 const commit=terrain=>store.commit({baseRevision:store.current.revision,scene:withTerrain(terrain)});
 // A file that is not what its record names.
 const other=r32((x,z)=>ridge(x,z)+1);await write('other.r32',other);
 await assert.rejects(commit(heightmap('assets/imports/terrain/other.r32',bytes)),/does not match terrain\.height\.sha256/);
 // Truncated, or holding a non-finite sample.
 const short=bytes.subarray(0,bytes.length-4);await write('short.r32',short);
 await assert.rejects(commit(heightmap('assets/imports/terrain/short.r32',short)),/has 4352 bytes; size \[33,33\] needs 4356/);
 const nan=Buffer.from(bytes);nan.writeFloatLE(NaN,(5*33+7)*4);await write('nan.r32',nan);
 await assert.rejects(commit(heightmap('assets/imports/terrain/nan.r32',nan)),/column 7, row 5 is not a finite number/);
 // Out of the elevation range after scale, over the size cap, outside the imports folder, or absent.
 await assert.rejects(commit(heightmap(file,bytes,{scale:400})),/keep it within ±1000 m/);
 await assert.rejects(commit({...heightmap(file,bytes),size:[1026,4]}),/Heightmap size must be two integers from 2 to 1025/);
 await assert.rejects(commit({...heightmap(file,bytes),height:{file:'assets/source/site.r32',sha256:sha(bytes),format:'r32'}}),/must be an \.r32 file inside assets\/imports/);
 await assert.rejects(commit(heightmap('assets/imports/terrain/missing.r32',bytes)),/ENOENT/);
 assert.equal(store.current.revision,accepted);
 // Overwriting the pinned file in place leaves the accepted record and its pinned bytes alone.
 await writeFile(path.join(root,file),other);await assert.rejects(store.refreshAssets(),/does not match terrain\.height\.sha256/);
 assert.equal(store.current.revision,accepted);assert.equal(store.height.hash,sha(bytes));
 assert.deepEqual(Buffer.from(await (await get(store.height.url)).arrayBuffer()),bytes);
 // Outside the host, check reads the named file and refuses it; launch prefers the pinned blob.
 await assert.rejects(loadWorkspaceHeight(root,store.current),/does not match terrain\.height\.sha256/);
 assert.equal((await loadWorkspaceHeight(root,store.current,{pinnedFirst:true})).hash,sha(bytes));
 // New samples under a new file name, with their own hash, are a new revision.
 await commit(heightmap('assets/imports/terrain/other.r32',other));assert.equal(store.current.revision,accepted+1);assert.equal(store.height.hash,sha(other));
});

test('history keeps the samples of every revision through listing, undo, restore and remix',async t=>{
 const {root,parent,store,bytes,withTerrain}=await fixture(t),first=store.current.revision,eroded=r32((x,z)=>ridge(x,z)-.4*Math.abs(Math.sin(x*.9)));
 await writeFile(path.join(root,'assets/imports/terrain/site-v2.r32'),eroded);
 // A scatter needs the samples just to count its placements, so every reader must load them first.
 const scene=withTerrain(heightmap('assets/imports/terrain/site-v2.r32',eroded));
 scene.runtime={...scene.runtime,modules:[...scene.runtime.modules,'scatter.seeded@1']};
 scene.scatters=[{id:'plants',seed:4,variants:[{asset:'planting'}],region:{polygon:[[-10,-10],[10,-10],[10,10],[-10,10]]},density:4,maxCount:30,minSpacing:2}];
 await store.commit({baseRevision:store.current.revision,scene});const second=store.current.revision;
 const rows=await listRevisions(root);assert.ok([first,second].every(revision=>rows.some(r=>r.revision===revision&&!r.unavailable)),JSON.stringify(rows));
 assert.equal((await readRevisionBundle(root,first)).height.hash,sha(bytes));assert.equal((await readRevisionBundle(root,second)).height.hash,sha(eroded));
 // Undo restores the earlier samples from their blob, named by their hash.
 await store.undo(second);
 assert.equal(store.current.scene.terrain.height.sha256,sha(bytes));assert.equal(store.current.scene.terrain.height.file,`assets/imports/terrain/restored-${sha(bytes)}.r32`);
 assert.deepEqual(await readFile(path.join(root,store.current.scene.terrain.height.file)),bytes);assert.equal(store.height.hash,sha(bytes));
 // Restore materializes a snapshot copy; remix copies the pinned bytes into a new workspace.
 await restoreRevision(store,{baseRevision:store.current.revision,revision:second});
 assert.equal(store.current.scene.terrain.height.file,`assets/imports/terrain/snapshot-${sha(eroded)}.r32`);assert.equal(store.height.hash,sha(eroded));
 const remix=await remixRevision(root,second,path.join(parent,'remix'));
 assert.equal(remix.world.scene.terrain.height.file,`assets/imports/terrain/snapshot-${sha(eroded)}.r32`);
 assert.deepEqual(await readFile(path.join(parent,'remix',remix.world.scene.terrain.height.file)),eroded);
 assert.equal(JSON.parse(await readFile(path.join(parent,'remix/REMIX.json'),'utf8')).height.hash,sha(eroded));
 await assert.rejects(access(path.join(parent,'remix/assets/imports/terrain/site-v2.r32')));
 const opened=await WorldStore.open(path.join(parent,'remix'));t.after(()=>opened.close());assert.equal(opened.height.hash,sha(eroded));assert.equal(opened.current.scene.scatters.length,1);
 // A snapshot whose pinned samples are gone is reported, not silently rebuilt.
 await rm(path.join(root,`.holodeck/blobs/${sha(bytes)}.r32`));
 await assert.rejects(readRevisionBundle(root,first),/ENOENT/);
});

test('static export carries the height samples, so the exported terrain is the same surface',async t=>{
 const {parent,store,bytes}=await fixture(t),hash=sha(bytes),out=path.join(parent,'site');
 const result=await exportStaticWorld(store.root,{out});assert.equal(result.revision,store.current.revision);
 const scene=JSON.parse(await readFile(path.join(out,'scene.json'),'utf8')),file=`assets/imports/terrain/${hash}.r32`;
 assert.deepEqual(scene.world.scene.terrain.height,{file,sha256:hash,format:'r32'});assert.deepEqual(scene.world.scene.terrain.stamps,[PAD]);
 assert.deepEqual(scene.height,{hash,url:`./${file}`,bytes:bytes.length,size:SIZE});
 assert.deepEqual(await readFile(path.join(out,file)),bytes);
 const manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
 assert.deepEqual(manifest.height,{file,sha256:hash,bytes:bytes.length,size:SIZE});
 assert.deepEqual(manifest.files.find(f=>f.file===file),{file,bytes:bytes.length,sha256:hash});
 assert.deepEqual(await readdir(path.join(out,'assets/imports/terrain')),[`${hash}.r32`]);
 assert.match(await readFile(path.join(out,'README.txt'),'utf8'),/terrain height samples/);
});

test('example bundles carry the height samples and refuse changed or unlisted height files',async t=>{
 const {parent,store,bytes}=await fixture(t),hash=sha(bytes),out=path.join(parent,'bundle'),file=`assets/imports/terrain/${hash}.r32`;
 const manifest=await createExampleBundle(store.root,{out,id:'sampled-ridge',title:'Sampled Ridge',description:'A heightmap terrain fixture.'});
 assert.deepEqual(manifest.height,{file,sha256:hash,bytes:bytes.length,size:SIZE});
 const bundle=await readExampleBundle(out);assert.equal(bundle.world.scene.terrain.height.file,file);assert.deepEqual(bundle.height.content,bytes);
 const workspace=path.join(parent,'installed');await installExampleBundle(out,workspace);
 assert.deepEqual(await readFile(path.join(workspace,file)),bytes);
 const installed=await WorldStore.open(workspace);t.after(()=>installed.close());assert.equal(installed.height.hash,hash);assert.equal(installed.current.revision,0);
 // Changed samples never install, and the manifest must list exactly the file the terrain names.
 const changed=Buffer.from(bytes);changed.writeFloatLE(42,0);await writeFile(path.join(out,file),changed);
 await assert.rejects(readExampleBundle(out),/does not match terrain\.height\.sha256/);await writeFile(path.join(out,file),bytes);
 const json=path.join(out,'example.json'),saved=JSON.parse(await readFile(json,'utf8')),{integrity,height,...body}=saved;
 const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x);
 await writeFile(json,JSON.stringify({...body,integrity:sha(canonical(body))}));await assert.rejects(readExampleBundle(out),/Example terrain height does not match its world/);
 await writeFile(json,JSON.stringify(saved));await copyFile(path.join(out,file),path.join(out,`assets/imports/terrain/${'0'.repeat(64)}.r32`));
 await assert.rejects(readExampleBundle(out),/Unexpected bundle file/);
});

test('a staged heightmap proposal is sampled on its own surface, summarized and applied',async t=>{
 const {root,store,bytes,withTerrain,post,host}=await fixture(t),accepted=structuredClone(store.current);
 const v2=r32((x,z)=>ridge(x,z)+.25);await writeFile(path.join(root,'assets/imports/terrain/site-v2.r32'),v2);
 const scene=withTerrain(heightmap('assets/imports/terrain/site-v2.r32',v2,{stamps:[PAD]}));
 const staged=await (await post('propose',{baseRevision:store.current.revision,scene,summary:'Eroded samples'})).json();
 assert.equal(staged.status,'awaiting user review');
 const proposal=host.session().proposal;assert.equal(proposal.id,staged.proposalId);assert.equal(proposal.height.hash,sha(v2));
 const point=[eye('p',at(9,21))];
 const sampled=await callWorldTool('world_sample',{points:point,proposalId:staged.proposalId},{store,observe:()=>null,staged:()=>host.session().proposal});
 assert.equal(sampled.data.samples[0].terrainHeight,sampleAt(v2,9,21));assert.equal(sampled.data.source.kind,'staged proposal');
 const current=await callWorldTool('world_sample',{points:point},{store,...tools});
 assert.equal(current.data.samples[0].terrainHeight,sampleAt(bytes,9,21),'the accepted world keeps its own samples meanwhile');
 assert.deepEqual(summarizeProposal(diffProposal(accepted,proposal.world)),[`Terrain: heightmap ${sha(v2).slice(0,12)}, 33×33 samples over x -12…12, z -12…12 m (samples were ${sha(bytes).slice(0,12)})`]);
 const applied=await post('proposal/apply',{id:staged.proposalId});assert.equal(applied.status,200,await applied.text());
 assert.equal(store.height.hash,sha(v2));assert.equal(store.current.revision,accepted.revision+1);
});
