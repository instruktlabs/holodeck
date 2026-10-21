import {useLayoutEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {bindAssetFoliage} from './asset-foliage.mjs';

export function useAssetFoliage({object,asset,runtime,enabled=true}){
 const config=asset?.foliage,environment=runtime?.scene.environment??{},signature=JSON.stringify([config,environment.sunPosition,environment.sunColor,environment.sunIntensity]);
 const binding=useRef();
 useLayoutEffect(()=>{const current=bindAssetFoliage(object,enabled?config:null,environment);binding.current=current;return()=>{current.dispose();binding.current=null;};},[object,enabled,signature]);
 useFrame(state=>binding.current?.update(runtime?.time??state.clock.elapsedTime));
}
