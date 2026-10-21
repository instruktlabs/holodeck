import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD,validateWorld} from '../src/world/contract.mjs';
import {WorldStore} from './world-store.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const world=()=>({...structuredClone(DEFAULT_WORLD),references:[{id:'note-1',kind:'note',title:'Movement',notes:'Walk slowly, retain a clear route.',group:'Experience',status:'exploring',layout:{x:30,y:106,w:360,h:270},page:0}],bible:{...DEFAULT_WORLD.bible,referenceIds:['note-1']}});
test('board notes, groups and layout are editable scene data',()=>assert.doesNotThrow(()=>validateWorld(world())));
test('board refuses dangling bible pins, unsafe file pointers and off-board layouts',()=>{
  const w=world();w.bible.referenceIds=['missing'];assert.throws(()=>validateWorld(w),/Pinned/);
  const f=world();f.references=[{id:'file',kind:'file',file:'../../private.txt',title:'Bad',notes:''}];assert.throws(()=>validateWorld(f),/Reference/);
  const o=world();o.references[0].layout.x=1199;assert.throws(()=>validateWorld(o),/layout/);
});
test('file pointers are versioned, readable on demand, and bounded to the world',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-board-')),store=await WorldStore.open(root);t.after(async()=>{await store.close();await rm(root,{recursive:true,force:true});});
  await writeFile(path.join(root,'assets/source/direction.md'),'# Direction\nSoft light. Clear paths.');
  const card=await store.linkReference('assets/source/direction.md');await store.commit({baseRevision:0,references:[card]});
  assert.match((await store.readReference(card.id)).text,/Soft light/);
  await writeFile(path.join(root,'assets/source/direction.md'),'# Direction\nCool dusk.');
  assert.match((await store.readReference(card.id)).text,/Soft light/);
  const refreshed=await store.linkReference('assets/source/direction.md');assert.notEqual(refreshed.file,card.file);
  await assert.rejects(store.linkReference('../private.txt'));
  await assert.rejects(store.linkReference('world/world.json'));
  await store.commit({baseRevision:1,references:[]});await assert.rejects(store.readReference(card.id),/not on/);
  await store.undo(2);assert.match((await store.readReference(card.id)).text,/Soft light/);
});
