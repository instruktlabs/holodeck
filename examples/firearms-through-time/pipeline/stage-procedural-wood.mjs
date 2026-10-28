import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),mode=process.argv[2];assert(['case','lab','raking','frontal'].includes(mode));
const isCase=mode==='case',base='http://127.0.0.1:'+(isCase?'4196':'4198'),r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie')?.split(';')[0],s=await r.json(),scene=structuredClone(s.world.scene);
await writeFile(new URL('evidence/procedural-wood-'+mode+'-before.json',root),JSON.stringify(s,null,2));
let bible=s.world.bible;
if(isCase||mode==='lab'){
 const saved=JSON.parse(await readFile(new URL('evidence/procedural-wood-'+(isCase?'case':'comparison')+'-saved.json',root),'utf8'));assert(saved.ok);
 const folder=isCase?'holodeck-exhibit':'holodeck-procedural-wood',id=isCase?'transport-case':'wood-comparison',file='assets/imports/'+id+'-'+saved.asset.revisionId+'.glb';await mkdir(new URL(folder+'/assets/imports/',root),{recursive:true});
 await copyFile(new URL(isCase?'authoring/opening-case-procedural-wood.glb':'authoring/procedural-wood-comparison.glb',root),new URL(folder+'/'+file,root));
 const descriptor={id,file,provenance:{assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection}};
 if(isCase){const old=scene.assets.find(a=>a.id===id);assert.equal(old.provenance.revisionId,'r_f86712dfed19484488af97a741eeb6cd');Object.assign(old,descriptor);await writeFile(new URL('evidence/case-material-candidate.json',root),JSON.stringify({label:'procedural-wood-case',glb:'authoring/opening-case-procedural-wood.glb',saved:'evidence/procedural-wood-case-saved.json'},null,2));}
 else{
  assert.equal(s.world.revision,0);scene.assets.push(descriptor);scene.objects.push({id,asset:id,label:'scan, generated dry, generated low roughness',position:[10,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,castShadow:false});
  scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[10,1.72,3.4],look:[0,0],overview:[10,3,5],target:[10,1.3,0],bounds:[-20,20,-20,20],blockers:[]};
  scene.environment={type:'construct',clearPath:true,groundColor:'#808080',fogColor:'#aaaaaa',sunColor:'#ffffff',sunIntensity:1,sunPosition:[0,0,5],fogNear:100,fogFar:200,exposure:1,grade:{toneMapping:'aces'},effects:{bloom:{strength:0}},sky:{zenithColor:'#aaaaaa',horizonColor:'#aaaaaa',sunDisc:0,light:{intensity:0}}};
  bible={...bible,title:'Procedural wood comparison',intent:'Compare scanned wood, seeded dry wood and the same generated wood with lower roughness.',rules:'Left: Poly Haven Fine Grained Wood. Middle: original dry recipe. Right: same recipe with roughness 0.28. Physical tile 0.6 m. No scan pixels used in generated maps.'};
 }
}else{assert(scene.assets.some(a=>a.id==='wood-comparison'));scene.environment.sunPosition=mode==='raking'?[5,0,1]:[0,0,5];scene.environment.sunIntensity=mode==='raking'?3:1;}
const response=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,bible,summary:isCase?'Original procedural wood on the case; preserve scene and interaction':mode==='lab'?'Scanned reference and two original procedural wood finishes':mode+' light comparison: unchanged material maps and camera'})});
const result=await response.json();assert(response.ok,JSON.stringify(result));await writeFile(new URL('evidence/procedural-wood-'+mode+'-proposal.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify({mode,proposal:result.proposalId}));
