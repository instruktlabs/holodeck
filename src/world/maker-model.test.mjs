import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Sphere,Vector3} from 'three/webgpu';
import {createMakerModel,createMakerRig,MAKER_LIMBS} from './maker-model.mjs';
import {SHADOW_ONLY_LAYER} from './sun-shadow.mjs';
import {createMakerMotion,updateMakerPose} from './maker-pose.mjs';

const actor=(overrides={})=>({position:[2,1,3],yaw:0,speed:0,velocity:[0,0,0],camera:'first',gaitPhase:0,mode:'grounded',grounded:true,supportHeight:1,config:{walkSpeed:2.2},...overrides});
const PELVIS=MAKER_LIMBS.pelvisHeight;
const restWorld=(rig,name)=>{rig.root.updateMatrixWorld(true);return rig.joints[name].getWorldPosition(new Vector3());};

test('Maker skins every piece to one skeleton within its draw and geometry budget',()=>{
 const model=createMakerModel();let triangles=0,meshes=0;
 const proxies=[];
 model.root.traverse(object=>{
  if(!object.isMesh)return;
  assert.ok(object.isSkinnedMesh&&object.skeleton===model.skeleton,'every mesh deforms with the shared skeleton');
  if(object.userData.shadowProxy){proxies.push(object);return;}
  assert.equal(object.castShadow,false,'visible meshes leave the sun shadow to the proxy');
  const {position,normal,uv,skinIndex,skinWeight}=object.geometry.attributes;
  assert.ok(position.count>0);
  for(const attribute of [normal,uv,skinIndex,skinWeight])assert.equal(attribute.count,position.count);
  assert.ok(position.array.every(Number.isFinite)&&normal.array.every(Number.isFinite));
  for(let i=0;i<position.count;i++){
   let total=0;for(let k=0;k<4;k++){total+=skinWeight.getComponent(i,k);assert.ok(skinIndex.getComponent(i,k)<model.bones.length);}
   assert.ok(Math.abs(total-1)<1e-5,'skin weights are normalized');
  }
  triangles+=(object.geometry.index?.count??position.count)/3;meshes++;
 });
 assert.ok(meshes<=16,`one skinned mesh per material and visibility group (${meshes})`);
 // One skinned, position-only shadow proxy per face side (H119).
 assert.ok(proxies.length>=1&&proxies.length<=2,`${proxies.length} shadow draws`);
 for(const proxy of proxies){assert.equal(proxy.castShadow,true);assert.equal(proxy.layers.mask,1<<SHADOW_ONLY_LAYER,'never drawn in the view');}
 assert.ok(triangles<80000,'one actor stays within its geometry budget');
 model.dispose();
});

test('the rig keeps the controller\'s anatomical landmarks at rest',()=>{
 const rig=createMakerRig();
 for(const [name,side] of [['left',-1],['right',1]]){
  assert.ok(restWorld(rig,name+'Shoulder').distanceTo(new Vector3(side*.25,PELVIS+.55,0))<1e-9,'shoulder pivots stay fixed');
  assert.ok(restWorld(rig,name+'Hip').distanceTo(new Vector3(side*.105,PELVIS,0))<1e-9,'hip pivots stay fixed');
  assert.ok(Math.abs(restWorld(rig,name+'Foot').y-MAKER_LIMBS.ankleHeight)<1e-6,'ankle rests at sole height above the ground');
  assert.deepEqual(rig.joints[name+'Elbow'].position.toArray(),[0,-.31,0]);assert.deepEqual(rig.joints[name+'Knee'].position.toArray(),[0,-.405,0]);assert.deepEqual(rig.joints[name+'Foot'].position.toArray(),[0,-.405,0]);
 }
 assert.ok(Math.abs(restWorld(rig,'eyes').y-(PELVIS+.822))<1e-6,'eye line stays at the first-person eye height');
});

test('first person hides the head and shawl but keeps them in the sun shadow',()=>{
 const model=createMakerModel(),bodyChildren=[...model.body.children],cape=model.root.getObjectByName('MakerCape'),hidden=[...model.headMeshes,cape],materials=hidden.map(mesh=>mesh.material);
 const proxies=[];model.root.traverse(o=>{if(o.userData.shadowProxy)proxies.push(o);});
 let visible=0;model.root.traverse(o=>{if(o.isSkinnedMesh&&!o.userData.shadowProxy)visible+=o.geometry.attributes.position.count;});
 assert.equal(proxies.reduce((n,p)=>n+p.geometry.attributes.position.count,0),visible,'the proxies carry every vertex, head and shawl included');
 assert.ok(model.headMeshes.length>=4);
 model.setFirstPerson(true);
 assert.deepEqual(model.body.children,bodyChildren);
 for(const mesh of hidden){assert.equal(mesh.visible,false,'hidden parts cost no draw (H120)');assert.equal(mesh.castShadow,false);}
 for(const mesh of model.root.children)if(mesh.isMesh&&mesh!==cape)assert.equal(mesh.visible,true,'the body and the shadow proxies stay drawn');
 for(const proxy of proxies)assert.equal(proxy.castShadow,true);
 model.setFirstPerson(false);hidden.forEach((mesh,i)=>{assert.equal(mesh.visible,true);assert.equal(mesh.material,materials[i]);});
 model.dispose();
});

test('a camera inside the head counts as first person, and one beside the maker does not (H128)',()=>{
 const model=createMakerModel();model.root.position.set(1.25,0,2.35);
 const eye=restWorld(model,'eyes');
 // The review cameras at the spawn stand at the eye: the head and shawl would wrap the view.
 assert.ok(model.holdsEye(eye));assert.ok(model.holdsEye(eye.clone().add(new Vector3(0,.1,.1))));
 // A metre off, and the third-person camera behind the maker, see the maker as it is.
 assert.ok(!model.holdsEye(eye.clone().add(new Vector3(1,0,0))));
 assert.ok(!model.holdsEye(eye.clone().add(new Vector3(0,.6,3))));
 model.dispose();
});

test('the skinned shadow proxy follows the posed skeleton exactly (H119)',()=>{
 const model=createMakerModel(),{root}=model;root.position.set(3,1,-2);root.rotation.y=.7;
 model.bones.forEach((bone,i)=>{bone.rotation.x+=.15*Math.sin(i);bone.rotation.z+=.1*Math.cos(i);});root.updateMatrixWorld(true);model.skeleton.update();
 const bounds=filter=>{const box=new Box3(),v=new Vector3();root.traverse(o=>{if(!o.isSkinnedMesh||!filter(o))return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(o.applyBoneTransform(i,v.fromBufferAttribute(p,i)).applyMatrix4(o.matrixWorld));});return box;};
 const seen=bounds(o=>!o.userData.shadowProxy),cast=bounds(o=>o.userData.shadowProxy);
 for(const key of ['min','max'])for(const axis of ['x','y','z'])assert.ok(Math.abs(seen[key][axis]-cast[key][axis])<1e-5,`${key}.${axis}`);
 model.dispose();
});

test('every part is frustum-culled with a sphere that holds it in any pose (H120)',()=>{
 const model=createMakerModel(),{root}=model,vertex=new Vector3(),sphere=new Sphere();
 const check=label=>{
  root.updateMatrixWorld(true);let parts=0;
  root.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;parts++;
   assert.equal(mesh.frustumCulled,true,`${mesh.name} is culled`);
   sphere.copy(mesh.boundingSphere).applyMatrix4(mesh.matrixWorld);
   const p=mesh.geometry.attributes.position;let out=0;
   for(let i=0;i<p.count;i++)out=Math.max(out,sphere.distanceToPoint(mesh.applyBoneTransform(i,vertex.fromBufferAttribute(p,i)).applyMatrix4(mesh.matrixWorld)));
   assert.ok(out<1e-6,`${label}: ${mesh.name} leaves its sphere by ${out}`);
  });
  assert.ok(parts>=10);
 };
 root.position.set(3,1,-2);root.rotation.y=.7;check('rest');
 // Every joint bent hard, with the pelvis as far from rest as the pose ever moves it.
 let seed=7;const random=()=>(seed=seed*16807%2147483647)/2147483647-.5;
 for(let trial=0;trial<8;trial++){
  model.bones.forEach(bone=>bone.rotation.set(random()*3,random()*3,random()*3));
  model.body.position.set(random()*.4,MAKER_LIMBS.pelvisHeight+(trial%2?-.5:.1),random()*.6);
  check(`bent ${trial}`);
 }
 // The procedural run, crawl and jump.
 const a=actor({speed:4.5,velocity:[0,0,-4.5],gaitPhase:1,camera:'third'}),motion=createMakerMotion();
 for(let i=0;i<12;i++){a.gaitPhase+=.4;updateMakerPose(model,a,null,motion,.05);}check('run');
 Object.assign(a,{mode:'swimming',grounded:false,surfaceHeight:2,supportHeight:-3,position:[2,1,3],speed:1.8,velocity:[0,0,-1.8]});
 for(let i=0;i<30;i++){updateMakerPose(model,a,null,motion,.05);if(i%10===9)check(`crawl ${i}`);}
 Object.assign(a,{mode:'airborne',verticalVelocity:3,speed:2});for(let i=0;i<10;i++)updateMakerPose(model,a,null,motion,.1);check('jump');
 model.dispose();
});

test('tailored cape has physical thickness and clears the rigid torso shell',()=>{
 const model=createMakerModel(),cape=model.root.getObjectByName('MakerCape');
 assert.ok(cape,'the cape is an independently inspectable mesh');
 assert.equal(cape.geometry.userData.thickness,.006);
 const material=new MeshBasicMaterial({side:DoubleSide}),probe=new Mesh(model.parts.torso,material),ray=new Raycaster();
 probe.updateMatrixWorld(true);
 const vertices=model.parts.cape.attributes.position;
 for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
  ray.set(new Vector3(x,y,-2),new Vector3(0,0,1));
  const hits=ray.intersectObject(probe);
  if(hits.length<2)continue;
  const front=hits[0].point.z,back=hits.at(-1).point.z;
  assert.ok(z<front-.004||z>back+.004,`cape intersects shell at ${[x,y,z]}`);
 }
 material.dispose();model.dispose();
});

test('upper chest joins both shoulder sockets and reaches the neck seat',()=>{
 const model=createMakerModel(),material=new MeshBasicMaterial({side:DoubleSide}),probe=new Mesh(model.parts.torso,material),ray=new Raycaster();probe.updateMatrixWorld(true);
 model.parts.torso.computeBoundingBox();
 assert.ok(model.parts.torso.boundingBox.max.y>=PELVIS+.63,'upper chest must rise above the shoulder centers into the neck seat');
 for(const side of [-1,1]){
  const shoulder=restWorld(model,side<0?'leftShoulder':'rightShoulder');
  ray.set(new Vector3(side,shoulder.y,0),new Vector3(-side,0,0));
  const hit=ray.intersectObject(probe)[0];
  assert.ok(hit&&Math.abs(hit.point.x)>=.19,'chest must overlap the inner shoulder ball instead of ending below it');
 }
 material.dispose();model.dispose();
});

test('the cape neckline leaves a visible neck transition below the cranial shell',()=>{
 const model=createMakerModel(),p=model.parts.cape.attributes.position;
 model.parts.head.computeBoundingBox();
 let necklineTop=-Infinity;for(let i=0;i<=64;i++)necklineTop=Math.max(necklineTop,p.getY(i));
 assert.ok(model.parts.head.boundingBox.min.y-necklineTop>=.025,'head should sit above the neckline on a visible neck, rather than directly on cloth');
 assert.ok(model.parts.head.boundingBox.max.y<=PELVIS+.95,'retain the existing first-person head envelope');
 model.dispose();
});

test('optical apertures stay small, horizontal and centered at the established eye line',()=>{
 const model=createMakerModel(),glass=model.headMeshes.find(mesh=>mesh.material.name==='Maker optical glass'),p=glass.geometry.attributes.position;
 for(const side of [-1,1]){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.count;i++){if(Math.sign(p.getX(i))!==side)continue;for(let a=0;a<3;a++){const value=p.getComponent(i,a);min[a]=Math.min(min[a],value);max[a]=Math.max(max[a],value);}}
  assert.ok((max[0]-min[0])/(max[1]-min[1])>=2,'optics should read as modest horizontal apertures rather than round buttons');
  assert.ok(max[1]-min[1]<=.02,'apertures retain a restrained vertical size');
  assert.ok(Math.abs((min[1]+max[1])*.5-(PELVIS+.822))<.002,'eye line stays fixed');
 }
 model.dispose();
});

test('visual two-bone solve places each ankle above its sampled terrain support',()=>{
 const model=createMakerModel(),a=actor(),motion=createMakerMotion();
 const terrain={sample:(x,z)=>({height:x<2?1:1.12,normal:[0,1,0],inBounds:true})};
 updateMakerPose(model,a,terrain,motion,.1);model.root.updateMatrixWorld(true);
 for(const [name,height] of [['leftFoot',1.09],['rightFoot',1.21]]){
  const position=model.joints[name].getWorldPosition(new Vector3());
  assert.ok(Math.abs(position.y-height)<.003,`${name} support ${position.y}`);
 }
 assert.deepEqual(a.position,[2,1,3],'visual IK never changes controller position');model.dispose();
});

test('walk, swim and airborne transitions retain finite distinct poses',()=>{
 const model=createMakerModel(),a=actor({speed:2.2,gaitPhase:Math.PI/2}),motion=createMakerMotion();
 updateMakerPose(model,a,null,motion,1);
 assert.notEqual(model.joints.leftShoulder.rotation.x,model.joints.rightShoulder.rotation.x);
 a.mode='swimming';a.grounded=false;a.surfaceHeight=2;a.supportHeight=-3;for(let i=0;i<10;i++)updateMakerPose(model,a,null,motion,.1);
 assert.ok(model.body.rotation.x<-1,'swimming under way lies prone');
 assert.ok(model.joints.leftShoulder.quaternion.angleTo(model.joints.rightShoulder.quaternion)>.2,'the arms stroke out of step');
 a.mode='airborne';a.verticalVelocity=3;for(let i=0;i<10;i++)updateMakerPose(model,a,null,motion,.1);
 assert.ok(Math.abs(model.body.rotation.x)<.01);assert.ok(model.joints.leftKnee.rotation.x<-.25);
 model.root.traverse(part=>assert.ok([...part.position,...part.quaternion,...part.scale].every(Number.isFinite)));
 model.dispose();
});
