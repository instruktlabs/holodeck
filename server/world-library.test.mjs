import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {WorldLibrary} from './world-library.mjs';
const world=name=>({schemaVersion:2,revision:0,bible:{title:name},scene:{}});
async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-library-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function seed(root,folder,name){await mkdir(path.join(root,folder,'world'),{recursive:true});await writeFile(path.join(root,folder,'world/world.json'),JSON.stringify(world(name)));return path.join(root,folder);}
const fakeScaffold=async(root)=>{await mkdir(root);await mkdir(path.join(root,'world'));const w=world('A new world');await writeFile(path.join(root,'world/world.json'),JSON.stringify(w));return w;};
test('library discovers only direct worlds and persists stable IDs without opening stores',async t=>{
 const root=await fixture(t);await seed(root,'beach','Beach');await mkdir(path.join(root,'unrelated'));const library=await WorldLibrary.open(root,{scaffold:fakeScaffold});const list=await library.list();assert.equal(list.length,1);assert.equal(list[0].name,'Beach');assert.equal(list[0].revision,0);assert.equal(list[0].status,'ready');assert.equal((await (await WorldLibrary.open(root)).list())[0].id,list[0].id);await assert.rejects(readFile(path.join(root,'beach','.holodeck/host.lock')),{code:'ENOENT'});
});
test('library creates named construct with opaque folder and rejects path input',async t=>{
 const root=await fixture(t);let template;const library=await WorldLibrary.open(root,{scaffold:async(r,id)=>{template=id;return fakeScaffold(r);}});const made=await library.create({name:'Tidemark Island',templateId:'construct'});assert.equal(template,'construct');assert.equal(made.name,'Tidemark Island');assert.match(made.id,/^[a-f0-9-]{36}$/);assert.equal((JSON.parse(await readFile(path.join(await library.resolve(made.id),'world/world.json'),'utf8'))).bible.title,'Tidemark Island');await assert.rejects(library.resolve('../beach'),/Unknown world/);await assert.rejects(library.create({name:'x',templateId:'../../private'}),/template/);
});
test('library excludes junctions and refuses a registered directory replaced by a junction',async t=>{
 const root=await fixture(t),outside=await fixture(t);await seed(outside,'secret','Secret');const local=await seed(root,'beach','Beach'),library=await WorldLibrary.open(root);const [entry]=await library.list();await symlink(path.join(outside,'secret'),path.join(root,'escape'),'junction');assert.equal((await library.list()).length,1);await rm(local,{recursive:true});await symlink(path.join(outside,'secret'),local,'junction');await assert.rejects(library.resolve(entry.id),/symbolic|direct|outside/);assert.equal((await library.list())[0].status,'unavailable');
});
test('failed creation remains unavailable and never adopts partial content',async t=>{
 const root=await fixture(t),library=await WorldLibrary.open(root,{scaffold:async r=>{await mkdir(r);throw new Error('fixture failed');}});await assert.rejects(library.create({name:'Failed'}),/fixture failed/);const [entry]=await library.list();assert.equal(entry.status,'unavailable');await assert.rejects(library.resolve(entry.id),/incomplete/);
});
test('concurrent catalog writers preserve registrations and metadata prefers accepted snapshot',async t=>{
 const root=await fixture(t),r=await seed(root,'beach','staged');await mkdir(path.join(r,'.holodeck'));await writeFile(path.join(r,'.holodeck/accepted-bundle.json'),JSON.stringify({world:{...world('Accepted'),revision:3}}));const a=await WorldLibrary.open(root,{scaffold:fakeScaffold}),b=await WorldLibrary.open(root,{scaffold:fakeScaffold});await Promise.all([a.create({name:'One'}),b.create({name:'Two'})]);const list=await a.list();assert.equal(list.length,3);assert.equal(new Set(list.map(v=>v.id)).size,3);assert.equal(list.find(v=>v.folder==='beach').name,'Accepted');assert.equal(list.find(v=>v.folder==='beach').revision,3);
});
test('existing names with spaces work and nested metadata junctions cannot escape',async t=>{
 const root=await fixture(t),outside=await fixture(t),r=await seed(root,'My Beach World','Beach'),library=await WorldLibrary.open(root);const id=await library.register(r);assert.equal(await library.resolve(id),r);await mkdir(path.join(outside,'private'));await writeFile(path.join(outside,'private','accepted-bundle.json'),JSON.stringify({world:world('Private title')}));await symlink(path.join(outside,'private'),path.join(r,'.holodeck'),'junction');const [entry]=await library.list();assert.equal(entry.status,'unavailable');assert.match(entry.error,/outside/);assert.notEqual(entry.name,'Private title');
});
test('incomplete examples stay unavailable and writable directory junctions are rejected',async t=>{
 const root=await fixture(t),outside=await fixture(t),r=await seed(root,'beach','Beach'),library=await WorldLibrary.open(root),[entry]=await library.list();await writeFile(path.join(r,'INSTALL-INCOMPLETE.txt'),'incomplete');assert.equal((await library.list())[0].status,'unavailable');await assert.rejects(library.resolve(entry.id),/incomplete/);await rm(path.join(r,'INSTALL-INCOMPLETE.txt'));await symlink(outside,path.join(r,'assets'),'junction');await assert.rejects(library.resolve(entry.id),/symbolic/);
});
