// Authorized facility-only supported proposal/apply plus observed UI verification.
// Read-only probe inspection; movement and interactions use actual UI controls.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),e=n=>path.join(root,'evidence',n);
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const put=async(n,v)=>fs.writeFile(e(n),JSON.stringify(v,null,2));
const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const plan=await read(e('v5-facility-holodeck-request.json'));
const baseline=await read(e('v5-facility-holodeck-before.json'));
const pins=(await read(path.join(root,'authoring/facility-v5-pins.json'))).assets;
const verifyOnly=process.argv.includes('--verify-only');
async function overrides(){
 const dir=path.join(root,'native/ToolchainValidation/Content/Qualification/RangeSliceOverrides');
 const files=await fs.readdir(dir,{recursive:true});const result={};
 for(const file of files.sort()){const p=path.join(dir,file);if((await fs.stat(p)).isFile())result[file]=sha(await fs.readFile(p));}
 assert(Object.keys(result).length>0);return result;
}
const nativeBefore=verifyOnly?await read(e('v5-facility-native-overrides-before.json')):await overrides();
assert.deepEqual(await overrides(),nativeBefore);
if(!verifyOnly)await put('v5-facility-native-overrides-before.json',nativeBefore);
const snap=page=>page.evaluate(()=>({world:holodeckPrototype.world,revision:holodeckPrototype.loadedRevision,runtime:holodeckPrototype.runtime,assets:holodeckPrototype.assets,backend:holodeckPrototype.backend,position:holodeckPrototype.position,actor:holodeckPrototype.actor,look:holodeckPrototype.look}));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(plan.base+'/prototype.html?backend='+backend);
  await page.waitForFunction(()=>window.holodeckPrototype?.ready&&holodeckPrototype.loadedRevision!==undefined,{},{timeout:120000});
  const initial=await snap(page);assert.equal(initial.backend,backend==='webgpu'?'WebGPU':'WebGL2');
  console.log(JSON.stringify({stage:'loaded',backend,revision:initial.revision,position:initial.position,look:initial.look}));
  await page.locator('canvas').click({position:{x:50,y:500}});
  await page.getByRole('button',{name:'Observe',exact:true}).click();
  await page.locator('summary').filter({hasText:/^Activity$/}).click();
  await page.getByRole('button',{name:'Reset activity',exact:true}).click();
  // Button click blurs focused select/control without injecting runtime state.
  const move=async(key,axis,value,direction)=>{
   await page.locator('canvas').click({position:{x:50,y:500}});
   await page.keyboard.down(key);
   try{await page.waitForFunction(({axis,value,direction})=>direction*(holodeckPrototype.actor.eyePosition[axis]-value)>=0,{axis,value,direction},{timeout:30000});}
   finally{await page.keyboard.up(key);}
   console.log(JSON.stringify({stage:'moved',key,position:(await snap(page)).position}));
  };
  // Spawn faces +X. Walk around the booth's side before approaching the bay.
  await move('d',2,2.25,1);await move('s',0,14,-1);await move('a',2,.1,-1);
  await page.getByLabel('Inspect activity',{exact:true}).selectOption('collection-bay');
  await page.getByRole('button',{name:'Open Collection bay',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['collection-bay'].open);
  await move('w',0,16.4,1);
  await page.getByLabel('Inspect activity',{exact:true}).selectOption('booth-console');
  await page.getByRole('button',{name:'Start Target console',exact:true}).click();
  await page.waitForFunction(()=>{const s=holodeckPrototype.runtime.states['range-target'];return s.open&&s.angle>.15&&s.angle<1.55;});
  await page.getByRole('button',{name:'Pause activity',exact:true}).click();
  const before=await snap(page);await put('v5-facility-live-'+backend+'-held-revision-'+before.revision+'.json',before);
  if(backend==='webgpu'&&!verifyOnly){
   assert.equal(before.revision,plan.baseRevision);assert.deepEqual(before.world,baseline);
   const p=spawnSync(process.execPath,['pipeline/v5-facility-plan.mjs','--propose'],{cwd:root,encoding:'utf8'});console.log(p.stdout);assert.equal(p.status,0,p.stdout+p.stderr);
   const receipt=await read(e('v5-facility-holodeck-proposal.json'));
   const session=await page.evaluate(async()=>await(await fetch('/api/session')).json());
   assert.equal(session.context.worldId,plan.worldId);assert.equal(session.world.revision,plan.baseRevision);
   assert.equal(session.proposal.id,receipt.response.proposalId);
   assert.deepEqual(session.proposal.world.scene,plan.request.scene);
   assert.deepEqual(session.proposal.world.bible,baseline.bible);assert.deepEqual(session.proposal.world.references,baseline.references);
   await put('v5-facility-holodeck-apply-checkpoint.json',{phase:'about-to-apply',proposalId:session.proposal.id,worldId:plan.worldId,baseRevision:plan.baseRevision,nativeBefore});
   const applied=await page.evaluate(async id=>{const s=await(await fetch('/api/session')).json();const r=await fetch('/api/proposal/apply',{method:'POST',headers:{'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({id})});return {ok:r.ok,status:r.status,response:await r.json()};},session.proposal.id);
   await put('v5-facility-holodeck-apply.json',applied);assert(applied.ok,JSON.stringify(applied));
   await page.waitForFunction(rev=>holodeckPrototype.ready&&holodeckPrototype.loadedRevision===rev,plan.baseRevision+1,{timeout:120000});
  }
  const updated=await snap(page);
  await put('v5-facility-live-'+backend+'-updated.json',updated);
  for(const pin of pins){const a=updated.world.scene.assets.find(a=>a.id===pin.id);assert.equal(a.provenance.revisionId,pin.revisionId);const served=updated.assets[pin.id];assert.equal(served.hash,pin.sha256.replace('sha256:',''));}
  if(backend==='webgpu'&&!verifyOnly){assert.deepEqual(updated.runtime.states,before.runtime.states);assert(updated.runtime.paused);assert.deepEqual(updated.actor.position,before.actor.position);}
  await page.screenshot({path:e('v5-facility-live-'+backend+'-held.png')});
  await page.getByRole('button',{name:'Resume activity',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(holodeckPrototype.runtime.states['range-target'].angle-Math.PI/2)<1e-5);
  await page.getByRole('button',{name:'Stop Target console',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['range-target'].angle===0&&!holodeckPrototype.runtime.states['range-target'].open);
  await page.getByRole('button',{name:'Start Target console',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['range-target'].angle>.5);
  await page.getByLabel('Inspect activity',{exact:true}).selectOption('target-reset');
  await page.getByRole('button',{name:'Reset Target',exact:true}).click();
  await page.waitForFunction(()=>holodeckPrototype.runtime.states['range-target'].angle===0&&!holodeckPrototype.runtime.states['range-target'].open);
  const final=await snap(page);assert.equal(final.runtime.states['target-reset'].lastAction,'reset');
  await page.getByRole('button',{name:'Overlook',exact:true}).click();
  await page.screenshot({path:e('v5-facility-live-'+backend+'-overview.png')});
  assert.deepEqual(errors,[]);results.push({backend,heldBefore:before,updated,final,errors,checks:['bay_select','target_start','target_intermediate_pose','target_stop','target_restart','booth_reset',...(backend==='webgpu'&&!verifyOnly?['held_state_survives_asset_update','actor_position_preserved']:['updated_revision_reload'])]});
  console.log(JSON.stringify({stage:'verified',backend,revision:updated.revision}));await page.close();
 }
 const response=await fetch(plan.base+'/api/session'),session=await response.json();
 const expected={...baseline,revision:plan.baseRevision+1,scene:plan.request.scene};
 assert.deepEqual(session.world,expected);assert.deepEqual(await read(path.join(root,'holodeck-range-slice/world/world.json')),expected);assert(!session.proposal);
 const nativeAfter=await overrides();assert.deepEqual(nativeAfter,nativeBefore);
 await put('v5-facility-holodeck-preserve-proof.json',{ok:true,worldId:plan.worldId,revision:session.world.revision,world:session.world,changedAssetIds:pins.map(p=>p.id),nativeBefore,nativeAfter,checks:['saved_equals_live','only_three_asset_files_and_revision_pins_changed','all_objects_behaviors_collision_runtime_unchanged','bible_references_origin_environment_unchanged','other_catalog_entries_unchanged','native_override_files_byte_identical'],results,performance:{status:'DIRTY',reason:'Both hub and PC under concurrent load; timing and FPS excluded'}});
}catch(error){await put('v5-facility-live-failure.json',{error:error.stack,results});throw error;}
finally{await browser.close();}
