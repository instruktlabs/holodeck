import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,Mesh,InstancedMesh,Matrix4,BoxGeometry,BufferGeometry,BufferAttribute,MeshBasicMaterial,Raycaster,Vector3,DoubleSide} from 'three';
import {collectAimMeshes,pickWorldAim,terrainRayDistance,waterRayDistance} from './aim.mjs';
import {createTerrain} from './terrain.mjs';

const ray=(origin=[0,1,0],direction=[0,0,-1])=>new Raycaster(new Vector3(...origin),new Vector3(...direction).normalize());
function box(id,z,y=1){const mesh=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial());mesh.position.set(0,y,z);if(id)mesh.userData.target=id;return mesh;}
const ground=(extra={})=>createTerrain({type:'heightfield',bounds:[-10,10,-10,10],segments:[32,32],baseHeight:0,stamps:[],...extra});

test('aim collection skips invisible ancestors and untagged landscape while preserving semantic descendants',()=>{
 const scene=new Scene(),hidden=new Group(),cove=new Group(),entity=new Group();hidden.visible=false;hidden.add(box('hidden',-1));cove.add(box('cove',-2));entity.userData.target='hut';entity.add(box(null,-3));scene.add(hidden,cove,entity,box(null,-.5));
 assert.deepEqual(collectAimMeshes(scene).map(m=>m.userData.target??m.parent.userData.target),['cove','hut']);
 assert.equal(pickWorldAim(ray(),scene),'cove');
});
test('instanced render derivatives preserve exact semantic IDs and hidden layer occlusion',()=>{
 const scene=new Scene(),group=new Group(),mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),2);mesh.setMatrixAt(0,new Matrix4().makeTranslation(0,1,-2));mesh.setMatrixAt(1,new Matrix4().makeTranslation(3,1,-2));mesh.userData.instanceTargets=['left-tree','right-tree'];group.add(mesh);scene.add(group,box('behind',-5));
 assert.ok(collectAimMeshes(scene).includes(mesh));assert.equal(pickWorldAim(ray(),scene),'left-tree');assert.equal(pickWorldAim(ray([3,1,0]),scene),'right-tree');group.visible=false;assert.equal(pickWorldAim(ray(),scene),'behind');
});

test('noninteractive semantic geometry occludes an interactive target and uses updated transforms',()=>{
 const scene=new Scene(),wall=box('wall',-2),door=box('door',-4);scene.add(wall,door);
 assert.equal(pickWorldAim(ray(),scene),'wall');wall.position.x=4;
 assert.equal(pickWorldAim(ray(),scene),'door');wall.visible=false;
 assert.equal(pickWorldAim(ray(),scene),'door');
});

test('ray range is applied before mesh intersection and landscape meshes are never raycast',()=>{
 const scene=new Scene(),land=box(null,-1),far=box('far',-40);let farSeen=null;
 land.name='terrain';land.raycast=()=>assert.fail('dense landscape entered mesh raycast');
 far.raycast=r=>{farSeen=r.far;};scene.add(land,far);
 assert.equal(pickWorldAim(ray(),scene),null);assert.equal(farSeen,30);
});

test('terrain ray query matches actual triangles including nonuniform Float32 coordinates and vertical rays',()=>{
 const terrain=ground({bounds:[-.1234567,11.1234567,-8.234567,9.345678],segments:[17,21],stamps:[{id:'hill',center:[3,-2],radius:[4,5],height:4}]});
 const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(terrain.positions,3));geometry.setIndex(new BufferAttribute(terrain.indices,1));
 const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();
 for(const [origin,direction] of [[[3,10,-2],[0,-1,0]],[[0,6,6],[.4,-.6,-1]],[[-3,4,-2],[1,-.1,0]],[[10,5,8],[-1,-.5,-1]]]){
  const r=ray(origin,direction);r.far=30;const expected=r.intersectObject(mesh)[0]?.distance??null,actual=terrainRayDistance(r.ray,terrain,r.near,r.far);
  assert.equal(actual===null,expected===null);if(expected!==null)assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
 }
});

test('terrain ridges occlude props without hitting dense terrain geometry',()=>{
 const terrain=ground({stamps:[{id:'ridge',center:[0,-3],radius:[3,2],height:3}]}),scene=new Scene();scene.add(box('hut',-6));
 assert.equal(pickWorldAim(ray(),scene,{terrain}),null);
 assert.equal(pickWorldAim(ray([0,5,0]),scene,{terrain}),null);
 scene.children[0].position.y=5;assert.equal(pickWorldAim(ray([0,5,0]),scene,{terrain}),'hut');
});

test('terrain bounds and maximum range do not invent occlusion outside the mesh',()=>{
 const terrain=ground();assert.equal(terrainRayDistance(ray([20,2,0],[0,-1,0]).ray,terrain,0,30),null);
 assert.equal(terrainRayDistance(ray([0,2,0],[0,-1,0]).ray,terrain,0,1),null);
 assert.equal(terrainRayDistance(ray([0,2,0],[0,-1,0]).ray,terrain,0,3),2);
});

test('water occlusion uses bounded animated surface rather than undisplaced mesh plane',()=>{
 const water={bounds:[-5,5,-5,5],level:2,waves:[]},r=ray([0,4,0],[0,-1,0]);
 assert.equal(waterRayDistance(r.ray,water,0,10,0),2);
 assert.equal(waterRayDistance(ray([6,4,0],[0,-1,0]).ray,water,0,10,0),null);
 const waves={...water,waves:[{direction:[1,0],amplitude:1,wavelength:4,speed:1,phase:Math.PI/2}]};
 assert.ok(Math.abs(waterRayDistance(r.ray,waves,0,10,0)-1)<1e-5);
 assert.ok(Math.abs(waterRayDistance(r.ray,waves,0,10,2)-3)<1e-5);
});

test('ocean crossing occludes a submerged semantic target but not a target before the surface',()=>{
 const scene=new Scene(),water={bounds:[-5,5,-5,5],level:2,waves:[]};scene.add(box('submerged',0,0));
 assert.equal(pickWorldAim(ray([0,4,0],[0,-1,0]),scene,{water}),null);
 scene.children[0].position.y=3;assert.equal(pickWorldAim(ray([0,4,0],[0,-1,0]),scene,{water}),'submerged');
});
