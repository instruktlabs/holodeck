import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {CursorAgent,CursorRpc,cursorCommand} from './cursor.mjs';
import {createHost} from './host.mjs';
import {atomicJson} from './world-store.mjs';

class FakeRpc extends EventEmitter{
  calls=[];replies=[];
  async start(){}
  async request(method,params){
    this.calls.push({method,params});
    if(method==='initialize')return {protocolVersion:1,authMethods:[{id:'cursor_login'}]};
    if(method==='authenticate'){assert.equal(params.methodId,'cursor_login');return {};}
    if(method==='session/new')return {sessionId:'sess-1',modes:{availableModes:[{id:'agent',name:'Agent'},{id:'plan',name:'Plan'},{id:'ask',name:'Ask'}],currentModeId:'agent'}};
    if(method==='session/load')return {sessionId:params.sessionId,modes:{availableModes:[{id:'agent',name:'Agent'}],currentModeId:'agent'}};
    if(method==='session/prompt'){
      this.prompt=params;
      this.emit('notification',{method:'session/update',params:{sessionId:params.sessionId,update:{sessionUpdate:'agent_message_chunk',messageId:'assistant-1',content:{type:'text',text:'Hello from Cursor'}}}});
      for(const message of this.pendingRequests||[])this.emit('request',message);
      return this.hold?new Promise(resolve=>{this.finish=resolve;}):{stopReason:'end_turn'};
    }
    if(method==='session/set_mode')return {};
    return {};
  }
  reply(id,result){this.replies.push({id,result});}
  send(m){this.replies.push(m);}
  notify(method,params){this.replies.push({method,params});}
  close(){this.closed=true;}
}
async function fixture(t,{requests=[],hold=false}={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-cursor-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const rpc=new FakeRpc();rpc.pendingRequests=requests;rpc.hold=hold;
  const store={root,current:{revision:2,scene:{objects:[],assets:[]}},hashes:{}};
  const agent=new CursorAgent(store,{rpcFactory:()=>rpc,sessionWriter:atomicJson});
  return {agent,rpc,root};
}
const permission={id:'perm-1',method:'session/request_permission',params:{sessionId:'sess-1',toolCall:{toolCallId:'tool-1',title:'List the world',rawInput:{command:'node',args:['-e','0']}},options:[{optionId:'allow-once',name:'Allow once'},{optionId:'allow-always',name:'Allow always'},{optionId:'reject-once',name:'Reject'}]}};
const question={id:'ask-1',method:'cursor/ask_question',params:{toolCallId:'call_q',title:'Need input',questions:[{id:'q1',prompt:'Which mode should I use?',options:[{id:'agent',label:'Agent'},{id:'plan',label:'Plan'}],allowMultiple:false}]}};
const plan={id:'plan-1',method:'cursor/create_plan',params:{toolCallId:'call_p',name:'Refactor the cove',overview:'Tighten the layout.',plan:'1. Inspect the cove.\n2. Leave the rig intact.',todos:[{id:'todo-1',content:'Inspect the cove',status:'pending'}]}};

test('Cursor adapter authenticates with cursor_login and resumes the saved session',async t=>{
  const {agent,rpc}=await fixture(t);
  const first=await agent.connect();
  assert.equal(first.provider,'cursor');assert.equal(first.capabilities.imageGeneration,false);
  assert.deepEqual(rpc.calls.map(c=>c.method),['initialize','authenticate','session/new']);
  assert.equal(rpc.calls[1].params.methodId,'cursor_login');
  agent.update({connected:false,status:'disconnected'});
  await agent.connect();
  assert.equal(rpc.calls.at(-1).method,'session/load');
  assert.equal(rpc.calls.at(-1).params.sessionId,'sess-1');
  assert.equal(rpc.calls.at(-1).params.mcpServers.length,0);
});

test('Cursor prompts stream into the conversation and permission replies use ACP outcomes',async t=>{
  const {agent,rpc}=await fixture(t,{requests:[permission],hold:true});
  await agent.connect();
  const working=await agent.startTurn({text:'Read my world',model:'plan'});
  assert.equal(working.status,'working');
  assert.equal(rpc.calls.some(c=>c.method==='session/set_mode'&&c.params.modeId==='plan'),true);
  const card=agent.state.requests[0];
  assert.equal(card.provider,'cursor');assert.equal(card.kind,'permission');
  assert.equal(card.params.command,'node -e 0');assert.equal(card.params.reason,'List the world');
  agent.answer({id:card.id,decision:'allow-once'});
  assert.deepEqual(rpc.replies[0].result,{outcome:{outcome:'selected',optionId:'allow-once'}});
  assert.equal(agent.state.requests.length,0);
  rpc.finish({stopReason:'end_turn'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(agent.state.status,'completed');
  assert.equal(agent.state.messages.at(-1).text,'Hello from Cursor');
  await assert.rejects(agent.generateImage({prompt:'A cove'}),/Codex connection/);
});

test('Cursor question and plan cards answer in the ACP result shape',async t=>{
  const {agent,rpc}=await fixture(t,{requests:[question,plan],hold:true});
  await agent.connect();await agent.startTurn({text:'Ask me',model:'agent'});
  const [ask,proposed]=agent.state.requests;
  assert.equal(ask.kind,'question');assert.equal(ask.params.questions[0].question,'Which mode should I use?');
  agent.answer({id:ask.id,answers:{q1:'agent'}});
  assert.deepEqual(rpc.replies[0].result.outcome,{outcome:'answered',answers:[{questionId:'q1',selectedOptionIds:['agent']}]});
  agent.answer({id:proposed.id,decision:'accept'});
  assert.deepEqual(rpc.replies[1].result.outcome,{outcome:'accepted'});
  assert.throws(()=>agent.answer({id:proposed.id,decision:'accept'}),/no longer pending/);
});

test('stopping a Cursor turn cancels a pending permission without reading credentials',async t=>{
  const {agent,rpc}=await fixture(t,{requests:[permission],hold:true});
  await agent.connect();await agent.startTurn({text:'Run a check',model:'agent'});
  const stopped=await agent.stop();
  assert.equal(stopped.status,'interrupted');assert.deepEqual(stopped.requests,[]);
  assert.deepEqual(rpc.replies[0].result,{outcome:{outcome:'cancelled'}});
  assert.deepEqual(rpc.replies.at(-1),{method:'session/cancel',params:{sessionId:'sess-1'}});
  assert.equal(JSON.stringify(rpc.calls).includes('api-key'),false);
  assert.equal(JSON.stringify(rpc.calls).includes('CURSOR_API_KEY'),false);
});

test('ACP stdio client speaks newline JSON-RPC with a fake Cursor process',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-cursor-proc-'));
  const script=path.join(root,'fake-acp.mjs');
  await writeFile(script,`import {createInterface} from 'node:readline';
const seen=[];
const send=m=>process.stdout.write(JSON.stringify(m)+'\\n');
let promptId;
createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line);seen.push(m.method||'reply');
  if(m.method==='initialize')send({id:m.id,result:{protocolVersion:1}});
  else if(m.method==='authenticate')send({id:m.id,result:{methodId:m.params.methodId}});
  else if(m.method==='session/prompt'){promptId=m.id;send({method:'session/update',params:{sessionId:'sess-1',update:{sessionUpdate:'agent_message_chunk',messageId:'m',content:{type:'text',text:'wire'}}}});send({id:'perm-1',method:'session/request_permission',params:{sessionId:'sess-1',toolCall:{toolCallId:'t',title:'Check'},options:[{optionId:'allow-once',name:'Allow once'}]}});}
  else if(m.id==='perm-1')send({id:promptId,result:{stopReason:'end_turn',seen}});
});
process.stderr.write('SECRET-CURSOR-TOKEN\\n');
`);
  const rpc=new CursorRpc({command:process.execPath,args:[script]});
  t.after(async()=>{const exited=rpc.child?new Promise(resolve=>rpc.child.once('exit',resolve)):Promise.resolve();rpc.close();await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,1000))]);await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50});});
  await rpc.start(root);
  await rpc.request('initialize',{protocolVersion:1,clientInfo:{name:'holodeck_local',version:'0.0.0'}});
  const auth=await rpc.request('authenticate',{methodId:'cursor_login'});
  assert.equal(auth.methodId,'cursor_login');
  let streamed='';rpc.on('notification',m=>{if(m.params?.update?.content?.text)streamed+=m.params.update.content.text;});
  const request=new Promise(resolve=>rpc.once('request',resolve));
  const prompt=rpc.request('session/prompt',{sessionId:'sess-1',prompt:[{type:'text',text:'Hi'}]},5000);
  const permission=await request;
  rpc.reply(permission.id,{outcome:{outcome:'selected',optionId:'allow-once'}});
  const done=await prompt;
  assert.equal(done.stopReason,'end_turn');
  assert.equal(streamed,'wire');
  assert.deepEqual(done.seen,['initialize','authenticate','session/prompt','reply']);
  assert.equal(JSON.stringify(done.seen).includes('SECRET-CURSOR-TOKEN'),false);
});

test('a Cursor process exit does not surface stderr',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-cursor-exit-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const script=path.join(root,'exit-acp.mjs');
  await writeFile(script,"process.stderr.write('SECRET-CURSOR-TOKEN\\n');process.exit(1);\n");
  const rpc=new CursorRpc({command:process.execPath,args:[script]});
  await rpc.start(root);
  await assert.rejects(rpc.request('initialize',{protocolVersion:1},2000),error=>{
    assert.match(error.message,/Cursor process exited/);
    assert.equal(error.message.includes('SECRET-CURSOR-TOKEN'),false);
    return true;
  });
});

test('cursor command is the installed ACP executable and nothing else',()=>{
  const previous=process.env.HOLODECK_CURSOR_BIN;
  process.env.HOLODECK_CURSOR_BIN=path.join(os.tmpdir(),'agent');
  try{assert.deepEqual(cursorCommand(),{command:process.env.HOLODECK_CURSOR_BIN,args:['acp']});}
  finally{if(previous===undefined)delete process.env.HOLODECK_CURSOR_BIN;else process.env.HOLODECK_CURSOR_BIN=previous;}
});

test('the host offers Codex or Cursor and keeps image generation on Codex',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-cursor-host-'));
  const codex=Object.assign(new EventEmitter(),{snapshot(){return {provider:'codex',status:this.status||'ready',requests:[]};},async connect(){this.connected='codex';return this.snapshot();},async generateImage(){return {provider:'codex'};},close(){this.closed=true;}});
  const cursor=Object.assign(new EventEmitter(),{snapshot(){return {provider:'cursor',status:this.status||'ready',turnId:this.turnId||null,requests:[]};},async connect(){this.connected='cursor';return this.snapshot();},close(){this.closed=true;}});
  const host=await createHost(root,{agentFactory:()=>codex,cursorFactory:()=>cursor,ensureWorkspace:async()=>{}});
  const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const session=await fetch(`${base}/api/session`),cookie=session.headers.get('set-cookie').split(';')[0];
  const post=(route,data)=>fetch(`${base}/api/${route}`,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post('agent/connect',{provider:'cursor'})).status,200);
  assert.equal(cursor.connected,'cursor');assert.equal(host.agent,cursor);
  cursor.status='working';cursor.turnId='sess-1';
  const blocked=await post('agent/connect',{provider:'codex'});
  assert.equal(blocked.status,400);assert.match((await blocked.json()).error,/before switching/);
  cursor.status='ready';cursor.turnId=null;
  assert.equal((await post('agent/connect',{provider:'codex'})).status,200);
  const image=await post('agent/image',{prompt:'A cove'});
  assert.equal(image.status,200);assert.equal((await image.json()).provider,'codex');
  await post('agent/connect',{provider:'cursor'});
  const refused=await post('agent/image',{prompt:'A cove'});
  assert.equal(refused.status,400);assert.match((await refused.json()).error,/Codex connection/);
});
