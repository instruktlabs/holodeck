import {readFile,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:4196';
const saved=JSON.parse(await readFile(new URL('evidence/fine-wood-case-saved.json',root),'utf8'));assert(saved.ok);
await copyFile(new URL('authoring/opening-case-fine-wood.glb',root),new URL('holodeck-exhibit/assets/imports/transport-case-'+saved.asset.revisionId+'.glb',root));
const r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie')?.split(';')[0],s=await r.json();
await writeFile(new URL('evidence/fine-wood-holodeck-before.json',root),JSON.stringify(s,null,2));
const scene=structuredClone(s.world.scene),a=scene.assets.find(a=>a.id==='transport-case');
assert.equal(a.provenance.revisionId,'r_e23d7ff0476e4eb98b9920143975224e');
a.file='assets/imports/transport-case-'+saved.asset.revisionId+'.glb';
a.provenance={assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection};
const response=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,summary:'Continuous fine-grain wood, aligned per board; retain all scene objects and case interaction'})});
const result=await response.json();assert(response.ok,JSON.stringify(result));await writeFile(new URL('evidence/fine-wood-holodeck-proposal.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify({proposal:result.proposalId,revision:saved.asset.revisionId}));

