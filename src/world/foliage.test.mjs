import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,InstancedMesh,Matrix4,Vector3,PlaneGeometry,MeshStandardMaterial,MeshPhysicalMaterial,Texture,DataTexture} from 'three/webgpu';
import {validateFoliage,validateFoliageBinding} from './foliage-contract.mjs';
import {bindAssetFoliage,sampleFoliageWind} from './asset-foliage.mjs';
import {createStaticAssetBatch} from './static-batches.mjs';
const config=()=>({nodes:['palm-leaf'],translucency:.18,wind:{amplitude:.08,frequency:1.2,direction:[1,0],weight:'uv-y'}});
const document=()=>({nodes:[{name:'palm-leaf',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},material:0}]}],accessors:[{count:3,type:'VEC3',componentType:5126},{count:3,type:'VEC2',componentType:5126}],materials:[{}]});
test('foliage fields are explicit, bounded and reject inferred or unsupported weights',()=>{
 validateFoliage(config());validateFoliage({nodes:['leaf']});
 for(const change of [{nodes:[]},{nodes:['leaf','leaf']},{translucency:2},{wind:{...config().wind,amplitude:.5}},{wind:{...config().wind,direction:[2,0]}},{wind:{...config().wind,weight:'auto'}},{unknown:true}])assert.throws(()=>validateFoliage({...config(),...change}),/foliage|wind/i);
});
test('GLB leaf binding rejects missing, ambiguous and UV-incompatible mesh nodes',()=>{
 validateFoliageBinding(document(),config());
 const missing=document();missing.nodes[0].name='trunk';assert.throws(()=>validateFoliageBinding(missing,config()),/palm-leaf.*exactly one/i);
 const ambiguous=document();ambiguous.nodes.push({...ambiguous.nodes[0]});assert.throws(()=>validateFoliageBinding(ambiguous,config()),/exactly one/i);
 const uvMissing=document();delete uvMissing.meshes[0].primitives[0].attributes.TEXCOORD_0;assert.throws(()=>validateFoliageBinding(uvMissing,config()),/UV|TEXCOORD/i);
 const grouped=document();grouped.meshes[0].primitives.push({...grouped.meshes[0].primitives[0]});assert.throws(()=>validateFoliageBinding(grouped,config()),/single primitive/i);
});
test('wind is deterministic, bounded and leaves UV-base vertices exactly anchored',()=>{
 const wind=config().wind;
 for(let i=0;i<200;i++){
  const time=i*.13;assert.deepEqual(sampleFoliageWind(wind,0,time,[4,0,-2]),[0,0,0]);
  const a=sampleFoliageWind(wind,1,time,[4,0,-2]);assert.deepEqual(a,sampleFoliageWind(wind,1,time,[4,0,-2]));assert.ok(Math.hypot(a[0],a[2])<=wind.amplitude+.00001);assert.ok(Math.abs(a[1])<=wind.amplitude*.12+.00001);
 }
});
test('only explicit leaves receive shared materials, preserving authored maps/colors and resource ownership',()=>{
 const material=new MeshStandardMaterial({color:'#518839',map:new Texture(),vertexColors:true}),geometry=new PlaneGeometry(),source=new Group();
 for(const name of ['palm-leaf','trunk']){const mesh=new Mesh(geometry,material);mesh.name=name;source.add(mesh);}
 const a=source.clone(true),b=source.clone(true),first=bindAssetFoliage(a,config()),second=bindAssetFoliage(b,config());
 assert.equal(a.getObjectByName('trunk').material,material);assert.equal(source.getObjectByName('palm-leaf').material,material);
 const leaf=a.getObjectByName('palm-leaf').material;assert.notEqual(leaf,material);assert.equal(leaf,b.getObjectByName('palm-leaf').material);assert.equal(leaf.map,material.map);assert.equal(leaf.color.getHex(),material.color.getHex());assert.equal(leaf.vertexColors,true);
 let released=0;leaf.addEventListener('dispose',()=>released++);first.dispose();assert.equal(released,0);second.update(1);second.dispose();second.dispose();assert.equal(released,1);
 material.map.dispose();material.dispose();geometry.dispose();
});
for(const Material of [MeshStandardMaterial,MeshPhysicalMaterial])test(`masked ${Material.name} foliage retains its cutoff in plain and instanced placements`,()=>{
 const map=new DataTexture(new Uint8Array([20,80,30,0,20,80,30,255]),2,1),material=new Material({map,alphaTest:.32}),geometry=new PlaneGeometry(),source=new Group();
 const mesh=new Mesh(geometry,material);mesh.name='palm-leaf';source.add(mesh);
 const version=material.version,plain=source.clone(true),binding=bindAssetFoliage(plain,config());
 const items=[0,1].map(i=>({id:`plant-${i}`,position:[i*2,0,0],rotation:[0,0,0],scale:[1,1,1]})),batch=createStaticAssetBatch(source,items,{foliage:config()});
 let mapDisposals=0;map.addEventListener('dispose',()=>mapDisposals++);
 try{
  const leaf=plain.getObjectByName('palm-leaf').material,instanced=batch.meshes[0];
  assert.equal(leaf.alphaTest,.32);assert.equal(instanced.material.alphaTest,.32);
  assert.equal(instanced.isInstancedMesh,true);assert.equal(instanced.count,2);assert.equal(instanced.material,leaf);
  assert.equal(leaf.map,map);assert.equal(leaf.transparent,false);assert.notEqual(leaf,material);
  assert.equal(source.getObjectByName('palm-leaf').material,material);assert.equal(material.alphaTest,.32);assert.equal(material.map,map);assert.equal(material.version,version);
 }finally{binding.dispose();batch.dispose();}
 assert.equal(plain.getObjectByName('palm-leaf').material,material);assert.equal(mapDisposals,0);
 map.dispose();material.dispose();geometry.dispose();
});
test('wind bounds retain every authored GLB instance and restore ownership on cleanup',()=>{
 const root=new Group(),mesh=new InstancedMesh(new PlaneGeometry(),new MeshStandardMaterial(),2);mesh.name='palm-leaf';mesh.setMatrixAt(0,new Matrix4().makeTranslation(-12,0,0));mesh.setMatrixAt(1,new Matrix4().makeTranslation(12,0,0));root.add(mesh);
 const lease=bindAssetFoliage(root,config());assert.ok(mesh.boundingSphere.containsPoint(new Vector3(12,0,0)));assert.ok(mesh.boundingSphere.containsPoint(new Vector3(-12,0,0)));lease.dispose();assert.equal(mesh.boundingSphere,null);
});
