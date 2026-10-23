import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {createWorldClient,worldContextKey,createSessionRecovery} from './world-client.mjs';
import {loadTerrainTextures} from './terrain-textures.js';
export const WorldClientContext=createContext(null);
export function useWorldClient(){const context=useContext(WorldClientContext);return useMemo(()=>createWorldClient(context),[context?.worldId,context?.epoch]);}
export const api=createWorldClient(null).api;
const cache=new Map();
function disposeGLTF(gltf){
  const resources=new Set();gltf.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[])){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
  for(const r of resources)r.dispose();
}
// Hosts serve GLB images from /api/textures; those fetches carry the same
// world context as the GLB URL's query.
function loader(url){
  const loader=new GLTFLoader(),query=new URL(url,location.href).searchParams,worldId=query.get('worldId'),epoch=query.get('epoch');
  if(worldId&&epoch)loader.setRequestHeader({'X-Holodeck-World':worldId,'X-Holodeck-Epoch':epoch});
  return loader;
}
function acquire(url){
  let entry=cache.get(url);if(!entry){entry={refs:0,promise:loader(url).loadAsync(url)};cache.set(url,entry);entry.promise.then(g=>{entry.gltf=g;}).catch(()=>{});}entry.refs++;
  return {promise:entry.promise,release(){if(--entry.refs===0){cache.delete(url);entry.promise.then(disposeGLTF).catch(()=>{});}}};
}
export function useAssetBundle(payload){
  const [bundle,setBundle]=useState(null),[error,setError]=useState(null),sequence=useRef(0),[loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!payload)return;const seq=++sequence.current,held=[];let adopted=false;setLoading(true);setError(null);
    Promise.all([Promise.all(Object.entries(payload.assets).map(async([id,asset])=>{const h=acquire(asset.url);held.push(h);return [id,await h.promise];})),loadTerrainTextures(payload.textures)]).then(([entries,textures])=>{
      if(seq!==sequence.current)return;adopted=true;setBundle({payload,models:Object.fromEntries(entries),textures,release:()=>held.forEach(h=>h.release())});setLoading(false);
    }).catch(e=>{if(seq===sequence.current){setError(e.message);setLoading(false);}}).finally(()=>{if(!adopted)held.splice(0).forEach(h=>h.release());});
    return()=>{sequence.current++;};
  },[payload]);
  useEffect(()=>()=>bundle?.release(),[bundle]);
  return {bundle,error,loading};
}
export function useWorld(){
 const [payload,setPayload]=useState(null),[agent,setAgent]=useState({connected:false,status:'disconnected',models:[],messages:[],requests:[]}),[proposal,setProposal]=useState(null),[error,setError]=useState(null),[online,setOnline]=useState(false),[connection,setConnection]=useState(0),[pendingSession,setPendingSession]=useState(null),[notice,setNotice]=useState(null),identity=useRef('opening'),recovery=useRef(null),draftGuard=useRef(()=>false);
 const adoptSession=useCallback((data,{discardDrafts=false}={})=>{
  recovery.current?.invalidate();
  if(!discardDrafts&&identity.current!=='opening'&&worldContextKey(data.context)!==identity.current&&draftGuard.current()){setPendingSession(data);setOnline(false);return;}
  identity.current=worldContextKey(data.context);setPendingSession(null);setPayload(old=>worldContextKey(old?.context)===identity.current&&old?.world.revision>=data.world.revision?{...old,library:data.library??old.library}:data);if(data.agent)setAgent(data.agent);if('proposal' in data)setProposal(data.proposal);setError(data.diagnostic??null);setOnline(true);setConnection(value=>value+1);
 },[]);
 const sessionRecovery=useMemo(()=>createSessionRecovery({load:()=>api('session'),accept:adoptSession,reject:error=>{setError(error.message);setOnline(false);}}),[adoptSession]);recovery.current=sessionRecovery;const recover=sessionRecovery.recover;
 useEffect(()=>{recover();return sessionRecovery.invalidate;},[recover,sessionRecovery]);
 const key=worldContextKey(payload?.context);
 useEffect(()=>{
  if(!payload?.context)return;const context=payload.context,client=createWorldClient(context);let disposed=false;
  const valid=()=>!disposed&&identity.current===key;
  const events=new EventSource(client.url('/api/events'));
  events.addEventListener('world',event=>{if(!valid())return;const data=JSON.parse(event.data);if(worldContextKey(data.context)!==key)return;setPayload(old=>old?.world.revision>=data.world.revision?old:{...old,...data});setError(data.diagnostic??null);});
  events.addEventListener('agent',event=>{if(valid())setAgent(JSON.parse(event.data));});
  events.addEventListener('proposal',event=>{if(valid())setProposal(JSON.parse(event.data));});
  events.addEventListener('diagnostic',event=>{if(valid())setError(JSON.parse(event.data));});
  events.addEventListener('notice',event=>{if(valid())setNotice({text:JSON.parse(event.data)});});
  events.onopen=()=>{if(valid())setOnline(true);};events.onerror=()=>{events.close();if(valid())setOnline(false);};
  return()=>{disposed=true;events.close();};
 },[key,connection]);
 useEffect(()=>{if(online)return;const retry=setInterval(()=>recover(),2000);return()=>clearInterval(retry);},[online,recover]);
 return {payload,agent,proposal,error,setError,notice,online,adoptSession,pendingSession,draftGuard,reconnect:recover};
}
