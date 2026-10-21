import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorldStore } from './world-store.mjs';

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-world-'));
  const store=await WorldStore.open(root);
  t.after(async()=>{await store.close();await rm(root,{recursive:true,force:true});});
  return {root,store};
}
test('bible and scene persist together; stale edits cannot overwrite newer work',async t=>{
  const {root,store}=await fixture(t),before=store.snapshot();
  const bible={...before.bible,title:'River home',intent:'A slow place to build.'};
  await store.commit({baseRevision:before.revision,bible,scene:{...before.scene,environment:{...before.scene.environment,type:'meadow'}}});
  const saved=JSON.parse(await readFile(path.join(root,'world/world.json'),'utf8'));
  assert.equal(saved.bible.title,'River home');assert.equal(saved.scene.environment.type,'meadow');
  await assert.rejects(store.commit({baseRevision:before.revision,bible}),/changed/);
  assert.equal(store.snapshot().revision,saved.revision);
  await store.close();const reopened=await WorldStore.open(root);t.after(()=>reopened.close());
  assert.equal(reopened.snapshot().bible.title,'River home');
});
test('invalid GLB and paths retain the last accepted revision',async t=>{
  const {root,store}=await fixture(t),before=store.snapshot();
  await mkdir(path.join(root,'assets/imports'),{recursive:true});
  await writeFile(path.join(root,'assets/imports/broken.glb'),'not a glb');
  for(const file of ['assets/imports/broken.glb','../outside.glb','C:/private/file.glb']){
    const scene={...before.scene,assets:[...before.scene.assets,{id:'bad',file}],objects:[{id:'bad-object',asset:'bad',position:[0,0,-5],rotation:[0,0,0],scale:[1,1,1],collider:null}]};
    await assert.rejects(store.commit({baseRevision:before.revision,scene}));
    assert.equal(store.snapshot().revision,before.revision);
  }
});
test('external edit validation and undo use the same revision boundary',async t=>{
  const {root,store}=await fixture(t),before=store.snapshot();
  await writeFile(path.join(root,'world/world.json'),'{');
  await assert.rejects(store.readExternal());assert.equal(store.snapshot().revision,before.revision);
  const edited={...before,bible:{...before.bible,title:'External edit'}};
  await writeFile(path.join(root,'world/world.json'),JSON.stringify(edited));await store.readExternal();
  const after=store.snapshot();assert.equal(after.bible.title,'External edit');assert.notEqual(after.revision,before.revision);
  await store.undo(after.revision);assert.equal(store.snapshot().bible.title,before.bible.title);
});
test('unknown capabilities and non-finite transforms are rejected',async t=>{
  const {store}=await fixture(t),before=store.snapshot();
  await assert.rejects(store.commit({baseRevision:before.revision,scene:{...before.scene,environment:{...before.scene.environment,type:'execute-code'}}}));
  await assert.rejects(store.commit({baseRevision:before.revision,scene:{...before.scene,objects:[{id:'x',asset:'cove',position:[NaN,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null}]}}));
});
test('hot imports retain old bytes across an invalid write, undo and restart',async t=>{
  const {root,store}=await fixture(t),before=store.snapshot(),asset=before.scene.assets.find(a=>a.id==='lamp'),oldHash=store.hashes.lamp.hash;
  const alternate=await readFile(path.join(root,before.scene.assets.find(a=>a.id==='rug').file));
  await writeFile(path.join(root,asset.file),alternate);await store.refreshAssets();assert.notEqual(store.hashes.lamp.hash,oldHash);assert.equal(store.current.scene.assets.find(a=>a.id==='lamp').provenance,undefined);
  await store.undo(store.current.revision);assert.equal(store.hashes.lamp.hash,oldHash);
  await writeFile(path.join(root,store.current.scene.assets.find(a=>a.id==='lamp').file),'incomplete');await assert.rejects(store.refreshAssets());assert.equal(store.hashes.lamp.hash,oldHash);
  await store.close();const reopened=await WorldStore.open(root);t.after(()=>reopened.close());assert.equal(reopened.hashes.lamp.hash,oldHash);assert.match(reopened.diagnostic,/cached/);
});
