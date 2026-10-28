import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Object3D,Vector3} from 'three';
import {WorldRuntime,validateRuntimeScene} from './runtime.mjs';
import {bindGait,applyGait} from './gait-rig.mjs';
const fixture=()=>({runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1','interaction.joint@1'],spawn:[0,1.72,4],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]},objects:[{id:'cabinet',asset:'cabinet-kit',position:[0,0,0],rotation:[0,.3,0],scale:[1,1,1],layer:'world',collider:{type:'box',size:[1,1,1],offset:[0,.5,0]},behavior:{type:'joint',node:'Lid',axis:'x',angle:-1.8,speed:2}}]});
test('rigid joint opens and closes without rotating its body, survives appearance edits, and resets',()=>{
 const s=fixture(),r=new WorldRuntime(s),o=s.objects[0];assert.equal(r.interaction(o.id,[0,1,2]).action,'open');
 r.act(o.id,[0,1,2]);for(let i=0;i<120;i++)r.step(1/60);
 assert.equal(r.states.get(o.id).angle,-1.8);assert.equal(r.yaw(o),.3);assert(r.blocked(0,0));
 const next=structuredClone(s);next.objects[0].asset='updated-kit';r.reconcile(next);assert.equal(r.states.get(o.id).angle,-1.8);
 r.act(o.id,[0,1,2]);for(let i=0;i<120;i++)r.step(1/60);assert.equal(r.states.get(o.id).angle,0);
 r.act(o.id,[0,1,2]);r.step(.1);r.reset();assert.deepEqual(r.states.get(o.id),{angle:0,open:false});
 r.gaitDiagnostics.set(o.id,['Missing node']);assert.equal(r.act(o.id,[0,1,2]),false);
});
test('joint frame rotates only the named subtree around its local pivot and rejects missing/duplicate names',()=>{
 const root=new Group(),lid=new Group(),tip=new Object3D(),body=new Object3D();lid.name='Lid';lid.position.set(0,.5,-.3);tip.position.set(0,0,.6);lid.add(tip);root.add(lid,body);
 const spec={stride:1,channels:[{node:'Lid',axis:'x',amplitude:1,phase:0}]};const rig=bindGait(root,spec);assert(rig.enabled);applyGait(rig,[-Math.PI/2]);root.updateMatrixWorld(true);
 assert(tip.getWorldPosition(new Vector3()).distanceTo(new Vector3(0,1.1,-.3))<1e-8);assert.equal(body.quaternion.w,1);
 assert(!bindGait(new Group(),spec).enabled);const duplicate=new Group();duplicate.name='Lid';root.add(duplicate);assert(!bindGait(root,spec).enabled);
});
test('joint schema rejects unsupported frames and invalid limits',()=>{
 for(const change of [{axis:'w'},{angle:4},{speed:0},{node:'invalid/name'}]){const s=fixture();Object.assign(s.objects[0].behavior,change);assert.throws(()=>validateRuntimeScene(s));}
});
