import {useCallback,useEffect,useLayoutEffect,useState,useSyncExternalStore} from 'react';
import {useFrame} from '@react-three/fiber';
import {bindAssetReflection,probeReflections,reflectionCapture,skyReflection} from './asset-reflection.mjs';
import {stepLiveReflections,watchLiveReflection} from './live-reflection.mjs';

const subscribeAll=listener=>{const sky=skyReflection.subscribe(listener),probes=probeReflections.subscribe(listener);return()=>{sky();probes();};};
// The capture an asset's reflection names ('sky' or a probe point) while a sky
// light is mounted and has published it, otherwise null.
export function useReflectionCapture(reflection){
 const key=JSON.stringify(reflection??null),read=useCallback(()=>reflectionCapture(JSON.parse(key)),[key]);
 return useSyncExternalStore(subscribeAll,read,read);
}
// A 'live' placement (H130, live-reflection.mjs) reflects the sky light's capture until the
// first cube of its own lands.
export function useAssetReflection({object,asset,enabled=true}){
 const reflection=enabled?asset?.reflection:undefined,live=reflection==='live',fallback=useReflectionCapture(live?'sky':reflection),key=JSON.stringify(reflection??null);
 const [own,setOwn]=useState(null);
 useEffect(()=>{if(!live)return;const watch=watchLiveReflection(object,setOwn);return()=>{watch.dispose();setOwn(null);};},[object,live]);
 useFrame(state=>{if(live)stepLiveReflections(state);});
 const capture=live?own??fallback:fallback;
 useLayoutEffect(()=>{const binding=bindAssetReflection(object,reflection,capture);return()=>binding.dispose();},[object,key,capture]);
}
