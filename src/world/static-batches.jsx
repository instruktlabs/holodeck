import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {createStaticAssetBatch} from './static-batches.mjs';
import {createMergedMesh} from './static-merge.mjs';
import {worldHitTarget} from './aim.mjs';
import {useReflectionCapture} from './reflection.jsx';

export function StaticAssetBatch({batch,model,asset,runtime,select,skip=null}){
 const host=useRef(),current=useRef(),environment=runtime.scene.environment,sky=useReflectionCapture(asset?.reflection);
 const signature=JSON.stringify([asset?.foliage,asset?.flow,asset?.reflection,environment.sunPosition,environment.sunColor,environment.sunIntensity]);
 // Construct and release derived GPU ownership in the effect so StrictMode
 // cleanup/replay cannot dispose a useMemo resource that remains mounted.
 useLayoutEffect(()=>{
  const built=createStaticAssetBatch(model.scene,batch.items,{foliage:asset?.foliage,flow:asset?.flow,reflection:asset?.reflection,sky,environment,skip});current.current=built;host.current.add(built.root);
  return()=>{built.root.removeFromParent();built.dispose();current.current=null;};
 },[model,batch,signature,sky,skip]);
 useFrame(({camera})=>{if(host.current)host.current.visible=batch.layer!=='origin'||runtime.originVisible;current.current?.update(runtime.time);current.current?.sort(camera);},-.75);
 const onClick=useMemo(()=>e=>{const id=worldHitTarget(e);if(id){e.stopPropagation();select(id,{additive:e.shiftKey});}},[select]);
 return <group ref={host} visible={batch.layer!=='origin'||runtime.originVisible} onClick={onClick}/>;
}
// Static pieces of several assets in one shared material, baked into one mesh (H100).
export function StaticMergedMesh({bucket,runtime,select}){
 const host=useRef();
 useLayoutEffect(()=>{const mesh=createMergedMesh(bucket);host.current.add(mesh);return()=>{mesh.removeFromParent();mesh.geometry.dispose();};},[bucket]);
 useFrame(()=>{if(host.current)host.current.visible=bucket.layer!=='origin'||runtime.originVisible;},-.75);
 const onClick=useMemo(()=>e=>{const id=worldHitTarget(e);if(id){e.stopPropagation();select(id,{additive:e.shiftKey});}},[select]);
 return <group ref={host} visible={bucket.layer!=='origin'||runtime.originVisible} onClick={onClick}/>;
}
