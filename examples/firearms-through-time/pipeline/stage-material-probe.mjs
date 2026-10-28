import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:4196';
const r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie').split(';')[0],s=await r.json(),scene=structuredClone(s.world.scene);
const mode=process.argv[2]??'near';
if(mode==='near'){
 if(scene.assets.some(a=>a.id==='material-probe'))throw Error('Probe exists; inspect before restaging');
 const saved=JSON.parse(await readFile(new URL('evidence/material-probe-final-saved.json',root),'utf8'));
 scene.assets.push({id:'material-probe',file:'assets/imports/material-probe-'+saved.asset.revisionId+'.glb',provenance:{assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection}});
 scene.objects.push({id:'material-probe',asset:'material-probe',label:'normal and sampling probe',position:[18,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,castShadow:false});
 await writeFile(new URL('evidence/material-probe-world-before.json',root),JSON.stringify(s.world,null,2));
 scene.runtime.spawn=[18,1.72,2.5];scene.runtime.look=[0,0];
}else if(mode==='far'){scene.runtime.spawn=[18,1.72,5];scene.runtime.look=[0,0];}
else if(mode==='restore'){
 const before=JSON.parse(await readFile(new URL('evidence/material-probe-world-before.json',root),'utf8'));
 scene.runtime.spawn=before.scene.runtime.spawn;scene.runtime.look=before.scene.runtime.look;
}else throw Error('Expected near, far or restore');
const response=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,summary:'Material probe '+mode+': preserve case state and compare directional normals and fine stripes'})});
const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));
await writeFile(new URL('evidence/material-probe-'+mode+'-proposal.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify({mode,proposal:result.proposalId}));
