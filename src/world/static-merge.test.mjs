import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {createMergedMesh,planStaticMerge} from './static-merge.mjs';
import {createStaticAssetBatch,planStaticBatches} from './static-batches.mjs';
import {collectAimMeshes,worldHitTarget} from './aim.mjs';

const item=(id,asset,extra={})=>({id,asset,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,...extra});
const model=(...meshes)=>{const scene=new THREE.Group();for(const mesh of meshes)scene.add(mesh);return {scene};};
const box=(material,{size=1,at=[0,0,0]}={})=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),material);mesh.position.set(...at);return mesh;};

test('pieces of different assets in one material merge; single-asset, bound and transparent parts stay instanced (H100)',()=>{
 const stone=new THREE.MeshStandardMaterial({color:'#e9e1d2'}),moss=new THREE.MeshStandardMaterial({color:'#3d5a2e'}),glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.5});
 const ivy=box(stone);ivy.name='x';
 const models={pier:model(box(stone),box(moss)),arch:model(box(stone,{size:2})),pane:model(box(glass)),ivy:model(ivy)};
 const items=[item('p1','pier'),item('p2','pier',{position:[5,0,0]}),item('a1','arch'),item('a2','arch',{position:[0,0,9]}),item('g1','pane'),item('g2','pane'),item('i1','ivy'),item('i2','ivy')];
 const {batches}=planStaticBatches(items,models),assets=[{id:'ivy',foliage:{nodes:['x']}}],plan=planStaticMerge(batches,models,assets);
 assert.equal(plan.buckets.length,1);const [bucket]=plan.buckets;
 assert.equal(bucket.material,stone);assert.deepEqual(bucket.sources.map(s=>s.asset).sort(),['arch','pier']);
 const pier=batches.find(b=>b.asset==='pier'),arch=batches.find(b=>b.asset==='arch');
 assert.deepEqual([...plan.skip.get(pier.key)],[0],'the pier hands its stone part over and keeps its moss');assert.deepEqual([...plan.skip.get(arch.key)],[0]);
 assert.equal(plan.skip.has(batches.find(b=>b.asset==='ivy').key),false,'a foliage node keeps its instanced binding');
 const instanced=createStaticAssetBatch(models.pier.scene,pier.items,{skip:plan.skip.get(pier.key)});
 assert.deepEqual(instanced.meshes.map(m=>m.material),[moss]);instanced.dispose();
 const shadowless=planStaticMerge(planStaticBatches(items.map(i=>i.asset==='arch'?{...i,castShadow:false}:i),models).batches,models,assets);
 assert.equal(shadowless.buckets.length,0,'a shadowless set does not share a mesh with casting ones');
 const split=planStaticMerge(batches,models,assets,{maxVertices:60});assert.equal(split.buckets.length,2,'large buckets split into chunks');
});

test('the stone of a waterfall or a planted asset merges; flowing and foliage nodes and reflecting assets stay instanced (H118)',()=>{
 const stone=new THREE.MeshStandardMaterial({color:'#e9e1d2'}),named=(name,mesh)=>{mesh.name=name;return mesh;};
 const models={falls:model(named('falls_sheet',box(stone)),named('falls_lip',box(stone,{at:[0,1,0]}))),planter:model(named('Mesh_cypress',box(stone)),named('pot',box(stone,{at:[0,-1,0]}))),arch:model(box(stone,{size:2})),cube:model(box(stone,{size:.5}))};
 const items=['falls','planter','arch','cube'].flatMap(a=>[item(a+'1',a),item(a+'2',a,{position:[6,0,0]})]);
 const assets=[{id:'falls',flow:{nodes:['falls_sheet'],speed:[0,1]}},{id:'planter',foliage:{nodes:['Mesh_cypress']}},{id:'cube',reflection:'sky'}];
 const {batches}=planStaticBatches(items,models),plan=planStaticMerge(batches,models,assets),key=a=>batches.find(b=>b.asset===a).key;
 assert.deepEqual(plan.buckets[0].sources.map(s=>s.asset).sort(),['arch','falls','planter'],'the lip and the pot join the arch');
 assert.deepEqual([...plan.skip.get(key('falls'))],[1],'the sheet keeps its flow binding');
 assert.deepEqual([...plan.skip.get(key('planter'))],[1],'the cypress keeps its foliage binding');
 assert.equal(plan.skip.has(key('cube')),false,'an asset with a reflection binding keeps every part');
});

test('a merged mesh puts every piece where instancing did, keeps winding when mirrored, and answers picks with its placement',()=>{
 const stone=new THREE.MeshStandardMaterial(),models={a:model(box(stone,{at:[0,1,0]})),b:model(box(stone,{size:.5}))};
 const items=[item('a1','a',{position:[3,0,-2],rotation:[0,.7,0],scale:[2,1,2]}),item('a2','a',{position:[-4,0,6],scale:[-1,1,1]}),item('b1','b',{position:[0,0,20]}),item('b2','b',{position:[8,0,20]})];
 const {buckets}=planStaticMerge(planStaticBatches(items,models).batches,models),mesh=createMergedMesh(buckets[0]);
 assert.equal(mesh.material,stone);assert.equal(mesh.userData.partTargets.length,4);assert.equal(mesh.static,true,'a merged mesh never moves (H113)');
 const vertices=24,position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,index=mesh.geometry.index;
 // Each piece's vertices equal the source vertices under the placement and part transforms.
 const placed=(entry,part)=>{const o=new THREE.Object3D();o.position.fromArray(entry.position);o.rotation.set(...entry.rotation);o.scale.fromArray(entry.scale);o.updateMatrix();part.updateMatrixWorld(true);return o.matrix.clone().multiply(part.matrixWorld);};
 const order=mesh.userData.partTargets,source=id=>({a1:models.a.scene.children[0],a2:models.a.scene.children[0],b1:models.b.scene.children[0],b2:models.b.scene.children[0]})[id];
 order.forEach((id,k)=>{const part=source(id),matrix=placed(items.find(i=>i.id===id),part);for(let j=0;j<vertices;j++){const expected=new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.position,j).applyMatrix4(matrix),actual=new THREE.Vector3().fromBufferAttribute(position,k*vertices+j);assert.ok(expected.distanceTo(actual)<1e-5,`${id} vertex ${j}`);}});
 // Every triangle still faces along its vertex normals, mirrored piece included.
 for(let t=0;t<index.count;t+=3){const [a,b,c]=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(position,index.getX(t+n)));const face=new THREE.Vector3().subVectors(c,b).cross(new THREE.Vector3().subVectors(a,b));const n=new THREE.Vector3().fromBufferAttribute(normal,index.getX(t));assert.ok(face.dot(n)>0,`triangle ${t/3}`);}
 mesh.updateMatrixWorld(true);
 const scene=new THREE.Scene();scene.add(mesh);assert.deepEqual(collectAimMeshes(scene),[mesh]);
 const ray=new THREE.Raycaster(new THREE.Vector3(8,.1,40),new THREE.Vector3(0,0,-1)),hits=ray.intersectObject(mesh);
 assert.ok(hits.length>0);assert.equal(worldHitTarget(hits[0]),'b2');assert.ok(Math.abs(hits[0].point.z-20.25)<1e-6);
 assert.equal(new THREE.Raycaster(new THREE.Vector3(100,0,0),new THREE.Vector3(0,1,0)).intersectObject(mesh).length,0);
 mesh.geometry.dispose();
});

test('a ray over a long flat piece is rejected by its box, never by walking its triangles (H111)',()=>{
 const stone=new THREE.MeshStandardMaterial(),slab=new THREE.Mesh(new THREE.BoxGeometry(40,.2,40,40,1,40),stone),post=box(stone);
 const models={floor:model(slab),pier:model(post)},items=[item('f1','floor'),item('f2','floor',{position:[0,0,60]}),item('p1','pier',{position:[0,0,-30]}),item('p2','pier',{position:[30,0,-30]})];
 const {buckets}=planStaticMerge(planStaticBatches(items,models).batches,models),mesh=createMergedMesh(buckets[0]);mesh.updateMatrixWorld(true);
 const walk=THREE.Mesh.prototype._computeIntersections;let walked=0;THREE.Mesh.prototype._computeIntersections=function(...args){walked++;return walk.apply(this,args);};
 try{
  // Just over both 0.2 m slabs, inside their 28 m spheres, along the axis to a pier.
  const over=new THREE.Raycaster(new THREE.Vector3(0,.3,90),new THREE.Vector3(0,0,-1));over.far=200;
  const hits=over.intersectObject(mesh);
  assert.equal(walked,1,'only the pier, whose box the ray meets, walks its triangles');
  assert.equal(hits.length>0&&worldHitTarget(hits[0]),'p1');
  walked=0;const down=new THREE.Raycaster(new THREE.Vector3(3,5,62),new THREE.Vector3(0,-1,0));
  assert.equal(worldHitTarget(down.intersectObject(mesh)[0]),'f2');assert.equal(walked,1,'a ray down meets one slab');
 }finally{THREE.Mesh.prototype._computeIntersections=walk;mesh.geometry.dispose();}
});
