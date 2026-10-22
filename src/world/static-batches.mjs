import * as THREE from 'three/webgpu';
import {bindAssetFoliage} from './asset-foliage.mjs';

function compatibleModel(source){
 if(!source)return false;let compatible=true,meshes=0;
 source.traverseVisible(node=>{if(!node.isMesh)return;meshes++;
  if(node.isSkinnedMesh||Object.keys(node.geometry.morphAttributes).length||(Array.isArray(node.material)?node.material:[node.material]).some(m=>m.transparent||m.transmission>0))compatible=false;
  // InstancedMesh cannot render mirrored transformations correctly.
  for(let p=node;p;p=p.parent)if(p.scale.x*p.scale.y*p.scale.z<0)compatible=false;
  if(node.isInstancedMesh){const matrix=new THREE.Matrix4();for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);if(matrix.determinant()<0)compatible=false;}}
 });return compatible&&meshes>0;
}
export function planStaticBatches(items,models,{cellSize=96}={}){
 if(!Number.isFinite(cellSize)||cellSize<0)throw new Error('Static batch cell size must be zero or a positive finite distance');
 const groups=new Map(),support=new Map(),individual=[];
 for(const item of items){
  if(!support.has(item.asset))support.set(item.asset,compatibleModel(models[item.asset]?.scene));
  if(!item.asset||item.behavior||item.light||item.materialStyle==='cove'||!support.get(item.asset)){individual.push(item);continue;}
  const key=`${item.asset}:${item.layer??'world'}`;
  if(!groups.has(key))groups.set(key,{key,asset:item.asset,layer:item.layer??'world',items:[]});groups.get(key).items.push(item);
 }
 const batches=[];
 const retain=group=>{if(group.items.length>1)batches.push(group);else individual.push(...group.items);};
 for(const group of groups.values()){
  const xs=group.items.map(i=>i.position[0]),zs=group.items.map(i=>i.position[2]);
  // Keep compact sets (including the Cove) together even across a grid edge.
  // Larger sets gain ordinary Three frustum/shadow culling per spatial cell;
  // actual source bounds, including foliage motion, still bound each mesh.
  if(!cellSize||(Math.max(...xs)-Math.min(...xs)<=cellSize&&Math.max(...zs)-Math.min(...zs)<=cellSize)){retain(group);continue;}
  const cells=new Map();
  for(const item of group.items){const x=Math.floor(item.position[0]/cellSize),z=Math.floor(item.position[2]/cellSize),key=`${group.key}:cell:${x},${z}`;if(!cells.has(key))cells.set(key,{...group,key,cell:[x,z],items:[]});cells.get(key).items.push(item);}
  for(const cell of cells.values())retain(cell);
 }
 return {batches,individual};
}

// A render-only derivative. Runtime placements and loader-owned buffers remain
// unchanged; instanceTargets retains semantic identity for click and aim queries
// (a scatter instance answers with its scatter record ID).
export function createStaticAssetBatch(source,items,{foliage,environment={}}={}){
 if(!compatibleModel(source))throw new Error('Asset is not compatible with static instancing');
 const clone=source.clone(true),binding=bindAssetFoliage(clone,foliage,environment),root=new THREE.Group(),meshes=[];
 clone.updateMatrixWorld(true);const placement=new THREE.Object3D(),matrix=new THREE.Matrix4(),inner=new THREE.Matrix4(),color=new THREE.Color();
 const transforms=items.map(item=>{placement.position.fromArray(item.position);placement.rotation.set(...item.rotation);placement.scale.fromArray(item.scale);placement.updateMatrix();return placement.matrix.clone();});
 clone.traverseVisible(part=>{
  if(!part.isMesh)return;const sourceCount=part.isInstancedMesh?part.count:1,mesh=new THREE.InstancedMesh(part.geometry,part.material,items.length*sourceCount),targets=[];let maxScale=0;
  mesh.name=part.name;mesh.castShadow=true;mesh.receiveShadow=true;
  for(let i=0;i<items.length;i++)for(let j=0;j<sourceCount;j++){
   const index=i*sourceCount+j;matrix.multiplyMatrices(transforms[i],part.matrixWorld);
   if(part.isInstancedMesh){part.getMatrixAt(j,inner);matrix.multiply(inner);}
   mesh.setMatrixAt(index,matrix);targets.push(items[i].scatter??items[i].id);maxScale=Math.max(maxScale,matrix.getMaxScaleOnAxis());
   if(part.instanceColor){part.getColorAt(j,color);mesh.setColorAt(index,color);}
  }
  mesh.userData={instanceTargets:targets,sourcePart:part.name};mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.computeBoundingBox();
  if(foliage?.wind&&foliage.nodes.includes(part.name)){const margin=foliage.wind.amplitude*maxScale*1.01;mesh.boundingSphere.radius+=margin;mesh.boundingBox.expandByScalar(margin);}
  meshes.push(mesh);root.add(mesh);
 });
 let disposed=false;return {root,meshes,update(time){binding.update(time);},dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.dispose();binding.dispose();root.clear();}};
}
