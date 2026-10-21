import {useCallback,useEffect,useRef,useSyncExternalStore} from 'react';
import {createDraftRegistry} from './world-drafts.mjs';

export function useWorldDrafts(){
 const registry=useRef(null);if(!registry.current)registry.current=createDraftRegistry();
 const snapshot=useSyncExternalStore(registry.current.subscribe,registry.current.getSnapshot);
 return {registry:registry.current,dirty:Object.entries(snapshot).filter(([,entry])=>entry.dirty).map(([id,entry])=>({id,label:entry.label,panel:entry.panel,item:entry.item}))};
}

export function useEditorDraft(registry,key,source,revision,meta){
 const snapshot=useSyncExternalStore(registry.subscribe,registry.getSnapshot),entry=snapshot[key];
 useEffect(()=>registry.sync(key,source,revision,meta),[registry,key,source,revision,entry?.dirty]);
 const change=useCallback(update=>registry.edit(key,update,source,revision,meta),[registry,key,source,revision,meta.label,meta.panel,meta.item]);
 const submitted={value:entry?.value??source,base:entry?.base??revision};
 return {draft:submitted.value,base:submitted.base,dirty:!!entry?.dirty,change,saved:()=>registry.saved(key,submitted),reset:()=>registry.reset(key,source,revision,meta)};
}

export function useDraftUnloadGuard(dirty){
 useEffect(()=>{if(!dirty)return;const prevent=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
}
