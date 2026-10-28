// Saved range-dressing-v1 props -> Holodeck revision 8 -> 9 proposal and native rigid derivatives.
// --plan is default; --apply uses the reviewed plan and optimistic world revision checks.
// Service station on the outer (+z) face of the booth bank's end infill: away from the shared concourse and every lane.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {nativeDelivery} from './rigid-native-delivery.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:4202';
const read=async p=>JSON.parse((await fs.readFile(path.resolve(root,p),'utf8')).replace(/^﻿/,''));
const put=(p,v)=>fs.writeFile(path.resolve(root,p),JSON.stringify(v,null,2));const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const summary=await read('evidence/range-dressing-v1-summary.json'),intent=summary.collisionIntent;
const rows=summary.assets.map(a=>({id:'dressing-'+a.type,type:a.type,assetId:a.assetId,revisionId:a.revisionId,collection:a.collection,glb:a.files['asset.glb'].path,sha256:a.files['asset.glb'].sha256}));
assert.deepEqual(rows.map(r=>r.type).sort(),['empty-padded-rest','service-bench','service-cabinet','wall-sign']);
const response=await fetch(base+'/api/session'),session=await response.json();assert(response.ok);assert(!session.proposal&&!session.agent?.turnId,'Other staged or active work must be reconciled first');
const before=session.world;assert.equal(before.revision,8,'This additive plan requires reviewed revision 8');
const scene=structuredClone(before.scene),objects=[];
// Asset frames face +X; a -90 degree yaw turns that front to +z, away from the infill panel.
const outward=[0,-Math.PI/2,0];
const boxes=list=>list.length===1?{type:'box',size:list[0].size,offset:list[0].center}:{type:'compound',boxes:list.map(b=>({size:b.size,offset:b.center}))};
const place=(id,type,position,rotation,collider,label)=>objects.push({id,asset:'dressing-'+type,label,position,rotation,scale:[1,1,1],layer:'world',castShadow:true,collider});
const panel=scene.objects.find(o=>o.id==='bank-end-infill');assert.deepEqual(panel?.position,[18,0,3.77]);
// Infill mesh outer face is z=3.85 (local +0.08); keep furniture 5 cm proud of it and outside the canopy posts (z<=3.88).
place('service-bench','service-bench',[17.75,0,4.16],outward,boxes(intent.serviceBench.boxes),'Service bench');
// Rest turned so its 0.72 m length runs along the bench's 1.30 m width; feet on the mat top (0.889 m).
place('service-rest','empty-padded-rest',[17.75,.889,4.16],[0,0,0],boxes(intent.emptyRest.boxes),'Empty padded rest (display only)');
place('service-cabinet','service-cabinet',[18.95,0,4.15],outward,boxes(intent.serviceCabinet.boxes),'Service cabinet');
// Sign back plane on the panel's outer face at the suggested 0.95 m mounting height; host wall supplies collision.
place('service-sign','wall-sign',[17.75,.95,3.85],outward,null,'Service sign (blank face)');
for(const row of rows)scene.assets.push({id:row.id,file:`assets/imports/${row.id}-${row.revisionId}.glb`,provenance:{assetId:row.assetId,revisionId:row.revisionId,collection:row.collection}});
scene.objects.push(...objects);assert.equal(new Set(scene.objects.map(o=>o.id)).size,scene.objects.length);assert.equal(new Set(scene.assets.map(a=>a.id)).size,scene.assets.length);
await fs.mkdir(path.join(root,'evidence/range-dressing-v1-native-input'),{recursive:true});
const native=[];for(const row of rows){const d=await nativeDelivery({...row,glb:path.resolve(root,row.glb)},path.join(root,`evidence/range-dressing-v1-native-input/${row.id}.glb`));native.push({...d,glb:row.glb,nativeFile:`evidence/range-dressing-v1-native-input/${row.id}.glb`,nativeDestination:'/Game/Qualification/RangeDressingV1Generated/'+row.id});}
const manifest={schemaVersion:1,label:'range-dressing-v1-placement',worldId:session.context.worldId,baseRevision:before.revision,assets:native,objects,maps:['/Game/Qualification/WeaponLab'],nativeYaw:'Unreal yaw degrees = -Holodeck Y rotation in degrees (glTF x,y,z -> Unreal x,z,y)',scope:'static service dressing; blank replaceable faces; no interaction',performance:'DIRTY'};
const request={baseRevision:before.revision,scene,summary:'Add a service station at the outer end of the booth bank: bench with the empty padded rest on its mat, service cabinet and a blank wall sign on the end infill. Static dressing only; existing range, weapons, lighting, cove, references and Bible preserved.'};
if(!process.argv.includes('--apply')){await put('evidence/range-dressing-v1-before.json',before);await put('evidence/range-dressing-v1-manifest.json',manifest);await put('evidence/range-dressing-v1-request.json',request);console.log({ok:true,baseRevision:before.revision,newObjects:objects.length,newAssets:rows.length,nativeMeshes:native.reduce((n,r)=>n+r.meshes.length,0)});}
else{
 assert.deepEqual(await read('evidence/range-dressing-v1-before.json'),before);assert.deepEqual(await read('evidence/range-dressing-v1-request.json'),request);assert.deepEqual(await read('evidence/range-dressing-v1-manifest.json'),manifest);
 for(const row of rows){const dest=path.join(root,'holodeck-range-slice',`assets/imports/${row.id}-${row.revisionId}.glb`);try{assert.equal(sha(await fs.readFile(dest)),row.sha256);}catch(e){if(e.code!=='ENOENT')throw e;const p=spawnSync(process.execPath,['kiln.mjs','export',row.assetId,row.revisionId,'--collection',row.collection,'--profile','editable','--format','glb','--out',dest,'--json'],{cwd:path.join(root,'authoring'),encoding:'utf8'});assert.equal(p.status,0,p.stdout+p.stderr);assert.equal(sha(await fs.readFile(dest)),row.sha256);}}
 const checkpoint=path.join(root,'evidence/range-dressing-v1-apply-checkpoint.json');try{await fs.access(checkpoint);throw Error('Prior checkpoint exists: inspect outcome instead of blind retry');}catch(e){if(e.code!=='ENOENT')throw e;}
 const headers={Origin:base,'Content-Type':'application/json','X-Holodeck-World':session.context.worldId,'X-Holodeck-Epoch':session.context.epoch},cookie=response.headers.get('set-cookie')?.split(';')[0];if(cookie)headers.Cookie=cookie;
 await put(checkpoint,{phase:'about-to-propose',baseRevision:before.revision});let r=await fetch(base+'/api/propose',{method:'POST',headers,body:JSON.stringify(request)}),d=await r.json();await put('evidence/range-dressing-v1-proposal.json',{status:r.status,response:d});assert(r.ok,JSON.stringify(d));
 let s=await(await fetch(base+'/api/session',{headers})).json();assert.equal(s.proposal.id,d.proposalId);assert.deepEqual(s.proposal.world.scene,scene);
 await put(checkpoint,{phase:'about-to-apply',id:d.proposalId});r=await fetch(base+'/api/proposal/apply',{method:'POST',headers,body:JSON.stringify({id:d.proposalId})});d=await r.json();await put('evidence/range-dressing-v1-applied.json',{status:r.status,response:d});assert(r.ok,JSON.stringify(d));
 s=await(await fetch(base+'/api/session',{headers})).json();assert(!s.proposal);assert.deepEqual(s.world,{...before,revision:before.revision+1,scene});
 await put(checkpoint,{phase:'complete',revision:s.world.revision});console.log({ok:true,revision:s.world.revision,objects:objects.length});
}
