// Read-only destination verification. Browser interaction is evidenced separately.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {shareGlbImages} from '../../../server/texture-store.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const natural=process.argv.includes('--natural');
const require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp'),hash=b=>createHash('sha256').update(b).digest('hex');
const pixels=[];
for(const mode of ['case','lab']){
 const receipt=await read('evidence/'+(natural?(mode==='case'?'natural-wood-case':'natural-timber'):'procedural-wood-'+mode)+'-native-result.json');assert(receipt.ok);
 for(const row of receipt.textures){
  const a=await sharp(row.source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(row.exported).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual(a.info,b.info,row.name+' dimensions');assert.deepEqual(a.data,b.data,row.name+' source pixels');
  pixels.push({mode,name:row.name,width:a.info.width,height:a.info.height,rgbaSha256:hash(a.data),pixelIdentical:true});
 }
}
const deliveries=[];
for(const [mode,port,folder,key,savedFile] of [
 ['case',4196,'holodeck-exhibit','transport-case',natural?'natural-wood-case':'procedural-wood-case'],
 ['lab',4198,'holodeck-procedural-wood',natural?'timber-specimen':'wood-comparison',natural?'timber-specimen':'procedural-wood-comparison']]){
 const base='http://127.0.0.1:'+port,r=await fetch(base+'/api/session');assert(r.ok);
 const cookie=r.headers.get('set-cookie')?.split(';')[0],session=await r.json(),asset=session.assets[key];
 const saved=await read('evidence/'+savedFile+'-saved.json');assert(saved.ok);
 assert.equal('sha256:'+asset.hash,saved.asset.files['asset.glb'].sha256);
 const original=await readFile(new URL(folder+'/.holodeck/blobs/'+asset.hash+'.glb',root));assert.equal(hash(original),asset.hash);
 const derived=shareGlbImages(original);assert(derived);
 const response=await fetch(new URL(asset.url,base),{headers:{Cookie:cookie}});assert(response.ok);
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),derived.glb);
 for(const img of derived.images){
  const url=new URL('/api/textures/'+img.hash+'.'+img.ext,base);url.search=new URL(asset.url,base).search;
  const response=await fetch(url,{headers:{Cookie:cookie}});assert(response.ok);assert.deepEqual(Buffer.from(await response.arrayBuffer()),img.bytes);
 }
 const descriptor=session.world.scene.assets.find(a=>a.id===key);assert.equal(descriptor.provenance.revisionId,saved.asset.revisionId);
 const checks=['exact_saved_source_hash','derived_glb_and_shared_images_equal_source','revision_provenance'];
 if(mode==='case'){
  const before=(await read(natural?'evidence/natural-wood-case-holodeck-before.json':'evidence/procedural-wood-case-before.json')).world,expected=structuredClone(before.scene);
  const a=expected.assets.find(a=>a.id===key);a.file=descriptor.file;a.provenance=descriptor.provenance;
  assert.deepEqual(session.world.scene,expected);checks.push('entire_scene_unchanged_except_case_file_and_provenance');
 }
 deliveries.push({mode,worldRevision:session.world.revision,assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,sourceSha256:asset.hash,sourceBytes:original.length,sharedTextureCount:derived.images.length,checks});
}
const result={ok:true,checkedAt:new Date().toISOString(),nativeSourcePixels:pixels,holodeck:deliveries,limits:['Unreal source-art equality does not prove GPU compressed texture equality.','Delivery integrity is separate from actual rendering and live interaction.','Host-derived GLB check uses the current host transformation; it is not an independent proof of that algorithm.']};
await writeFile(new URL('evidence/'+(natural?'natural-wood':'procedural-wood')+'-delivery-check.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({ok:true,nativeImages:pixels.length,holodeck:deliveries},null,2));
