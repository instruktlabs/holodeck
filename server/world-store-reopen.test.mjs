import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {WorldStore} from './world-store.mjs';

async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-reopen-')),stores=[];
 const open=async()=>{const store=await WorldStore.open(root);stores.push(store);return store;};
 t.after(async()=>{for(const store of stores)await store.close();assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(root,{recursive:true,force:true});});
 return {root,open};
}
test('reopening after an offline asset replacement preserves the old receipt and creates a new revision',async t=>{
 const {root,open}=await fixture(t),initial=await open(),world=initial.snapshot(),oldHash=initial.hashes.lamp.hash;
 const receiptFile=path.join(root,`.holodeck/history/${world.revision}.bundle.json`),receipt=await readFile(receiptFile,'utf8');
 await initial.close();
 const lamp=world.scene.assets.find(a=>a.id==='lamp'),rug=world.scene.assets.find(a=>a.id==='rug');
 await writeFile(path.join(root,lamp.file),await readFile(path.join(root,rug.file)));
 const reopened=await open();
 assert.equal(reopened.current.revision,world.revision+1);
 assert.notEqual(reopened.hashes.lamp.hash,oldHash);
 assert.equal(await readFile(receiptFile,'utf8'),receipt);
 assert.equal(reopened.current.scene.assets.find(a=>a.id==='lamp').provenance,undefined);
 await reopened.close();const unchanged=await open();assert.equal(unchanged.current.revision,world.revision+1);
});
test('valid offline scene edits become a new revision while invalid files preserve accepted data and diagnostics',async t=>{
 const {root,open}=await fixture(t),initial=await open(),world=initial.snapshot();await initial.close();
 world.bible.title='Offline edit';await writeFile(path.join(root,'world/world.json'),JSON.stringify(world));
 const edited=await open();assert.equal(edited.current.revision,world.revision+1);assert.equal(edited.current.bible.title,'Offline edit');
 const accepted=await readFile(path.join(root,'.holodeck/accepted-bundle.json'),'utf8');await edited.close();
 await writeFile(path.join(root,'world/world.json'),'{incomplete');
 const invalid=await open();assert.equal(invalid.current.revision,world.revision+1);assert.equal(invalid.current.bible.title,'Offline edit');assert.match(invalid.diagnostic,/accepted|cached/i);
 assert.equal(await readFile(path.join(root,'.holodeck/accepted-bundle.json'),'utf8'),accepted);
});
