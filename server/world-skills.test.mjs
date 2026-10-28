import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {access,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {validateWorld} from '../src/world/contract.mjs';
import {OPTIONAL_SKILLS,DESTINATIONS,enabledOptionalSkills} from '../src/world/optional-skills.mjs';
import {installWorldSkills,syncOptionalSkills} from './world-skills.mjs';
import {scaffold} from './scaffold.mjs';
import {createHost} from './host.mjs';

const packageSkills=fileURLToPath(new URL('../skills',import.meta.url));
const exists=file=>access(file).then(()=>true,()=>false);
async function folder(t){const directory=await mkdtemp(path.join(os.tmpdir(),'holodeck-world-skills-'));t.after(()=>rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:50}));return directory;}
const world=destinations=>({schemaVersion:2,scene:{...(destinations?{destinations}:{})}});

test('every package skill follows the Agent Skills frontmatter, and each optional one names a destination',async()=>{
  const names=(await readdir(packageSkills,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name);
  for(const name of Object.keys(OPTIONAL_SKILLS))assert.ok(names.includes(name),`${name} is in skills/`);
  assert.deepEqual(DESTINATIONS,['unity']);
  for(const name of names){
    const text=(await readFile(path.join(packageSkills,name,'SKILL.md'),'utf8')).replace(/\r\n/g,'\n'),[,front,body]=text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const keys=front.split('\n').filter(line=>/^\S/.test(line)).map(line=>line.split(':')[0]);
    assert.ok(keys.every(key=>['name','description','license','compatibility','metadata'].includes(key)),`${name} uses only spec fields: ${keys}`);
    assert.equal(front.match(/^name: (.*)$/m)[1],name);
    assert.ok(front.match(/^description: (.*)$/m)[1].length<=1024,`${name} description length`);
    assert.ok(body.split('\n').length<500,`${name} body under 500 lines`);
  }
});

test('scene.destinations is a schema v2 list of known destinations',async()=>{
  const base=JSON.parse(await readFile(new URL('../examples/tidemark/world/world.json',import.meta.url),'utf8'));
  const withDestinations=destinations=>({...structuredClone(base),scene:{...structuredClone(base.scene),destinations}});
  validateWorld(withDestinations(['unity']));validateWorld(withDestinations([]));
  assert.throws(()=>validateWorld(withDestinations(['godot'])),/Unknown destination "godot"; supported: unity/);
  assert.throws(()=>validateWorld(withDestinations(['unity','unity'])),/distinct destinations/);
  assert.throws(()=>validateWorld(withDestinations('unity')),/distinct destinations/);
  assert.deepEqual(enabledOptionalSkills(withDestinations(['unity'])),['holodeck-export-unity']);
  assert.deepEqual(enabledOptionalSkills({...world(['unity']),schemaVersion:1}),[]);
});

test('a world gets an optional skill only while it declares the destination; dropping it removes the copy',async t=>{
  const root=await folder(t),skills=path.join(root,'.agents/skills'),unity=path.join(skills,'holodeck-export-unity');
  assert.deepEqual(await installWorldSkills(root,world()),[]);
  for(const core of ['holodeck-author-world','holodeck-integrate-asset','holodeck-verify-world'])assert.ok(await exists(path.join(skills,core,'SKILL.md')),core);
  assert.equal(await exists(unity),false,'absent by default');
  await writeFile(path.join(skills,'holodeck-verify-world/local-note.md'),'kept');
  assert.deepEqual(await syncOptionalSkills(root,world(['unity'])),['holodeck-export-unity']);
  assert.equal(await readFile(path.join(unity,'SKILL.md'),'utf8'),await readFile(path.join(packageSkills,'holodeck-export-unity/SKILL.md'),'utf8'));
  assert.ok(await exists(path.join(unity,'references/project-transfer.md')));
  await writeFile(path.join(unity,'SKILL.md'),'stale');
  await syncOptionalSkills(root,world(['unity']));
  assert.notEqual(await readFile(path.join(unity,'SKILL.md'),'utf8'),'stale','a sync refreshes the package copy');
  assert.deepEqual(await syncOptionalSkills(root,world([])),[]);
  assert.equal(await exists(unity),false,'removed with the destination');
  assert.equal(await readFile(path.join(skills,'holodeck-verify-world/local-note.md'),'utf8'),'kept','core skills are not touched');
  const opted=await folder(t);await installWorldSkills(opted,world(['unity']));
  assert.ok(await exists(path.join(opted,'.agents/skills/holodeck-export-unity/SKILL.md')),'installed with a new opted-in world');
});

test('the host syncs optional skills on connect and when an accepted revision changes the destinations',async t=>{
  const parent=await folder(t),root=path.join(parent,'world'),unity=path.join(root,'.agents/skills/holodeck-export-unity');
  await scaffold(root);assert.ok(await exists(path.join(root,'.agents/skills/holodeck-author-world/SKILL.md')));
  assert.equal(await exists(unity),false,'a scaffolded world has no optional skill');
  const agent=Object.assign(new EventEmitter(),{snapshot:()=>({connected:true,provider:'codex'}),connect:async()=>({connected:true}),close(){}});
  const host=await createHost(root,{agentFactory:()=>agent,ensureWorkspace:async()=>null});
  const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
  const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];await session.json();
  const post=async(route,data)=>{const res=await fetch(base+'/api/'+route,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:res.status,body:await res.json()};};
  const commit=destinations=>{const {scene}=host.store.snapshot();if(destinations)scene.destinations=destinations;else delete scene.destinations;return post('world',{baseRevision:host.store.current.revision,scene});};
  const until=async(check,label)=>{for(let i=0;i<100&&!(await check());i++)await new Promise(r=>setTimeout(r,20));assert.ok(await check(),label);};
  assert.equal((await commit(['unity'])).status,200);
  assert.equal((await post('agent/connect',{provider:'codex'})).status,200);
  assert.ok(await exists(path.join(unity,'SKILL.md')),'present after connecting an opted-in world');
  assert.equal((await commit(null)).status,200);
  await until(async()=>!(await exists(unity)),'removed after the revision that drops the destination');
  assert.equal((await commit(['unity'])).status,200);
  await until(()=>exists(path.join(unity,'SKILL.md')),'installed again by the next opted-in revision');
  const unknown=await commit(['godot']);assert.equal(unknown.status,400);assert.match(unknown.body.error,/Unknown destination "godot"/);
});
