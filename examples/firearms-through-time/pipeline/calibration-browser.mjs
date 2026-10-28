import {chromium} from '@playwright/test';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),out=n=>new URL('evidence/'+n,root).pathname.replace(/^\/([A-Z]:)/,'$1');
const mode=process.argv[2]??'chart';
const neutral={type:'construct',clearPath:true,groundColor:'#808080',fogColor:'#000000',sunColor:'#ffffff',sunIntensity:1,sunPosition:[0,0,5],fogNear:100,fogFar:200,hemisphere:{skyColor:'#ffffff',groundColor:'#ffffff',intensity:0},exposure:1,grade:{toneMapping:'aces'},effects:{bloom:{strength:0}}};
const saved=JSON.parse(await readFile(new URL('evidence/calibration-chart-saved.json',root),'utf8'));
const file='assets/imports/chart-'+saved.asset.revisionId+'.glb';
await copyFile(new URL('authoring/calibration-chart.glb',root),new URL('holodeck-exhibit/'+file,root));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4196/prototype.html?backend='+backend);
  await page.waitForFunction(()=>window.holodeckPrototype?.ready && holodeckPrototype.loadedRevision!==undefined);
  if(backend==='webgpu'){
   const w=await page.evaluate(()=>structuredClone(holodeckPrototype.world));
   await writeFile(out('calibration-world-before-'+mode+'.json'),JSON.stringify(w,null,2));
   const scene=structuredClone(w.scene);
   if(!scene.assets.some(a=>a.id==='calibration-chart'))scene.assets.push({id:'calibration-chart',file,provenance:{assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection}});
   scene.environment=neutral;
   scene.objects=scene.objects.filter(o=>o.id!=='calibration-chart');
   if(mode==='chart'){
    scene.objects.find(o=>o.id==='interaction-exhibit').position=[8,0,0];
    scene.objects.push({id:'calibration-chart',asset:'calibration-chart',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,castShadow:false});
    scene.runtime={...scene.runtime,spawn:[0,1.72,5],look:[0,0]};
   }else{
    scene.objects.find(o=>o.id==='interaction-exhibit').position=[0,0,0];
    scene.runtime={...scene.runtime,spawn:[0.4,1.72,3],look:[0,-0.2]};
   }
   await page.evaluate(async scene=>{const s=await(await fetch('/api/session')).json();const r=await fetch('/api/propose',{method:'POST',headers:{'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:holodeckPrototype.world.revision,scene,summary:'Neutral lighting calibration: '+scene.objects.at(-1).id})});if(!r.ok)throw new Error((await r.json()).error);},scene);
   await page.getByRole('button',{name:'Apply proposal',exact:true}).click();
   await page.waitForFunction(()=>holodeckPrototype.loadedRevision===holodeckPrototype.world.revision);
  }
  await page.getByRole('button',{name:'Arrival',exact:true}).click();
  await page.getByRole('button',{name:'Hide cove',exact:true}).click();
  await page.getByRole('button',{name:'Observe',exact:true}).click();
  await page.locator('summary').filter({hasText:/^Activity$/}).click();
  await page.getByRole('button',{name:'Pause activity',exact:true}).click();
  await page.getByRole('button',{name:'Reset activity',exact:true}).click();
  await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.waitForTimeout(1500);
  await page.screenshot({path:out('calibration-holodeck-'+mode+'-'+backend+'.png')});
  const receipt=await page.evaluate(()=>({backend:holodeckPrototype.backend,position:holodeckPrototype.position,look:holodeckPrototype.look,revision:holodeckPrototype.loadedRevision,environment:holodeckPrototype.world.scene.environment,assets:holodeckPrototype.assets,runtime:holodeckPrototype.runtime}));
  assert.equal(receipt.backend,backend==='webgpu'?'WebGPU':'WebGL2');assert.deepEqual(errors,[]);
  await writeFile(out('calibration-holodeck-'+mode+'-'+backend+'.json'),JSON.stringify(receipt,null,2));
  await page.close();
 }
}finally{await browser.close();}
