import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {ClaudeAgent,claudeCommand,claudeEnv,permissionCard,pluginRead,scriptGrant,scriptRun,sessionGrant,INSTRUCTIONS} from './claude.mjs';
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
if(scenario==='expired'){out({type:'result',subtype:'success',is_error:true,result:'Failed to authenticate: OAuth session expired and could not be refreshed',session_id:session,num_turns:1});process.exit(1);}
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
  record({kind:'mcp',init:init.result,tools:listed.result.tools.map(t=>t.name),read:JSON.parse(read.result.content[0].text).revision,decision:JSON.parse(decision.result.content[0].text)});
  client.close();say('msg-2','Decided');finish();
}
// Asks the permission tool for each [tool_name,input] in FAKE_CLAUDE_ASKS, in order.
// $PLUGIN in the list stands for the session plugin folder passed with --plugin-dir.
if(scenario==='asks'){
  const client=mcp(),tool=flag('--permission-prompt-tool').split('__')[2];
  await client.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'fake-claude',version:'0'}});
  const results=[];
  for(const [tool_name,input] of JSON.parse(process.env.FAKE_CLAUDE_ASKS.replaceAll('$PLUGIN',JSON.stringify(flag('--plugin-dir')||'').slice(1,-1))))results.push(JSON.parse((await client.request('tools/call',{name:tool,arguments:{tool_name,input}})).result.content[0].text).behavior);
  record({kind:'asks',results});
  client.close();finish();
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

test('instructions replace the unloaded world CLAUDE.md and installed skills load as a session plugin',async t=>{
  const {agent,calls,root}=await fixture(t);
  const skill=async(registry,name)=>{await mkdir(path.join(root,registry,name),{recursive:true});await writeFile(path.join(root,registry,name,'SKILL.md'),`---\nname: ${name}\ndescription: ${name}\n---\n`);};
  await agent.connect();await agent.startTurn({text:'No skills yet',model:'default'});await settled(agent);
  assert.equal((await calls()).find(c=>c.kind==='turn').argv.includes('--plugin-dir'),false,'a world without skills passes no plugin');
  await skill('.agents/skills','holodeck-author-world');await skill('skills','kiln-author-asset');await skill('skills','kiln-compose-scene');
  await agent.startTurn({text:'Author a palm',model:'default'});await settled(agent);
  const argv=(await calls()).filter(c=>c.kind==='turn')[1].argv,value=name=>argv[argv.indexOf(name)+1];
  // --setting-sources user loads no project CLAUDE.md, AGENTS.md or .claude/skills.
  assert.equal(value('--setting-sources'),'user');
  const plugin=value('--plugin-dir');
  assert.equal(path.relative(root,plugin).startsWith('..'),true,'the plugin lives outside the world folder');
  assert.equal(JSON.parse(await readFile(path.join(plugin,'.claude-plugin/plugin.json'),'utf8')).name,'holodeck-world');
  for(const name of ['holodeck-author-world','kiln-author-asset'])await readFile(path.join(plugin,'skills',name,'SKILL.md'));
  await assert.rejects(readFile(path.join(plugin,'skills/kiln-compose-scene/SKILL.md')),{code:'ENOENT'});
  const instructions=value('--append-system-prompt');
  assert.equal(instructions,INSTRUCTIONS);
  for(const fact of [/CLAUDE\.md and AGENTS\.md of this world are not loaded/,/holodeck-world:<name> skills/,/read \.kiln\/AGENTS\.md/,/Kiln progress log at assets\/source\/KILN_PROGRESS\.md/,/export command in holodeck-integrate-asset/,/do not read Holodeck engine sources/])assert.match(instructions,fact);
});

test('exact model IDs are offered beside aliases and passed through unchanged',async t=>{
  const {agent,calls}=await fixture(t);
  const state=await agent.connect(),ids=state.models.map(m=>m.model);
  for(const id of ['default','opus','claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5','claude-fable-5-1'])assert.ok(ids.includes(id),id);
  await agent.startTurn({text:'Pinned run',model:'claude-opus-5-5',effort:'max'});await settled(agent);
  const argv=(await calls()).find(c=>c.kind==='turn').argv;
  assert.equal(argv[argv.indexOf('--model')+1],'claude-opus-5-5');
  await assert.rejects(agent.startTurn({text:'Unknown',model:'claude-opus-9-9'}),/Select a listed model/);
});

test('later turns and a reconnected agent resume the saved Claude session',async t=>{
  const {agent,make,calls}=await fixture(t);
  await agent.connect();await agent.startTurn({text:'First',model:'default'});await settled(agent);
  const first=(await calls()).filter(c=>c.kind==='turn')[0].argv,id=first[first.indexOf('--session-id')+1];
  assert.equal(first.includes('--model'),false,'the account default passes no --model');
  await agent.startTurn({text:'Second',model:'default'});await settled(agent);
  const second=(await calls()).filter(c=>c.kind==='turn')[1].argv;
  assert.equal(second[second.indexOf('--resume')+1],id);assert.equal(second.includes('--session-id'),false);
  await agent.persistQueue;agent.close();
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
    assert.equal(card.params.title,'Run a command?');assert.equal(card.params.tool,'Bash');assert.equal(card.params.outside,false);
    assert.deepEqual(card.params.options.map(o=>o.optionId),['allow-once','allow-session','reject-once']);
    assert.equal(card.params.options[1].label,'Allow this exact command for the session');
    assert.throws(()=>agent.answer({id:card.id,decision:'allow-always'}),/Invalid approval decision/);
    assert.throws(()=>agent.answer({id:card.id,decision:'allow-kiln-session'}),/Invalid approval decision/,'only Kiln cards offer all Kiln tools');
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
  assert.deepEqual(card.params.options.map(o=>o.optionId),['allow-once','allow-session','allow-kiln-session','reject-once']);
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

// Answers each card in turn and returns the decisions the fake Claude received.
async function answerCards(agent,calls,decisions){
  const seen=[];
  for(const decision of decisions){
    const card=await new Promise(resolve=>{const check=s=>{const next=s.requests.find(r=>!seen.includes(r.id));if(next){agent.off('agent',check);resolve(next);}};agent.on('agent',check);check(agent.snapshot());});
    seen.push(card.id);agent.answer({id:card.id,decision});
  }
  const done=await settled(agent);assert.equal(done.status,'completed');
  return {done,results:(await calls()).find(c=>c.kind==='asks').results};
}

test('an exact shell command may be allowed for the session; other arguments, tools and folders still ask',async t=>{
  const plan='python assets/source/plan_grove.py --seed 1';
  const asks=[['Bash',{command:plan,description:'Plan the grove'}],['Bash',{command:plan,description:'Plan again',timeout:60000}],['Bash',{command:'python assets/source/plan_grove.py --seed 2'}],['Bash',{command:plan+' '}],['PowerShell',{command:plan}]];
  const {agent,make,root,calls}=await fixture(t,{scenario:'asks',env:{FAKE_CLAUDE_ASKS:JSON.stringify(asks)}});
  await agent.connect();await agent.startTurn({text:'Plan the grove',model:'default'});
  // Four cards: the repeat of the granted command is allowed without one.
  const {done,results}=await answerCards(agent,calls,['allow-session','allow-once','reject-once','reject-once']);
  assert.deepEqual(results,['allow','allow','allow','deny','deny']);
  assert.deepEqual(done.sessionTools,[sessionGrant('Bash',{command:plan},root)]);
  await agent.persistQueue;agent.close();
  // The grant survives a reconnect in the same world folder, but not in another.
  const file=path.join(root,'.holodeck/session/claude.json'),saved=JSON.parse(await readFile(file,'utf8'));
  saved.sessionTools.push(sessionGrant('Bash',{command:plan},path.join(root,'elsewhere')),'shell:not json');
  await writeFile(file,JSON.stringify(saved));
  const reopened=make();t.after(()=>reopened.close());
  assert.deepEqual((await reopened.connect()).sessionTools,[sessionGrant('Bash',{command:plan},root)]);
});

test('a turn script may be allowed for the session with any arguments until code in assets/source changes',async t=>{
  const run=args=>`uv run assets/source/turn/turn.py ${args} 2>&1 | Select-Object -Last 10`;
  const asks=[['PowerShell',{command:run('verify')}],['PowerShell',{command:run('scene samples')}]];
  const {agent,root,calls}=await fixture(t,{scenario:'asks',env:{FAKE_CLAUDE_ASKS:JSON.stringify(asks)}});
  await mkdir(path.join(root,'assets/source/turn'),{recursive:true});
  await writeFile(path.join(root,'assets/source/turn/turn.py'),'print("turn")\n');await writeFile(path.join(root,'assets/source/helper.py'),'X = 1\n');
  await agent.connect();await agent.startTurn({text:'Run the turn script',model:'default'});
  const card=await new Promise(resolve=>{const check=s=>{if(s.requests[0]){agent.off('agent',check);resolve(s.requests[0]);}};agent.on('agent',check);check(agent.snapshot());});
  assert.deepEqual(card.params.options.map(o=>o.optionId),['allow-once','allow-script','allow-session','reject-once']);
  assert.equal(card.params.options[1].label,'Allow turn.py with any arguments until code changes');
  agent.answer({id:card.id,decision:'allow-script'});
  let done=await settled(agent);
  const last=async()=>(await calls()).filter(c=>c.kind==='asks').at(-1).results;
  assert.deepEqual(await last(),['allow','allow'],'other arguments run without a card');
  assert.equal(done.sessionTools.length,1);assert.match(done.sessionTools[0],/^script:/);
  // Script outputs do not reset the grant; an edit to any code file under assets/source does.
  await writeFile(path.join(root,'assets/source/turn/report.json'),'{}');await writeFile(path.join(root,'assets/source/turn/view.png'),'png');
  assert.equal(await scriptGrant('PowerShell',{command:run('verify')},root),done.sessionTools[0]);
  await writeFile(path.join(root,'assets/source/helper.py'),'X = 2\n');
  await agent.startTurn({text:'Run it again',model:'default'});
  const {results}=await answerCards(agent,async()=>[{kind:'asks',results:await last()}],['allow-once','reject-once']);
  assert.deepEqual(results,['allow','deny'],'both runs ask again after a code edit');
});

test('only a plain run of one script inside assets/source qualifies for a script grant',()=>{
  const root=path.resolve('world');
  const script=command=>scriptRun('PowerShell',command,root)?.script??null;
  assert.equal(script('uv run assets/source/turn11/turn11.py verify clump sites 2>&1 | Select-Object -Last 40'),'assets/source/turn11/turn11.py');
  assert.equal(script('uv run assets\\source\\turn10b\\turn10b.py compare 2>&1 | Select-Object -Last 10'),'assets/source/turn10b/turn10b.py');
  assert.equal(script('node assets/source/plan.mjs --seed 3 | tail -n 20'),'assets/source/plan.mjs');
  assert.equal(script('uv run assets/source/turn12/turn12.py bedmask 2>&1 | Select-Object -First 60'),'assets/source/turn12/turn12.py');
  assert.equal(script('node assets/source/plan.mjs | head -n 5'),'assets/source/plan.mjs');
  assert.equal(script('node assets/source/design/sanctuary.mjs --turn 2 | head -40'),'assets/source/design/sanctuary.mjs','the classic head -N form trims output too');
  assert.equal(script('node assets/source/plan.mjs | tail -20'),'assets/source/plan.mjs');
  assert.equal(script('node assets/source/plan.mjs | head -40 > out.txt'),null,'a redirect after the trim still never qualifies');
  assert.equal(script('python ./assets/source/a.py'),'assets/source/a.py');
  assert.equal(script("node assets/source/design/tonemap.mjs sky '#f3e5cc' '#1468d0' 0.3"),'assets/source/design/tonemap.mjs','quoted colours are plain words');
  assert.equal(script('node assets/source/a.mjs "#f3e5cc" --label "south pool" | head -20'),'assets/source/a.mjs');
  for(const command of ['uv run assets/source/a.py; Remove-Item world -Recurse','uv run assets/source/a.py > world/world.json','uv run assets/source/a.py $(whoami)',
   'uv run assets/source/a.py "$(whoami)"','uv run assets/source/a.py "`whoami`"','uv run assets/source/a.py "$env:USERPROFILE"',"uv run assets/source/a.py '#fff'; whoami",
   "uv run assets/source/a.py 'it''s'","uv run assets/source/a.py '#fff\u2019; whoami; \u2018'",'uv run assets/source/a.py "a\\" b"','uv run assets/source/a.py #comment',
   'uv run assets/source/../../outside.py','uv run assets/imports/a.py','uv run --with requests assets/source/a.py',
   'uv run assets/source/a.py | Out-File x.txt','uv run assets/source/a.py && echo done','pwsh assets/source/a.ps1'])assert.equal(script(command),null,command);
  assert.equal(scriptRun('Read',{file_path:'assets/source/a.py'},root),null,'only shell tools');
});

test('in Bash a script run may pass its output through read-only grep and sed -n filters (H70)',()=>{
  const root=path.resolve('world');
  const bash=command=>scriptRun('Bash',command,root)?.script??null;
  assert.equal(bash("node assets/source/design/sanctuary.mjs --turn 5 | grep -v -E '^ [a-z0-9-]+: [0-9]+$'"),'assets/source/design/sanctuary.mjs');
  assert.equal(bash("node assets/source/design/sanctuary.mjs --turn 5 | sed -n '1,5p;/^routes/,/^families/p' | grep -v -E '^ (cove-out|F1|T1)'"),'assets/source/design/sanctuary.mjs');
  assert.equal(bash("node assets/source/design/glb-audit.mjs 2>&1 | sed -n '120,400p' | grep -v '^ images\\|^ extensions' | head -40"),'assets/source/design/glb-audit.mjs');
  assert.equal(bash('node assets/source/a.mjs | grep -c "ivy curtain"'),'assets/source/a.mjs');
  assert.equal(scriptRun('PowerShell',"node assets/source/a.mjs | grep 'x'",root),null,'PowerShell keeps only the tail forms');
  for(const command of ["node assets/source/a.mjs | sed -n '1p;w out.txt'","node assets/source/a.mjs | sed -n '1e whoami'","node assets/source/a.mjs | sed -n '/a/Ip'",
   "node assets/source/a.mjs | sed '1,5p'","node assets/source/a.mjs | sed -n '1,5p' x.txt","node assets/source/a.mjs | grep -f patterns.txt","node assets/source/a.mjs | grep -r 'x' /",
   'node assets/source/a.mjs | grep "$(whoami)"','node assets/source/a.mjs | grep "`whoami`"','node assets/source/a.mjs | grep "a\\" | grep "; rm -rf ~; echo "',
   "node assets/source/a.mjs | grep 'a'' ; whoami ; '","node assets/source/a.mjs | grep 'a' > out.txt","node assets/source/a.mjs | xargs rm",
   "node assets/source/a.mjs | grep 'a' | grep 'b' | grep 'c' | grep 'd'","node assets/source/a.mjs | grep 'a'; whoami"])assert.equal(bash(command),null,command);
});

test('a script run may discard its output and grep a file under assets/source through read-only filters (H91)',()=>{
  const root=path.resolve('world');
  const bash=command=>scriptRun('Bash',command,root)?.script??null;
  // The forms the agent used in turn 10, re-running its design script and reading the report it writes.
  assert.equal(bash("node assets/source/design/sanctuary.mjs --turn 10 > /dev/null; grep -E -e '^placements|over the route|within 1.5 m of' assets/source/turn10/report.txt | sed -e 's/; /\\n    /g' | grep -v -e 'h8-back\\|h4-side' | cut -c1-300"),'assets/source/design/sanctuary.mjs');
  assert.equal(bash("node assets/source/design/sanctuary.mjs --turn 10 > /dev/null; grep -o -e '03-head-f1 sky[^;]*' assets/source/turn10/report.txt | head -30"),'assets/source/design/sanctuary.mjs');
  assert.equal(bash('node assets/source/a.mjs | cut -c1-200'),'assets/source/a.mjs');
  assert.equal(bash("node assets/source/design/draws.mjs assets/source/turn11/scene.json --hub all | sed 's/assets\\/source\\/turn11\\/scene.json //' | cut -c1-150"),'assets/source/design/draws.mjs','sed without -e');
  assert.equal(bash("node assets/source/design/draws.mjs assets/source/turn9/scene.json --hub all 2>&1 | sed -E 's/ \\(new engine.*groups/ groups/; s/assets\\/source\\/turn9\\/scene.json //'"),'assets/source/design/draws.mjs','substitutions joined by ;');
  assert.equal(bash("time node assets/source/design/sanctuary.mjs --turn 12 > /dev/null; grep -A 20 -e '^turn 12 (the destination' assets/source/turn12/report.txt | sed 's/; /\\n      /g' | cut -c1-260"),'assets/source/design/sanctuary.mjs','timed, with a context count');
  assert.equal(bash("node assets/source/design/list-objects.mjs assets/source/turn12/scene.json '^(parapet-(t[123]-front|F[123])|planter-landing)' | cut -c1-120"),'assets/source/design/list-objects.mjs','a single-quoted regular expression is an inert argument in Bash');
  assert.equal(scriptRun('PowerShell',"node assets/source/a.mjs '^(a|b)'",root),null,'PowerShell keeps the plain-word quoting');
  for(const command of ["node assets/source/a.mjs 'x''; whoami; ''y'","node assets/source/a.mjs 'a\nwhoami'"])assert.equal(bash(command),null,command);
  for(const command of ["time rm -rf assets","time node assets/source/a.mjs; rm -rf assets","node assets/source/a.mjs | grep -A 2 -f patterns.txt",
   "node assets/source/a.mjs > /dev/null; grep -A x -e 'a' assets/source/r.txt"])assert.equal(bash(command),null,command);
  for(const command of ["node assets/source/a.mjs | sed -E 's/a/b/; w out.txt'","node assets/source/a.mjs | sed 's/a/b/;e whoami'","node assets/source/a.mjs | sed 's|a|b|w out.txt'",
   "node assets/source/a.mjs | sed -E 's/a/b/gw out.txt'","node assets/source/a.mjs | sed 's/a/b/' assets/source/a.mjs"])assert.equal(bash(command),null,command);
  for(const command of ["node assets/source/a.mjs > /dev/null; grep -e 'x' /etc/passwd","node assets/source/a.mjs > /dev/null; grep -e 'x' assets/source/../../outside.txt",
   "node assets/source/a.mjs > /dev/null; grep -r -e 'x' assets/source","node assets/source/a.mjs > /dev/null; grep -e 'x' assets/source/r.txt; whoami",
   "node assets/source/a.mjs > /dev/null; grep -e 'x' assets/source/r.txt assets/source/s.txt","node assets/source/a.mjs > out.txt; grep -e 'x' assets/source/r.txt",
   "node assets/source/a.mjs > /dev/null; grep -e 'x' -f patterns.txt assets/source/r.txt","node assets/source/a.mjs | sed -e 's/a/b/w out.txt'",
   "node assets/source/a.mjs | sed -e 's/a/b/e'","node assets/source/a.mjs | sed -e '1d'","node assets/source/a.mjs | sed -e 's/a/b/g;w out.txt'",
   "node assets/source/a.mjs | sed -i -e 's/a/b/g' assets/source/a.mjs","node assets/source/a.mjs | cut -c1-5 /etc/passwd","node assets/source/a.mjs | cut -f1 -d,",
   'node assets/source/a.mjs | grep -e "$(whoami)"'])assert.equal(bash(command),null,command);
  assert.equal(scriptRun('PowerShell',"node assets/source/a.mjs > /dev/null; grep -e 'x' assets/source/r.txt",root),null,'PowerShell keeps only the tail forms');
});

test('cards are titled by tool, show a search pattern beside its folder, and flag paths outside the world',()=>{
  const root=path.resolve(os.tmpdir(),'world'),out=path.resolve(os.tmpdir(),'projects');
  const card=(tool,input)=>{const c=permissionCard(tool,input,root);return [c.title,c.command,c.outside];};
  assert.deepEqual(card('PowerShell',{command:'uv run a.py'}),['Run a command?','uv run a.py',false]);
  assert.deepEqual(card('Read',{file_path:path.join(root,'world/world.json')}),['Read a file?',path.join(root,'world/world.json'),false]);
  assert.deepEqual(card('Read',{file_path:path.join(out,'notes.md')}),['Read a file?',path.join(out,'notes.md'),true]);
  assert.deepEqual(card('Edit',{file_path:'assets/source/a.py'}),['Edit a file?','assets/source/a.py',false]);
  assert.deepEqual(card('Write',{file_path:path.join(out,'a.py')}),['Write a file?',path.join(out,'a.py'),true]);
  // Turn 8's case: a Glob of * across the projects folder showed only the folder.
  assert.deepEqual(card('Glob',{pattern:'*',path:out}),['Search for files?',`pattern: *\nfolder: ${out}`,true]);
  assert.deepEqual(card('Glob',{pattern:'assets/**/*.glb'}),['Search for files?',`pattern: assets/**/*.glb\nfolder: ${root}`,false]);
  assert.equal(card('Glob',{pattern:'../**/*.md'})[2],true,'a pattern that climbs out is outside');
  assert.deepEqual(card('Grep',{pattern:'surf',path:'assets/source',glob:'*.py'}),['Search file contents?',`pattern: surf\nfolder: assets/source\nfiles: *.py`,false]);
  assert.equal(card('Grep',{pattern:'surf',path:out})[2],true);
  assert.deepEqual(card('WebFetch',{url:'https://example.test/'}),['Fetch a web page?','https://example.test/',true]);
  assert.deepEqual(card('mcp__kiln_workspace__kiln_render',{program:'a'}),['Use a Kiln tool?','',false]);
});

test('reads of the session plugin need no card; edits there and climbing patterns still ask',async t=>{
  const asks=[['Read',{file_path:'$PLUGIN/skills/holodeck-verify-world/references/render-cost.md'}],['Glob',{pattern:'**/*.md',path:'$PLUGIN/skills'}],['Grep',{pattern:'draws',path:'$PLUGIN'}],
    ['Glob',{pattern:'../../**/*',path:'$PLUGIN/skills'}],['Edit',{file_path:'$PLUGIN/skills/holodeck-verify-world/SKILL.md'}],['Read',{file_path:'$PLUGIN/../mcp.json'}]];
  const {agent,root,calls}=await fixture(t,{scenario:'asks',env:{FAKE_CLAUDE_ASKS:JSON.stringify(asks)}});
  await mkdir(path.join(root,'.agents/skills/holodeck-verify-world'),{recursive:true});
  await writeFile(path.join(root,'.agents/skills/holodeck-verify-world/SKILL.md'),'---\nname: holodeck-verify-world\ndescription: verify\n---\n');
  await agent.connect();await agent.startTurn({text:'Check render cost',model:'default'});
  const {results}=await answerCards(agent,calls,['reject-once','reject-once','reject-once']);
  assert.deepEqual(results,['allow','allow','allow','deny','deny','deny']);
  const plugin=agent.plugin.directory;
  assert.equal(pluginRead('Read',{file_path:path.join(plugin,'skills/x/SKILL.md')},null),false,'no plugin, no exception');
  assert.equal(pluginRead('Read',{file_path:'skills/x/SKILL.md'},plugin),false,'a relative path resolves against the world, not the plugin');
});

test('all Kiln workspace tools may be allowed for the session at once, and that survives reconnect',async t=>{
  const asks=[['mcp__kiln_workspace__kiln_render',{program:'a'}],['mcp__kiln_workspace__kiln_validate',{program:'a'}],['mcp__kiln_workspace__kiln_save',{program:'a'}],['Bash',{command:'node kiln.mjs list'}]];
  const {agent,make,calls}=await fixture(t,{scenario:'asks',env:{FAKE_CLAUDE_ASKS:JSON.stringify(asks)}});
  await agent.connect();await agent.startTurn({text:'Author a palm',model:'default'});
  const card=await requested(agent);
  assert.deepEqual(card.params.options.map(o=>[o.optionId,o.label]),[['allow-once','Allow once'],['allow-session','Allow this Kiln tool for this session'],['allow-kiln-session','Allow all Kiln workspace tools for this session'],['reject-once','Reject']]);
  // One card for the first Kiln tool, then only the shell command asks.
  const {done,results}=await answerCards(agent,calls,['allow-kiln-session','reject-once']);
  assert.deepEqual(results,['allow','allow','allow','deny']);
  assert.deepEqual(done.sessionTools,['mcp__kiln_workspace__*']);
  await agent.persistQueue;agent.close();
  const reopened=make();t.after(()=>reopened.close());
  assert.deepEqual((await reopened.connect()).sessionTools,['mcp__kiln_workspace__*']);
});

test('Claude Code shell calls start in the world folder',()=>{
  assert.equal(claudeEnv({PATH:'x'}).CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR,'1');
});

test('edit grants cover only files inside the world assets/source folder',()=>{
  const root=path.resolve(os.tmpdir(),'world');
  assert.equal(sessionGrant('Write',{file_path:path.join(root,'assets/source/terrain/a.py')},root),'edit:assets/source');
  assert.equal(sessionGrant('Edit',{file_path:'assets/source/palm.kiln.js'},root),'edit:assets/source','relative paths resolve against the world');
  assert.equal(sessionGrant('Edit',{file_path:path.join(root,'assets/source/../../outside.txt')},root),null);
  assert.equal(sessionGrant('Write',{file_path:path.join(root,'world/world.json')},root),null);
  assert.equal(sessionGrant('Write',{file_path:path.join(root,'assets/source')},root),null,'the folder itself is not a file');
  assert.equal(sessionGrant('Bash',{command:'echo hi > assets/source/a.txt'},root),'shell:'+JSON.stringify(['Bash',root,'echo hi > assets/source/a.txt']),'a shell grant names the exact command, never an edit grant');
  assert.notEqual(sessionGrant('Bash',{command:'echo hi'},root),sessionGrant('Bash',{command:'echo hi'},path.join(root,'other')));
  assert.equal(sessionGrant('Bash',{command:'  '},root),null);assert.equal(sessionGrant('Bash',{command:'x'.repeat(8001)},root),null);assert.equal(sessionGrant('Bash',{},root),null);
  assert.equal(sessionGrant('WebFetch',{url:'https://example.test'},root),null,'other tools always ask');
  // H32: world_read carries the engine contract, so no read grant exists for engine docs, home or config folders.
  for(const [tool,input] of [['Read',{file_path:path.join(os.homedir(),'.claude','settings.json')}],['Grep',{pattern:'terrain',path:path.join(os.homedir(),'.claude')}],['Glob',{pattern:'**/*.md',path:path.join(root,'..','holodeck','docs')}],['Read',{file_path:path.join(root,'assets/source/notes.md')}]])assert.equal(sessionGrant(tool,input,root),null,`${tool} asks per call`);
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

test('a bridge reset during a pending approval preserves stop and drops the disconnected reply',async t=>{
  const {agent}=await fixture(t,{scenario:'hold'});
  await agent.connect();await agent.startTurn({text:'Wait',model:'default'});
  let response;
  const onBridge=agent.onBridge.bind(agent);
  agent.onBridge=async request=>{response=await onBridge(request);return response;};
  const connected=new Promise(resolve=>agent.bridge.server.once('connection',resolve));
  const client=net.connect(agent.bridge.file);
  client.on('error',()=>{});t.after(()=>client.destroy());
  const socket=await connected;
  client.write(JSON.stringify({id:1,token:agent.token,method:'tools/call',params:{name:'permission_prompt',arguments:{tool_name:'Bash',input:{command:'node -e 0'}}}})+'\n');
  await requested(agent);
  let writes=0;const write=socket.write.bind(socket);
  socket.write=(...args)=>{writes++;return write(...args);};
  const closed=new Promise(resolve=>socket.once('close',resolve));
  // Inject the transport reset on the real accepted pipe, after its approval
  // is pending. This avoids relying on platform-specific peer-close timing.
  socket.destroy(Object.assign(new Error('read ECONNRESET'),{code:'ECONNRESET'}));
  await closed;
  await agent.stop();const done=await settled(agent);
  assert.equal(done.status,'interrupted');assert.deepEqual(done.requests,[]);
  assert.equal(JSON.parse(response.content[0].text).behavior,'deny');
  assert.equal(writes,0,'a disconnected requester must not receive the resumed approval response');
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

test('a sign-in that lapses mid-session ends the turn disconnected, with the way back',async t=>{
  const {agent}=await fixture(t,{scenario:'expired'});
  await agent.connect();await agent.startTurn({text:'Plan the world',model:'opus'});
  const done=await settled(agent);
  assert.equal(done.connected,false);assert.equal(done.status,'disconnected');
  assert.match(done.error,/^Failed to authenticate: OAuth session expired and could not be refreshed\. Claude Code needs you to sign in again: run `claude` in a terminal/);
  assert.equal(done.sessionStarted,true,'the session is kept for the next turn');
});

test('claudeEnv strips Anthropic API and provider credentials but keeps unrelated variables',()=>{
  const env=claudeEnv({PATH:'x',HOME:'h',ANTHROPIC_API_KEY:'k',ANTHROPIC_AUTH_TOKEN:'t',ANTHROPIC_BASE_URL:'u',ANTHROPIC_VERTEX_PROJECT_ID:'v',CLAUDE_CODE_USE_VERTEX:'1',CLAUDE_CODE_USE_FOUNDRY:'1',AWS_BEARER_TOKEN_BEDROCK:'b',CLAUDE_CODE_SIMPLE:'1',CLAUDE_CODE_MAX_OUTPUT_TOKENS:'64000'});
  assert.deepEqual(env,{PATH:'x',HOME:'h',CLAUDE_CODE_MAX_OUTPUT_TOKENS:'64000',CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR:'1'});
});

test('a Holodeck launched inside a Claude Code session does not hand that session to the CLI',()=>{
  // As observed when the desktop app's agent started the host: the child then waited on a host auth refresh.
  const env=claudeEnv({PATH:'x',HOME:'h',CLAUDE_CONFIG_DIR:'c',CLAUDECODE:'1',CLAUDE_CODE_ENTRYPOINT:'claude-desktop',CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH:'1',CLAUDE_CODE_SESSION_ID:'s',CLAUDE_CODE_OAUTH_SCOPES:'o',CLAUDE_CODE_MESSAGING_TOKEN:'m',CLAUDE_CODE_MAX_OUTPUT_TOKENS:'64000',CLAUDE_AGENT_SDK_VERSION:'1',CLAUDE_PID:'2',CLAUDE_EFFORT:'max',USE_STAGING_OAUTH:'',MCP_CONNECTION_NONBLOCKING:'1'});
  assert.deepEqual(env,{PATH:'x',HOME:'h',CLAUDE_CONFIG_DIR:'c',CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR:'1'});
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

test('connecting says when the world\'s Kiln workspace was upgraded',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-kiln-notice-'));
  const claude=Object.assign(new EventEmitter(),{snapshot(){return {provider:'claude',status:'ready',requests:[]};},async connect(){return this.snapshot();},close(){}});
  let upgrade={status:'current',changed:['skills/kiln-author-asset/SKILL.md','.kiln/workspace.json']};
  const host=await createHost(root,{claudeFactory:()=>claude,ensureWorkspace:async()=>upgrade});
  const server=createServer((req,res)=>host.middleware(req,res,()=>{res.statusCode=404;res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const session=await fetch(`${base}/api/session`),cookie=session.headers.get('set-cookie').split(';')[0];
  const events=await fetch(`${base}/api/events`,{headers:{cookie}}),reader=events.body.getReader(),decoder=new TextDecoder();let stream='';
  const post=(route,data)=>fetch(`${base}/api/${route}`,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post('agent/connect',{provider:'claude'})).status,200);
  while(!stream.includes('event: notice')){const {value,done}=await reader.read();if(done)break;stream+=decoder.decode(value);}
  assert.match(stream,/event: notice\ndata: "Kiln workspace upgraded for the installed Kiln · 2 Kiln-managed files refreshed"/);
  // A current workspace connects quietly: after one more upgrade, the stream holds exactly one new notice.
  upgrade=null;stream='';
  assert.equal((await post('agent/connect',{provider:'claude'})).status,200);
  upgrade={status:'current',changed:['.kiln/workspace.json']};
  assert.equal((await post('agent/connect',{provider:'claude'})).status,200);
  while(!stream.includes('event: notice')){const {value,done}=await reader.read();if(done)break;stream+=decoder.decode(value);}
  await reader.cancel();
  assert.deepEqual(stream.match(/data: "Kiln workspace[^"]*"/g),['data: "Kiln workspace upgraded for the installed Kiln · 1 Kiln-managed file refreshed"']);
});
