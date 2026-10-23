// One status line for the dock: what the agent is doing, and whether it needs you.
// Pure data from the host's agent snapshot; rendering lives in dock.jsx.
export const PROVIDER_NAMES={codex:'Codex',cursor:'Cursor',claude:'Claude'};
export const providerName=provider=>PROVIDER_NAMES[provider]||'Codex';
const CONNECT_NAMES={codex:'Codex',cursor:'Cursor',claude:'Claude Code'};
export const connectName=provider=>CONNECT_NAMES[provider]||'Codex';

export function agentPresence(agent={},{remembered=null}={}){
  const name=providerName(agent.provider),requests=agent.requests||[];
  if(requests.length)return {state:'needs',label:`${name} needs you`,count:requests.length};
  if(agent.turnId||['starting','connecting','working','inProgress'].includes(agent.status))return {state:'working',label:`${name} · ${agent.activity||'thinking'}`};
  if(!agent.connected){
    // After a host restart the last provider for this world is one click away.
    if(remembered?.provider)return {state:'disconnected',label:`${connectName(remembered.provider)} is not connected`,reconnect:remembered.provider};
    return {state:'disconnected',label:'No agent connected'};
  }
  if(agent.status==='interrupted')return {state:'stopped',label:`${name} · stopped`,detail:'Send a message to continue; the session keeps its context.'};
  return {state:'idle',label:`${name} · ready`};
}

// The last provider and choice connected in each world, kept in this browser.
const lastKey=worldId=>`holodeck.last-agent.${worldId}`;
export function readLastAgent(storage,worldId){
  if(!worldId)return null;
  try{const value=JSON.parse(storage.getItem(lastKey(worldId)));return value?.provider?value:null;}catch{return null;}
}
export function writeLastAgent(storage,worldId,value){
  if(!worldId||!value?.provider)return;
  try{storage.setItem(lastKey(worldId),JSON.stringify({provider:value.provider,model:value.model||'',effort:value.effort||''}));}catch{/* Storage may be unavailable; reconnect stays manual. */}
}

// Exact, versioned model IDs are listed apart from moving aliases such as "opus".
export const isExactModel=model=>/\d/.test(String(model||''))&&/[-.]/.test(String(model||''));
export function modelGroups(models=[]){
  const aliases=models.filter(m=>!isExactModel(m.model)),exact=models.filter(m=>isExactModel(m.model));
  return [{label:'Aliases',models:aliases},{label:'Exact model IDs',models:exact}].filter(g=>g.models.length);
}
