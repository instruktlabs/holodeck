import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {shareGlbImages,createTextureStore} from './texture-store.mjs';
import {createHost} from './host.mjs';
import {scaffold} from './scaffold.mjs';
import {validateGlb} from '../src/world/contract.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Stand-in image payloads: the store moves bytes, it never decodes them.
const png=label=>Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.from(label.repeat(64))]);
// A textured triangle whose buffer views interleave images with geometry, plus
// a sparse accessor, so every buffer view index has to be remapped.
function texturedGlb(images){
  const positions=Buffer.from(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer),uvs=Buffer.from(new Float32Array([0,0,1,0,0,1]).buffer),indices=Buffer.from(new Uint16Array([0,1,2,0]).buffer);
  const sparseIndices=Buffer.from(new Uint16Array([1,0]).buffer),sparseValues=Buffer.from(new Float32Array([0,0,.5,0,0,0]).buffer);
  const parts=[images[0],positions,images[1],uvs,indices,sparseIndices,sparseValues],views=[];let bin=Buffer.alloc(0);
  for(const part of parts){const offset=Math.ceil(bin.length/4)*4;bin=Buffer.concat([bin,Buffer.alloc(offset-bin.length),part]);views.push({buffer:0,byteOffset:offset,byteLength:part.length});}
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Mesh_leaf',mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicRoughnessTexture:{index:1}}}],
    textures:[{source:0,sampler:0},{source:1,sampler:0}],samplers:[{}],
    images:[{bufferView:0,mimeType:'image/png',name:'albedo'},{bufferView:2,mimeType:'image/png'}],
    accessors:[{bufferView:1,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0],sparse:{count:1,indices:{bufferView:5,componentType:5123},values:{bufferView:6}}},{bufferView:3,componentType:5126,count:3,type:'VEC2'},{bufferView:4,componentType:5123,count:3,type:'SCALAR'}],
    bufferViews:views,buffers:[{byteLength:bin.length}]};
  const text=Buffer.from(JSON.stringify(json)),jsonChunk=Buffer.alloc(Math.ceil(text.length/4)*4,0x20);text.copy(jsonChunk);
  const binChunk=Buffer.alloc(Math.ceil(bin.length/4)*4);bin.copy(binChunk);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonChunk.length+8+binChunk.length,8);
  const chunk=(type,data)=>{const h=Buffer.alloc(8);h.writeUInt32LE(data.length,0);h.writeUInt32LE(type,4);return Buffer.concat([h,data]);};
  return Buffer.concat([header,chunk(0x4e4f534a,jsonChunk),chunk(0x004e4942,binChunk)]);
}
function parse(bytes){
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString('utf8')),at=20+length;
  const bin=at<bytes.length?bytes.subarray(at+8,at+8+bytes.readUInt32LE(at)):null;
  const view=index=>{const v=json.bufferViews[index];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};
  return {json,view};
}

test('embedded images move to content-addressed URIs and every geometry byte is kept',()=>{
  const original=texturedGlb([png('a'),png('b')]),{glb,images}=shareGlbImages(original),before=parse(original),after=parse(glb);
  validateGlb(original);
  assert.ok(glb.length<original.length);
  assert.deepEqual(images.map(i=>[i.hash,i.ext,i.type]),[[sha(png('a')),'png','image/png'],[sha(png('b')),'png','image/png']]);
  assert.deepEqual(images.map(i=>i.bytes),[png('a'),png('b')]);
  assert.deepEqual(after.json.images,[{mimeType:'image/png',name:'albedo',uri:`../textures/${sha(png('a'))}.png`},{mimeType:'image/png',uri:`../textures/${sha(png('b'))}.png`}]);
  assert.equal(after.json.bufferViews.length,5);
  for(const [index,accessor] of before.json.accessors.entries()){
    assert.deepEqual(after.view(after.json.accessors[index].bufferView),before.view(accessor.bufferView),`accessor ${index}`);
    if(accessor.sparse)for(const key of ['indices','values'])assert.deepEqual(after.view(after.json.accessors[index].sparse[key].bufferView),before.view(accessor.sparse[key].bufferView));
  }
  for(const view of after.json.bufferViews)assert.equal(view.byteOffset%4,0);
  const {images:_,accessors,bufferViews,buffers,...rest}=after.json,{images:__,accessors:a2,bufferViews:b2,buffers:c2,...restBefore}=before.json;
  assert.deepEqual(rest,restBefore,'nodes, meshes, materials, textures and samplers are untouched');
});

test('GLBs without embedded images, or with view-addressing extensions, are served unchanged',()=>{
  const plain=texturedGlb([png('a'),png('b')]),{json}=parse(plain);
  assert.equal(shareGlbImages(Buffer.from('not a glb')),null);
  for(const change of [j=>{j.images=[];j.textures=[];},j=>{j.extensionsUsed=['EXT_meshopt_compression'];},j=>{j.images[0].mimeType='image/ktx2';},j=>{j.accessors[0].bufferView=0;}]){
    const copy=structuredClone(json);change(copy);
    const text=Buffer.from(JSON.stringify(copy)),chunk=Buffer.alloc(Math.ceil(text.length/4)*4,0x20);text.copy(chunk);
    const length=plain.readUInt32LE(12),rest=plain.subarray(20+length),header=Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+chunk.length+rest.length,8);header.writeUInt32LE(chunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
    assert.equal(shareGlbImages(Buffer.concat([header,chunk,rest])),null);
  }
});

test('a texture shared by two GLBs is stored once',async()=>{
  const first=texturedGlb([png('shared'),png('first')]),second=texturedGlb([png('shared'),png('second')]);
  const store=createTextureStore(async hash=>({first,second})[hash]);
  await store.glb('first');await store.glb('second');
  assert.deepEqual(store.stats(),{glbs:2,textures:3,textureBytes:[png('shared'),png('first'),png('second')].reduce((n,b)=>n+b.length,0)});
  assert.deepEqual(store.texture(`${sha(png('shared'))}.png`).bytes,png('shared'));
  assert.equal(store.texture(`${'0'.repeat(64)}.png`),null);
});

async function hostFixture(t,options={}){
  const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-textures-')),root=path.join(parent,'world');await scaffold(root);
  t.after(()=>rm(parent,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
  const make=async()=>{
    const host=await createHost(root,{agentFactory:()=>Object.assign(new EventEmitter(),{snapshot:()=>({connected:false}),close(){}}),...options});
    const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];await session.json();
    const get=route=>fetch(base+route,{headers:{cookie}});
    let closed;const close=()=>closed??=(async()=>{await host.close();server.closeAllConnections();await new Promise(r=>server.close(r));})();t.after(close);
    return {host,get,close};
  };
  const first=await make(),glb=texturedGlb([png('leaf'),png('bark')]);
  await writeFile(path.join(root,'assets/imports/leaf.glb'),glb);
  const scene=first.host.store.current.scene;
  await first.host.store.commit({baseRevision:first.host.store.current.revision,scene:{...scene,assets:[...scene.assets,{id:'leaf',file:'assets/imports/leaf.glb'}],objects:[...scene.objects,{id:'leaf-1',asset:'leaf',position:[4,0,4],rotation:[0,0,0],scale:[1,1,1],collider:null,layer:'world'}]}});
  return {make,first,glb,hash:first.host.store.hashes.leaf.hash};
}

test('the host serves GLBs with shared textures, and finds textures after a restart',async t=>{
  const {make,first,glb,hash}=await hostFixture(t);
  assert.equal(hash,sha(glb));
  const served=Buffer.from(await (await first.get(`/api/assets/${hash}.glb`)).arrayBuffer());
  assert.ok(served.length<glb.length);
  const uris=parse(served).json.images.map(i=>i.uri);
  for(const [uri,bytes] of uris.map((uri,i)=>[uri,[png('leaf'),png('bark')][i]])){
    const response=await first.get(`/api/textures/${uri.slice('../textures/'.length)}`);
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.match(response.headers.get('cache-control'),/immutable/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  }
  assert.equal((await first.get(`/api/textures/${'0'.repeat(64)}.png`)).status,404);
  assert.equal((await first.get('/api/textures/world.json')).status,400);
  await first.close();
  // A browser can hold the derived GLB across a host restart and ask for a texture first.
  const restarted=await make();
  assert.equal((await restarted.get(`/api/textures/${uris[0].slice('../textures/'.length)}`)).status,200);
  await restarted.close();
});

test('HOLODECK_SHARED_TEXTURES=0 serves the exact pinned GLB',async t=>{
  const {first,glb,hash}=await hostFixture(t,{sharedTextures:false});
  assert.deepEqual(Buffer.from(await (await first.get(`/api/assets/${hash}.glb`)).arrayBuffer()),glb);
  await first.close();
});
