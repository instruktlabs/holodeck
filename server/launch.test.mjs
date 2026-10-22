import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defaultLaunchDirectory,parseLaunchArgs,prepareLaunchDirectory} from './launch.mjs';

const packageRoot=fileURLToPath(new URL('../',import.meta.url));

test('launch defaults to a cove beside the current directory',()=>{
  const cwd=path.join(packageRoot,'..','example-checkout');
  assert.equal(defaultLaunchDirectory(cwd),path.resolve(cwd,'..','holodeck-worlds','cove'));
  assert.deepEqual(parseLaunchArgs([]),{directory:undefined,port:4186});
  assert.deepEqual(parseLaunchArgs(['../island','--port','4190']),{directory:'../island',port:4190});
  assert.throws(()=>parseLaunchArgs(['--mystery']),/Usage: holodeck launch/);
  assert.throws(()=>parseLaunchArgs(['--port','80']),/Invalid port/);
});

test('launch scaffolds a new construct and reopens a valid world without replacing it',async()=>{
  const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-launch-'));
  try{
    const root=path.join(parent,'cove');
    const created=await prepareLaunchDirectory(root);
    assert.equal(created.created,true);
    const world=JSON.parse(await readFile(path.join(root,'world/world.json'),'utf8'));
    assert.equal(world.scene.environment.type,'construct');
    world.bible.title='Kept Cove';world.revision=4;
    await writeFile(path.join(root,'world/world.json'),JSON.stringify(world));
    const again=await prepareLaunchDirectory(root);
    assert.equal(again.created,false);assert.equal(again.title,'Kept Cove');
    assert.equal(JSON.parse(await readFile(path.join(root,'world/world.json'),'utf8')).revision,4);
  }finally{await rm(parent,{recursive:true,force:true});}
});

test('launch refuses an existing non-world and a folder inside the checkout',async()=>{
  const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-launch-'));
  try{
    const notes=path.join(parent,'notes');
    await mkdir(notes);await writeFile(path.join(notes,'readme.txt'),'not a world');
    await assert.rejects(prepareLaunchDirectory(notes),/not a Holodeck world/);
    await assert.rejects(readFile(path.join(notes,'world/world.json')),/ENOENT/);
    const file=path.join(parent,'plain.txt');await writeFile(file,'not a directory');
    await assert.rejects(prepareLaunchDirectory(file),/not a Holodeck world/);
    const inside=path.join(packageRoot,'site','launch-probe');
    await assert.rejects(prepareLaunchDirectory(inside),/outside the Holodeck source checkout/);
    await assert.rejects(readFile(path.join(inside,'world/world.json')),/ENOENT/);
  }finally{await rm(parent,{recursive:true,force:true});}
});
