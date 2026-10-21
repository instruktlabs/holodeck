import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,Matrix4,Vector3} from 'three';
import {createFlockRenderData,updateFlockRenderData} from './flock-renderer.mjs';

function fixture(){
 const root=new Group(),material=new MeshBasicMaterial(),geometry=new BoxGeometry(.2,.2,.2),body=new Mesh(geometry,material),joint=new Group(),wing=new Mesh(geometry,material);joint.name='wing';joint.position.y=.1;wing.position.z=.4;joint.add(wing);root.add(body,joint);
 const item={id:'birds',scale:[1,1,1],rotation:[0,0,0],behavior:{count:2,bounds:[-4,4,2,6,-4,4],gait:{stride:1,channels:[{node:'wing',axis:'x',amplitude:.6,phase:0}]}}};
 const agent=(x,phaseOffset)=>({position:[x,3,0],previousPosition:[x,3,0],velocity:[1,0,0],previousVelocity:[1,0,0],distance:.25,previousDistance:.25,phaseOffset,bank:0,previousBank:0});
 return {root,geometry,material,item,state:{running:true,agents:[agent(-1,0),agent(1,.5)]}};
}
test('flock uses one instanced mesh per source part with distinct bird and wing transforms',()=>{
 const f=fixture(),data=createFlockRenderData(f.root,f.item);assert.equal(data.parts.length,2);assert.deepEqual(data.diagnostics,[]);updateFlockRenderData(data,f.state,f.item,.5);
 const a=new Matrix4(),b=new Matrix4(),pa=new Vector3(),pb=new Vector3();data.parts[0].instanced.getMatrixAt(0,a);data.parts[0].instanced.getMatrixAt(1,b);pa.setFromMatrixPosition(a);pb.setFromMatrixPosition(b);assert.equal(pa.x,-1);assert.equal(pb.x,1);
 data.parts[1].instanced.getMatrixAt(0,a);data.parts[1].instanced.getMatrixAt(1,b);pa.setFromMatrixPosition(a);pb.setFromMatrixPosition(b);assert.ok(Math.abs(pa.y-pb.y)>.3);assert.equal(f.root.getObjectByName('wing').rotation.x,0);
 assert.equal(data.parts[0].instanced.geometry,f.geometry);assert.equal(data.parts[0].instanced.material,f.material);
 let geometryDisposed=false;f.geometry.addEventListener('dispose',()=>geometryDisposed=true);data.dispose();assert.equal(geometryDisposed,false);f.geometry.dispose();f.material.dispose();
});
test('flock mesh budget and unresolved joints produce explicit diagnostics',()=>{
 const f=fixture();for(let i=0;i<32;i++)f.root.add(new Mesh(f.geometry,f.material));const data=createFlockRenderData(f.root,f.item);assert.equal(data.parts.length,0);assert.match(data.diagnostics.join(' '),/32/);data.dispose();f.geometry.dispose();f.material.dispose();
 const missing=fixture();missing.item.behavior.gait.channels[0].node='missing';const broken=createFlockRenderData(missing.root,missing.item);assert.match(broken.diagnostics.join(' '),/missing/);assert.equal(broken.rig.enabled,false);broken.dispose();missing.geometry.dispose();missing.material.dispose();
});
