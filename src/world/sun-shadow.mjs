import {Ray,Vector3} from 'three/webgpu';
import {Fn,PCFShadowFilter,min,mix,smoothstep} from 'three/tsl';
import {terrainRayDistance} from './aim.mjs';

// One existing-size PCF map; edge fading adds arithmetic, not another shadow pass.
export const SUN_SHADOW=Object.freeze({mapSize:2048,halfExtent:24,near:.1,far:90,normalBias:.03,fadeWidth:6,lightDistance:40,focusDistance:160});
export function configureSunShadow(light){
 const c=SUN_SHADOW,s=light.shadow;s.mapSize.set(c.mapSize,c.mapSize);s.normalBias=c.normalBias;
 Object.assign(s.camera,{left:-c.halfExtent,right:c.halfExtent,bottom:-c.halfExtent,top:c.halfExtent,near:c.near,far:c.far});s.camera.updateProjectionMatrix();
 s.filterNode=Fn(({depthTexture,shadowCoord,shadow,depthLayer})=>{
  const q=shadowCoord,xy=min(min(q.x,q.x.oneMinus()),min(q.y,q.y.oneMinus())).mul(c.halfExtent*2),z=min(q.z,q.z.oneMinus()).mul(c.far-c.near);
  return mix(1,PCFShadowFilter({depthTexture,shadowCoord,shadow,depthLayer}),smoothstep(0,c.fadeWidth,min(xy,z)));
 });
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
