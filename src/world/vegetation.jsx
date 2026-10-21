import React,{useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import * as THREE from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {useWorldMaterialResources} from './world-materials.js';

const LEAF_CARDS=240;
function randomFor(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function limb(a,b,radius){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start),g=new THREE.CylinderGeometry(radius*.48,radius,direction.length(),7,2);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());return g;}
function makeTree(seed){
 const rand=randomFor(seed),parts=[],clusters=[],root=[0,-.5,0],fork=[.015,-.06,.012];
 parts.push(limb(root,[.006,-.22,-.01],.041),limb([.006,-.22,-.01],fork,.029));
 for(let i=0;i<7;i++){
  const angle=i*Math.PI*2/7+rand()*.35,radius=.2+rand()*.12,end=[Math.cos(angle)*radius,.12+rand()*.18,Math.sin(angle)*radius];
  parts.push(limb(fork,[end[0]*.48,end[1]*.52,end[2]*.48],.019),limb([end[0]*.48,end[1]*.52,end[2]*.48],end,.012));
  for(let j=0;j<2;j++){const tip=[end[0]+(rand()-.5)*.1,end[1]+.07+rand()*.05,end[2]+(rand()-.5)*.1];parts.push(limb(end,tip,.006));}
  clusters.push(end);
 }
 clusters.push([.01,.34,.01]);
 const bark=mergeGeometries(parts);for(const p of parts)p.dispose();
 const leafGeometry=new THREE.PlaneGeometry(1,1,1,2),tiles=new Float32Array(LEAF_CARDS),phases=new Float32Array(LEAF_CARDS),matrices=[],colors=[],dummy=new THREE.Object3D(),leafColor=new THREE.Color();
 for(let i=0;i<LEAF_CARDS;i++){
  const center=clusters[i%clusters.length],angle=rand()*Math.PI*2,height=(rand()-.5)*2,radius=Math.sqrt(rand()),ring=Math.sqrt(1-height*height)*radius;
  dummy.position.set(center[0]+Math.cos(angle)*ring*.145,center[1]+height*.105,center[2]+Math.sin(angle)*ring*.145);
  dummy.rotation.set((rand()-.5)*2.4,rand()*Math.PI*2,(rand()-.5)*2.4);const scale=.105+rand()*.055;dummy.scale.set(scale,scale*(.8+rand()*.4),scale);dummy.updateMatrix();matrices.push(dummy.matrix.clone());
  tiles[i]=i%4;phases[i]=rand()*Math.PI*2;leafColor.setHSL(.22+rand()*.035,.20+rand()*.12,.58+rand()*.18);colors.push(leafColor.clone());
 }
 leafGeometry.setAttribute('leafTile',new THREE.InstancedBufferAttribute(tiles,1));leafGeometry.setAttribute('leafPhase',new THREE.InstancedBufferAttribute(phases,1));
 return {bark,leafGeometry,matrices,colors};
}

// A tree is one selectable entity. Part identities are optional inspection
// detail; leaves and branches do not become hundreds of scene entities.
export function Tree({size=[4,5,4],color='#d4dfb0',seed='tree'}){
 const resources=useWorldMaterialResources(),mesh=useRef(),tree=useMemo(()=>makeTree(seed),[seed]);
 useLayoutEffect(()=>{for(let i=0;i<LEAF_CARDS;i++){mesh.current.setMatrixAt(i,tree.matrices[i]);mesh.current.setColorAt(i,tree.colors[i]);}mesh.current.instanceMatrix.needsUpdate=true;mesh.current.instanceColor.needsUpdate=true;mesh.current.computeBoundingBox();mesh.current.computeBoundingSphere();},[tree]);
 useEffect(()=>()=>{tree.bark.dispose();tree.leafGeometry.dispose();},[tree]);
 return <group scale={size}>
  <mesh geometry={tree.bark} material={resources.surface('wood','#9c8264')} castShadow receiveShadow name="trunk" userData={{part:'trunk'}} dispose={null}/>
  <instancedMesh ref={mesh} args={[tree.leafGeometry,resources.foliage(color),LEAF_CARDS]} castShadow receiveShadow name="canopy" userData={{part:'canopy'}} dispose={null}/>
 </group>;
}
