import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {createStaticAssetBatch} from './static-batches.mjs';
import {worldHitTarget} from './aim.mjs';

export function StaticAssetBatch({batch,model,asset,runtime,select}){
 const host=useRef(),current=useRef(),environment=runtime.scene.environment;
 const signature=JSON.stringify([asset?.foliage,environment.sunPosition,environment.sunColor,environment.sunIntensity]);
 // Construct and release derived GPU ownership in the effect so StrictMode
 // cleanup/replay cannot dispose a useMemo resource that remains mounted.
 useLayoutEffect(()=>{
  const built=createStaticAssetBatch(model.scene,batch.items,{foliage:asset?.foliage,environment});current.current=built;host.current.add(built.root);
  return()=>{built.root.removeFromParent();built.dispose();current.current=null;};
 },[model,batch,signature]);
 useFrame(()=>{if(host.current)host.current.visible=batch.layer!=='origin'||runtime.originVisible;current.current?.update(runtime.time);},-.75);
 const onClick=useMemo(()=>e=>{const id=worldHitTarget(e);if(id){e.stopPropagation();select(id,{additive:e.shiftKey});}},[select]);
 return <group ref={host} visible={batch.layer!=='origin'||runtime.originVisible} onClick={onClick}/>;
}
