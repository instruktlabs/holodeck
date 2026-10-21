import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WorldStore } from './world-store.mjs';
import { CodexAgent } from './codex.mjs';
import { MAX_ASSET_BYTES } from '../src/world/contract.mjs';
import {ensureKilnWorkspace} from './kiln-workspace.mjs';
import {checkWorld} from './coherence.mjs';
import {listRevisions,restoreRevision,remixRevision} from './history.mjs';

async function body(req,limit=1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('Request is too large');chunks.push(chunk);}return Buffer.concat(chunks);}
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
export async function createHost(root,{agentFactory,context=null,token=randomBytes(32).toString('hex'),ensureWorkspace=ensureKilnWorkspace}={}){
  const store=await WorldStore.open(root),clients=new Set();let proposal=null,observation=null,closing=false,closePromise=null,historyActive=false,agentStarting=false,storeWork=0;
  const serial=store.serial.bind(store);store.serial=work=>{storeWork++;return serial(work).finally(()=>storeWork--);};
  const scoped=value=>{if(!context||!value||typeof value!=='object')return value;const result={...value};if(result.world)result.context=context;if(result.assets)result.assets=Object.fromEntries(Object.entries(result.assets).map(([id,asset])=>[id,{...asset,url:`${asset.url}?worldId=${context.worldId}&epoch=${context.epoch}`} ]));if(result.proposal)result.proposal=scoped(result.proposal);return result;};
  const send=(res,value,status)=>json(res,scoped(value),status);
  const broadcast=message=>{
    if(closing)return;
    for(const res of clients){
      if(res.destroyed||res.writableEnded||res.closed){clients.delete(res);continue;}
      res.write(message);
    }
  };
  const emit=(type,data)=>broadcast(`event: ${type}\ndata: ${JSON.stringify(scoped(data))}\n\n`);
  const propose=async(change,isActive=()=>true)=>{
    if(change.baseRevision!==store.current.revision)throw new Error('World changed; read the current revision first');
    const world={...store.snapshot(),scene:change.scene??store.current.scene,bible:change.bible??store.current.bible,references:change.references??store.current.references??[]};
    const assets=await store.prepare(world);
    if(!isActive()||change.baseRevision!==store.current.revision)throw new Error('Proposal canceled or superseded');
    proposal={id:randomUUID(),baseRevision:change.baseRevision,summary:String(change.summary||'World change').slice(0,1000),world,assets};emit('proposal',proposal);return {proposalId:proposal.id,status:'awaiting user review',baseRevision:proposal.baseRevision};
  };
  const agent=agentFactory?agentFactory(store,{propose,observe:()=>observation}):new CodexAgent(store,{propose,observe:()=>observation});
  const onWorld=data=>{proposal=null;emit('proposal',null);emit('world',data);},onDiagnostic=message=>emit('diagnostic',message),onAgent=s=>emit('agent',s);
  store.on('world',onWorld);store.on('diagnostic',onDiagnostic);agent.on('agent',onAgent);
  const keepalive=setInterval(()=>broadcast(': heartbeat\n\n'),15000);keepalive.unref();
  async function middleware(req,res,next){
    if(!req.url?.startsWith('/api/'))return next();
    if(closing)return send(res,{error:'Host is closing; reconnect to continue'},503);
    try{
      const host=req.headers.host,allowed=new Set([`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`]);
      if(!allowed.has(host)||req.headers.origin&&req.headers.origin!==`http://${host}`||req.headers['sec-fetch-site']==='cross-site')return send(res,{error:'Local same-origin access required'},403);
      const url=new URL(req.url,`http://${host}`),route=url.pathname;
      if(route==='/api/session'&&req.method==='GET'){
        res.setHeader('Set-Cookie',`holodeck_${req.socket.localPort}=${token}; HttpOnly; SameSite=Strict; Path=/api`);
        return send(res,{...store.payload(),agent:agent.snapshot(),proposal});
      }
      if(!req.headers.cookie?.split(';').some(c=>c.trim()===`holodeck_${req.socket.localPort}=${token}`))return send(res,{error:'Open a Holodeck session first'},401);
      if(route==='/api/events'&&req.method==='GET'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});clients.add(res);
        res.write(`event: world\ndata: ${JSON.stringify(scoped(store.payload()))}\n\nevent: agent\ndata: ${JSON.stringify(agent.snapshot())}\n\nevent: proposal\ndata: ${JSON.stringify(scoped(proposal))}\n\n`);
        const remove=()=>clients.delete(res);res.once('close',remove);res.once('error',remove);return;
      }
      if(route.startsWith('/api/assets/')&&req.method==='GET'){
        const hash=route.slice('/api/assets/'.length);if(!/^[a-f0-9]{64}\.glb$/.test(hash))return send(res,{error:'Invalid asset hash'},400);
        const data=await readFile(path.join(store.root,'.holodeck/blobs',hash));res.writeHead(200,{'Content-Type':'model/gltf-binary','Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(data);
      }
      if(route.startsWith('/api/references/')&&req.method==='GET'){
        const name=route.slice('/api/references/'.length);if(!/^[a-f0-9]{64}\.(png|md|txt|json|pdf|glb)$/.test(name))throw new Error('Invalid reference revision');
        const file=await store.contained(`references/files/${name}`),data=await readFile(file);res.writeHead(200,{'Content-Type':name.endsWith('.png')?'image/png':'application/octet-stream',...(name.endsWith('.png')?{}:{'Content-Disposition':`attachment; filename="${name}"`}), 'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(data);
      }
      if(route==='/api/history'&&req.method==='GET')return send(res,{revisions:await listRevisions(root)});
      if(req.method!=='POST')return send(res,{error:'Unknown route'},404);
      if(route==='/api/import')return send(res,await store.importAsset(await body(req,MAX_ASSET_BYTES),url.searchParams.get('name')||'asset.glb'));
      if(route==='/api/reference/import')return send(res,await store.importReference(await body(req,12*1024*1024),url.searchParams.get('name')||'Reference'));
      if(route==='/api/reference/file')return send(res,await store.importFile(await body(req,12*1024*1024),url.searchParams.get('name')||'Reference.txt'));
      if(!req.headers['content-type']?.startsWith('application/json'))return send(res,{error:'JSON content type required'},415);
      const data=JSON.parse((await body(req)).toString('utf8')||'{}');
      if(route==='/api/history/restore'||route==='/api/history/remix'){
        const state=agent.snapshot();
        if(historyActive)throw new Error('Another history operation is in progress');
        if(agentStarting||state.turnId||state.status==='starting')throw new Error('Wait for the active agent turn to finish before changing history');
        historyActive=true;
        try{
        if(data.baseRevision!==store.current.revision)throw new Error('World changed; refresh history before continuing');
        if(route.endsWith('/restore'))return send(res,await restoreRevision(store,data));
        if(typeof data.name!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(data.name)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(data.name))throw new Error('Choose a folder name using letters, numbers, hyphens or underscores');
        const destination=path.join(path.dirname(path.resolve(root)),data.name);
        return send(res,await remixRevision(root,data.revision,destination));
        }finally{historyActive=false;}
      }
      if(route==='/api/check')return send(res,checkWorld(store.current,{observation,assets:store.hashes,routes:data.routes??[]}));
      if(route==='/api/reference/link')return send(res,await store.linkReference(data.file));
      if(route==='/api/world')return send(res,await store.commit(data));
      if(route==='/api/undo')return send(res,await store.undo(data.baseRevision));
      if(route==='/api/propose')return send(res,await propose(data));
      if(route==='/api/proposal/apply'){
        if(!proposal||proposal.id!==data.id)throw new Error('Proposal is no longer current');
        return send(res,await store.commit({baseRevision:proposal.baseRevision,scene:proposal.world.scene,bible:proposal.world.bible,references:proposal.world.references}));
      }
      if(route==='/api/proposal/discard'){if(proposal?.id===data.id){proposal=null;emit('proposal',null);}return send(res,{ok:true});}
      if(route==='/api/observation'){
        if(!Number.isSafeInteger(data.revision)||!Array.isArray(data.position)||data.position.length!==3||data.position.some(n=>!Number.isFinite(n)))throw new Error('Invalid observation');
        observation={...data,receivedAt:new Date().toISOString()};return send(res,{ok:true});
      }
      if(route==='/api/agent/connect'){await ensureWorkspace(root);return send(res,await agent.connect());}
      if(route==='/api/agent/login')return send(res,await agent.login());
      if(route==='/api/agent/turn'||route==='/api/agent/image'){
        if(historyActive)throw new Error('Wait for the history operation to finish before starting an agent');
        if(agentStarting)throw new Error('An agent turn is already starting');
        agentStarting=true;
        try{
          if(route.endsWith('/image')){await ensureWorkspace(root);return send(res,await agent.generateImage(data));}
          return send(res,await agent.startTurn({text:data.text,model:data.model,effort:data.effort,selection:data.selection,selectedRefs:data.selectedRefs}));
        }finally{agentStarting=false;}
      }
      if(route==='/api/agent/stop')return send(res,await agent.stop());
      if(route==='/api/agent/answer')return send(res,agent.answer(data));
      return send(res,{error:'Unknown route'},404);
    }catch(e){send(res,{error:e.message},e.message.includes('changed')?409:400);}
  }
  return {middleware,store,agent,session:()=>scoped({...store.payload(),agent:agent.snapshot(),proposal}),switchBlockers(){const state=agent.snapshot(),reasons=[];if(agentStarting||agent.connecting||state.turnId||['starting','connecting','working','inProgress'].includes(state.status))reasons.push('Wait for the active agent operation to finish');if(state.requests?.length)reasons.push('Resolve the pending agent request');if(proposal)reasons.push('Apply or discard the pending proposal');if(historyActive||storeWork)reasons.push('Wait for the current world operation to finish');return reasons;},close(){
    if(closePromise)return closePromise;
    closing=true;clearInterval(keepalive);
    // Closing the RPC emits a final disconnect synchronously. Detach producers
    // and remove destinations before ending streams so that event cannot write
    // into an ended response during a Vite restart or normal host shutdown.
    store.off('world',onWorld);store.off('diagnostic',onDiagnostic);agent.off('agent',onAgent);
    const responses=[...clients];clients.clear();
    for(const res of responses)if(!res.destroyed&&!res.writableEnded)res.end();
    closePromise=(async()=>{try{await agent.persistQueue;agent.close();}finally{await store.close();}})();return closePromise;
  }};
}

export function holodeckHostPlugin(){
  let hostPromise;
  const attach=server=>{
    const root=path.resolve(process.env.HOLODECK_WORKSPACE||path.join(process.cwd(),'../holodeck-worlds/hearth'));
    server.middlewares.use((req,res,next)=>{
      if(!req.url?.startsWith('/api/'))return next();
      hostPromise??=import('./library-host.mjs').then(({createLibraryHost})=>createLibraryHost(root,{libraryRoot:process.env.HOLODECK_LIBRARY})).catch(e=>{hostPromise=null;throw e;});
      hostPromise.then(h=>h.middleware(req,res,next)).catch(e=>json(res,{error:e.message},503));
    });
    server.httpServer?.on('close',()=>hostPromise?.then(h=>h.close()));
  };
  return {name:'holodeck-local-host',configureServer:attach,configurePreviewServer:attach};
}
