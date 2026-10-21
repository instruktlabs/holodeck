import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {scaffold} from './scaffold.mjs';
import {WorldStore} from './world-store.mjs';
import {WorldRuntime} from '../src/world/runtime.mjs';
const packageRoot=fileURLToPath(new URL('../',import.meta.url));
test('default CLI init starts a fresh construct with the current cove and walk collision',async()=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-example-')),root=path.join(parent,'world');let store;
 try{
  const output=execFileSync(process.execPath,[path.join(packageRoot,'bin/holodeck.mjs'),'init',root],{encoding:'utf8'});
  assert.match(output,/Created construct world/);
  store=await WorldStore.open(root);const w=store.current;
  assert.equal(w.schemaVersion,2);assert.equal(w.revision,0);assert.equal(w.scene.environment.type,'construct');
  assert.deepEqual(w.scene.runtime.modules,['collision.boxes@1','camera.walk-orbit@1']);
  assert.equal(w.scene.origin,'structure');assert.ok(w.scene.objects.length>0);
  assert.ok(w.scene.objects.every(o=>o.layer==='origin'&&!o.behavior&&!o.shape));
  assert.ok(w.references.every(r=>r.kind==='note'));
  const manifest=JSON.parse(await readFile(path.join(packageRoot,'assets/cove/modules/manifest.json'),'utf8'));
  assert.deepEqual(w.scene.assets.map(a=>a.id),manifest.map(m=>m.id));
  for(const module of manifest){
   const asset=w.scene.assets.find(a=>a.id===module.id);
   assert.deepEqual(asset.provenance,{assetId:module.assetId,revisionId:module.revisionId,collection:'project'});
   assert.deepEqual(await readFile(path.join(root,asset.file)),await readFile(path.join(packageRoot,`public/assets/cove-modules/${module.id}.glb`)));
  }
  assert.deepEqual(w.scene.runtime.spawn,[1.25,1.72,2.35]);
  assert.deepEqual(w.scene.moodboard.position,[1.05,0,-2.45]);
  const runtime=new WorldRuntime(w.scene);
  assert.equal(runtime.blocked(w.scene.runtime.spawn[0],w.scene.runtime.spawn[2]),false);
  assert.equal(runtime.collisionAt(1.05,-2.45),'moodboard');
  // The current shell includes the low seat at radius 3.1 and the back at 4.25.
  for(const radius of [3.15,4.2])for(let angle=.2;angle<3.6;angle+=.1)assert.ok(runtime.blocked(radius*Math.cos(angle),radius*Math.sin(angle)));
  // A walkable route leaves the cove around the board's right edge.
  for(const [x,z] of [[1.25,1],[1.25,-1],[3,-1],[3,-2],[3,-3],[3,-5]])assert.equal(runtime.blocked(x,z),false,`blocked exit at ${x},${z}`);
  assert.ok(w.scene.runtime.blockers.every(b=>b.layer==='origin'));
  runtime.originVisible=false;
  for(const [x,z] of [[1.05,-2.45],[-1.12,.08],[0,3.8]])assert.equal(runtime.blocked(x,z),false);
  await assert.rejects(scaffold(root),/EEXIST/);
  await store.close();store=null;store=await WorldStore.open(root);assert.equal(store.current.schemaVersion,2);
 }finally{await store?.close();assert.ok(path.resolve(parent).startsWith(path.resolve(os.tmpdir())+path.sep+'holodeck-example-'));await rm(parent,{recursive:true,force:true});}
});
test('construct is also an explicit scaffold choice; unknown examples leave no workspace',async()=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-example-'));
 try{
  const w=await scaffold(path.join(parent,'construct'),'construct');assert.equal(w.scene.environment.type,'construct');
  await assert.rejects(scaffold(path.join(parent,'unknown'),'unknown'),/Choose construct, courtyard or kinetic/);
  await assert.rejects(readFile(path.join(parent,'unknown','world/world.json')),/ENOENT/);
 }finally{assert.ok(path.resolve(parent).startsWith(path.resolve(os.tmpdir())+path.sep+'holodeck-example-'));await rm(parent,{recursive:true,force:true});}
});
for(const example of ['courtyard','kinetic'])test(`${example}: scaffold, edit, reject invalid capability, undo and reopen`,async()=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-example-')),root=path.join(parent,'world');let store;
 try{
  const w=await scaffold(root,example);assert.equal(w.schemaVersion,2);assert.ok(w.scene.objects.some(o=>o.behavior));
  await assert.rejects(scaffold(root,example),/EEXIST/);assert.equal(JSON.parse(await readFile(path.join(root,'world/world.json'))).revision,0);
  store=await WorldStore.open(root);const scene=structuredClone(w.scene),moving=scene.objects.find(o=>o.behavior);moving.position[0]+=1;
  await store.commit({baseRevision:0,scene});assert.equal(store.current.schemaVersion,2);
  const invalid=structuredClone(scene);invalid.runtime.modules.push('unsupported@1');await assert.rejects(store.commit({baseRevision:1,scene:invalid}),/Unknown module/);assert.equal(store.current.revision,1);
  await store.undo(1);assert.deepEqual(store.current.scene.objects,w.scene.objects);await store.close();store=null;
  store=await WorldStore.open(root);assert.equal(store.current.schemaVersion,2);assert.equal(store.current.revision,2);
  // Corrupt an imported asset: the accepted bundle must remain available.
  await writeFile(path.join(root,store.current.scene.assets[0].file),'incomplete');await assert.rejects(store.refreshAssets(),/GLB/);assert.equal(store.current.revision,2);
 }finally{await store?.close();assert.ok(path.resolve(parent).startsWith(path.resolve(os.tmpdir())+path.sep+'holodeck-example-'));await rm(parent,{recursive:true,force:true});}
});
