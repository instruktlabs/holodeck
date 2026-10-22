import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {scaffold} from './scaffold.mjs';
import {createHost} from './host.mjs';
import {readRevisionBundle,restoreRevision,remixRevision} from './history.mjs';
import {exportStaticWorld} from './static-export.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);out.write(type,4,'latin1');data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,8+data.length)),8+data.length);return out;};
function png(width,height,value){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)raw.fill(value,y*(width*4+1)+1+x*4,y*(width*4+1)+5+x*4);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const files={albedo:'assets/imports/terrain/sand-albedo.png',normal:'assets/imports/terrain/sand-normal.png',paint:'assets/imports/terrain/grove.png'};

async function fixture(t){
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-terrain-')),root=path.join(parent,'world');await scaffold(root,'construct');
 t.after(()=>rm(parent,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
 const host=await createHost(root,{agentFactory:()=>Object.assign(new EventEmitter(),{snapshot:()=>({connected:false}),close(){}})});
 const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];await session.json();
 let closed;const close=()=>closed??=(async()=>{await host.close();server.closeAllConnections();await new Promise(r=>server.close(r));})();t.after(close);
 await mkdir(path.join(root,'assets/imports/terrain'),{recursive:true});
 await writeFile(path.join(root,files.albedo),png(4,4,200));await writeFile(path.join(root,files.normal),png(4,4,128));await writeFile(path.join(root,files.paint),png(3,5,255));
 const store=host.store,scene=store.current.scene;
 await store.commit({baseRevision:store.current.revision,scene:{...scene,runtime:{...scene.runtime,modules:[...scene.runtime.modules,'terrain.heightfield@1']},
  terrain:{type:'heightfield',bounds:[-20,20,-20,20],segments:[8,8],baseHeight:0,stamps:[],appearance:{layers:[{id:'sand',maps:{albedo:files.albedo,normal:files.normal},scale:2,mask:{height:[-1,1,.5],paint:files.paint}}]}}}});
 return {root,parent,host,store,get:route=>fetch(base+route,{headers:{cookie}}),close};
}

test('terrain textures are pinned by hash like GLBs and served from the host',async t=>{
 const {root,store,get}=await fixture(t),albedo=png(4,4,200),receipt=JSON.parse(await readFile(path.join(root,'.holodeck/accepted-bundle.json'),'utf8'));
 assert.deepEqual(Object.keys(store.textures).sort(),Object.values(files).sort());
 assert.deepEqual(store.textures[files.albedo],{hash:sha(albedo),url:`/api/textures/${sha(albedo)}.png`,width:4,height:4,bytes:albedo.length});
 assert.deepEqual(receipt.textures,store.textures);
 assert.deepEqual(await readFile(path.join(root,`.holodeck/blobs/${sha(albedo)}.png`)),albedo);
 const session=await (await get('/api/session')).json();
 // Texture URLs carry the same world scoping as GLB URLs.
 const query=url=>url.includes('?')?url.slice(url.indexOf('?')):'';
 assert.ok(session.textures[files.albedo].url.startsWith(`/api/textures/${sha(albedo)}.png`));
 assert.equal(query(session.textures[files.albedo].url),query(Object.values(session.assets)[0].url));
 const served=await get(`/api/textures/${sha(albedo)}.png`);
 assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await served.arrayBuffer()),albedo);
 // A world without layers keeps the old receipt shape.
 const scaffolded=JSON.parse(await readFile(path.join(root,'.holodeck/history/0.bundle.json'),'utf8'));assert.equal('textures' in scaffolded,false);
});

test('replacing a texture file creates a revision; history, undo, remix and export keep the pinned bytes',async t=>{
 const {root,parent,store}=await fixture(t),pinned=store.current.revision,before=png(4,4,200),after=png(4,4,90);
 await writeFile(path.join(root,files.albedo),after);await store.refreshAssets();
 assert.equal(store.current.revision,pinned+1);assert.equal(store.textures[files.albedo].hash,sha(after));
 assert.equal((await readRevisionBundle(root,pinned)).textures[files.albedo].hash,sha(before));
 // Restore materializes the pinned copy under a snapshot name.
 await restoreRevision(store,{baseRevision:pinned+1,revision:pinned});
 const restored=store.current.scene.terrain.appearance.layers[0];
 assert.equal(restored.maps.albedo,`assets/imports/terrain/snapshot-${sha(before)}.png`);
 assert.equal(store.textures[restored.maps.albedo].hash,sha(before));assert.equal(store.textures[restored.mask.paint].hash,sha(png(3,5,255)));
 // Undo returns to the replaced texture through its own receipt.
 await store.undo(store.current.revision);
 assert.equal(store.current.scene.terrain.appearance.layers[0].maps.albedo,`assets/imports/terrain/restored-${sha(after)}.png`);
 assert.equal(store.textures[store.current.scene.terrain.appearance.layers[0].maps.albedo].hash,sha(after));
 const remix=await remixRevision(root,pinned,path.join(parent,'remix'));
 assert.equal(remix.world.scene.terrain.appearance.layers[0].maps.albedo,`assets/imports/terrain/snapshot-${sha(before)}.png`);
 assert.deepEqual(await readFile(path.join(parent,'remix',`assets/imports/terrain/snapshot-${sha(before)}.png`)),before);
 assert.equal(JSON.parse(await readFile(path.join(parent,'remix/REMIX.json'),'utf8')).textures[files.albedo].hash,sha(before));
 await assert.rejects(access(path.join(parent,'remix/assets/imports/terrain/sand-albedo.png')));
 const out=path.join(parent,'site'),result=await exportStaticWorld(root,{out,revision:pinned}),scene=JSON.parse(await readFile(path.join(out,'scene.json'),'utf8'));
 assert.equal(result.revision,pinned);
 const exported=scene.world.scene.terrain.appearance.layers[0];
 assert.equal(exported.maps.albedo,`assets/imports/terrain/${sha(before)}.png`);
 assert.deepEqual(scene.textures[exported.maps.albedo],{hash:sha(before),url:`./assets/imports/terrain/${sha(before)}.png`,width:4,height:4});
 assert.deepEqual(await readFile(path.join(out,exported.maps.albedo)),before);
 assert.deepEqual((await readdir(path.join(out,'assets/imports/terrain'))).sort(),[before,png(4,4,128),png(3,5,255)].map(b=>`${sha(b)}.png`).sort());
});

test('terrain textures are checked against their size rules and the 32 MiB terrain budget',async t=>{
 const {root,store}=await fixture(t),scene=store.current.scene,layer=scene.terrain.appearance.layers[0];
 const propose=async(extra,bytes)=>{await writeFile(path.join(root,'assets/imports/terrain/odd.png'),bytes);return store.commit({baseRevision:store.current.revision,scene:{...scene,terrain:{...scene.terrain,appearance:{layers:[{...layer,maps:{...layer.maps,...extra}}]}}}});};
 await assert.rejects(propose({normal:'assets/imports/terrain/odd.png'},png(8,8,128)),/share one size/);
 await assert.rejects(propose({normal:'assets/imports/terrain/odd.png'},png(6,6,128)),/power-of-two/);
 await assert.rejects(propose({normal:'assets/imports/terrain/odd.png'},Buffer.from('not a png, only text pretending to be one')),/not a PNG/);
 await assert.rejects(propose({normal:'assets/imports/terrain/missing.png'},png(4,4,1)),/ENOENT/);
});
