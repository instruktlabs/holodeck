import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHost} from './host.mjs';
import {scaffold} from './scaffold.mjs';
import {callWorldTool,MAX_SCENE_JSON_BYTES} from './world-tools.mjs';

// A schema 2 world served by a real host. The agent factory captures the
// propose/observe/staged hooks every adapter passes to callWorldTool.
async function fixture(t){
  const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-staging-')),root=path.join(parent,'world');
  await scaffold(root);let hooks;
  const host=await createHost(root,{agentFactory:(store,options)=>{hooks=options;return Object.assign(new EventEmitter(),{snapshot:()=>({connected:false}),close(){}});}});
  t.after(async()=>{await host.close();await rm(parent,{recursive:true,force:true});});
  const call=(name,args)=>callWorldTool(name,args,{store:host.store,...hooks});
  const propose=args=>call('world_propose',{baseRevision:host.store.current.revision,sceneJson:null,sceneFile:null,bibleJson:null,referencesJson:null,summary:'Staged',...args});
  const write=async(file,text)=>{await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text);};
  return {root,host,call,propose,write};
}
const shapes=count=>Array.from({length:count},(_,i)=>({id:`stone-${i}`,shape:{type:'box',size:[.4,.3,.4],color:'#8a857a',offset:[0,.15,0]},position:[(i%40)-20,0,Math.floor(i/40)-10],rotation:[0,i*.1,0],scale:[1,1,1],collider:null,layer:'world'}));
const withTerrain=(scene,height)=>({...scene,runtime:{...scene.runtime,modules:[...scene.runtime.modules.filter(m=>m!=='terrain.heightfield@1'),'terrain.heightfield@1']},terrain:{type:'heightfield',bounds:[-20,20,-20,20],segments:[32,32],baseHeight:0,stamps:[{id:'rise',center:[0,0],radius:[10,10],height,operation:'add',plateau:.5,falloff:2}]}});

test('an 800-placement scene stages from a file under assets/source without inline JSON',async t=>{
  const {host,propose,write}=await fixture(t),base=host.store.current,scene={...base.scene,objects:[...base.scene.objects,...shapes(800)]};
  await write('assets/source/turn5/scene.json',JSON.stringify(scene));
  const {data}=await propose({sceneFile:'assets/source/turn5/scene.json'});
  assert.equal(data.status,'awaiting user review');
  const session=host.session();
  assert.equal(session.proposal.id,data.proposalId);
  assert.equal(session.proposal.world.scene.objects.length,base.scene.objects.length+800);
  assert.equal(host.store.current.revision,base.revision,'staging never applies');
});

test('scene files outside assets/source, oversize or malformed are refused before staging',async t=>{
  const {root,host,propose,write}=await fixture(t),scene=JSON.stringify(host.store.current.scene);
  await write('assets/source/ok.json',scene);await write('world/copy.json',scene);await write('assets/imports/scene.json',scene);
  for(const file of ['../outside.json','assets/source/../../world/copy.json','assets/source/./ok.json','world/copy.json','assets/imports/scene.json',path.join(root,'assets/source/ok.json'),'assets/source/ok.txt','assets\\source\\ok.json'])
    await assert.rejects(propose({sceneFile:file}),/sceneFile must be a world-relative \.json path under assets\/source/,file);
  await write('assets/source/huge.json',' '.repeat(MAX_SCENE_JSON_BYTES+1));
  await assert.rejects(propose({sceneFile:'assets/source/huge.json'}),/sceneFile exceeds 4 MiB/);
  await assert.rejects(propose({sceneJson:' '.repeat(MAX_SCENE_JSON_BYTES+1)}),/sceneJson exceeds 4 MiB/);
  await write('assets/source/broken.json','{"objects":[');
  await assert.rejects(propose({sceneFile:'assets/source/broken.json'}),/sceneFile is not valid JSON/);
  await assert.rejects(propose({sceneFile:'assets/source/missing.json'}),/ENOENT|no such file/);
  await assert.rejects(propose({sceneFile:'assets/source/ok.json',sceneJson:scene}),/not both/);
  await write('assets/source/invalid.json',JSON.stringify({...host.store.current.scene,objects:[{id:'bad'}]}));
  await assert.rejects(propose({sceneFile:'assets/source/invalid.json'}),/placement|asset/i,'the file gets the same world validation');
  assert.equal(host.session().proposal,null);
});

test('world_sample and world_check measure a staged proposal and leave the accepted world unchanged',async t=>{
  const {host,call,propose}=await fixture(t),accepted=withTerrain(host.store.current.scene,1);
  await host.store.commit({baseRevision:host.store.current.revision,scene:accepted});
  const revision=host.store.current.revision,points=[{id:'centre',position:[0,0,0]}];
  const before=(await call('world_sample',{points,time:null,proposalId:null})).data;
  assert.ok(Math.abs(before.samples[0].terrainHeight-1)<1e-6,JSON.stringify(before.samples[0]));
  const {data:staged}=await propose({sceneJson:JSON.stringify(withTerrain(host.store.current.scene,3.5))});
  const sampled=(await call('world_sample',{points,time:null,proposalId:staged.proposalId})).data;
  assert.ok(Math.abs(sampled.samples[0].terrainHeight-3.5)<1e-6,'the proposal heights, not the accepted ones');
  assert.equal(sampled.source.kind,'staged proposal');assert.equal(sampled.source.proposalId,staged.proposalId);assert.equal(sampled.time,0);
  const checked=(await call('world_check',{routesJson:null,proposalId:staged.proposalId})).data;
  assert.equal(checked.source.proposalId,staged.proposalId);assert.equal(checked.observation.status,'missing');
  assert.equal(host.store.current.revision,revision);
  assert.ok(Math.abs((await call('world_sample',{points,time:null,proposalId:null})).data.samples[0].terrainHeight-1)<1e-6,'accepted world unchanged');
  await assert.rejects(call('world_sample',{points,time:null,proposalId:'not-staged'}),/no longer staged/);
  await propose({bibleJson:JSON.stringify({...host.store.current.bible,title:'Superseded'})});
  await assert.rejects(call('world_check',{routesJson:null,proposalId:staged.proposalId}),/no longer staged/,'a newer proposal replaces the old one');
});
