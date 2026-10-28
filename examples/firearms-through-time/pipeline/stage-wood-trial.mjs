import {readFile,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),mode=process.argv[2];assert(['control','natural-case','board'].includes(mode));
const isCase=mode==='natural-case',port=isCase?4196:4198,base='http://127.0.0.1:'+port,r=await fetch(base+'/api/session');assert(r.ok);
const cookie=r.headers.get('set-cookie').split(';')[0],s=await r.json(),scene=structuredClone(s.world.scene);
const label=isCase?'natural-wood-case':mode==='control'?'wood-light-control':'timber-specimen';
await writeFile(new URL('evidence/'+label+'-holodeck-before.json',root),JSON.stringify(s,null,2));
const saved=JSON.parse(await readFile(new URL('evidence/'+label+'-saved.json',root),'utf8'));assert(saved.ok);
const folder=isCase?'holodeck-exhibit':'holodeck-procedural-wood',id=isCase?'transport-case':mode==='control'?'wood-comparison':'timber-specimen';
const file='assets/imports/'+id+'-'+saved.asset.revisionId+'.glb';
await copyFile(new URL(isCase?'authoring/opening-case-natural-wood.glb':'authoring/'+label+'.glb',root),new URL(folder+'/'+file,root));
const descriptor={id,file,provenance:{assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection}};
const existing=scene.assets.find(a=>a.id===id);if(existing)Object.assign(existing,descriptor);else scene.assets.push(descriptor);
let bible=s.world.bible;
if(isCase){assert.equal(s.world.scene.assets.find(a=>a.id===id).provenance.revisionId,'r_096099160ddb496891d9203c5c2ba554');await writeFile(new URL('evidence/case-material-candidate.json',root),JSON.stringify({label,glb:'authoring/opening-case-natural-wood.glb',saved:'evidence/'+label+'-saved.json'},null,2));}
else{
 scene.environment.sunPosition=mode==='control'?[0,0,5]:[3,4,5];scene.environment.sunIntensity=mode==='control'?1:2.5;
 if(mode==='board'){
  const object=scene.objects.find(o=>o.id==='wood-comparison');object.asset='timber-specimen';object.label='Timber specimen: long grain and cut ends';object.position=[10,.52,0];
  scene.runtime.spawn=[10,1.72,2.1];scene.runtime.look=[0,-Math.atan(.55/2.1)];
  bible={...bible,title:'Natural wood and cut-end study',intent:'Inspect original grain, knots and dedicated cut-end mapping on a loose timber specimen.'};
 }
}
const response=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,bible,summary:isCase?'Natural grain, knots and cut ends; unchanged case geometry and behavior':mode==='control'?'Diagnostic: original comparison without normal maps under frontal light':'Loose timber: long grain on sides, end grain on cut faces'})});
const result=await response.json();assert(response.ok,JSON.stringify(result));await writeFile(new URL('evidence/'+label+'-holodeck-proposal.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
