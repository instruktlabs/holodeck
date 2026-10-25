import {BufferGeometry,Mesh,MeshBasicMaterial,Ray,Vector3} from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Fn,PCFShadowFilter,min,mix,smoothstep} from 'three/tsl';
import {terrainRayDistance} from './aim.mjs';

// One existing-size PCF map; edge fading adds arithmetic, not another shadow pass.
export const SUN_SHADOW=Object.freeze({mapSize:2048,halfExtent:24,near:.1,far:90,normalBias:.03,fadeWidth:6,lightDistance:40,focusDistance:160,lead:0});
// environment.shadow.extent (H75) widens the box for long views. The whole volume
// scales with it, so depth range, bias and edge fade keep their proportions on the
// same map (a wider box gives softer shadows), and the box is centred half an
// extent ahead of the view so what lies ahead keeps its shadows.
export function sunShadowConfig(environment){
 const extent=environment?.shadow?.extent??SUN_SHADOW.halfExtent,k=extent/SUN_SHADOW.halfExtent,c=SUN_SHADOW;
 if(k===1)return c;
 return Object.freeze({...c,halfExtent:extent,far:c.far*k,normalBias:c.normalBias*k,fadeWidth:c.fadeWidth*k,lightDistance:c.lightDistance*k,lead:extent/2});
}
// Objects only on this layer render into the sun shadow map and never into the view.
export const SHADOW_ONLY_LAYER=1;
export function configureSunShadow(light,c=SUN_SHADOW){
 const s=light.shadow;s.camera.layers.enable(SHADOW_ONLY_LAYER);s.mapSize.set(c.mapSize,c.mapSize);s.normalBias=c.normalBias;
 Object.assign(s.camera,{left:-c.halfExtent,right:c.halfExtent,bottom:-c.halfExtent,top:c.halfExtent,near:c.near,far:c.far});s.camera.updateProjectionMatrix();
 s.filterNode=Fn(({depthTexture,shadowCoord,shadow,depthLayer})=>{
  const q=shadowCoord,xy=min(min(q.x,q.x.oneMinus()),min(q.y,q.y.oneMinus())).mul(c.halfExtent*2),z=min(q.z,q.z.oneMinus()).mul(c.far-c.near);
  return mix(1,PCFShadowFilter({depthTexture,shadowCoord,shadow,depthLayer}),smoothstep(0,c.fadeWidth,min(xy,z)));
 });
}
// Render the sun's shadow map once a frame, whichever camera renders first (H84).
// three otherwise redraws it for every camera that renders the scene, so the
// water's mirror view and each face of a sky light capture repeat the pass,
// although the box follows the walker or the view, not the camera rendering.
export function scheduleSunShadow(light){const s=light.shadow;s.autoUpdate=false;s.needsUpdate=true;}
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
// three's shadow pass draws every caster through one shared override material and copies each
// caster's alphaTest onto it. Crossing zero bumps that material's version, and every caster whose
// render object last saw another version re-derives its full cache key. With alpha-cut leaves
// among the stone that was every caster on every frame: 5.5% of revision 19's frame at the
// arrival. Each caster keeps its own render object, built with its own alpha test, so the shared
// material takes the caster's value before three copies it, and its version moves only when a
// caster's own material is swapped, which re-keys that caster as before (H121).
const stabilized=new WeakSet();
export function stableShadowKeys(renderer){
 if(stabilized.has(renderer))return;stabilized.add(renderer);
 const render=renderer.renderObject,sources=new WeakMap();
 renderer.renderObject=function(object,scene,camera,geometry,material,...rest){
  const shared=scene.overrideMaterial;
  if(shared?.isShadowPassMaterial&&material.allowOverride===true){
   shared._alphaTest=material.alphaTest;
   if(!Array.isArray(object.material)&&sources.get(object)!==material){sources.set(object,material);shared.version++;}
  }
  return render.call(this,object,scene,camera,geometry,material,...rest);
 };
}
// CPU equivalent of the fragment weight for boundary/continuity qualification.
export function shadowFadeAt([x,y,z],c=SUN_SHADOW){
 const edge=Math.min(x,1-x,y,1-y)*c.halfExtent*2,depth=Math.min(z,1-z)*(c.far-c.near),t=Math.max(0,Math.min(1,Math.min(edge,depth)/c.fadeWidth));return t*t*(3-2*t);
}
const viewRay=new Ray(),direction=new Vector3();
export function shadowViewFocus({mode,actor,camera,terrain,groundHeight=0,lead=0},out=new Vector3()){
 if(lead>0){
  // Ahead of the view along the ground by lead metres.
  shadowViewFocus({mode,actor,camera,terrain,groundHeight},out);camera.getWorldDirection(direction);
  const flat=Math.hypot(direction.x,direction.z);if(flat>1e-6){out.x+=direction.x/flat*lead;out.z+=direction.z/flat*lead;}
  return out;
 }
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
