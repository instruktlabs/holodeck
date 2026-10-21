import {randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import {WorldLibrary,worldName} from './world-library.mjs';
import {createHost} from './host.mjs';

const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
function conflict(message){return Object.assign(new Error(message),{status:409});}
async function readJson(req){if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('JSON content type required'),{status:415});let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16*1024)throw new Error('Library request is too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
// The library owns activation. Individual hosts retain immutable roots, stores,
// observations and agents. No native agent process is reused across workspaces.
export async function createLibraryHost(initialRoot,{libraryRoot=path.dirname(path.resolve(initialRoot)),hostFactory=createHost,agentFactory,ensureWorkspace,libraryOptions}={}){
 const library=await WorldLibrary.open(libraryRoot,libraryOptions),initialId=await library.register(initialRoot),token=randomBytes(32).toString('hex');
 let context={worldId:initialId,epoch:randomUUID()},active=await hostFactory(await library.resolve(initialId),{context,token,agentFactory,ensureWorkspace}),switching=false,closing=false,closePromise,requests=0;const pending=new Set();
 const info=async()=>({worlds:await library.list(),currentId:context.worldId,templates:await library.templates()});
 const session=async()=>({...active.session(),context,library:await info()});
 const assertContext=(req,url)=>{const worldId=req.headers['x-holodeck-world']??url.searchParams.get('worldId'),epoch=req.headers['x-holodeck-epoch']??url.searchParams.get('epoch');if(worldId!==context.worldId||epoch!==context.epoch)throw conflict('The active world changed; reopen the session before continuing');};
 function assertIdle(){if(switching||requests)throw conflict('Wait for the current world request to finish');const blockers=active.switchBlockers();if(blockers.length)throw conflict(blockers.join('. '));}
 async function activate(id){if(id===context.worldId)return;const root=await library.resolve(id),nextContext={worldId:id,epoch:randomUUID()},candidate=await hostFactory(root,{context:nextContext,token,agentFactory,ensureWorkspace});const previous=active;try{await previous.close();}catch(e){await candidate.close();throw e;}active=candidate;context=nextContext;}
 async function libraryMutation(route,req,res){assertIdle();switching=true;try{const data=await readJson(req);if(route==='/api/library/open'){if(typeof data.id!=='string')throw new Error('Choose a world ID from the library');await activate(data.id);}else if(route==='/api/library/create'){const created=await library.create({name:data.name,templateId:data.templateId??'construct'});await activate(created.id);}else if(route==='/api/library/rename'){if(data.baseRevision!==active.store.current.revision)throw conflict('World changed; refresh before renaming');await active.store.commit({baseRevision:data.baseRevision,bible:{...active.store.current.bible,title:worldName(data.name)}});}else throw new Error('Unknown library route');return json(res,await session());}finally{switching=false;}}
 async function handle(req,res,next){if(!req.url?.startsWith('/api/'))return next();if(closing)return json(res,{error:'Host is closing; reconnect to continue'},503);try{
  const host=req.headers.host,allowed=new Set([`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`]);if(!allowed.has(host)||req.headers.origin&&req.headers.origin!==`http://${host}`||req.headers['sec-fetch-site']==='cross-site')return json(res,{error:'Local same-origin access required'},403);
  const url=new URL(req.url,`http://${host}`),route=url.pathname;
  if(route==='/api/session'&&req.method==='GET'){if(switching)throw conflict('World activation is in progress; retry the session');requests++;try{res.setHeader('Set-Cookie',`holodeck_${req.socket.localPort}=${token}; HttpOnly; SameSite=Strict; Path=/api`);return json(res,await session());}finally{requests--;}}
  if(!req.headers.cookie?.split(';').some(c=>c.trim()===`holodeck_${req.socket.localPort}=${token}`))return json(res,{error:'Open a Holodeck session first'},401);
  assertContext(req,url);if(switching)throw conflict('World activation is in progress; retry the session');
  if(route.startsWith('/api/library/')&&req.method==='POST')return await libraryMutation(route,req,res);
  if(route==='/api/library'&&req.method==='GET'){requests++;try{return json(res,await info());}finally{requests--;}}
  // Count admission before reading bytes or awaiting work. An upload or delayed
  // agent connection cannot race a switch into another host's root.
  const stream=route==='/api/events'&&req.method==='GET';if(!stream)requests++;const owner=active;try{return await owner.middleware(req,res,next);}finally{if(!stream)requests--;}
 }catch(e){if(!res.headersSent)json(res,{error:e.message},e.status??400);else if(!res.writableEnded)res.end();}}
 return {library,get active(){return active;},get context(){return {...context};},middleware(req,res,next){const work=handle(req,res,next);pending.add(work);work.finally(()=>pending.delete(work)).catch(()=>{});return work;},close(){if(closePromise)return closePromise;closing=true;closePromise=(async()=>{await Promise.allSettled([...pending]);await active.close();})();return closePromise;}};
}
