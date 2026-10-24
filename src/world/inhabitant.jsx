import React,{useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {createMakerModel} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';

// walkable(x,z,maxTop) lets planted feet stand on collider tops such as decks and stairs.
export function Maker({actor,firstPerson=false,terrain=null,walkable=null}){
 const model=useMemo(createMakerModel,[]),motion=useRef(createMakerMotion());
 useEffect(()=>()=>model.dispose(),[model]);
 useLayoutEffect(()=>model.setFirstPerson(firstPerson),[model,firstPerson]);
 useFrame((_,seconds)=>{
  const current=actor?.current??actor;model.root.visible=!!current;if(!current)return;
  updateMakerPose(model,current,terrain,motion.current,seconds,walkable);
 });
 return <primitive object={model.root} dispose={null}/>;
}
