import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,PlaneGeometry,MeshStandardMaterial,MeshBasicMaterial,Texture} from 'three/webgpu';
import {bindAssetReflection,probeKey,probeReflections,reflectionCapture,reflectionProbePoints,skyReflection} from './asset-reflection.mjs';
import {LIVE_REFLECTIONS,validateWorld} from './contract.mjs';
import {PerspectiveCamera,SphereGeometry} from 'three/webgpu';
import {pickLiveReflection,screenRadius} from './live-reflection.mjs';
import {planStaticBatches} from './static-batches.mjs';

test('a sky reflection gives lit meshes one shared copy reflecting the published capture, and cleanup restores the source',()=>{
 const mirror=new MeshStandardMaterial({color:'#ffffff',metalness:1,roughness:.04}),glow=new MeshBasicMaterial({color:'#ffe0b0'}),source=new Group();
 const face=new Mesh(new PlaneGeometry(),mirror);face.name='face';source.add(face);
 const slot=new Mesh(new PlaneGeometry(),glow);slot.name='slot';source.add(slot);
 const sky=new Texture(),a=source.clone(true),b=source.clone(true),first=bindAssetReflection(a,'sky',sky),second=bindAssetReflection(b,'sky',sky);
 const reflecting=a.getObjectByName('face').material;
 assert.notEqual(reflecting,mirror);assert.equal(b.getObjectByName('face').material,reflecting,'one copy per source material and capture');
 assert.ok(reflecting.isNodeMaterial&&reflecting.envNode?.isTextureNode&&reflecting.envNode.value===sky,'the environment is the published capture');
 assert.equal(reflecting.metalness,1);assert.equal(reflecting.roughness,.04);
 assert.equal(a.getObjectByName('slot').material,glow,'unlit materials keep their material');
 assert.equal(source.getObjectByName('face').material,mirror,'the loader-owned source is untouched');
 first.dispose();assert.equal(a.getObjectByName('face').material,mirror);assert.equal(b.getObjectByName('face').material,reflecting,'the copy lives while another placement holds it');
 second.dispose();assert.equal(b.getObjectByName('face').material,mirror);
 const waiting=source.clone(true);bindAssetReflection(waiting,'sky',null).dispose();assert.equal(waiting.getObjectByName('face').material,mirror,'without a sky light nothing changes');
});

test('the capture store notifies subscribers once per change',()=>{
 const seen=[],off=skyReflection.subscribe(()=>seen.push(skyReflection.get())),capture=new Texture();
 skyReflection.set(capture);skyReflection.set(capture);skyReflection.set(null);off();skyReflection.set(capture);skyReflection.set(null);
 assert.deepEqual(seen,[capture,null]);
});

test('worlds carry asset.reflection "sky" on schema 2 ordinary assets only',()=>{
 const world=()=>({schemaVersion:2,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{type:'construct',clearPath:true,groundColor:'#c9b994',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'},{id:'cube',file:'assets/imports/cube.glb',reflection:'sky'}],objects:[{id:'cube-1',asset:'cube',position:[0,30,0],rotation:[0,0,0],scale:[1,1,1],collider:null}],moodboard:null,runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,4],look:[0,0],overview:[0,10,10],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}});
 validateWorld(world());
 const other=world();other.scene.assets[1].reflection='world';assert.throws(()=>validateWorld(other),/must be "sky"/);
 const foliage=world();foliage.scene.assets[1].foliage={nodes:['leaf']};assert.throws(()=>validateWorld(foliage),/cannot be combined with foliage or flow/);
 const origin=world();origin.scene.assets[0].reflection='sky';assert.throws(()=>validateWorld(origin),/ordinary imported placements/);
 const cove=world();cove.scene.objects[0].materialStyle='cove';assert.throws(()=>validateWorld(cove),/cove material derivation/);
 const v1=world();v1.schemaVersion=1;assert.throws(()=>validateWorld(v1));
});

test('a placement may stay out of the sun shadow map with castShadow:false, and only a boolean is accepted (H79)',()=>{
 const world={schemaVersion:2,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{type:'construct',clearPath:true,groundColor:'#c9b994',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'},{id:'cube',file:'assets/imports/cube.glb'}],objects:[{id:'c1',asset:'cube',position:[0,30,0],rotation:[0,0,0],scale:[1,1,1],collider:null,castShadow:false}],moodboard:null,runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,4],look:[0,0],overview:[0,10,10],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}};
 validateWorld(world);
 world.scene.objects[0].castShadow='no';assert.throws(()=>validateWorld(world),/castShadow must be a boolean/);
});

test('a probe reflection binds the capture published for its point, one per distinct point (H85)',()=>{
 const assets=[{id:'a',reflection:{probe:[14,22,-60]}},{id:'b',reflection:{probe:[14,22.001,-60]}},{id:'c',reflection:'sky'},{id:'d'},{id:'e',reflection:{probe:[0,40,-90]}}];
 assert.deepEqual(reflectionProbePoints(assets),[[14,22.001,-60],[0,40,-90]],'points within a centimetre share one capture');
 const key=probeKey([14,22,-60]),capture=new Texture(),seen=[],off=probeReflections.subscribe(()=>seen.push(probeReflections.get(key)));
 assert.equal(reflectionCapture({probe:[14,22,-60]}),null,'nothing until the sky light publishes it');
 probeReflections.set(key,capture);probeReflections.set(key,capture);
 assert.equal(reflectionCapture({probe:[14,22,-60]}),capture);assert.equal(reflectionCapture(undefined),null);
 const mirror=new MeshStandardMaterial({metalness:1,roughness:.02}),source=new Group();source.add(new Mesh(new PlaneGeometry(),mirror));
 const placed=source.clone(true),binding=bindAssetReflection(placed,{probe:[14,22,-60]},capture);
 assert.equal(placed.children[0].material.envNode.value,capture);binding.dispose();assert.equal(placed.children[0].material,mirror);
 probeReflections.set(key,null);off();assert.deepEqual(seen,[capture,null]);
});

test('captures see a probe mirror reflecting the sky capture, not a probe still being made (H104)',()=>{
 const mirror=new MeshStandardMaterial({metalness:1,roughness:.02}),source=new Group();source.add(new Mesh(new PlaneGeometry(),mirror));
 const probe=new Texture(),sky=new Texture(),placed=source.clone(true),binding=bindAssetReflection(placed,{probe:[14,20,-32]},probe,sky),face=placed.children[0];
 assert.equal(face.material.envNode.value,probe,'it renders with its probe');
 assert.equal(face.userData.skyCaptureMaterial.envNode.value,sky,'captures swap in the sky reflection');
 binding.dispose();assert.equal(face.material,mirror);assert.equal(face.userData.skyCaptureMaterial,undefined,'cleanup removes it');
 const skyOnly=source.clone(true),own=bindAssetReflection(skyOnly,'sky',sky,sky);
 assert.equal(skyOnly.children[0].userData.skyCaptureMaterial,undefined,'a sky mirror already reflects what captures never rewrite');own.dispose();
});
test('worlds carry a reflection probe point only with a sky light',()=>{
 const world=(reflection,light=true)=>({schemaVersion:2,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{type:'construct',clearPath:true,groundColor:'#c9b994',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3,...(light?{sky:{zenithColor:'#3d7fc4',light:{}}}:{})},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'},{id:'cube',file:'assets/imports/cube.glb',reflection}],objects:[{id:'cube-1',asset:'cube',position:[0,30,0],rotation:[0,0,0],scale:[1,1,1],collider:null}],moodboard:null,runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,4],look:[0,0],overview:[0,10,10],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}});
 validateWorld(world({probe:[0,32,4]}));
 for(const bad of [{probe:[0,32]},{probe:[0,32,'a']},{probe:[0,3000,0]},{probe:[0,1,0],size:2},[0,1,2],null])assert.throws(()=>validateWorld(world(bad)),/must be "sky", "live" or \{probe/);
 assert.throws(()=>validateWorld(world({probe:[0,32,4]},false)),/needs environment.sky.light/);
});

test('a live reflection is a placement of its own, and a world holds a few (H130)',()=>{
 const world=(count,reflection='live')=>({schemaVersion:2,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{type:'construct',clearPath:true,groundColor:'#c9b994',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'},{id:'orb',file:'assets/imports/orb.glb',reflection}],objects:Array.from({length:count},(_,i)=>({id:`orb-${i}`,asset:'orb',position:[i*4,30,0],rotation:[0,0,0],scale:[1,1,1],collider:null})),moodboard:null,runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,4],look:[0,0],overview:[0,10,10],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}});
 validateWorld(world(LIVE_REFLECTIONS));
 assert.throws(()=>validateWorld(world(LIVE_REFLECTIONS+1)),/At most 8 placements may have a live reflection/);
 // Live placements never join a static batch, which would share one material between them.
 const items=[0,1].map(i=>({id:`orb-${i}`,asset:'orb',position:[i*3,0,0],rotation:[0,0,0],scale:[1,1,1]})),models={orb:{scene:new Mesh(new SphereGeometry(),new MeshStandardMaterial())}};
 assert.equal(planStaticBatches(items,models).individual.length,0);
 assert.deepEqual(planStaticBatches(items,models,{apart:new Set(['orb'])}).individual.map(i=>i.id),['orb-0','orb-1']);
});
test('live reflections take one placement a frame: a first cube in view first, then the longest wait on screen (H130)',()=>{
 const camera=new PerspectiveCamera(60,1,.1,500);camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld();
 const orb=(z,x=0,radius=1)=>{const parent=new Group(),mesh=new Mesh(new SphereGeometry(radius),new MeshStandardMaterial());mesh.position.set(x,0,z);parent.add(mesh);parent.updateMatrixWorld(true);return {object:mesh,ready:true,waited:0};};
 const near=orb(-10),far=orb(-400),behind=orb(10),late=orb(-12,3);
 // A metre-radius orb 10 m away covers about 87 px of a 1000 px tall view; 400 m away, about 2.
 assert.ok(Math.abs(screenRadius(camera,near.object.position,1,1000)-1/(10*Math.tan(Math.PI/6))*500)<1e-6);
 const list=[near,far,behind,late];
 late.ready=false;assert.equal(pickLiveReflection(camera,1000,list),late,'a placement in view without its first cube comes first');
 late.ready=true;near.waited=0;late.waited=5;assert.equal(pickLiveReflection(camera,1000,list),late,'then the one that waited longest');
 late.waited=0;assert.equal(pickLiveReflection(camera,1000,list),near);
 far.ready=false;assert.equal(pickLiveReflection(camera,1000,list),far,'a first cube is taken however small');
 far.ready=true;for(const e of list)e.waited=0;far.waited=99;behind.waited=99;
 assert.notEqual(pickLiveReflection(camera,1000,list),far,'tiny placements wait');
 far.waited=200;for(const e of [near,late,behind])e.waited=0;assert.equal(pickLiveReflection(camera,1000,list),far,'then refresh slowly');far.waited=0;behind.waited=99;
 assert.notEqual(pickLiveReflection(camera,1000,list),behind,'and so do those out of view');
 near.object.removeFromParent();late.object.removeFromParent();assert.equal(pickLiveReflection(camera,1000,list),null,'unmounted placements are skipped');
});
