import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm,readFile,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CodexAgent,commandGrant } from './codex.mjs';
import {validateTerrain,validateWater} from '../src/world/terrain.mjs';
import {validateRuntimeScene} from '../src/world/runtime.mjs';
import {atomicJson} from './world-store.mjs';
import * as contract from '../src/world/contract.mjs';
class FakeRpc extends EventEmitter{
  calls=[];replies=[];
  async start(){}
  async request(method,params){
    this.calls.push({method,params});
    if(method==='account/read')return {account:{type:'chatgpt',planType:'pro'}};
    if(method==='model/list')return {data:[{id:'test',model:'test-model',isDefault:true,supportedReasoningEfforts:[{reasoningEffort:'low'}]}],nextCursor:null};
    if(method==='modelProvider/capabilities/read')return {imageGeneration:true,webSearch:true};
    if(method==='thread/start'||method==='thread/resume')return {thread:{id:'thread-1'}};
    if(method==='turn/start'){this.emit('notification',{method:'turn/started',params:{threadId:'thread-1',turn:{id:'turn-1'}}});return {turn:{id:'turn-1',status:'inProgress'}};}
    return {};
  }
  reply(id,result){this.replies.push({id,result});}
  send(m){this.replies.push(m);}
  close(){}
}
async function fixture(t,options={}){const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-agent-'));t.after(()=>rm(root,{recursive:true,force:true}));const rpc=new FakeRpc();let proposed=0;const agent=new CodexAgent({root,current:{revision:2},payload:()=>({world:{revision:2}}),catalog:async()=>[]},{rpcFactory:()=>rpc,observe:()=>null,propose:async()=>{proposed++;return {ok:true};},...options});return {agent,rpc,get proposed(){return proposed;}};}

test('concurrent session saves write captured snapshots in order and latest state wins',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;}),snapshots=[];let active=0,maxActive=0;
 const {agent}=await fixture(t,{sessionWriter:async(file,value)=>{
  active++;maxActive=Math.max(maxActive,active);await gate;
  try{snapshots.push(structuredClone(value));await atomicJson(file,value);}finally{active--;}
 }});
 agent.state.messages=[{id:'message',role:'assistant',text:'initial'}];agent.state.images=[{id:'image',reference:{title:'initial'}}];
 const saves=[];for(let i=0;i<30;i++){agent.state.threadId=`thread-${i}`;agent.state.messages[0].text=`message-${i}`;agent.state.images[0].reference.title=`image-${i}`;saves.push(agent.persist());}
 const complete=Promise.allSettled(saves);await new Promise(resolve=>setImmediate(resolve));
 agent.state.messages[0].text='later unsaved edit';agent.state.images[0].reference.title='later unsaved image';
 release();const results=await complete;
 assert.equal(maxActive,1,'only one session file writer may be active');assert.ok(results.every(result=>result.status==='fulfilled'));
 assert.deepEqual(snapshots.map(value=>value.messages[0].text),Array.from({length:30},(_,i)=>`message-${i}`));
 assert.deepEqual(snapshots.map(value=>value.images[0].reference.title),Array.from({length:30},(_,i)=>`image-${i}`));
 const saved=JSON.parse(await readFile(agent.sessionFile,'utf8'));assert.equal(saved.threadId,'thread-29');assert.equal(saved.messages[0].text,'message-29');
});

test('a failed session save rejects that caller and later queued saves still persist',async t=>{
 let calls=0;const {agent}=await fixture(t,{sessionWriter:async(file,value)=>{if(++calls===1)throw new Error('simulated write failure');await atomicJson(file,value);}});
 agent.state.threadId='first';const first=agent.persist(),rejected=assert.rejects(first,/simulated write failure/);
 agent.state.threadId='second';const second=agent.persist();await rejected;await second;
 const saved=JSON.parse(await readFile(agent.sessionFile,'utf8'));assert.equal(calls,2);assert.equal(saved.threadId,'second');
});
test('Codex adapter sends selected model, workspace sandbox and persists thread resume',async t=>{
  const {agent,rpc}=await fixture(t);await agent.connect();await agent.startTurn({text:'Read my world',model:'test-model',effort:'low'});
  assert.equal(agent.state.status,'working');const start=rpc.calls.find(c=>c.method==='thread/start');assert.equal(start.params.sandbox,'workspace-write');assert.equal(start.params.dynamicTools.length,8);
  for(const fact of [/Kiln progress log at assets\/source\/KILN_PROGRESS\.md/,/export command in holodeck-integrate-asset/,/do not read Holodeck engine sources/])assert.match(start.params.developerInstructions,fact);
  const turn=rpc.calls.find(c=>c.method==='turn/start');assert.deepEqual(turn.params.sandboxPolicy.writableRoots,[agent.store.root]);assert.equal(turn.params.model,'test-model');
  agent.onNotification({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed'}}});
  agent.resumed=false;await agent.startTurn({text:'Continue',model:'test-model'});assert.ok(rpc.calls.some(c=>c.method==='thread/resume'));
});
// Calls world_read through the Codex tool path and joins capabilities pages.
async function readCapabilities(f,id){
 const out={};let cursor,n=0;
 do{await f.agent.onRequest({id:id*100+n,method:'item/tool/call',params:{threadId:'thread-1',turnId:'turn-1',tool:'world_read',arguments:{section:'capabilities',...(cursor?{cursor}:{})}}});
  const reply=f.rpc.replies.find(r=>r.id===id*100+n).result;assert.equal(reply.success,true);const data=JSON.parse(reply.contentItems[0].text);n++;
  for(const [key,value] of Object.entries(data.capabilities)){if(key.startsWith('spatial.'))(out.spatial??={})[key.slice(8)]=value;else out[key]=value;}
  cursor=data.next;}while(cursor);
 return out;
}
test('world_read supplies valid surface and possession records to previously scaffolded workspaces',async t=>{
 const f=await fixture(t),scene=JSON.parse(await readFile(new URL('../examples/courtyard.json',import.meta.url)));
 f.agent.store.current={revision:2,schemaVersion:2,scene};
 await f.agent.startTurn({text:'Read supported terrain',model:'test-model'});
 const {spatial}=await readCapabilities(f,101);
 assert.ok(spatial.modules.includes('terrain.heightfield@1'));
 assert.equal(validateTerrain(spatial.examples.terrain),spatial.examples.terrain);
 assert.equal(validateWater(spatial.examples.water),spatial.examples.water);
 const scatterAssets=spatial.examples.scatter.variants.map(v=>({id:v.asset,file:`assets/imports/${v.asset}.glb`}));
 validateRuntimeScene({...scene,terrain:spatial.examples.terrain,water:spatial.examples.water,assets:[...(scene.assets||[]),...scatterAssets],scatters:[spatial.examples.scatter],runtime:{...scene.runtime,modules:[...new Set([...scene.runtime.modules,...spatial.modules])],possession:spatial.examples.possession}});
 validateRuntimeScene({...scene,objects:[{id:'patrol-probe',position:[-3,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,behavior:spatial.examples.patrol}],runtime:{...scene.runtime,modules:[...scene.runtime.modules,'motion.patrol@1']}});
 assert.match(spatial.patrol,/no pathfinding/);
 assert.match(spatial.gait,/exact unique GLB child/);
 assert.match(spatial.flock,/max96 birds/);assert.match(spatial.foliage,/continuous UV.y0/);
 validateRuntimeScene({...scene,objects:[{id:'flock-probe',asset:'fixture',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,behavior:spatial.examples.flock}],runtime:{...scene.runtime,modules:[...new Set([...scene.runtime.modules,'motion.boids@1','motion.gait@1'])]}});
 validateRuntimeScene({...scene,objects:[{id:'gait-probe',asset:'fixture',position:[-3,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,behavior:{...spatial.examples.patrol,gait:spatial.examples.gait}}],runtime:{...scene.runtime,modules:[...scene.runtime.modules,'motion.patrol@1','motion.gait@1']}});
 assert.match(spatial.authoring,/world_sample/);assert.equal(f.proposed,0);
});
test('world_read exposes the same delivery profile for legacy and runtime worlds without adding tools',async t=>{
 for(const schemaVersion of [1,2]){
  const f=await fixture(t);f.agent.store.current={revision:2,schemaVersion,scene:{}};
  const before=JSON.stringify(f.agent.store.current);
  await f.agent.startTurn({text:'Read asset delivery support',model:'test-model'});
  const delivery=(await readCapabilities(f,120+schemaVersion)).assetDelivery;
  assert.ok(delivery);assert.deepEqual(delivery,contract.ASSET_DELIVERY_PROFILE);
  assert.equal(f.rpc.calls.find(c=>c.method==='thread/start').params.dynamicTools.length,8);
  assert.equal(JSON.stringify(f.agent.store.current),before);assert.equal(f.proposed,0);
 }
});

test('world_sample reports accepted terrain support without mutating or proposing a revision',async t=>{
 const f=await fixture(t),scene=JSON.parse(await readFile(new URL('../examples/courtyard.json',import.meta.url)));
 scene.objects=[];scene.runtime.blockers=[];scene.runtime.modules.push('terrain.heightfield@1','inhabitant.maker@1');scene.runtime.possession={preset:'maker',camera:'first'};
 scene.terrain={type:'heightfield',bounds:[-20,20,-20,20],segments:[8,8],baseHeight:3,stamps:[]};
 f.agent.store.current={revision:2,schemaVersion:2,scene};const before=JSON.stringify(f.agent.store.current);
 await f.agent.startTurn({text:'Check support',model:'test-model'});
 await f.agent.onRequest({id:102,method:'item/tool/call',params:{threadId:'thread-1',turnId:'turn-1',tool:'world_sample',arguments:{points:[{id:'support',position:[0,0,0]}],time:0}}});
 const reply=f.rpc.replies.find(r=>r.id===102).result;assert.equal(reply.success,true);
 const report=JSON.parse(reply.contentItems[0].text);assert.equal(report.worldRevision,2);assert.equal(report.samples[0].terrainHeight,3);assert.deepEqual(report.samples[0].feetPosition,[0,3,0]);
 assert.equal(JSON.stringify(f.agent.store.current),before);assert.equal(f.proposed,0);
 const definition=f.rpc.calls.find(c=>c.method==='thread/start').params.dynamicTools.find(tool=>tool.name==='world_sample');assert.equal(definition.inputSchema.properties.points.maxItems,64);
});
test('an older dynamic-tool session starts a fresh thread while retaining visible history',async t=>{
 const {agent,rpc}=await fixture(t);await mkdir(path.dirname(agent.sessionFile),{recursive:true});
 await writeFile(agent.sessionFile,JSON.stringify({toolsVersion:3,threadId:'old-thread',model:'test-model',messages:[{id:'old',role:'assistant',text:'Earlier work'}]}));
 await agent.startTurn({text:'Use the current host',model:'test-model'});
 assert.ok(rpc.calls.some(call=>call.method==='thread/start'));assert.ok(!rpc.calls.some(call=>call.method==='thread/resume'));assert.ok(agent.state.messages.some(m=>m.id==='old'));
});
test('each turn resolves multi-selection and exposes the same reference context in the user message',async t=>{
  const {agent,rpc}=await fixture(t);
  agent.store.current={revision:4,scene:{assets:[{id:'kiln-seat',file:'assets/imports/seat.glb',provenance:{revisionId:'seat-r3'}}],objects:[
    {id:'tree-1',label:'Courtyard tree',shape:{type:'tree'},position:[1,0,-5],rotation:[0,0,0],scale:[1,1,1],collider:null},
    {id:'seat-1',asset:'kiln-seat',position:[3,0,-2],rotation:[0,1,0],scale:[1,1,1],collider:null}
  ]}};
  agent.store.hashes={'kiln-seat':{hash:'b'.repeat(64)}};
  const selectedRefs=[{id:'tree-1',part:'canopy'},{id:'seat-1',part:null}];
  await agent.startTurn({text:'Make these feel more coherent',model:'test-model',selectedRefs});
  const context=agent.state.messages.find(m=>m.role==='user').selectionContext;
  assert.equal(context.acceptedRevision,4);assert.deepEqual(context.selectedRefs,selectedRefs);
  assert.equal(context.entities[1].asset.hash,'b'.repeat(64));
  const input=rpc.calls.find(c=>c.method==='turn/start').params.input[0].text;
  assert.ok(input.includes(JSON.stringify(context)));
  assert.match(input,/not automatic edit commands/);
  agent.onNotification({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed'}}});
  agent.store.current.scene.objects=[];
  const count=rpc.calls.length;
  await assert.rejects(agent.startTurn({text:'Keep working',model:'test-model',selectedRefs}),/no longer exists/);
  assert.equal(rpc.calls.length,count);
});
test('the agent receives advisory coherence evidence without proposing an edit',async t=>{
 const f=await fixture(t);f.agent.store.current={revision:2,schemaVersion:1,scene:{assets:[],objects:[]}};
 await f.agent.connect();await f.agent.startTurn({text:'Check my world',model:'test-model'});
 await f.agent.onRequest({id:91,method:'item/tool/call',params:{threadId:'thread-1',turnId:'turn-1',tool:'world_check',arguments:{routesJson:null}}});
 const reply=f.rpc.replies.find(r=>r.id===91).result;assert.equal(reply.success,true);const report=JSON.parse(reply.contentItems[0].text);
 assert.equal(report.advisory,true);assert.equal(report.observation.status,'missing');assert.equal(f.proposed,0);
});
test('image requests attach accepted references and results wait for board acceptance',async t=>{
  const {agent,rpc}=await fixture(t);agent.store.current={revision:2,bible:{title:'Cove',intent:'Warm',rules:'Clear path'},references:[{id:'ref-1',file:'references/files/test.png',title:'Light',notes:'Amber'}]};
  agent.store.readReference=async()=>({});agent.store.contained=async file=>path.join(agent.store.root,file);
  agent.store.importReference=async bytes=>{assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');return {id:'generated',file:`references/files/${'a'.repeat(64)}.png`,title:'Generated',notes:''};};
  await agent.generateImage({prompt:'A cove at dusk',referenceIds:['ref-1'],model:'test-model'});
  const input=rpc.calls.find(c=>c.method==='turn/start').params.input;assert.equal(input[1].type,'localImage');assert.match(input[0].text,/World bible/);
  await agent.captureImage({threadId:'thread-1',turnId:'turn-1',item:{id:'image-1',type:'imageGeneration',status:'completed',result:Buffer.from('89504e470d0a1a0a','hex').toString('base64'),revisedPrompt:'Warm dusk'}});
  assert.equal(agent.state.images.length,1);assert.equal(agent.state.images[0].reference.generation.prompt,'Warm dusk');assert.deepEqual(agent.state.images[0].reference.generation.referenceIds,['ref-1']);assert.equal(agent.store.current.references.length,1);
  await agent.captureImage({threadId:'thread-1',turnId:'turn-1',item:{id:'image-1',type:'imageGeneration',status:'completed'}});assert.equal(agent.state.images.length,1);
  await agent.stop();await agent.captureImage({threadId:'thread-1',turnId:'turn-1',item:{id:'late',type:'imageGeneration',status:'completed'}});assert.equal(agent.state.images.length,1);
});
test('an exact command may be allowed for the Codex thread; other arguments and folders still ask',async t=>{
  const f=await fixture(t,{sessionWriter:atomicJson}),root=f.agent.store.root;await f.agent.connect();await f.agent.startTurn({text:'Plan the grove',model:'test-model'});
  const plan='python assets/source/plan_grove.py --seed 1',ask=(id,params)=>f.agent.onRequest({id,method:'item/commandExecution/requestApproval',params:{threadId:'thread-1',turnId:'turn-1',itemId:'i'+id,...params}});
  await ask(1,{command:plan,cwd:root});
  assert.deepEqual(f.agent.state.requests[0].params.options.map(o=>[o.optionId,o.label]),[['accept','Allow once'],['accept-command-session','Allow this exact command for the session'],['decline','Decline']]);
  await ask(2,{command:plan,cwd:root});
  f.agent.answer({id:'1',decision:'accept-command-session'});
  assert.deepEqual(f.rpc.replies.map(r=>[r.id,r.result.decision]),[[1,'accept'],[2,'accept']],'a waiting card for the same command is answered too');
  assert.equal(f.agent.state.requests.length,0);
  await ask(3,{command:plan,cwd:root});assert.deepEqual(f.rpc.replies.at(-1),{id:3,result:{decision:'accept'}},'the repeat is allowed without a card');
  await ask(4,{command:plan.replace('1','2'),cwd:root});await ask(5,{command:plan+' ',cwd:root});await ask(6,{command:plan,cwd:path.join(root,'assets')});
  assert.deepEqual(f.agent.state.requests.map(r=>r.id),['4','5','6'],'other arguments and another folder ask');
  await ask(7,{command:plan,cwd:path.dirname(root)});
  assert.equal(f.agent.state.requests.at(-1).params.options,undefined,'a folder outside the world is allowed once at most');
  assert.throws(()=>f.agent.answer({id:'7',decision:'accept-command-session'}),/Invalid approval decision/);
  await f.agent.onRequest({id:8,method:'item/fileChange/requestApproval',params:{threadId:'thread-1',turnId:'turn-1',itemId:'i8'}});
  assert.equal(f.agent.state.requests.at(-1).params.options,undefined,'file changes keep their own card');
  for(const id of ['4','5','6','7','8'])f.agent.answer({id,decision:'decline'});
  await f.agent.persistQueue;
  // The grant returns with the same thread and ends with a new one.
  const grant=commandGrant(root,{command:plan,cwd:root}),rpc=new FakeRpc(),again=new CodexAgent(f.agent.store,{rpcFactory:()=>rpc,observe:()=>null,propose:async()=>({ok:true})});
  assert.deepEqual((await again.connect()).sessionCommands,[grant]);
  const file=path.join(root,'.holodeck/session/codex.json'),saved=JSON.parse(await readFile(file,'utf8'));
  await writeFile(file,JSON.stringify({...saved,sessionCommands:[grant,JSON.stringify([path.dirname(root),plan]),'not json']}));
  const filtered=new CodexAgent(f.agent.store,{rpcFactory:()=>new FakeRpc(),observe:()=>null,propose:async()=>({ok:true})});
  assert.deepEqual((await filtered.connect()).sessionCommands,[grant],'grants outside the world folder are dropped');
  await writeFile(file,JSON.stringify({...saved,threadId:'an-older-thread'}));
  const fresh=new CodexAgent(f.agent.store,{rpcFactory:()=>new FakeRpc(),observe:()=>null,propose:async()=>({ok:true})});
  await fresh.connect();await fresh.startTurn({text:'Plan the grove',model:'test-model'});
  assert.deepEqual(fresh.state.sessionCommands,[]);
});

test('canceled turns cannot stage late proposals; native approvals await explicit replies',async t=>{
  const f=await fixture(t);await f.agent.connect();await f.agent.startTurn({text:'Make a world',model:'test-model'});await f.agent.stop();
  await f.agent.onRequest({id:7,method:'item/tool/call',params:{threadId:'thread-1',turnId:'turn-1',tool:'world_propose',arguments:{baseRevision:2,sceneJson:'{}'}}});
  assert.equal(f.proposed,0);assert.equal(f.rpc.replies.at(-1).result.success,false);
  await f.agent.onRequest({id:8,method:'item/commandExecution/requestApproval',params:{threadId:'thread-1',command:'example'}});
  assert.equal(f.agent.state.requests.length,1);assert.equal(f.rpc.replies.length,1);
  f.agent.answer({id:'8',decision:'decline'});assert.equal(f.rpc.replies.at(-1).result.decision,'decline');
});
