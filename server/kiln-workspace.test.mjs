import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
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
      "await writeFile(path.join(process.argv[2],'setup-call.json'),JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));",
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
  assert.deepEqual(call,{args:[world,'--adopt','--harness','codex','--skills','compose'],cwd:world});
});

test('an existing workspace keeps its setup manifest without resolving or invoking Kiln again',async t=>{
  const {world,adapter}=await fixture(t),file=path.join(world,'.kiln/workspace.json');
  await mkdir(path.dirname(file));const original='{"runtime":"retained workspace runtime","custom":true}\n';await writeFile(file,original);
  await adapter.ensureKilnWorkspace(world);
  assert.equal(await readFile(file,'utf8'),original);
  await assert.rejects(readFile(path.join(world,'setup-call.json')),{code:'ENOENT'});
});
