// Local authoring API: stage only. Accept through the visible Holodeck review UI.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),mode=process.argv[2]??'layout';
const base='http://127.0.0.1:4196',sessionResponse=await fetch(base+'/api/session');
const cookie=sessionResponse.headers.get('set-cookie').split(';')[0],session=await sessionResponse.json();
const w=session.world,scene=structuredClone(w.scene);
if(mode==='layout'){
 scene.objects.find(o=>o.id==='interaction-exhibit').position=[10,0,0];
 scene.runtime={...scene.runtime,spawn:[10.4,1.72,3],look:[0,-.2],overview:[13,4,5],target:[10,1,0],bounds:[-20,20,-20,20]};
 // The horizontal key and zero fill remain an intentional diagnostic preset.
}else if(mode==='presentation'){
 scene.environment={...scene.environment,sunPosition:[-3,5,5],sunIntensity:3};
}else if(mode==='update'||mode==='baseline'){
 const saved=JSON.parse(await readFile(new URL('evidence/'+(mode==='update'?'exhibit-v2-saved.json':'exhibit-saved.json'),root),'utf8'));
 const asset=scene.assets.find(a=>a.id==='exhibit');
 asset.file='assets/imports/exhibit-'+saved.asset.revisionId+'.glb';
 asset.provenance={assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection};
}else throw new Error('Unknown mode');
await writeFile(new URL('evidence/world-'+mode+'-before.json',root),JSON.stringify(w,null,2));
const r=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':session.context.worldId,'X-Holodeck-Epoch':session.context.epoch},body:JSON.stringify({baseRevision:w.revision,scene,summary:mode==='presentation'?'Use matched white diagonal lighting for the exhibit':mode==='layout'?'Move exhibit out of the cove shadow footprint':mode==='update'?'Update the exhibit asset while preserving placement and behavior':'Restore the baseline asset for the update regression'})});
const result=await r.json();if(!r.ok)throw new Error(JSON.stringify(result));
await writeFile(new URL('evidence/world-'+mode+'-proposal.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({proposalId:result.proposalId,baseRevision:w.revision,mode}));

