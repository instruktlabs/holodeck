import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {materialSignature,setTextureKey,shareMaterials,tagGltfTextures,textureKey} from './material-share.mjs';

const keyed=key=>{const texture=new THREE.Texture();setTextureKey(texture,key);return texture;};

test('texture images are keyed by the SHA-256 of their bytes, from the host\'s file name or computed (H100)',async()=>{
 const hashed='a'.repeat(64),host=new THREE.Texture(),embedded=new THREE.Texture(),bytes=new TextEncoder().encode('travertine').buffer;
 const gltf={parser:{json:{images:[{uri:`../textures/${hashed}.png`},{bufferView:0},{uri:'textures/stone.png'}],textures:[{source:0},{source:1},{source:2}]},
  getDependency:async(type,index)=>{assert.equal(type,'bufferView');assert.equal(index,0);return bytes;},associations:new Map([[host,{textures:0}],[embedded,{textures:1}]])}};
 const unkeyed=new THREE.Texture();gltf.parser.associations.set(unkeyed,{textures:2});
 assert.equal(await tagGltfTextures(gltf),gltf);
 assert.equal(textureKey(host),`sha256:${hashed}`);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 assert.equal(textureKey(embedded),`sha256:${digest}`);
 assert.equal(textureKey(embedded.clone()),textureKey(embedded),'a clone made for a UV channel or transform shares its image');
 assert.equal(textureKey(unkeyed),null,'a URI the host did not content-address is not trusted');
 const same={parser:{json:{images:[{uri:`../textures/${digest}.png`}],textures:[{source:0}]},associations:new Map()}},moved=new THREE.Texture();same.parser.associations.set(moved,{textures:0});
 await tagGltfTextures(same);assert.equal(textureKey(moved),textureKey(embedded),'the host\'s key and the computed one agree');
});

test('materials sign by type, parameters and texture content; node, transparent and unkeyed materials never share',()=>{
 const make=(extra={})=>new THREE.MeshStandardMaterial({color:'#e8dcc8',roughness:.6,map:keyed('sha256:1'),normalMap:keyed('sha256:2'),...extra});
 const a=make(),b=make();a.name='travertine-a';b.name='travertine-b';
 assert.ok(materialSignature(a));assert.equal(materialSignature(a),materialSignature(b),'names and IDs do not matter');
 for(const change of [{roughness:.61},{color:'#e8dcc9'},{map:keyed('sha256:3')},{side:THREE.DoubleSide},{vertexColors:true}])assert.notEqual(materialSignature(make(change)),materialSignature(a),JSON.stringify(Object.keys(change)));
 const repeated=make();repeated.map=a.map.clone();repeated.map.repeat.set(2,2);assert.notEqual(materialSignature(repeated),materialSignature(a),'texture transforms count');
 assert.equal(materialSignature(make({map:new THREE.Texture()})),null,'an unkeyed texture');
 assert.equal(materialSignature(make({transparent:true})),null);
 assert.equal(materialSignature(new THREE.MeshStandardNodeMaterial()),null,'node materials carry behaviour');
 const physical=extra=>new THREE.MeshPhysicalMaterial({roughness:.3,...extra});
 assert.notEqual(materialSignature(physical({clearcoat:.5})),materialSignature(physical({clearcoat:0})),'accessor-backed extensions count');
});

test('shared materials replace identical copies across assets without touching the loaded models',()=>{
 const material=()=>new THREE.MeshStandardMaterial({color:'#efe6d6',map:keyed('sha256:stone')});
 const model=m=>{const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),m));return {scene};};
 const first=material(),second=material(),other=new THREE.MeshStandardMaterial({color:'#2f5d3a'});
 const models={a:model(first),b:model(second),c:model(other)},result=shareMaterials(models);
 assert.equal(result.shared,1);assert.equal(result.models.a,models.a,'the first holder keeps its model');assert.equal(result.models.c,models.c);
 assert.notEqual(result.models.b,models.b);assert.equal(result.models.b.scene.children[0].material,first);
 assert.equal(models.b.scene.children[0].material,second,'the loaded model is untouched');
 assert.equal(result.models.b.scene.children[0].geometry,models.b.scene.children[0].geometry,'geometry is shared, not copied');
});
