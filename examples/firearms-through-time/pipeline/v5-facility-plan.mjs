// Default is read-only destination planning. --propose exports exact assets and POSTs a proposal only.
// No apply endpoint and no direct world.json write exist in this script.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>JSON.parse((await fs.readFile(path.join(root,p),'utf8')).replace(/^\uFEFF/,''));
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const write=async(p,v)=>fs.writeFile(path.join(root,p),JSON.stringify(v,null,2));
const mode=process.argv.includes('--propose')?'propose':'plan';
assert(process.argv.slice(2).every(a=>['--plan','--propose'].includes(a)),'Only --plan or --propose supported');
const pins=(await read('authoring/facility-v5-pins.json')).assets;
assert.deepEqual(pins.map(a=>a.id).sort(),['booth-console','collection-bay','target-module'],'Scope is exactly the facility trio');
const summary=await read('evidence/facility-v5-summary.json');
const sourceRows=[];
for(const row of pins){
 const b=await fs.readFile(path.join(root,row.glb));assert.equal(hash(b),row.sha256);
 const manifest=await read(row.savedDirectory+'/manifest.json');assert.equal(manifest.files['asset.glb'].sha256,row.sha256);
 assert.equal(hash(await fs.readFile(path.join(root,row.source))),row.sourceSha256);
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert(!j.animations?.length&&!j.skins?.length);
 assert.deepEqual((j.extensionsRequired??[]),[],'Unexpected required GLB decoder/extension');
 const meshes=[];
 function walk(i,t=[0,0,0]){
  const n=j.nodes[i];assert(!n.matrix&&!n.rotation&&!n.scale,'Unexpected source transform needs explicit adapter qualification');
  const v=t.map((x,k)=>x+(n.translation?.[k]??0));
  if(n.mesh!==undefined){
   const m=j.meshes[n.mesh];assert.equal(m.primitives.length,1);const p=m.primitives[0];const a=j.accessors[p.attributes.POSITION];
   assert(a.min&&a.max);const min=a.min.map((x,k)=>x+v[k]),max=a.max.map((x,k)=>x+v[k]);
   meshes.push({name:n.name,moving:n.name.startsWith('Mesh_Moving_'),materialIndex:p.material,sourceMin:min,sourceMax:max,nativeMinCm:[min[0]*100,min[2]*100,min[1]*100],nativeMaxCm:[max[0]*100,max[2]*100,max[1]*100]});
  }
  for(const c of n.children??[])walk(c,v);
 }
 for(const n of j.scenes[j.scene??0].nodes)walk(n);
 const compare=summary.assets.find(a=>a.id===row.id).comparison;
 assert(!compare.changes.some(c=>c.fields.includes('material')||c.fields.includes('materials')));
 sourceRows.push({...row,module:({'collection-bay':'bay','booth-console':'console','target-module':'target'})[row.id],nativeDestination:'/Game/Qualification/FacilityV5Generated/'+row.id,meshes});
}
const base=process.env.HOLODECK_FACILITY_URL??'http://127.0.0.1:4202';
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),'Use the local existing host');
const resp=await fetch(base+'/api/session');const s=await resp.json();assert(resp.ok,JSON.stringify(s));
assert(s.world&&s.context?.worldId&&s.context?.epoch,'Missing session identity');
assert(!s.proposal,'A proposal is already pending; do not replace another staged change');
assert(!s.agent?.turnId,'An embedded world-agent turn is active; wait rather than race it');
const current=s.world;
const disk=await read('holodeck-range-slice/world/world.json');assert.deepEqual(current,disk,'Connected host world differs from workspace saved state');
const hostReceipt=await read('evidence/weapon-server.json');
assert.equal(path.resolve(hostReceipt.world),path.join(root,'holodeck-range-slice'));
assert.equal(Number(new URL(base).port),hostReceipt.port,'Host port differs from recorded world owner');
const scene=structuredClone(current.scene);
for(const row of pins){
 const a=scene.assets.find(a=>a.id===row.id);assert(a,'Missing established asset '+row.id);
 assert.equal(a.provenance.assetId,row.assetId);assert.equal(a.provenance.revisionId,row.parentRevision,'Parent changed; reconcile rather than overwrite');
 a.file=`assets/imports/${row.id}-${row.revisionId}.glb`;a.provenance={...a.provenance,assetId:row.assetId,revisionId:row.revisionId,collection:row.collection};
}
const unaffected=structuredClone(scene);unaffected.assets=current.scene.assets;
assert.deepEqual(unaffected,current.scene,'Only asset file/provenance may differ');
assert.equal(scene.assets.length,current.scene.assets.length);
for(const a of scene.assets)if(!pins.some(p=>p.id===a.id))assert.deepEqual(a,current.scene.assets.find(b=>b.id===a.id));
const body={baseRevision:current.revision,scene,summary:'Facility v5 construction detail: update the saved collection bay, booth console and target children; retain placements, collision, interactions, cove, references and all weapon content'};
const frozen={schemaVersion:1,base,worldId:s.context.worldId,baseRevision:current.revision,worldSha256:hash(JSON.stringify(current)),request:body,changedAssetIds:pins.map(a=>a.id),apply:false};
const native={schemaVersion:1,status:'prepared-not-executed',maps:['/Game/Qualification/RangeSliceLab','/Game/Qualification/WeaponLab'],generatedRoot:'/Game/Qualification/FacilityV5Generated',preserveMaterialBindings:true,materialPolicy:'Bind old effective per-component material interfaces explicitly after swapping geometry. All source material values/maps are unchanged. Keep existing material parents and native override files byte-identical; no reparent or material mutation.',boundsToleranceCm:.05,expectedComponentCount:23,expectedBlockerCount:5,expectedJoints:{bay_Joint:[23,0,104],target_Joint:[0,0,170]},assets:sourceRows};
if(mode==='plan'){
 await write('evidence/v5-facility-integration-manifest.json',native);
 await write('evidence/v5-facility-holodeck-request.json',frozen);
 await write('evidence/v5-facility-holodeck-before.json',current);
 console.log(JSON.stringify({ok:true,mode,worldId:frozen.worldId,baseRevision:current.revision,assets:pins.map(a=>a.id),nativeMeshes:sourceRows.reduce((n,r)=>n+r.meshes.length,0),destinationMutation:false}));
}else{
 const reviewed=await read('evidence/v5-facility-holodeck-request.json');
 assert.equal(reviewed.base,base);assert.equal(reviewed.worldId,frozen.worldId);assert.equal(reviewed.worldSha256,frozen.worldSha256,'Reviewed world changed; regenerate and review plan');assert.deepEqual(reviewed.request,body);
 const proposalReceipt=path.join(root,'evidence/v5-facility-holodeck-proposal.json');
 try{await fs.access(proposalReceipt);throw Error('Proposal receipt already exists; inspect it, do not duplicate');}catch(e){if(e.code!=='ENOENT')throw e;}
 try{await fs.access(path.join(root,'evidence/v5-facility-holodeck-submit-checkpoint.json'));throw Error('Prior submit checkpoint exists; inspect host proposals before retrying');}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const row of pins){
  const out=path.join(root,'holodeck-range-slice',scene.assets.find(a=>a.id===row.id).file);
  try{assert.equal(hash(await fs.readFile(out)),row.sha256);}catch(e){
   if(e.code!=='ENOENT')throw e;
   const p=spawnSync(process.execPath,['kiln.mjs','export',row.assetId,row.revisionId,'--collection',row.collection,'--profile','editable','--format','glb','--out',out,'--json'],{cwd:path.join(root,'authoring'),encoding:'utf8'});
   assert.equal(p.status,0,p.stdout+p.stderr);assert.equal(hash(await fs.readFile(out)),row.sha256);
  }
 }
 const cookie=resp.headers.get('set-cookie')?.split(';')[0];
 const headers={Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch};if(cookie)headers.Cookie=cookie;
 // Save a checkpoint BEFORE POST. Unknown outcome requires checking host proposals, never blind retry.
 await write('evidence/v5-facility-holodeck-submit-checkpoint.json',{phase:'about-to-post',worldId:s.context.worldId,baseRevision:current.revision,requestSha256:hash(JSON.stringify(body))});
 const r=await fetch(base+'/api/propose',{method:'POST',headers,body:JSON.stringify(body)});const data=await r.json();
 await write('evidence/v5-facility-holodeck-proposal.json',{ok:r.ok,status:r.status,response:data,worldId:s.context.worldId,baseRevision:current.revision,applied:false});assert(r.ok,JSON.stringify(data));
 console.log(JSON.stringify({ok:true,proposal:data,applied:false}));
}
