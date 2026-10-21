import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHost} from './host.mjs';

test('history routes preserve revisions, restrict remix destinations and refuse a live agent turn',async t=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-history-api-')),root=path.join(parent,'original');
 const state={connected:false,turnId:null,status:'ready'},agent=Object.assign(new EventEmitter(),{snapshot:()=>state,close(){}});
 const host=await createHost(root,{agentFactory:()=>agent}),server=createServer((req,res)=>host.middleware(req,res,()=>res.end()));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(parent,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],world=(await session.json()).world;
 const post=(route,data)=>fetch(base+'/api/'+route,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
 const listing=await fetch(base+'/api/history',{headers:{cookie}});assert.equal(listing.status,200);assert.equal((await listing.json()).revisions[0].revision,0);
 await post('world',{baseRevision:0,bible:{...world.bible,title:'Changed'}});
 assert.equal((await post('history/restore',{baseRevision:1,revision:0})).status,200);assert.equal(host.store.current.revision,2);assert.equal(host.store.current.bible.title,world.bible.title);
 assert.equal((await post('history/restore',{baseRevision:1,revision:0})).status,409);
 assert.equal((await post('history/remix',{baseRevision:2,revision:0,name:'../escape'})).status,400);
 state.turnId='live';assert.equal((await post('history/restore',{baseRevision:2,revision:0})).status,400);state.turnId=null;
 const remixed=await post('history/remix',{baseRevision:2,revision:0,name:'island-remix'});assert.equal(remixed.status,200);
 const saved=JSON.parse(await readFile(path.join(parent,'island-remix/world/world.json'),'utf8'));assert.equal(saved.revision,0);assert.equal(host.store.current.revision,2);
});

test('history excludes a new agent turn while restore waits on the store queue',async t=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-history-race-')),root=path.join(parent,'original');
 const state={turnId:null,status:'ready'},agent=Object.assign(new EventEmitter(),{snapshot:()=>state,close(){},async startTurn(){state.turnId='active';return {ok:true};}});
 const host=await createHost(root,{agentFactory:()=>agent}),server=createServer((req,res)=>host.middleware(req,res,()=>res.end()));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(parent,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];await session.json();
 const post=(route,data)=>fetch(base+'/api/'+route,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
 let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 const serial=host.store.serial.bind(host.store);const blocked=serial(()=>gate);host.store.serial=fn=>{entered();return serial(fn);};
 const restoring=post('history/restore',{baseRevision:0,revision:0});await started;
 let response;try{response=await post('agent/turn',{text:'Inspect the world'});}finally{release();await blocked;}
 assert.equal((await restoring).status,200);assert.equal(response.status,400);assert.match((await response.json()).error,/history/i);assert.equal(state.turnId,null);
});

test('a starting agent excludes restore until its asynchronous startup is complete',async t=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-start-race-')),root=path.join(parent,'original');
 let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 const state={turnId:null,status:'ready'},agent=Object.assign(new EventEmitter(),{snapshot:()=>state,close(){},async startTurn(){entered();await gate;state.turnId='active';return {ok:true};}});
 const host=await createHost(root,{agentFactory:()=>agent}),server=createServer((req,res)=>host.middleware(req,res,()=>res.end()));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await host.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(parent,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0];await session.json();
 const post=(route,data)=>fetch(base+'/api/'+route,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
 const starting=post('agent/turn',{text:'Inspect the world'});await started;
 let response;try{response=await post('history/restore',{baseRevision:0,revision:0});}finally{release();}
 assert.equal((await starting).status,200);assert.equal(response.status,400);assert.equal(host.store.current.revision,0);
});
