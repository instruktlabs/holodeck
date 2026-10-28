import {chromium} from '@playwright/test';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),out=n=>fileURLToPath(new URL('evidence/'+n,root));
const saved=JSON.parse(await readFile(new URL('evidence/opening-update-saved.json',root),'utf8'));
assert(saved.ok);
const file='assets/imports/opening-case-'+saved.asset.revisionId+'.glb';
await copyFile(new URL('authoring/opening-case-update.glb',root),new URL('holodeck-exhibit/'+file,root));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const backend of (process.argv.includes('--webgl-only')?['webgl']:['webgpu','webgl'])){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4196/prototype.html?backend='+backend);
  await page.waitForFunction(()=>window.holodeckPrototype?.ready&&holodeckPrototype.loadedRevision!==undefined,{},{timeout:120000});
  await page.getByRole('button',{name:'Observe',exact:true}).click();
  await page.locator('summary').filter({hasText:/^Activity$/}).click();
  await page.getByLabel('Inspect activity',{exact:true}).selectOption('museum-case');
  await page.getByRole('button',{name:'Reset activity',exact:true}).click();
  await page.getByRole('button',{name:'Open museum transport case',exact:true}).click();
  await page.waitForFunction(()=>{const s=holodeckPrototype.runtime.states['museum-case'];return s.open&&Math.abs(s.angle)>.3&&Math.abs(s.angle)<1.6;});
  await page.getByRole('button',{name:'Pause activity',exact:true}).click();
  const before=await page.evaluate(()=>({world:holodeckPrototype.world,loadedRevision:holodeckPrototype.loadedRevision,runtime:holodeckPrototype.runtime}));
  // Export only diagnostics; renderer objects stay inside the application.
  if(backend==='webgpu'){
   const w=before.world,scene=structuredClone(w.scene);
   await writeFile(out('opening-update-world-before.json'),JSON.stringify(w,null,2));
   const a=scene.assets.find(a=>a.id==='transport-case');
   assert.notEqual(a.provenance.revisionId,saved.asset.revisionId,'Update already applied; do not fake hot-update evidence');
   a.file=file;a.provenance={assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection};
   await page.evaluate(async scene=>{const s=await(await fetch('/api/session')).json();const r=await fetch('/api/propose',{method:'POST',headers:{'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,summary:'Update case paint and lid geometry; preserve placement and joint behavior'})});if(!r.ok)throw Error(await r.text());},scene);
   await page.getByRole('button',{name:'Apply proposal',exact:true}).click();
   await page.waitForFunction(rev=>holodeckPrototype.loadedRevision>rev&&holodeckPrototype.loadedRevision===holodeckPrototype.world.revision,w.revision);
  }else{await page.reload();await page.waitForFunction(()=>window.holodeckPrototype?.ready);await page.getByRole('button',{name:'Observe',exact:true}).click();await page.locator('summary').filter({hasText:/^Activity$/}).click();await page.getByLabel('Inspect activity',{exact:true}).selectOption('museum-case');}
  const updated=await page.evaluate(()=>({world:holodeckPrototype.world,revision:holodeckPrototype.loadedRevision,runtime:holodeckPrototype.runtime,assets:holodeckPrototype.assets,backend:holodeckPrototype.backend}));
  assert.equal(updated.backend,backend==='webgpu'?'WebGPU':'WebGL2');
  assert.equal(updated.world.scene.assets.find(a=>a.id==='transport-case').provenance.revisionId,saved.asset.revisionId);
  if(backend==='webgpu'){
   assert.deepEqual(updated.runtime.states['museum-case'],before.runtime.states['museum-case']);assert(updated.runtime.paused);
   assert.deepEqual(updated.world.scene.objects,before.world.scene.objects);
   await page.screenshot({path:out('opening-update-holodeck-mid.png')});
   await page.getByRole('button',{name:'Resume activity',exact:true}).click();
  }else{await page.getByRole('button',{name:'Reset activity',exact:true}).click();await page.getByRole('button',{name:'Open museum transport case',exact:true}).click();}
  await page.waitForFunction(()=>Math.abs(holodeckPrototype.runtime.states['museum-case'].angle+105*Math.PI/180)<1e-5);
  await page.screenshot({path:out('opening-update-holodeck-'+backend+'-open.png')});
  await page.getByRole('button',{name:'Close museum transport case',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['museum-case'].angle===0);
  await page.getByRole('button',{name:'Open museum transport case',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(holodeckPrototype.runtime.states['museum-case'].angle)>1.8);
  await page.getByRole('button',{name:'Reset activity',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['museum-case'].angle===0&&!holodeckPrototype.runtime.states['museum-case'].open);
  assert.deepEqual(await page.evaluate(()=>holodeckPrototype.runtime.states['museum-case']),{angle:0,open:false});
  assert.deepEqual(errors,[]);
  await writeFile(out('opening-update-holodeck-'+backend+'.json'),JSON.stringify({ok:true,before:{revision:before.loadedRevision,runtime:before.runtime},updated,errors,checks:['updated_revision_loaded','open_close_reopen_reset',...(backend==='webgpu'?['paused_mid_pose_survives_hot_update','objects_unchanged']:['reload_uses_updated_asset'])]},null,2));
  await page.close();
 }
}finally{await browser.close();}
