import * as THREE from 'three/webgpu';
import {bindAssetFoliage} from './asset-foliage.mjs';
import {bindAssetFlow} from './asset-flow.mjs';
import {bindAssetReflection} from './asset-reflection.mjs';

function compatibleModel(source){
 if(!source)return false;let compatible=true,meshes=0;
 source.traverseVisible(node=>{if(!node.isMesh)return;meshes++;
  // Transparent parts batch too, their instances sorted back to front each frame
  // (H101); transmission needs its own pass.
  if(node.isSkinnedMesh||Object.keys(node.geometry.morphAttributes).length||(Array.isArray(node.material)?node.material:[node.material]).some(m=>m.transmission>0))compatible=false;
  // InstancedMesh cannot render mirrored transformations correctly.
  for(let p=node;p;p=p.parent)if(p.scale.x*p.scale.y*p.scale.z<0)compatible=false;
  if(node.isInstancedMesh){const matrix=new THREE.Matrix4();for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);if(matrix.determinant()<0)compatible=false;}}
 });return compatible&&meshes>0;
}
// The shadow pass draws a part as solid whatever its opacity, so a foam ring or a
// mist card left a dark print on the floor under it (H105).
export const translucent=part=>[].concat(part.material).every(m=>m?.transparent===true);
// Only sets of more than SPLIT_ABOVE placements split into cells. A draw costs
// about 50 µs a pass on a mid-range laptop GPU (H62) while a few dozen extra
// instances cost almost nothing, so a sparse set such as cubes scattered across
// the sky stays one draw however far it spreads (H71).
export const SPLIT_ABOVE=32;
// Nor do light sets (H99). Each draw is drawn again by the water mirror and the sun
// shadow, about 35–50 µs of CPU per pass (H94), while the hub laptop's GPU spends
// about 0.1 ms on 300k triangles of instances outside the view. A set splits only
// when it carries more than SPLIT_TRIANGLES in all: the gateway or a wall of
// detailed blocks, not a scatter of parapets or planters.
export const SPLIT_TRIANGLES=200000;
function modelTriangles(source){let triangles=0;source?.traverseVisible(node=>{if(node.isMesh)triangles+=(node.geometry.index?node.geometry.index.count:node.geometry.attributes.position.count)/3*(node.isInstancedMesh?node.count:1);});return triangles;}
export function planStaticBatches(items,models,{cellSize=96,splitAbove=SPLIT_ABOVE,splitTriangles=SPLIT_TRIANGLES}={}){
 if(!Number.isFinite(cellSize)||cellSize<0)throw new Error('Static batch cell size must be zero or a positive finite distance');
 const groups=new Map(),support=new Map(),triangles=new Map(),individual=[];
 for(const item of items){
  if(!support.has(item.asset))support.set(item.asset,compatibleModel(models[item.asset]?.scene));
  if(!item.asset||item.behavior||item.light||item.materialStyle==='cove'||!support.get(item.asset)){individual.push(item);continue;}
  // Placements kept out of the shadow map (castShadow:false, H79) batch apart.
  const casts=item.castShadow!==false,key=`${item.asset}:${item.layer??'world'}${casts?'':':noshadow'}`;
  if(!groups.has(key))groups.set(key,{key,asset:item.asset,layer:item.layer??'world',castShadow:casts,items:[]});groups.get(key).items.push(item);
 }
 const batches=[];
 const retain=group=>{if(group.items.length>1)batches.push(group);else individual.push(...group.items);};
 for(const group of groups.values()){
  const xs=group.items.map(i=>i.position[0]),zs=group.items.map(i=>i.position[2]);
  // Keep compact sets (including the Cove) together even across a grid edge.
  // Larger sets gain ordinary Three frustum/shadow culling per spatial cell;
  // actual source bounds, including foliage motion, still bound each mesh.
  if(!triangles.has(group.asset))triangles.set(group.asset,modelTriangles(models[group.asset]?.scene));
  if(!cellSize||group.items.length<=splitAbove||triangles.get(group.asset)*group.items.length<=splitTriangles||(Math.max(...xs)-Math.min(...xs)<=cellSize&&Math.max(...zs)-Math.min(...zs)<=cellSize)){retain(group);continue;}
  const cells=new Map();
  for(const item of group.items){const x=Math.floor(item.position[0]/cellSize),z=Math.floor(item.position[2]/cellSize),key=`${group.key}:cell:${x},${z}`;if(!cells.has(key))cells.set(key,{...group,key,cell:[x,z],items:[]});cells.get(key).items.push(item);}
  for(const cell of cells.values())retain(cell);
 }
 return {batches,individual};
}

// A render-only derivative. Runtime placements and loader-owned buffers remain
// unchanged; instanceTargets retains semantic identity for click and aim queries
// (a scatter instance answers with its scatter record ID).
export function createStaticAssetBatch(source,items,{foliage,flow,reflection,sky,environment={},skip=null}={}){
 if(!compatibleModel(source))throw new Error('Asset is not compatible with static instancing');
 const clone=source.clone(true),binding=bindAssetFoliage(clone,foliage,environment),flowing=bindAssetFlow(clone,flow),reflecting=bindAssetReflection(clone,reflection,sky),root=new THREE.Group(),meshes=[];
 clone.updateMatrixWorld(true);const placement=new THREE.Object3D(),matrix=new THREE.Matrix4(),inner=new THREE.Matrix4(),color=new THREE.Color();
 const transforms=items.map(item=>{placement.position.fromArray(item.position);placement.rotation.set(...item.rotation);placement.scale.fromArray(item.scale);placement.updateMatrix();return placement.matrix.clone();});
 let partIndex=-1;const sorted=[];
 clone.traverseVisible(part=>{
  // Parts baked into a shared-material mesh (H100) are drawn there.
  if(!part.isMesh)return;partIndex++;if(skip?.has(partIndex))return;const sourceCount=part.isInstancedMesh?part.count:1,mesh=new THREE.InstancedMesh(part.geometry,part.material,items.length*sourceCount),targets=[];let maxScale=0;
  // Water casts no sun shadow (H97), nor does any wholly translucent part (H105).
  mesh.name=part.name;mesh.castShadow=items.every(item=>item.castShadow!==false)&&!part.userData.flowing&&!translucent(part);mesh.receiveShadow=true;
  for(let i=0;i<items.length;i++)for(let j=0;j<sourceCount;j++){
   const index=i*sourceCount+j;matrix.multiplyMatrices(transforms[i],part.matrixWorld);
   if(part.isInstancedMesh){part.getMatrixAt(j,inner);matrix.multiply(inner);}
   mesh.setMatrixAt(index,matrix);targets.push(items[i].scatter??items[i].id);maxScale=Math.max(maxScale,matrix.getMaxScaleOnAxis());
   if(part.instanceColor){part.getColorAt(j,color);mesh.setColorAt(index,color);}
  }
  mesh.userData={instanceTargets:targets,sourcePart:part.name,...(part.userData.skyCaptureMaterial?{skyCaptureMaterial:part.userData.skyCaptureMaterial}:{})};mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.computeBoundingBox();
  if(foliage?.wind&&foliage.nodes.includes(part.name)){const margin=foliage.wind.amplitude*maxScale*1.01;mesh.boundingSphere.radius+=margin;mesh.boundingBox.expandByScalar(margin);}
  // Instances that never move or reorder are static to three: passes without a velocity
  // target (the mirror, the sun shadow) skip their per-object refresh (H113).
  const sorts=(Array.isArray(part.material)?part.material:[part.material]).some(m=>m.transparent);mesh.static=!sorts;
  meshes.push(mesh);root.add(mesh);
  if(sorts)sorted.push({mesh,repeats:sourceCount,matrices:mesh.instanceMatrix.array.slice(),colors:mesh.instanceColor?.array.slice()??null,targets:[...targets]});
 });
 // Three sorts transparent objects, not the instances inside one, so a batch of
 // waterfall sheets is reordered back to front from the view each frame; the
 // upload happens only when the order changes (H101).
 const centers=transforms.map(t=>new THREE.Vector3().setFromMatrixPosition(t)),eye=new THREE.Vector3(),distance=new Float64Array(items.length);
 let order=items.map((_,i)=>i);
 function sort(camera){
  if(!sorted.length||items.length<2)return;camera.getWorldPosition(eye);
  for(let i=0;i<items.length;i++)distance[i]=centers[i].distanceToSquared(eye);
  const next=[...order].sort((a,b)=>distance[b]-distance[a]);if(next.every((v,k)=>v===order[k]))return;order=next;
  for(const s of sorted){
   const m=s.mesh.instanceMatrix.array,c=s.mesh.instanceColor?.array,t=s.mesh.userData.instanceTargets;
   for(let k=0;k<order.length;k++)for(let j=0;j<s.repeats;j++){const to=k*s.repeats+j,from=order[k]*s.repeats+j;m.set(s.matrices.subarray(from*16,from*16+16),to*16);if(c)c.set(s.colors.subarray(from*3,from*3+3),to*3);t[to]=s.targets[from];}
   s.mesh.instanceMatrix.needsUpdate=true;if(c)s.mesh.instanceColor.needsUpdate=true;
  }
 }
 let disposed=false;return {root,meshes,sort,update(time){binding.update(time);flowing.update(time);},dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.dispose();binding.dispose();flowing.dispose();reflecting.dispose();root.clear();}};
}
