import React,{useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {createMakerModel} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';

export function Maker({actor,firstPerson=false,terrain=null}){
 const model=useMemo(createMakerModel,[]),motion=useRef(createMakerMotion());
 useEffect(()=>()=>model.dispose(),[model]);
 useLayoutEffect(()=>model.setFirstPerson(firstPerson),[model,firstPerson]);
 useFrame((_,seconds)=>{
  const current=actor?.current??actor;model.root.visible=!!current;if(!current)return;
  updateMakerPose(model,current,terrain,motion.current,seconds);
 });
 return <primitive object={model.root} dispose={null}/>;
}
