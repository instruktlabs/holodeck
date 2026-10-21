// Capture identity once per mounted session. An old async editor operation must
// never inherit the identity of a world opened while that operation was waiting.
export function createWorldClient(context,fetcher=fetch){
 const worldId=context?.worldId,epoch=context?.epoch;
 const scopedFetch=(path,options={})=>{
  const headers=new Headers(options.headers);
  if(worldId&&epoch){headers.set('X-Holodeck-World',worldId);headers.set('X-Holodeck-Epoch',epoch);}
  return fetcher(path,{...options,headers});
 };
 return {
  fetch:scopedFetch,
  url(path){if(!worldId||!epoch)return path;const parsed=new URL(path,'http://holodeck.local');parsed.searchParams.set('worldId',worldId);parsed.searchParams.set('epoch',epoch);return parsed.pathname+parsed.search+parsed.hash;},
  async api(route,data){const response=await scopedFetch(`/api/${route}`,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await response.json();if(!response.ok)throw new Error(value.error||'Local host request failed');return value;},
 };
}
export function worldContextKey(context){return context?.worldId&&context?.epoch?`${context.worldId}:${context.epoch}`:'opening';}

// Retry ticks share one pending request. Explicit discard remains opted in even
// when an automatic retry joins it; a new activation invalidates its response.
export function createSessionRecovery({load,accept,reject}){
 let flight=null;
 return {
  recover(options={}){
   if(flight){if(options.discardDrafts===true)flight.options.discardDrafts=true;return flight.promise;}
   const pending={options:{discardDrafts:options.discardDrafts===true},promise:null};flight=pending;
   pending.promise=Promise.resolve().then(load).then(data=>{if(flight===pending)accept(data,pending.options);},error=>{if(flight===pending)reject(error);}).finally(()=>{if(flight===pending)flight=null;});
   return pending.promise;
  },
  invalidate(){flight=null;},
 };
}
