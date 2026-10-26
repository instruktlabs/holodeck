import React,{useMemo} from 'react';
import * as THREE from 'three/webgpu';

export const GHOST_LIMIT=120;
// Proposed placements drawn in place before Apply: one shared translucent
// material, no shadows, and no raycast so aiming and selection ignore them.
const ghostMaterial=new THREE.MeshBasicMaterial({color:'#f3e3c2',transparent:true,opacity:.32,depthWrite:false});
const ghostEdge=new THREE.MeshBasicMaterial({color:'#a8741c',wireframe:true,transparent:true,opacity:.35,depthWrite:false});
const box=new THREE.BoxGeometry(1,1,1);
const ignore=()=>{};

function GhostAsset({model,item}){
  const object=useMemo(()=>{
    const clone=model.scene.clone(true);
    clone.traverse(o=>{if(o.isMesh){o.material=ghostMaterial;o.castShadow=false;o.receiveShadow=false;o.raycast=ignore;}});
    return clone;
  },[model]);
  return <group position={item.position} rotation={item.rotation} scale={item.scale}><primitive object={object} dispose={null}/></group>;
}
function GhostShape({item}){
  const s=item.shape,size=s.size||[1,1,1];
  return <group position={item.position} rotation={item.rotation} scale={item.scale}><mesh position={s.offset} scale={size} geometry={box} material={ghostMaterial} raycast={ignore}/><mesh position={s.offset} scale={size} geometry={box} material={ghostEdge} raycast={ignore}/></group>;
}
export function Ghosts({items,models}){
  return <group name="proposal-ghosts" userData={{skyLightExclude:true}}>{items.map(item=>item.asset?models[item.asset]&&<GhostAsset key={item.id} model={models[item.asset]} item={item}/>:item.shape&&<GhostShape key={item.id} item={item}/>)}</group>;
}

// Placements a proposal adds or moves, compared with the accepted world.
export function ghostPlacements(accepted,proposed,limit=GHOST_LIMIT){
  if(!accepted||!proposed?.scene?.objects||proposed.scene===accepted.scene)return {items:[],total:0};
  const before=new Map(accepted.scene.objects.map(o=>[o.id,o])),key=o=>JSON.stringify([o.asset,o.shape,o.position,o.rotation,o.scale]);
  const changed=proposed.scene.objects.filter(o=>{const b=before.get(o.id);return !b||key(b)!==key(o);});
  return {items:changed.slice(0,limit),total:changed.length};
}
