import assert from 'node:assert/strict';
import test from 'node:test';
import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three/webgpu';
import {createMakerModel} from './maker-model.mjs';

test('Maker assembles mixed primitive types into complete finite render geometry',()=>{
 const model=createMakerModel();let triangles=0,meshes=0;
 model.root.traverse(object=>{
  if(!object.isMesh)return;
  const {position,normal,uv}=object.geometry.attributes;
  assert.ok(position.count>0);
  assert.equal(normal.count,position.count);
  assert.equal(uv.count,position.count);
  assert.ok(position.array.every(Number.isFinite));
  assert.ok(normal.array.every(Number.isFinite));
  triangles+=(object.geometry.index?.count??position.count)/3;meshes++;
 });
 assert.ok(meshes<48,'one actor stays within its material batch budget');
 assert.ok(triangles<80000,'one actor stays within its geometry budget');
 model.dispose();
});

test('first person retains the same body and head shadow casters',()=>{
 const model=createMakerModel(),bodyChildren=[...model.body.children],materials=[];
 model.head.traverse(object=>{if(object.isMesh)materials.push(object.material);});
 model.setFirstPerson(true);
 assert.deepEqual(model.body.children,bodyChildren);
 model.head.traverse(object=>{
  if(!object.isMesh)return;
  assert.equal(object.visible,true);assert.equal(object.castShadow,true);
  assert.equal(object.material.colorWrite,false);assert.equal(object.material.depthWrite,false);
 });
 model.setFirstPerson(false);let i=0;
 model.head.traverse(object=>{if(object.isMesh)assert.equal(object.material,materials[i++]);});
 model.dispose();
});

test('tailored cape has physical thickness and clears the rigid torso shell',()=>{
 const model=createMakerModel(),cape=model.root.getObjectByName('MakerCape');
 assert.ok(cape,'the cape is an independently inspectable rigid module');
 assert.equal(cape.geometry.userData.thickness,.006);
 const shell=model.body.children.find(object=>object.isMesh&&object.material.name==='Maker enamel');
 const material=new MeshBasicMaterial({side:DoubleSide}),probe=new Mesh(shell.geometry,material),ray=new Raycaster();
 probe.updateMatrixWorld(true);
 const vertices=cape.geometry.attributes.position;
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

test('upper chest joins both shoulder sockets and reaches the neck seat without moving the rig',()=>{
 const model=createMakerModel(),shell=model.body.children.find(o=>o.isMesh&&o.material.name==='Maker enamel');
 const material=new MeshBasicMaterial({side:DoubleSide}),probe=new Mesh(shell.geometry,material),ray=new Raycaster();probe.updateMatrixWorld(true);
 shell.geometry.computeBoundingBox();
 assert.ok(shell.geometry.boundingBox.max.y>=.63,'upper chest must rise above the shoulder centers into the neck seat');
 for(const side of [-1,1]){
  const shoulder=model.joints[side<0?'leftShoulder':'rightShoulder'];
  assert.deepEqual(shoulder.position.toArray(),[side*.25,.55,0]);
  ray.set(new Vector3(side,shoulder.position.y,0),new Vector3(-side,0,0));
  const hit=ray.intersectObject(probe)[0];
  assert.ok(hit&&Math.abs(hit.point.x)>=.19,'chest must overlap the inner shoulder ball instead of ending below it');
 }
 assert.deepEqual(model.body.position.toArray(),[0,.9,0]);assert.deepEqual(model.head.position.toArray(),[0,0,0]);
 for(const side of ['left','right']){assert.deepEqual(model.joints[`${side}Elbow`].position.toArray(),[0,-.31,0]);assert.deepEqual(model.joints[`${side}Knee`].position.toArray(),[0,-.405,0]);assert.deepEqual(model.joints[`${side}Foot`].position.toArray(),[0,-.405,0]);}
 material.dispose();model.dispose();
});

test('the cape neckline leaves a visible neck transition below the cranial shell',()=>{
 const model=createMakerModel(),headShell=model.head.children.find(o=>o.isMesh&&o.material.name==='Maker enamel'),cape=model.root.getObjectByName('MakerCape');
 headShell.geometry.computeBoundingBox();
 const p=cape.geometry.attributes.position;let necklineTop=-Infinity;
 for(let i=0;i<=64;i++)necklineTop=Math.max(necklineTop,p.getY(i));
 assert.ok(headShell.geometry.boundingBox.min.y-necklineTop>=.025,'head should sit above the neckline on a visible neck, rather than directly on cloth');
 assert.ok(headShell.geometry.boundingBox.max.y<=.95,'retain the existing first-person head envelope');
 model.dispose();
});

test('optical apertures stay small, horizontal and centered at the established eye line',()=>{
 const model=createMakerModel(),glass=model.head.children.find(o=>o.isMesh&&o.material.name==='Maker optical glass'),p=glass.geometry.attributes.position;
 for(const side of [-1,1]){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.count;i++){if(Math.sign(p.getX(i))!==side)continue;for(let a=0;a<3;a++){const value=p.getComponent(i,a);min[a]=Math.min(min[a],value);max[a]=Math.max(max[a],value);}}
  assert.ok((max[0]-min[0])/(max[1]-min[1])>=2,'optics should read as modest horizontal apertures rather than round buttons');
  assert.ok(max[1]-min[1]<=.02,'apertures retain a restrained vertical size');
  assert.ok(Math.abs((min[1]+max[1])*.5-.822)<.002,'eye line stays fixed');
 }
 model.dispose();
});
