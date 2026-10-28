// Canonical saved Kiln assets -> supported Holodeck proposal and explicit native derivatives.
// --plan is default; --apply uses the reviewed plan and optimistic world revision checks.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:4202';
const read=async p=>JSON.parse((await fs.readFile(path.resolve(root,p),'utf8')).replace(/^\uFEFF/,''));
const put=(p,v)=>fs.writeFile(path.resolve(root,p),JSON.stringify(v,null,2));const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const arch=(await read('authoring/modular-architecture-v1-pins.json')).assets;
const target=(await read('authoring/targets-v1-pins.json')).assets;
const support=(await read('evidence/range-v7-paper-support-saved.json')).asset;assert(support);
const facility=(await read('authoring/facility-v5-pins.json')).assets;
const rows=[...arch.map(a=>({id:'range-'+a.key,assetId:a.assetId,revisionId:a.revisionId,collection:'project',glb:a.glb.path,sha256:a.glb.sha256})),...target.map(a=>({id:'target-'+a.id,assetId:a.assetId,revisionId:a.revisionId,collection:'project',glb:a.glb,sha256:a.hashes['asset.glb'].sha256})),{id:'paper-support',assetId:support.assetId,revisionId:support.revisionId,collection:'project',glb:`authoring/assets/kiln/${support.assetId}/revisions/${support.revisionId}/asset.glb`,sha256:support.files['asset.glb'].sha256},...facility.filter(a=>a.id!=='target-module').map(a=>({...a,existing:true}))];
const response=await fetch(base+'/api/session'),session=await response.json();assert(response.ok);assert(!session.proposal&&!session.agent?.turnId,'Other staged or active work must be reconciled first');
const before=session.world;assert.equal(before.revision,6,'This additive plan requires reviewed revision 6');
const scene=structuredClone(before.scene),objects=[];
const place=(id,asset,position,collider,label)=>objects.push({id,asset,label,position,rotation:[0,0,0],scale:[1,1,1],layer:'world',castShadow:true,collider});
const compound=boxes=>({type:'compound',boxes});const box=(size,offset)=>({size,offset});
const postBoxes=[-.85,1.25].flatMap(x=>[-1.17,1.17].map(z=>box([.22,2.82,.22],[x,1.41,z])));
for(const [name,z]of [['paper',-2.6],['original',0],['plates',2.6]])place('roof-'+name,'range-canopy',[18,0,z],compound([...postBoxes,box([2.34,.26,2.591],[.2,2.95,0])]),name+' lane canopy');
place('bank-end-infill','range-endpanel',[18,0,3.77],compound([box([2.1,2.64,.08],[.2,1.48,0])]),'Range bank end infill');
place('gallery-connector','range-gallery',[12,0,1.65],{type:'box',size:[.6,2.44,.8],offset:[0,1.22,0]},'Gallery connector');
const bay=scene.objects.find(o=>o.id==='collection-bay'),booth=scene.objects.find(o=>o.id==='booth-console');
place('gallery-display-bay','collection-bay',[12,0,3.3],structuredClone(bay.collider),'Second display bay');
for(const [name,z]of [['paper',-2.6],['plates',2.6]])place('booth-'+name,'booth-console',[18,0,z],structuredClone(booth.collider),name+' lane console · preview');
place('paper-carrier','target-paper',[24,0,-2.6],{type:'box',size:[.15,1.43,.68],offset:[0,1.697,0]},'Paper carrier · stationary preview');
place('plate-rack','target-rack',[24,0,2.6],compound([box([.64,.98,1.99],[.1,.49,0]),...[-.72,-.36,0,.36,.72].map(z=>box([.04,.272,.272],[.083,1.313,z]))]),'Five-plate rack · preview');
const supportBoxes=[-.29,.29].flatMap(x=>[-.55,.55].map(z=>box([.18,2.41,.18],[x,1.205,z])));
place('paper-support','paper-support',[24,0,-2.6],compound([...supportBoxes,...[-.29,.29].map(x=>box([.16,.08,1.18],[x,2.45,0]))]),'Paper carrier support');
scene.objects.push(...objects);
const native=[];await fs.mkdir(path.join(root,'evidence/range-v7-native-input'),{recursive:true});
for(const row of rows){
 const bytes=await fs.readFile(path.resolve(root,row.glb));assert.equal(sha(bytes),row.sha256);const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert(!j.skins?.length&&!j.animations?.length,'Ordinary world assets must be rigid rest-pose exports');
 const out=`assets/imports/${row.id}-${row.revisionId}.glb`;
 if(!row.existing)scene.assets.push({id:row.id,file:out,provenance:{assetId:row.assetId,revisionId:row.revisionId,collection:row.collection}});
 const nodes=[],meshes=[],derived=structuredClone(j);derived.meshes=[];
 function walk(index,parent=null,parentMatrix=new THREE.Matrix4(),parentPosition=[0,0,0]){
  const n=j.nodes[index],local=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1]))),matrix=parentMatrix.clone().multiply(local),position=new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
  const key='N'+String(index).padStart(3,'0')+'_'+(n.name??'Node').replace(/[^a-zA-Z0-9_]/g,'_');
  derived.nodes[index].name=key;
  if(n.mesh!==undefined){
   const mesh=structuredClone(j.meshes[n.mesh]);assert.equal(mesh.primitives.length,1);mesh.name=key;derived.nodes[index].mesh=derived.meshes.length;derived.meshes.push(mesh);
   const a=j.accessors[mesh.primitives[0].attributes.POSITION],bounds=new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)).applyMatrix4(matrix);
   const min=bounds.min.toArray(),max=bounds.max.toArray();meshes.push({key,semantic:n.name,nodeIndex:index,parent,parentPosition,sourceMin:min,sourceMax:max,nativeMin:[min[0]*100,min[2]*100,min[1]*100],nativeMax:[max[0]*100,max[2]*100,max[1]*100]});
  }else{
   assert(!n.matrix&&!n.rotation&&!n.scale,'New non-mesh transform needs explicit native support');nodes.push({key,semantic:n.name,parent,position,localPosition:position.map((v,k)=>v-parentPosition[k])});
  }
  for(const c of n.children??[])walk(c,n.mesh===undefined?key:parent,matrix,n.mesh===undefined?position:parentPosition);
 }
 for(const n of j.scenes[j.scene??0].nodes)walk(n);
 // Unique instance names prevent importer collisions for repeated glTF node/mesh names.
 // Source geometry, hierarchy, buffers and materials remain unchanged; no canonical asset is edited.
 const json=Buffer.from(JSON.stringify(derived)),pad=Buffer.alloc((4-json.length%4)%4,0x20),tail=bytes.subarray(20+bytes.readUInt32LE(12)),head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(20+json.length+pad.length+tail.length,8);head.writeUInt32LE(json.length+pad.length,12);head.writeUInt32LE(0x4e4f534a,16);
 const derivative=Buffer.concat([head,json,pad,tail]),nativeFile=`evidence/range-v7-native-input/${row.id}.glb`;await fs.writeFile(path.join(root,nativeFile),derivative);
 native.push({...row,file:out,nativeFile,nativeHash:sha(derivative),nodes,meshes,nativeDestination:'/Game/Qualification/RangeV7Generated/'+row.id});
}
assert.equal(objects.length,11);assert.equal(new Set(scene.objects.map(o=>o.id)).size,scene.objects.length);
const manifest={schemaVersion:1,label:'range-expansion-v7',worldId:session.context.worldId,baseRevision:before.revision,assets:native,objects,maps:['/Game/Qualification/RangeSliceLab','/Game/Qualification/WeaponLab'],scope:'additive placement and destination import; new target shot resolution and retrieval are pending',performance:'DIRTY'};
const request={baseRevision:before.revision,scene,summary:'Add three covered booths, connected gallery, paper carrier with stationary support and independent five-plate rack. Preserve the working original lane, weapon content, lighting, cove, references and Bible. New target scoring/travel remain pending.'};
if(!process.argv.includes('--apply')){await put('evidence/range-v7-before.json',before);await put('evidence/range-v7-manifest.json',manifest);await put('evidence/range-v7-request.json',request);console.log({ok:true,baseRevision:before.revision,newObjects:objects.length,newAssets:rows.filter(r=>!r.existing).length,nativeMeshes:native.reduce((n,r)=>n+r.meshes.length,0)});}
else{
 assert.deepEqual(await read('evidence/range-v7-before.json'),before);assert.deepEqual(await read('evidence/range-v7-request.json'),request);assert.deepEqual(await read('evidence/range-v7-manifest.json'),manifest);
 for(const row of native.filter(r=>!r.existing)){const dest=path.join(root,'holodeck-range-slice',row.file);try{assert.equal(sha(await fs.readFile(dest)),row.sha256);}catch(e){if(e.code!=='ENOENT')throw e;const p=spawnSync(process.execPath,['kiln.mjs','export',row.assetId,row.revisionId,'--collection',row.collection,'--profile','editable','--format','glb','--out',dest,'--json'],{cwd:path.join(root,'authoring'),encoding:'utf8'});assert.equal(p.status,0,p.stdout+p.stderr);assert.equal(sha(await fs.readFile(dest)),row.sha256);}}
 const checkpoint=path.join(root,'evidence/range-v7-apply-checkpoint.json');try{await fs.access(checkpoint);throw Error('Prior checkpoint exists: inspect outcome instead of blind retry');}catch(e){if(e.code!=='ENOENT')throw e;}
 const headers={Origin:base,'Content-Type':'application/json','X-Holodeck-World':session.context.worldId,'X-Holodeck-Epoch':session.context.epoch},cookie=response.headers.get('set-cookie')?.split(';')[0];if(cookie)headers.Cookie=cookie;
 await put(checkpoint,{phase:'about-to-propose',baseRevision:before.revision});let r=await fetch(base+'/api/propose',{method:'POST',headers,body:JSON.stringify(request)}),d=await r.json();await put('evidence/range-v7-proposal.json',{status:r.status,response:d});assert(r.ok,JSON.stringify(d));
 let s=await(await fetch(base+'/api/session',{headers})).json();assert.equal(s.proposal.id,d.proposalId);assert.deepEqual(s.proposal.world.scene,scene);assert.deepEqual({...s.proposal.world,scene:before.scene,revision:before.revision},before);
 await put(checkpoint,{phase:'about-to-apply',id:d.proposalId});r=await fetch(base+'/api/proposal/apply',{method:'POST',headers,body:JSON.stringify({id:d.proposalId})});d=await r.json();await put('evidence/range-v7-applied.json',{status:r.status,response:d});assert(r.ok,JSON.stringify(d));
 s=await(await fetch(base+'/api/session',{headers})).json();assert(!s.proposal);assert.deepEqual(s.world,{...before,revision:before.revision+1,scene});await put('evidence/range-v7-world-proof.json',{ok:true,world:s.world,checks:['original objects unchanged','environment/runtime/origin unchanged','Bible/references unchanged','exact saved asset hashes exported'],runtimeReview:'pending'});console.log({ok:true,revision:s.world.revision});
}
