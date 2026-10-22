import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import path from 'node:path';

async function fixture(t,layout){
  const directory=await mkdtemp(path.join(os.tmpdir(),'holodeck kiln lookup '));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const app=path.join(directory,'consumer app'),host=path.join(app,'node_modules/@instruktlabs/holodeck'),world=path.join(directory,'my world'),module=path.join(host,'server/kiln-workspace.mjs');
  await mkdir(path.dirname(module),{recursive:true});await mkdir(world);
  await writeFile(module,await readFile(new URL('./kiln-workspace.mjs',import.meta.url)));
  if(layout){
    const kiln=path.join(layout==='nested'?host:app,'node_modules/@instruktlabs/kiln');
    await mkdir(path.join(kiln,'lib'),{recursive:true});await mkdir(path.join(kiln,'scripts'));
    // Matches Kiln 1.3.1's import-only root export and unexported package.json.
    await writeFile(path.join(kiln,'package.json'),JSON.stringify({name:'@instruktlabs/kiln',version:'1.3.1',type:'module',exports:{'.':{types:'./lib/index.d.ts',import:'./lib/index.js'}},bin:{'kiln-init':'./scripts/create-workspace.mjs'}}));
    await writeFile(path.join(kiln,'lib/index.js'),"throw new Error('Locating the initializer must not evaluate the engine SDK');\n");
    await writeFile(path.join(kiln,'scripts/create-workspace.mjs'),[
      "import {writeFile} from 'node:fs/promises';",
      "import path from 'node:path';",
      "import {appendFile} from 'node:fs/promises';",
      "await writeFile(path.join(process.argv[2],'setup-call.json'),JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));",
      "await appendFile(path.join(process.argv[2],'setup-calls.log'),JSON.stringify(process.argv.slice(3))+'\\n');",
    ].join('\n'));
    const require=createRequire(module);
    assert.throws(()=>require.resolve('@instruktlabs/kiln/package.json'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
    assert.throws(()=>require.resolve('@instruktlabs/kiln'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
  }
  return {world,adapter:await import(pathToFileURL(module).href)};
}

for(const layout of ['nested','hoisted'])test(`workspace setup resolves an import-only ${layout} Kiln package without loading its SDK`,async t=>{
  const {world,adapter}=await fixture(t,layout);
  await adapter.ensureKilnWorkspace(world);
  const call=JSON.parse(await readFile(path.join(world,'setup-call.json'),'utf8'));
  assert.deepEqual(call,{args:[world,'--adopt','--harness','codex'],cwd:world});
});

test('a new workspace registers the connecting provider as its Kiln harness and skips the compose skill',async t=>{
  for(const [provider,harness] of [['codex','codex'],['claude','claude'],['cursor','cursor-agent']]){
    const {world,adapter}=await fixture(t,'nested');
    await adapter.ensureKilnWorkspace(world,{provider});
    const call=JSON.parse(await readFile(path.join(world,'setup-call.json'),'utf8'));
    assert.deepEqual(call.args,[world,'--adopt','--harness',harness]);
    assert.equal(call.args.includes('--skills'),false,'kiln-compose-scene describes Kiln terrain composition, not Holodeck');
  }
});

test('an existing workspace gains the connecting harness once and keeps its other registrations',async t=>{
  const {world,adapter}=await fixture(t,'nested'),file=path.join(world,'.kiln/workspace.json');
  await mkdir(path.dirname(file));await writeFile(file,JSON.stringify({schemaVersion:2,harness:'codex',harnesses:['codex']}));
  await adapter.ensureKilnWorkspace(world,{provider:'codex'});
  await assert.rejects(readFile(path.join(world,'setup-calls.log')),{code:'ENOENT'},'a registered harness runs no setup');
  await adapter.ensureKilnWorkspace(world,{provider:'claude'});
  assert.deepEqual((await readFile(path.join(world,'setup-calls.log'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)),[['--adopt','--harness','claude']]);
});

test('a failed harness registration leaves an existing workspace usable',async t=>{
  const {world,adapter}=await fixture(t,'nested'),file=path.join(world,'.kiln/workspace.json');
  await mkdir(path.dirname(file));await writeFile(file,JSON.stringify({schemaVersion:2,harness:'codex',harnesses:['codex']}));
  // A directory where the stub appends its log makes the initializer exit non-zero.
  await mkdir(path.join(world,'setup-calls.log'));
  await adapter.ensureKilnWorkspace(world,{provider:'claude'});
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')).harnesses,['codex']);
});

test('the session skills plugin copies installed world skills once, without the compose skill',async t=>{
  const {world,adapter}=await fixture(t),out=path.join(world,'..','plugin');
  t.after(()=>rm(out,{recursive:true,force:true}));
  assert.equal(await adapter.worldSkillsPlugin(world,out),null,'no skills means no plugin');
  const skill=async(registry,name,body)=>{await mkdir(path.join(world,registry,name,'references'),{recursive:true});await writeFile(path.join(world,registry,name,'SKILL.md'),body);await writeFile(path.join(world,registry,name,'references/a.md'),body);};
  await skill('.agents/skills','holodeck-author-world','agents copy');
  await skill('.claude/skills','kiln-author-asset','claude copy');
  await skill('skills','kiln-author-asset','kiln registry copy');
  await skill('skills','kiln-compose-scene','compose');
  await mkdir(path.join(world,'skills','not-a-skill'));
  const plugin=await adapter.worldSkillsPlugin(world,out);
  assert.deepEqual(plugin.skills,['holodeck-author-world','kiln-author-asset']);
  assert.deepEqual((await readdir(path.join(out,'skills'))).sort(),['holodeck-author-world','kiln-author-asset']);
  assert.equal(await readFile(path.join(out,'skills/kiln-author-asset/SKILL.md'),'utf8'),'claude copy','the Claude registry wins');
  assert.equal(await readFile(path.join(out,'skills/holodeck-author-world/references/a.md'),'utf8'),'agents copy');
  assert.equal(JSON.parse(await readFile(path.join(out,'.claude-plugin/plugin.json'),'utf8')).name,adapter.PLUGIN_NAME);
  await rm(path.join(world,'.claude/skills'),{recursive:true});
  assert.deepEqual((await adapter.worldSkillsPlugin(world,out)).skills,['holodeck-author-world','kiln-author-asset']);
  assert.equal(await readFile(path.join(out,'skills/kiln-author-asset/SKILL.md'),'utf8'),'kiln registry copy','a rebuild replaces the previous copy');
});

test('an existing workspace keeps its setup manifest without resolving or invoking Kiln again',async t=>{
  const {world,adapter}=await fixture(t),file=path.join(world,'.kiln/workspace.json');
  await mkdir(path.dirname(file));const original='{"runtime":"retained workspace runtime","custom":true}\n';await writeFile(file,original);
  await adapter.ensureKilnWorkspace(world);
  assert.equal(await readFile(file,'utf8'),original);
  await assert.rejects(readFile(path.join(world,'setup-call.json')),{code:'ENOENT'});
});
