import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:4196';
const r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie').split(';')[0],s=await r.json();
const saved=JSON.parse(await readFile(new URL('evidence/transport-case-saved.json',root),'utf8'));
const scene=structuredClone(s.world.scene);
if(scene.assets.some(a=>a.id==='transport-case'))throw Error('Case already staged/applied; inspect before changing it');
scene.assets.push({id:'transport-case',file:'assets/imports/transport-case-'+saved.asset.revisionId+'.glb',provenance:{assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection}});
scene.objects.find(o=>o.id==='interaction-exhibit').position=[14,0,0];
scene.objects.push({id:'museum-case',asset:'transport-case',label:'museum transport case',position:[10,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,behavior:{type:'spin',speed:.6}});
scene.runtime={...scene.runtime,spawn:[10.65,1.72,1.45],look:[.42142,-.69325],overview:[12,3,3],target:[10,.4,0]};
scene.environment={...scene.environment,sunPosition:[-3,5,5],sunIntensity:3,sunColor:'#ffffff',exposure:1,hemisphere:{skyColor:'#ffffff',groundColor:'#ffffff',intensity:0},sky:{zenithColor:'#aaaaaa',horizonColor:'#aaaaaa',sunDisc:0,light:{intensity:.6,probe:[10,2,0]}},effects:{bloom:{strength:0}},grade:{toneMapping:'aces'},fogColor:'#aaaaaa'};
delete scene.environment.hemisphere; // Sky light owns fill, including its reflections.
await writeFile(new URL('evidence/transport-case-world-before.json',root),JSON.stringify(s.world,null,2));
const response=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,summary:'Add realistic transport case with portable PBR maps and neutral studio reflections'})});
const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));
await writeFile(new URL('evidence/transport-case-proposal.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify({proposal:result.proposalId,baseRevision:s.world.revision}));
