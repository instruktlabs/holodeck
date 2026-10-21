// A session-local registry survives editor panel unmounts. A new workspace
// session gets a new registry; dirty drafts must be resolved before switching.
export function createDraftRegistry(){
 let snapshot={};const listeners=new Set();
 const publish=(key,value)=>{snapshot={...snapshot,[key]:value};for(const listener of listeners)listener();};
 const record=(key,value,revision,meta)=>snapshot[key]??{value,base:revision,dirty:false,...meta};
 return {
  getSnapshot:()=>snapshot,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  sync(key,value,revision,meta){const old=snapshot[key];if(!old||!old.dirty&&(old.value!==value||old.base!==revision))publish(key,{value,base:revision,dirty:false,...meta});},
  edit(key,update,value,revision,meta){const old=record(key,value,revision,meta);publish(key,{...old,value:typeof update==='function'?update(old.value):update,dirty:true});},
  reset(key,value,revision,meta){publish(key,{value,base:revision,dirty:false,...meta});},
  saved(key,submitted){const current=snapshot[key];if(current?.dirty&&submitted&&current.value===submitted.value&&current.base===submitted.base)publish(key,{...current,dirty:false});},
 };
}

export function worldChangeBlockers({active=false,pendingProposal=false,busy=false,loading=false,online=true,drafts=[],message=''}={}){
 const result=[];
 if(active)result.push({id:'agent',label:'The agent is working. Finish or stop its turn first.',location:'conversation'});
 if(pendingProposal)result.push({id:'proposal',label:'Apply or discard the pending proposal first.',location:'conversation'});
 if(busy||loading)result.push({id:'busy',label:loading?'Wait for the current revision to finish loading.':'Wait for the current operation to finish.'});
 if(!online)result.push({id:'offline',label:'Reconnect to the local host before changing worlds.'});
 for(const draft of drafts)result.push({id:draft.id,label:`Save or discard your ${draft.label} draft.`,location:draft.panel,item:draft.item});
 if(message.trim())result.push({id:'message',label:'Send or clear your unsent message first.',location:'message'});
 return result;
}
