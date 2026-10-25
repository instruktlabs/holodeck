import {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BlendMode,Color,MaterialBlending,RenderPipeline,UnsignedByteType} from 'three/webgpu';
import {convertToTexture,dot,float,mix,mrt,normalView,output,pass,renderOutput,screenCoordinate,uniform,vec2,vec4,velocity} from 'three/tsl';
import {bloom} from 'three/addons/tsl/display/BloomNode.js';
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {traa} from 'three/addons/tsl/display/TRAANode.js';
import {godrays} from 'three/addons/tsl/display/GodraysNode.js';
import {bilateralBlur} from 'three/addons/tsl/display/BilateralBlurNode.js';
import {depthAwareBlend} from 'three/addons/tsl/display/depthAwareBlend.js';
import {resolveEffects} from './effects-contract.mjs';
import {reactiveNode,translucentNode} from './reactive.mjs';
import {probe} from '../prototype/scene.jsx';
import {completeRenderFrame,resetRenderReadiness} from './render-readiness.mjs';

// The sun is the shadow-casting directional light the runtime places.
const findSun=scene=>{let sun=null;scene.traverse(o=>{if(!sun&&o.isDirectionalLight&&o.castShadow)sun=o;});return sun;};
// The display frame has 8 bits a channel, so a slow gradient such as the sky's falls into
// visible bands of one level each. Interleaved gradient noise (Jimenez 2014) at two
// offsets gives a fixed, triangular dither of up to one level, added after tone
// mapping and encoding, where the quantising happens (H110).
const gradientNoise=p=>dot(p,vec2(.06711056,.00583715)).fract().mul(52.9829189).fract();
export const ditherNode=()=>gradientNoise(screenCoordinate.xy).add(gradientNoise(screenCoordinate.xy.add(vec2(47,17)))).sub(1).div(255);
// One scene pass and a half-resolution glow, shared by WebGPU and WebGL2. A world
// may tune the glow and add screen-space passes through environment.effects (H83,
// H87): ambient occlusion from the pass's depth and normals, light shafts from
// the sun's shadow map, and temporal anti-aliasing in place of multisampling.
export function CoveEffects({effects}={}){
  const {gl,scene,camera}=useThree(),signature=JSON.stringify(effects??null),wantsSun=!!effects?.sunShafts,[sun,setSun]=useState(null);
  // The runtime's sun mounts with the scene, after this renders: look for it each
  // frame until it appears, and rebuild the pipeline with it.
  useFrame(()=>{if(wantsSun&&!sun){const found=findSun(scene);if(found)setSun(found);}});
  const fx=useMemo(()=>{
   const settings=resolveEffects(effects),pipeline=new RenderPipeline(gl),owned=[];
   const scenePass=pass(scene,camera,settings.temporalAA?{samples:0}:{});owned.push(scenePass);
   if(settings.occlusion||settings.temporalAA){
    // Per-material marks (H90, see reactive.mjs), blended by each surface's alpha so
    // the soft edges of sheets and mist cards fade in: r reactive, g translucent.
    const outputs={output,marks:vec4(reactiveNode(),translucentNode(),0,output.a)};if(settings.occlusion)outputs.normal=normalView;if(settings.temporalAA)outputs.velocity=velocity;
    const targets=mrt(outputs);targets.setBlendMode('marks',new BlendMode(MaterialBlending));targets.setClearColor('marks',0x000000,0);scenePass.setMRT(targets);scenePass.getTexture('marks').type=UnsignedByteType;
   }
   const depth=scenePass.getTextureNode('depth'),marks=settings.occlusion||settings.temporalAA?scenePass.getTextureNode('marks'):null;let color=scenePass.getTextureNode('output');
   if(settings.occlusion){
    // Half-resolution GTAO darkens creases, contact and recesses. It is applied
    // to the lit frame, so keep the intensity moderate in bright worlds.
    const occlusion=ao(depth,scenePass.getTextureNode('normal'),camera);occlusion.resolutionScale=.5;occlusion.radius.value=settings.occlusion.radius;owned.push(occlusion);
    color=color.mul(mix(float(1),occlusion.getTextureNode().r,marks.g.oneMinus().mul(settings.occlusion.intensity)));
   }
   if(settings.sunShafts&&sun){
    const shafts=godrays(depth,camera,sun);shafts.maxDensity.value=Math.min(1,.25*settings.sunShafts.intensity);owned.push(shafts);
    const soft=bilateralBlur(shafts.getTextureNode());owned.push(soft);
    // The shafts are raymarched through the sun's shadow box only, so a ray to the
    // sky would gather a uniform veil that bleaches the sky: keep them to geometry,
    // where they fall through arches and across the courts. The blend samples
    // both inputs as textures.
    const beams=convertToTexture(soft.getTextureNode().mul(depth.r.lessThan(.99999).select(1,0)));owned.push(beams);
    color=depthAwareBlend(color.isTextureNode?color:convertToTexture(color),beams,depth,camera,{blendColor:uniform(new Color().copy(sun.color).multiplyScalar(1.4))});
   }
   if(settings.temporalAA){const current=color,temporal=traa(color,depth,scenePass.getTextureNode('velocity'),camera);owned.push(temporal);color=mix(temporal,current,marks.r);}
   const {strength,radius,threshold}=settings.bloom,glow=bloom(color,strength,radius,threshold);glow.setResolutionScale(.5);owned.push(glow);
   // The pipeline still supplies the grade's tone mapping and colour space to renderOutput.
   const grain=ditherNode();pipeline.outputColorTransform=false;pipeline.outputNode=renderOutput(color.add(glow)).add(vec4(grain,grain,grain,0));
   return {pipeline,owned};
  },[gl,scene,camera,signature,sun]);
  useEffect(()=>()=>{fx.pipeline.dispose();for(const node of fx.owned)node.dispose?.();},[fx]);
  useLayoutEffect(()=>{resetRenderReadiness(gl,probe);return()=>resetRenderReadiness(gl,probe);},[gl,scene]);
  // Every render of the scene (the main pass, the water's mirror view, the sun's
  // shadow map) would walk its matrices again: update them once a frame, after
  // everything that moves has moved, and let the passes reuse them (H94).
  useEffect(()=>{const previous=scene.matrixWorldAutoUpdate;scene.matrixWorldAutoUpdate=false;return()=>{scene.matrixWorldAutoUpdate=previous;};},[scene]);
  useFrame(()=>{scene.updateMatrixWorld();fx.pipeline.render();completeRenderFrame(gl,probe);},1);return null;
}
