import {useLayoutEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {bindAssetFlow} from './asset-flow.mjs';

export function useAssetFlow({object,asset,runtime,enabled=true}){
 const config=asset?.flow,signature=JSON.stringify(config??null),binding=useRef();
 useLayoutEffect(()=>{const current=bindAssetFlow(object,enabled?config:null);binding.current=current;return()=>{current.dispose();binding.current=null;};},[object,enabled,signature]);
 useFrame(state=>binding.current?.update(runtime?.time??state.clock.elapsedTime));
}
