import {Vector3} from 'three';
import {sampleWater} from './terrain.mjs';

const EPSILON=1e-7;

// Semantic meshes include ordinary props as occluders, not only interactive
// objects. Untagged terrain/ocean/sky and hidden ancestor subtrees never enter
// Three's triangle raycast. Traverse each frame so visibility/hotloads stay live.
export function collectAimMeshes(root){
 const meshes=[];
 const visit=(object,target=null)=>{
  if(!object.visible)return;
  target=target??object.userData?.target??null;
  if((target||object.userData?.instanceTargets)&&object.isMesh)meshes.push(object);
  for(const child of object.children)visit(child,target);
 };
 visit(root);return meshes;
}

function clipXZ(ray,bounds,near,far){
 let start=near,end=far;
 for(const [axis,min,max] of [['x',bounds[0],bounds[1]],['z',bounds[2],bounds[3]]]){
  const origin=ray.origin[axis],direction=ray.direction[axis];
  if(Math.abs(direction)<1e-12){if(origin<min||origin>max)return null;continue;}
  const a=(min-origin)/direction,b=(max-origin)/direction;
  start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));
  if(start>end)return null;
 }
 return [start,end];
}

// Exact rendered-triangle intersection, bounded by crossed grid cells rather
// than the full terrain triangle count. Grid cuts use actual Float32 positions.
export function terrainRayDistance(ray,terrain,near=0,far=30){
 const interval=clipXZ(ray,terrain.bounds,near,far);if(!interval)return null;
 const [start,end]=interval,[nx,nz]=terrain.segments,p=terrain.positions,cuts=[start,end];
 const xAt=i=>p[i*3],zAt=i=>p[i*(nx+1)*3+2];
 for(const [axis,count,coordinate] of [['x',nx,xAt],['z',nz,zAt]]){
  const direction=ray.direction[axis];if(Math.abs(direction)<1e-12)continue;
  for(let i=1;i<count;i++){const t=(coordinate(i)-ray.origin[axis])/direction;if(t>start&&t<end)cuts.push(t);}
 }
 cuts.sort((a,b)=>a-b);
 const cellAt=(value,count,coordinate)=>{
  let i=Math.min(count-1,Math.max(0,Math.floor((value-coordinate(0))/(coordinate(count)-coordinate(0))*count)));
  while(i>0&&value<coordinate(i))i--;
  while(i<count-1&&value>coordinate(i+1))i++;
  return i;
 };
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),d=new Vector3(),hit=new Vector3();
 for(let i=0;i<cuts.length-1;i++){
  const lo=cuts[i],hi=cuts[i+1],middle=(lo+hi)/2;
  const ix=cellAt(ray.origin.x+ray.direction.x*middle,nx,xAt),iz=cellAt(ray.origin.z+ray.direction.z*middle,nz,zAt),index=iz*(nx+1)+ix;
  a.fromArray(p,index*3);b.fromArray(p,(index+1)*3);c.fromArray(p,(index+nx+1)*3);d.fromArray(p,(index+nx+2)*3);
  let nearest=Infinity;
  for(const triangle of [[a,c,b],[b,c,d]])if(ray.intersectTriangle(...triangle,false,hit)){
   const distance=hit.distanceTo(ray.origin);
   if(distance>=lo-EPSILON&&distance<=hi+EPSILON&&distance>=near&&distance<=far)nearest=Math.min(nearest,distance);
  }
  if(Number.isFinite(nearest))return nearest;
 }
 return null;
}

// Aiming uses the animated water surface, never the undisplaced GPU mesh. Flat
// water is exact. Waves use <=4096 segment samples plus bisection; extremely
// narrow/tangent crests can remain approximate. This is not a physics query.
export function waterRayDistance(ray,water,near=0,far=30,time=0){
 const interval=clipXZ(ray,water.bounds,near,far);if(!interval)return null;
 const [start,end]=interval;
 if(!water.waves.length){
  if(Math.abs(ray.direction.y)<1e-12)return null;
  const t=(water.level-ray.origin.y)/ray.direction.y;return t>=start&&t<=end?t:null;
 }
 const delta=t=>ray.origin.y+ray.direction.y*t-sampleWater(water,ray.origin.x+ray.direction.x*t,ray.origin.z+ray.direction.z*t,time).height;
 const frequency=Math.max(...water.waves.map(w=>Math.abs(w.direction[0]*ray.direction.x+w.direction[1]*ray.direction.z)/w.wavelength));
 const steps=Math.min(4096,Math.max(1,Math.ceil((end-start)*Math.max(10,frequency*8))));
 let previous=start,previousDelta=delta(start);if(Math.abs(previousDelta)<EPSILON)return start;
 for(let i=1;i<=steps;i++){
  const next=start+(end-start)*i/steps,nextDelta=delta(next);
  if(Math.abs(nextDelta)<EPSILON)return next;
  if(previousDelta*nextDelta<0){
   let lo=previous,hi=next,loDelta=previousDelta;
   for(let j=0;j<20;j++){const mid=(lo+hi)/2,value=delta(mid);if(loDelta*value<=0)hi=mid;else{lo=mid;loDelta=value;}}
   return (lo+hi)/2;
  }
  previous=next;previousDelta=nextDelta;
 }
 return null;
}

export function pickWorldAim(raycaster,scene,{terrain=null,water=null,time=0,maxDistance=30}={}){
 raycaster.far=Math.min(30,maxDistance);
 // Entity movement runs before aiming; do not use last render's matrices. Moving
 // objects update their own matrices; a forced update would recompute every
 // static matrix in the scene a second time each frame (H94).
 scene.updateMatrixWorld();
 const hit=raycaster.intersectObjects(collectAimMeshes(scene),false)[0];if(!hit)return null;
 const far=hit.distance-1e-5;
 if(terrain&&terrainRayDistance(raycaster.ray,terrain,raycaster.near,far)!==null)return null;
 if(water&&waterRayDistance(raycaster.ray,water,raycaster.near,far,time)!==null)return null;
 return worldHitTarget(hit);
}

export function worldHitTarget(hit){
 if(hit.object.userData?.instanceTargets)return hit.object.userData.instanceTargets[hit.instanceId]??null;
 let target=null;for(let object=hit.object;object;object=object.parent)if(object.userData?.target)target=object.userData.target;
 return target;
}
