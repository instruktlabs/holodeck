import * as THREE from 'three/webgpu';
import {Fn,context,uniform} from 'three/tsl';
import {flowOffset,validateFlow} from './flow-contract.mjs';
import {markReactive} from './reactive.mjs';

// Each source material gets one scrolling copy per speed, shared by every
// placement of the asset. A material-wide context moves the default UV of every
// map (colour, normal, emissive, alpha, roughness) by one offset; lookups with
// their own coordinates, such as shadow maps and the environment, are untouched.
const NODE_MATERIALS={MeshStandardMaterial:THREE.MeshStandardNodeMaterial,MeshPhysicalMaterial:THREE.MeshPhysicalNodeMaterial,MeshBasicMaterial:THREE.MeshBasicNodeMaterial,MeshLambertMaterial:THREE.MeshLambertNodeMaterial,MeshPhongMaterial:THREE.MeshPhongNodeMaterial};
// A falling sheet is translucent and bright, so the full sun shadow of a tower or
// cornice across it reads as streaked plaster (H89): flowing water takes the sun
// shadow at this strength.
export const FLOW_SHADOW=.5;
const materialCache=new WeakMap();
export function nodeCopy(source){
 if(source.isNodeMaterial)return source.clone();
 const Class=NODE_MATERIALS[source.type];if(!Class)throw new Error(`Flow cannot scroll a ${source.type}`);
 const target=new Class();for(const key in source)if(key!=='uuid'&&key!=='_listeners')target[key]=source[key];
 return target;
}
function acquire(source,speed){
 let cache=materialCache.get(source);if(!cache){cache=new Map();materialCache.set(source,cache);}
 const key=speed.join(',');let entry=cache.get(key);
 if(!entry){
  const material=nodeCopy(source),offset=uniform(new THREE.Vector2());
  material.name=`${source.name||'authored'} / flow`;
  material.contextNode=context({getUV:texture=>texture.getDefaultUV().add(offset)});
  // A double-sided transparent sheet draws once rather than back faces then
  // front faces. A thin water sheet shows no difference, and each placement
  // costs one draw instead of two (H72).
  material.forceSinglePass=true;
  material.receivedShadowNode=Fn(([shadow])=>shadow.mul(FLOW_SHADOW).add(1-FLOW_SHADOW));
  // Its streaks move by texture, with no motion vectors (see reactive.mjs).
  markReactive(material);
  material.needsUpdate=true;
  entry={material,offset,references:0};cache.set(key,entry);
 }
 entry.references++;
 return {entry,release(){if(--entry.references===0){entry.material.dispose();cache.delete(key);}}};
}
// Applies only to the caller-owned placement clone. Shared source geometry,
// materials and textures remain owned by the asset loader.
export function bindAssetFlow(object,config){
 if(!config)return {update(){},dispose(){}};validateFlow(config);
 const selected=[];
 for(const name of config.nodes){
  const matches=[];object.traverse(node=>{if(node.name===name)matches.push(node);});
  if(matches.length!==1||!matches[0].isMesh)throw new Error(`Flow node ${name} must identify exactly one mesh node`);
  if(!matches[0].geometry.getAttribute('uv'))throw new Error(`Flow node ${name} is missing the UVs its maps scroll along`);
  selected.push(matches[0]);
 }
 const bindings=selected.map(mesh=>{
  const original=mesh.material,leases=[].concat(original).map(m=>acquire(m,config.speed));
  mesh.material=Array.isArray(original)?leases.map(l=>l.entry.material):leases[0].entry.material;
  return {mesh,original,leases};
 });
 let disposed=false;
 return {
  update(time){if(disposed)return;const [u,v]=flowOffset(config.speed,Number.isFinite(time)?time:0);for(const b of bindings)for(const l of b.leases)l.entry.offset.value.set(u,v);},
  dispose(){if(disposed)return;disposed=true;for(const b of bindings){b.mesh.material=b.original;b.leases.forEach(l=>l.release());}},
 };
}
