import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRuntime} from './runtime.mjs';
import {createInhabitant,stepInhabitant,inhabitantContext} from './inhabitant.mjs';

// Independent raised-deck doorway: a 1.24 m leaf beside a 1.30 m aperture.
// The player starts near the hinge, clear of the closed leaf but in its swing.
function doorway(){
 const box=(id,position,size,offset,extra={})=>({id,position,rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:{type:'box',size,offset},...extra});
 return {
  runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1','interaction.hinge@1','inhabitant.maker@1'],spawn:[.11,7.72,.485],look:[0,0],overview:[8,12,14],target:[0,6,0],bounds:[-20,20,-20,20],blockers:[],possession:{preset:'maker',camera:'first'}},
  objects:[
   box('floor',[0,5.85,0],[8,.3,8],[0,0,0],{collider:{type:'box',size:[8,.3,8],offset:[0,0,0],walkable:true}}),
   box('left-jamb',[-.13,6,0],[.2,4.5,.25],[0,2.25,0]),
   box('right-jamb',[1.72,6,0],[.9,4.5,.25],[0,2.25,0]),
   box('lintel',[.62,6,0],[1.3,2.2,.25],[0,3.4,0]),
   box('door',[0,6,0],[1.24,2.24,.09],[.62,1.12,0],{behavior:{type:'hinge',angle:-Math.PI/2,speed:1.2}}),
  ],
 };
}
const eye=a=>[a.position[0],a.position[1]+a.eyeHeight,a.position[2]];
function setup(){const runtime=new WorldRuntime(doorway()),actor=createInhabitant(runtime);runtime.playerBody=actor;return {runtime,actor};}
function advance(runtime,actor,frames,input={}){
 for(let i=0;i<frames;i++){
  runtime.step(1/60);
  assert.equal(runtime.collisionAt(actor.position[0],actor.position[2],actor.radius,actor.position[1],actor.height,null,.35),null,'the moving leaf must never engulf the player');
  stepInhabitant(actor,input,1/60,inhabitantContext(runtime,actor.radius));
 }
}
const angle=r=>r.states.get('door').angle;

test('opening waits at the hinge-side player, who can retreat and then enter',()=>{
 const {runtime:r,actor:a}=setup(),original=JSON.stringify(r.scene);
 assert.equal(r.act('door',eye(a)),true);advance(r,a,120);
 assert.ok(angle(r)<0&&angle(r)>-Math.PI/2,'opening should wait partway');
 const waiting=angle(r);advance(r,a,30);assert.equal(angle(r),waiting);
 advance(r,a,36,{forward:-1});assert.ok(a.position[2]>1.7,'player can retreat out of the sweep');
 advance(r,a,60);assert.equal(angle(r),-Math.PI/2);
 advance(r,a,16,{strafe:1});assert.ok(a.position[0]>.5&&a.position[0]<1.0);
 advance(r,a,72,{forward:1});assert.ok(a.position[2]<-.8,'player passes through the open aperture');
 assert.equal(a.position[1],6);assert.equal(a.grounded,true);assert.equal(JSON.stringify(r.scene),original);
});

test('closing waits for a player in the opening and resumes after they walk inside',()=>{
 const {runtime:r,actor:a}=setup();r.playerBody=null;r.act('door',eye(a));for(let i=0;i<120;i++)r.step(1/60);
 a.position=[.62,6,.12];r.playerBody=a;
 assert.equal(r.act('door',eye(a)),true);advance(r,a,120);
 assert.ok(angle(r)>-Math.PI/2&&angle(r)<0,'closing should wait partway');
 advance(r,a,36,{forward:1});assert.ok(a.position[2]<-1,'player remains able to leave the swing');
 advance(r,a,90);assert.equal(angle(r),0);
});

test('unobstructed opening/closing and bodies below or above the leaf retain full travel',()=>{
 for(const y of [0,9]){
  const {runtime:r,actor:a}=setup();a.position[1]=y;
  assert.equal(r.act('door',[.62,7.72,1.5]),true);for(let i=0;i<120;i++)r.step(1/60);assert.equal(angle(r),-Math.PI/2);
  assert.equal(r.act('door',[.62,7.72,1.5]),true);for(let i=0;i<120;i++)r.step(1/60);assert.equal(angle(r),0);
 }
});

test('a fast long thin leaf cannot cross the body between clear tick endpoints',()=>{
 const scene=doorway();scene.runtime.bounds=[-200,200,-200,200];scene.objects=scene.objects.filter(o=>o.id==='door');
 const door=scene.objects[0];door.position=[0,0,0];door.collider={type:'compound',boxes:[{size:[1,2,.1],offset:[.5,1,0]},{size:[110,2,.02],offset:[55,1,0]}]};door.behavior={type:'hinge',angle:Math.PI/2,speed:4};
 const body={position:[100*Math.cos(1/30),0,-100*Math.sin(1/30)],radius:.22,height:1.82},r=new WorldRuntime(scene),clear=new WorldRuntime(scene);
 const at=b=>[b.position[0],b.position[2],b.radius,b.position[1],b.height];
 assert.equal(r.blocked(...at(body)),false);clear.act('door',[body.position[0],1.72,body.position[2]]);clear.step(1/60);assert.equal(clear.blocked(...at(body)),false,'the proposed tick endpoint alone misses the crossing');
 r.playerBody=body;assert.equal(r.act('door',[body.position[0],1.72,body.position[2]]),true);r.step(1/60);assert.equal(angle(r),0,'the swept motion must wait even with a clear endpoint');
 body.position=[120,0,10];for(let i=0;i<120;i++)r.step(1/60);assert.equal(angle(r),Math.PI/2);
});

test('a yawed scaled compound hinge protects a legacy-height body and releases ownership cleanly',()=>{
 const scene=doorway();scene.objects=scene.objects.filter(o=>o.id==='door');
 const door=scene.objects[0],yaw=.7,c=Math.cos(yaw),s=Math.sin(yaw);
 door.position=[5,2,-7];door.rotation[1]=yaw;door.scale=[1.4,1.2,.8];door.collider={type:'compound',boxes:[door.collider]};
 const body={position:[5+c*.154+s*.388,2,-7-s*.154+c*.388],radius:.22,height:1.72},r=new WorldRuntime(scene);r.playerBody=body;
 const position=[...body.position];assert.equal(r.act('door',[position[0],position[1]+1.72,position[2]]),true);
 for(let i=0;i<120;i++){r.step(1/60);assert.equal(r.blocked(position[0],position[2],body.radius,position[1],body.height),false);}
 assert.ok(angle(r)<0&&angle(r)>-Math.PI/2);assert.deepEqual(body.position,position,'waiting does not push the body');
 // The body is independent of the viewing camera and survives appearance adoption.
 const waiting=angle(r),next=structuredClone(scene);next.objects[0].asset='new-appearance';r.reconcile(next);r.step(.1);assert.equal(angle(r),waiting);
 r.playerBody=null;for(let i=0;i<120;i++)r.step(1/60);assert.equal(angle(r),-Math.PI/2,'a removed controller must not leave a stale obstacle');
});
