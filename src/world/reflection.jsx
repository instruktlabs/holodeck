import {useCallback,useLayoutEffect,useSyncExternalStore} from 'react';
import {bindAssetReflection,probeReflections,reflectionCapture,skyReflection} from './asset-reflection.mjs';

const subscribeAll=listener=>{const sky=skyReflection.subscribe(listener),probes=probeReflections.subscribe(listener);return()=>{sky();probes();};};
// The capture an asset's reflection names ('sky' or a probe point) while a sky
// light is mounted and has published it, otherwise null.
export function useReflectionCapture(reflection){
 const key=JSON.stringify(reflection??null),read=useCallback(()=>reflectionCapture(JSON.parse(key)),[key]);
 return useSyncExternalStore(subscribeAll,read,read);
}
export function useAssetReflection({object,asset,enabled=true}){
 const reflection=enabled?asset?.reflection:undefined,capture=useReflectionCapture(reflection),key=JSON.stringify(reflection??null);
 useLayoutEffect(()=>{const binding=bindAssetReflection(object,reflection,capture);return()=>binding.dispose();},[object,key,capture]);
}
