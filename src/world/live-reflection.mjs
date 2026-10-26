import * as THREE from 'three/webgpu';

// asset.reflection 'live' (H130). A probe mirror (H85) reflects the world captured once from a
// fixed point without the maker, so a mirror orb never showed the walker passing it. A live
// placement keeps a cube of its own, captured from its own centre with three's CubeCamera,
// that the walker appears in. A full cube is six scene renders, so a capture runs one face a
// frame, for the one placement on screen that has waited longest and covers at least
// LIVE_MIN_PIXELS; the environment's PMREM is rebuilt after each sixth face, as
// CubeCamera.update does (needsPMREMUpdate). A placement's first cube is taken whole the first
// frame it is in view; until then it reflects the sky light's capture.
// Captures draw the world as the sky light's captures do (userData.skyCaptureMaterial): water
// in its plain flowing copy rather than its mirror, which would render the scene again for
// every face, the dome without its sun disc, and other mirrors reflecting the sky.
export const LIVE_SIZE=256,LIVE_MIN_PIXELS=24,LIVE_SLOW_FRAMES=120,LIVE_WARM=8,LIVE_RETRIES=300;
const entries=new Set();
let lastFrame=null,holds=0;
// The sky light holds live captures until its own captures and probe grid are done: a cube
// drawn while they compile pipelines for their targets left both waiting on compiles that
// finish only when the objects are drawn again (the grid reached 41% in three minutes,
// measured). Once released, captures run every frame, and an object still compiling is
// missing from one face until that face comes round again.
export function holdLiveReflections(){holds++;let held=true;return()=>{if(held){held=false;holds--;}};}
const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),sphere=new THREE.Sphere(),part=new THREE.Sphere(),eye=new THREE.Vector3();
// The placement's extent from its meshes' vertices. GLTFLoader sets each geometry's bounding
// sphere around its accessor's box, √3 times an orb's radius, and the cube's near plane, set
// just outside it, clipped the walker standing beside the orb (measured).
const exact=new WeakMap();
export function geometrySphere(geometry){
 let found=exact.get(geometry);
 if(!found){const position=geometry.getAttribute('position'),point=new THREE.Vector3();found=new THREE.Sphere();new THREE.Box3().setFromBufferAttribute(position).getCenter(found.center);
  for(let i=0;i<position.count;i++)found.radius=Math.max(found.radius,found.center.distanceTo(point.fromBufferAttribute(position,i)));exact.set(geometry,found);}
 return found;
}
export function meshSphere(object,out){
 let found=false;object.updateWorldMatrix(true,true);
 object.traverse(mesh=>{
  if(!mesh.isMesh)return;
  part.copy(geometrySphere(mesh.geometry)).applyMatrix4(mesh.matrixWorld);if(found)out.union(part);else{out.copy(part);found=true;}
 });
 return found;
}

// Registers a placement's object; onReady receives its cube texture once the first cube lands.
export function watchLiveReflection(object,onReady){
 const target=new THREE.CubeRenderTarget(LIVE_SIZE,{type:THREE.HalfFloatType,generateMipmaps:false});
 target.texture.name=`live reflection ${object.name||object.uuid.slice(0,8)}`;
 const entry={object,target,camera:new THREE.CubeCamera(.1,1000,target),face:0,ready:false,waited:0,tries:0,radius:0,onReady};
 entries.add(entry);
 return {texture:target.texture,dispose(){entries.delete(entry);target.dispose();}};
}

// The screen radius in pixels of a sphere seen by a perspective camera.
export function screenRadius(camera,center,radius,height){
 const distance=Math.max(camera.near,center.distanceTo(eye.setFromMatrixPosition(camera.matrixWorld)));
 return radius/(distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*height/2;
}

// Picks this frame's work: a placement in view without its first cube, else the on-screen
// placement that has waited longest. Returns null when there is none.
export function pickLiveReflection(camera,height,list=entries){
 camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem);
 let pick=null;
 for(const entry of list){
  entry.waited++;
  if(!entry.object.parent)continue;
  if(!meshSphere(entry.object,sphere))continue;
  entry.center=(entry.center??new THREE.Vector3()).copy(sphere.center);entry.radius=sphere.radius;
  if(!frustum.intersectsSphere(sphere))continue;
  if(!entry.ready){if(!pick||pick.ready)pick=entry;continue;}
  if(pick&&!pick.ready)continue;
  // A small placement refreshes slowly, so a face it missed comes round in a few seconds.
  if(entry.waited<LIVE_SLOW_FRAMES&&screenRadius(camera,sphere.center,sphere.radius,height)<LIVE_MIN_PIXELS)continue;
  if(!pick||entry.waited>pick.waited)pick=entry;
 }
 return pick;
}

function renderFaces(gl,scene,entry,faces){
 const {camera,target,object}=entry;
 if(camera.coordinateSystem!==gl.coordinateSystem){camera.coordinateSystem=gl.coordinateSystem;camera.updateCoordinateSystem();}
 // The near plane sits just outside the placement, which is hidden while its cube is drawn.
 const near=Math.max(.05,entry.radius*1.02);
 for(const face of camera.children)if(face.near!==near){face.near=near;face.updateProjectionMatrix();}
 camera.position.copy(entry.center);camera.updateMatrixWorld();
 const restore=[];
 scene.traverse(o=>{if(o.userData.skyCaptureMaterial){const material=o.material;o.material=o.userData.skyCaptureMaterial;restore.push(()=>{o.material=material;});}});
 const visible=object.visible;object.visible=false;
 const previous=gl.getRenderTarget(),previousFace=gl.getActiveCubeFace(),previousLevel=gl.getActiveMipmapLevel();
 try{
  for(const face of faces){
   gl.setRenderTarget(target,face);
   if(gl.reversedDepthBuffer&&gl.autoClear===false)gl.clearDepth();
   gl.render(scene,camera.children[face]);
  }
 }finally{
  gl.setRenderTarget(previous,previousFace,previousLevel);object.visible=visible;for(const undo of restore)undo();
 }
}

// Called from every live placement's frame callback; only the first call in a frame works.
export function stepLiveReflections({gl,scene,camera,size,clock}){
 if(!entries.size||holds||lastFrame===clock.elapsedTime)return;
 lastFrame=clock.elapsedTime;
 // The environment's PMREM is first built when the material binding the new cube compiles,
 // and its own passes were skipped while their pipelines compiled: a small orb, which comes
 // round only every LIVE_SLOW_FRAMES, stayed black (measured). It is rebuilt each frame for
 // LIVE_WARM frames after the cube is bound.
 for(const e of entries)if(e.settle>0){e.settle--;e.target.texture.needsPMREMUpdate=true;}
 const entry=pickLiveReflection(camera,size.height);if(!entry)return;
 entry.waited=0;
 // A first cube drawn while pipelines for its target were compiling left those objects out (a
 // black orb, measured, though the compile count read zero just after), so a new cube is taken
 // whole for LIVE_WARM frames, and on while compiles are pending, before it replaces the sky
 // light's capture; drawing again is what lets the compiles finish.
 // A cube still incomplete at the cap is shown, and taken whole again at its next turn.
 if(!entry.ready||entry.partial){
  renderFaces(gl,scene,entry,[0,1,2,3,4,5]);
  const compiling=!!gl.pendingCompiles?.();
  if(!entry.ready&&++entry.tries<LIVE_RETRIES&&(compiling||entry.tries<LIVE_WARM))return;
  entry.partial=compiling;entry.target.texture.needsPMREMUpdate=true;
  if(!entry.ready){entry.ready=true;entry.settle=LIVE_WARM;entry.onReady(entry.target.texture);}
  return;
 }
 renderFaces(gl,scene,entry,[entry.face]);
 entry.face=(entry.face+1)%6;
 if(entry.face===0)entry.target.texture.needsPMREMUpdate=true;
}
