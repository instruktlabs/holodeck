import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,Quaternion,Vector3} from 'three';
import {validateGait,gaitAngles,createGaitState,stepGaitState} from './gait.mjs';
import {bindGait,applyGait} from './gait-rig.mjs';

const gait=()=>({stride:1,channels:[{node:'left_hip',axis:'z',amplitude:.4,phase:0},{node:'right_hip',axis:'z',amplitude:.4,phase:Math.PI}]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('gait contract bounds channels, names, axes and distance units',()=>{
 assert.doesNotThrow(()=>validateGait(gait()));
 for(const patch of [{stride:0},{stride:11},{channels:[]},{channels:Array(33).fill(gait().channels[0])},{code:'run'}])assert.throws(()=>validateGait({...gait(),...patch}));
 for(const patch of [{node:'../hip'},{axis:'q'},{amplitude:2},{phase:7},{pivot:[0,0,0]}])assert.throws(()=>validateGait({...gait(),channels:[{...gait().channels[0],...patch}]}));
 assert.throws(()=>validateGait({...gait(),channels:[gait().channels[0],gait().channels[0]]}),/Duplicate/);
});
test('gait follows traveled distance, scale and opposed phases without changing input',()=>{
 const g=gait(),before=JSON.stringify(g),a=gaitAngles(g,.25,1,1);
 near(a[0],.4);near(a[1],-.4);near(gaitAngles(g,1.25,1,1)[0],a[0]);near(gaitAngles(g,.5,2,1)[0],a[0]);
 for(const angle of gaitAngles(g,.25,1,0))near(angle,0);assert.equal(JSON.stringify(g),before);
});
test('activity time freezes poses and blocked motion settles smoothly to rest',()=>{
 const s=createGaitState();stepGaitState(s,{distance:.25,speed:1},0,1);stepGaitState(s,{distance:.25,speed:1},.1,1);assert.ok(s.weight>0&&s.weight<1);
 const moving=s.weight;stepGaitState(s,{distance:.25,speed:0},.2,1);assert.ok(s.weight>0&&s.weight<moving);
 const frozen=structuredClone(s);stepGaitState(s,{distance:.8,speed:1},.2,1);assert.deepEqual(s,frozen);
 stepGaitState(s,{distance:9,speed:1},1,1,false);near(s.distance,.25);near(s.weight,frozen.weight);
 stepGaitState(s,{distance:0,speed:0},0,1);assert.equal(s.weight,0);assert.equal(s.distance,0);
});
test('named joint rotation preserves authored local transform, hierarchy and source asset',()=>{
 const source=new Group(),hip=new Group(),foot=new Mesh(new BoxGeometry(.1,.1,.2),new MeshBasicMaterial());hip.name='left_hip';hip.position.set(0,1,.2);hip.rotation.x=.2;foot.position.y=-1;hip.add(foot);source.add(hip);
 const clone=source.clone(true),g={stride:1,channels:[gait().channels[0]]},rig=bindGait(clone,g),q=hip.quaternion.clone();assert.deepEqual(rig.diagnostics,[]);
 applyGait(rig,[.4]);const joint=clone.getObjectByName('left_hip'),expected=q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.4));
 near(joint.quaternion.angleTo(expected),0);assert.deepEqual(joint.position.toArray(),[0,1,.2]);assert.equal(joint.children[0].parent,joint);near(source.children[0].quaternion.angleTo(q),0);
 applyGait(rig,[0]);near(joint.quaternion.angleTo(q),0);assert.deepEqual(clone.position.toArray(),[0,0,0]);
 foot.geometry.dispose();foot.material.dispose();
});
test('missing, duplicate and root targets disable the full rig with explicit diagnostics',()=>{
 const missing=bindGait(new Group(),gait());assert.equal(missing.enabled,false);assert.equal(missing.diagnostics.length,2);
 const root=new Group();root.name='left_hip';const one=new Group(),two=new Group();one.name=two.name='right_hip';root.add(one,two);
 const rig=bindGait(root,gait());assert.equal(rig.enabled,false);assert.match(rig.diagnostics.join(' '),/root/);assert.match(rig.diagnostics.join(' '),/ambiguous/);
 applyGait(rig,[1,1]);assert.deepEqual(one.rotation.toArray().slice(0,3),[0,0,0]);
});
test('multiple axes compose from rest exactly once rather than accumulating each frame',()=>{
 const root=new Group(),joint=new Group();joint.name='joint';root.add(joint);
 const g={stride:1,channels:[{node:'joint',axis:'z',amplitude:.2,phase:0},{node:'joint',axis:'x',amplitude:.3,phase:0}]},rig=bindGait(root,g);
 applyGait(rig,[.2,.3]);const first=joint.quaternion.clone();for(let i=0;i<120;i++)applyGait(rig,[.2,.3]);near(joint.quaternion.angleTo(first),0);
});
