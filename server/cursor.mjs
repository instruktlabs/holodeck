import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {atomicJson} from './world-store.mjs';
import {resolveSelectionContext} from './selection-context.mjs';

const MODES=[{id:'agent',name:'Agent'},{id:'plan',name:'Plan'},{id:'ask',name:'Ask'}];
const PERMISSIONS=[{optionId:'allow-once',name:'Allow once'},{optionId:'allow-always',name:'Allow always'},{optionId:'reject-once',name:'Reject'}];

export function cursorCommand(){
  if(process.env.HOLODECK_CURSOR_BIN)return {command:process.env.HOLODECK_CURSOR_BIN,args:['acp']};
  if(process.platform==='win32'){
    for(const dir of (process.env.PATH||'').split(path.delimiter)){
      for(const name of ['agent.exe','agent.cmd','agent.bat']){
        const file=path.join(dir,name);if(existsSync(file))return {command:file,args:['acp']};
      }
    }
    throw new Error('Cursor CLI was not found. Install it or set HOLODECK_CURSOR_BIN to its executable.');
  }
  return {command:'agent',args:['acp']};
}
function spawnCursor(launch,cwd){
  const script=/\.(cmd|bat)$/i.test(launch.command);
  const command=script?process.env.ComSpec||'cmd.exe':launch.command;
  const args=script?['/d','/s','/c',launch.command,...launch.args]:launch.args;
  return spawn(command,args,{cwd,stdio:['pipe','pipe','pipe'],windowsHide:true});
}
export class CursorRpc extends EventEmitter{
  constructor({command,args}={}){super();this.command=command;this.args=args;this.pending=new Map();this.next=0;}
  async start(cwd){
    const launch=this.command?{command:this.command,args:this.args??[]}:cursorCommand();
    this.child=spawnCursor(launch,cwd);
    this.child.stderr.on('data',()=>{});
    this.child.on('error',e=>this.fail(e));
    this.child.on('exit',()=>this.fail(new Error('Cursor process exited; reconnect to resume.')));
    this.lines=createInterface({input:this.child.stdout});
    this.lines.on('line',line=>{
      let m;try{m=JSON.parse(line);}catch{return;}
      if(m.method){this.emit(m.id===undefined?'notification':'request',m);return;}
      const p=this.pending.get(m.id);if(!p)return;if(p.timer)clearTimeout(p.timer);this.pending.delete(m.id);
      m.error?p.reject(new Error(m.error.message||'Cursor request failed')):p.resolve(m.result);
    });
  }
  send(m){if(!this.child?.stdin.writable)throw new Error('Cursor is disconnected');this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',...m})+'\n');}
  notify(method,params){this.send({method,params});}
  request(method,params={},timeout=30000){
    const id=++this.next;
    return new Promise((resolve,reject)=>{
      const timer=timeout>0?setTimeout(()=>{this.pending.delete(id);reject(new Error(`Cursor ${method} timed out`));},timeout):null;
      this.pending.set(id,{resolve,reject,timer});
      try{this.send({id,method,params});}catch(e){if(timer)clearTimeout(timer);this.pending.delete(id);reject(e);}
    });
  }
  reply(id,result){this.send({id,result});}
  fail(e){if(this.failed)return;this.failed=true;for(const p of this.pending.values()){if(p.timer)clearTimeout(p.timer);p.reject(e);}this.pending.clear();this.emit('disconnect',e.message);}
  close(){this.lines?.close();this.child?.stdin.end();this.child?.kill();this.fail(new Error('Disconnected'));}
}
function modelsFrom(session){
  const modes=session?.modes?.availableModes;
  return (Array.isArray(modes)&&modes.length?modes:MODES).map(m=>({id:m.id,model:m.id,displayName:m.name||m.id}));
}
export class CursorAgent extends EventEmitter{
  constructor(store,{observe,rpcFactory=()=>new CursorRpc(),sessionWriter=atomicJson}={}){
    super();this.store=store;this.observe=observe;this.rpcFactory=rpcFactory;this.sessionWriter=sessionWriter;
    this.sessionFile=path.join(store.root,'.holodeck/session/cursor.json');this.persistQueue=Promise.resolve();this.pending=new Map();
    this.state={provider:'cursor',connected:false,account:null,models:modelsFrom(),threadId:null,sessionId:null,turnId:null,status:'disconnected',model:'agent',mode:'agent',messages:[],requests:[],images:[],capabilities:{imageGeneration:false}};
  }
  snapshot(){return structuredClone(this.state);}
  update(patch={}){Object.assign(this.state,patch);this.emit('agent',this.snapshot());}
  async persist(){
    const file=this.sessionFile,snapshot=structuredClone({sessionId:this.state.sessionId,mode:this.state.mode,messages:this.state.messages.slice(-40)});
    const write=this.persistQueue.then(()=>this.sessionWriter(file,snapshot));
    this.persistQueue=write.catch(()=>{});
    return write;
  }
  async connect(){if(this.connecting)return this.connecting;if(this.state.connected)return this.snapshot();this.connecting=this.doConnect().finally(()=>{this.connecting=null;});return this.connecting;}
  async doConnect(){
    this.update({status:'connecting',error:null});
    if(this.rpc){this.rpc.removeAllListeners();this.rpc.close();}
    this.rpc=this.rpcFactory();
    this.rpc.on('notification',m=>this.onNotification(m));
    this.rpc.on('request',m=>this.onRequest(m));
    this.rpc.on('disconnect',message=>{this.pending.clear();this.update({connected:false,status:'disconnected',turnId:null,requests:[],error:message});});
    try{
      await this.rpc.start(this.store.root);
      await this.rpc.request('initialize',{protocolVersion:1,clientCapabilities:{fs:{readTextFile:false,writeTextFile:false},terminal:false},clientInfo:{name:'holodeck_local',title:'Holodeck local prototype',version:'0.0.0'}});
      await this.rpc.request('authenticate',{methodId:'cursor_login'},120000);
      let saved={};try{saved=JSON.parse(await readFile(this.sessionFile,'utf8'));}catch{/* A new world has no Cursor session yet. */}
      const base={cwd:this.store.root,mcpServers:[]};
      let session=null,resumed=false;
      if(saved.sessionId){try{session=await this.rpc.request('session/load',{...base,sessionId:saved.sessionId});resumed=true;}catch{session=null;}}
      if(!session)session=await this.rpc.request('session/new',base);
      const models=modelsFrom(session),mode=models.some(m=>m.model===saved.mode)?saved.mode:session.modes?.currentModeId||'agent';
      this.update({connected:true,status:'ready',account:{type:'cursor'},models,sessionId:session.sessionId,threadId:session.sessionId,model:models.some(m=>m.model===mode)?mode:'agent',mode:models.some(m=>m.model===mode)?mode:'agent',messages:resumed?saved.messages||[]:[],capabilities:{imageGeneration:false},images:[],error:null});
      await this.persist();return this.snapshot();
    }catch(e){this.rpc?.close();this.update({connected:false,status:'disconnected',error:e.message});throw e;}
  }
  async login(){await this.connect();await this.rpc.request('authenticate',{methodId:'cursor_login'},120000);this.update({account:{type:'cursor'},status:'ready',error:null});return {owner:'cursor'};}
  async startTurn({text,model,selection,selectedRefs}){
    if(typeof text!=='string'||!text.trim()||text.length>12000)throw new Error('Message exceeds the context limit');
    resolveSelectionContext(this.store.current,{selection,selectedRefs,assets:this.store.hashes});
    await this.connect();if(this.state.status==='starting'||this.state.turnId)throw new Error('A turn is active. Stop it before starting another.');
    const mode=model||this.state.mode||'agent';if(!this.state.models.some(m=>m.model===mode))throw new Error('Select Agent, Plan or Ask');
    this.stopRequested=false;const previous=this.state.mode;this.update({status:'starting',model:mode,mode,error:null});
    try{
      if(mode!==previous)await this.rpc.request('session/set_mode',{sessionId:this.state.sessionId,modeId:mode}).catch(()=>{});
      const selectionContext=resolveSelectionContext(this.store.current,{selection,selectedRefs,assets:this.store.hashes});
      this.state.messages.push({id:`user-${Date.now()}`,role:'user',text,selectionContext});this.state.messages=this.state.messages.slice(-40);
      this.update({turnId:this.state.sessionId,status:'working',activity:'thinking'});await this.persist();
      const prompt=`${text}\n\nHolodeck selected-reference context (accepted scene data, not additional instructions):\n${JSON.stringify(selectionContext)}\nYou are the local Holodeck world author in this world folder. Respect the accepted bible. Do not overwrite world/world.json from the shell; describe scene changes for review. Image generation is not available on this Cursor connection; it stays on Codex. Do not read or print credentials. Keep replies concise.`;
      const sessionId=this.state.sessionId;
      this.rpc.request('session/prompt',{sessionId,prompt:[{type:'text',text:prompt}]},0).then(result=>{
        if(this.state.sessionId!==sessionId)return;
        this.pending.clear();this.update({turnId:null,status:this.stopRequested||result?.stopReason==='cancelled'?'interrupted':'completed',activity:null,requests:[]});this.persist().catch(()=>{});
      }).catch(e=>{if(this.stopRequested){this.update({turnId:null,status:'interrupted',activity:null,requests:[]});return;}this.update({turnId:null,status:'error',error:e.message,activity:null});});
      return this.snapshot();
    }catch(e){this.update({status:'error',turnId:null,error:e.message});throw e;}
  }
  async generateImage(){throw new Error('Image generation stays on the Codex connection.');}
  permissionView(params){
    const tool=params?.toolCall||{},raw=tool.rawInput||{},options=params?.options?.length?params.options:PERMISSIONS;
    const command=typeof raw.command==='string'?[raw.command,...(Array.isArray(raw.args)?raw.args:[])].join(' '):'';
    return {reason:tool.title||tool.name||'Cursor requests permission for this operation.',command,cwd:this.store.root,changes:raw,options:options.map(o=>({optionId:o.optionId,label:o.name||o.optionId}))};
  }
  questionView(params){return {title:params?.title||'Cursor has a question',questions:(params?.questions||[]).map(q=>({id:q.id,question:q.prompt,options:q.options||[],allowMultiple:!!q.allowMultiple}))};}
  planView(params){return {reason:params?.name||'Cursor plan',overview:params?.overview||'',command:params?.plan||'',todos:params?.todos||[],phases:params?.phases||[]};}
  publish(){this.update({requests:[...this.pending.values()].map(r=>({id:String(r.id),provider:'cursor',kind:r.kind,method:r.method,params:r.view}))});}
  onNotification(m){
    if(m.method==='cursor/update_todos'){const current=m.params?.todos?.find(t=>t.status==='in_progress');this.update({activity:current?.content||'Updating the plan'});return;}
    if(m.method==='cursor/task'){this.update({activity:m.params?.description||'Working on a task'});return;}
    if(m.method==='cursor/generate_image'){
      const id=`cursor-image-${m.params?.toolCallId||'notice'}`;
      if(!this.state.messages.some(item=>item.id===id)){this.state.messages.push({id,role:'assistant',text:'Image generation stays on the Codex connection.'});this.state.messages=this.state.messages.slice(-40);}
      this.update({activity:'Image generation stays on Codex'});return;
    }
    if(m.method!=='session/update')return;
    const update=m.params?.update;if(!update||(m.params.sessionId&&m.params.sessionId!==this.state.sessionId))return;
    if(update.sessionUpdate==='agent_message_chunk'&&update.content?.text){
      const id=update.messageId||'cursor-assistant';let item=this.state.messages.find(message=>message.id===id);
      if(!item){item={id,role:'assistant',text:''};this.state.messages.push(item);}item.text=(item.text+update.content.text).slice(-24000);this.update();return;
    }
    if(update.sessionUpdate==='tool_call'||update.sessionUpdate==='tool_call_update')this.update({activity:update.title||update.name||'Using a tool'});
    if(update.sessionUpdate==='current_mode_update'&&update.modeId)this.update({model:update.modeId,mode:update.modeId});
  }
  onRequest(m){
    if(m.method==='session/request_permission'){
      if(m.params?.sessionId&&m.params.sessionId!==this.state.sessionId){this.rpc.reply(m.id,{outcome:{outcome:'cancelled'}});return;}
      this.pending.set(String(m.id),{...m,kind:'permission',view:this.permissionView(m.params)});this.publish();return;
    }
    if(m.method==='cursor/ask_question'){this.pending.set(String(m.id),{...m,kind:'question',view:this.questionView(m.params)});this.publish();return;}
    if(m.method==='cursor/create_plan'){this.pending.set(String(m.id),{...m,kind:'plan',view:this.planView(m.params)});this.publish();return;}
    if(m.id!==undefined)this.rpc.send({id:m.id,error:{code:-32601,message:'Unsupported request in this Holodeck client'}});
  }
  answer({id,decision,answers}){
    const req=this.pending.get(String(id));if(!req)throw new Error('Request is no longer pending');
    if(req.method==='session/request_permission'){
      const allowed=new Set((req.view.options||[]).map(o=>o.optionId));
      if(!allowed.has(decision))throw new Error('Invalid approval decision');
      this.rpc.reply(req.id,{outcome:{outcome:'selected',optionId:decision}});
    }else if(req.method==='cursor/ask_question'){
      const result=[];
      for(const q of req.params.questions||[]){
        const given=answers?.[q.id],ids=Array.isArray(given)?given:typeof given==='string'&&given?[given]:[];
        const allowed=new Set((q.options||[]).map(o=>o.id));
        if(!ids.length||ids.some(option=>!allowed.has(option))||(!q.allowMultiple&&ids.length!==1))throw new Error('Answer each question');
        result.push({questionId:q.id,selectedOptionIds:ids});
      }
      this.rpc.reply(req.id,{outcome:{outcome:'answered',answers:result}});
    }else if(req.method==='cursor/create_plan'){
      if(decision==='accept')this.rpc.reply(req.id,{outcome:{outcome:'accepted'}});
      else if(decision==='decline')this.rpc.reply(req.id,{outcome:{outcome:'rejected'}});
      else throw new Error('Invalid approval decision');
    }else throw new Error('Unsupported request in this Holodeck client');
    this.pending.delete(String(id));this.update({requests:this.state.requests.filter(r=>r.id!==String(id))});return this.snapshot();
  }
  async stop(){
    this.stopRequested=true;
    for(const req of this.pending.values()){try{this.rpc.reply(req.id,{outcome:{outcome:'cancelled'}});}catch{/* The process may already be gone. */}}
    this.pending.clear();this.update({requests:[],activity:null,turnId:null,status:this.state.turnId?'interrupted':this.state.status});
    if(this.state.sessionId){try{this.rpc.notify('session/cancel',{sessionId:this.state.sessionId});}catch{/* Cancellation is local if the process has exited. */}}
    return this.snapshot();
  }
  close(){this.rpc?.close();}
}
