import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three/webgpu';
import { applyCoveUVs, coveRole, makeCoveMaterials } from './cove-materials.js';
import { MoodBoard } from '../world/moodboard.jsx';
import { useAssetFoliage } from '../world/foliage.jsx';
import { useAssetGait } from '../world/gait.jsx';

export const HOME = [1.25,1.72,2.35];
export const probe = window.holodeckPrototype = { ready:false, frames:[], position:HOME, errors:[] };
window.addEventListener('error',e=>probe.errors.push(e.message));
window.addEventListener('unhandledrejection',e=>probe.errors.push(String(e.reason)));
const seeded=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export const streamZ=x=>-13+Math.sin(x*0.16)*1.5;
const trunkData=Array.from({length:90},(_,i)=>{
  const x=(seeded(i+3)-0.5)*49, z=-4-seeded(i+183)*35;
  return {x,z,h:3.1+seeded(i+299)*3.8,r:0.10+seeded(i+876)*0.13};
}).filter(t=>Math.abs(t.x)>3.5 && Math.abs(t.z-streamZ(t.x))>2.6 && Math.hypot(t.x,t.z)>6);

function LegacyCove() {
  const gltf=useLoader(GLTFLoader,'/assets/hearth-cove-warm.glb');
  return <Cove gltf={gltf}/>;
}
export function Cove({gltf,target='cove'}) {
  const kit=useMemo(()=>{
    const source=gltf.scene.clone(true); source.updateMatrixWorld(true);
    const group=new THREE.Group(), batches=new Map(), materials=makeCoveMaterials();
    // Static runtime derivative; the saved Kiln GLB retains its semantic parts.
    source.traverse(mesh=>{if(!mesh.isMesh)return;
      const role=coveRole(mesh.name),casts=!/LinenCanopy/.test(mesh.name);
      // Roles only steer derived surfaces; authored materials batch by material alone.
      const key=mesh.material.uuid+(mesh.material.map?'':role)+casts;
      if(!batches.has(key)){
        const material=materials.create(mesh.material,role);
        batches.set(key,{material,geometries:[],casts,parts:[],triangles:0});
      }
      for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
        const transform=new THREE.Matrix4();
        if(mesh.isInstancedMesh){mesh.getMatrixAt(i,transform);transform.premultiply(mesh.matrixWorld);}else transform.copy(mesh.matrixWorld);
        const geometry=mesh.geometry.clone();
        // GLB positions can be normalized integers. Bake transforms in floats to
        // avoid truncation/overflow when flattening the quantized source meshes.
        // Authored normal maps keep their exported tangents; derived surfaces need only position/normal/uv.
        const kept=mesh.material.map&&mesh.material.normalMap&&geometry.getAttribute('tangent')?['position','normal','uv','tangent']:['position','normal','uv'];
        for(const name of kept){
          const a=geometry.getAttribute(name);if(!a)continue;
          const floats=new Float32Array(a.count*a.itemSize);
          for(let k=0;k<a.count;k++)for(let c=0;c<a.itemSize;c++)floats[k*a.itemSize+c]=a.getComponent(k,c);
          geometry.setAttribute(name,new THREE.BufferAttribute(floats,a.itemSize));
        }
        geometry.applyMatrix4(transform);
        if(!mesh.material.map)applyCoveUVs(geometry,role);
        for(const attr of Object.keys(geometry.attributes)) if(!kept.includes(attr)) geometry.deleteAttribute(attr);
        if(!geometry.attributes.uv) geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
        const flat=geometry.index?geometry.toNonIndexed():geometry,batch=batches.get(key),count=flat.attributes.position.count/3;
        if(flat!==geometry)geometry.dispose();
        batch.parts.push({source:mesh.name,instance:i,start:batch.triangles,count});batch.triangles+=count;batch.geometries.push(flat);
      }
    });
    for(const {material,geometries,casts,parts} of batches.values()){
      if(geometries.some(g=>!g.attributes.tangent))geometries.forEach(g=>g.deleteAttribute('tangent'));
      const merged=mergeGeometries(geometries),mesh=new THREE.Mesh(merged,material);
      geometries.forEach(g=>g.dispose());mesh.castShadow=casts;mesh.receiveShadow=true;mesh.userData={target,sourceParts:parts};group.add(mesh);
    }
    group.rotation.y=Math.PI/2;
    group.userData.materials=materials;
    return group;
  },[gltf,target]);
  useEffect(()=>{if(!probe.activationKey)probe.ready=true; return()=>{kit.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});kit.userData.materials.dispose();};},[kit]);
  return <primitive object={kit} dispose={null}/>;
}
function ReferencePlacards(){
  const maps=useLoader(THREE.TextureLoader,['/design/first-person/01-discuss.png','/design/first-person/02-direct.png']);
  maps.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;});
  return <group>{maps.map((map,i)=><mesh key={i} position={[-3.12+i*.68+.022,1.46,1.45+i*.48-.032]} rotation={[0,145*Math.PI/180,0]}><planeGeometry args={[.69,.44]}/><meshBasicMaterial map={map} toneMapped={false}/></mesh>)}</group>;
}
function Instances({geometry,material,items,shadow=true}) {
  const ref=useRef();
  useLayoutEffect(()=>{
    const obj=new THREE.Object3D();
    items.forEach((v,i)=>{obj.position.set(...v.p);obj.scale.set(...v.s);obj.rotation.set(...(v.r||[0,0,0]));obj.updateMatrix();ref.current.setMatrixAt(i,obj.matrix);if(v.c)ref.current.setColorAt(i,new THREE.Color(v.c));});
    ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor){ref.current.instanceColor.needsUpdate=true;material.needsUpdate=true;}
    ref.current.computeBoundingSphere();
  },[items]);
  return <instancedMesh ref={ref} args={[geometry,material,items.length]} castShadow={shadow} receiveShadow/>;
}
function Woodland({clear}) {
  const data=useMemo(()=>{
    const trunks=trunkData.map(t=>({p:[t.x,t.h/2,t.z],s:[t.r,t.h,t.r]}));
    const crowns=trunkData.flatMap((t,i)=>Array.from({length:4},(_,j)=>({p:[t.x+Math.cos(j*2.4)*1.0,t.h+0.2+j*.3,t.z+Math.sin(j*2.4)],s:[1.4+j*.09,1.1+seeded(i+j)*.6,1.4],c:['#78816a','#65745b','#899075','#596d58'][(i+j)%4]})));
    const stones=Array.from({length:95},(_,i)=>{
      const x=(seeded(i+1000)-.5)*46,z=streamZ(x)+(i%2?2.1:-2.1),r=.16+seeded(i+1400)*.35;
      return {p:[x,r*.3,z],s:[r,r*.65,r*.8],r:[i,.4*i,.2*i],c:i%2?'#8e9282':'#a6a694'};
    }).filter(t=>Math.abs(t.p[0])>1.65);
    const grass=Array.from({length:1400},(_,i)=>{
      const x=(seeded(i+2000)-.5)*47,z=-4-seeded(i+3700)*35;
      return {p:[x,.11,z],s:[.10,.22+seeded(i+5600)*.24,.10],r:[0,i,0],c:i%2?'#7c8a65':'#a1aa7f'};
    }).filter(t=>Math.abs(t.p[2]-streamZ(t.p[0]))>2 && Math.abs(t.p[0])>(clear?1.3:.5));
    return {trunks,crowns,stones,grass};
  },[clear]);
  const resources=useMemo(()=>({
    trunk:new THREE.CylinderGeometry(.75,1,1,7), leaf:new THREE.IcosahedronGeometry(1,2),rock:new THREE.IcosahedronGeometry(1,1),blade:new THREE.ConeGeometry(1,1,3),
    bark:new THREE.MeshStandardMaterial({color:'#76624c',roughness:1}),foliage:new THREE.MeshStandardMaterial({color:'white',roughness:1}),stone:new THREE.MeshStandardMaterial({color:'white',roughness:1}),green:new THREE.MeshStandardMaterial({color:'white',roughness:1})
  }),[]);
  useEffect(()=>()=>Object.values(resources).forEach(r=>r.dispose()),[resources]);
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.028,-16]} receiveShadow><circleGeometry args={[28,96]}/><meshStandardMaterial color="#abb492" roughness={1}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.001,-21]} receiveShadow><planeGeometry args={[clear?2.25:1.15,34]}/><meshStandardMaterial color="#cec1a0" roughness={1}/></mesh>
    <Instances geometry={resources.trunk} material={resources.bark} items={data.trunks}/>
    <Instances geometry={resources.leaf} material={resources.foliage} items={data.crowns}/>
    <Instances geometry={resources.rock} material={resources.stone} items={data.stones}/>
    <Instances geometry={resources.blade} material={resources.green} items={data.grass} shadow={false}/>
  </group>;
}
function River({select,selected}) {
  const geometry=useMemo(()=>{
    const p=[],indices=[];
    for(let i=0;i<=80;i++){const x=-26+i*.65;for(const sign of [-1,1])p.push(x,.018,streamZ(x)+sign*1.65);if(i<80){let k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group>
    <mesh geometry={geometry} userData={{target:'crossing'}} onClick={e=>{e.stopPropagation();select('crossing');}} receiveShadow>
      <meshStandardMaterial color={selected?'#72978d':'#86a39b'} roughness={.25} metalness={.1} side={THREE.DoubleSide}/>
    </mesh>
    {Array.from({length:17},(_,i)=><mesh key={i} position={[(i-8)*2.8,.029,streamZ((i-8)*2.8)+Math.sin(i)*.8]} rotation={[-Math.PI/2,0,-.05]}><planeGeometry args={[.65+seeded(i)*.8,.016]}/><meshBasicMaterial color="#c4d4bc" transparent opacity={.5}/></mesh>)}
  </group>;
}
function Bridge({variant,preview}) {
  const color=preview?'#d6a15c':'#9d7954';
  const material=useMemo(()=>new THREE.MeshStandardMaterial({color,roughness:.8,transparent:preview,opacity:preview?.5:1,emissive:preview?'#bb7934':'#000000',emissiveIntensity:preview?.25:0}),[preview,color]);
  useEffect(()=>()=>material.dispose(),[material]);
  const railHeight=variant==='low'?.45:.85;
  return <group position={[0,0,-13]} userData={{target:'crossing'}}>
    {Array.from({length:21},(_,i)=>{const z=-2.1+i*.21,y=.12+.20*Math.sin(i/20*Math.PI);return <mesh key={i} position={[0,y,z]} material={material} castShadow={!preview} receiveShadow><boxGeometry args={[1.9,.12,.19]}/></mesh>;})}
    {[-1,1].flatMap(side=>[-1.9,-.65,.65,1.9].map((z,i)=><mesh key={`${side}-${i}`} position={[side*.95,.22+railHeight/2,z]} material={material} castShadow={!preview}><cylinderGeometry args={[.045,.055,railHeight,8]}/></mesh>))}
    {[-1,1].map(side=><mesh key={side} position={[side*.95,.22+railHeight,0]} material={material} castShadow={!preview}><boxGeometry args={[.07,.08,4.15]}/></mesh>)}
  </group>;
}
export function Construct() {
  const geo=useMemo(()=>{
    const p=[];for(let i=-60;i<=60;i+=2){p.push(-60,-.075,i,60,-.075,i,i,-.075,-60,i,-.075,60);}
    return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  },[]);
  useEffect(()=>()=>geo.dispose(),[geo]);
  return <>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.085,0]} receiveShadow><planeGeometry args={[240,240]}/><meshStandardMaterial color="#d8d3c4" roughness={1}/></mesh>
    <lineSegments geometry={geo}><lineBasicMaterial color="#f7efdb" transparent opacity={.56}/></lineSegments>
  </>;
}
function Sky(){
  const texture=useMemo(()=>{
    const c=document.createElement('canvas');c.width=16;c.height=256;
    const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,256);
    g.addColorStop(0,'#aebfc3');g.addColorStop(.43,'#e8d5bc');g.addColorStop(.5,'#ffe4b8');g.addColorStop(.58,'#eee2c9');g.addColorStop(1,'#c8bea6');ctx.fillStyle=g;ctx.fillRect(0,0,16,256);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  },[]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh><sphereGeometry args={[110,32,16]}/><meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} toneMapped={false}/></mesh>;
}
function blocked(x,z,{cove,world,bridge,boxes=[],modular=false}) {
  if(Math.abs(x)>29||z>20||z< -41)return true;
  if(cove){
    const a=Math.atan2(z,x),angle=a<0?a+2*Math.PI:a,r=Math.hypot(x,z);
    if(r>2.82 && r<4.57 && angle>.03&&angle<3.73)return true;
    if(!modular&&Math.hypot(x+1.12,z-.08)<1.39)return true;
    if(!modular&&[[-3.25,-1.7],[2.55,-1.7],[-3.25,2.55],[2.55,2.55]].some(([px,pz])=>Math.hypot(x-px,z-pz)<.3))return true;
  }
  if(world){
    if(Math.abs(z-streamZ(x))<1.83 && !(bridge&&Math.abs(x)<.68))return true;
    if(trunkData.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+.25))return true;
  }
  if(boxes.some(b=>x>b.min.x-.22&&x<b.max.x+.22&&z>b.min.z-.22&&z<b.max.z+.22&&b.max.y>.05&&b.min.y<1.72))return true;
  return false;
}
function Controller({cove,session,homeTick,setLocked,setMoving,setAim,select,focusInput,boxes=[],modular=false}) {
  const {camera,gl,scene}=useThree(),keys=useRef(new Set()),angles=useRef({yaw:.46,pitch:-.14}),drag=useRef(false),lastMove=useRef(false),ray=useMemo(()=>new THREE.Raycaster(),[]),prevAim=useRef(null);
  useEffect(()=>{camera.position.set(...HOME);angles.current={yaw:.46,pitch:-.14};camera.rotation.order='YXZ';},[camera,homeTick]);
  useEffect(()=>{
    const el=gl.domElement;
    const typing=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
    const onKey=e=>{
      if(e.code==='Escape'){keys.current.clear();document.exitPointerLock?.();return;}
      if((e.code==='Enter'||e.code==='Tab')&&document.pointerLockElement===el){e.preventDefault();keys.current.clear();document.exitPointerLock();focusInput();return;}
      if(typing())return;
      if(e.code==='KeyE'){if(prevAim.current)select(prevAim.current);return;}
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}
    };
    const up=e=>keys.current.delete(e.code);
    const move=e=>{if(document.pointerLockElement===el||drag.current){angles.current.yaw-=e.movementX*.002;angles.current.pitch=THREE.MathUtils.clamp(angles.current.pitch-e.movementY*.002,-1.15,1.15);}};
    const down=e=>{if(e.button===2){drag.current=true;e.preventDefault();}};
    const release=()=>{drag.current=false;};
    const lock=()=>{const locked=document.pointerLockElement===el;setLocked(locked);if(!locked)keys.current.clear();};
    const clear=()=>keys.current.clear();
    const context=e=>e.preventDefault();
    window.addEventListener('keydown',onKey);window.addEventListener('keyup',up);window.addEventListener('pointermove',move);window.addEventListener('pointerup',release);window.addEventListener('blur',clear);window.addEventListener('focusin',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('pointerlockchange',lock);el.addEventListener('pointerdown',down);el.addEventListener('contextmenu',context);
    return()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',up);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',release);window.removeEventListener('blur',clear);window.removeEventListener('focusin',clear);document.removeEventListener('visibilitychange',clear);document.removeEventListener('pointerlockchange',lock);el.removeEventListener('pointerdown',down);el.removeEventListener('contextmenu',context);};
  },[camera,gl,focusInput,select,setLocked]);
  useFrame((_,dt)=>{
    const k=keys.current,forward=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),right=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0);
    const moving=!!(forward||right);
    if(lastMove.current!==moving){setMoving(moving);lastMove.current=moving;}
    camera.rotation.set(angles.current.pitch,angles.current.yaw,0,'YXZ');
    const len=Math.hypot(forward,right)||1,step=Math.min(dt,.04)*(k.has('ShiftLeft')?4.8:2.6),yaw=angles.current.yaw;
    const dx=(right*Math.cos(yaw)-forward*Math.sin(yaw))*step/len,dz=(-forward*Math.cos(yaw)-right*Math.sin(yaw))*step/len;
    const state={cove,world:session.world,bridge:session.bridge,boxes,modular};
    if(!blocked(camera.position.x+dx,camera.position.z,state))camera.position.x+=dx;
    if(!blocked(camera.position.x,camera.position.z+dz,state))camera.position.z+=dz;
    const onBridge=session.bridge&&Math.abs(camera.position.x)<.9&&Math.abs(camera.position.z+13)<2.2;
    const targetHeight=1.72+(onBridge?.18+.20*Math.cos((camera.position.z+13)/4.4*Math.PI):0);
    camera.position.y=THREE.MathUtils.lerp(camera.position.y,targetHeight,Math.min(1,dt*10));
    ray.setFromCamera({x:0,y:0},camera);const hit=ray.intersectObjects(scene.children,true).find(h=>{if(!h.object.userData.target||h.distance>=24)return false;for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});
    const aim=hit?.object.userData.target||null;
    if(aim!==prevAim.current){prevAim.current=aim;setAim(aim);}
    probe.position=camera.position.toArray();probe.look={...angles.current};probe.backend=gl.backend.isWebGPUBackend?'WebGPU':'WebGL2';probe.frames.push(dt*1000);if(probe.frames.length>1800)probe.frames.shift();probe.drawCalls=gl.info.render.drawCalls;probe.triangles=gl.info.render.triangles;gl.info.reset();
  });
  return null;
}
export function PlacedAsset({model,item,select,asset,runtime,gaitScale}){
  const object=useMemo(()=>{const clone=model.scene.clone(true);clone.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData={...o.userData,target:item.id};}});return clone;},[model,item.id]);
  useAssetFoliage({object,asset,runtime,enabled:item.materialStyle!=='cove'});
  useAssetGait({object,item,runtime,scaleX:gaitScale??item.scale[0]});
  return <group position={item.position} rotation={item.rotation} scale={item.scale} onClick={e=>{e.stopPropagation();select(item.id,{additive:e.shiftKey});}}>{item.materialStyle==='cove'?<Cove gltf={model} target={item.id}/>:<primitive object={object} dispose={null}/>} {item.light&&<pointLight position={item.light.offset} color={item.light.color} intensity={item.light.intensity} distance={item.light.distance} decay={2}/>}</group>;
}
export function Scene({session,cove,bundle,collisionScene,...controls}) {
  const authored=bundle?.payload.world.scene,environment=authored?.environment;
  const colliderDocument=collisionScene||authored;
  const boxes=useMemo(()=>{
    const objects=[...(colliderDocument?.objects||[])];if(colliderDocument?.moodboard&&cove)objects.push({...colliderDocument.moodboard,scale:[1,1,1],collider:{type:'box',size:[.85,2.55,2.665],offset:[0,1.275,0]}});
    return objects.filter(o=>o.collider&&(o.layer!=='origin'||cove)).flatMap(o=>{
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...o.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation)),new THREE.Vector3(...o.scale));
    return (o.collider.type==='compound'?o.collider.boxes:[o.collider]).map(c=>new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...c.offset),new THREE.Vector3(...c.size)).applyMatrix4(matrix));
    });},[colliderDocument,cove]);
  const modular=!!authored?.objects.some(o=>o.layer==='origin');
  return <>
    <color attach="background" args={[environment?.fogColor||'#eee2c9']}/><fog attach="fog" args={[environment?.fogColor||'#eee2c9',23,68]}/><Sky/>
    <hemisphereLight args={['#e5eced','#bb8d65',1.25]}/>
    <directionalLight position={[-7,9,5]} color={environment?.sunColor||'#ffd6a0'} intensity={environment?.sunIntensity??3.3} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-far={65} shadow-normalBias={.025} shadow-bias={-.0002}/>
    <directionalLight position={[6,5,9]} color="#ecf0eb" intensity={.8}/>
    {(!environment||environment.type==='construct')?<Construct/>:<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.085,0]} receiveShadow><planeGeometry args={[240,240]}/><meshStandardMaterial color={environment.groundColor} roughness={1}/></mesh>}
    <group visible={cove}>{bundle?<Cove gltf={bundle.models[authored.origin]}/>:<LegacyCove/>}{!authored?.moodboard&&<ReferencePlacards/>}{!modular&&<><pointLight position={[-1.12,1.5,.4]} intensity={cove?3:0} color="#ff9c3f" distance={3} decay={2}/>
      <pointLight position={[-3.45,.9,-1.55]} intensity={cove?9:0} color="#ffc179" distance={4} decay={2}/>
      <pointLight position={[3.3,.9,.9]} intensity={cove?9:0} color="#ffc179" distance={4} decay={2}/></>}
      {authored?.moodboard&&<MoodBoard model={bundle.models[authored.moodboard.asset]} board={authored.moodboard} references={bundle.payload.world.references||[]} pins={bundle.payload.world.bible.referenceIds||[]} select={controls.select}/>}
    </group>
    {session.world&&<><Woodland clear={session.clear}/><River select={controls.select} selected={controls.selected==='crossing'}/></>}
    {session.bridge&&<Bridge variant={session.bridge} preview={false}/>}
    {session.preview&&<Bridge variant={session.preview} preview/>}
    {authored?.objects.map(item=><group key={item.id} visible={item.layer!=='origin'||cove}><PlacedAsset model={bundle.models[item.asset]} item={item} select={controls.select}/></group>)}
    <Controller {...controls} session={session} cove={cove} boxes={boxes} modular={modular}/>
  </>;
}
