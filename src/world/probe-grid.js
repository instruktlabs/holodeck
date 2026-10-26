import {Vector3} from 'three/webgpu';
import {texture} from 'three/tsl';
import {LightProbeGrid} from 'three/addons/lighting/LightProbeGrid.js';
import {LightProbeGridNode} from 'three/addons/tsl/lighting/LightProbeGridNode.js';
import {GRID_DEFAULTS,gridResolution} from './sky.mjs';
import {reflectionsOnlyEnvironment} from './reflections-only.mjs';

// sky.light.grid (H127, plateau plan step 5; see sky.mjs). The sky light's single probe lit
// every surface with one unoccluded view of the world: shade under a lintel got the same
// blue sky and turquoise pools as an open terrace. A box of probes baked in the browser
// (three's LightProbeGrid, L2 spherical harmonics with bounces between surfaces) gives each
// point the light around it, so shade facing sunlit stone is lit warm and recesses darken.

// With the grid in place the sky light's capture lights by reflection alone, or the
// capture's diffuse term would light shade twice (see reflections-only.mjs).
export {isReflectionsOnly} from './reflections-only.mjs';

// Probes baked per frame. The bake renders the scene six times per probe, about 2 ms a face
// on the hub laptop, mostly per-object CPU work, and every frame between ranges also draws the
// view, its water mirror and the shadow map (40 ms a frame while the bake runs, measured).
// Sixteen probes a frame keep the view drawing at a few frames a second while the grid fills,
// with half the view's frames of eight.
export const PROBES_PER_FRAME=16;
const CUBE_SIZE=16,MAX_RETRIES=30;

// Runs fn with the scene as the bake should see it, as in the sky light's captures: the
// cove, the maker and proposal ghosts hidden, and the dome in its capture material,
// without the sun disc, which the sun light already brings. The sun's shadow box, which
// follows the view, is fitted around the whole grid so every probe sees its shadows.
function asBaked(scene,box,fn){
  const restore=[];
  scene.traverse(o=>{
    if(o.userData.skyLightExclude&&o.visible){o.visible=false;restore.push(()=>{o.visible=true;});}
    else if(o.userData.skyCaptureMaterial){const material=o.material;o.material=o.userData.skyCaptureMaterial;restore.push(()=>{o.material=material;});}
  });
  let sun=null;scene.traverse(o=>{if(!sun&&o.isDirectionalLight&&o.castShadow)sun=o;});
  if(sun){
    const camera=sun.shadow.camera,saved={left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,near:camera.near,far:camera.far},position=sun.position.clone(),target=sun.target.position.clone();
    const center=box.getCenter(new Vector3()),half=box.getSize(new Vector3()).length()/2,direction=position.clone().sub(target).normalize();
    sun.target.position.copy(center);sun.target.updateMatrixWorld();sun.position.copy(center).addScaledVector(direction,half+50);sun.updateMatrixWorld();
    Object.assign(camera,{left:-half,right:half,top:half,bottom:-half,near:.1,far:2*half+100});camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
    restore.push(()=>{Object.assign(camera,saved);camera.updateProjectionMatrix();sun.position.copy(position);sun.target.position.copy(target);sun.target.updateMatrixWorld();sun.updateMatrixWorld();sun.shadow.needsUpdate=true;});
  }
  try{return fn();}finally{for(const undo of restore.reverse())undo();}
}

// A bake that fills a few probes a frame. The grid joins the scene as soon as the bake is
// made, its atlas blank (three's grid adds no light until the atlas exists, so it is made
// now; _ensureTextures is three r186's, pinned), and with a bounce pass to come the capture
// keeps only its reflections from then on: every lit material is built once, with the rest
// of the world, rather than rebuilt when the grid arrives (about 19 s of compiling on the hub
// laptop, measured). step() returns true once every pass is done; a range whose pipelines
// were still compiling is taken again, since parallel compilation skips objects that aren't
// ready and the probes would miss them.
// The grid's intensity scales the fill against the sky light's (the intensity passed in),
// so 1 lights shade as brightly as the capture's diffuse term did, now by position.
export function probeGridBake({gl,scene,grid:config,capture,intensity=1}){
  const g={...GRID_DEFAULTS,...config},[nx,ny,nz]=gridResolution(g),size=[0,1,2].map(i=>g.max[i]-g.min[i]);
  const grid=new LightProbeGrid(size[0],size[1],size[2],nx,ny,nz);grid.name='sky-light-grid';grid.intensity=g.intensity*intensity;
  grid.position.set(...[0,1,2].map(i=>(g.min[i]+g.max[i])/2));grid.updateMatrixWorld();grid._ensureTextures();
  // The atlas is set up as a render target before any material binds it, as three's own
  // bounce grid is: a render target texture first created for sampling is destroyed and made
  // again when the bake first draws into it, and the materials kept the destroyed one (WebGPU
  // "Destroyed texture used in a submit" every frame, measured). three.js #35202, fixed after
  // r186 by #35204, which initialises render target textures with their target.
  gl.initRenderTarget?.(grid._renderTarget);
  // three registers the grid's light node with the renderer on its first bake; the grid is
  // in the scene before that, and materials built without the node leave the grid out for
  // good (three warns "Light node not found" and skips it), so it is registered here.
  if(gl.library?.getLightNodeClass(LightProbeGrid)===null)gl.library.addLight(LightProbeGridNode,LightProbeGrid);
  scene.add(grid);
  const box={getCenter:v=>v.copy(grid.position),getSize:v=>v.set(...size)},total=nx*ny*nz,passes=g.bounces+1,far=Math.max(400,Math.hypot(...size)*2);
  let pass=0,start=0,retries=0,finished=false,previous=null,reflections=null;
  // The capture's diffuse term would light shade a second time over the grid's fill. With
  // a bounce pass, the first pass sees surfaces lit by the sun alone, and each bounce pass
  // lights them from the pass before. A single pass sees surfaces with the capture's fill
  // instead, and the switch follows it, in a step of its own; the caller steps again only
  // once the rebuilt pipelines have compiled.
  const reflectionsOnly=()=>{previous=scene.environmentNode;reflections=scene.environmentNode=reflectionsOnlyEnvironment(texture(capture));};
  if(passes>1)reflectionsOnly();
  return {
    probes:total,
    get progress(){return Math.min(1,(pass*total+start)/(passes*total));},
    step(){
      if(finished)return true;
      if(pass>=passes){
        if(!reflections){reflectionsOnly();return false;}
        finished=true;return true;
      }
      const count=Math.min(PROBES_PER_FRAME,total-start);
      asBaked(scene,box,()=>grid.bake(gl,scene,{cubemapSize:CUBE_SIZE,near:.1,far,pass,start,count}));
      if(gl.pendingCompiles?.()&&retries<MAX_RETRIES){retries++;return false;}
      retries=0;start+=count;if(start>=total){start=0;pass++;}
      return false;
    },
    dispose(){grid.removeFromParent();grid.dispose?.();if(reflections&&scene.environmentNode===reflections)scene.environmentNode=previous;},
  };
}
