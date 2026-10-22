import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {ClaudeAgent,claudeCommand,claudeEnv,sessionGrant} from './claude.mjs';
import {createHost} from './host.mjs';

// A stand-in for the installed CLI. It records what it was given, answers
// `auth status`, and replays stream-json shaped like `claude -p --verbose`.
// For approval scenarios it acts as the MCP client of Holodeck's bridge.
const FAKE=String.raw`import {appendFileSync,readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const argv=process.argv.slice(2),log=process.env.FAKE_CLAUDE_LOG,scenario=process.env.FAKE_CLAUDE_SCENARIO||'text';
const flag=name=>{const i=argv.indexOf(name);return i<0?null:argv[i+1];};
const record=entry=>appendFileSync(log,JSON.stringify(entry)+'\n');
const env=Object.fromEntries(Object.keys(process.env).filter(k=>/ANTHROPIC|CLAUDE_CODE_USE_|BEDROCK|CLAUDE_CODE_SIMPLE|FAKE_SECRET/.test(k)).map(k=>[k,process.env[k]]));
if(argv[0]==='auth'){
  record({kind:'auth',argv,env,cwd:process.cwd()});
  process.stdout.write(process.env.FAKE_CLAUDE_AUTH||JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',email:'person@example.test',orgName:'Example Org',subscriptionType:'max'}));
  process.exit(0);
}
const out=m=>process.stdout.write(JSON.stringify(m)+'\n');
let stdin='';process.stdin.on('data',d=>{stdin+=d;});await new Promise(r=>process.stdin.on('end',r));
const config=JSON.parse(readFileSync(flag('--mcp-config'),'utf8'));
record({kind:'turn',argv,env,stdin,cwd:process.cwd(),config});
const session=flag('--session-id')||flag('--resume');
out({type:'system',subtype:'init',session_id:session,cwd:process.cwd(),model:'claude-test',permissionMode:'default',apiKeySource:scenario==='apikey'?'ANTHROPIC_API_KEY':'none',tools:['Bash','mcp__holodeck__world_read'],mcp_servers:[{name:'holodeck',status:'connected'}]});
const say=(id,text)=>out({type:'assistant',session_id:session,parent_tool_use_id:null,message:{id,role:'assistant',content:[{type:'text',text}]}});
const finish=(result='done')=>{out({type:'result',subtype:'success',is_error:false,result,session_id:session,num_turns:1});process.exit(0);};
function mcp(){
  const server=config.mcpServers.holodeck,child=spawn(server.command,server.args,{env:{...process.env,...server.env},stdio:['pipe','pipe','inherit']});
  const pending=new Map();let next=0;
  createInterface({input:child.stdout}).on('line',line=>{const m=JSON.parse(line);pending.get(m.id)?.(m);pending.delete(m.id);});
  const request=(method,params)=>new Promise(resolve=>{const id=++next;pending.set(id,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  return {request,close:()=>child.stdin.end()};
}
if(scenario==='text'){say('msg-1','Hello from ');say('msg-1','Claude');finish();}
if(scenario==='apikey'||scenario==='hold'){
  say('msg-1','Working');
  process.on('SIGINT',()=>{out({type:'result',subtype:'error_during_execution',is_error:true,session_id:session,errors:['interrupted']});process.exit(130);});
  setInterval(()=>{},1000);
}
if(scenario==='permission'||scenario==='hold-permission'){
  const client=mcp();
  const init=await client.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'fake-claude',version:'0'}});
  const listed=await client.request('tools/list',{});
  const read=await client.request('tools/call',{name:'world_read',arguments:{}});
  say('msg-1','Checking');
  const decision=await client.request('tools/call',{name:flag('--permission-prompt-tool').split('__')[2],arguments:{tool_name:'Bash',input:{command:'node -e 0'},tool_use_id:'toolu_1'}});
  record({kind:'mcp',init:init.result,tools:listed.result.tools.map(t=>t.name),read:JSON.parse(read.result.content[0].text).world?.revision,decision:JSON.parse(decision.result.content[0].text)});
  client.close();say('msg-2','Decided');finish();
}
if(scenario==='kiln-permission'){
  const client=mcp(),tool=flag('--permission-prompt-tool').split('__')[2];
  await client.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'fake-claude',version:'0'}});
  const ask=async input=>JSON.parse((await client.request('tools/call',{name:tool,arguments:{tool_name:'mcp__kiln_workspace__kiln_render',input}})).result.content[0].text);
  const first=await ask({program:'a'}),second=await ask({program:'b'});
  record({kind:'kiln',first,second});
  client.close();finish();
}
`;

async function fixture(t,{scenario='text',auth,env={}}={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-claude-'));
  t.after(()=>rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
  const script=path.join(root,'fake-claude.mjs'),log=path.join(root,'calls.jsonl');
  await writeFile(script,FAKE);
  const store={root,current:{revision:7,scene:{objects:[],assets:[]}},hashes:{},payload:()=>({world:{revision:7}}),catalog:async()=>[]};
  const baseEnv={...process.env,FAKE_CLAUDE_LOG:log,FAKE_CLAUDE_SCENARIO:scenario,...(auth?{FAKE_CLAUDE_AUTH:JSON.stringify(auth)}:{}),
    ANTHROPIC_API_KEY:'FAKE_SECRET_API_KEY',ANTHROPIC_AUTH_TOKEN:'FAKE_SECRET_TOKEN',ANTHROPIC_BASE_URL:'https://proxy.example.test',CLAUDE_CODE_USE_BEDROCK:'1',AWS_BEARER_TOKEN_BEDROCK:'FAKE_SECRET_BEDROCK',CLAUDE_CODE_SIMPLE:'1',...env};
  const make=()=>new ClaudeAgent(store,{command:{command:process.execPath,args:[script]},env:baseEnv,propose:async()=>({ok:true}),observe:()=>null,killGraceMs:200});
  const agent=make();t.after(()=>agent.close());
  const calls=async()=>(await readFile(log,'utf8').catch(()=>'')).split('\n').filter(Boolean).map(line=>JSON.parse(line));
  return {agent,make,root,calls};
}
const settled=agent=>new Promise(resolve=>{const check=s=>{if(!s.turnId&&!['starting','working'].includes(s.status)){agent.off('agent',check);resolve(s);}};agent.on('agent',check);check(agent.snapshot());});
const requested=agent=>new Promise(resolve=>{const check=s=>{if(s.requests.length){agent.off('agent',check);resolve(s.requests[0]);}};agent.on('agent',check);check(agent.snapshot());});

test('connect gates on claude auth status and shows only the auth method',async t=>{
  const {agent,calls}=await fixture(t);
  const state=await agent.connect();
  assert.equal(state.provider,'claude');assert.equal(state.connected,true);
  assert.deepEqual(state.account,{type:'claude',authMethod:'claude.ai',apiProvider:'firstParty',subscriptionType:'max'});
  assert.equal(JSON.stringify(state).includes('person@example.test'),false);
  assert.equal(JSON.stringify(state).includes('Example Org'),false);
  const [auth]=await calls();
  assert.deepEqual(auth.argv,['auth','status','--json']);
  assert.deepEqual(auth.env,{},'Anthropic API and provider auth variables are removed from the child');
  assert.equal(state.capabilities.imageGeneration,false);
});

test('connect refuses when Claude Code is not signed in and offers no Holodeck login',async t=>{
  const {agent}=await fixture(t,{auth:{loggedIn:false,authMethod:'none',apiProvider:'firstParty'}});
  await assert.rejects(agent.connect(),/run `claude` in a terminal/i);
  assert.equal(agent.snapshot().connected,false);
  await assert.rejects(agent.login(),/does not offer a Claude login/);
});

test('connect refuses a non-subscription auth method so billing never switches silently',async t=>{
  const {agent}=await fixture(t,{auth:{loggedIn:true,authMethod:'api_key',apiProvider:'firstParty'}});
  await assert.rejects(agent.connect(),/api_key/);
  assert.equal(agent.snapshot().connected,false);
});

test('a turn runs claude -p with stream-json, safe permissions, strict MCP config and no --bare',async t=>{
  const {agent,calls,root}=await fixture(t);
  await agent.connect();
  await agent.startTurn({text:'Describe my world',model:'sonnet',effort:'low'});
  const done=await settled(agent);
  assert.equal(done.status,'completed');
  assert.equal(done.messages.at(-1).text,'Hello from Claude');
  assert.equal(done.messages.at(-2).role,'user');
  const turn=(await calls()).find(c=>c.kind==='turn'),argv=turn.argv;
  for(const flag of ['-p','--verbose','--strict-mcp-config'])assert.ok(argv.includes(flag),flag);
  const value=name=>argv[argv.indexOf(name)+1];
  assert.equal(value('--output-format'),'stream-json');
  assert.equal(value('--permission-mode'),'manual');
  assert.equal(value('--permission-prompt-tool'),'mcp__holodeck__permission_prompt');
  assert.equal(value('--setting-sources'),'user');
  assert.equal(value('--model'),'sonnet');assert.equal(value('--effort'),'low');
  assert.match(value('--session-id'),/^[0-9a-f-]{36}$/);
  assert.equal(argv.includes('--resume'),false);
  for(const forbidden of ['--bare','--dangerously-skip-permissions','--allow-dangerously-skip-permissions','bypassPermissions'])assert.equal(argv.includes(forbidden),false,forbidden);
  assert.ok(value('--allowedTools').split(',').includes('mcp__holodeck__world_read'));
  assert.equal(value('--allowedTools').includes('permission_prompt'),false);
  assert.deepEqual(turn.env,{});
  assert.equal(path.resolve(turn.cwd),path.resolve(root));
  assert.match(turn.stdin,/Describe my world/);
  assert.deepEqual(Object.keys(turn.config.mcpServers),['holodeck']);
  assert.equal(done.sessionId,value('--session-id'));
});

test('later turns and a reconnected agent resume the saved Claude session',async t=>{
  const {agent,make,calls}=await fixture(t);
  await agent.connect();await agent.startTurn({text:'First',model:'default'});await settled(agent);
  const first=(await calls()).filter(c=>c.kind==='turn')[0].argv,id=first[first.indexOf('--session-id')+1];
  assert.equal(first.includes('--model'),false,'the account default passes no --model');
  await agent.startTurn({text:'Second',model:'default'});await settled(agent);
  const second=(await calls()).filter(c=>c.kind==='turn')[1].argv;
  assert.equal(second[second.indexOf('--resume')+1],id);assert.equal(second.includes('--session-id'),false);
  agent.close();
  const reopened=make();t.after(()=>reopened.close());
  const state=await reopened.connect();
  assert.equal(state.sessionId,id);assert.equal(state.messages.at(-1).text,'Hello from Claude');
  await reopened.startTurn({text:'Third',model:'opus'});await settled(reopened);
  const third=(await calls()).filter(c=>c.kind==='turn')[2].argv;
  assert.equal(third[third.indexOf('--resume')+1],id);
});

test('permission prompts reach the Holodeck approval card and return allow or deny',async t=>{
  for(const [decision,expected] of [['allow-once',{behavior:'allow',updatedInput:{command:'node -e 0'}}],['reject-once',{behavior:'deny',message:'The user declined this operation in Holodeck.'}]]){
    const {agent,calls}=await fixture(t,{scenario:'permission'});
    await agent.connect();await agent.startTurn({text:'Run a check',model:'default'});
    const card=await requested(agent);
    assert.equal(card.provider,'claude');assert.equal(card.kind,'permission');
    assert.equal(card.params.command,'node -e 0');assert.match(card.params.reason,/Bash/);
    assert.deepEqual(card.params.options.map(o=>o.optionId),['allow-once','reject-once']);
    assert.throws(()=>agent.answer({id:card.id,decision:'allow-always'}),/Invalid approval decision/);
    agent.answer({id:card.id,decision});
    const done=await settled(agent);
    assert.equal(done.status,'completed');assert.deepEqual(done.requests,[]);
    const mcp=(await calls()).find(c=>c.kind==='mcp');
    assert.ok(mcp.tools.includes('world_read')&&mcp.tools.includes('permission_prompt'));
    assert.equal(mcp.read,7,'world tools answer through the bridge');
    assert.deepEqual(mcp.decision,expected);
  }
});

test('a Kiln tool allowed for the session skips later prompts and survives reconnect',async t=>{
  const {agent,make,calls}=await fixture(t,{scenario:'kiln-permission'});
  await agent.connect();await agent.startTurn({text:'Author a palm',model:'default'});
  const card=await requested(agent);
  assert.deepEqual(card.params.options.map(o=>o.optionId),['allow-once','allow-session','reject-once']);
  agent.answer({id:card.id,decision:'allow-session'});
  const done=await settled(agent);
  assert.equal(done.status,'completed');
  const kiln=(await calls()).find(c=>c.kind==='kiln');
  assert.deepEqual(kiln.first,{behavior:'allow',updatedInput:{program:'a'}});
  assert.deepEqual(kiln.second,{behavior:'allow',updatedInput:{program:'b'}},'the second call is allowed without a card');
  assert.deepEqual(done.sessionTools,['mcp__kiln_workspace__kiln_render']);
  assert.equal(done.resolvedModel,'claude-test','the init event records the resolved model');
  await agent.persistQueue;agent.close();
  const reopened=make();t.after(()=>reopened.close());
  const state=await reopened.connect();
  assert.deepEqual(state.sessionTools,['mcp__kiln_workspace__kiln_render']);assert.equal(state.resolvedModel,'claude-test');
});

test('edit grants cover only files inside the world assets/source folder',()=>{
  const root=path.resolve(os.tmpdir(),'world');
  assert.equal(sessionGrant('Write',{file_path:path.join(root,'assets/source/terrain/a.py')},root),'edit:assets/source');
  assert.equal(sessionGrant('Edit',{file_path:'assets/source/palm.kiln.js'},root),'edit:assets/source','relative paths resolve against the world');
  assert.equal(sessionGrant('Edit',{file_path:path.join(root,'assets/source/../../outside.txt')},root),null);
  assert.equal(sessionGrant('Write',{file_path:path.join(root,'world/world.json')},root),null);
  assert.equal(sessionGrant('Write',{file_path:path.join(root,'assets/source')},root),null,'the folder itself is not a file');
  assert.equal(sessionGrant('Bash',{command:'echo hi > assets/source/a.txt'},root),null,'shell always asks');
  assert.equal(sessionGrant('mcp__kiln_workspace__kiln_render',{},root),'mcp__kiln_workspace__kiln_render');
});

test('stop sends SIGINT first and denies a pending approval',async t=>{
  const {agent}=await fixture(t,{scenario:'hold-permission'});
  await agent.connect();await agent.startTurn({text:'Run a check',model:'default'});
  await requested(agent);
  const signals=[];const kill=agent.child.kill.bind(agent.child);agent.child.kill=signal=>{signals.push(signal);return kill(signal);};
  await agent.stop();
  const done=await settled(agent);
  assert.equal(signals[0],'SIGINT');
  assert.equal(done.status,'interrupted');assert.deepEqual(done.requests,[]);
});

test('stop falls back to SIGTERM when the process ignores SIGINT',async t=>{
  const {agent}=await fixture(t,{scenario:'hold'});
  await agent.connect();await agent.startTurn({text:'Wait',model:'default'});
  await new Promise(resolve=>{const check=s=>{if(s.messages.some(m=>m.text==='Working')){agent.off('agent',check);resolve();}};agent.on('agent',check);});
  const signals=[];agent.child.kill=signal=>{signals.push(signal);if(signal==='SIGTERM')process.kill(agent.child.pid);return true;};
  await agent.stop();
  const done=await settled(agent);
  assert.deepEqual(signals,['SIGINT','SIGTERM']);
  assert.equal(done.status,'interrupted');
});

test('a turn that reports an API key source is stopped before billing changes',async t=>{
  const {agent}=await fixture(t,{scenario:'apikey'});
  await agent.connect();await agent.startTurn({text:'Hi',model:'default'});
  const done=await settled(agent);
  assert.equal(done.status,'error');assert.match(done.error,/API key/);
});

test('claudeEnv strips Anthropic API and provider credentials but keeps unrelated variables',()=>{
  const env=claudeEnv({PATH:'x',HOME:'h',ANTHROPIC_API_KEY:'k',ANTHROPIC_AUTH_TOKEN:'t',ANTHROPIC_BASE_URL:'u',ANTHROPIC_VERTEX_PROJECT_ID:'v',CLAUDE_CODE_USE_VERTEX:'1',CLAUDE_CODE_USE_FOUNDRY:'1',AWS_BEARER_TOKEN_BEDROCK:'b',CLAUDE_CODE_SIMPLE:'1'});
  assert.deepEqual(env,{PATH:'x',HOME:'h'});
});

test('claude command is the installed CLI and nothing else',()=>{
  const previous=process.env.HOLODECK_CLAUDE_BIN;
  process.env.HOLODECK_CLAUDE_BIN=path.join(os.tmpdir(),'claude');
  try{assert.deepEqual(claudeCommand(),{command:process.env.HOLODECK_CLAUDE_BIN,args:[]});}
  finally{if(previous===undefined)delete process.env.HOLODECK_CLAUDE_BIN;else process.env.HOLODECK_CLAUDE_BIN=previous;}
});

test('the host offers Claude Code and keeps image generation on Codex',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-claude-host-'));
  const codex=Object.assign(new EventEmitter(),{snapshot(){return {provider:'codex',status:'ready',requests:[]};},async connect(){return this.snapshot();},async generateImage(){return {provider:'codex'};},close(){}});
  const claude=Object.assign(new EventEmitter(),{snapshot(){return {provider:'claude',status:'ready',requests:[]};},async connect(){this.connected=true;return this.snapshot();},close(){}});
  const host=await createHost(root,{agentFactory:()=>codex,claudeFactory:()=>claude,ensureWorkspace:async()=>{}});
  const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const session=await fetch(`${base}/api/session`),cookie=session.headers.get('set-cookie').split(';')[0];
  const post=(route,data)=>fetch(`${base}/api/${route}`,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post('agent/connect',{provider:'claude'})).status,200);
  assert.equal(claude.connected,true);assert.equal(host.agent,claude);
  const refused=await post('agent/image',{prompt:'A cove'});
  assert.equal(refused.status,400);assert.match((await refused.json()).error,/Codex connection/);
});
