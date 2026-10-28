import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {bindGait,applyGait,resetGait} from './gait-rig.mjs';

// A bounded rigid joint; placement and its conservative body collider stay fixed.
export function useAssetJoint({object,item,runtime}){
 const b=item.behavior?.type==='joint'?item.behavior:null,key=JSON.stringify(b);
 const rig=useMemo(()=>b?bindGait(object,{stride:1,channels:[{node:b.node,axis:b.axis,amplitude:1,phase:0}]}):null,[object,key]);
 useEffect(()=>{
  if(!runtime||!rig)return;
  runtime.gaitDiagnostics.set(item.id,rig.diagnostics);
  return()=>{resetGait(rig);if(runtime.gaitDiagnostics.get(item.id)===rig.diagnostics)runtime.gaitDiagnostics.delete(item.id);};
 },[runtime,rig,item.id]);
 useFrame(()=>{if(runtime&&rig?.enabled)applyGait(rig,[runtime.states.get(item.id)?.angle??0]);},-.75);
}
