import React,{useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {createFlockRenderData,updateFlockRenderData} from './flock-renderer.mjs';
export function FlockAsset({model,item,runtime,select}){
 const key=JSON.stringify([item.behavior,item.scale,item.rotation]),data=useMemo(()=>createFlockRenderData(model.scene,item),[model,key,item.id]);
 useEffect(()=>{
  runtime.gaitDiagnostics.set(item.id,data.diagnostics);
  if(data.diagnostics.length)console.warn(`Flock ${item.id}: ${data.diagnostics.join(' ')}`);
  return()=>{if(runtime.gaitDiagnostics.get(item.id)===data.diagnostics)runtime.gaitDiagnostics.delete(item.id);data.dispose();};
 },[data,runtime,item.id]);
 useFrame(()=>{const state=runtime.states.get(item.id);data.group.visible=runtime.visible(item);if(state)updateFlockRenderData(data,state,item,state.running?runtime.accumulator*60:1);},-1);
 return <primitive object={data.group} dispose={null} onClick={event=>{event.stopPropagation();select(item.id,{additive:event.shiftKey});}}/>;
}
