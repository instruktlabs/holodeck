import React,{useEffect,useMemo,useRef} from 'react';
import {Vector3} from 'three/webgpu';
import {useFrame} from '@react-three/fiber';
import {createMakerModel} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';

// walkable(x,z,maxTop) lets planted feet stand on collider tops such as decks and stairs.
export function Maker({actor,firstPerson=false,terrain=null,walkable=null}){
 // The sky light probe leaves the maker out of its capture.
 const model=useMemo(()=>{const m=createMakerModel();m.root.userData.skyLightExclude=true;return m;},[]),motion=useRef(createMakerMotion()),hidden=useRef(null),eye=useMemo(()=>new Vector3(),[]);
 useEffect(()=>()=>model.dispose(),[model]);
 useFrame(({camera},seconds)=>{
  const current=actor?.current??actor;model.root.visible=!!current;if(!current)return;
  updateMakerPose(model,current,terrain,motion.current,seconds,walkable);
  // A camera inside the head sees what first person sees, not the inside of the head and
  // shawl: the free camera flown there, or a review camera fixed at the spawn's eye (H128).
  const hide=firstPerson||model.holdsEye(camera.getWorldPosition(eye));
  if(hide!==hidden.current){hidden.current=hide;model.setFirstPerson(hide);}
 });
 return <primitive object={model.root} dispose={null}/>;
}
