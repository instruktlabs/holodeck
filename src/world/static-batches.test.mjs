import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SPLIT_ABOVE,planStaticBatches,createStaticAssetBatch} from './static-batches.mjs';
const item=(id,extra={})=>({id,asset:'plant',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null,...extra});
function source(){const root=new THREE.Group(),pivot=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.3,1,.3),new THREE.MeshStandardMaterial({color:'#456537'}));mesh.name='leaf';mesh.position.set(.2,.4,-.3);pivot.position.set(0,.3,0);pivot.rotation.y=.4;pivot.add(mesh);root.add(pivot);return root;}
test('batch plan includes only repeated compatible static assets and preserves individual data',()=>{
 const plant=source(),models={plant:{scene:plant}},items=[item('a'),item('b'),item('origin-a',{layer:'origin'}),item('origin-b',{layer:'origin'}),item('moving',{behavior:{type:'spin'}}),item('lit',{light:{}}),item('styled',{materialStyle:'cove'}),item('shape',{asset:undefined,shape:{type:'box'}})];
 const before=structuredClone(items),plan=planStaticBatches(items,models);assert.equal(plan.batches.length,2);assert.deepEqual(plan.batches.map(b=>b.items.map(i=>i.id)),[['a','b'],['origin-a','origin-b']]);assert.deepEqual(plan.individual.map(i=>i.id),['moving','lit','styled','shape']);assert.deepEqual(items,before);
 plant.children[0].children[0].material.transparent=true;assert.equal(planStaticBatches(items,models).batches.length,0);
});
test('batch matrices preserve nested primitive and placement transforms without changing source',()=>{
 const model=source(),items=[item('a',{position:[3,0,-2],rotation:[0,.8,0],scale:[2,2,2]}),item('b',{position:[-2,0,4],rotation:[0,-.4,0],scale:[1,.7,1]})];model.updateMatrixWorld(true);const original=model.children[0].children[0],matrix=original.matrixWorld.clone(),batch=createStaticAssetBatch(model,items);
 assert.equal(batch.meshes.length,1);const mesh=batch.meshes[0];assert.equal(mesh.count,2);assert.equal(mesh.geometry,original.geometry);assert.equal(mesh.material,original.material);assert.deepEqual(mesh.userData.instanceTargets,['a','b']);
 items.forEach((i,index)=>{const obj=new THREE.Object3D();obj.position.fromArray(i.position);obj.rotation.fromArray(i.rotation);obj.scale.fromArray(i.scale);obj.updateMatrix();const expected=obj.matrix.multiply(matrix),actual=new THREE.Matrix4();mesh.getMatrixAt(index,actual);actual.elements.forEach((v,j)=>assert.ok(Math.abs(v-expected.elements[j])<1e-6));});
 assert.deepEqual(original.matrixWorld.elements,matrix.elements);let geometryDisposed=0,materialDisposed=0;original.geometry.addEventListener('dispose',()=>geometryDisposed++);original.material.addEventListener('dispose',()=>materialDisposed++);batch.dispose();batch.dispose();assert.equal(geometryDisposed,0);assert.equal(materialDisposed,0);
});
test('nested GLB instances keep instance colors and each semantic placement mapping',()=>{
 const root=new THREE.Group(),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),2);mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1,0,0));mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-1,0,0));mesh.setColorAt(0,new THREE.Color('red'));mesh.setColorAt(1,new THREE.Color('blue'));root.add(mesh);
 const batch=createStaticAssetBatch(root,[item('a'),item('b',{position:[4,0,0]})]),result=batch.meshes[0],m=new THREE.Matrix4(),c=new THREE.Color();assert.equal(result.count,4);assert.deepEqual(result.userData.instanceTargets,['a','a','b','b']);result.getMatrixAt(3,m);assert.equal(m.elements[12],3);result.getColorAt(3,c);assert.equal(c.getHexString(),'0000ff');batch.dispose();
});
test('foliage bindings reuse source geometry and release only their derived materials',()=>{
 const model=source(),original=model.children[0].children[0].material,config={nodes:['leaf'],translucency:.18,wind:{amplitude:.08,frequency:1,direction:[1,0],weight:'uv-y'}},batch=createStaticAssetBatch(model,[item('a'),item('b')],{foliage:config});
 assert.notEqual(batch.meshes[0].material,original);assert.equal(batch.meshes[0].material.color.getHex(),original.color.getHex());assert.ok(batch.meshes[0].boundingSphere.radius>0);batch.update(2);let disposed=0;batch.meshes[0].material.addEventListener('dispose',()=>disposed++);batch.dispose();assert.equal(disposed,1);assert.equal(model.children[0].children[0].material,original);
});
test('large static groups split into stable 96 metre cells while compact groups stay together across cell boundaries',()=>{
 const model=source(),models={plant:{scene:model}},items=[item('a',{position:[4,0,4]}),item('b',{position:[8,0,8]}),item('c',{position:[140,0,4]}),item('d',{position:[144,0,8]})],before=structuredClone(items),plan=planStaticBatches(items,models,{splitAbove:0});assert.equal(plan.batches.length,2);assert.deepEqual(plan.batches.map(b=>b.items.map(i=>i.id)),[['a','b'],['c','d']]);assert.notEqual(plan.batches[0].key,plan.batches[1].key);assert.deepEqual(items,before);assert.equal(planStaticBatches(items,models,{cellSize:0,splitAbove:0}).batches.length,1);
 assert.deepEqual(plan.batches[1].cell,[1,0]);assert.deepEqual(planStaticBatches(items,models,{cellSize:64,splitAbove:0}).batches[1].cell,[2,0]);const compact=[item('left',{position:[-2,0,-2]}),item('right',{position:[2,0,2]})];assert.equal(planStaticBatches(compact,models,{splitAbove:0}).batches.length,1);assert.equal(planStaticBatches(items,models,{cellSize:256,splitAbove:0}).batches.length,1);
});
test('spatial batches cull distant clusters without losing semantic IDs or foliage bindings',()=>{
 const model=source(),models={plant:{scene:model}},items=[];for(const [x,z] of [[0,0],[192,0],[0,192],[192,192]])for(let i=0;i<16;i++)items.push(item(`plant-${items.length}`,{position:[x+8+i%4*3,0,z+8+Math.floor(i/4)*3]}));
 const camera=new THREE.PerspectiveCamera(55,1,.1,80);camera.position.set(13,6,40);camera.lookAt(13,1,10);camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const foliage={nodes:['leaf'],wind:{amplitude:.08,frequency:1,direction:[1,0],weight:'uv-y'}},build=cellSize=>planStaticBatches(items,models,{cellSize}).batches.map(b=>createStaticAssetBatch(model,b.items,{foliage})),global=build(0),chunks=build(64);for(const b of [...global,...chunks])b.root.updateMatrixWorld(true);
 const submitted=batches=>batches.flatMap(b=>b.meshes).filter(m=>m.intersectsFrustum(frustum)).reduce((n,m)=>n+m.count,0);assert.equal(submitted(global),64);assert.equal(submitted(chunks),16);assert.deepEqual(chunks.flatMap(b=>b.meshes[0].userData.instanceTargets).sort(),items.map(i=>i.id).sort());assert.equal(new Set(chunks.map(b=>b.meshes[0].material)).size,1);for(const b of [...global,...chunks])b.dispose();
});

test('a set of at most SPLIT_ABOVE placements stays one batch however far it spreads (H71)',()=>{
 const model=source(),models={plant:{scene:model}},spread=n=>Array.from({length:n},(_,i)=>item(`p${i}`,{position:[i*40,0,(i%3)*90]}));
 assert.equal(planStaticBatches(spread(SPLIT_ABOVE),models).batches.length,1);
 assert.ok(planStaticBatches(spread(SPLIT_ABOVE+1),models).batches.length>1,'larger sets still split for culling');
});

test('placements kept out of the shadow map batch apart and their instanced meshes cast nothing (H79)',()=>{
 const model=source(),models={plant:{scene:model}},items=[item('a',{position:[0,0,0]}),item('b',{position:[2,0,0]}),item('c',{position:[4,40,0],castShadow:false}),item('d',{position:[6,40,0],castShadow:false})];
 const plan=planStaticBatches(items,models);assert.equal(plan.batches.length,2);
 const quiet=plan.batches.find(b=>b.castShadow===false),casting=plan.batches.find(b=>b.castShadow);
 assert.deepEqual(quiet.items.map(i=>i.id),['c','d']);assert.deepEqual(casting.items.map(i=>i.id),['a','b']);
 const built=createStaticAssetBatch(model,quiet.items);assert.ok(built.meshes.every(m=>m.castShadow===false&&m.receiveShadow));
 const shadowed=createStaticAssetBatch(model,casting.items);assert.ok(shadowed.meshes.every(m=>m.castShadow));
 built.dispose();shadowed.dispose();
});
