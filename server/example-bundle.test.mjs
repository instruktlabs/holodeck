import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,stat,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {scaffold} from './scaffold.mjs';
import {WorldStore} from './world-store.mjs';
import {createExampleBundle,readExampleBundle,installExampleBundle,readExampleManifest,readExamplePreview} from './example-bundle.mjs';
import {listExamples} from './example-catalog.mjs';
import {scaffold as scaffoldBundle} from './scaffold.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
async function fixture(t){
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-example-bundle-')),root=path.join(parent,'world');t.after(async()=>{assert.ok(path.resolve(parent).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(parent,{recursive:true,force:true});});
 await scaffold(root,'construct');const store=await WorldStore.open(root),world=store.snapshot();world.bible.title='PRIVATE_TITLE';world.bible.intent='PRIVATE_INTENT';world.bible.rules='PRIVATE_RULES';world.references[0].notes='PRIVATE_NOTE';world.scene.moodboard.title='PRIVATE_BOARD';world.scene.assets.find(a=>a.id==='lamp').provenance.collection='C:\\PRIVATE\\assets';
 await store.commit({baseRevision:0,bible:world.bible,references:world.references,scene:world.scene});const accepted=JSON.parse(await readFile(path.join(root,'.holodeck/accepted-bundle.json'),'utf8'));await store.close();await writeFile(path.join(root,'.env'),'PRIVATE_SECRET');await writeFile(path.join(root,'.holodeck/session/private.json'),'PRIVATE_SESSION');return {root,parent,accepted};
}
const options=out=>({out,id:'portable-study',title:'Portable Study',description:'An independent scene fixture.',authoring:{intent:'Public sample intent.',rules:'Keep the arrival clear.'}});
test('bundle projects an immutable accepted revision with exact GLBs and an empty physical board',async t=>{
 const {root,parent,accepted}=await fixture(t),out=path.join(parent,'bundle'),asset=accepted.world.scene.assets.find(a=>a.id==='lamp'),before=accepted.assets.lamp.hash;
 await writeFile(path.join(root,asset.file),'OFFLINE_UNACCEPTED');await writeFile(path.join(root,'world/world.json'),'{invalid offline edit');
 const result=await createExampleBundle(root,{...options(out),revision:accepted.world.revision});assert.equal(result.sourceRevision,accepted.world.revision);
 const bundle=await readExampleBundle(out),w=bundle.world;assert.equal(w.revision,0);assert.equal(w.bible.title,'Portable Study');assert.equal(w.bible.intent,'Public sample intent.');assert.deepEqual(w.references,[]);assert.equal(w.bible.referenceIds,undefined);assert.deepEqual(w.scene.moodboard.position,accepted.world.scene.moodboard.position);assert.equal(w.scene.moodboard.title,'World board');assert.equal(w.scene.moodboard.page,0);
 assert.equal(bundle.assets.lamp.hash,before);assert.equal(digest(bundle.assets.lamp.bytes),before);assert.equal(w.scene.assets.find(a=>a.id==='lamp').provenance.collection,undefined);
 const files=await readdir(out,{recursive:true});for(const file of files){assert.doesNotMatch(file,/\.holodeck|\.env|session|references|source/);const target=path.join(out,file);if((await stat(target)).isFile()&&!file.endsWith('.glb')){const text=await readFile(target,'utf8');assert.doesNotMatch(text,/PRIVATE_|C:\\\\PRIVATE/);assert.ok(!text.includes(root));}}
 assert.equal((await readExampleManifest(out)).integrity,bundle.manifest.integrity);await assert.rejects(createExampleBundle(root,options(out)),/already exists/);
});
test('bundle install verifies all hashes before creating a fresh editable revision-zero workspace',async t=>{
 const {root,parent}=await fixture(t),out=path.join(parent,'bundle');await createExampleBundle(root,options(out));const workspace=path.join(parent,'installed'),world=await installExampleBundle(out,workspace);assert.equal(world.revision,0);assert.equal(world.bible.title,'Portable Study');{const guide=await readFile(path.join(workspace,'AGENTS.md'),'utf8');assert.ok(guide.includes('world_read'));assert.match(guide,/a Claude Code connection loads them as skills/);assert.match(guide,/assets\/source\/KILN_PROGRESS\.md/);assert.doesNotMatch(guide,/Configure a separate kiln_workspace/);}
 const store=await WorldStore.open(workspace);assert.equal(store.snapshot().revision,0);assert.deepEqual(store.current.scene,world.scene);await store.close();await assert.rejects(installExampleBundle(out,workspace),/already exists/);
 const manifest=await readExampleManifest(out),file=path.join(out,manifest.assets[0].file);await writeFile(file,'corrupt');const bad=path.join(parent,'bad');await assert.rejects(installExampleBundle(out,bad),/hash|size|GLB/);await assert.rejects(stat(bad),{code:'ENOENT'});
});
test('tampered manifest, unlisted files and unsafe metadata never become installable bundles',async t=>{
 const {root,parent}=await fixture(t),out=path.join(parent,'bundle');await createExampleBundle(root,options(out));const manifestPath=path.join(out,'example.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));manifest.title='changed';await writeFile(manifestPath,JSON.stringify(manifest));await assert.rejects(readExampleBundle(out),/integrity/);
 const second=path.join(parent,'second');await createExampleBundle(root,options(second));await writeFile(path.join(second,'private.txt'),'PRIVATE_TEXT');await assert.rejects(readExampleBundle(second),/Unexpected bundle file/);
 await assert.rejects(createExampleBundle(root,{...options(path.join(parent,'unsafe')),title:'C:\\private\\world'}),/absolute|portable/i);
});
test('example catalog advertises portable metadata and scaffold installs a named bundle',async t=>{
 const {root,parent}=await fixture(t),directory=path.join(parent,'examples');await mkdir(directory);for(const id of ['construct','courtyard','kinetic'])await copyFile(new URL(`../examples/${id}.json`,import.meta.url),path.join(directory,`${id}.json`));
 const manifest=await createExampleBundle(root,options(path.join(directory,'portable-study'))),examples=await listExamples({directory});assert.deepEqual(examples.map(entry=>entry.id),['construct','courtyard','kinetic','portable-study']);assert.ok(examples.every(entry=>!entry.file));assert.equal(examples[3].integrity,manifest.integrity);
 const world=await scaffoldBundle(path.join(parent,'named'),'portable-study',{examplesDirectory:directory});assert.equal(world.bible.title,'Portable Study');assert.equal(world.revision,0);
 await assert.rejects(scaffoldBundle(path.join(parent,'escaped'),'../portable-study',{examplesDirectory:directory}),/valid local example/);await assert.rejects(stat(path.join(parent,'escaped')),{code:'ENOENT'});
 const duplicate=path.join(parent,'same-content');assert.equal((await createExampleBundle(root,options(duplicate))).integrity,manifest.integrity);
 await writeFile(path.join(directory,'portable-study','EXAMPLE-INCOMPLETE.txt'),'Interrupted');await assert.rejects(readExampleManifest(path.join(directory,'portable-study')),/incomplete/);assert.equal((await listExamples({directory})).length,3);
});
test('local bundle CLI installs without downloading or executing bundle-supplied code',async t=>{
 const {root,parent}=await fixture(t),out=path.join(parent,'bundle');await createExampleBundle(root,options(out));const target=path.join(parent,'cli');const stdout=execFileSync(process.execPath,[fileURLToPath(new URL('../bin/holodeck.mjs',import.meta.url)),'init',target,'--bundle',out],{encoding:'utf8'});assert.match(stdout,/Created Portable Study world/);assert.equal(JSON.parse(await readFile(path.join(target,'world/world.json'),'utf8')).revision,0);
});
test('optional preview has a bounded PNG receipt and is copied without its source path',async t=>{
 const {root,parent}=await fixture(t),preview=path.join(parent,'private-capture.png'),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a63sAAAAASUVORK5CYII=','base64');await writeFile(preview,bytes);
 const out=path.join(parent,'bundle'),manifest=await createExampleBundle(root,{...options(out),preview});assert.deepEqual(manifest.preview,{file:'preview.png',sha256:digest(bytes),bytes:bytes.length,width:1,height:1});assert.deepEqual((await readExampleBundle(out)).previewBytes,bytes);
 assert.deepEqual(await readExamplePreview(out),{bytes,sha256:digest(bytes),width:1,height:1});
 const target=path.join(parent,'installed');await installExampleBundle(out,target);assert.deepEqual(await readFile(path.join(target,'EXAMPLE-preview.png')),bytes);assert.equal(JSON.parse(await readFile(path.join(target,'EXAMPLE.json'),'utf8')).preview.file,'EXAMPLE-preview.png');
 await writeFile(path.join(out,'preview.png'),Buffer.concat([bytes,Buffer.from('changed')]));await assert.rejects(readExampleBundle(out),/preview hash/);
 const oversized=Buffer.from(bytes);oversized.writeUInt32BE(4097,16);await writeFile(preview,oversized);await assert.rejects(createExampleBundle(root,{...options(path.join(parent,'bad-preview')),preview}),/dimensions/);await assert.rejects(stat(path.join(parent,'bad-preview')),{code:'ENOENT'});
});
test('absolute paths embedded in exact GLB metadata require a new reviewed asset revision',async t=>{
 const {root,parent,accepted}=await fixture(t),pinned=accepted.assets.lamp,original=await readFile(path.join(root,`.holodeck/blobs/${pinned.hash}.glb`)),oldLength=original.readUInt32LE(12),doc=JSON.parse(original.subarray(20,20+oldLength).toString());doc.extras={source:'C:\\private\\author.js'};
 const text=JSON.stringify(doc),json=Buffer.from(text.padEnd(Math.ceil(text.length/4)*4,' ')),bytes=Buffer.concat([original.subarray(0,20),json,original.subarray(20+oldLength)]);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);pinned.hash=digest(bytes);await writeFile(path.join(root,`.holodeck/blobs/${pinned.hash}.glb`),bytes);await writeFile(path.join(root,'.holodeck/accepted-bundle.json'),JSON.stringify(accepted));
 const out=path.join(parent,'private-metadata');await assert.rejects(createExampleBundle(root,options(out)),/absolute path/);await assert.rejects(stat(out),{code:'ENOENT'});
});
