import {BufferGeometry,Mesh,MeshBasicMaterial,Ray,Vector3} from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Fn,PCFShadowFilter,min,mix,smoothstep} from 'three/tsl';
import {terrainRayDistance} from './aim.mjs';

// One existing-size PCF map; edge fading adds arithmetic, not another shadow pass.
export const SUN_SHADOW=Object.freeze({mapSize:2048,halfExtent:24,near:.1,far:90,normalBias:.03,fadeWidth:6,lightDistance:40,focusDistance:160});
// Objects only on this layer render into the sun shadow map and never into the view.
export const SHADOW_ONLY_LAYER=1;
export function configureSunShadow(light){
 const c=SUN_SHADOW,s=light.shadow;s.camera.layers.enable(SHADOW_ONLY_LAYER);s.mapSize.set(c.mapSize,c.mapSize);s.normalBias=c.normalBias;
 Object.assign(s.camera,{left:-c.halfExtent,right:c.halfExtent,bottom:-c.halfExtent,top:c.halfExtent,near:c.near,far:c.far});s.camera.updateProjectionMatrix();
 s.filterNode=Fn(({depthTexture,shadowCoord,shadow,depthLayer})=>{
  const q=shadowCoord,xy=min(min(q.x,q.x.oneMinus()),min(q.y,q.y.oneMinus())).mul(c.halfExtent*2),z=min(q.z,q.z.oneMinus()).mul(c.far-c.near);
  return mix(1,PCFShadowFilter({depthTexture,shadowCoord,shadow,depthLayer}),smoothstep(0,c.fadeWidth,min(xy,z)));
 });
}
// Sibling meshes with baked geometry stop casting; one position-only merge per face side casts for them on the
// shadow-only layer. The shadow pass draws every caster with one override material, so the map is unchanged.
export function shadowProxies(meshes){
 const sides=new Map();
 for(const mesh of meshes){
  if(!mesh.isMesh||!mesh.castShadow)continue;mesh.castShadow=false;
  const side=mesh.material.shadowSide??mesh.material.side,source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,shape=new BufferGeometry();
  shape.setAttribute('position',source.getAttribute('position'));if(!sides.has(side))sides.set(side,[]);sides.get(side).push(shape);
 }
 return [...sides].map(([side,shapes])=>{const proxy=new Mesh(mergeGeometries(shapes),new MeshBasicMaterial({side}));proxy.castShadow=true;proxy.layers.set(SHADOW_ONLY_LAYER);proxy.raycast=()=>{};return proxy;});
}
// CPU equivalent of the fragment weight for boundary/continuity qualification.
export function shadowFadeAt([x,y,z]){
 const c=SUN_SHADOW,edge=Math.min(x,1-x,y,1-y)*c.halfExtent*2,depth=Math.min(z,1-z)*(c.far-c.near),t=Math.max(0,Math.min(1,Math.min(edge,depth)/c.fadeWidth));return t*t*(3-2*t);
}
const viewRay=new Ray(),direction=new Vector3();
export function shadowViewFocus({mode,actor,camera,terrain,groundHeight=0},out=new Vector3()){
 if(mode==='walk'&&actor)return out.fromArray(actor.position);
 camera.getWorldPosition(viewRay.origin);camera.getWorldDirection(direction);viewRay.direction.copy(direction);
 if(mode!=='walk'){
  const terrainDistance=terrain?terrainRayDistance(viewRay,terrain,0,SUN_SHADOW.focusDistance):null;
  if(terrainDistance!==null)return viewRay.at(terrainDistance,out);
  const distance=(groundHeight-viewRay.origin.y)/direction.y;
  if(!terrain&&Number.isFinite(distance)&&distance>=0&&distance<=SUN_SHADOW.focusDistance)return viewRay.at(distance,out);
 }
 const support=terrain?.sample(viewRay.origin.x,viewRay.origin.z);
 return out.set(viewRay.origin.x,support?.inBounds?support.height:groundHeight,viewRay.origin.z);
}
