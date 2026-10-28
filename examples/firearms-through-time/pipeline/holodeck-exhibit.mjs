import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url), output=name=>new URL('evidence/'+name,root).pathname.replace(/^\/([A-Z]:)/,'$1');
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
 for(const backend of ['webgpu','webgl']) {
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:4196/prototype.html?backend=${backend}`);
  await page.waitForFunction(()=>window.holodeckPrototype?.ready && holodeckPrototype.loadedRevision!==undefined,{},{timeout:120000});
  if(backend==='webgpu') {
   const w=await page.evaluate(()=>structuredClone(holodeckPrototype.world));
   if(!w.scene.assets.some(a=>a.id==='exhibit')) {
    const saved=JSON.parse(await readFile(new URL('evidence/exhibit-saved.json',root),'utf8'));
    const scene=structuredClone(w.scene);
    scene.assets.push({id:'exhibit',file:'assets/imports/exhibit-'+saved.asset.revisionId+'.glb',provenance:{assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection}});
    scene.objects=[{id:'interaction-exhibit',asset:'exhibit',label:'test exhibit',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,behavior:{type:'spin',speed:0.6}}];
    scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','motion.spin@1'],spawn:[0.4,1.72,2.4],look:[0,-0.3],overview:[3,3,5],target:[0,0.9,0],bounds:[-8,8,-8,8],blockers:[]};
    scene.environment={type:'construct',clearPath:true,groundColor:'#b9b6a4',fogColor:'#e1e4dc',sunColor:'#ffe7c3',sunIntensity:2.8};
    const proposal=await page.evaluate(async scene=>{const session=await (await fetch('/api/session')).json();const r=await fetch('/api/propose',{method:'POST',headers:{'Content-Type':'application/json','X-Holodeck-World':session.context.worldId,'X-Holodeck-Epoch':session.context.epoch},body:JSON.stringify({baseRevision:holodeckPrototype.world.revision,scene,bible:{title:'Kiln interaction exhibit',intent:'Compare the same portable PBR asset in Holodeck and Unreal.',rules:'Start and stop rotation; reset restores the initial pose and running state. Motion is transient.'},summary:'Install the approved cross-engine interaction test'})});if(!r.ok)throw new Error((await r.json()).error);return r.json();},scene);
    await writeFile(output('exhibit-holodeck-proposal.json'),JSON.stringify(proposal,null,2));
    await page.getByRole('button',{name:'Apply proposal',exact:true}).click();
    await page.waitForFunction(()=>holodeckPrototype.ready && holodeckPrototype.world.scene.objects.some(o=>o.id==='interaction-exhibit') && holodeckPrototype.loadedRevision===holodeckPrototype.world.revision);
   }
  }
  await page.waitForTimeout(1500);
  const revision=await page.evaluate(()=>holodeckPrototype.loadedRevision);
  const assetHash=await page.evaluate(()=>holodeckPrototype.assets.exhibit.hash);
  assert.equal(assetHash,'26061bdcf77239b302277145eafb8a4e5e714a0a668de9562fe0fc1d0786d5ce');
  await page.getByRole('button',{name:'Observe',exact:true}).click();
  await page.locator('summary').filter({hasText:/^Activity$/}).click();
  await page.getByLabel('Inspect activity',{exact:true}).selectOption('interaction-exhibit');
  await page.getByRole('button',{name:'Stop test exhibit',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['interaction-exhibit'].running===false);
  const held=await page.evaluate(()=>holodeckPrototype.runtime.states['interaction-exhibit'].angle);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>holodeckPrototype.runtime.states['interaction-exhibit'].angle),held);
  await page.getByRole('button',{name:'Start test exhibit',exact:true}).click();
  await page.waitForFunction(a=>holodeckPrototype.runtime.states['interaction-exhibit'].running && holodeckPrototype.runtime.states['interaction-exhibit'].angle!==a,held);
  await page.getByRole('button',{name:'Pause activity',exact:true}).click();
  await page.getByRole('button',{name:'Reset activity',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['interaction-exhibit'].angle===0 && holodeckPrototype.runtime.states['interaction-exhibit'].running);
  assert.equal(await page.evaluate(()=>holodeckPrototype.loadedRevision),revision);
  await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await writeFile(output('exhibit-holodeck-ui-'+backend+'.json'),JSON.stringify(await page.evaluate(()=>({buttons:[...document.querySelectorAll('button')].map(x=>({text:x.textContent,label:x.getAttribute('aria-label')})),probe:{backend:holodeckPrototype.backend,revision:holodeckPrototype.loadedRevision,position:holodeckPrototype.position,runtime:holodeckPrototype.runtime,assets:holodeckPrototype.assets}})),null,2));
  await page.screenshot({path:output('exhibit-holodeck-'+backend+'.png')});
  assert.equal(await page.evaluate(()=>holodeckPrototype.backend),backend==='webgpu'?'WebGPU':'WebGL2');
  results.push({backend,errors,checks:['exact_saved_asset_hash','UI_stop_holds_pose','UI_start_resumes','UI_reset_restores_pose_and_running','activity_does_not_change_saved_revision'],observation:await page.evaluate(()=>({revision:holodeckPrototype.loadedRevision,runtime:holodeckPrototype.runtime,assets:holodeckPrototype.assets,drawCalls:holodeckPrototype.drawCalls,triangles:holodeckPrototype.triangles}))});
  await page.reload();
  await page.waitForFunction(r=>holodeckPrototype.ready && holodeckPrototype.loadedRevision===r && holodeckPrototype.runtime.states['interaction-exhibit'].running,revision);
  results.at(-1).checks.push('reload_preserves_revision_and_starts_fresh_activity');
  assert.deepEqual(errors,[]);
  await page.close();
 }
}finally{await writeFile(output('exhibit-holodeck-results.json'),JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify(results.map(x=>({backend:x.backend,errors:x.errors,revision:x.observation.revision}))));


