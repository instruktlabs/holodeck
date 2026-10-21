import {useEffect,useMemo} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {RenderPipeline} from 'three/webgpu';
import {pass} from 'three/tsl';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
// One scene pass and a half-resolution glow, shared by WebGPU and WebGL2.
export function CoveEffects(){
  const {gl,scene,camera}=useThree();
  const fx=useMemo(()=>{const pipeline=new RenderPipeline(gl),scenePass=pass(scene,camera),color=scenePass.getTextureNode('output'),glow=bloom(color,.13,.25,1.8);glow.setResolutionScale(.5);pipeline.outputNode=color.add(glow);return {pipeline,scenePass,glow};},[gl,scene,camera]);
  useEffect(()=>()=>{fx.pipeline.dispose();fx.scenePass.dispose();fx.glow.dispose();},[fx]);
  useFrame(()=>fx.pipeline.render(),1);return null;
}
