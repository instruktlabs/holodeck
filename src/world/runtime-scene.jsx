import React,{useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import ClientExtension,* as clientExtension from '@holodeck/client-extension';
// An extension that draws its own first-person hands hides the whole maker in first person.
const hideBodyInFirstPerson=clientExtension.firstPersonBody==='hidden';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {Cove,PlacedAsset,Construct,probe} from '../prototype/scene.jsx';
import {MoodBoard} from './moodboard.jsx';
import {resolveWorldKey,createFreeCamera,stepFreeCamera,isWorldInputTarget,stepCameraLook,firstPersonEyePosition,createFollowCamera,resetFollowCamera,stepFollowCamera} from './inhabit.mjs';
import {touchDown,touchMove,touchUp,resetTouch,stickAxes} from './touch-input.mjs';
import {WorldMaterialsProvider,WorldSurfaceMaterial} from './world-materials.js';
import {Tree} from './vegetation.jsx';
import {Landscape,LandscapeSky,createUnderwaterTint} from './landscape.jsx';
import {underwaterAssets} from './water-optics.mjs';
import {createInhabitant,stepInhabitant,inhabitantContext} from './inhabitant.mjs';
import {Maker} from './inhabitant.jsx';
import {requestEmote,chooseSeat} from './emotes.mjs';
import {createEmoteInput,openWheel,closeWheel,moveWheel,stepWheel,playSlot,takeEmoteRequest} from './emote-wheel.mjs';
import {pickWorldAim} from './aim.mjs';
import {planStaticBatches} from './static-batches.mjs';
import {viewFar} from './runtime.mjs';
import {placedObjects} from './scatter.mjs';
import {StaticAssetBatch,StaticMergedMesh} from './static-batches.jsx';
import {shareMaterials} from './material-share.mjs';
import {planStaticMerge} from './static-merge.mjs';
import {FlockAsset} from './flock.jsx';
import {configureSunShadow,scheduleSunShadow,shadowViewFocus,stableShadowFocus,stableShadowKeys,sunShadowConfig} from './sun-shadow.mjs';
import {resolveGrade} from './grade.mjs';
import {applySceneExposure,resolveLighting} from './lighting.mjs';

function Shape({shape,id,castShadow=true}){
 if(shape.type==='tree')return <group position={shape.offset}><Tree size={shape.size} color={shape.color} seed={id}/></group>;
 return <mesh position={shape.offset} scale={shape.size} castShadow={castShadow} receiveShadow>
  {shape.type==='box'?<boxGeometry/>:shape.type==='cylinder'?<cylinderGeometry args={[.5,.5,1,32]}/>:shape.type==='sphere'?<sphereGeometry args={[.5,24,16]}/>:<torusGeometry args={[.38,.1,12,48]}/>}
  {shape.surface?<WorldSurfaceMaterial surface={shape.surface} color={shape.color}/>:<meshStandardMaterial color={shape.color} roughness={.65} metalness={shape.type==='torus'?.3:0}/>}
 </mesh>;
}
function Entity({item,runtime,model,select}){
 // Scatter instances select their scatter record; their tilt is fixed at expansion.
 const group=useRef(),target=item.scatter??item.id;
 useFrame(()=>{const motion=runtime.renderMotion?.(item);group.current.rotation.y=motion?item.rotation[1]+motion.angle:item.behavior?runtime.yaw(item):item.rotation[1];if(motion?.tilt){group.current.rotation.x=item.rotation[0]+motion.tilt[0];group.current.rotation.z=item.rotation[2]+motion.tilt[1];}group.current.position.set(...(motion?.position??runtime.position?.(item)??item.position));},-1);
 return <group ref={group} position={item.position} rotation={item.rotation} scale={item.scale} visible={runtime.visible(item)} userData={{target}} onClick={e=>{e.stopPropagation();select(target,{additive:e.shiftKey});}}>
  {item.shape?<Shape shape={item.shape} id={item.id} castShadow={item.castShadow!==false}/>:<PlacedAsset model={model} item={{...item,id:target,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}} select={select} runtime={runtime} gaitScale={item.scale[0]} asset={runtime.scene.assets.find(a=>a.id===item.asset)}/>}
 </group>;
}
// Assets with a placement that can reach below the water render from a copy
// whose materials carry the water column (H34). Other assets, and the loader's
// cached models, are untouched.
function useUnderwaterModels(models,placed,scene,runtime){
 const {water,environment}=scene;
 const tinted=useMemo(()=>{
  if(!water)return null;
  const bounds={},box=new THREE.Box3();
  for(const [id,model] of Object.entries(models))if(model?.scene){model.scene.updateMatrixWorld(true);box.setFromObject(model.scene);if(!box.isEmpty())bounds[id]={min:box.min.toArray(),max:box.max.toArray()};}
  const assets=underwaterAssets(placed,bounds,water);if(!assets.size)return null;
  const tint=createUnderwaterTint(water,environment),converted=new Map(),out={...models};
  const swap=m=>{if(!converted.has(m))converted.set(m,tint.material(m));return converted.get(m)??m;};
  for(const id of assets){const copy=models[id].scene.clone(true);copy.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);});out[id]={...models[id],scene:copy};}
  return {models:out,assets,tint,dispose(){for(const m of converted.values())m?.dispose();tint.dispose();}};
 },[models,placed,water,environment]);
 useEffect(()=>()=>tinted?.dispose(),[tinted]);
 useFrame(()=>{if(tinted)tinted.tint.clock.value=runtime.time??0;},-1);
 return tinted?.models??models;
}
function Driver({runtime}){useFrame((_,dt)=>runtime.step(dt),-2);return null;}
const axis=v=>Math.max(-1,Math.min(1,v));
const NO_STICK={forward:0,strafe:0,sprint:false};
function ViewController({runtime,mode,inhabiting,homeTick,setLocked,setMoving,setAim,select,focusInput,leaveWorld,interact,requestLook,toggleHud,toggleFree,person,setPerson,touch,emotes,extensionLook}){
 const {camera,gl,scene}=useThree(),keys=useRef(new Set()),drag=useRef(false),walk=useRef(),view=useRef(),lastMoving=useRef(false),lastPick=useRef({time:-Infinity,pose:[]}),aim=useRef(null),ray=useMemo(()=>new THREE.Raycaster(),[]);
 const actor=useRef(null),free=useRef(null),follow=useRef(createFollowCamera()),skipFrame=useRef(false),wheel=useMemo(()=>emotes??createEmoteInput(),[emotes]),walkable=useMemo(()=>(x,z,maxTop)=>runtime.walkableAt(x,z,maxTop),[runtime]);
 // A hidden page is throttled or paused; the first interval after it returns spans
 // the whole absence. Neither is a frame anyone saw, so neither is recorded.
 useEffect(()=>{const changed=()=>{skipFrame.current=true;};document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
 // Experimental client-extension hook (docs/client-extensions.md): gameplay such as recoil turns the walking look,
 // inside the mouse-look pitch clamp, and learns how much of the turn was applied.
 useEffect(()=>{if(!extensionLook)return;extensionLook.current={turn:(yaw,pitch)=>{const w=walk.current;if(mode!=='walk'||!w||!Number.isFinite(yaw)||!Number.isFinite(pitch))return [0,0];const before=w.pitch;w.yaw+=yaw;w.pitch=THREE.MathUtils.clamp(w.pitch+pitch,-1.5,1.3);return [yaw,w.pitch-before];}};return()=>{extensionLook.current=null;};},[extensionLook,mode]);
 const config=runtime.scene.runtime;
 const cameraConfig=JSON.stringify([config.spawn,config.look,config.overview,config.target,config.possession]);
 const far=viewFar(runtime.scene);
 useLayoutEffect(()=>{
  walk.current={position:[...config.spawn],yaw:config.look[0],pitch:config.look[1]};
  actor.current=config.possession?createInhabitant(runtime):null;runtime.actor=actor.current;resetFollowCamera(follow.current);
  // The body stays protected while its camera is free/overview. Legacy walking
  // has no maker actor, but still occupies a fixed-height body on the ground.
  const body=actor.current??{position:[config.spawn[0],0,config.spawn[2]],radius:.22,height:1.72};runtime.playerBody=body;
  probe.arrivalReset={tick:homeTick,spawn:[...config.spawn],feet:actor.current?[...actor.current.position]:null};
  setPerson(config.possession?.camera??'first');
  const d=new THREE.Vector3(...config.overview).sub(new THREE.Vector3(...config.target));
  view.current={yaw:Math.atan2(d.x,d.z),pitch:Math.asin(d.y/d.length()),distance:d.length()};keys.current.clear();
  return()=>{if(runtime.playerBody===body)runtime.playerBody=null;};
 },[runtime,homeTick,cameraConfig,!!runtime.scene.terrain,!!runtime.scene.water]);
 useLayoutEffect(()=>{
  // Geometry extents can change without a new spawn or possession config.
  // Update projection separately so a landscape edit does not respawn the maker.
  camera.far=far;camera.updateProjectionMatrix();
 },[camera,far]);
 useLayoutEffect(()=>{
  if(mode==='free'){
   const orientation=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
   free.current=createFreeCamera(camera.position.toArray(),[orientation.y,orientation.x]);
  }
  keys.current.clear();
 },[mode,camera]);
 useEffect(()=>{
  const el=gl.domElement;keys.current.clear();drag.current=false;setMoving(false);
  const typing=()=>isWorldInputTarget(document.activeElement);
  const clear=()=>{keys.current.clear();drag.current=false;};
  const down=e=>{
   // While the emote wheel is open, Esc closes it and the arrow keys step round it.
   if(wheel.open&&e.code==='Escape'){e.preventDefault();closeWheel(wheel,{play:false});return;}
   const target=runtime.interaction(aim.current,probe.actorEye??camera.position.toArray());
   const intent=resolveWorldKey({code:e.code,repeat:e.repeat,editable:typing(),mode:inhabiting?'inhabit':'author',cameraMode:mode,target,possessed:!!actor.current});
   if(!intent)return;
   e.preventDefault();
   if(wheel.open&&intent.type==='look'){if(!e.repeat)stepWheel(wheel,['ArrowRight','ArrowDown'].includes(intent.code)?1:-1);return;}
   if(intent.type==='move'||intent.type==='look'){keys.current.add(intent.code);return;}
   if(intent.type==='emote-wheel'){openWheel(wheel,'keys');return;}
   if(intent.type==='emote'){playSlot(wheel,intent.slot);return;}
   if(intent.type==='jump'){keys.current.add('Space');return;}
   if(intent.type==='select'){select(intent.id,{additive:e.shiftKey});return;}
   if(intent.type==='toggle-hud'){toggleHud();return;}
   if(intent.type==='toggle-person'){setPerson(p=>p==='first'?'third':'first');return;}
   if(intent.type==='toggle-free'){clear();toggleFree();return;}
   if(intent.type==='interact'||intent.type==='unavailable'){interact(intent.id);return;}
   clear();
   if(intent.type==='compose')focusInput();else leaveWorld();
  };
  const look=(dx,dy,rate)=>{const orbit=mode==='overview',v=mode==='free'?free.current:orbit?view.current:walk.current;v.yaw-=dx*rate;v.pitch=THREE.MathUtils.clamp(v.pitch+(orbit?1:-1)*dy*rate,orbit?.15:-1.5,mode==='free'?1.45:1.3);};
  const orbitDistance=next=>{const b=config.bounds,max=Math.max(45,b[1]-b[0],b[3]-b[2]);view.current.distance=THREE.MathUtils.clamp(next(view.current.distance),3,max*1.5);};
  // Touch never asks for the mouse lock: the left thumb walks, other fingers look,
  // two fingers pinch the overlook, and a tap uses what the reticle aims at.
  const at=e=>{const r=el.getBoundingClientRect();return {id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top,width:r.width,time:e.timeStamp,mode};};
  const touched=e=>e.pointerType==='touch'&&!!touch;
  const up=e=>{keys.current.delete(e.code);if(e.code==='KeyT'&&wheel.open&&wheel.source==='keys')closeWheel(wheel);},move=e=>{
   if(touched(e)){const r=touchMove(touch,at(e));if(r?.type==='look')look(r.dx,r.dy,.006);else if(r?.type==='pinch'&&mode==='overview')orbitDistance(d=>d*r.scale);return;}
   // A locked mouse aims the open wheel instead of the camera.
   if(wheel.open){if(document.pointerLockElement===el)moveWheel(wheel,e.movementX,e.movementY);return;}
   if(drag.current||document.pointerLockElement===el)look(e.movementX,e.movementY,.003);
  };
  const pointer=e=>{if(touched(e)){try{el.setPointerCapture(e.pointerId);}catch{/* The finger already lifted. */}touchDown(touch,at(e));return;}if(wheel.open){if(e.button===0)closeWheel(wheel);return;}if(e.button===2){drag.current=true;e.preventDefault();}else if(e.button===0&&inhabiting&&document.pointerLockElement!==el)requestLook();};
  const release=e=>{
   if(!touched(e)){drag.current=false;return;}
   const r=touchUp(touch,at(e));if(r?.type!=='tap'||mode!=='walk')return;
   const target=runtime.interaction(aim.current,probe.actorEye??camera.position.toArray());if(target?.action)interact(target.id);
  },cancel=e=>{if(touched(e))touchUp(touch,at(e));},context=e=>e.preventDefault();
  const zoom=e=>{if(mode==='overview'){e.preventDefault();orbitDistance(d=>d+e.deltaY*.04);}};
  // Focus moving to a button or the composer drops held keys but not a thumb that is still down.
  const drop=()=>{clear();if(touch)resetTouch(touch);closeWheel(wheel,{play:false});};
  let wasLocked=document.pointerLockElement===el;
  const lock=()=>{const isLocked=document.pointerLockElement===el;setLocked(isLocked);clear();if(wasLocked&&!isLocked){if(wheel.open)closeWheel(wheel,{play:false});else leaveWorld();}wasLocked=isLocked;};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointermove',move);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',drop);window.addEventListener('focusin',clear);document.addEventListener('visibilitychange',drop);document.addEventListener('pointerlockchange',lock);el.addEventListener('pointerdown',pointer);el.addEventListener('contextmenu',context);el.addEventListener('wheel',zoom,{passive:false});
  return()=>{drop();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',drop);window.removeEventListener('focusin',clear);document.removeEventListener('visibilitychange',drop);document.removeEventListener('pointerlockchange',lock);el.removeEventListener('pointerdown',pointer);el.removeEventListener('contextmenu',context);el.removeEventListener('wheel',zoom);};
 },[runtime,mode,inhabiting,gl,camera,select,focusInput,setLocked,setMoving,leaveWorld,interact,requestLook,toggleHud,toggleFree,touch,wheel]);
 useFrame((_,dt)=>{
  let moving=false;const stick=touch?stickAxes(touch):NO_STICK,pad=touch?.pad,requested=takeEmoteRequest(wheel);
  if(actor.current)actor.current.camera=person;
  if(mode==='walk'||mode==='free'){
   const k=keys.current;stepCameraLook(mode==='free'?free.current:walk.current,{turn:Number(k.has('ArrowRight'))-Number(k.has('ArrowLeft')),tilt:Number(k.has('ArrowUp'))-Number(k.has('ArrowDown'))},dt,{maxPitch:mode==='free'?1.45:1.3});
  }
  if(mode==='walk'){
   const k=keys.current,f=axis(Number(k.has('KeyW'))-Number(k.has('KeyS'))+stick.forward),r=axis(Number(k.has('KeyD'))-Number(k.has('KeyA'))+stick.strafe),w=walk.current,len=Math.max(1,Math.hypot(f,r)),sprint=k.has('ShiftLeft')||k.has('ShiftRight')||stick.sprint;
   if(actor.current){
    const a=actor.current;a.camera=person;
    // A pick while a movement key or the stick is held would end at once, so it is dropped.
    if(requested&&!f&&!r&&!k.has('Space')&&!pad?.jump)requestEmote(a,requested,{start:runtime.time,seat:requested==='sit'?chooseSeat(runtime.colliderTops(a.position[0],a.position[2]),a):null});
    stepInhabitant(a,{forward:f,strafe:r,jump:k.has('Space')||!!pad?.jump,sprint,yaw:w.yaw},dt,inhabitantContext(runtime,a.radius));a.pitch=w.pitch;
    moving=a.speed>.01;
    const eye=new THREE.Vector3(a.position[0],a.position[1]+a.eyeHeight,a.position[2]);w.position=eye.toArray();
    camera.position.copy(eye);camera.rotation.set(w.pitch,w.yaw,0,'YXZ');
    if(person==='first')camera.position.set(...firstPersonEyePosition(a.position,a.eyeHeight,w.yaw,w.pitch,(...args)=>runtime.blocked(...args)));
    if(person==='third'){
     // A sprung follow boom: it eases steps and swim height, retracts before terrain or a box, and snaps on spawn or recall.
     const view=stepFollowCamera(follow.current,{eye:eye.toArray(),yaw:w.yaw,pitch:w.pitch,...a.config.thirdPerson,ground:(x,z)=>runtime.terrain?.sample(x,z),blocked:(x,z,radius,feetY,height)=>runtime.blocked(x,z,radius,feetY,height)},dt);
     camera.position.set(...view.position);camera.lookAt(...view.focus);
    }else resetFollowCamera(follow.current);
    probe.actorEye=eye.toArray();
   }else{
   moving=!!(f||r);const distance=Math.min(dt,.04)*(sprint?4.5:2.6)/len,dx=(r*Math.cos(w.yaw)-f*Math.sin(w.yaw))*distance,dz=(-f*Math.cos(w.yaw)-r*Math.sin(w.yaw))*distance;
   // Small steps bound tunnelling through the narrowest supported blockers.
   const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));for(let i=0;i<steps;i++){if(!runtime.blocked(w.position[0]+dx/steps,w.position[2]))w.position[0]+=dx/steps;if(!runtime.blocked(w.position[0],w.position[2]+dz/steps))w.position[2]+=dz/steps;}
   runtime.playerBody.position[0]=w.position[0];runtime.playerBody.position[2]=w.position[2];
   camera.position.set(...w.position);camera.rotation.set(w.pitch,w.yaw,0,'YXZ');
    probe.actorEye=null;
   }
  }else{
   resetFollowCamera(follow.current);
   if(actor.current){const a=actor.current;stepInhabitant(a,{stop:true},dt,inhabitantContext(runtime,a.radius));probe.actorEye=[a.position[0],a.position[1]+a.eyeHeight,a.position[2]];}else probe.actorEye=null;
   if(mode==='free'){
    const k=keys.current,v=free.current,input={forward:axis(Number(k.has('KeyW'))-Number(k.has('KeyS'))+stick.forward),strafe:axis(Number(k.has('KeyD'))-Number(k.has('KeyA'))+stick.strafe),up:axis(Number(k.has('KeyE'))-Number(k.has('KeyQ'))+(pad?.up??0)),sprint:k.has('ShiftLeft')||k.has('ShiftRight')||stick.sprint};
    stepFreeCamera(v,input,dt);moving=!!(input.forward||input.strafe||input.up);camera.position.set(...v.position);camera.rotation.set(v.pitch,v.yaw,0,'YXZ');
   }else{
    const v=view.current,t=config.target;camera.position.set(t[0]+Math.sin(v.yaw)*Math.cos(v.pitch)*v.distance,t[1]+Math.sin(v.pitch)*v.distance,t[2]+Math.cos(v.yaw)*Math.cos(v.pitch)*v.distance);camera.lookAt(...t);
   }
  }
  if(moving!==lastMoving.current){setMoving(moving);lastMoving.current=moving;}
  camera.updateMatrixWorld();
  // Aim when the view moves, and at least every 100 ms for things that drift
  // under a still reticle: picking walks and raycasts the scene (H94).
  const now=performance.now(),pose=camera.matrixWorld.elements,last=lastPick.current;
  if(now-last.time>=100||pose.some((value,index)=>value!==last.pose[index])){
   last.time=now;last.pose=[...pose];ray.setFromCamera({x:0,y:0},camera);
   const target=pickWorldAim(ray,scene,{terrain:runtime.terrain,water:runtime.scene.water,time:runtime.time});
   if(aim.current!==target){aim.current=target;setAim(target);}
  }
  const a=actor.current,b=config.bounds;
  // A geometry/bounds edit may strand the existing pose. Report it instead of
  // silently teleporting; the host can offer the explicit Recall action.
  const outOfBounds=!!a&&(runtime.terrain?.sample(a.position[0],a.position[2]).inBounds===false||a.position[0]-a.radius<b[0]||a.position[0]+a.radius>b[1]||a.position[2]-a.radius<b[2]||a.position[2]+a.radius>b[3]);
  probe.actor=a?{position:[...a.position],eyePosition:[a.position[0],a.position[1]+a.eyeHeight,a.position[2]],mode:a.mode,camera:person,possessed:mode==='walk',grounded:a.grounded,verticalVelocity:a.verticalVelocity,speed:a.speed,supportHeight:a.supportHeight,waterDepth:a.waterDepth,outOfBounds,emote:a.emote?{id:a.emote.id,loop:a.emote.loop,stage:a.emote.stage,time:a.emote.time,seat:a.emote.seat?.id??null}:null}:null;probe.emoteWheel={open:wheel.open,highlight:wheel.highlight};
  const look=mode==='free'?free.current:walk.current;
  probe.touch=touch?{stick:[stick.forward,stick.strafe],sprint:stick.sprint,looks:touch.looks.size,pad:{...touch.pad}}:null;
  probe.position=camera.position.toArray();probe.look={yaw:look.yaw,pitch:look.pitch};probe.cameraMode=mode;probe.runtime=runtime.snapshot();probe.backend=gl.backend.isWebGPUBackend?'WebGPU':'WebGL2';if(skipFrame.current||document.hidden){skipFrame.current=document.hidden;probe.skippedFrames=(probe.skippedFrames||0)+1;}else{probe.frames.push(dt*1000);if(probe.frames.length>1800)probe.frames.shift();}if(probe.firstFrameMs==null&&Number.isFinite(probe.activatedAt))probe.firstFrameMs=performance.now()-probe.activatedAt;probe.drawCalls=gl.info.render.drawCalls;probe.triangles=gl.info.render.triangles;gl.info.reset();
 },-0.5);return config.possession?<Maker actor={actor} terrain={runtime.terrain} walkable={walkable} firstPerson={mode==='walk'&&person==='first'} hideBody={hideBodyInFirstPerson}/>:null;
}
// environment.grade (H77): the world's tone mapping while it is shown. Exposure is
// environment.exposure, applied by EnvironmentLighting.
const TONE_MAPPING={aces:THREE.ACESFilmicToneMapping,neutral:THREE.NeutralToneMapping,agx:THREE.AgXToneMapping};
function WorldGrade({environment}){
 const {gl}=useThree(),grade=resolveGrade(environment);
 useEffect(()=>{
  const previous=gl.toneMapping;gl.toneMapping=TONE_MAPPING[grade.toneMapping];
  return()=>{gl.toneMapping=previous;};
 },[gl,grade.toneMapping]);
 return null;
}
function Sun({runtime,environment,cameraMode}){
 const {camera,gl}=useThree(),light=useRef(),target=useMemo(()=>new THREE.Object3D(),[]),focus=useMemo(()=>new THREE.Vector3(),[]),last=useRef({});
 const shadow=useMemo(()=>sunShadowConfig(environment),[environment]);
 useLayoutEffect(()=>stableShadowKeys(gl),[gl]);
 const direction=useMemo(()=>new THREE.Vector3(...(environment.sunPosition??[-8,14,9])).normalize().multiplyScalar(shadow.lightDistance),[environment,shadow]);
 useLayoutEffect(()=>configureSunShadow(light.current,shadow),[shadow]);
 useFrame(()=>{
  const matrix=camera.matrixWorld.elements,previous=last.current,groundHeight=runtime.scene.water?.level??0;
  if(cameraMode==='walk'||previous.mode!==cameraMode||previous.terrain!==runtime.terrain||previous.groundHeight!==groundHeight||matrix.some((value,index)=>value!==previous.matrix?.[index])){
   shadowViewFocus({mode:cameraMode,actor:runtime.actor,camera,terrain:runtime.terrain,groundHeight,lead:shadow.lead},focus);
   stableShadowFocus(focus,direction,shadow,{mode:cameraMode,groundHeight});
   last.current={mode:cameraMode,terrain:runtime.terrain,groundHeight,matrix:[...matrix]};
  }
  target.position.copy(focus);light.current.position.copy(focus).add(direction);target.updateMatrixWorld();
  scheduleSunShadow(light.current);
 },-.25);
 return <><primitive object={target}/><directionalLight ref={light} target={target} color={environment.sunColor} intensity={environment.sunIntensity} castShadow/></>;
}
// fill=false when the sky light (environment.sky.light) replaces the hemisphere fill with the captured dome.
function EnvironmentLighting({environment,fill=true}){
 const {gl}=useThree(),{hemisphere,exposure}=resolveLighting(environment);
 useLayoutEffect(()=>applySceneExposure(gl,exposure),[gl,exposure]);
 return fill?<hemisphereLight args={[hemisphere.skyColor,hemisphere.groundColor,hemisphere.intensity]}/>:null;
}
export function RuntimeScene({bundle,runtime,cove,cameraMode,...controls}){
 const s=bundle.payload.world.scene,e=s.environment;runtime.originVisible=cove;
 const extensionLook=useRef(null);
 // Identical materials become one instance across assets, and static pieces in a
 // shared material bake into one mesh per material (H100).
 const placed=useMemo(()=>placedObjects(s),[s]),shared=useMemo(()=>shareMaterials(bundle.models).models,[bundle.models]),models=useUnderwaterModels(shared,placed,s,runtime),staticPlan=useMemo(()=>planStaticBatches(placed,models,{apart:new Set(s.assets.filter(a=>a.reflection==='live').map(a=>a.id))}),[placed,models,s.assets]);
 const merge=useMemo(()=>planStaticMerge(staticPlan.batches,models,s.assets),[staticPlan,models,s.assets]);
 return <WorldMaterialsProvider>
  <color attach="background" args={[e.fogColor]}/><fog attach="fog" args={[e.fogColor,e.fogNear??28,e.fogFar??85]}/>
  <EnvironmentLighting environment={e} fill={!e.sky?.light}/>
  {/* Optional sky.light.bounce (H76): light rising from sunlit ground, which a probe low over water does not see. */}
  {e.sky?.light?.bounce&&<hemisphereLight args={['#000000',e.sky.light.bounce.color,e.sky.light.bounce.intensity]}/>}
  <Sun runtime={runtime} environment={e} cameraMode={cameraMode}/><WorldGrade environment={e}/>
  {(s.terrain||s.water)&&<Landscape terrain={s.terrain} water={s.water} environment={e} runtime={runtime} textures={bundle.textures} placements={placed}/>}
  {(s.terrain||s.water||e.sky)&&<LandscapeSky environment={e} runtime={runtime}/>}
  {!s.terrain&&(e.type==='construct'?<Construct/>:!s.water&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.08,0]} receiveShadow><planeGeometry args={[180,180]}/><WorldSurfaceMaterial surface="soil" color={e.groundColor}/></mesh>)}
  <group visible={cove} userData={{skyLightExclude:true}}><Cove gltf={bundle.models[s.origin]}/>{s.moodboard&&<MoodBoard model={bundle.models[s.moodboard.asset]} board={s.moodboard} references={bundle.payload.world.references||[]} pins={bundle.payload.world.bible.referenceIds||[]} select={controls.select}/>}</group>
  {merge.buckets.map(bucket=><StaticMergedMesh key={bucket.key} bucket={bucket} runtime={runtime} select={controls.select}/>)}
  {staticPlan.batches.map(batch=><StaticAssetBatch key={batch.key} batch={batch} model={models[batch.asset]} asset={s.assets.find(a=>a.id===batch.asset)} runtime={runtime} select={controls.select} skip={merge.skip.get(batch.key)??null}/>)}
  {staticPlan.individual.map(item=>item.behavior?.type==='flock'?<FlockAsset key={item.id} item={item} model={models[item.asset]} runtime={runtime} select={controls.select}/>:<Entity key={item.id} item={item} model={models[item.asset]} runtime={runtime} select={controls.select}/>)}
  <Driver runtime={runtime}/><ViewController runtime={runtime} mode={cameraMode} {...controls} extensionLook={extensionLook}/>
  <ClientExtension runtime={runtime} cameraMode={cameraMode} inhabiting={controls.inhabiting} person={controls.person} look={extensionLook}/>
 </WorldMaterialsProvider>;
}
