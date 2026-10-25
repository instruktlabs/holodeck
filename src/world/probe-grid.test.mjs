import test from 'node:test';
import assert from 'node:assert/strict';
import {DirectionalLight,Group,Mesh,MeshBasicNodeMaterial,Scene,Texture} from 'three/webgpu';
import {LightProbeGrid} from 'three/addons/lighting/LightProbeGrid.js';
import {probeGridBake} from './probe-grid.js';

// A world with a dome that has a capture material, a cove the captures leave out, and a
// shadow-casting sun; LightProbeGrid.bake is replaced by a recorder of what it would see.
function world(){
  const scene=new Scene(),material=new MeshBasicNodeMaterial(),capture=new MeshBasicNodeMaterial();
  const dome=new Mesh(undefined,material);dome.userData.skyCaptureMaterial=capture;
  const cove=new Group();cove.userData.skyLightExclude=true;
  const sun=new DirectionalLight();sun.castShadow=true;sun.position.set(10,20,5);
  scene.add(dome,cove,sun,sun.target);
  return {scene,dome,material,capture,cove,sun};
}
function recordBakes(t,w){
  const calls=[],bake=LightProbeGrid.prototype.bake;
  LightProbeGrid.prototype.bake=function(gl,scene,options){
    calls.push({intensity:this.intensity,pass:options.pass,start:options.start,count:options.count,environment:scene.environmentNode?.constructor?.type??null,
      dome:w.dome.material===w.capture?'capture':'view',cove:w.cove.visible,shadowBox:w.sun.shadow.camera.right});
  };
  t.after(()=>{LightProbeGrid.prototype.bake=bake;});
  return calls;
}
const box={min:[0,0,0],max:[8,8,8],spacing:8};

test('with a bounce pass the grid is in the scene from the start, with the capture kept for reflections, and bakes as the sky light captures (H127)',t=>{
  const lights=new Map(),library={getLightNodeClass:type=>lights.get(type)??null,addLight:(node,type)=>lights.set(type,node)};
  const w=world(),calls=recordBakes(t,w),gl={pendingCompiles:()=>false,library},before=w.sun.shadow.camera.right;
  const bake=probeGridBake({gl,scene:w.scene,grid:{...box,bounces:1,intensity:.5},capture:new Texture(),intensity:.6});
  // Before any step, so the materials are built with both once: the grid with its (blank)
  // atlas and its light node registered, and the environment without its diffuse term.
  const grid=w.scene.getObjectByName('sky-light-grid');
  assert.ok(grid);assert.ok(grid.texture);assert.equal(lights.get(LightProbeGrid)?.type,'LightProbeGridNode');
  assert.equal(w.scene.environmentNode?.constructor?.type,'ReflectionEnvironmentNode');
  assert.equal(bake.probes,8);
  const steps=[];for(let i=0;i<6&&!steps.at(-1);i++)steps.push(bake.step());
  // pass 0, pass 1, then done.
  assert.deepEqual(steps,[false,false,true]);
  assert.deepEqual(calls.map(c=>[c.pass,c.start,c.count,c.environment]),[[0,0,8,'ReflectionEnvironmentNode'],[1,0,8,'ReflectionEnvironmentNode']]);
  // Its fill is relative to the sky light's.
  for(const c of calls)assert.ok(Math.abs(c.intensity-.3)<1e-9);
  // Each probe sees the dome without its sun disc and no cove, and the sun's shadows over the grid.
  for(const c of calls){assert.equal(c.dome,'capture');assert.equal(c.cove,false);assert.ok(c.shadowBox>=Math.hypot(8,8,8)/2);}
  // The view gets everything back.
  assert.equal(w.dome.material,w.material);assert.equal(w.cove.visible,true);assert.equal(w.sun.shadow.camera.right,before);
  assert.equal(bake.progress,1);assert.equal(bake.step(),true);assert.equal(calls.length,2);
  bake.dispose();
  assert.equal(w.scene.environmentNode,undefined);assert.equal(w.scene.getObjectByName('sky-light-grid'),undefined);
});

test('without bounces the single pass sees the capture fill, the switch follows it, and ranges wait out compiles (H127)',t=>{
  const w=world(),calls=recordBakes(t,w);let pending=true;
  const bake=probeGridBake({gl:{pendingCompiles:()=>pending},scene:w.scene,grid:{...box,bounces:0},capture:new Texture()});
  assert.ok(w.scene.getObjectByName('sky-light-grid'));assert.equal(w.scene.environmentNode,undefined);
  // A range that left pipelines compiling is taken again.
  assert.equal(bake.step(),false);assert.equal(bake.progress,0);
  pending=false;
  assert.equal(bake.step(),false);assert.equal(w.scene.environmentNode,undefined);
  assert.equal(bake.step(),false);assert.equal(w.scene.environmentNode?.constructor?.type,'ReflectionEnvironmentNode');
  assert.equal(bake.step(),true);
  assert.deepEqual(calls.map(c=>[c.pass,c.start,c.environment]),[[0,0,null],[0,0,null]]);
  bake.dispose();
});
