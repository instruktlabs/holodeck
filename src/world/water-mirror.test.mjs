import test from 'node:test';
import assert from 'node:assert/strict';
import {Frustum,Matrix4,PerspectiveCamera,Scene,Vector3,Vector4,WebGPUCoordinateSystem} from 'three/webgpu';
import {mirrorWindow,waterWindow,windowedMirror} from './water-mirror.mjs';

const view=(position,target)=>{
 const camera=new PerspectiveCamera(63,16/9,.1,2000);camera.coordinateSystem=WebGPUCoordinateSystem;camera.updateProjectionMatrix();
 camera.position.set(...position);camera.lookAt(...target);camera.updateMatrixWorld();return camera;
};

test('the water window is the pool\'s rectangle on screen, clipped to the near plane',()=>{
 const camera=view([0,2,10],[0,2,-20]),window=waterWindow(camera,[-5,5,-20,-10],0,0);
 const centre=new Vector3(0,0,-15).project(camera);
 assert.ok(window[0]<centre.x&&centre.x<window[1]&&window[2]<centre.y&&centre.y<window[3]);
 assert.ok(window[3]<0,'a pool below the horizon stays in the lower half');
 assert.equal(waterWindow(camera,[-5,5,20,30],0),null,'water behind the camera');
 const straddling=waterWindow(camera,[-5,5,-20,30],0,0);
 assert.ok(straddling.every(Number.isFinite));assert.equal(straddling[2],-1,'reaching under the camera, it meets the bottom edge');
 const grown=waterWindow(camera,[-5,5,-20,-10],0,.05);assert.ok(Math.abs(grown[0]-(window[0]-.05))<1e-9);
});

test('the narrowed projection lands every point on the pixel the full view gave it',()=>{
 const width=640,height=360,{viewport:[left,top,w,h],matrix}=mirrorWindow([-.3,.55,-.9,-.2],width,height);
 // The mirror image is flipped in x: the window [-.3, .55] covers u from .225 to .65.
 assert.ok(left<=.225*width&&left+w>=.65*width&&left>.2*width&&left+w<.68*width);
 const camera=view([0,2,10],[0,0,-20]),narrow=camera.projectionMatrix.clone().premultiply(matrix);
 for(let i=0;i<200;i++){
  const point=new Vector4((Math.random()-.5)*8,(Math.random()-.5)*4,-5-Math.random()*40,1);// view space
  const a=point.clone().applyMatrix4(camera.projectionMatrix),b=point.clone().applyMatrix4(narrow);
  const full=[(a.x/a.w+1)/2*width,(1-a.y/a.w)/2*height],part=[left+(b.x/b.w+1)/2*w,top+(1-b.y/b.w)/2*h];
  assert.ok(Math.abs(full[0]-part[0])<1e-6&&Math.abs(full[1]-part[1])<1e-6,`${full} vs ${part}`);
  assert.equal(b.z,a.z);assert.equal(b.w,a.w);
 }
 assert.equal(mirrorWindow([-1,1,-1,1],width,height).full,true);
});

test('the mirror culls what reflects outside the water but keeps what reflects in it (H98)',()=>{
 const camera=view([0,2,10],[0,0,-20]),scene=new Scene();
 const render=(bounds,margin)=>{
  const node=windowedMirror({bounds,level:0,resolutionScale:.5,margin}),calls=[];
  const renderer={coordinateSystem:WebGPUCoordinateSystem,autoClear:false,target:null,getDrawingBufferSize:v=>v.set(1280,720),getRenderTarget(){return null;},getMRT(){return null;},setMRT(){},setRenderTarget(t){this.target=t;},clear(){},
   render(_,mirror){calls.push({projection:mirror.projectionMatrix.clone(),inverse:mirror.matrixWorldInverse.clone(),viewport:this.target.viewport.clone(),size:[this.target.width,this.target.height]});}};
  const material={visible:true};
  node.reflector.updateBefore({scene,camera,renderer,material});
  assert.equal(calls.length,1);assert.equal(material.visible,true,'the water is shown again');assert.equal(node.value,node.reflector.getRenderTarget(node.reflector.getVirtualCamera(camera)).texture);
  const [{projection,inverse,viewport,size}]=calls;
  return {frustum:new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(projection,inverse),WebGPUCoordinateSystem),viewport,size};
 };
 // A margin of 2 grows the window past the screen: the whole view, as three renders it.
 const pool=render([-5,5,-20,-10]),everything=render([-5,5,-20,-10],2),sea=render([-1e4,1e4,-1e4,1e4]);
 assert.deepEqual(everything.size,[640,360]);assert.deepEqual(everything.viewport.toArray(),[0,0,640,360],'a window covering the view keeps the whole target');
 assert.ok(sea.viewport.y>100&&sea.viewport.y+sea.viewport.w===360&&sea.viewport.z===640,`an open sea fills the view below the horizon: ${sea.viewport.toArray()}`);
 assert.ok(pool.viewport.z<640&&pool.viewport.w<180,`a viewport over the pool alone: ${pool.viewport.toArray()}`);
 // Seen from 2 m up, a point 3 m high at z -52.5 reflects at the pool's centre (z -15);
 // one 25 m to the side reflects 10 m beside the pool.
 const reflected=new Vector3(0,3,-52.5),aside=new Vector3(25,3,-52.5),below=new Vector3(0,-3,-15);
 assert.ok(pool.frustum.containsPoint(reflected)&&everything.frustum.containsPoint(reflected),'a column that reflects in the pool');
 assert.ok(everything.frustum.containsPoint(aside)&&!pool.frustum.containsPoint(aside),'one that reflects beside the pool is culled');
 assert.ok(!pool.frustum.containsPoint(below)&&!everything.frustum.containsPoint(below),'the water plane still clips what lies below it');
});
