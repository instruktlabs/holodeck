import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,DirectionalLight,DoubleSide,FrontSide,Mesh,MeshStandardMaterial,NodeMaterial,PerspectiveCamera,PlaneGeometry,Scene,Vector3} from 'three/webgpu';
import {createTerrain} from './terrain.mjs';
import {SHADOW_ONLY_LAYER,SUN_SHADOW,configureSunShadow,scheduleSunShadow,shadowFadeAt,shadowProxies,shadowViewFocus,stableShadowFocus,stableShadowKeys,sunShadowConfig} from './sun-shadow.mjs';
import {validateShadow} from './shadow-contract.mjs';
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
test('a wider shadow extent scales the whole volume and leads the view, and the default is unchanged (H75)',()=>{
 assert.equal(sunShadowConfig({}),SUN_SHADOW);assert.equal(sunShadowConfig({shadow:{extent:24}}),SUN_SHADOW);
 const wide=sunShadowConfig({shadow:{extent:60}});
 assert.deepEqual([wide.halfExtent,wide.mapSize,wide.lead],[60,2048,30]);near(wide.far,225);near(wide.lightDistance,100);near(wide.normalBias,.075);near(wide.fadeWidth,15);
 const light=new DirectionalLight();configureSunShadow(light,wide);
 assert.deepEqual([light.shadow.camera.left,light.shadow.camera.top],[-60,60]);near(light.shadow.camera.far,225);
 near(shadowFadeAt([7.5/120,.5,.5],wide),.5);
 const actor={position:[3,2,5]},walker=view([3,3.72,5],[3,3.72,-5]),ahead=shadowViewFocus({mode:'walk',actor,camera:walker,terrain,lead:30});
 near(ahead.x,3);near(ahead.y,2);near(ahead.z,-25);
 const free=shadowViewFocus({mode:'free',camera:view([10,12,10],[10,2,-10]),terrain,lead:30});near(free.x,10);near(free.z,-40);
 assert.throws(()=>validateShadow({extent:6}),/12–120/);assert.throws(()=>validateShadow({radius:30}),/Unknown shadow field/);assert.deepEqual(validateShadow({extent:60}),{extent:60});
});
test('the sun shadow renders once a frame, not once per camera',()=>{
 const light=new DirectionalLight();configureSunShadow(light);light.shadow.needsUpdate=false;
 scheduleSunShadow(light);assert.equal(light.shadow.autoUpdate,false);assert.equal(light.shadow.needsUpdate,true);
});
test('the shadow pass keeps its shared material version while leaves and stone alternate (H121)',()=>{
 // three copies each caster's alphaTest onto the shared shadow material before looking up the
 // caster's render object; the fake renderer records the version each lookup would compare.
 const seen=[],renderer={renderObject(object,scene,camera,geometry,material){if(scene.overrideMaterial&&material.allowOverride===true)scene.overrideMaterial.alphaTest=material.alphaTest;seen.push(scene.overrideMaterial?.version??null);}};
 stableShadowKeys(renderer);stableShadowKeys(renderer);
 const shared=new NodeMaterial();shared.isShadowPassMaterial=true;const pass=new Scene();pass.overrideMaterial=shared;
 const stone=new Mesh(new BoxGeometry(),new MeshStandardMaterial()),leaf=new Mesh(new BoxGeometry(),new MeshStandardMaterial({alphaTest:.5})),casters=[stone,leaf,stone.clone(),leaf.clone()];
 const frame=()=>{seen.length=0;for(const mesh of casters)renderer.renderObject(mesh,pass,null,mesh.geometry,mesh.material);return [...seen];};
 frame();const settled=frame();
 assert.ok(settled.every(v=>v===settled[0]),`one version through the frame: ${settled}`);
 assert.deepEqual(frame(),settled,'and from frame to frame');
 assert.equal(shared.alphaTest,.5,'three still copies each caster\'s alpha test');
 // A caster whose material is swapped re-keys once.
 leaf.material=new MeshStandardMaterial({alphaTest:.3});const swapped=frame();
 assert.ok(swapped[1]>settled[1]);assert.deepEqual(frame(),Array(4).fill(swapped.at(-1)));
 // Other passes and materials that refuse the override are left alone.
 const plain=new Scene(),before=shared.version;renderer.renderObject(leaf,plain,null,leaf.geometry,leaf.material);
 const refusing=new MeshStandardMaterial();refusing.allowOverride=false;renderer.renderObject(stone,pass,null,stone.geometry,refusing);
 assert.equal(shared.version,before);
});

test('the shadow box steps in whole texels across the light and keeps its depth on the ground away from the walker (H128)',()=>{
 const toSun=new Vector3(-8,14,9).normalize(),c=SUN_SHADOW,texel=2*c.halfExtent/c.mapSize;
 const z=new Vector3().copy(toSun),x=new Vector3().crossVectors(new Vector3(0,1,0),z).normalize(),y=new Vector3().crossVectors(z,x);
 // Free view: aim points anywhere along one sun ray land on the same ground point, on the texel grid.
 const a=stableShadowFocus(new Vector3(3.217,0,-5.4),toSun,c,{mode:'free'},new Vector3());
 const b=stableShadowFocus(new Vector3(3.217,0,-5.4).addScaledVector(toSun,7.3),toSun,c,{mode:'free'},new Vector3());
 near(a.distanceTo(b),0);assert.ok(Math.abs(a.y)<=texel);
 for(const axis of [x,y]){const k=a.dot(axis)/texel;near(k,Math.round(k));}
 // However far the aim moves, the box moves across the light by whole texels only, at most
 // one for a sub-texel move.
 for(const [move,most] of [[.3,1],[40,40]]){
  const moved=stableShadowFocus(new Vector3(3.217+texel*move,0,-5.4),toSun,c,{mode:'free'},new Vector3()).sub(a);
  for(const axis of [x,y]){const k=moved.dot(axis)/texel;near(k,Math.round(k));assert.ok(Math.abs(k)<=most);}
 }
 // The ground plane follows the water level.
 assert.ok(Math.abs(stableShadowFocus(new Vector3(1,12,1),toSun,c,{mode:'overview',groundHeight:-.1},new Vector3()).y+.1)<=texel);
 // A walker keeps its own height: snapping moves it by under a texel.
 const walker=new Vector3(2,18.4,-3),held=stableShadowFocus(walker,toSun,c,{mode:'walk'},new Vector3());
 assert.ok(held.distanceTo(walker)<=texel);near(held.dot(z),walker.dot(z));
});
