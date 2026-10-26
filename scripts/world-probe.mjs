import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {WorldStore} from '../server/world-store.mjs';
const libraryRoot=await mkdtemp(path.join(os.tmpdir(),'holodeck-browser-library-')),root=path.join(libraryRoot,'probe-world');
process.env.HOLODECK_WORKSPACE=root;process.env.HOLODECK_LIBRARY=libraryRoot;
// Keep this probe's legacy modular-cove fixture, rather than relying on host auto-init.
const initialStore=await WorldStore.open(root);await initialStore.close();
const server=await createServer({server:{host:'127.0.0.1',port:4192,strictPort:true}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`http://127.0.0.1:4192/prototype.html?backend=${backend}`);await p.waitForFunction(()=>window.holodeckPrototype?.ready&&holodeckPrototype.loadedRevision!==undefined);await p.waitForTimeout(1200);
  expect(await p.evaluate(()=>holodeckPrototype.backend)).toBe(backend==='webgpu'?'WebGPU':'WebGL2');
  const initialSession=await p.evaluate(async()=>{const response=await fetch('/api/session'),value=await response.json();if(!response.ok)throw new Error(value.error);return value;});
  expect(path.resolve(initialSession.workspace)).toBe(path.resolve(root));const context={...initialSession.context};expect(context.worldId).toBeTruthy();expect(context.epoch).toBeTruthy();expect(await p.evaluate(()=>holodeckPrototype.activationKey)).toBe(`${context.worldId}:${context.epoch}`);
  const original=await p.evaluate(()=>structuredClone(holodeckPrototype.world));expect(original.scene.origin).toBe('structure');checks.push('eight Kiln modules load');
  await p.screenshot({path:`evidence/live-${backend}-cove.png`});
  await p.getByRole('button',{name:'Mood board',exact:true}).click();await p.getByRole('button',{name:'+ Note',exact:true}).click();
  await p.getByLabel('Card title',{exact:true}).fill(`A ${backend} world`);await p.getByLabel('Card notes',{exact:true}).fill('A calm world with a clear walking route.');await p.getByLabel('Card category',{exact:true}).fill('Rules');
  await p.getByRole('button',{name:'Pin to bible',exact:true}).click();
  const tile=p.getByRole('article',{name:`Board card: A ${backend} world`}),box=await tile.boundingBox();await p.mouse.move(box.x+25,box.y+12);await p.mouse.down();await p.mouse.move(box.x+130,box.y+80,{steps:6});await p.mouse.up();
  await p.getByRole('button',{name:'Save board',exact:true}).click();await p.waitForFunction(t=>holodeckPrototype.world.references.some(r=>r.title===t),`A ${backend} world`);
  const note=await p.evaluate(t=>holodeckPrototype.world.references.find(r=>r.title===t),`A ${backend} world`);expect(note.layout.x).toBeGreaterThan(40);expect(await p.evaluate(id=>holodeckPrototype.world.bible.referenceIds.includes(id),note.id)).toBe(true);checks.push('note edit, drag, category and bible pin persist');
  await p.getByLabel('Attach reference files').setInputFiles({name:'design.md',mimeType:'text/markdown',buffer:Buffer.from('# Quiet world\nKeep the walking route clear.')});await expect(p.getByLabel('Card title',{exact:true})).toHaveValue('design.md');
  await p.getByRole('button',{name:'Save board',exact:true}).click();await p.waitForFunction(()=>holodeckPrototype.world.references.some(r=>r.title==='design.md'));checks.push('file attachment saved as versioned pointer');
  await p.screenshot({path:`evidence/live-${backend}-board.png`});
  await p.getByLabel('Add board images').setInputFiles('public/design/first-person/03-review.png');await expect(p.getByLabel('Card title',{exact:true})).toHaveValue('03-review');
  await p.getByLabel('Card title',{exact:true}).fill(`Uploaded ${backend}`);await p.getByRole('button',{name:'Pin to bible',exact:true}).click();await p.getByRole('button',{name:'Save board',exact:true}).click();await p.waitForFunction(t=>holodeckPrototype.world.references.some(r=>r.title===t),`Uploaded ${backend}`);
  const imageId=await p.evaluate(t=>holodeckPrototype.world.references.find(r=>r.title===t).id,`Uploaded ${backend}`);
  await p.getByLabel('Replace board image').setInputFiles('public/design/first-person/01-discuss.png');await expect(p.getByRole('button',{name:'Pin to bible',exact:true})).toBeVisible();await p.getByRole('button',{name:'Save board',exact:true}).click();await p.waitForFunction(id=>!holodeckPrototype.world.bible.referenceIds.includes(id),imageId);
  await p.getByRole('button',{name:'Remove card',exact:true}).click();await p.getByRole('button',{name:'Save board',exact:true}).click();await p.waitForFunction(id=>!holodeckPrototype.world.references.some(r=>r.id===id),imageId);checks.push('image upload, replacement clears pin, removal persists');
  await p.getByRole('button',{name:'Close panel'}).click();
  const proposal=await p.evaluate(async context=>{const w=holodeckPrototype.world;const r=await fetch('/api/propose',{method:'POST',headers:{'Content-Type':'application/json','X-Holodeck-World':context.worldId,'X-Holodeck-Epoch':context.epoch},body:JSON.stringify({baseRevision:w.revision,bible:{...w.bible,title:'Proposal accepted in browser'},summary:'Test the acceptance interface'})});if(!r.ok)throw new Error((await r.json()).error);return r.json();},context);expect(proposal.proposalId).toBeTruthy();
  expect(await p.evaluate(()=>holodeckPrototype.world.bible.title)).not.toBe('Proposal accepted in browser');await p.getByRole('button',{name:'Apply proposal',exact:true}).click();await p.waitForFunction(()=>holodeckPrototype.world.bible.title==='Proposal accepted in browser');checks.push('proposal remains staged until browser acceptance');
  const before=await p.evaluate(()=>holodeckPrototype.position.slice());await p.getByLabel(/^Message /).fill('wasd');await p.keyboard.press('KeyW');expect(Math.hypot(...(await p.evaluate(()=>holodeckPrototype.position)).map((v,i)=>v-before[i]))).toBeLessThan(.00001);checks.push('editing does not move camera');await p.getByLabel(/^Message /).fill('');
  await p.getByRole('button',{name:'Bible',exact:true}).click();await p.getByLabel('World name').fill(`Persistent ${backend}`);await p.getByRole('button',{name:'Save bible',exact:true}).click();await p.waitForFunction(t=>holodeckPrototype.world.bible.title===t,`Persistent ${backend}`);
  await p.reload();await p.waitForFunction(t=>holodeckPrototype.world?.bible.title===t,`Persistent ${backend}`);checks.push('bible and board survive reload');
  // Host watcher: replace one asset, then simulate an incomplete write.
  const state=await p.evaluate(()=>structuredClone(holodeckPrototype.world)),lamp=state.scene.assets.find(a=>a.id==='lamp'),rug=state.scene.assets.find(a=>a.id==='rug'),file=path.join(root,lamp.file),saved=await readFile(file),oldHash=await p.evaluate(()=>holodeckPrototype.assets.lamp.hash),position=await p.evaluate(()=>holodeckPrototype.position.slice());
  await writeFile(file,await readFile(path.join(root,rug.file)));await p.waitForFunction(hash=>holodeckPrototype.assets.lamp.hash!==hash,oldHash);expect(Math.hypot(...(await p.evaluate(()=>holodeckPrototype.position)).map((v,i)=>v-position[i]))).toBeLessThan(.00001);
  const good=await p.evaluate(()=>holodeckPrototype.loadedRevision);await writeFile(file,'incomplete');await p.waitForTimeout(900);expect(await p.evaluate(()=>holodeckPrototype.loadedRevision)).toBe(good);await writeFile(file,saved);await p.waitForFunction(hash=>holodeckPrototype.assets.lamp.hash===hash,oldHash);checks.push('hot asset swap preserves camera; invalid bytes retain accepted scene');
  await p.getByRole('button',{name:'Hide cove',exact:true}).click();expect(await p.evaluate(()=>holodeckPrototype.cove)).toBe(false);await p.getByRole('button',{name:'Show cove',exact:true}).click();
  expect(errors).toEqual([]);const metrics=await p.evaluate(()=>({backend:holodeckPrototype.backend,drawCalls:holodeckPrototype.drawCalls,triangles:holodeckPrototype.triangles,frameP95Ms:holodeckPrototype.frames.slice(-120).sort((a,b)=>a-b)[114]}));results.push({backend,checks,errors,metrics});await p.close();
}}finally{await writeFile('evidence/live-world-probe.json',JSON.stringify(results,null,2));await browser.close();await server.close();const cleanup=path.resolve(libraryRoot);if(path.dirname(cleanup)!==path.resolve(os.tmpdir())||!path.basename(cleanup).startsWith('holodeck-browser-library-'))throw new Error('Unexpected probe cleanup path');await rm(cleanup,{recursive:true,force:true});}
console.log(JSON.stringify(results));
