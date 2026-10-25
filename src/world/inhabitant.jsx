import React,{useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {createMakerModel} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';
import {createMakerEmoteLayer,updateMakerEmote} from './maker-emotes.mjs';

// walkable(x,z,maxTop) lets planted feet stand on collider tops such as decks and stairs.
// The emote layer plays actor.emote over the locomotion pose.
export function Maker({actor,firstPerson=false,terrain=null,walkable=null}){
 const model=useMemo(createMakerModel,[]),motion=useRef(createMakerMotion()),layer=useRef(createMakerEmoteLayer());
 useEffect(()=>()=>model.dispose(),[model]);
 useLayoutEffect(()=>model.setFirstPerson(firstPerson),[model,firstPerson]);
 useFrame((_,seconds)=>{
  const current=actor?.current??actor;model.root.visible=!!current;if(!current)return;
  updateMakerPose(model,current,terrain,motion.current,seconds,walkable);
  updateMakerEmote(model,current,layer.current,{terrain,walkable,facing:motion.current.facingYaw});
 });
 return <primitive object={model.root} dispose={null}/>;
}
