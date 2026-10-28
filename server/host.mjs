import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WorldStore } from './world-store.mjs';
import { CodexAgent } from './codex.mjs';
import {createTextureStore,TEXTURE_CONTENT_TYPES} from './texture-store.mjs';
import { CursorAgent } from './cursor.mjs';
import { ClaudeAgent } from './claude.mjs';
import { MAX_ASSET_BYTES } from '../src/world/contract.mjs';
import {ensureKilnWorkspace} from './kiln-workspace.mjs';
import {syncOptionalSkills} from './world-skills.mjs';
import {enabledOptionalSkills} from '../src/world/optional-skills.mjs';
import {checkWorld} from './coherence.mjs';
import {listRevisions,restoreRevision,remixRevision} from './history.mjs';
import {retainHeightSamples,releaseHeightSamples,heightSamples} from '../src/world/terrain.mjs';
import {heightmapOf,admitHeight,heightBlob} from './terrain-heights.mjs';

async function body(req,limit=1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('Request is too large');chunks.push(chunk);}return Buffer.concat(chunks);}
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
export async function createHost(root,{agentFactory,cursorFactory,claudeFactory,context=null,token=randomBytes(32).toString('hex'),ensureWorkspace=ensureKilnWorkspace,sharedTextures=process.env.HOLODECK_SHARED_TEXTURES!=='0'}={}){
  const store=await WorldStore.open(root),clients=new Set();
  // GLBs are served with embedded images moved to /api/textures, so identical
  // images download once. HOLODECK_SHARED_TEXTURES=0 serves the pinned bytes.
  const textures=createTextureStore(hash=>readFile(path.join(store.root,'.holodeck/blobs',`${hash}.glb`)));let proposal=null,observation=null,closing=false,closePromise=null,historyActive=false,agentStarting=false,storeWork=0;
  const serial=store.serial.bind(store);store.serial=work=>{storeWork++;return serial(work).finally(()=>storeWork--);};
  const scopeUrl=entry=>({...entry,url:`${entry.url}?worldId=${context.worldId}&epoch=${context.epoch}`});
  const scope=entries=>Object.fromEntries(Object.entries(entries).map(([id,asset])=>[id,scopeUrl(asset)]));
  const scoped=value=>{if(!context||!value||typeof value!=='object')return value;const result={...value};if(result.world)result.context=context;if(result.assets)result.assets=scope(result.assets);if(result.textures)result.textures=scope(result.textures);if(result.height)result.height=scopeUrl(result.height);if(result.proposal)result.proposal=scoped(result.proposal);return result;};
  // A staged proposal's height samples stay resident until it is replaced,
  // applied or discarded, for world_sample and world_check on the proposal.
  const stage=next=>{if(next?.height)retainHeightSamples(next.height.hash);if(proposal?.height)releaseHeightSamples(proposal.height.hash);proposal=next;};
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
    const {assets,textures:terrainTextures,height}=await store.prepareBundle(world);
    if(!isActive()||change.baseRevision!==store.current.revision)throw new Error('Proposal canceled or superseded');
    if(height&&!heightSamples(height.hash))admitHeight(heightmapOf(world),await readFile(path.join(store.root,heightBlob(height.hash))));
    stage({id:randomUUID(),baseRevision:change.baseRevision,summary:String(change.summary||'World change').slice(0,1000),world,assets,textures:terrainTextures,height});emit('proposal',proposal);return {proposalId:proposal.id,status:'awaiting user review',baseRevision:proposal.baseRevision};
  };
  const codexAgent=agentFactory?agentFactory(store,{propose,observe:()=>observation,staged:()=>proposal}):new CodexAgent(store,{propose,observe:()=>observation,staged:()=>proposal});
  let cursor=null,claude=null,agent=codexAgent;
  const cursorAgent=()=>cursor??=cursorFactory?cursorFactory(store,{propose,observe:()=>observation,staged:()=>proposal}):new CursorAgent(store,{propose,observe:()=>observation,staged:()=>proposal});
  const claudeAgent=()=>claude??=claudeFactory?claudeFactory(store,{propose,observe:()=>observation,staged:()=>proposal}):new ClaudeAgent(store,{propose,observe:()=>observation,staged:()=>proposal});
  const selectAgent=requested=>{
    if(!['codex','cursor','claude'].includes(requested))throw new Error('Choose Codex, Cursor or Claude Code');
    const next=requested==='cursor'?cursorAgent():requested==='claude'?claudeAgent():codexAgent;
    if(next!==agent){
      const current=agent.snapshot?.()||{};
      if(agent.connecting||current.turnId||current.requests?.length||['starting','connecting','working','inProgress'].includes(current.status))throw new Error('Finish or stop the current agent session before switching.');
      agent.off?.('agent',onAgent);agent=next;agent.on?.('agent',onAgent);
    }
    return agent;
  };
  // Optional skills follow scene.destinations: synced on every connection and
  // whenever an accepted revision changes the declared set.
  let skillSync=Promise.resolve(),syncedSkills=null;
  const syncSkills=()=>skillSync=skillSync.catch(()=>{}).then(async()=>{syncedSkills=JSON.stringify(await syncOptionalSkills(store.root,store.current));});
  const onWorld=data=>{stage(null);emit('proposal',null);emit('world',data);if(syncedSkills!==null&&JSON.stringify(enabledOptionalSkills(store.current))!==syncedSkills)syncSkills().catch(e=>emit('diagnostic',`World skills could not be updated: ${e.message}`));},onDiagnostic=message=>emit('diagnostic',message),onAgent=s=>emit('agent',s);
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
        const data=sharedTextures?await textures.glb(hash.slice(0,64)):await readFile(path.join(store.root,'.holodeck/blobs',hash));res.writeHead(200,{'Content-Type':'model/gltf-binary','Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(data);
      }
      if(route.startsWith('/api/textures/')&&req.method==='GET'){
        const name=route.slice('/api/textures/'.length);if(!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(name))return send(res,{error:'Invalid texture hash'},400);
        // A browser may still hold a derived GLB from before a restart; derive
        // the accepted and staged assets again to find its images.
        let texture=textures.texture(name);
        if(!texture){for(const asset of [...Object.values(store.hashes),...Object.values(proposal?.assets||{})])await textures.glb(asset.hash).catch(()=>{});texture=textures.texture(name);}
        // Pinned terrain textures are stored as blobs under their own hash.
        if(!texture&&name.endsWith('.png'))texture=await readFile(path.join(store.root,'.holodeck/blobs',name)).then(bytes=>({bytes}),()=>null);
        if(!texture)return send(res,{error:'Unknown texture'},404);
        res.writeHead(200,{'Content-Type':TEXTURE_CONTENT_TYPES[name.split('.')[1]],'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(texture.bytes);
      }
      // Pinned terrain height samples, named by their sha256 like the GLBs.
      if(route.startsWith('/api/heights/')&&req.method==='GET'){
        const name=route.slice('/api/heights/'.length);if(!/^[a-f0-9]{64}\.r32$/.test(name))return send(res,{error:'Invalid height hash'},400);
        const data=await readFile(path.join(store.root,'.holodeck/blobs',name)).catch(()=>null);if(!data)return send(res,{error:'Unknown terrain height'},404);
        res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(data);
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
      if(route==='/api/proposal/discard'){if(proposal?.id===data.id){stage(null);emit('proposal',null);}return send(res,{ok:true});}
      if(route==='/api/observation'){
        if(!Number.isSafeInteger(data.revision)||!Array.isArray(data.position)||data.position.length!==3||data.position.some(n=>!Number.isFinite(n)))throw new Error('Invalid observation');
        observation={...data,receivedAt:new Date().toISOString()};return send(res,{ok:true});
      }
      if(route==='/api/agent/connect'){
        const provider=data.provider||agent.snapshot?.().provider||'codex';selectAgent(provider);
        const upgrade=await ensureWorkspace(root,{provider});
        await syncSkills();
        // Kiln's upgrade report (1.4.0 and 1.6.0) lists the files it rewrote in `changed`.
        const files=upgrade?.changed?.length;
        if(files)emit('notice',`Kiln workspace upgraded for the installed Kiln · ${files} Kiln-managed file${files===1?'':'s'} refreshed`);
        return send(res,await agent.connect());
      }
      if(route==='/api/agent/login')return send(res,await agent.login());
      if(route==='/api/agent/turn'||route==='/api/agent/image'){
        if(historyActive)throw new Error('Wait for the history operation to finish before starting an agent');
        if(agentStarting)throw new Error('An agent turn is already starting');
        agentStarting=true;
        try{
          if(route.endsWith('/image')){if((agent.snapshot?.().provider||'codex')!=='codex')throw new Error('Image generation stays on the Codex connection.');await ensureWorkspace(root,{provider:'codex'});return send(res,await agent.generateImage(data));}
          return send(res,await agent.startTurn({text:data.text,model:data.model,effort:data.effort,selection:data.selection,selectedRefs:data.selectedRefs}));
        }finally{agentStarting=false;}
      }
      if(route==='/api/agent/stop')return send(res,await agent.stop());
      if(route==='/api/agent/answer')return send(res,agent.answer(data));
      return send(res,{error:'Unknown route'},404);
    }catch(e){send(res,{error:e.message},e.message.includes('changed')?409:400);}
  }
  return {middleware,store,get agent(){return agent;},session:()=>scoped({...store.payload(),agent:agent.snapshot(),proposal}),switchBlockers(){const state=agent.snapshot(),reasons=[];if(agentStarting||agent.connecting||state.turnId||['starting','connecting','working','inProgress'].includes(state.status))reasons.push('Wait for the active agent operation to finish');if(state.requests?.length)reasons.push('Resolve the pending agent request');if(proposal)reasons.push('Apply or discard the pending proposal');if(historyActive||storeWork)reasons.push('Wait for the current world operation to finish');return reasons;},close(){
    if(closePromise)return closePromise;
    closing=true;clearInterval(keepalive);
    // Closing the RPC emits a final disconnect synchronously. Detach producers
    // and remove destinations before ending streams so that event cannot write
    // into an ended response during a Vite restart or normal host shutdown.
    store.off('world',onWorld);store.off('diagnostic',onDiagnostic);agent.off('agent',onAgent);stage(null);
    const responses=[...clients];clients.clear();
    for(const res of responses)if(!res.destroyed&&!res.writableEnded)res.end();
    closePromise=(async()=>{try{await codexAgent.persistQueue;codexAgent.close?.();if(cursor){await cursor.persistQueue;cursor.close?.();}if(claude){await claude.persistQueue;claude.close?.();}}finally{await skillSync.catch(()=>{});await store.close();}})();return closePromise;
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
