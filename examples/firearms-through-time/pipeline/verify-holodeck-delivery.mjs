// Read-only local delivery check; UI interaction evidence is recorded separately.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {shareGlbImages} from '../../../server/texture-store.mjs';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:4196';
const megascans=process.argv.includes('--megascans-case');
const update=process.argv.includes('--opening-update')||megascans;
const opening=process.argv.includes('--opening-case')||update;
const caseMode=process.argv.includes('--transport-case')||opening;
const key=caseMode?'transport-case':'exhibit',objectId=caseMode?'museum-case':'interaction-exhibit';
const response=await fetch(base+'/api/session');
assert(response.ok);
const cookie=response.headers.get('set-cookie')?.split(';')[0];
const session=await response.json(),asset=session.assets[key];
const saved=JSON.parse(await readFile(new URL(megascans?'evidence/megascans-case-saved.json':update?'evidence/opening-update-saved.json':opening?'evidence/opening-case-delivery-saved.json':caseMode?'evidence/transport-case-saved.json':'evidence/exhibit-v2-saved.json',root),'utf8'));
const expected=saved.asset.files['asset.glb'].sha256.replace('sha256:','');
assert.equal(asset.hash,expected);
const download=await fetch(new URL(asset.url,base),{headers:cookie?{Cookie:cookie}:{}});
assert(download.ok);
const bytes=Buffer.from(await download.arrayBuffer());
const hash=b=>createHash('sha256').update(b).digest('hex');
const pinned=await readFile(new URL('holodeck-exhibit/.holodeck/blobs/'+expected+'.glb',root));
assert.equal(hash(pinned),expected);
const derived=shareGlbImages(pinned);
assert(derived,'This textured fixture should use shared image delivery');
assert.deepEqual(bytes,derived.glb);
const servedTextures=[];
for(const image of derived.images){
 const url=new URL('/api/textures/'+image.hash+'.'+image.ext,base);
 url.search=new URL(asset.url,base).search;
 const r=await fetch(url,{headers:cookie?{Cookie:cookie}:{}});assert(r.ok);
 const content=Buffer.from(await r.arrayBuffer());assert.deepEqual(content,image.bytes);
 servedTextures.push({sha256:hash(content),bytes:content.length});
}
const object=session.world.scene.objects.find(o=>o.id===objectId);
assert.deepEqual(object.position,[caseMode?10:14,0,0]);
assert.deepEqual(object.behavior,opening?{type:'joint',node:'Joint_Lid',axis:'x',angle:-105*Math.PI/180,speed:1.5}:{type:'spin',speed:0.6});
assert.equal(session.world.scene.assets.find(a=>a.id===key).provenance.revisionId,saved.asset.revisionId);
const receipt={ok:true,checkedAt:new Date().toISOString(),worldRevision:session.world.revision,assetId:saved.asset.assetId,sourceRevision:saved.asset.revisionId,sourceSha256:expected,sourceBytes:pinned.length,downloadSha256:hash(bytes),downloadBytes:bytes.length,servedTextures,delivery:'Host extracts embedded images into shared content-addressed URLs. Pinned source is unchanged; HTTP GLB is a derived representation.',object,environment:session.world.scene.environment,runtime:session.world.scene.runtime,checks:['server_manifest_matches_saved_revision','pinned_bytes_match_saved_revision','served_glb_matches_host_derivative','served_texture_bytes_match_embedded_source','placement_outside_cove','interaction_contract_unchanged'],limits:['This API check does not prove rendering or live interaction; see the CUA screenshots and AX receipts.','Derived GLB comparison uses the current host implementation; this is an end-to-end delivery integrity check, not an independent proof of that transformation algorithm.']};
if(megascans){
 const before=JSON.parse(await readFile(new URL('evidence/megascans-holodeck-before.json',root),'utf8')).world;
 assert.deepEqual(session.world.scene.objects,before.scene.objects);
 assert.deepEqual(session.world.scene.environment,before.scene.environment);
 const expectedScene=structuredClone(before.scene);
 expectedScene.assets.find(a=>a.id==='transport-case').file=session.world.scene.assets.find(a=>a.id==='transport-case').file;
 expectedScene.assets.find(a=>a.id==='transport-case').provenance=session.world.scene.assets.find(a=>a.id==='transport-case').provenance;
 assert.deepEqual(session.world.scene,expectedScene);
 receipt.checks.push('entire_scene_unchanged_except_case_file_and_provenance');
}
await writeFile(new URL(megascans?'evidence/megascans-holodeck-delivery.json':update?'evidence/opening-update-holodeck-delivery.json':opening?'evidence/opening-case-holodeck-delivery.json':caseMode?'evidence/transport-case-holodeck-delivery.json':'evidence/holodeck-v2-delivery-current.json',root),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({ok:true,worldRevision:receipt.worldRevision,sha256:expected,checks:receipt.checks}));
