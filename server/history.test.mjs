import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir,rename,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {WorldStore} from './world-store.mjs';
import {listRevisions,readRevisionBundle,restoreRevision,remixRevision} from './history.mjs';

async function fixture(t){
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-history-')),root=path.join(parent,'original');
 const store=await WorldStore.open(root);
 t.after(async()=>{await store.close();await rm(parent,{recursive:true,force:true});});
 return {root,parent,store};
}
test('history lists saved snapshots and restores exact old asset bytes as a new revision',async t=>{
 const {root,store}=await fixture(t),initial=store.snapshot(),oldHash=store.hashes.lamp.hash;
 const lamp=initial.scene.assets.find(a=>a.id==='lamp'),rug=initial.scene.assets.find(a=>a.id==='rug');
 await writeFile(path.join(root,lamp.file),await readFile(path.join(root,rug.file)));await store.refreshAssets();
 const changed=store.current.revision;assert.notEqual(store.hashes.lamp.hash,oldHash);
 await restoreRevision(store,{baseRevision:changed,revision:initial.revision});
 assert.equal(store.current.revision,changed+1);assert.equal(store.hashes.lamp.hash,oldHash);
 const rows=await listRevisions(root);assert.equal(rows[0].revision,changed+1);assert.ok(rows.some(r=>r.revision===initial.revision));
 assert.equal((await readRevisionBundle(root,initial.revision)).assets.lamp.hash,oldHash);
 await assert.rejects(restoreRevision(store,{baseRevision:changed,revision:initial.revision}),/changed/);
});
test('remix copies only a selected scene and pinned dependencies into a new editable workspace',async t=>{
 const {root,parent,store}=await fixture(t),revision=store.current.revision,destination=path.join(parent,'remixed');
 const note=await store.importReference(Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000000000000000','hex'),'Reference');
 await store.commit({baseRevision:revision,references:[note,{...note,id:'second-card',source:'assets/source/original.png'}],bible:{...store.current.bible,referenceIds:[note.id]}});
 await writeFile(path.join(root,'.holodeck/session/private.json'),'PRIVATE SESSION');
 const result=await remixRevision(root,store.current.revision,destination);
 assert.equal(result.world.revision,0);assert.equal(result.world.references.length,2);
 assert.equal(result.world.references[1].source,undefined);
 assert.equal(result.world.scene.assets.length,store.current.scene.assets.length);
 assert.equal((await readdir(destination)).includes('.holodeck'),false);
 assert.equal((await readdir(destination)).includes('.codex'),false);
 // World guidance names every provider and the Kiln log location, never Codex alone.
 for(const file of [path.join(destination,'AGENTS.md'),path.join(root,'AGENTS.md')]){
  const guide=await readFile(file,'utf8');
  assert.doesNotMatch(guide,/Connect local Codex|Configure a (local Kiln workspace|separate kiln_workspace)/);
  assert.match(guide,/Codex and Claude Code connections also configure its kiln_workspace tools/);assert.match(guide,/assets\/source\/KILN_PROGRESS\.md/);
 }
 assert.match(await readFile(path.join(destination,'AGENTS.md'),'utf8'),/a Claude Code connection loads them as skills/);
 const reopened=await WorldStore.open(destination);t.after(()=>reopened.close());
 assert.equal(reopened.hashes.lamp.hash,store.hashes.lamp.hash);
 assert.equal(reopened.current.bible.title,store.current.bible.title);
 await assert.rejects(remixRevision(root,revision,destination),/exist/i);
});
test('history rejects tampered hashes and unsafe revision inputs before restore',async t=>{
 const {root,store}=await fixture(t),before=store.current.revision;
 for(const revision of ['../accepted',-1,1.5,Infinity])await assert.rejects(readRevisionBundle(root,revision),/revision/i);
 const receiptPath=path.join(root,`.holodeck/history/${before}.bundle.json`),receipt=JSON.parse(await readFile(receiptPath,'utf8'));
 receipt.assets.lamp.hash='../secret';await writeFile(receiptPath,JSON.stringify(receipt));
 await assert.rejects(restoreRevision(store,{baseRevision:before,revision:before}),/hash/i);
 assert.equal(store.current.revision,before);
});
test('restore refuses an imports junction before writing any dependency outside the workspace',async t=>{
 const {root,parent,store}=await fixture(t),outside=path.join(parent,'outside'),imports=path.join(root,'assets/imports');
 await mkdir(outside);await rename(imports,imports+'-saved');await symlink(outside,imports,process.platform==='win32'?'junction':'dir');
 await assert.rejects(restoreRevision(store,{baseRevision:store.current.revision,revision:store.current.revision}),/outside|escape/);
 assert.deepEqual(await readdir(outside),[]);
});
