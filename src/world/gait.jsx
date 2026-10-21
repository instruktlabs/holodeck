import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {createGaitState,stepGaitState,gaitAngles} from './gait.mjs';
import {bindGait,applyGait,resetGait} from './gait-rig.mjs';

export function useAssetGait({object,item,runtime,scaleX=1}){
 const gait=item.behavior?.type==='patrol'?item.behavior.gait:null,key=JSON.stringify(gait);
 const rig=useMemo(()=>gait?bindGait(object,gait):null,[object,key]);
 const state=useMemo(createGaitState,[rig,runtime]);
 useEffect(()=>{
  if(!runtime||!rig)return;
  runtime.gaitDiagnostics??=new Map();
  runtime.gaitDiagnostics.set(item.id,rig.diagnostics);
  if(rig.diagnostics.length)console.warn(`Articulation disabled for ${item.id}: ${rig.diagnostics.join(' ')}`);
  return()=>{resetGait(rig);if(runtime.gaitDiagnostics.get(item.id)===rig.diagnostics)runtime.gaitDiagnostics.delete(item.id);};
 },[runtime,rig,item.id]);
 useFrame(()=>{
  if(!runtime||!rig?.enabled)return;
  const motion=runtime.renderMotion?.(item)??runtime.states.get(item.id);if(!motion)return;
  stepGaitState(state,motion,runtime.time,item.behavior.speed,runtime.visible(item));
  applyGait(rig,gaitAngles(gait,motion.distance,scaleX,state.weight));
 },-.75);
}
