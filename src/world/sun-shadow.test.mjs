import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,DirectionalLight,DoubleSide,FrontSide,Mesh,MeshStandardMaterial,PerspectiveCamera,PlaneGeometry,Vector3} from 'three/webgpu';
import {createTerrain} from './terrain.mjs';
import {SHADOW_ONLY_LAYER,SUN_SHADOW,configureSunShadow,shadowFadeAt,shadowProxies,shadowViewFocus} from './sun-shadow.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const terrain=createTerrain({type:'heightfield',bounds:[-40,40,-40,40],segments:[8,8],baseHeight:2,stamps:[]});
const view=(position,target)=>{const camera=new PerspectiveCamera(63,1,.05,200);camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld();return camera;};
test('shadow fade retains existing map and camera budget, with one filter',()=>{
 const light=new DirectionalLight();configureSunShadow(light);
 assert.deepEqual(light.shadow.mapSize.toArray(),[2048,2048]);
 assert.deepEqual([light.shadow.camera.left,light.shadow.camera.right,light.shadow.camera.bottom,light.shadow.camera.top],[-24,24,-24,24]);
 assert.equal(light.shadow.camera.near,.1);assert.equal(light.shadow.camera.far,90);assert.equal(light.shadow.normalBias,.03);assert.ok(light.shadow.filterNode);
});
test('edge weight is continuous at all shadow-map boundaries and full in the interior',()=>{
 assert.equal(shadowFadeAt([.5,.5,.5]),1);
 for(const axis of [0,1,2])for(const edge of [0,1]){const point=[.5,.5,.5];point[axis]=edge;assert.equal(shadowFadeAt(point),0);point[axis]=edge?1+1e-4:-1e-4;assert.equal(shadowFadeAt(point),0);point[axis]=edge?1-1e-5:1e-5;assert.ok(shadowFadeAt(point)<1e-7);}
 let previous=0;for(let distance=0;distance<=SUN_SHADOW.fadeWidth;distance+=.1){const value=shadowFadeAt([distance/48,.5,.5]);assert.ok(value>=previous&&value<=1);previous=value;}
 near(shadowFadeAt([3/48,.5,.5]),.5);assert.equal(shadowFadeAt([6/48,.5,.5]),1);
});
test('walking keeps the actor shadow focus while first and third person cameras differ',()=>{
 const actor={position:[3,2,5]};for(const camera of [view([3,3.72,5],[3,3.72,-5]),view([3,5,9],[3,3,-2])])assert.deepEqual(shadowViewFocus({mode:'walk',actor,camera,terrain}).toArray(),actor.position);
});
test('free and overview shadow focus projects the current view onto rendered terrain',()=>{
 const camera=view([10,12,10],[10,2,-10]);for(const mode of ['free','overview']){const point=shadowViewFocus({mode,actor:{position:[-20,2,-20]},camera,terrain});near(point.x,10);near(point.y,2);near(point.z,-10);}
});
test('upward or excessively distant view falls back to support under the camera',()=>{
 for(const camera of [view([7,10,8],[7,20,8]),view([7,190,8],[7,2,8])])assert.deepEqual(shadowViewFocus({mode:'free',camera,terrain}).toArray(),[7,2,8]);
 const camera=view([7,10,8],[7,20,8]);assert.deepEqual(shadowViewFocus({mode:'free',camera,groundHeight:0}).toArray(),[7,0,8]);
});
test('focus may reuse a caller-owned output vector without mutating the camera or actor',()=>{
 const camera=view([0,10,10],[0,2,0]),actor={position:[9,2,9]},out=new Vector3();
 assert.equal(shadowViewFocus({mode:'free',actor,camera,terrain},out),out);assert.deepEqual(camera.position.toArray(),[0,10,10]);assert.deepEqual(actor.position,[9,2,9]);
});
test('shadow proxies replace casting batches per face side and only the sun shadow camera sees them',()=>{
 const caster=(geometry,side,casts=true)=>{const mesh=new Mesh(geometry,new MeshStandardMaterial({side}));mesh.castShadow=casts;return mesh;};
 const meshes=[caster(new BoxGeometry(),FrontSide),caster(new BoxGeometry(2,1,1).toNonIndexed(),FrontSide),caster(new PlaneGeometry(),DoubleSide),caster(new PlaneGeometry(),FrontSide,false)];
 const proxies=shadowProxies(meshes),light=new DirectionalLight();configureSunShadow(light);
 assert.ok(meshes.every(m=>!m.castShadow));assert.equal(proxies.length,2);
 assert.deepEqual(proxies.map(p=>p.material.side),[FrontSide,DoubleSide]);assert.deepEqual(proxies.map(p=>p.geometry.attributes.position.count),[72,6]);
 assert.deepEqual(Object.keys(proxies[0].geometry.attributes),['position']);
 for(const proxy of proxies){assert.ok(proxy.castShadow);assert.equal(proxy.layers.mask,1<<SHADOW_ONLY_LAYER);assert.ok(light.shadow.camera.layers.test(proxy.layers));assert.ok(!new PerspectiveCamera().layers.test(proxy.layers));}
 assert.ok(light.shadow.camera.layers.isEnabled(0));assert.deepEqual(shadowProxies(meshes),[]);
});
