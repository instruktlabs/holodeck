// Development page for reviewing the Maker's motion: the real controller and pose
// solver on a small synthetic beach and lagoon, driven by scripted input and
// viewed from fixed review cameras. Not part of the production build.
import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {ACESFilmicToneMapping,WebGPURenderer} from 'three/webgpu';
import {Landscape,LandscapeSky} from './landscape.jsx';
import {createTerrain} from './terrain.mjs';
import {createInhabitant,stepInhabitant} from './inhabitant.mjs';
import {firstPersonEyePosition,createFollowCamera,stepFollowCamera} from './inhabit.mjs';
import {createMakerModel} from './maker-model.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';
import {configureSunShadow} from './sun-shadow.mjs';
import {enableParallelCompile} from './parallel-compile.js';

const terrain={type:'heightfield',bounds:[-40,40,-40,40],segments:[200,200],baseHeight:.6,stamps:[
 {id:'lagoon',center:[30,0],radius:[30,90],height:-5.4,operation:'add',plateau:.4,falloff:2},
 {id:'dune',center:[-16,-12],radius:[7,7],height:1.5,operation:'add',plateau:.15,falloff:2},
 {id:'shelf',center:[-12,12],radius:[5,3],height:.5,operation:'add',plateau:.6,falloff:4},
],appearance:{sandColor:'#d8c49a',wetSandColor:'#9f9173',grassColor:'#738150',rockColor:'#929087',grassStart:1.8,grassEnd:3.6,rockSlope:.72,textureScale:1}};
const water={type:'ocean',bounds:[-40,40,-40,40],level:0,waves:[{direction:[.6,.8],amplitude:.05,wavelength:14,speed:2.4,phase:0},{direction:[.95,-.31225],amplitude:.03,wavelength:9,speed:2,phase:1.3}],color:'#0b4a7c',shallowColor:'#4fd2cf',foamWidth:.6};
const environment={type:'construct',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3,sunPosition:[-44.15,88.29,-15.97],fogNear:80,fogFar:400,sky:{zenithColor:'#1e5eba',horizonColor:'#b0cfea',clouds:{coverage:.3,density:.55,drift:[.6,.45]}}};
const lattice=createTerrain(terrain);
const runtime={terrain:lattice,time:0,scene:{water,runtime:{spawn:[-6,2.4,0],look:[-Math.PI/2,0],possession:{preset:'maker',camera:'third'}}}};
// Optional box colliders with walkable tops, {x:[min,max],z:[min,max],top}, for steps and crates.
let boxes=[];
const walkable=(x,z,maxTop)=>{let best=null;for(const b of boxes)if(x>=b.x[0]&&x<=b.x[1]&&z>=b.z[0]&&z<=b.z[1]&&b.top<=maxTop&&b.top>(best?.height??-Infinity))best={height:b.top,id:'box'};return best;};
const blocked=(x,z,radius,feetY,height,ignore,stepUp=0)=>boxes.some(b=>x+radius>b.x[0]&&x-radius<b.x[1]&&z+radius>b.z[0]&&z-radius<b.z[1]&&b.top>feetY+stepUp+1e-6&&feetY<b.top);
runtime.walkableAt=walkable;
const context={terrain:lattice,water,get time(){return runtime.time;},walkable,blocked:(x,z,feetY,height,stepUp)=>blocked(x,z,.22,feetY,height,null,stepUp)};
const DT=1/60;

// window.makerLab: reset({position,yaw,camera,boxes,height}), play([{seconds,input}],{auto}),
// advance(seconds) for deterministic stepping, and camera({mode:'orbit'|'follow'|'first'|'fixed',...}).
const lab={
 actor:null,motion:createMakerMotion(),follow:createFollowCamera(),model:null,script:[],cursor:0,elapsed:0,playing:true,auto:true,
 view:{mode:'orbit',azimuth:Math.PI/2,elevation:.12,distance:3.2,height:.95,relative:true,yaw:-Math.PI/2,pitch:-.12},
 reset({position=[-6,0],yaw=-Math.PI/2,camera='third',boxes:next=[],height=.68}={}){
  boxes=next.map(b=>({...b}));lab.onBoxes?.(boxes);lab.follow=createFollowCamera();
  runtime.scene.runtime.spawn=[position[0],height+1.72,position[1]];runtime.scene.runtime.look=[yaw,0];runtime.scene.runtime.possession.camera=camera;
  lab.actor=createInhabitant(runtime);lab.actor.camera=camera;lab.motion=createMakerMotion();lab.script=[];lab.cursor=0;lab.elapsed=0;
  updateMakerPose(lab.model,lab.actor,lattice,lab.motion,0,walkable);return lab.state();
 },
 // [{seconds, input}] segments, input as stepInhabitant receives it.
 play(script,{auto=true}={}){lab.script=script.map(s=>({seconds:s.seconds,input:{...s.input}}));lab.cursor=0;lab.elapsed=0;lab.auto=auto;lab.playing=true;return lab.state();},
 input(){let t=lab.elapsed;for(const s of lab.script){if(t<s.seconds)return s.input;t-=s.seconds;}return lab.script.at(-1)?.input??{};},
 tick(){
  const a=lab.actor;stepInhabitant(a,lab.input(),DT,context);runtime.time+=DT;lab.elapsed+=DT;updateMakerPose(lab.model,a,lattice,lab.motion,DT,walkable);
  // The runtime's own follow camera, behind the walker's look and stepped with it.
  stepFollowCamera(lab.follow,{eye:[a.position[0],a.position[1]+a.eyeHeight,a.position[2]],yaw:a.yaw,pitch:lab.view.pitch,...a.config.thirdPerson,ground:(x,z)=>lattice.sample(x,z),blocked:(x,z,r,y,h)=>blocked(x,z,r,y,h)},DT);
 },
 advance(seconds){const n=Math.round(seconds/DT);for(let i=0;i<n;i++)lab.tick();return lab.state();},
 camera(view){Object.assign(lab.view,view);lab.model.setFirstPerson(lab.view.mode==='first');return lab.view;},
 state(){const a=lab.actor;return {position:[...a.position],mode:a.mode,speed:a.speed,depth:a.waterDepth,surface:a.surfaceHeight,yaw:a.yaw,facing:lab.motion.facingYaw,elapsed:lab.elapsed};},
};
window.makerLab=lab;

function Rig(){
 const {camera}=useThree(),light=useRef(),target=useMemo(()=>new THREE.Object3D(),[]);
 const model=useMemo(()=>{const m=createMakerModel();lab.model=m;lab.reset();return m;},[]);
 useLayoutEffect(()=>{configureSunShadow(light.current);light.current.target=target;},[target]);
 useFrame((_,seconds)=>{
  if(lab.auto&&lab.playing){lab.accumulator=(lab.accumulator??0)+Math.min(seconds,.1);while(lab.accumulator>=DT){lab.tick();lab.accumulator-=DT;}}
  const a=lab.actor,v=lab.view,p=new THREE.Vector3(...a.position);
  target.position.copy(p);light.current.position.copy(p).add(new THREE.Vector3(...environment.sunPosition).normalize().multiplyScalar(40));target.updateMatrixWorld();
  if(v.mode==='first'){
   const eye=firstPersonEyePosition(a.position,a.eyeHeight,v.yaw,v.pitch);camera.position.set(...eye);camera.rotation.set(v.pitch,v.yaw,0,'YXZ');
  }else if(v.mode==='fixed'){
   camera.position.set(...v.position);camera.lookAt(...v.target);
  }else if(v.mode==='follow'&&lab.follow.pivot){
   camera.position.set(...lab.follow.position);camera.lookAt(...lab.follow.focus);
  }else{
   const azimuth=v.azimuth+(v.relative?lab.motion.facingYaw:0),focus=p.clone().add(new THREE.Vector3(0,v.height,0));
   camera.position.set(focus.x+Math.sin(azimuth)*Math.cos(v.elevation)*v.distance,focus.y+Math.sin(v.elevation)*v.distance,focus.z+Math.cos(azimuth)*Math.cos(v.elevation)*v.distance);camera.lookAt(focus);
  }
  const hud=document.getElementById('hud');if(hud){const s=lab.state();hud.textContent=`${s.mode}  ${s.speed.toFixed(2)} m/s  depth ${(s.depth??0).toFixed(2)}  t ${s.elapsed.toFixed(2)}`;}
 });
 return <>
  <Boxes/>
  <primitive object={model.root} dispose={null}/>
  <primitive object={target}/>
  <directionalLight ref={light} color={environment.sunColor} intensity={environment.sunIntensity} castShadow/>
 </>;
}

function Boxes(){
 const [list,setList]=useState(boxes);useLayoutEffect(()=>{lab.onBoxes=next=>setList([...next]);return()=>{lab.onBoxes=null;};},[]);
 return list.map((b,i)=>{const ground=lattice.sample((b.x[0]+b.x[1])/2,(b.z[0]+b.z[1])/2).height,h=b.top-ground+.4;
  return <mesh key={i} position={[(b.x[0]+b.x[1])/2,b.top-h/2,(b.z[0]+b.z[1])/2]} castShadow receiveShadow><boxGeometry args={[b.x[1]-b.x[0],h,b.z[1]-b.z[0]]}/><meshStandardMaterial color="#9a8f7d" roughness={.8}/></mesh>;});
}

function Lab(){
 const forcedGL=new URLSearchParams(location.search).get('backend')==='webgl';
 return <Canvas shadows dpr={[1,1.5]} camera={{fov:50,near:.03,far:2000}} gl={async props=>{const r=new WebGPURenderer({...props,forceWebGL:forcedGL,antialias:true});r.toneMapping=ACESFilmicToneMapping;r.toneMappingExposure=1.12;await r.init();enableParallelCompile(r);window.makerLab.renderer=r;window.makerLab.backend=r.backend.isWebGPUBackend?'WebGPU':'WebGL2';window.makerLab.ready=true;return r;}}>
  <color attach="background" args={[environment.fogColor]}/><fog attach="fog" args={[environment.fogColor,environment.fogNear,environment.fogFar]}/>
  <hemisphereLight args={['#f1eee2','#95806d',1.8]}/>
  <Landscape terrain={terrain} water={water} environment={environment} runtime={runtime} placements={[]}/>
  <LandscapeSky environment={environment} runtime={runtime}/>
  <Rig/>
 </Canvas>;
}
createRoot(document.getElementById('root')).render(<Lab/>);
