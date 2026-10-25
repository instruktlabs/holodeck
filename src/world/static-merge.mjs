import * as THREE from 'three/webgpu';

// Static merging across assets (H100). Instancing draws each repeated asset part
// once per pass, so a world built from a kit of twenty stone pieces draws twenty
// times in the view, again in the water mirror and again in the sun shadow, and
// three spends about 35-50 µs of CPU on each. Once identical materials are one
// instance (material-share.mjs), every static part in the same material bakes
// into one mesh in world space: one draw per material and pass. Each piece keeps
// its placement ID through a per-piece raycast. Parts with foliage, flow or
// reflection bindings, transparency or instance colours keep the instanced path,
// as do materials only one asset uses, which instancing already draws once.
export const MAX_MERGED_VERTICES=3000000;

function attributeKey(geometry){return Object.keys(geometry.attributes).sort().map(name=>`${name}:${geometry.attributes[name].itemSize}`).join(',');}
function mergeable(part){
 const material=part.material,geometry=part.geometry;
 return part.isMesh&&!part.isSkinnedMesh&&material&&!Array.isArray(material)&&!material.transparent&&!(material.transmission>0)
  &&!!geometry.index&&!!geometry.attributes.position&&!part.instanceColor&&!Object.keys(geometry.morphAttributes).length;
}
function vertexCount(source){return source.part.geometry.attributes.position.count*source.items.length*(source.part.isInstancedMesh?source.part.count:1);}

// Plans merges over planned static batches. Returns the buckets to bake and, per
// batch key, the indices (in traverseVisible order) of the parts they take over.
export function planStaticMerge(batches,models,assets=[],{maxVertices=MAX_MERGED_VERTICES}={}){
 const bound=new Set(assets.filter(a=>a.foliage||a.flow||a.reflection).map(a=>a.id)),candidates=new Map();
 for(const batch of batches){
  if(bound.has(batch.asset))continue;
  const source=models[batch.asset]?.scene;if(!source)continue;
  source.updateMatrixWorld(true);let index=-1;
  source.traverseVisible(part=>{
   if(!part.isMesh)return;index++;if(!mergeable(part))return;
   const key=`${batch.layer}|${batch.castShadow?'cast':'still'}|${part.material.uuid}|${attributeKey(part.geometry)}`;
   let bucket=candidates.get(key);if(!bucket)candidates.set(key,bucket={key,layer:batch.layer,castShadow:batch.castShadow,material:part.material,sources:[]});
   bucket.sources.push({batch:batch.key,asset:batch.asset,part,index,items:batch.items});
  });
 }
 const buckets=[],skip=new Map();
 for(const bucket of candidates.values()){
  if(new Set(bucket.sources.map(s=>s.asset)).size<2)continue;
  let chunk=null,n=0;
  for(const source of bucket.sources){
   const count=vertexCount(source);
   if(!chunk||chunk.vertices+count>maxVertices){chunk={...bucket,key:`${bucket.key}#${n++}`,sources:[],vertices:0};buckets.push(chunk);}
   chunk.sources.push(source);chunk.vertices+=count;
   if(!skip.has(source.batch))skip.set(source.batch,new Set());skip.get(source.batch).add(source.index);
  }
 }
 return {buckets,skip};
}

const placement=new THREE.Object3D(),inner=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),point=new THREE.Vector3(),box=new THREE.Box3();
// Bakes a bucket into one mesh in world space. Attributes are written as Float32
// (normalized sources are expanded), normals and tangents follow each placement,
// and mirrored placements reverse their winding.
export function createMergedMesh(bucket){
 const pieces=[];
 for(const {part,items} of bucket.sources){
  const repeats=part.isInstancedMesh?part.count:1;
  for(const item of items){
   placement.position.fromArray(item.position);placement.rotation.set(...item.rotation);placement.scale.fromArray(item.scale);placement.updateMatrix();
   for(let j=0;j<repeats;j++){
    const matrix=placement.matrix.clone().multiply(part.matrixWorld);
    if(part.isInstancedMesh){part.getMatrixAt(j,inner);matrix.multiply(inner);}
    pieces.push({geometry:part.geometry,matrix,target:item.scatter??item.id});
   }
  }
 }
 const first=bucket.sources[0].part.geometry,names=Object.keys(first.attributes),sizes={};
 let vertices=0,indices=0;for(const piece of pieces){vertices+=piece.geometry.attributes.position.count;indices+=piece.geometry.index.count;}
 const arrays={};for(const name of names){sizes[name]=first.attributes[name].itemSize;arrays[name]=new Float32Array(vertices*sizes[name]);}
 const index=vertices>65535?new Uint32Array(indices):new Uint16Array(indices),parts=new Array(pieces.length);
 let v=0,i=0;
 for(let k=0;k<pieces.length;k++){
  const {geometry,matrix,target}=pieces[k],count=geometry.attributes.position.count,flip=matrix.determinant()<0;
  normalMatrix.getNormalMatrix(matrix);box.makeEmpty();
  for(const name of names){
   const source=geometry.attributes[name],out=arrays[name],size=sizes[name],base=v*size;
   if(name==='position')for(let j=0;j<count;j++){point.fromBufferAttribute(source,j).applyMatrix4(matrix);box.expandByPoint(point);out[base+j*3]=point.x;out[base+j*3+1]=point.y;out[base+j*3+2]=point.z;}
   else if(name==='normal')for(let j=0;j<count;j++){point.fromBufferAttribute(source,j).applyMatrix3(normalMatrix).normalize();out[base+j*3]=point.x;out[base+j*3+1]=point.y;out[base+j*3+2]=point.z;}
   else if(name==='tangent')for(let j=0;j<count;j++){point.set(source.getX(j),source.getY(j),source.getZ(j)).transformDirection(matrix);out[base+j*4]=point.x;out[base+j*4+1]=point.y;out[base+j*4+2]=point.z;out[base+j*4+3]=source.getW(j)*(flip?-1:1);}
   else for(let j=0;j<count;j++){out[base+j*size]=source.getX(j);if(size>1)out[base+j*size+1]=source.getY(j);if(size>2)out[base+j*size+2]=source.getZ(j);if(size>3)out[base+j*size+3]=source.getW(j);}
  }
  const start=i,from=geometry.index;
  for(let j=0;j<from.count;j+=3){const a=from.getX(j)+v,b=from.getX(j+1)+v,c=from.getX(j+2)+v;index[i++]=a;index[i++]=flip?c:b;index[i++]=flip?b:c;}
  parts[k]={start,count:from.count,target,box:box.clone(),sphere:box.getBoundingSphere(new THREE.Sphere())};
  v+=count;
 }
 const merged=new THREE.BufferGeometry();
 for(const name of names)merged.setAttribute(name,new THREE.BufferAttribute(arrays[name],sizes[name]));
 merged.setIndex(new THREE.BufferAttribute(index,1));merged.computeBoundingSphere();merged.computeBoundingBox();
 const mesh=new THREE.Mesh(merged,bucket.material);
 mesh.name=`merged ${bucket.material.name||'material'}`;mesh.castShadow=bucket.castShadow;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.static=true;
 mesh.userData={partTargets:parts.map(p=>p.target),mergedParts:parts.length};
 mesh.raycast=mergedRaycast(parts);
 return mesh;
}

// Tests the whole mesh's box, then each piece's box and sphere, then only that
// piece's triangles, and reports the piece as partId, as an InstancedMesh reports
// instanceId. Sphere alone was not enough: a ray over a long, flat piece passes
// through its loose sphere and walked every triangle, 10–17 ms an aim (H111).
// Instanced glTF parts keep the box their accessors give them.
const probe=new THREE.Mesh(new THREE.BufferGeometry()),hits=[],local=new THREE.Ray(),inverse=new THREE.Matrix4();
function mergedRaycast(parts){
 return function(raycaster,intersects){
  const geometry=this.geometry;
  local.copy(raycaster.ray).applyMatrix4(inverse.copy(this.matrixWorld).invert());
  if(!local.intersectsBox(geometry.boundingBox))return;
  probe.material=this.material;probe.matrixWorld.copy(this.matrixWorld);
  probe.geometry.index=geometry.index;probe.geometry.attributes=geometry.attributes;
  for(let k=0;k<parts.length;k++){
   const part=parts[k];if(!local.intersectsBox(part.box))continue;
   probe.geometry.boundingSphere=part.sphere;probe.geometry.boundingBox=part.box;probe.geometry.setDrawRange(part.start,part.count);
   probe.raycast(raycaster,hits);
   for(const hit of hits){hit.object=this;hit.partId=k;intersects.push(hit);}
   hits.length=0;
  }
  probe.material=null;probe.geometry.index=null;probe.geometry.attributes={};probe.geometry.boundingSphere=null;probe.geometry.boundingBox=null;probe.geometry.setDrawRange(0,Infinity);
 };
}
