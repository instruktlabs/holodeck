import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldClient,worldContextKey,createSessionRecovery} from './world-client.mjs';
test('every world request captures its original identity across later activation',async()=>{
 const calls=[],context={worldId:'first',epoch:'e1'},fetcher=async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({ok:true})};};
 const first=createWorldClient(context,fetcher);context.worldId='second';context.epoch='e2';
 await first.api('history');await first.api('world',{baseRevision:1});await first.fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'bytes'});
 for(const call of calls){assert.equal(call.options.headers.get('X-Holodeck-World'),'first');assert.equal(call.options.headers.get('X-Holodeck-Epoch'),'e1');}
 assert.equal(calls[2].options.headers.get('Content-Type'),'application/octet-stream');
 assert.equal(first.url('/api/references/a.png?size=2'),'/api/references/a.png?size=2&worldId=first&epoch=e1');
 assert.notEqual(worldContextKey(context),worldContextKey({worldId:'second',epoch:'e3'}));
});
test('recovery session is unscoped and failed requests expose host diagnostics',async()=>{
 let headers;const client=createWorldClient(null,async(path,options)=>{headers=options.headers;return {ok:false,json:async()=>({error:'World changed. Refresh.'})};});
 await assert.rejects(client.api('session'),/World changed/);assert.equal(headers.has('X-Holodeck-World'),false);
 assert.equal(client.url('/api/references/a.png'),'/api/references/a.png');
});

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('slow session recovery remains one flight across automatic retry ticks',async()=>{
 const reply=deferred(),accepted=[];let calls=0;
 const recovery=createSessionRecovery({load:()=>{calls++;return reply.promise;},accept:data=>accepted.push(data),reject:assert.fail});
 const first=recovery.recover(),retry=recovery.recover(),laterRetry=recovery.recover();
 await Promise.resolve();assert.equal(calls,1);assert.equal(retry,first);assert.equal(laterRetry,first);
 reply.resolve({context:{worldId:'island',epoch:'new'}});await first;
 assert.deepEqual(accepted,[{context:{worldId:'island',epoch:'new'}}]);
});
test('explicit discard joins pending recovery and survives subsequent automatic retries',async()=>{
 const reply=deferred(),accepted=[];
 const recovery=createSessionRecovery({load:()=>reply.promise,accept:(data,options)=>accepted.push({data,options}),reject:assert.fail});
 const pending=recovery.recover();recovery.recover({discardDrafts:true});recovery.recover();
 reply.resolve('current session');await pending;
 assert.deepEqual(accepted,[{data:'current session',options:{discardDrafts:true}}]);
});
test('adoption or unmount invalidates old recovery without invalidating its replacement',async()=>{
 const replies=[deferred(),deferred()],accepted=[];let calls=0;
 const recovery=createSessionRecovery({load:()=>replies[calls++].promise,accept:data=>accepted.push(data),reject:assert.fail});
 const old=recovery.recover();await Promise.resolve();recovery.invalidate();
 const current=recovery.recover();await Promise.resolve();
 replies[0].resolve('old world');await old;assert.deepEqual(accepted,[]);
 assert.equal(recovery.recover(),current);
 replies[1].resolve('current world');await current;assert.deepEqual(accepted,['current world']);
});
test('failed recovery permits a later attempt without clearing the displayed session',async()=>{
 const replies=[deferred(),deferred()],errors=[];let calls=0,displayed='accepted world';
 const recovery=createSessionRecovery({load:()=>replies[calls++].promise,accept:data=>{displayed=data;},reject:error=>errors.push(error.message)});
 const first=recovery.recover();await Promise.resolve();replies[0].reject(new Error('temporarily unavailable'));await first;
 assert.equal(displayed,'accepted world');assert.deepEqual(errors,['temporarily unavailable']);
 const retry=recovery.recover();await Promise.resolve();replies[1].resolve('current world');await retry;
 assert.equal(calls,2);assert.equal(displayed,'current world');
});
